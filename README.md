# SYNAPSE EDA — Neuromorphic Hardware Design Automation Platform

> A browser-based Electronic Design Automation (EDA) tool for analog/digital microchip topology design, compiled from PyTorch neural network models into physical circuit representations.

---

## Architecture Overview

```
┌──────────────┐     WebSocket      ┌──────────────────┐
│   Frontend   │ ◄────────────────► │  FastAPI Backend  │
│  React 19 +  │     REST API       │  (server.py)      │
│  ReactFlow   │ ◄────────────────► │  Uvicorn + ASGI   │
└──────┬───────┘                    └────────┬─────────┘
       │                                      │
       ▼                                      ▼
┌──────────────┐                    ┌──────────────────┐
│  Vite 8 Dev  │                    │ SynapseCompiler  │
│  TailwindCSS │                    │ PyTorch Runtime  │
│    Recharts  │                    │ SQLite (persist)  │
└──────────────┘                    └──────────────────┘
```

### Core Engine Components

| Component | File | Description |
|-----------|------|-------------|
| **Viewport Virtualization** | `HardwareView.jsx` | ReactFlow canvas with zoom-dependent edge hiding. Edges are hidden at zoom < 0.5 to maintain 60FPS on large graphs (500+ nodes). Only visible elements are rendered via `onlyRenderVisibleElements`. |
| **BFS Signal Tracing** | `HardwareView.jsx` | Bi-directional graph traversal engine. Pre-computes adjacency lists (`adjDown`/`adjUp`) via `useMemo`, then runs DFS from the selected node in both upstream and downstream directions. Highlighting is applied via direct DOM mutations to avoid ReactFlow's ResizeObserver infinite loop. |
| **Synthesis Dashboard** | `SynthesisDashboard.jsx` | Real-time Area (mm²), Power (mW), and Latency (ns) metrics. Queries the backend's `/api/simulation/metrics` endpoint with live `node_count`/`edge_count`. Falls back to a deterministic local heuristic (`area = n*0.045 + e*0.001`) if the backend is unreachable. |
| **Oscilloscope (Waveform Viewer)** | `WaveformPanel.jsx` | Per-node voltage-time trace viewer. Uses a deterministic seeded PRNG (Mulberry32) keyed to the node ID, ensuring the same node always produces the same waveform. Renders via Recharts `LineChart`. |
| **Polymorphic Node System** | `PolymorphicNodeFactory.jsx` | Runtime node type routing based on the active synthesis engine. Switches between `AnalogJunctionNode`, `DigitalGateNode`, and `SpiceComponentNode` based on `data.engine`. |
| **WebSocket Compiler** | `App.jsx` → `/ws/compile` | Streams compilation logs in real-time from the backend. Sends base64-encoded PyTorch model + test vectors, receives IR graph + timing data. |

### Data Flow

```
User uploads .pt model + test vectors
        │
        ▼
WebSocket /ws/compile → SynapseCompiler → IR Graph (JSON)
        │
        ▼
processGraph() → Dagre Layout (Web Worker) → ReactFlow nodes/edges
        │
        ▼
Node Click → simulateNodePhysics(id) → Deterministic Waveform
        │
        ▼
ML_EXPORT_DATA → console.log(JSON.stringify({nodeId, trace}))
```

---

## Project Status

### ✅ Phase 1: Simulation Core (COMPLETE)

- [x] PyTorch model → IR graph compilation pipeline
- [x] Auto-layout via Dagre with async Web Worker
- [x] Bi-directional BFS signal path tracing
- [x] Zoom-dependent viewport virtualization
- [x] Deterministic per-node waveform generation (seeded PRNG)
- [x] Real-time Synthesis Dashboard (Area/Power/Latency)
- [x] DOM-based highlighting (avoids ReactFlow infinite loops)
- [x] Undo/Redo history stack
- [x] Manual component placement (Resistor, Capacitor, Transistor, etc.)
- [x] SPICE netlist export (JSON)
- [x] Clerk authentication
- [x] Workspace save/load (SQLite)
- [x] ML Data Export hook (`ML_EXPORT_DATA` console.log)

### ⬜ Phase 2: Backend Integration (PENDING)

- [ ] Replace client-side `simulateNodePhysics()` with real backend `/api/simulation/node/{node_id}` endpoint
- [ ] Integrate actual SPICE simulation engine (ngspice/Xyce)
- [ ] Connect Synthesis Dashboard to physical EDA tool outputs (Yosys/OpenROAD)
- [ ] Real GDS-II export via gdstk (endpoint exists, needs validation)
- [ ] DRC/LVS verification against real design rules
- [ ] Cloud compilation via H100 cluster (`PRODUCTION_COMPUTE_URL`)

### ⬜ Phase 3: Production (FUTURE)

- [ ] Multi-user collaboration (WebSocket rooms)
- [ ] Version control for circuit designs
- [ ] Component library marketplace
- [ ] FPGA bitstream generation

---

## Technical Constraints

| Metric | Value | Notes |
|--------|-------|-------|
| Max Node Capacity | ~500 nodes | Above this, edges auto-hide at zoom < 0.5 |
| Waveform Points | 30 per trace | Deterministic via Mulberry32 PRNG |
| Layout Engine | Dagre (async Worker) | Auto `fitView` after batch imports |
| ReactFlow Version | @xyflow/react 12.x | Using DOM mutations for highlighting |
| React Version | 19.x | Rules of Hooks strictly enforced |
| Build Tool | Vite 8 | HMR active in development |
| Auth | Clerk (dev keys) | Must upgrade to production keys for deploy |

---

## Development Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd "ELECTRONICS+AI PEOJECT"

# 2. Backend
pip install fastapi uvicorn torch pydantic httpx orjson psutil
python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload --env-file .env

# 3. Frontend
cd frontend
npm install
npm run dev
```

### Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | `frontend/.env` | Clerk auth (required) |
| `SYNAPSE_ENV` | `.env` | `production` or `development` |
| `PRODUCTION_COMPUTE_URL` | `.env` | H100 cluster endpoint (Phase 2) |
| `MASTER_AUTH_KEY` | `.env` | Backend API key validation |

---

## Cold Storage: Lock & Commit

Run these commands to freeze the project state:

```bash
# Lock all frontend dependencies to exact versions
cd frontend
npm ci
npm shrinkwrap

# Commit everything
cd ..
git add -A
git commit -m "COLD_STORAGE: Phase 1 Simulation Core finalized — June 2026"
git tag -a v1.0.0-phase1 -m "Phase 1: Simulation Core complete. Deterministic waveforms, BFS signal tracing, synthesis dashboard. Ready for Phase 2 backend integration."
git push origin main --tags
```

---

## License

Proprietary — All rights reserved.
