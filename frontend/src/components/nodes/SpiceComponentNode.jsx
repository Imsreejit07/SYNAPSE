import React from 'react';
import { useReactFlow } from '@xyflow/react';

export default function SpiceComponentNode({ id, data }) {
  const { setNodes, setEdges } = useReactFlow();

  const isHighCapacity = data.capacity > 0.8;
  const heatmapColor = isHighCapacity 
    ? 'border-red-500 text-red-400' 
    : 'border-slate-600 text-slate-300';

  const hash = data.label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const voltage = `${(hash % 5) + 1.1} V`;
  const current = `${(hash % 50) + 5} mA`;

  const handleDelete = (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('synapse-delete-node', { detail: { id } }));
  };

  return (
    <div className={`border rounded-none min-w-[100px] bg-slate-900 font-mono ${heatmapColor} relative`}>
      <button 
        onPointerDown={handleDelete} 
        className="nodrag absolute -top-2 -right-2 bg-slate-800 border border-slate-600 text-slate-400 hover:text-red-500 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
        title="Delete Node"
      >
        <span className="material-symbols-outlined text-[10px]">close</span>
      </button>
      <div className="p-2 text-center border-b border-inherit bg-slate-800">
        <div className="text-[10px] font-bold uppercase truncate" title={data.label}>
          {data.label}
        </div>
      </div>
      
      <div className="p-2">
        <div className="grid grid-cols-1 gap-y-1 text-[8px] text-slate-400">
          <div className="flex justify-between">
            <span>V_NODAL:</span><span className="text-emerald-400">{voltage}</span>
          </div>
          <div className="flex justify-between">
            <span>I_BRANCH:</span><span className="text-warning-yellow">{current}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
