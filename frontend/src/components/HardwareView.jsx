import { useState, useMemo, useRef, useEffect } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, Panel, useOnViewportChange } from '@xyflow/react';
import EmptyState from './EmptyState';
import SynthesisDashboard from './panels/SynthesisDashboard';
import WaveformPanel from './panels/WaveformPanel';

/**
 * DETERMINISTIC SIMULATION BRIDGE
 * Generates a unique, repeatable electrical signature per node ID using a seeded PRNG.
 * The same node ID will always produce the same waveform — no Math.random().
 */
function seededRandom(seed) {
  // Mulberry32 — a fast 32-bit seeded PRNG
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const simulateNodePhysics = async (id) => {
  const seed = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const rng = seededRandom(seed);
  return Array.from({ length: 30 }, (_, i) => ({
    time: i,
    voltage: Math.sin(i * 0.4 + seed) * Math.cos(i * 0.2) * (rng() * 0.6 + 0.4)
  }));
};

export default function HardwareView({ isVisible, isCalculating, result, nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeDragStart, undo, redo, canUndo, canRedo, nodeTypes, edgeTypes, miniMapNodeColor, metrics, terminalRef, onSimulationComplete }) {
  // IMPORTANT: Early return guard moved BELOW all hooks to comply with Rules of Hooks.
  // React requires hooks to be called in the same order on every render.
  const isEmpty = !result && (!nodes || nodes.length === 0);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [rfInstance, setRfInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedNodeData, setSelectedNodeData] = useState([]);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState(false);
  const [isWaveformMinimized, setIsWaveformMinimized] = useState(false);

  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDetailed, setIsDetailed] = useState(false);

  // Sync waveform visibility state to the container DOM so CSS can dynamically offset native ReactFlow widgets (like the attribution watermark)
  useEffect(() => {
    if (containerRef.current) {
      const isVisible = selectedNodeData?.length > 0 || simulationError || simulationLoading;
      if (isVisible && !isWaveformMinimized) {
        containerRef.current.classList.add('waveform-open');
        containerRef.current.classList.remove('waveform-minimized');
      } else if (isVisible && isWaveformMinimized) {
        containerRef.current.classList.add('waveform-minimized');
        containerRef.current.classList.remove('waveform-open');
      } else {
        containerRef.current.classList.remove('waveform-open', 'waveform-minimized');
      }
    }
  }, [selectedNodeData, simulationError, simulationLoading, isWaveformMinimized]);

  useOnViewportChange({
    onChange: (viewport) => {
      const detailed = viewport.zoom > 0.5;
      if (detailed !== isDetailed) {
        setIsDetailed(detailed);
      }
    },
  });

  const layoutState = useRef({ prevLength: 0, prevVisible: false });

  useEffect(() => {
    if (!rfInstance || !nodes) return;
    
    const justBecameVisible = isVisible && !layoutState.current.prevVisible;
    const batchImported = Math.abs(nodes.length - layoutState.current.prevLength) > 1;
    const initialLoad = layoutState.current.prevLength === 0 && nodes.length > 0;
    
    layoutState.current.prevLength = nodes.length;
    layoutState.current.prevVisible = isVisible;

    if (isVisible && (justBecameVisible || batchImported || initialLoad)) {
      const timer = setTimeout(() => {
        rfInstance.fitView({ padding: 0.1, duration: 800 });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, rfInstance, nodes]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Pre-calculate full graph adjacency lists for blazing fast DOM-based signal tracing
  const { adjDown, adjUp } = useMemo(() => {
    const down = {};
    const up = {};
    if (edges) {
      edges.forEach(e => {
        if (!down[e.source]) down[e.source] = [];
        if (!up[e.target]) up[e.target] = [];
        down[e.source].push({ next: e.target, edgeId: e.id });
        up[e.target].push({ next: e.source, edgeId: e.id });
      });
    }
    return { adjDown: down, adjUp: up };
  }, [edges]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleNodeClick = async (event, node) => {
    event.stopPropagation();
    
    console.log(`[EDA_ENGINE] Node selected: ${node.id}`);
    setSelectedNode(node);
    
    try {
      setSimulationLoading(true);
      setSimulationError(false);
      const data = await simulateNodePhysics(node.id);
      setSelectedNodeData(data);
      setSimulationLoading(false);

      // ML Data Export hook — raw simulation vector ready for AI/ML model ingestion
      console.log("ML_EXPORT_DATA:", JSON.stringify({
        nodeId: node.id,
        label: node.data?.label || node.id,
        domain: node.data?.domain || 'unknown',
        timestamp: Date.now(),
        trace: data
      }));
    } catch (e) {
      console.error("[EDA_ENGINE] Simulation fault:", e);
      setSimulationError(true);
      setSimulationLoading(false);
    }
  };

  const handlePaneClick = () => {
    setSelectedNode(null);
  };

  const handleNodeMouseEnter = (event, node) => {
    if (containerRef.current) containerRef.current.classList.add('is-node-hovered');
    
    // Fast DOM-based recursive signal tracing (BFS)
    const connectedNodes = new Set([node.id]);
    const connectedEdges = new Set();
    
    const traverse = (currentId, adjList) => {
      const neighbors = adjList[currentId] || [];
      neighbors.forEach(({ next, edgeId }) => {
        connectedEdges.add(edgeId);
        if (!connectedNodes.has(next)) {
          connectedNodes.add(next);
          traverse(next, adjList);
        }
      });
    };
    
    // Trace entire signal path (both inputs leading to this node, and outputs driven by it)
    traverse(node.id, adjDown);
    traverse(node.id, adjUp);

    // Batch apply highlight classes to the physical DOM
    connectedNodes.forEach(id => {
      const nodeEl = document.querySelector(`.react-flow__node[data-id="${id}"]`);
      if (nodeEl) nodeEl.classList.add('highlight-connection');
    });
    
    connectedEdges.forEach(id => {
      const safeId = CSS.escape(id);
      const edgeEl = document.querySelector(`.react-flow__edge[data-id="${safeId}"]`) || document.querySelector(`[data-testid="rf__edge-${safeId}"]`);
      if (edgeEl) edgeEl.classList.add('highlight-connection');
    });
  };

  const handleNodeMouseLeave = () => {
    if (containerRef.current) containerRef.current.classList.remove('is-node-hovered');
    // Batch remove all highlights
    document.querySelectorAll('.highlight-connection').forEach(el => {
      el.classList.remove('highlight-connection');
    });
  };

  const { displayNodes, displayEdges } = useMemo(() => {
    if (!isDetailed && !selectedNode) return { displayNodes: nodes, displayEdges: [] };
    return { displayNodes: nodes, displayEdges: edges };
  }, [nodes, edges, isDetailed, selectedNode]);

  // Handle active selection highlighting via DOM mutation to avoid ReactFlow ResizeObserver infinite loops
  // Uses the memoized adjDown/adjUp to avoid redundant O(E) recomputation
  useEffect(() => {
    if (!containerRef.current || !nodes || !edges) return;
    
    // Reset all previous selection state
    document.querySelectorAll('.highlight-active, .dimmed, .highlight-connection').forEach(el => {
      el.classList.remove('highlight-active', 'dimmed', 'highlight-connection');
    });

    if (!selectedNode) {
      containerRef.current.classList.remove('has-selection');
      return;
    }

    containerRef.current.classList.add('has-selection');

    // Reuse the memoized adjacency lists (computed once per edge change in the useMemo above)
    const connectedNodes = new Set([selectedNode.id]);
    const connectedEdges = new Set();

    const traverse = (currentId, adjList) => {
      const neighbors = adjList[currentId] || [];
      neighbors.forEach(({ next, edgeId }) => {
        connectedEdges.add(edgeId);
        if (!connectedNodes.has(next)) {
          connectedNodes.add(next);
          traverse(next, adjList);
        }
      });
    };

    traverse(selectedNode.id, adjDown);
    traverse(selectedNode.id, adjUp);

    nodes.forEach(n => {
      const nodeEl = document.querySelector(`.react-flow__node[data-id="${CSS.escape(n.id)}"]`);
      if (nodeEl) {
        if (connectedNodes.has(n.id)) nodeEl.classList.add('highlight-active');
        else nodeEl.classList.add('dimmed');
      }
    });

    connectedEdges.forEach(id => {
      const safeId = CSS.escape(id);
      const edgeEl = document.querySelector(`.react-flow__edge[data-id="${safeId}"]`) || document.querySelector(`[data-testid="rf__edge-${safeId}"]`);
      if (edgeEl) {
        edgeEl.classList.add('highlight-connection');
      }
    });
  }, [selectedNode, nodes, edges, adjDown, adjUp]);

  const handleExportNetlist = async () => {
    try {
      const payload = JSON.stringify({ nodes, edges }, null, 2);
      
      // Verify with backend first
      const res = await fetch('http://127.0.0.1:8000/api/v1/export-netlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      
      if (terminalRef?.current) {
        terminalRef.current.write(`\x1b[1;32m[OK] ${data.message || 'Netlist exported successfully.'}\x1b[0m\r\n`);
      }

      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'synapse_netlist.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (terminalRef?.current) {
        terminalRef.current.write(`\x1b[1;31m[ERROR] Failed to export netlist: ${err.message}\x1b[0m\r\n`);
      }
    }
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/simulate/spice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (terminalRef?.current) {
        terminalRef.current.write(`\x1b[1;32m[OK] SPICE Simulation complete. Output voltage nodes simulated.\x1b[0m\r\n`);
      }
      if (onSimulationComplete) {
        onSimulationComplete(data);
      }
    } catch (err) {
      if (terminalRef?.current) {
        terminalRef.current.write(`\x1b[1;31m[ERROR] Network drop detected: ${err.message}\x1b[0m\r\n`);
      }
    } finally {
      setIsSimulating(false);
    }
  };

  // Rules of Hooks: guard AFTER all hooks have been called
  if (isEmpty) return <EmptyState icon="memory" title="Topology Engine Idle" message="Please compile a model or import a netlist to generate the layout." />;

  return (
    <section ref={containerRef} className="flex-1 relative overflow-hidden flex flex-col bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#0f172a_0%,_transparent_100%)] opacity-30 pointer-events-none"></div>
      
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-slate-950/60 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-neon-blue text-sm">memory</span>
          <span className="font-headline-md text-label-caps text-xs tracking-wider">ANALOG MICROCHIP TOPOLOGY</span>
        </div>
        {metrics && (
          <div className="flex items-center gap-6">
            <div className="text-[10px] font-label-caps text-on-surface-variant">{metrics.totalNodes} NODES • {metrics.totalEdges.toLocaleString()} TRACES</div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-surface-variant border border-outline-variant rounded divide-x divide-outline-variant">
                <select 
                  id="component-type-select"
                  className="bg-transparent text-neon-blue font-label-caps text-xs px-2 py-1 outline-none cursor-pointer"
                  defaultValue="Resistor"
                >
                  <option value="Resistor">Resistor</option>
                  <option value="Capacitor">Capacitor</option>
                  <option value="Inductor">Inductor</option>
                  <option value="Transistor">Transistor</option>
                  <option value="GND">GND (Ground)</option>
                  <option value="VDD">VDD (Power)</option>
                  <option value="IC">IC (Integrated Circuit)</option>
                </select>
                <button 
                  onClick={() => {
                    const selectEl = document.getElementById('component-type-select');
                    const compType = selectEl ? selectEl.value : 'Resistor';
                    const compLabel = compType === 'GND' || compType === 'VDD' ? compType : `${compType}_${Math.floor(Math.random() * 1000)}`;
                    
                    const newNode = {
                      id: `node-${Date.now()}`,
                      type: 'custom',
                      position: { x: Math.random() * 200, y: Math.random() * 200 },
                      data: { label: compLabel, type: compType, domain: 'component' }
                    };
                    onNodesChange([{ type: 'add', item: newNode }]);
                    if (terminalRef?.current) {
                      terminalRef.current.write(`\x1b[38;5;14m[INFO] Added new component ${newNode.data.label}\x1b[0m\r\n`);
                    }
                  }}
                  className="px-3 py-1 hover:bg-slate-700 text-neon-blue transition-colors flex items-center justify-center"
                  title="Add Component"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
              </div>
              <button 
                onClick={handleExportNetlist}
                className="px-3 py-1 bg-surface-variant hover:bg-slate-700 text-neon-blue font-label-caps text-xs transition-colors border border-outline-variant hover:border-neon-blue flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Export Netlist
              </button>
              <button 
                onClick={handleRunSimulation}
                disabled={isSimulating}
                className="px-3 py-1 bg-neon-purple hover:brightness-110 text-white font-label-caps text-xs transition-colors border border-transparent disabled:opacity-50 flex items-center gap-1"
              >
                {isSimulating ? (
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                )}
                {isSimulating ? 'Simulating...' : 'Run SPICE Sim'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="w-full h-full relative flex" style={{ paddingTop: '52px' }}>
        <div className="flex-1 relative">
            {isCalculating && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4 p-8 bg-slate-900 border border-cyan-500/50 rounded-lg shadow-[0_0_30px_rgba(8,145,178,0.2)]">
                  <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-cyan-400 font-mono text-sm tracking-widest uppercase font-bold">
                    Compiling Topology...
                  </div>
                </div>
              </div>
            )}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
              <defs>
                <linearGradient id="bus-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1e293b" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity="0.8" />
                </linearGradient>
              </defs>
            </svg>
            <ReactFlow
              nodes={displayNodes}
              edges={displayEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              connectionRadius={80}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              onNodeDragStart={onNodeDragStart}
              onNodeMouseEnter={handleNodeMouseEnter}
              onNodeMouseLeave={handleNodeMouseLeave}
              onInit={setRfInstance}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              className="bg-transparent"
              nodesDraggable={true}
              elementsSelectable={true}
              edgesFocusable={false}
              onlyRenderVisibleElements={true}
              nodesConnectable={false}
              noDragClassName="nodrag"
              preventScrolling={true}
              zoomOnScroll={true}
              minZoom={0.05}
              maxZoom={2}
          >
            <Panel position="top-left" className="flex gap-2">
              <button 
                onClick={toggleFullscreen} 
                className="w-8 h-8 rounded bg-surface-container border border-outline-variant text-on-surface-variant hover:text-white hover:bg-surface-variant flex items-center justify-center transition-all cursor-pointer shadow-lg"
                title="Toggle Fullscreen"
              >
                <span className="material-symbols-outlined text-lg">
                  {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                </span>
              </button>
              <div className="w-px bg-outline-variant/50 my-1"></div>
              <button 
                onClick={undo} 
                disabled={!canUndo} 
                className={`w-8 h-8 rounded bg-surface-container border flex items-center justify-center transition-all ${canUndo ? 'border-neon-blue/50 text-neon-blue hover:bg-surface-variant cursor-pointer' : 'border-outline-variant text-on-surface-variant/30 cursor-not-allowed'}`}
                title="Undo Node Drag"
              >
                <span className="material-symbols-outlined text-sm">undo</span>
              </button>
              <button 
                onClick={redo} 
                disabled={!canRedo} 
                className={`w-8 h-8 rounded bg-surface-container border flex items-center justify-center transition-all ${canRedo ? 'border-neon-blue/50 text-neon-blue hover:bg-surface-variant cursor-pointer' : 'border-outline-variant text-on-surface-variant/30 cursor-not-allowed'}`}
                title="Redo Node Drag"
              >
                <span className="material-symbols-outlined text-sm">redo</span>
              </button>
            </Panel>
            <Background variant={BackgroundVariant.Dots} color="#353436" gap={24} size={1.5} />
            
            {/* Dynamically push native ReactFlow widgets up so the WaveformPanel doesn't crush them */}
            <Controls 
              className="!bg-white !shadow-[0_0_20px_rgba(255,255,255,0.4)] !border-none !rounded-lg scale-125 origin-bottom-left ml-4 [&_svg]:!fill-slate-800 [&_svg]:!text-slate-800 [&_path]:!fill-slate-800 [&_button]:!border-b-slate-200 [&_button:hover]:!bg-slate-100 transition-all duration-300" 
              showInteractive={true} 
              style={{ marginBottom: (selectedNodeData?.length > 0 || simulationError || simulationLoading) ? (isWaveformMinimized ? '80px' : '220px') : '16px' }}
            />
            <MiniMap
              nodeColor={miniMapNodeColor}
              maskColor="rgba(0, 0, 0, 0.7)"
              className="transition-all duration-300"
              style={{
                backgroundColor: '#131315',
                border: '1px solid #353436',
                borderRadius: '0px',
                marginBottom: (selectedNodeData?.length > 0 || simulationError || simulationLoading) ? (isWaveformMinimized ? '80px' : '220px') : '16px'
              }}
              pannable
              zoomable
            />
            
            <SynthesisDashboard nodes={nodes} edges={edges} />
            <WaveformPanel 
              data={selectedNodeData} 
              nodeLabel={selectedNode?.data?.label || selectedNode?.id} 
              loading={simulationLoading}
              error={simulationError}
              isMinimized={isWaveformMinimized}
              setIsMinimized={setIsWaveformMinimized}
            />
          </ReactFlow>
        </div>
        
        {/* NodeDetails Panel */}
        {selectedNode && (
          <aside className="w-80 bg-surface-container border-l border-outline-variant flex flex-col shrink-0 z-20 transition-all">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h2 className="text-[11px] font-label-caps text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-neon-blue">info</span>
                PROPERTY INSPECTOR
              </h2>
              <button onClick={handlePaneClick} className="text-on-surface-variant hover:text-white transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="p-6 space-y-6 font-mono text-xs overflow-auto flex-1">
              <div>
                <div className="text-[9px] text-on-surface-variant mb-1 uppercase tracking-wider font-sans">Node ID</div>
                <div className="text-neon-blue break-all">{selectedNode.data.label}</div>
              </div>
              <div>
                <div className="text-[9px] text-on-surface-variant mb-1 uppercase tracking-wider font-sans">Domain</div>
                <div className="text-on-surface bg-slate-900 px-2 py-1 inline-block border border-slate-700 rounded-sm">{selectedNode.data.domain}</div>
              </div>
              <div>
                <div className="text-[9px] text-on-surface-variant mb-1 uppercase tracking-wider font-sans">Type</div>
                <div className="text-on-surface bg-slate-900 px-2 py-1 inline-block border border-slate-700 rounded-sm">{selectedNode.data.type}</div>
              </div>
              <div>
                <div className="text-[9px] text-on-surface-variant mb-1 uppercase tracking-wider font-sans">Calculated Capacity</div>
                <div className={`px-2 py-1 inline-block border rounded-sm ${selectedNode.data.capacity > 0.8 ? 'border-red-500 bg-red-950 text-red-400' : 'border-blue-500 bg-slate-900 text-blue-400'}`}>
                  {((selectedNode.data.capacity || 0) * 100).toFixed(1)}% Usage
                </div>
              </div>
              {selectedNode.data.initial_value !== undefined && (
                <div>
                  <div className="text-[9px] text-on-surface-variant mb-1 uppercase tracking-wider font-sans">Initial Value</div>
                  <div className="text-warning-yellow">{selectedNode.data.initial_value}</div>
                </div>
              )}
            </div>
          </aside>
        )}
        

      </div>
    </section>
  );
}
