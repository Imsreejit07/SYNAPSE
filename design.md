# SYNAPSE Architecture & Design Document

## 1. System Overview

**SYNAPSE (Neuromorphic Synthesis Engine)** is an end-to-end compiler that bridges the gap between digital machine learning models (trained in PyTorch) and physical analog circuits. Instead of relying on traditional von Neumann architecture, SYNAPSE maps neural network weights and activations directly to a hardware-agnostic Intermediate Representation (IR) and ultimately an Analog Netlist.

The architecture is divided into three primary domains:
1. **Model Generation (Data Layer)**
2. **Compiler & API (Backend Layer)**
3. **Interactive Visualizer (Frontend Layer)**

---

## 2. Core Compiler Architecture (`synapse_compiler.py`)

The core engine is responsible for parsing, mapping, and validating the neural network structures.

### 2.1 Weight Extraction & Parsing
- The compiler ingests a standard PyTorch `.pt` file (a serialized `state_dict`).
- It iterates through the state dictionary keys to identify sequential layers.
- **Node Classification:** Recognizes `weight` and `bias` tensors for linear transformations (`LinearNode`) and injects logical analog non-linearities like `ReLU` (`ActivationNode`) where applicable based on standard network heuristics or explicit model definitions.

### 2.2 Intermediate Representation (IR)
The parsed network is converted into an abstract graph structure (IR).
- **Nodes:** Represent individual computational units (e.g., an Input node, a Hidden neuron, an Activation block, or an Output neuron).
- **Edges:** Represent physical wire routing. Each edge carries properties such as the synaptic weight (resistance/conductance equivalent) and source/target IDs.
- **Metadata:** Stores global network configuration such as total layer count, layer width ratios, and routing density.

### 2.3 Netlist Generation
The abstract IR is translated into a human and machine-readable text representation (the Netlist). 
- It describes how physical analog components (resistors, memristors, op-amps) would be wired together to inherently perform matrix multiplication through Kirchhoff's laws.

### 2.4 Digital Validation
To ensure the analog mapping is functionally equivalent to the digital PyTorch model:
- The compiler accepts `.json` test vectors.
- It performs a forward pass using standard tensor math over the extracted weights.
- It computes the theoretical output, ensuring the extracted mathematical graph perfectly matches the original PyTorch execution.

---

## 3. Backend API (`server.py`)

The backend exposes the SYNAPSE engine via a stateless RESTful interface, built with **FastAPI**.

### 3.1 Endpoint Specifications
- **POST `/compile`**: The primary ingestion endpoint.
    - **Inputs:** A multipart form data request containing the `model.pt` file and a stringified JSON array of `test_vectors`.
    - **Processing:** The `.pt` file is loaded directly into memory (`io.BytesIO`) mapping to the CPU. The `SynapseCompiler` is invoked on the state dictionary.
    - **Outputs:** Returns a comprehensive JSON payload containing the `ir` (nodes and edges), the generated `netlist` string, `validation` metrics, and general graph `stats`.

### 3.2 Concurrency & Performance
- Built on ASGI (Uvicorn), allowing asynchronous request handling.
- Implements `ORJSONResponse` for ultra-fast JSON serialization, crucial when handling large graphs (like the MNIST architecture).

---

## 4. Frontend Visualizer (React + Vite)

The frontend provides a real-time, interactive debugging and visualization suite for the compiled circuits.

### 4.1 Technology Stack
- **Framework:** React 19 + Vite for high-speed HMR and lightweight bundling.
- **Styling:** Tailwind CSS + custom glassmorphism effects for a premium, cyberpunk-inspired UI.
- **Icons & Components:** Lucide React (vector icons), `react-resizable-panels` (for IDE-like split panes).

### 4.2 Graph Visualization (`React Flow`)
- The JSON `ir` returned from the backend is dynamically parsed into React Flow's `nodes` and `edges` format.
- **Algorithmic Layout:** The graph utilizes a custom breadth-first layout algorithm. Nodes are visually grouped by layer (Input -> Hidden -> Activation -> Output).
- **Interactive Edges:** Edge opacity and thickness are scaled based on the absolute value of the synaptic weight, providing an immediate visual understanding of network sparsity and dominant signal paths.

### 4.3 Workspace Layout
- **Left Panel (Controls):** File upload zones for `.pt` and `.json` test vectors. Contains the "Compile to Hardware" trigger button.
- **Center Canvas (Graph):** The interactive React Flow canvas allowing pan, zoom, and node inspection.
- **Right Panel (Netlist):** A real-time updating code block displaying the raw output netlist, mimicking an EDA (Electronic Design Automation) tool interface.

---

## 5. Deployment Architecture

The system is containerized to ensure identical behavior across development and production environments.

- **Backend (Docker):** Uses a multi-stage `python:3.11-slim` Dockerfile. Installs system dependencies and python libraries via `requirements.txt`. Exposed on port `8000`.
- **Frontend (Vercel/Static):** The React frontend is built as static HTML/JS/CSS. Environmental variables (`VITE_API_URL`) are injected at build time to link the frontend to the dynamically deployed backend URL.

---

## 6. Supported Scale (from XOR to MNIST)

The architecture is highly scalable:
- **v1/v2 (Linear/XOR):** Successfully handles small 2->4->2 graphs, mapping fundamental linear equations and ReLUs.
- **v3 (MNIST Scale-Up):** Efficiently processes and visualizes a 64->32->10 network (over 2,300 edges) representing actual handwritten digit recognition, proving the concept works for real-world dimensionality.
