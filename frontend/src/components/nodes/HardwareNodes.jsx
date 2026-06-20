import React from 'react';
import { Handle, Position } from '@xyflow/react';

// Transistor: Gate (Left), Drain (Top), Source (Bottom)
export const TransistorNode = ({ data }) => (
  <div className="px-4 py-2 bg-slate-900 border-l-4 border-l-cyan-400 rounded-md shadow-lg min-w-[100px] text-center">
    <Handle type="target" position={Position.Left} id="gate" className="w-3 h-3 bg-blue-400" />
    <Handle type="source" position={Position.Top} id="drain" className="w-3 h-3 bg-red-400" />
    <div className="text-white font-mono font-bold">{data.label}</div>
    <div className="text-slate-400 text-xs font-mono">{data.type}MOS</div>
    <Handle type="source" position={Position.Bottom} id="source" className="w-3 h-3 bg-green-400" />
  </div>
);

// Passive (Capacitor/Resistor): Top and Bottom handles only
export const PassiveNode = ({ data }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-slate-800 border-2 border-emerald-500 min-w-[80px] text-center">
    <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-emerald-400" />
    <div className="text-white font-mono font-bold">{data.label}</div>
    <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-emerald-400" />
  </div>
);

export const MemristorArrayNode = ({ id, data }) => {
  const rows = data.rows || 5; 
  const cols = data.cols || 5;

  return (
    <div className="relative p-6 bg-slate-950 border-2 border-indigo-500 rounded-lg shadow-[0_0_20px_rgba(99,102,241,0.2)] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black font-mono min-w-[200px] group z-10">
      <button 
        onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('synapse-delete-node', { detail: { id } })); }}
        className="absolute -top-3 -right-3 w-6 h-6 bg-red-600 hover:bg-red-500 rounded-full text-white flex items-center justify-center border-2 border-slate-900 opacity-0 group-hover:opacity-100 transition-opacity z-50 font-bold"
        title="Delete Memristor"
      >
        ×
      </button>
      <div className="text-cyan-400 text-sm mb-4 tracking-widest text-center font-bold">
        MEMRISTOR ARRAY // LAYER_4
      </div>
      
      {/* Visual Grid */}
      <div className="grid gap-4 p-4 border-2 border-dashed border-yellow-600/60 bg-black/50" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={i} className="w-3 h-3 bg-yellow-500 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
        ))}
      </div>

      {/* HUGE Interactive Input Handles (Left - Wordlines) */}
      {Array.from({ length: rows }).map((_, i) => (
        <Handle
          key={`wl-${i}`}
          type="target"
          position={Position.Left}
          id={`wl-${i}`}
          className="w-4 h-4 bg-cyan-400 border-2 border-white z-50 cursor-crosshair"
          style={{ top: `${(i + 1) * (100 / (rows + 1))}%`, left: '-8px' }}
        />
      ))}

      {/* HUGE Interactive Output Handles (Bottom - Bitlines) */}
      {Array.from({ length: cols }).map((_, i) => (
        <Handle
          key={`bl-${i}`}
          type="source"
          position={Position.Bottom}
          id={`bl-${i}`}
          className="w-4 h-4 bg-purple-500 border-2 border-white z-50 cursor-crosshair"
          style={{ left: `${(i + 1) * (100 / (cols + 1))}%`, bottom: '-8px' }}
        />
      ))}
    </div>
  );
};
