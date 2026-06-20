import React from 'react';
import { useSimulationMetrics } from '../../hooks/useSimulationData';

export default function SynthesisDashboard({ nodes, edges }) {
  // Bind directly to the backend telemetry engine
  const metrics = useSimulationMetrics(nodes, edges);

  return (
    <div 
      className="absolute top-4 right-4 p-4 bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 rounded text-cyan-400 font-mono text-sm shadow-[0_0_10px_rgba(6,182,212,0.2)] z-10"
      style={{ pointerEvents: 'none' }}
    >
      <h3 className="text-white font-bold mb-2 border-b border-slate-700 pb-1">SYNTHESIS_REPORT</h3>
      <div>AREA: <span className="text-white">{metrics.area} mm²</span></div>
      <div>PWR:  <span className="text-white">{metrics.power} mW</span></div>
      <div>LAT:  <span className="text-white">{metrics.latency} ns</span></div>
    </div>
  );
}
