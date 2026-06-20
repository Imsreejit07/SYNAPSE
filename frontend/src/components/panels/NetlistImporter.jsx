import React, { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { getLayoutedElementsAsync } from '../../utils/layoutUtils';

export default function NetlistImporter({ setNodes, setEdges, terminalRef, setIsCalculating }) {
  const [text, setText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const { fitView } = useReactFlow();

  const handleImport = async () => {
    if (!text.trim()) return;
    setIsImporting(true);
    
    if (terminalRef?.current) {
      terminalRef.current.write(`\x1b[38;5;117m[INFO] Parsing SPICE netlist...\x1b[0m\r\n`);
    }

    try {
      const res = await fetch('http://localhost:8000/api/v1/import/netlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ netlist_text: text })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      const rawNodes = data.nodes || [];
      const rawEdges = data.edges || [];

      // 1. Hierarchical Nesting: Group Nodes by Layer
      const layerSet = new Set();
      rawNodes.forEach(node => {
        // Find hardware trace format like "JUNCT_0_1_POS" or "IN_2_0"
        const match = node.id.match(/^[A-Z]+_(\d+)/);
        if (match) {
          const layerId = `LAYER_${match[1]}`;
          layerSet.add(layerId);
          node.parentNode = layerId;
          node.extent = 'parent'; // Lock to parent bounding box
        }
      });

      const groupNodes = Array.from(layerSet).map(layerId => ({
        id: layerId,
        type: 'group',
        position: { x: 0, y: 0 },
        data: { label: `${layerId}_COMPUTE_BLOCK` },
        style: { 
          backgroundColor: 'rgba(6, 182, 212, 0.05)',
          border: '1px dashed rgba(6, 182, 212, 0.3)',
          borderRadius: '8px'
        }
      }));

      const hierarchicalNodes = [...groupNodes, ...rawNodes];

      setIsCalculating(true);
      const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElementsAsync(hierarchicalNodes, rawEdges);
      
      const isMassive = layoutedEdges.length > 100;
      const finalEdges = layoutedEdges.map((edge) => {
        return {
          ...edge,
          type: 'smoothstep',
          hidden: isMassive, // Completely hide edges for massive graphs
          animated: false,
          zIndex: isMassive ? -1 : 0,
          style: { 
            stroke: isMassive ? 'url(#bus-gradient)' : '#06b6d4',
            strokeWidth: isMassive ? 0.5 : 1,
            fill: 'none',
            strokeOpacity: isMassive ? 0.1 : 0.8,
            pointerEvents: isMassive ? 'none' : 'auto'
          }
        };
      });

      setNodes(layoutedNodes);
      setEdges(finalEdges);
      setIsCalculating(false);
      
      setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 300);
      
      if (terminalRef?.current) {
        terminalRef.current.write(`\x1b[1;32m[IMPORT SUCCESS] Netlist parsed. Canvas populated.\x1b[0m\r\n`);
      }
    } catch (err) {
      if (terminalRef?.current) {
        terminalRef.current.write(`\x1b[1;31m[ERROR] Import failed: ${err.message}\x1b[0m\r\n`);
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-primary-container border border-slate-800 p-4 relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-neon-blue text-lg">code_blocks</span>
          <span className="text-label-caps text-xs text-on-surface">NETLIST IMPORT</span>
        </div>
        <textarea
          className="w-full min-h-[150px] bg-slate-900 border border-outline-variant text-on-surface p-3 font-code-sm text-base focus:outline-none focus:border-neon-blue transition-colors mb-3 rounded resize-y"
          placeholder="* Paste SPICE or Verilog netlist here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
        <button
          onClick={handleImport}
          disabled={isImporting || !text.trim()}
          className="w-full bg-[#114b5f] hover:bg-[#1a6580] text-cyan-200 border border-cyan-600 font-mono text-[11px] font-bold py-3 px-4 rounded transition-all uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 shadow-[inset_0_0_10px_rgba(8,145,178,0.2)]"
        >
          {isImporting ? 'IMPORTING...' : 'IMPORT & DRAW CIRCUIT'}
        </button>
      </div>
    </div>
  );
}
