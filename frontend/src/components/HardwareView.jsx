import { useState, useMemo, useRef, useEffect } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, Panel } from '@xyflow/react';
import EmptyState from './EmptyState';

export default function HardwareView({ isVisible, result, nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeDragStart, undo, redo, canUndo, canRedo, nodeTypes, edgeTypes, miniMapNodeColor, metrics, terminalRef, onSimulationComplete }) {
  if (!result && (!nodes || nodes.length === 0)) return <EmptyState icon="memory" title="Topology Engine Idle" message="Please compile a model or import a netlist to generate the layout." />;
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [rfInstance, setRfInstance] = useState(null);

  const [selectedNode, setSelectedNode] = useState(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      }, 50);
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  const handlePaneClick = () => {
    setSelectedNode(null);
  };

  const { displayNodes, displayEdges } = useMemo(() => {
    if (!selectedNode) return { displayNodes: nodes, displayEdges: edges };

    // Build adjacency list for undirected path traversal to find the whole connected component
    const adj = {};
    edges.forEach(e => {
      if (!adj[e.source]) adj[e.source] = [];
      if (!adj[e.target]) adj[e.target] = [];
      adj[e.source].push(e.target);
      adj[e.target].push(e.source);
    });

    const connected = new Set();
    const queue = [selectedNode.id];
    connected.add(selectedNode.id);

    while (queue.length > 0) {
      const curr = queue.shift();
      const neighbors = adj[curr] || [];
      for (const n of neighbors) {
        if (!connected.has(n)) {
          connected.add(n);
          queue.push(n);
        }
      }
    }

    const displayNodes = nodes.map(n => ({
      ...n,
      style: {
        ...n.style,
        opacity: connected.has(n.id) ? 1 : 0.1,
        boxShadow: selectedNode.id === n.id ? '0 0 20px #00f0ff' : 'none'
      }
    }));

    const displayEdges = edges.map(e => {
      const isConnected = connected.has(e.source) && connected.has(e.target);
      return {
        ...e,
        animated: isConnected,
        style: {
          ...(e.style || {}),
          stroke: isConnected ? '#00f0ff' : (e.style?.stroke || '#475569'),
          strokeWidth: isConnected ? 3 : (e.style?.strokeWidth || 1.5),
          opacity: isConnected ? 1 : 0.1,
        }
      };
    });

    return { displayNodes, displayEdges };
  }, [nodes, edges, selectedNode]);

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
              onInit={setRfInstance}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              className="bg-transparent"
            nodesDraggable={true}
            elementsSelectable={true}
            edgesFocusable={false}
            minZoom={0.05}
            maxZoom={2}
          >
            <Panel position="top-left" className="flex gap-2">
              <button 
                onClick={toggleFullscreen} 
                className="w-8 h-8 rounded bg-surface-container border border-outline-variant text-on-surface-variant hover:text-white hover:bg-surface-variant flex items-center justify-center transition-all cursor-pointer shadow-lg"
                title="Toggle Fullscreen"
              >
                <span className="material-symbols-outlined text-sm">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
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
            <Controls className="!bg-white !shadow-[0_0_20px_rgba(255,255,255,0.4)] !border-none !rounded-lg scale-125 origin-bottom-left ml-4 mb-4 [&_svg]:!fill-slate-800 [&_svg]:!text-slate-800 [&_path]:!fill-slate-800 [&_button]:!border-b-slate-200 [&_button:hover]:!bg-slate-100" showInteractive={true} />
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
