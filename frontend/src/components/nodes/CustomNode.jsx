import React from 'react';

export default function CustomNode({ data }) {
  const isHighCapacity = data.capacity > 0.8;
  const heatmapColor = isHighCapacity 
    ? 'border-red-500 bg-red-950/80 text-red-400' 
    : 'border-blue-500 bg-slate-900 text-blue-400';

  // Calculate some static hardware metadata based on node name/hash
  const hash = data.label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const latency = `${(hash % 5 + 1.2).toFixed(1)}ns`;
  const cond = `${(hash % 40) + 10}µS`;
  const power = `${(hash % 30) + 5}µW`;

  return (
    <div className={`border-l-4 rounded-none min-w-[120px] shadow-lg backdrop-blur-md transition-all duration-300 font-mono ${heatmapColor} border-t border-r border-b border-t-slate-700 border-r-slate-700 border-b-slate-700`}>
      <div className="bg-black/40 px-2 py-1 border-b border-black/30 flex justify-between items-center">
        <span className="font-bold text-[10px] tracking-widest uppercase">{data.domain}</span>
        {isHighCapacity && <span className="material-symbols-outlined text-[10px] text-red-500 animate-pulse">warning</span>}
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
