<div align="center">

# SYNAPSE

### Neuromorphic Synthesis Engine

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0+-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**A deterministic algorithmic compiler that translates PyTorch digital neural networks into physical, analog circuit netlists.**

*SYNAPSE bridges the gap between digital machine learning and analog neuromorphic hardware by compiling trained neural network weights into SPICE-compatible circuit descriptions that can be fabricated on physical silicon.*

---

[Quick Start](#-quick-start) · [How It Works](#-how-it-works) · [Architecture](#-architecture) · [Deployment](#-deployment) · [API Reference](#-api-reference)

</div>

---

## Overview

SYNAPSE takes a trained PyTorch `nn.Sequential` model and compiles it into three outputs:

| Output | Description |
|--------|-------------|
| **Intermediate Representation (IR)** | A graph of analog circuit nodes and edges — voltage sources, conductance elements, transimpedance amplifiers, and rectifiers |
| **SPICE Netlist** | A complete, deterministic circuit description ready for analog simulation |
| **Validation Report** | Closed-form mathematical proof that the analog circuit produces identical outputs to the digital model |

### Supported Layers

| PyTorch Layer | Analog Equivalent | SPICE Element |
|---------------|-------------------|---------------|
| `nn.Linear` | Dual-rail differential conductance crossbar | Resistors + Behavioral TIA |
| `nn.ReLU` | Precision half-wave rectifier | `E_RELU VALUE = {MAX(0, V(...))}` |

---

## The Math

SYNAPSE maps digital **Multiply-Accumulate (MAC)** operations to physical **Kirchhoff's Current Law (KCL)** using dual-rail differential conductance.

### Digital Domain
```
y_j = Σ(W_ji · x_i) + b_j
```

### Analog Domain
Each weight `W_ji` is encoded as a pair of conductances:
```
W ≥ 0  →  G+ = W · β,   G- = 0
W < 0  →  G+ = 0,        G- = |W| · β
```

Kirchhoff's Current Law naturally computes the summation:
```
I_j+ = Σ(V_in_i · G+_ji)    (positive rail)
I_j- = Σ(V_in_i · G-_ji)    (negative rail)
```

A transimpedance amplifier (TIA) converts the differential current to voltage:
```
V_out_j = (I_j+ - I_j-) · R_f
```

With scaling constants `α = 1 V/unit`, `β = 1μS/unit`, `R_f = 1MΩ`:
```
V_out_j = Σ(W_ji · x_i) + b_j    ← exact equivalence
```

**ReLU** is implemented as a precision half-wave rectifier: `V_relu = max(0, V_out)`.

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- (Optional) Docker

### Local Development

**1. Clone and install backend dependencies:**
```bash
git clone https://github.com/your-username/synapse.git
cd synapse
pip install -r requirements.txt
```

**2. Generate test data:**
```bash
# Simple 2→4→2 model (quick test)
python generate_model.py

# MNIST digit classifier (production scale)
python train_mnist.py
```

**3. Start the backend:**
```bash
uvicorn server:app --reload
```

**4. Start the frontend (new terminal):**
```bash
cd frontend
npm install
npm run dev
```

**5. Open** `http://localhost:5173`, upload `mnist_model.pt` + `mnist_test_vectors.json`, and click **Compile to Silicon**.

### Docker

```bash
# Build the backend image
docker build -t synapse-api .

# Run on port 8000
docker run -p 8000:8000 synapse-api
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SYNAPSE Architecture                      │
├──────────────┬──────────────────────┬───────────────────────┤
│  Frontend    │  Backend API         │  Core Engine           │
│  (React)     │  (FastAPI)           │  (Python)              │
├──────────────┼──────────────────────┼───────────────────────┤
│ App.jsx      │ server.py            │ synapse_compiler.py    │
│ React Flow   │  POST /compile       │  State dict parser     │
│ Tailwind CSS │  CORS middleware     │  Conductance mapper    │
│ Lucide icons │  ORJSONResponse      │  IR graph builder      │
│              │                      │  Netlist exporter      │
│              │                      │  Closed-form validator │
├──────────────┼──────────────────────┼───────────────────────┤
│ Vercel       │ Docker / Railway     │  Embedded in backend   │
│              │ Render / AWS ECS     │                        │
└──────────────┴──────────────────────┴───────────────────────┘
```

### File Structure

```
synapse/
├── synapse_compiler.py     # Core compilation engine (IR, netlist, validation)
├── server.py               # FastAPI backend with /compile endpoint
├── generate_model.py       # Simple 2→4→2 test model generator
├── train_mnist.py          # MNIST digit classifier trainer
├── requirements.txt        # Python dependencies
├── Dockerfile              # Backend container
├── .dockerignore
├── README.md
│
├── model.pt                # Generated: simple model weights
├── test_vectors.json       # Generated: simple test inputs
├── mnist_model.pt          # Generated: MNIST model weights
├── mnist_test_vectors.json # Generated: MNIST test digits
│
└── frontend/
    ├── src/
    │   ├── App.jsx         # React visualizer (React Flow + Tailwind)
    │   └── index.css       # Dark theme + silicon trace styles
    ├── vercel.json         # Vercel deployment config
    ├── .env.example        # Environment variable documentation
    ├── tailwind.config.js
    ├── postcss.config.js
    └── package.json
```

---

## Deployment

### Backend → Docker (Railway / Render / AWS)

```bash
docker build -t synapse-api .
docker run -p 8000:8000 -e CORS_ORIGINS="https://your-frontend.vercel.app" synapse-api
```

Environment variables:
| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |

### Frontend → Vercel

```bash
cd frontend
npm run build
# Deploy dist/ to Vercel, Netlify, or any static host
```

Set the environment variable in your hosting dashboard:
| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://your-api.railway.app` |

---

## API Reference

### `POST /compile`

Compiles a PyTorch state dict into an analog circuit.

**Request:** `multipart/form-data`
| Field | Type | Description |
|-------|------|-------------|
| `model_file` | File (.pt) | PyTorch `state_dict` |
| `test_vectors` | String (JSON) | Array of input vectors |

**Response:** `application/json`
```json
{
  "ir": {
    "version": "2.0",
    "metadata": { "layers": 3, "alpha_v": 1.0, "beta_s": 1e-6, "rf_ohm": 1e6 },
    "nodes": [{ "id": "IN_0_0", "type": "voltage_source", "domain": "input" }],
    "edges": [{ "source": "IN_0_0", "target": "JUNCT_0_0_POS", "type": "CONDUCTANCE", "value": 5.4e-7 }]
  },
  "netlist": "* SYNAPSE idealized netlist\n...\n.END",
  "validation": {
    "passed": true,
    "max_abs_error": 7.1e-15,
    "max_rel_error": 2.3e-14,
    "per_output": [...]
  },
  "stats": {
    "total_nodes": 257,
    "total_edges": 2484,
    "layers": 3
  }
}
```

---

## Scale Benchmarks

| Model | Nodes | Edges | Netlist Lines | Validation |
|-------|-------|-------|---------------|------------|
| Linear 2→4→2 | 21 | 20 | 35 | ✅ 3.5e-17 |
| ReLU 2→4→2 | 31 | 32 | 45 | ✅ 3.5e-17 |
| MNIST 64→32→10 | 257 | 2,484 | 2,675 | ✅ 7.1e-15 |

---

## License

MIT © 2026

---

<div align="center">
  <sub>Built with ⚡ by the SYNAPSE team</sub>
</div>
