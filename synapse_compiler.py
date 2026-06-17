"""SYNAPSE: Neuromorphic Synthesis Engine

Reference implementation for the MVP described in the PRD.

Scope:
- Parse a restricted PyTorch nn.Sequential state_dict containing nn.Linear
  and nn.ReLU layers.
- Map linear weights/biases into an idealized differential conductance IR.
- Map ReLU activations to precision half-wave rectifier (RECTIFIER) nodes.
- Export a SPICE-like netlist text representation.
- Perform closed-form validation against PyTorch forward outputs.
- Optionally emit the IR as JSON for visualization/UI consumers.

This compiler supports Linear + ReLU stacks with non-contiguous state_dict
indices (ReLU layers have no parameters and are inferred from index gaps).
It is a compiler for a symbolic analog abstraction, not a fabrication-grade
hardware tool.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union
import argparse
import json
import math
import pathlib
import sys

try:
    import torch
    import torch.nn as nn
except Exception:  # pragma: no cover
    torch = None
    nn = None


# ----------------------------
# Configuration / conventions
# ----------------------------

ALPHA_V = 1.0  # V / digital unit
BETA_S = 1e-6  # S / digital unit
RF_OHM = 1e6   # Ohm
VREF = 1.0     # V
VIN_MIN = -1.0 # V
VIN_MAX = 1.0  # V
ETA = 1e-7     # numerical stabilizer for relative error
ABS_ERR_BOUND = 1e-6
REL_ERR_BOUND = 1e-5


# ----------------------------
# IR schema
# ----------------------------

@dataclass(frozen=True)
class Node:
    id: str
    type: str
    domain: str
    initial_value: Optional[float] = None


@dataclass(frozen=True)
class ConductanceEdge:
    source: str
    target: str
    type: str
    value: float


@dataclass(frozen=True)
class TiaEdge:
    source_pos: str
    source_neg: str
    target: str
    type: str
    gain: float


@dataclass
class IRGraph:
    version: str
    metadata: Dict[str, Any]
    nodes: List[Node]
    edges: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "metadata": self.metadata,
            "nodes": [asdict(n) for n in self.nodes],
            "edges": list(self.edges),
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)


# ----------------------------
# Exceptions
# ----------------------------

class SynapseError(Exception):
    pass


class ModelValidationError(SynapseError):
    pass


class CompilationError(SynapseError):
    pass


# ----------------------------
# Model inspection / parsing
# ----------------------------

@dataclass(frozen=True)
class LinearLayerSpec:
    index: int
    in_features: int
    out_features: int
    weight: List[List[float]]  # shape: [out_features][in_features]
    bias: List[float]          # shape: [out_features]


@dataclass(frozen=True)
class ActivationSpec:
    index: int
    activation_type: str  # e.g., 'relu'
    features: int  # number of features (inherited from preceding linear layer's out_features)


LayerSpec = Union[LinearLayerSpec, ActivationSpec]


def _is_float_scalar(x: Any) -> bool:
    return isinstance(x, (float, int)) and not isinstance(x, bool)


def _tensor_to_nested_list(t: Any) -> List[Any]:
    if torch is None:
        raise CompilationError("PyTorch is required to parse a state_dict in this implementation.")
    if not hasattr(t, "detach"):
        raise ModelValidationError("Expected a torch.Tensor in state_dict.")
    return t.detach().cpu().tolist()


def validate_state_dict_structure(state_dict: Dict[str, Any]) -> None:
    """Validate that the state_dict belongs to an nn.Sequential with Linear (+ optional ReLU) modules.

    The accepted key convention is:
      0.weight, 0.bias, 2.weight, 2.bias, ...
    Gaps in indices are allowed (non-parametric layers such as ReLU).
    Each index that has any weight/bias key must have BOTH.
    """
    if not isinstance(state_dict, dict):
        raise ModelValidationError("state_dict must be a dict-like mapping.")

    keys = list(state_dict.keys())
    if not keys:
        raise ModelValidationError("Empty state_dict is not supported.")

    # Collect indices that have .weight or .bias keys.
    weight_indices: set[int] = set()
    bias_indices: set[int] = set()
    for k in keys:
        parts = k.split(".")
        if len(parts) >= 2 and parts[0].isdigit():
            idx = int(parts[0])
            if parts[1] == "weight":
                weight_indices.add(idx)
            elif parts[1] == "bias":
                bias_indices.add(idx)

    all_param_indices = weight_indices | bias_indices
    if not all_param_indices:
        raise ModelValidationError("No Linear layers detected (no weight/bias keys).")

    # Every index that appears must have BOTH weight and bias.
    for idx in sorted(all_param_indices):
        if idx not in weight_indices:
            raise ModelValidationError(f"Layer {idx} has bias but no weight key.")
        if idx not in bias_indices:
            raise ModelValidationError(f"Layer {idx} has weight but no bias key.")


def extract_layers(state_dict: Dict[str, Any]) -> List[LayerSpec]:
    """Extract an ordered list of LinearLayerSpec and ActivationSpec from a state_dict.

    Indices with weight/bias become LinearLayerSpec.  Gaps in the index
    sequence are inferred to be ReLU activation layers (ActivationSpec).
    """
    validate_state_dict_structure(state_dict)

    linear_indices = sorted({
        int(k.split(".")[0])
        for k in state_dict.keys()
        if k.split(".")[0].isdigit() and (".weight" in k or ".bias" in k)
    })
    max_idx = max(linear_indices)
    all_indices = list(range(0, max_idx + 1))

    layers: List[LayerSpec] = []
    last_out_features = 0

    for idx in all_indices:
        if idx in linear_indices:
            w = state_dict[f"{idx}.weight"]
            b = state_dict[f"{idx}.bias"]

            if torch is None:
                raise CompilationError("PyTorch is required for this reference implementation.")
            if not hasattr(w, "shape") or not hasattr(b, "shape"):
                raise ModelValidationError(f"Layer {idx} tensors are invalid.")

            if len(w.shape) != 2:
                raise ModelValidationError(f"Layer {idx} weight must be rank-2, got shape {tuple(w.shape)}")
            if len(b.shape) != 1:
                raise ModelValidationError(f"Layer {idx} bias must be rank-1, got shape {tuple(b.shape)}")

            out_features, in_features = int(w.shape[0]), int(w.shape[1])
            if int(b.shape[0]) != out_features:
                raise ModelValidationError(
                    f"Layer {idx} bias length {int(b.shape[0])} does not match out_features {out_features}."
                )

            weight = _tensor_to_nested_list(w)
            bias = _tensor_to_nested_list(b)
            layers.append(LinearLayerSpec(idx, in_features, out_features, weight, bias))
            last_out_features = out_features
        else:
            # Non-parametric layer (ReLU) — infer features from preceding linear
            layers.append(ActivationSpec(index=idx, activation_type="relu", features=last_out_features))

    return layers


def extract_linear_layers(state_dict: Dict[str, Any]) -> List[LinearLayerSpec]:
    """Backward-compatible: returns only LinearLayerSpec entries."""
    return [l for l in extract_layers(state_dict) if isinstance(l, LinearLayerSpec)]


# ----------------------------
# Analog mapping
# ----------------------------

@dataclass
class LayerMappingResult:
    layer_index: int
    in_features: int
    out_features: int
    g_pos: List[List[float]]
    g_neg: List[List[float]]
    bias_g_pos: List[float]
    bias_g_neg: List[float]


def encode_weight_to_conductance(w: float) -> Tuple[float, float]:
    if w >= 0:
        return (w * BETA_S, 0.0)
    return (0.0, abs(w) * BETA_S)


def encode_bias_to_conductance(b: float) -> Tuple[float, float]:
    if b >= 0:
        return (b * BETA_S, 0.0)
    return (0.0, abs(b) * BETA_S)


def map_layer_to_differential(layer: LinearLayerSpec) -> LayerMappingResult:
    g_pos: List[List[float]] = []
    g_neg: List[List[float]] = []

    for row in layer.weight:
        pos_row: List[float] = []
        neg_row: List[float] = []
        for w in row:
            gp, gn = encode_weight_to_conductance(float(w))
            pos_row.append(gp)
            neg_row.append(gn)
        g_pos.append(pos_row)
        g_neg.append(neg_row)

    bias_g_pos: List[float] = []
    bias_g_neg: List[float] = []
    for b in layer.bias:
        gp, gn = encode_bias_to_conductance(float(b))
        bias_g_pos.append(gp)
        bias_g_neg.append(gn)

    return LayerMappingResult(
        layer_index=layer.index,
        in_features=layer.in_features,
        out_features=layer.out_features,
        g_pos=g_pos,
        g_neg=g_neg,
        bias_g_pos=bias_g_pos,
        bias_g_neg=bias_g_neg,
    )


# ----------------------------
# IR builder
# ----------------------------

class IRBuilder:
    def __init__(self, alpha_v: float = ALPHA_V, beta_s: float = BETA_S, rf_ohm: float = RF_OHM):
        self.alpha_v = alpha_v
        self.beta_s = beta_s
        self.rf_ohm = rf_ohm
        self.nodes: List[Node] = []
        self.edges: List[Dict[str, Any]] = []
        self._node_ids: set[str] = set()

    def _add_node(self, node: Node) -> None:
        if node.id not in self._node_ids:
            self.nodes.append(node)
            self._node_ids.add(node.id)

    def build(self, layers: List[LayerSpec]) -> IRGraph:
        self.nodes = []
        self.edges = []
        self._node_ids = set()

        self._add_node(Node(id="GND", type="ground", domain="reference", initial_value=0.0))

        prev_linear: Optional[LinearLayerSpec] = None

        for layer in layers:
            if isinstance(layer, LinearLayerSpec):
                mapping = map_layer_to_differential(layer)

                # Input nodes for this layer
                for i in range(layer.in_features):
                    self._add_node(Node(id=f"IN_{layer.index}_{i}", type="voltage_source", domain="input"))

                self._add_node(Node(id=f"REF_{layer.index}", type="voltage_source", domain="bias_reference", initial_value=VREF))

                # Junctions and outputs
                for j in range(layer.out_features):
                    jp = f"JUNCT_{layer.index}_{j}_POS"
                    jn = f"JUNCT_{layer.index}_{j}_NEG"
                    out = f"OUT_{layer.index}_{j}"
                    self._add_node(Node(id=jp, type="current_summation", domain="hidden"))
                    self._add_node(Node(id=jn, type="current_summation", domain="hidden"))
                    self._add_node(Node(id=out, type="voltage_readout", domain="activation"))

                    # Input conductances
                    for i in range(layer.in_features):
                        gp = mapping.g_pos[j][i]
                        gn = mapping.g_neg[j][i]
                        if gp != 0.0:
                            self.edges.append({
                                "source": f"IN_{layer.index}_{i}",
                                "target": jp,
                                "type": "CONDUCTANCE",
                                "value": gp,
                            })
                        if gn != 0.0:
                            self.edges.append({
                                "source": f"IN_{layer.index}_{i}",
                                "target": jn,
                                "type": "CONDUCTANCE",
                                "value": gn,
                            })

                    # Bias conductances use REF node.
                    bgp = mapping.bias_g_pos[j]
                    bgn = mapping.bias_g_neg[j]
                    if bgp != 0.0:
                        self.edges.append({
                            "source": f"REF_{layer.index}",
                            "target": jn,  # sign convention matches current subtraction in TIA stage
                            "type": "CONDUCTANCE",
                            "value": bgp,
                        })
                    if bgn != 0.0:
                        self.edges.append({
                            "source": f"REF_{layer.index}",
                            "target": jp,
                            "type": "CONDUCTANCE",
                            "value": bgn,
                        })

                    self.edges.append({
                        "source_pos": jp,
                        "source_neg": jn,
                        "target": out,
                        "type": "TIA",
                        "gain": self.rf_ohm,
                    })

                prev_linear = layer

            elif isinstance(layer, ActivationSpec):
                # ReLU activation — add rectifier nodes and edges
                if prev_linear is None:
                    raise CompilationError("ActivationSpec encountered before any LinearLayerSpec.")
                for j in range(layer.features):
                    relu_id = f"RELU_{layer.index}_{j}"
                    self._add_node(Node(id=relu_id, type="relu", domain="activation"))
                    self.edges.append({
                        "source": f"OUT_{prev_linear.index}_{j}",
                        "target": relu_id,
                        "type": "RECTIFIER",
                    })

        metadata = {
            "model_type": "nn.Sequential",
            "layers": len(layers),
            "alpha_v": self.alpha_v,
            "beta_s": self.beta_s,
            "rf_ohm": self.rf_ohm,
            "vin_domain": [VIN_MIN, VIN_MAX],
        }
        return IRGraph(version="2.0", metadata=metadata, nodes=self.nodes, edges=self.edges)


# ----------------------------
# Closed-form simulator / validation
# ----------------------------

@dataclass
class ValidationResult:
    passed: bool
    max_abs_error: float
    max_rel_error: float
    per_output: List[Dict[str, Any]]


def _clamp_vin(x: float) -> float:
    return max(VIN_MIN, min(VIN_MAX, x))


def forward_linear_only(layers: List[LayerSpec], x: Sequence[float]) -> List[float]:
    """Pure digital forward pass with Linear layers and ReLU activations."""
    vec = [float(v) for v in x]
    for layer in layers:
        if isinstance(layer, LinearLayerSpec):
            if len(vec) != layer.in_features:
                raise CompilationError(
                    f"Input dimension mismatch for layer {layer.index}: expected {layer.in_features}, got {len(vec)}"
                )
            next_vec: List[float] = []
            for j in range(layer.out_features):
                acc = float(layer.bias[j])
                for i in range(layer.in_features):
                    acc += float(layer.weight[j][i]) * vec[i]
                next_vec.append(acc)
            vec = next_vec
        elif isinstance(layer, ActivationSpec):
            if layer.activation_type == "relu":
                vec = [max(0.0, v) for v in vec]
    return vec


def forward_ideal_analog(layers: List[LayerSpec], x: Sequence[float]) -> List[float]:
    """Closed-form ideal analog simulation of the differential conductance model.

    With the chosen scaling constants alpha=1, beta=1e-6, and Rf=1e6, the model
    reduces to exact linear equivalence under ideal arithmetic:
        Vout = sum(Vin * W) + B
    ReLU activations are modeled as a precision half-wave rectifier.
    """
    vec = [_clamp_vin(float(v)) for v in x]
    for layer in layers:
        if isinstance(layer, LinearLayerSpec):
            if len(vec) != layer.in_features:
                raise CompilationError(
                    f"Input dimension mismatch for layer {layer.index}: expected {layer.in_features}, got {len(vec)}"
                )
            next_vec: List[float] = []
            for j in range(layer.out_features):
                i_plus = 0.0
                i_minus = 0.0
                for i in range(layer.in_features):
                    gp, gn = encode_weight_to_conductance(float(layer.weight[j][i]))
                    vin = vec[i] * ALPHA_V
                    i_plus += vin * gp
                    i_minus += vin * gn

                bgp, bgn = encode_bias_to_conductance(float(layer.bias[j]))
                i_plus += VREF * bgp
                i_minus += VREF * bgn

                vout = (i_plus - i_minus) * RF_OHM
                next_vec.append(vout)
            vec = next_vec
        elif isinstance(layer, ActivationSpec):
            if layer.activation_type == "relu":
                vec = [max(0.0, v) for v in vec]
    return vec


def validate_compilation(layers: List[LayerSpec], test_vectors: Sequence[Sequence[float]]) -> ValidationResult:
    per_output: List[Dict[str, Any]] = []
    max_abs = 0.0
    max_rel = 0.0
    passed = True

    for tv_idx, x in enumerate(test_vectors):
        digital = forward_linear_only(layers, x)
        analog = forward_ideal_analog(layers, x)

        if len(digital) != len(analog):
            raise CompilationError("Analog/digital output dimensionality mismatch.")

        for j, (d, a) in enumerate(zip(digital, analog)):
            abs_err = abs(a - d)
            rel_err = abs_err / (abs(d) + ETA)
            ok = (abs_err < ABS_ERR_BOUND) or (rel_err < REL_ERR_BOUND)
            per_output.append({
                "test_vector_index": tv_idx,
                "output_index": j,
                "digital": d,
                "analog": a,
                "abs_error": abs_err,
                "rel_error": rel_err,
                "pass": ok,
            })
            max_abs = max(max_abs, abs_err)
            max_rel = max(max_rel, rel_err)
            if not ok:
                passed = False

    return ValidationResult(
        passed=passed,
        max_abs_error=max_abs,
        max_rel_error=max_rel,
        per_output=per_output,
    )


# ----------------------------
# Netlist export
# ----------------------------

class NetlistExporter:
    @staticmethod
    def export(layers: List[LayerSpec]) -> str:
        """Generate a SPICE-like text netlist.

        This is intentionally idealized and symbolic. The TIA is represented as a
        behavioral voltage source statement for readability.  ReLU activations
        are emitted as precision half-wave rectifier behavioral sources.
        """
        lines: List[str] = []
        lines.append("* SYNAPSE idealized netlist")
        lines.append("* Generated from nn.Sequential with Linear + ReLU stack")
        lines.append(f"* alpha_v={ALPHA_V} beta_s={BETA_S} rf_ohm={RF_OHM}")
        lines.append("")

        prev_linear_index: Optional[int] = None

        for layer in layers:
            if isinstance(layer, LinearLayerSpec):
                lines.append(f"* Layer {layer.index}")
                for i in range(layer.in_features):
                    lines.append(f"V_IN_{layer.index}_{i} IN_{layer.index}_{i} 0 DC 0")
                lines.append(f"V_REF_{layer.index} REF_{layer.index} 0 DC {VREF}")

                for j in range(layer.out_features):
                    jp = f"JUNCT_{layer.index}_{j}_POS"
                    jn = f"JUNCT_{layer.index}_{j}_NEG"
                    out = f"OUT_{layer.index}_{j}"
                    lines.append(f"* Output {j}")
                    for i in range(layer.in_features):
                        w = float(layer.weight[j][i])
                        gp, gn = encode_weight_to_conductance(w)
                        if gp != 0.0:
                            # conductance as resistor equivalent
                            r = 1.0 / gp
                            lines.append(f"R_WP_{layer.index}_{j}_{i} IN_{layer.index}_{i} {jp} {r:.12g}")
                        if gn != 0.0:
                            r = 1.0 / gn
                            lines.append(f"R_WN_{layer.index}_{j}_{i} IN_{layer.index}_{i} {jn} {r:.12g}")

                    bp, bn = encode_bias_to_conductance(float(layer.bias[j]))
                    if bp != 0.0:
                        r = 1.0 / bp
                        lines.append(f"R_BP_{layer.index}_{j} REF_{layer.index} {jn} {r:.12g}")
                    if bn != 0.0:
                        r = 1.0 / bn
                        lines.append(f"R_BN_{layer.index}_{j} REF_{layer.index} {jp} {r:.12g}")

                    # Symbolic TIA; most SPICE engines will not accept this verbatim, but it is
                    # sufficient as a deterministic export target for the MVP and can be adapted.
                    lines.append(
                        f"E_TIA_{layer.index}_{j} {out} 0 VALUE = {{(V({jp}) - V({jn})) * {RF_OHM:.12g}}}"
                    )
                    lines.append("")

                prev_linear_index = layer.index

            elif isinstance(layer, ActivationSpec):
                lines.append(f"* ReLU Activation (Precision Half-Wave Rectifier) Layer {layer.index}")
                if prev_linear_index is None:
                    raise CompilationError("ActivationSpec encountered before any LinearLayerSpec in netlist export.")
                for j in range(layer.features):
                    lines.append(
                        f"E_RELU_{layer.index}_{j} RELU_{layer.index}_{j} 0 VALUE = {{MAX(0, V(OUT_{prev_linear_index}_{j}))}}"
                    )
                lines.append("")

        lines.append(".END")
        return "\n".join(lines)


# ----------------------------
# Compiler facade
# ----------------------------

@dataclass
class CompileOutput:
    ir: IRGraph
    netlist: str
    validation: ValidationResult


class SynapseCompiler:
    def __init__(self):
        self.builder = IRBuilder()

    def compile_state_dict(
        self,
        state_dict: Dict[str, Any],
        test_vectors: Sequence[Sequence[float]],
    ) -> CompileOutput:
        layers = extract_layers(state_dict)
        ir = self.builder.build(layers)
        netlist = NetlistExporter.export(layers)
        validation = validate_compilation(layers, test_vectors)
        return CompileOutput(ir=ir, netlist=netlist, validation=validation)


# ----------------------------
# Helpers / CLI
# ----------------------------

def _load_state_dict(path: str) -> Dict[str, Any]:
    if torch is None:
        raise CompilationError("PyTorch is required to load .pt/.pth files.")
    obj = torch.load(path, map_location="cpu")
    if isinstance(obj, dict) and any(k.endswith("weight") for k in obj.keys()):
        return obj
    if isinstance(obj, dict) and "state_dict" in obj and isinstance(obj["state_dict"], dict):
        return obj["state_dict"]
    raise ModelValidationError(
        "Unsupported checkpoint format. Provide a state_dict or an object containing state_dict."
    )


def _parse_test_vectors(s: str) -> List[List[float]]:
    obj = json.loads(s)
    if not isinstance(obj, list) or not obj:
        raise ValueError("test vectors must be a non-empty JSON list of lists")
    out: List[List[float]] = []
    for row in obj:
        if not isinstance(row, list) or not row:
            raise ValueError("each test vector must be a non-empty list")
        out.append([float(x) for x in row])
    return out


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="SYNAPSE compiler reference implementation")
    parser.add_argument("--state-dict", type=str, required=True, help="Path to .pt/.pth checkpoint containing a state_dict")
    parser.add_argument("--test-vectors", type=str, required=True, help="JSON list of test vectors, e.g. '[[0.1, -0.2], [1, 1]]'")
    parser.add_argument("--out-ir", type=str, default="", help="Optional path to write IR JSON")
    parser.add_argument("--out-netlist", type=str, default="", help="Optional path to write netlist text")
    args = parser.parse_args(argv)

    state_dict = _load_state_dict(args.state_dict)
    test_vectors = _parse_test_vectors(args.test_vectors)

    compiler = SynapseCompiler()
    result = compiler.compile_state_dict(state_dict, test_vectors)

    print(json.dumps({
        "validation": {
            "passed": result.validation.passed,
            "max_abs_error": result.validation.max_abs_error,
            "max_rel_error": result.validation.max_rel_error,
        },
        "ir_summary": {
            "nodes": len(result.ir.nodes),
            "edges": len(result.ir.edges),
        },
    }, indent=2))

    if args.out_ir:
        pathlib.Path(args.out_ir).write_text(result.ir.to_json(indent=2), encoding="utf-8")
    if args.out_netlist:
        pathlib.Path(args.out_netlist).write_text(result.netlist, encoding="utf-8")

    return 0 if result.validation.passed else 2


if __name__ == "__main__":
    raise SystemExit(main())
