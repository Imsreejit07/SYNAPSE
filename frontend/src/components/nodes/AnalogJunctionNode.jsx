import React from 'react';
import { useReactFlow } from '@xyflow/react';

export default function AnalogJunctionNode({ id, data }) {
  const { setNodes, setEdges } = useReactFlow();

  const isHighCapacity = data.capacity > 0.8;
  const heatmapColor = isHighCapacity 
    ? 'border-red-500 bg-red-950/80 text-red-400' 
    : 'border-blue-500 bg-slate-900 text-blue-400';

  const hash = data.label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const latency = `${(hash % 5 + 1.2).toFixed(1)}ns`;
  const cond = `${(hash % 40) + 10}µS`;
  const power = `${(hash % 30) + 5}µW`;

  const handleDelete = (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('synapse-delete-node', { detail: { id } }));
  };

  return (
    <div className={`border-l-4 rounded-lg min-w-[120px] shadow-lg font-mono ${heatmapColor} border-t border-r border-b border-t-slate-700 border-r-slate-700 border-b-slate-700`}>
      <div className="bg-black/40 px-2 py-1 border-b border-black/30 flex justify-between items-center rounded-t-lg">
        <span className="font-bold text-[10px] tracking-widest uppercase">{data.domain || 'COMPONENT'}</span>
        <div className="flex items-center gap-1">
          {isHighCapacity && <span className="material-symbols-outlined text-[10px] text-red-500 animate-pulse">warning</span>}
          <button 
            onPointerDown={handleDelete} 
            className="nodrag text-slate-400 hover:text-red-500 transition-colors ml-1" 
            title="Delete Node"
          >
            <span className="material-symbols-outlined text-[12px]">close</span>
          </button>
        </div>
      </div>
      
      <div className="p-2">
        <div className="text-[11px] font-bold text-white mb-2 truncate" title={data.label}>
          {data.label}
        </div>
        
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8px] text-slate-400">
          <div className="flex justify-between">
            <span>TYPE:</span><span className="text-neon-blue">{data.type}</span>
          </div>
          <div className="flex justify-between">
            <span>G:</span><span className="text-emerald-400">{cond}</span>
          </div>
          <div className="flex justify-between">
            <span>LAT:</span><span className="text-warning-yellow">{latency}</span>
          </div>
          <div className="flex justify-between">
            <span>PWR:</span><span className="text-neon-pink">{power}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
