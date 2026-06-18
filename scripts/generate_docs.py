import ast
import json
import os

def parse_compiler(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        source = f.read()
    
    tree = ast.parse(source)
    docs = {
        "getting_started": {
            "title": "Getting Started",
            "content": "The SYNAPSE engine bridges the gap between deep learning and analog circuit design.\nUpload your PyTorch `.pt` models and instantly synthesize them into ready-to-manufacture resistive crossbar architectures.",
            "code": "# 1. Initialize your model\nimport torch\nfrom synapse import Compiler\n\n# 2. Compile to analog SPICE\ncompiler = Compiler(target='ANALOG_V3')\nnetlist = compiler.synthesize(model='mnist_model.pt')\n\n# 3. Export to fabrication\nnetlist.export_gds()"
        },
        "architecture": {
            "title": "Architecture & Scope",
            "content": ast.get_docstring(tree) or "SYNAPSE Neuromorphic Compiler",
        },
        "spice_syntax": {
            "title": "SPICE Primitives",
            "content": "The SYNAPSE NetlistExporter automatically emits the following SPICE primitives during compilation to map the abstract IR into silicon-ready macros:",
            "primitives": []
        }
    }
    
    prims = {}
    
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            if node.name == 'NetlistExporter':
                for subnode in ast.walk(node):
                    if isinstance(subnode, ast.JoinedStr):
                        for val in subnode.values:
                            if isinstance(val, ast.Constant) and isinstance(val.value, str):
                                s = val.value.strip()
                                if "V_IN" in s or "V_REF" in s:
                                    prims["V_SOURCE"] = "Ideal DC voltage source for input activation and references."
                                elif "R_WP" in s or "R_WN" in s or "R_BP" in s:
                                    prims["R_CROSSBAR"] = "Ohmic resistance mapping for positive/negative weights and biases."
                                elif "E_TIA" in s:
                                    prims["E_TIA"] = "Voltage Controlled Voltage Source acting as Transimpedance Amplifier."
                                elif "E_RELU" in s:
                                    prims["E_RELU"] = "Behavioral precision half-wave rectifier for non-linear activations."
                                    
    docs['spice_syntax']['primitives'] = [{"command": k, "desc": v} for k, v in prims.items()]
    
    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'public')
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, 'docs_data.json'), 'w', encoding='utf-8') as f:
        json.dump(docs, f, indent=2)

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(__file__))
    parse_compiler(os.path.join(base_dir, 'synapse_compiler.py'))
    print("Documentation generated.")
