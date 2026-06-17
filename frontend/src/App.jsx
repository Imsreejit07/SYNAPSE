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
    <div className="dark overflow-hidden h-screen flex flex-col font-body-md text-on-surface bg-[#131315]" style={{
      backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)`,
      backgroundSize: '20px 20px'
    }}>
      {/* TopAppBar Execution */}
      <header className="flex justify-between items-center w-full px-gutter h-16 bg-background dark:bg-background border-b border-outline-variant z-50 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-neon-blue flex items-center justify-center">
              <span className="material-symbols-outlined text-black font-bold">bolt</span>
            </div>
            <div>
              <h1 className="text-headline-lg font-headline-lg font-black text-neon-purple tracking-tighter">SYNAPSE</h1>
              <p className="text-[10px] font-label-caps text-on-surface-variant leading-none">V3.0 MNIST ENGINE</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-8 ml-8 h-full items-center">
            <a className="text-neon-blue border-b-2 border-neon-blue pb-1 font-label-caps text-label-caps h-full flex items-center" href="#">Project</a>
            <a className="text-on-surface-variant font-label-caps text-label-caps hover:bg-surface-variant hover:text-neon-blue transition-colors duration-100" href="#">Simulate</a>
            <a className="text-on-surface-variant font-label-caps text-label-caps hover:bg-surface-variant hover:text-neon-blue transition-colors duration-100" href="#">Synthesize</a>
            <a className="text-on-surface-variant font-label-caps text-label-caps hover:bg-surface-variant hover:text-neon-blue transition-colors duration-100" href="#">Analyze</a>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-on-surface-variant">
          {metrics && (
            <div className="hidden lg:flex items-center gap-4 text-[11px] font-label-caps border-x border-outline-variant px-6 mr-4">
              <span className="text-neon-blue">{metrics.inputCount} INPUTS</span>
              <span className="text-warning-yellow">{metrics.hiddenCount} RECTIFIERS</span>
              <span className="text-neon-pink">{metrics.outputCount} OUTPUTS</span>
              <span className="text-on-surface">{metrics.totalEdges.toLocaleString()} TRACES</span>
            </div>
          )}
          <button className="material-symbols-outlined hover:text-neon-blue transition-colors">settings</button>
          <button className="material-symbols-outlined hover:text-neon-blue transition-colors">help</button>
          <button className="material-symbols-outlined hover:text-neon-blue transition-colors text-primary">account_circle</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* SideNavBar Execution (Left Sidebar) */}
        <aside className="flex flex-col w-[320px] shrink-0 z-40 bg-surface-container-low dark:bg-surface-container-low border-r border-outline-variant">
          <div className="p-panel-padding border-b border-outline-variant">
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-neon-blue text-sm">memory</span>
              <span className="text-label-caps font-bold text-on-surface">Project Alpha</span>
            </div>
            <div className="text-[11px] text-on-surface-variant font-label-caps opacity-60">V3.0 MNIST ENGINE</div>
          </div>
          
          <nav className="flex-1 py-4 overflow-y-auto">
            <div className="mb-6 px-4">
              <p className="text-label-caps text-[10px] text-on-surface-variant mb-3 px-2">WORKSPACE</p>
              <div className="flex flex-col gap-1">
                <button className="flex items-center gap-3 px-3 py-2.5 bg-primary-container text-neon-blue border-l-2 border-neon-blue font-label-caps text-label-caps">
                  <span className="material-symbols-outlined">folder_open</span>
                  Explorer
                </button>
                <button className="flex items-center gap-3 px-3 py-2.5 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all font-label-caps text-label-caps">
                  <span className="material-symbols-outlined">account_tree</span>
                  Netlist
                </button>
                <button className="flex items-center gap-3 px-3 py-2.5 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all font-label-caps text-label-caps">
                  <span className="material-symbols-outlined">insights</span>
                  Metrics
                </button>
              </div>
            </div>

            <div className="px-gutter mb-6">
              <div className="bg-primary-container border border-slate-800 p-4 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-neon-blue text-lg">cloud_upload</span>
                    <span className="text-label-caps text-xs text-on-surface">ASSETS</span>
                  </div>

                  <div className="relative group mb-2 cursor-pointer">
                    <input type="file" id="model-upload" className="hidden" onChange={(e) => setModelFile(e.target.files[0])} accept=".pt,.pth" />
                    <label htmlFor="model-upload" className="block border border-dashed border-slate-700 p-3 bg-black/40 hover:border-neon-blue transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-on-surface-variant text-sm group-hover:text-neon-blue">description</span>
                        <div className="overflow-hidden">
                          <div className="text-[11px] font-label-caps text-on-surface truncate w-40">{modelFile ? modelFile.name : "Select model .pt file"}</div>
                          <div className="text-[9px] font-label-caps text-on-surface-variant">PYTORCH STATE DICT</div>
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="relative group mb-4 cursor-pointer">
                    <input type="file" id="vectors-upload" className="hidden" onChange={(e) => setTestVectorsFile(e.target.files[0])} accept=".json" />
                    <label htmlFor="vectors-upload" className="block border border-dashed border-slate-700 p-3 bg-black/40 hover:border-neon-blue transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-on-surface-variant text-sm group-hover:text-neon-blue">data_object</span>
                        <div className="overflow-hidden">
                          <div className="text-[11px] font-label-caps text-on-surface truncate w-40">{testVectorsFile ? testVectorsFile.name : "Select test vectors .json"}</div>
                          <div className="text-[9px] font-label-caps text-on-surface-variant">JSON ARRAY</div>
                        </div>
                      </div>
                    </label>
                  </div>

                  {error && (
                    <div className="mb-4 p-2 bg-danger-red/10 border border-danger-red/30 text-[10px] text-danger-red font-code-sm">
                      {error}
                    </div>
                  )}

                  <button 
                    onClick={handleCompile}
                    disabled={isCompiling}
                    className="w-full bg-neon-blue py-2.5 text-black font-label-caps text-xs hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCompiling ? "COMPILING..." : "COMPILE TO SILICON"} 
                    {!isCompiling && <span className="material-symbols-outlined text-sm">chevron_right</span>}
                  </button>
                </div>
              </div>
            </div>
          </nav>

          <div className="mt-auto border-t border-outline-variant p-4">
            <button className="flex items-center gap-3 w-full px-3 py-2 text-on-surface-variant hover:text-on-surface transition-all font-label-caps text-label-caps text-[11px]">
              <span className="material-symbols-outlined text-sm">menu_book</span>
              Documentation
            </button>
            <button className="flex items-center gap-3 w-full px-3 py-2 text-on-surface-variant hover:text-on-surface transition-all font-label-caps text-label-caps text-[11px]">
              <span className="material-symbols-outlined text-sm text-success-green">lan</span>
              System Status
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden">
          
          <div className="flex-1 flex flex-row relative overflow-hidden">
            {/* Canvas Zone */}
            <section className="flex-1 relative overflow-hidden flex flex-col">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#0f172a_0%,_transparent_100%)] opacity-30 pointer-events-none"></div>
              
              {/* Topology Header */}
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-slate-950/60 backdrop-blur-sm border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-neon-blue text-sm">memory</span>
                  <span className="font-headline-md text-label-caps text-xs tracking-wider">ANALOG MICROCHIP TOPOLOGY</span>
                </div>
                {metrics && (
                  <div className="text-[10px] font-label-caps text-on-surface-variant">{metrics.totalNodes} NODES • {metrics.totalEdges.toLocaleString()} TRACES • ZOOM: 1.0X</div>
                )}
              </div>

              {/* React Flow Container */}
              <div className="w-full h-full relative" style={{ paddingTop: '52px' }}>
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
                  >
                    <Background color="#353436" gap={24} size={1} />
                    <Controls className="!bg-surface-container !border-outline-variant" showInteractive={false} />
                    <MiniMap
                      nodeColor={miniMapNodeColor}
                      maskColor="rgba(0, 0, 0, 0.7)"
                      style={{
                        backgroundColor: '#131315',
                        border: '1px solid #353436',
                        borderRadius: '0px',
                      }}
                      pannable
                      zoomable
                    />
                  </ReactFlow>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-neon-blue opacity-5 blur-2xl rounded-full"></div>
                      <span className="material-symbols-outlined text-on-surface-variant opacity-20 text-[84px]">memory</span>
                    </div>
                    <p className="text-on-surface-variant opacity-40 font-label-caps text-label-caps tracking-widest max-w-xs text-center leading-relaxed">
                        Upload model and test vectors to synthesize analog circuit.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Right Properties Panel */}
            <aside className="w-64 shrink-0 bg-surface-container-high border-l border-outline-variant flex flex-col z-40 overflow-y-auto">
              <div className="h-[52px] shrink-0 border-b border-outline-variant flex items-center px-4">
                <span className="text-label-caps text-on-surface-variant font-bold uppercase tracking-tighter">Properties</span>
              </div>
              
              <div className="p-4 flex-1 flex flex-col">
                {metrics ? (
                  <>
                    <p className="text-label-caps text-[10px] text-on-surface-variant mb-3">CIRCUIT METRICS</p>
                    <div className="grid grid-cols-2 gap-2 mb-6">
                      <div className="bg-surface-container-low p-3 border border-slate-800">
                        <div className="text-label-caps text-[9px] text-on-surface-variant mb-1">IR NODES</div>
                        <div className="text-headline-md font-headline-md text-neon-blue">{metrics.totalNodes.toLocaleString()}</div>
                      </div>
                      <div className="bg-surface-container-low p-3 border border-slate-800">
                        <div className="text-label-caps text-[9px] text-on-surface-variant mb-1">IR EDGES</div>
                        <div className="text-headline-md font-headline-md text-neon-purple">{metrics.totalEdges.toLocaleString()}</div>
                      </div>
                      <div className="bg-surface-container-low p-3 border border-slate-800">
                        <div className="text-label-caps text-[9px] text-on-surface-variant mb-1">CONDUCTANCES</div>
                        <div className="text-headline-md font-headline-md text-on-surface">{metrics.conductances.toLocaleString()}</div>
                      </div>
                      <div className="bg-surface-container-low p-3 border border-slate-800">
                        <div className="text-label-caps text-[9px] text-on-surface-variant mb-1">TIA STAGES</div>
                        <div className="text-headline-md font-headline-md text-neon-pink">{metrics.tias.toLocaleString()}</div>
                      </div>
                    </div>

                    {result && result.validation && (
                      <>
                        <p className="text-label-caps text-[10px] text-on-surface-variant mb-3">VALIDATION RESULT</p>
                        <div className={`p-3 mb-4 border ${result.validation.passed ? 'bg-success-green/10 border-success-green/30 text-success-green' : 'bg-danger-red/10 border-danger-red/30 text-danger-red'} flex items-center gap-3`}>
                          <span className="material-symbols-outlined text-[20px]">{result.validation.passed ? 'check_circle' : 'cancel'}</span>
                          <div>
                            <div className="text-[10px] font-bold font-label-caps">{result.validation.passed ? "PASSED" : "FAILED"}</div>
                            <div className="text-[9px] opacity-80 font-code-sm">{result.validation.passed ? "Analog synthesis verified" : "Mapping diverged"}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-6">
                          <div className="bg-surface-container-low p-3 border border-slate-800">
                            <div className="text-label-caps text-[9px] text-on-surface-variant mb-1">MAX ABS ERR</div>
                            <div className="text-code-sm text-neon-blue">{result.validation.max_abs_error.toExponential(1)}</div>
                          </div>
                          <div className="bg-surface-container-low p-3 border border-slate-800">
                            <div className="text-label-caps text-[9px] text-on-surface-variant mb-1">MAX REL ERR</div>
                            <div className="text-code-sm text-neon-purple">{result.validation.max_rel_error.toExponential(1)}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-on-surface-variant opacity-20 text-[40px] mb-4">info</span>
                    <p className="text-label-caps text-on-surface-variant opacity-50">No component selected</p>
                  </div>
                )}
                
                <div className="mt-auto w-full border-t border-outline-variant/30 pt-4">
                  <div className="flex justify-between items-center text-[10px] font-label-caps mb-3">
                    <span className="text-on-surface-variant/60">Live Synthesis</span>
                    <div className="w-8 h-4 bg-neon-blue/20 flex items-center justify-end px-0.5">
                      <div className="w-3 h-3 bg-neon-blue"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-label-caps text-on-surface-variant">
                    <span>CPU LOAD</span>
                    <span className="text-neon-blue">4.2%</span>
                  </div>
                  <div className="w-full h-1 bg-surface-variant mt-1 mb-3 overflow-hidden">
                    <div className="bg-neon-blue h-full" style={{width: '4.2%'}}></div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-label-caps text-on-surface-variant">
                    <span>VRAM</span>
                    <span className="text-neon-pink">0.8 GB</span>
                  </div>
                  <div className="w-full h-1 bg-surface-variant mt-1 overflow-hidden">
                    <div className="bg-neon-pink h-full" style={{width: '12%'}}></div>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {/* Analysis Terminal (Bottom) */}
          <footer className="h-[240px] shrink-0 bg-deep-black border-t border-slate-800 flex flex-col z-50">
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-1.5 flex justify-between items-center shrink-0">
              <div className="flex gap-4">
                <button className="text-[10px] font-label-caps text-neon-blue border-b border-neon-blue px-2 py-1">NETLIST</button>
                <button className="text-[10px] font-label-caps text-on-surface-variant px-2 py-1 hover:text-on-surface transition-colors">SPICE_LOG</button>
              </div>
              <div className="flex items-center gap-3">
                {result && result.validation && result.validation.passed && (
                  <span className="text-[9px] font-label-caps text-success-green">● COMPILATION SUCCESSFUL</span>
                )}
                <button className="material-symbols-outlined text-sm text-on-surface-variant hover:text-white">close</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 font-code-sm text-code-sm text-on-surface-variant selection:bg-neon-blue selection:text-black">
              {result ? (
                <pre className="leading-relaxed text-emerald-300/80">{result.netlist}</pre>
              ) : (
                <pre className="leading-relaxed">
<span className="text-neon-blue">** SYNAPSE SPICE NETLIST GENERATOR V3.0 **</span>
<br/><span className="text-on-surface-variant opacity-40">.param vdd=1.2v</span>
<br/><span className="text-on-surface-variant opacity-40">.temp 25</span>
<br/><br/>
<span className="text-warning-yellow">[WAIT] Awaiting input assets...</span>
                </pre>
              )}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
