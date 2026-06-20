import React from 'react';
import { useReactFlow, Handle, Position } from '@xyflow/react';

export default function DigitalGateNode({ id, data }) {
  const { setNodes, setEdges } = useReactFlow();

  const isHighCapacity = data.capacity > 0.8;
  const heatmapColor = isHighCapacity 
    ? 'border-red-500 text-red-400' 
    : 'border-slate-500 text-green-400';

  const hash = data.label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const bitWidth = hash % 2 === 0 ? '32-bit' : '16-bit';
  const lutDensity = `${(hash % 80) + 10} / 128`;
  const clk = `${(hash % 300) + 500} MHz`;

  const handleDelete = (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('synapse-delete-node', { detail: { id } }));
  };

  return (
    <div className={`border-2 rounded-none min-w-[120px] bg-slate-950 font-mono ${heatmapColor} relative`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-cyan-400 !border-slate-800" />
      <button 
        onPointerDown={handleDelete} 
        className="nodrag absolute -top-2 -right-2 bg-slate-900 border border-slate-700 text-slate-400 hover:text-red-500 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
        title="Delete Node"
      >
        <span className="material-symbols-outlined text-[10px]">close</span>
      </button>
      <div className="px-2 py-1 border-b border-inherit flex justify-between items-center">
        <span className="font-bold text-[10px] tracking-widest uppercase">LOGIC_GATE</span>
        <span className="text-[10px]">{data.domain || 'COMPONENT'}</span>
      </div>
      
      <div className="p-2">
        <div className="text-[11px] font-bold text-white mb-2 truncate" title={data.label}>
          {data.label}
        </div>
        
        <div className="grid grid-cols-1 gap-y-1 text-[8px] text-slate-400">
          <div className="flex justify-between">
            <span>LUT:</span><span className="text-slate-300">{lutDensity}</span>
          </div>
          <div className="flex justify-between">
            <span>WIDTH:</span><span className="text-slate-300">{bitWidth}</span>
          </div>
          <div className="flex justify-between">
            <span>CLK:</span><span className="text-slate-300">{clk}</span>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-neon-purple !border-slate-800" />
    </div>
  );
}
