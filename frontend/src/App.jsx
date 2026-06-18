import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ReactFlow, applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { useUser, UserButton } from '@clerk/clerk-react';
import '@xyflow/react/dist/style.css';
import { Upload, Zap, Activity, CheckCircle2, XCircle, Code, ChevronRight, FileJson, Database, Cpu, Layers, GitBranch } from 'lucide-react';
import WorkspaceView from './components/WorkspaceView';
import HardwareView from './components/HardwareView';
import NetlistInspector from './components/NetlistInspector';
import MetricsDashboard from './components/MetricsDashboard';
import SettingsView from './components/SettingsView';
import DocumentationView from './components/DocumentationView';
import SystemStatusView from './components/SystemStatusView';
import ProfileView from './components/ProfileView';
import HelpView from './components/HelpView';
import Terminal from './components/Terminal';
import SimulationPanel from './components/panels/SimulationPanel';
import VerificationPanel from './components/panels/VerificationPanel';
import ManufacturePanel from './components/panels/ManufacturePanel';
import NetlistImporter from './components/panels/NetlistImporter';

import PolymorphicNodeFactory from './components/nodes/PolymorphicNodeFactory';
import { TransistorNode, PassiveNode, MemristorArrayNode } from './components/nodes/HardwareNodes';
import SignalEdge from './components/edges/SignalEdge';

const nodeTypes = { custom: PolymorphicNodeFactory, transistor: TransistorNode, passive: PassiveNode, memristor_array: MemristorArrayNode };
const edgeTypes = { signal: SignalEdge };

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
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('architecture');
  const [modelFile, setModelFile] = useState(null);
  const [testVectorsFile, setTestVectorsFile] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [simulationData, setSimulationData] = useState(null);
  const [timingData, setTimingData] = useState(null);
  const [terminalTab, setTerminalTab] = useState('spice_log');
  const terminalRef = useRef(null);
  const [wsStatus, setWsStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected_cloud'

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const [isTerminalMinimized, setIsTerminalMinimized] = useState(false);

  const startResizingTerminal = useCallback((e) => {
    e.preventDefault();
    setIsResizingTerminal(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingTerminal) return;
      const newHeight = window.innerHeight - e.clientY;
      setTerminalHeight(Math.max(100, Math.min(newHeight, window.innerHeight - 200)));
    };
    const handleMouseUp = () => {
      setIsResizingTerminal(false);
    };

    if (isResizingTerminal) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingTerminal]);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  
  const takeSnapshot = useCallback(() => {
    setPast((p) => [...p, { nodes, edges }]);
    setFuture([]);
  }, [nodes, edges]);

  const onConnect = useCallback((params) => {
    takeSnapshot();
    setEdges((eds) => addEdge({ ...params, animated: true, type: 'smoothstep' }, eds));
  }, [takeSnapshot]);

  useEffect(() => {
    const handleNodeDelete = (e) => {
      const { id } = e.detail;
      setNodes(nds => {
        setPast(p => [...p, { nodes: nds, edges }]);
        setFuture([]);
        return nds.filter(n => n.id !== id);
      });
      setEdges(eds => eds.filter(edge => edge.source !== id && edge.target !== id));
    };
    window.addEventListener('synapse-delete-node', handleNodeDelete);
    return () => window.removeEventListener('synapse-delete-node', handleNodeDelete);
  }, [edges]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [{ nodes, edges }, ...f]);
    setNodes(previous.nodes || []);
    setEdges(previous.edges || []);
  }, [past, nodes, edges]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, { nodes, edges }]);
    setNodes(next.nodes || []);
    setEdges(next.edges || []);
  }, [future, nodes, edges]);

  const spawnMemristor = () => {
    takeSnapshot();
    const newNode = {
      id: `memristor-${Date.now()}`,
      type: 'memristor_array',
      position: { x: 200, y: 200 },
      data: { label: 'Crossbar 5x5', rows: 5, cols: 5 }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const saveWorkspace = async () => {
    if (!user) return alert("You must be logged in to save.");
    
    await fetch('http://localhost:8000/api/v1/workspace/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, nodes, edges })
    });
    alert('Workspace saved securely to the database!');
  };

  const loadWorkspace = async () => {
    if (!user) return;
    const res = await fetch(`http://localhost:8000/api/v1/workspace/load/${user.id}`);
    const data = await res.json();
    if (data.nodes && data.nodes.length > 0) {
        setNodes(data.nodes);
        setEdges(data.edges);
    }
  };

  const clearWorkspace = () => {
    takeSnapshot();
    setNodes([]);
    setEdges([]);
    if (terminalRef?.current) terminalRef.current.write(`\x1b[38;5;11m[WARN] Workspace cleared.\x1b[0m\r\n`);
  };



  const [settings, setSettings] = useState(() => {
    const saved = {
      hardwareAccel: localStorage.getItem('synapse_hw_accel') === 'true',
      engine: localStorage.getItem('default_engine') || 'SYNAPSE_ANALOG_v3.0',
      apiKey: localStorage.getItem('synapse_api_key') || ''
    };
    document.documentElement.classList.add('dark');
    return saved;
  });

  // On-the-Fly Morphing logic
  useEffect(() => {
    setNodes(nds => {
      if (!nds || nds.length === 0) return nds;
      return nds.map(n => ({
        ...n,
        data: { ...n.data, engine: settings.engine }
      }));
    });
    
    if (terminalRef.current && nodes.length > 0) {
      terminalRef.current.write(`\x1b[38;5;214m[INFO] Re-rendering topology for engine: ${settings.engine}\x1b[0m\r\n`);
    }
  }, [settings.engine]);

  /* ── Compile ─────────────────────────────────── */
  const handleCompile = async () => {
    if (!modelFile || !testVectorsFile) {
      setError("Please select both model file and test vectors");
      return;
    }

    setIsCompiling(true);
    setError(null);
    setResult(null);
    setTimingData(null);
    
    if (terminalRef.current) {
      terminalRef.current.clear();
      terminalRef.current.write('\x1b[38;5;244m[INFO] Reading source files...\x1b[0m\r\n');
    }

    try {
      const testVectorsText = await testVectorsFile.text();
      
      // Read model file as array buffer and base64 encode
      const buffer = await modelFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const modelB64 = btoa(binary);

      let wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace('http://', 'ws://').replace('https://', 'wss://') + '/ws/compile';
      if (settings.apiKey) {
        wsUrl += `?api_key=${encodeURIComponent(settings.apiKey)}`;
      }
      
      setWsStatus('connecting');
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (settings.apiKey && settings.apiKey.length >= 5) {
          setWsStatus('connected_cloud');
        } else {
          setWsStatus('disconnected'); // Handled locally without special animation
        }
        ws.send(JSON.stringify({
          use_gpu: settings.hardwareAccel,
          engine: settings.engine,
          test_vectors: testVectorsText,
          model_file_b64: modelB64
        }));
      };

      ws.onmessage = (event) => {
        try {
          // Attempt to parse as final JSON
          const payload = JSON.parse(event.data);
          if (payload.type === 'final_json') {
            const data = payload.data;
            if (data.timing) setTimingData(data.timing);
            setResult(data);
            processGraph(data.ir);
            setActiveTab('architecture');
            setIsCompiling(false);
            setWsStatus('disconnected');
            ws.close();
          }
        } catch (e) {
          // If not JSON, it's a stream log
          if (terminalRef.current) {
            terminalRef.current.write(event.data + '\r\n');
          }
        }
      };

      ws.onerror = (error) => {
        if (terminalRef.current) {
          terminalRef.current.write('\r\n\x1b[1;31m[ERROR] WebSocket connection failed\x1b[0m\r\n');
        }
        setIsCompiling(false);
        setWsStatus('disconnected');
      };

      ws.onclose = (event) => {
        if (event.code === 1008) {
          if (terminalRef.current) {
            terminalRef.current.write('\r\n\x1b[1;31m[ERROR] Cloud Authentication Failed: Invalid API Key.\x1b[0m\r\n');
          }
        }
        setIsCompiling(false);
        setWsStatus('disconnected');
      };

    } catch (err) {
      if (terminalRef.current) {
        terminalRef.current.write(`\r\n\x1b[1;31m[ERROR] ${err.message}\x1b[0m\r\n`);
      }
      setIsCompiling(false);
      setWsStatus('disconnected');
      setError(err.message);
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

    const degrees = {};
    ir.edges.forEach(edge => {
      const source = edge.source || edge.source_pos;
      if (source) {
        degrees[source] = (degrees[source] || 0) + 1;
      }
      if (edge.target) {
        degrees[edge.target] = (degrees[edge.target] || 0) + 1;
      }
    });
    
    // Normalize to mock capacity 0.0 - 1.0 based on max degree
    const maxDegree = Math.max(...Object.values(degrees), 1);

    const newNodes = ir.nodes.map(node => {
      const d = node.domain;
      if (!domainCounts[d]) domainCounts[d] = 0;

      const col = domainColumns[d] || { x: 600, spacing: 40 };
      const yOffset = d === 'reference' || d === 'bias_reference' ? -300 : 0;
      const capacity = (degrees[node.id] || 0) / maxDegree;

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
          initial_value: node.initial_value,
          capacity: capacity,
          engine: settings.engine
        }
      };
    });

    const newEdges = ir.edges.map((edge, i) => {
      const isLargeGraph = ir.edges.length > 200;
      return {
        id: `e-${i}`,
        source: edge.source || edge.source_pos, // Fallback for TIA
        target: edge.target,
        type: 'signal', // Use custom SignalEdge
        animated: !isLargeGraph,
        data: {} // Dynamic data generated in SignalEdge component based on hash
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
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="text-on-surface-variant hover:text-neon-blue transition-colors flex items-center justify-center mr-2"
              title="Toggle Sidebar"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            <div className="w-8 h-8 bg-neon-blue flex items-center justify-center">
              <span className="material-symbols-outlined text-black font-bold">bolt</span>
            </div>
            <div>
              <h1 className="text-headline-lg font-headline-lg font-black text-neon-purple tracking-tighter">SYNAPSE</h1>
              <p className="text-[10px] font-label-caps text-on-surface-variant leading-none">V3.0 MNIST ENGINE</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-8 ml-8 h-full items-center">
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setActiveTab('architecture'); }}
              className={`pb-1 font-label-caps text-label-caps h-full flex items-center transition-colors duration-100 ${activeTab === 'architecture' ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-on-surface-variant hover:bg-surface-variant hover:text-neon-blue'}`}
            >Architecture</a>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setActiveTab('simulation'); }}
              className={`pb-1 font-label-caps text-label-caps h-full flex items-center transition-colors duration-100 ${activeTab === 'simulation' ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-on-surface-variant hover:bg-surface-variant hover:text-neon-blue'}`}
            >Simulate</a>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setActiveTab('verification'); }}
              className={`pb-1 font-label-caps text-label-caps h-full flex items-center transition-colors duration-100 ${activeTab === 'verification' ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-on-surface-variant hover:bg-surface-variant hover:text-neon-blue'}`}
            >Verify</a>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setActiveTab('manufacture'); }}
              className={`pb-1 font-label-caps text-label-caps h-full flex items-center transition-colors duration-100 ${activeTab === 'manufacture' ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-on-surface-variant hover:bg-surface-variant hover:text-neon-blue'}`}
            >Manufacture</a>
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
          <div className="flex items-center gap-2 mr-2 px-3 py-1 bg-black/20 rounded-full border border-slate-800" title="Cloud Connection Status">
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${wsStatus === 'connecting' ? 'bg-warning-yellow animate-pulse' : (wsStatus === 'connected_cloud' ? 'bg-neon-blue animate-pulse shadow-[0_0_8px_#00f0ff]' : 'bg-slate-600')}`}></div>
            <span className="text-[10px] font-label-caps text-slate-400">
              {wsStatus === 'connecting' ? 'CONNECTING...' : (wsStatus === 'connected_cloud' ? 'CLOUD ACTIVE' : 'LOCAL ENGINE')}
            </span>
          </div>



          <button onClick={() => setActiveTab('settings')} className={`material-symbols-outlined transition-colors ${activeTab === 'settings' ? 'text-neon-blue' : 'hover:text-neon-blue'}`}>settings</button>
          <button onClick={() => setActiveTab('help')} className={`material-symbols-outlined transition-colors ${activeTab === 'help' ? 'text-neon-blue' : 'hover:text-neon-blue'}`}>help</button>
          {user ? (
            <div className="flex items-center ml-2">
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-6 h-6 border-2 border-neon-blue/50" } }} />
            </div>
          ) : (
            <button onClick={() => setActiveTab('profile')} className={`material-symbols-outlined transition-colors ${activeTab === 'profile' ? 'text-neon-blue' : 'text-primary hover:text-neon-blue'}`}>account_circle</button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* SideNavBar Execution (Left Sidebar) */}
        <nav className={`${isSidebarCollapsed ? 'w-0 border-none' : 'w-64 border-r'} bg-surface-container-low border-outline-variant flex flex-col shrink-0 transition-all duration-300 overflow-hidden`}>
          <div className="min-w-[16rem] flex flex-col flex-1 h-full overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant">
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
                <button 
                  onClick={() => setActiveTab('architecture')}
                  className={`flex items-center gap-3 px-3 py-2.5 font-label-caps text-label-caps transition-all ${activeTab === 'architecture' ? 'bg-primary-container text-neon-blue border-l-2 border-neon-blue' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface border-l-2 border-transparent'}`}>
                  <span className="material-symbols-outlined">memory</span>
                  Architecture
                </button>
                <button 
                  onClick={() => setActiveTab('simulation')}
                  className={`flex items-center gap-3 px-3 py-2.5 font-label-caps text-label-caps transition-all ${activeTab === 'simulation' ? 'bg-primary-container text-neon-blue border-l-2 border-neon-blue' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface border-l-2 border-transparent'}`}>
                  <span className="material-symbols-outlined">show_chart</span>
                  Simulation
                </button>
                <button 
                  onClick={() => setActiveTab('verification')}
                  className={`flex items-center gap-3 px-3 py-2.5 font-label-caps text-label-caps transition-all ${activeTab === 'verification' ? 'bg-primary-container text-neon-blue border-l-2 border-neon-blue' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface border-l-2 border-transparent'}`}>
                  <span className="material-symbols-outlined">fact_check</span>
                  Verification
                </button>
                <button 
                  onClick={() => setActiveTab('manufacture')}
                  className={`flex items-center gap-3 px-3 py-2.5 font-label-caps text-label-caps transition-all ${activeTab === 'manufacture' ? 'bg-primary-container text-neon-blue border-l-2 border-neon-blue' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface border-l-2 border-transparent'}`}>
                  <span className="material-symbols-outlined">conveyor_belt</span>
                  Manufacture
                </button>
              </div>
            </div>

            {activeTab === 'architecture' && (
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

                    <NetlistImporter setNodes={setNodes} setEdges={setEdges} terminalRef={terminalRef} />

                    <div className="flex flex-col gap-2 mt-4 mb-4">
                      <div className="flex gap-2">
                        <button onClick={saveWorkspace} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs py-2 rounded">
                          SAVE LAYOUT
                        </button>
                        <button onClick={loadWorkspace} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs py-2 rounded">
                          LOAD LAYOUT
                        </button>
                      </div>
                      <button onClick={clearWorkspace} className="w-full bg-red-900/50 hover:bg-red-800/80 border border-red-500/50 text-red-200 font-mono text-xs py-2 rounded transition-colors">
                        CLEAR LAYOUT
                      </button>
                    </div>

                    <button onClick={spawnMemristor} className="w-full bg-neon-purple text-white py-2 mb-4 font-code-sm text-[10px] tracking-widest hover:brightness-110 active:scale-95 transition-all border border-neon-purple/50">
                      + ADD MEMRISTOR ARRAY
                    </button>

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
            )}
          </nav>

          <div className="mt-auto border-t border-outline-variant p-4">
            <button 
              onClick={() => setActiveTab('documentation')}
              className={`flex items-center gap-3 w-full px-3 py-2 transition-all font-label-caps text-label-caps text-[11px] ${activeTab === 'documentation' ? 'text-neon-blue bg-surface-variant' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <span className="material-symbols-outlined text-sm">menu_book</span>
              Documentation
            </button>
            <button 
              onClick={() => setActiveTab('system_status')}
              className={`flex items-center gap-3 w-full px-3 py-2 transition-all font-label-caps text-label-caps text-[11px] ${activeTab === 'system_status' ? 'text-neon-blue bg-surface-variant' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <span className="material-symbols-outlined text-sm text-success-green">lan</span>
              System Status
            </button>
          </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden">
          <div className="flex-1 flex flex-col relative overflow-hidden">
            {/* HardwareView is ALWAYS mounted but hidden via display:none to preserve ReactFlow canvas state */}
            <div className={`flex-1 flex flex-col ${activeTab === 'architecture' ? '' : 'hidden'}`}>
              <HardwareView isVisible={activeTab === 'architecture'} result={result} nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeDragStart={takeSnapshot} undo={undo} redo={redo} canUndo={past.length > 0} canRedo={future.length > 0} nodeTypes={nodeTypes} edgeTypes={edgeTypes} miniMapNodeColor={miniMapNodeColor} metrics={metrics} terminalRef={terminalRef} onSimulationComplete={(data) => { setSimulationData(data); setActiveTab('simulation'); }} />
            </div>
            {activeTab === 'simulation' && <SimulationPanel simulationData={simulationData} setSimulationData={setSimulationData} nodes={nodes} edges={edges} terminalRef={terminalRef} />}
            {activeTab === 'verification' && <VerificationPanel nodes={nodes} edges={edges} terminalRef={terminalRef} />}
            {activeTab === 'manufacture' && <ManufacturePanel nodes={nodes} edges={edges} terminalRef={terminalRef} />}
            {activeTab === 'settings' && <SettingsView settings={settings} setSettings={setSettings} />}
            {activeTab === 'help' && <HelpView />}
            {activeTab === 'profile' && <ProfileView />}
            {activeTab === 'documentation' && <DocumentationView />}
            {activeTab === 'system_status' && <SystemStatusView />}
          </div>
          
          {/* Analysis Terminal (Bottom) */}
          {!isTerminalMinimized && (
            <div
              onMouseDown={startResizingTerminal}
              className="h-1.5 w-full bg-outline-variant/30 hover:bg-neon-blue cursor-row-resize z-30 transition-colors"
            />
          )}
          <footer 
            style={{ height: isTerminalMinimized ? '35px' : `${terminalHeight}px` }}
            className={`bg-deep-black border-t border-outline-variant flex flex-col shrink-0 z-20 transition-[height] duration-200 ease-in-out ${isTerminalMinimized ? 'overflow-hidden' : ''}`}
          >
            <div className="bg-surface-container-low border-b border-outline-variant px-4 py-1.5 flex justify-between items-center">
              <div className="flex gap-4">
                <button 
                  onClick={() => setTerminalTab('spice_log')}
                  className={`text-[10px] font-label-caps px-2 transition-colors ${terminalTab === 'spice_log' ? 'text-neon-blue border-b border-neon-blue' : 'text-on-surface-variant hover:text-on-surface'}`}
                >SPICE_LOG</button>
                <button 
                  onClick={() => setTerminalTab('timing_report')}
                  className={`text-[10px] font-label-caps px-2 transition-colors ${terminalTab === 'timing_report' ? 'text-neon-blue border-b border-neon-blue' : 'text-on-surface-variant hover:text-on-surface'}`}
                >TIMING_REPORT</button>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[9px] font-label-caps ${isCompiling ? 'text-warning-yellow animate-pulse' : result ? 'text-success-green' : error ? 'text-danger-red' : 'text-on-surface-variant'}`}>
                  ● {isCompiling ? 'COMPILING...' : result ? 'COMPILATION SUCCESSFUL' : error ? 'COMPILATION FAILED' : 'IDLE'}
                </span>
                <button
                  onClick={() => setIsTerminalMinimized(!isTerminalMinimized)}
                  className="text-on-surface-variant hover:text-neon-blue transition-colors flex items-center"
                  title={isTerminalMinimized ? "Expand Terminal" : "Minimize Terminal"}
                >
                  <span className="material-symbols-outlined text-sm">
                    {isTerminalMinimized ? "expand_less" : "expand_more"}
                  </span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-0 relative">
              <div className={`absolute inset-0 ${terminalTab === 'spice_log' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                <Terminal ref={terminalRef} />
              </div>
              <div className={`absolute inset-0 overflow-auto p-4 font-code-sm text-xs selection:bg-neon-blue selection:text-black ${terminalTab === 'timing_report' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                {timingData ? (
                  <div className="space-y-2">
                    <div className="text-neon-purple font-bold border-b border-outline-variant pb-2 mb-4">COMPILATION TIMING REPORT</div>
                    <div className="flex justify-between max-w-sm"><span className="text-on-surface-variant">Payload Ingestion:</span> <span className="text-neon-blue">{timingData.ingestion_ms.toFixed(2)} ms</span></div>
                    <div className="flex justify-between max-w-sm"><span className="text-on-surface-variant">Model Deserialization:</span> <span className="text-neon-blue">{timingData.deserialization_ms.toFixed(2)} ms</span></div>
                    <div className="flex justify-between max-w-sm"><span className="text-on-surface-variant">Hardware Allocation:</span> <span className="text-neon-blue">{timingData.hardware_allocation_ms.toFixed(2)} ms</span></div>
                    <div className="flex justify-between max-w-sm"><span className="text-on-surface-variant">Graph Synthesis:</span> <span className="text-neon-blue">{timingData.synthesis_ms.toFixed(2)} ms</span></div>
                    <div className="border-t border-outline-variant/30 mt-2 pt-2 flex justify-between max-w-sm font-bold"><span className="text-on-surface">TOTAL WALL CLOCK:</span> <span className="text-success-green">{timingData.total_ms.toFixed(2)} ms</span></div>
                    
                    {result?.metrics && (
                      <div className="pt-4">
                        <div className="text-warning-yellow font-bold border-b border-outline-variant pb-2 mb-4 mt-2">ENGINE-SPECIFIC METRICS</div>
                        {Object.entries(result.metrics).map(([k, v]) => (
                          <div key={k} className="flex justify-between max-w-sm">
                            <span className="text-on-surface-variant capitalize">{k.replace(/_/g, ' ')}:</span> 
                            <span className="text-neon-blue">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-on-surface-variant opacity-50 italic">No timing data available. Run a compilation first.</div>
                )}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default App;
