import React, { useState, useCallback, useMemo } from 'react';
import { ReactFlow, Controls, Background, MiniMap, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Upload, Zap, Activity, CheckCircle2, XCircle, Code, ChevronRight, FileJson, Database, Cpu, Layers, GitBranch } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Custom Node – lightweight for large graphs
   ───────────────────────────────────────────────────────────── */
const CustomNode = ({ data }) => {
  const color = {
    input:          'border-blue-500/70 bg-blue-500/10 text-blue-400',
    hidden:         'border-purple-500/70 bg-purple-500/10 text-purple-400',
    activation:     'border-pink-500/70 bg-pink-500/10 text-pink-400',
    reference:      'border-emerald-500/70 bg-emerald-500/10 text-emerald-400',
    bias_reference: 'border-orange-500/70 bg-orange-500/10 text-orange-400',
    rectifier:      'border-amber-500/70 bg-amber-500/10 text-amber-400',
  }[data.domain] || 'border-gray-500/70 bg-gray-500/10 text-gray-400';

  const isReLU = data.type === 'relu';

  return (
    <div className={`px-3 py-1.5 border rounded-md backdrop-blur-sm min-w-[80px] text-center text-[11px] ${color}`}>
      <div className="font-semibold uppercase tracking-wider opacity-70" style={{ fontSize: '8px' }}>{data.domain}</div>
      {isReLU ? (
        <div className="font-mono flex items-center justify-center gap-0.5">
          <Zap className="w-2.5 h-2.5" /> ReLU
        </div>
      ) : (
        <div className="font-mono truncate">{data.label}</div>
      )}
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

/* ─────────────────────────────────────────────────────────────
   MiniMap node color helper
   ───────────────────────────────────────────────────────────── */
const miniMapNodeColor = (node) => {
  const m = {
    input: '#3b82f6', hidden: '#8b5cf6', activation: '#ec4899',
    reference: '#10b981', bias_reference: '#f97316', rectifier: '#f59e0b',
  };
  return m[node.data?.domain] || '#6b7280';
};

/* ─────────────────────────────────────────────────────────────
   Metrics Stat Card
   ───────────────────────────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex items-center gap-3">
    <Icon className={`w-5 h-5 ${color} shrink-0`} />
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-mono text-white">{value}</p>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   Main App
   ───────────────────────────────────────────────────────────── */
function App() {
  const [modelFile, setModelFile] = useState(null);
  const [testVectorsFile, setTestVectorsFile] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  /* ── Compile ─────────────────────────────────── */
  const handleCompile = async () => {
    if (!modelFile || !testVectorsFile) {
      setError("Please select both model file and test vectors");
      return;
    }

    setIsCompiling(true);
    setError(null);
    setResult(null);

    try {
      const testVectorsText = await testVectorsFile.text();

      const formData = new FormData();
      formData.append('model_file', modelFile);
      formData.append('test_vectors', testVectorsText);

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/compile`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Compilation failed");
      }

      const data = await response.json();
      setResult(data);
      processGraph(data.ir);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsCompiling(false);
    }
  };

  /* ── Graph Layout ────────────────────────────── */
  const processGraph = (ir) => {
    if (!ir || !ir.nodes) return;

    // Categorize nodes by domain for smart column layout
    const domainColumns = {
      'reference':      { x: 0,    spacing: 50 },
      'input':          { x: 0,    spacing: 40 },
      'bias_reference': { x: 350,  spacing: 50 },
      'hidden':         { x: 400,  spacing: 40 },
      'activation':     { x: 800,  spacing: 40 },
    };

    const domainCounts = {};

    const newNodes = ir.nodes.map(node => {
      const d = node.domain;
      if (!domainCounts[d]) domainCounts[d] = 0;

      const col = domainColumns[d] || { x: 600, spacing: 40 };
      const yOffset = d === 'reference' || d === 'bias_reference' ? -300 : 0;

      return {
        id: node.id,
        type: 'custom',
        position: {
          x: col.x,
          y: yOffset + (domainCounts[d]++ * col.spacing)
        },
        data: {
          label: node.id,
          domain: node.domain,
          type: node.type,
          initial_value: node.initial_value
        }
      };
    });

    // Ultra-thin silicon trace edges for massive graphs
    const isLargeGraph = ir.edges.length > 200;
    const thinStroke = isLargeGraph ? 0.5 : 1.5;
    const thinOpacity = isLargeGraph ? 0.35 : 0.8;

    const newEdges = ir.edges.map((edge, i) => {
      if (edge.type === 'RECTIFIER') {
        return {
          id: `e-${i}`,
          source: edge.source,
          target: edge.target,
          animated: !isLargeGraph,
          style: { stroke: '#f59e0b', strokeWidth: isLargeGraph ? 0.8 : 2, opacity: isLargeGraph ? 0.6 : 1 },
        };
      }
      if (edge.type === 'TIA') {
        return {
          id: `e-${i}`,
          source: edge.source_pos,
          target: edge.target,
          animated: !isLargeGraph,
          style: { stroke: '#ec4899', strokeWidth: isLargeGraph ? 0.8 : 2, opacity: isLargeGraph ? 0.6 : 1 },
        };
      }
      return {
        id: `e-${i}`,
        source: edge.source,
        target: edge.target,
        style: { stroke: '#8b5cf6', strokeWidth: thinStroke, opacity: thinOpacity },
      };
    });

    setNodes(newNodes);
    setEdges(newEdges);
  };

  /* ── Derived metrics ─────────────────────────── */
  const metrics = useMemo(() => {
    if (!result) return null;
    const irNodes = result.ir?.nodes || [];
    const irEdges = result.ir?.edges || [];

    const inputCount = irNodes.filter(n => n.domain === 'input').length;
    const hiddenCount = irNodes.filter(n => n.type === 'relu').length;
    const outputCount = irNodes.filter(n => n.type === 'voltage_readout').length;
    const conductances = irEdges.filter(e => e.type === 'CONDUCTANCE').length;
    const tias = irEdges.filter(e => e.type === 'TIA').length;
    const rectifiers = irEdges.filter(e => e.type === 'RECTIFIER').length;

    return { inputCount, hiddenCount, outputCount, conductances, tias, rectifiers, totalNodes: irNodes.length, totalEdges: irEdges.length };
  }, [result]);

  /* ── Render ──────────────────────────────────── */
  return (
    <div className="min-h-screen bg-grid-pattern text-slate-200 p-6 flex flex-col items-center">
      
      <header className="w-full max-w-7xl flex justify-between items-center mb-8 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Zap className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">SYNAPSE</h1>
            <p className="text-sm text-slate-400 font-mono flex items-center gap-2">
              Neuromorphic Synthesis Engine
              <span className="text-xs bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">v3.0 MNIST</span>
            </p>
          </div>
        </div>
        {metrics && (
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span className="text-blue-400">{metrics.inputCount} Inputs</span>
            <span className="text-white/20">→</span>
            <span className="text-amber-400">{metrics.hiddenCount} Rectifiers</span>
            <span className="text-white/20">→</span>
            <span className="text-pink-400">{metrics.outputCount} Outputs</span>
            <span className="text-white/20">|</span>
            <span className="text-purple-400">{metrics.totalEdges.toLocaleString()} Traces</span>
          </div>
        )}
      </header>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ── Left Column: Upload, Metrics, Validation ── */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Upload Panel */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-400" />
              Upload Assets
            </h2>
            
            <div className="space-y-3">
              <div className="relative group">
                <input type="file" id="model-upload" className="hidden" onChange={(e) => setModelFile(e.target.files[0])} accept=".pt,.pth" />
                <label htmlFor="model-upload" className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-white/20 bg-white/5 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all cursor-pointer">
                  <Database className="w-5 h-5 text-slate-400 group-hover:text-purple-400" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-slate-200 truncate">{modelFile ? modelFile.name : "Select model .pt file"}</p>
                    <p className="text-xs text-slate-500">PyTorch State Dict</p>
                  </div>
                </label>
              </div>

              <div className="relative group">
                <input type="file" id="vectors-upload" className="hidden" onChange={(e) => setTestVectorsFile(e.target.files[0])} accept=".json" />
                <label htmlFor="vectors-upload" className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-white/20 bg-white/5 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all cursor-pointer">
                  <FileJson className="w-5 h-5 text-slate-400 group-hover:text-blue-400" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-slate-200 truncate">{testVectorsFile ? testVectorsFile.name : "Select test vectors .json"}</p>
                    <p className="text-xs text-slate-500">JSON Array</p>
                  </div>
                </label>
              </div>

              <button 
                onClick={handleCompile}
                disabled={isCompiling}
                className="w-full relative glow-effect rounded-xl bg-slate-800 text-white font-medium py-3 px-4 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-white/10"
              >
                {isCompiling ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
                ) : (
                  <>
                    Compile to Silicon <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200 break-words">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Compilation Metrics */}
          {metrics && (
            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-xl">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-400" />
                Circuit Metrics
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <StatCard icon={Layers} label="IR Nodes" value={metrics.totalNodes.toLocaleString()} color="text-blue-400" />
                <StatCard icon={GitBranch} label="IR Edges" value={metrics.totalEdges.toLocaleString()} color="text-purple-400" />
                <StatCard icon={Zap} label="Conductances" value={metrics.conductances.toLocaleString()} color="text-violet-400" />
                <StatCard icon={Activity} label="TIA Stages" value={metrics.tias.toLocaleString()} color="text-pink-400" />
              </div>
              <div className="mt-3 p-3 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Analog Architecture</p>
                <p className="text-xs font-mono text-white">
                  <span className="text-blue-400">{metrics.inputCount}</span> Voltage Rails → <span className="text-amber-400">{metrics.hiddenCount}</span> Rectifiers → <span className="text-pink-400">{metrics.outputCount}</span> Classifiers
                </p>
              </div>
            </div>
          )}

          {/* Validation Panel */}
          {result && (
            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-xl">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                Validation Result
              </h2>
              
              <div className="space-y-3">
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${result.validation.passed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  {result.validation.passed ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  ) : (
                    <XCircle className="w-7 h-7 text-red-500" />
                  )}
                  <div>
                    <p className="text-base font-bold">{result.validation.passed ? "Compilation Passed" : "Compilation Failed"}</p>
                    <p className="text-xs text-slate-400 font-mono">{result.validation.passed ? "Analog ReLU synthesis verified." : "Analog mapping diverged."}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <p className="text-[10px] text-slate-400 mb-0.5">Max Abs Error</p>
                    <p className="text-sm font-mono text-blue-300">{result.validation.max_abs_error.toExponential(2)}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <p className="text-[10px] text-slate-400 mb-0.5">Max Rel Error</p>
                    <p className="text-sm font-mono text-purple-300">{result.validation.max_rel_error.toExponential(2)}</p>
                  </div>
                </div>

                {/* Per-vector digit predictions */}
                {result.validation.per_output && (
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-wider">Output Vector Validation</p>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {result.validation.per_output.filter((_, i) => i % Math.max(1, Math.floor(result.validation.per_output.length / 6)) === 0).map((entry, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                          <span className={entry.pass ? 'text-emerald-400' : 'text-red-400'}>{entry.pass ? '✓' : '✗'}</span>
                          <span className="text-slate-400">TV{entry.test_vector_index}[{entry.output_index}]</span>
                          <span className="text-slate-500">err: {entry.abs_error.toExponential(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Visualizer & Netlist ── */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          
          {/* Circuit Graph Visualizer */}
          <div className="flex-1 min-h-[600px] bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden flex flex-col relative">
            <div className="absolute top-0 inset-x-0 h-12 bg-black/50 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-5 z-10">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                Analog Microchip Topology
              </h2>
              {metrics && (
                <span className="text-[10px] font-mono text-slate-500">
                  {metrics.totalNodes} nodes · {metrics.totalEdges.toLocaleString()} traces
                </span>
              )}
            </div>
            
            {result ? (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                className="bg-transparent"
                nodesDraggable={false}
                elementsSelectable={false}
                edgesFocusable={false}
                minZoom={0.05}
                maxZoom={2}
                style={{ paddingTop: '48px' }}
              >
                <Background color="#ffffff" gap={24} size={1} opacity={0.03} />
                <Controls className="!bg-slate-800/90 !border-white/10 !rounded-lg !shadow-xl" showInteractive={false} />
                <MiniMap
                  nodeColor={miniMapNodeColor}
                  maskColor="rgba(0, 0, 0, 0.7)"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                  pannable
                  zoomable
                />
              </ReactFlow>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3 pt-12">
                <Cpu className="w-12 h-12 text-slate-700" />
                <p className="text-sm">Upload model and test vectors to synthesize analog circuit.</p>
              </div>
            )}
          </div>

          {/* SPICE Netlist */}
          {result && (
            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden flex flex-col">
              <div className="h-11 bg-black/50 border-b border-white/10 flex items-center justify-between px-5">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Code className="w-4 h-4 text-emerald-400" />
                  SPICE Netlist
                  <span className="text-[10px] text-slate-500 font-mono ml-1">
                    ({result.netlist.split('\n').length} lines)
                  </span>
                </h2>
                <button className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10" onClick={() => navigator.clipboard.writeText(result.netlist)}>
                  Copy
                </button>
              </div>
              <div className="p-4 overflow-auto max-h-[250px] text-[11px] font-mono text-emerald-300/80 leading-relaxed">
                <pre>{result.netlist}</pre>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
