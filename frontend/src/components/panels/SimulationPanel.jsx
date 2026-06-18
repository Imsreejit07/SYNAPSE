import React, { useState } from 'react';

export default function SimulationPanel({ simulationData, setSimulationData, nodes, edges, terminalRef }) {
  const [tstart, setTstart] = useState('0');
  const [tstartUnit, setTstartUnit] = useState('ns');
  const [tstop, setTstop] = useState('100');
  const [tstopUnit, setTstopUnit] = useState('ns');
  const [tstep, setTstep] = useState('0.1');
  const [tstepUnit, setTstepUnit] = useState('ns');
  
  const [acSweep, setAcSweep] = useState('DEC');
  const [acStart, setAcStart] = useState('1');
  const [acStartUnit, setAcStartUnit] = useState('Hz');
  const [acStop, setAcStop] = useState('10');
  const [acStopUnit, setAcStopUnit] = useState('GHz');

  const [isSimulating, setIsSimulating] = useState(false);
  const [viewMode, setViewMode] = useState('transient'); // 'transient' or 'ac'

  const handleReset = () => {
    setTstart('0'); setTstartUnit('ns');
    setTstop('100'); setTstopUnit('ns');
    setTstep('0.1'); setTstepUnit('ns');
    setAcSweep('DEC');
    setAcStart('1'); setAcStartUnit('Hz');
    setAcStop('10'); setAcStopUnit('GHz');
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/simulate/spice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nodes, edges, 
          tstart: tstart + tstartUnit, 
          tstop: tstop + tstopUnit, 
          tstep: tstep + tstepUnit,
          acSweep, 
          acStart: acStart + acStartUnit, 
          acStop: acStop + acStopUnit
        })
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (terminalRef?.current) {
        terminalRef.current.write(`\x1b[1;32m[OK] SPICE Simulation complete. Telemetry updated.\x1b[0m\r\n`);
      }
      if (setSimulationData) {
        setSimulationData(data);
      }
    } catch (err) {
      if (terminalRef?.current) {
        terminalRef.current.write(`\x1b[1;31m[ERROR] Network drop detected: ${err.message}\x1b[0m\r\n`);
      }
    } finally {
      setIsSimulating(false);
    }
  };

  // Helper to generate SVG polyline points and bounds
  const getGraphData = () => {
    if (!simulationData) return null;
    
    let t, v, xAxisLabel, color, title;

    if (viewMode === 'transient' && simulationData.transient_analysis) {
      t = simulationData.transient_analysis.t;
      v = simulationData.transient_analysis.v;
      xAxisLabel = 'TIME [ns]';
      color = '#00f0ff'; // neon-blue
      title = 'V_OUT (Transient Response)';
    } else if (viewMode === 'ac' && simulationData.ac_analysis) {
      t = simulationData.ac_analysis.f;
      v = simulationData.ac_analysis.mag;
      xAxisLabel = 'FREQ [Hz] (Log)';
      color = '#ffcc00'; // warning-yellow
      title = 'MAGNITUDE (AC Sweep)';
    } else {
      return null;
    }

    if (!t || t.length === 0) return null;
    
    // Scale data to fit a 1000x200 viewBox
    const width = 1000;
    const height = 200;
    
    const minT = Math.min(...t);
    const maxT = Math.max(...t);
    const maxV = viewMode === 'transient' ? Math.max(5.0, ...v) : Math.max(0, ...v);
    const minV = viewMode === 'transient' ? 0 : Math.min(-60, ...v); 
    
    const rangeT = maxT - minT || 1;
    const rangeV = maxV - minV || 1;
    
    const points = t.map((val, i) => {
      const x = ((val - minT) / rangeT) * width;
      // Invert Y axis because SVG 0,0 is top-left
      const y = height - (((v[i] - minV) / rangeV) * height * 0.8) - (height * 0.1); 
      return `${x},${y}`;
    });
    
    return {
      polyline: points.join(' '),
      maxT,
      minT,
      maxV,
      minV,
      xAxisLabel,
      color,
      title
    };
  };

  const graphData = getGraphData();

  return (
    <section className="flex-1 overflow-y-auto p-6 bg-slate-950 font-code-sm text-on-surface-variant">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="border-b border-outline-variant pb-4 flex justify-between items-end">
          <div>
            <h2 className="text-neon-blue font-headline-md uppercase tracking-widest text-lg">SPICE Simulation Settings</h2>
            <p className="text-xs mt-2 opacity-70">Configure transient analysis bounds, AC frequencies, and view interactive telemetry.</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={handleReset}
              className="px-4 py-2 border border-slate-700 hover:border-outline-variant text-slate-300 font-label-caps transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
              RESET
            </button>
            <button 
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="px-6 py-2 bg-neon-blue hover:brightness-110 text-black font-label-caps font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.2)]"
            >
              {isSimulating ? (
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-lg">play_arrow</span>
              )}
              {isSimulating ? 'SIMULATING...' : 'RUN SPICE SIM'}
            </button>
          </div>
        </header>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-surface-container-low border border-outline-variant p-4">
            <h3 className="text-neon-purple font-label-caps mb-4">Transient Analysis</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Start Time (TSTART)</span>
                <div className="flex bg-slate-900 border border-slate-700 focus-within:border-neon-blue">
                  <input type="text" value={tstart} onChange={(e) => setTstart(e.target.value)} className="bg-transparent text-neon-blue px-2 py-1 w-16 text-right focus:outline-none" />
                  <select value={tstartUnit} onChange={(e) => setTstartUnit(e.target.value)} className="bg-slate-800 text-neon-blue px-1 border-l border-slate-700 focus:outline-none">
                    <option value="s">s</option>
                    <option value="ms">ms</option>
                    <option value="us">us</option>
                    <option value="ns">ns</option>
                    <option value="ps">ps</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Stop Time (TSTOP)</span>
                <div className="flex bg-slate-900 border border-slate-700 focus-within:border-neon-blue">
                  <input type="text" value={tstop} onChange={(e) => setTstop(e.target.value)} className="bg-transparent text-neon-blue px-2 py-1 w-16 text-right focus:outline-none" />
                  <select value={tstopUnit} onChange={(e) => setTstopUnit(e.target.value)} className="bg-slate-800 text-neon-blue px-1 border-l border-slate-700 focus:outline-none">
                    <option value="s">s</option>
                    <option value="ms">ms</option>
                    <option value="us">us</option>
                    <option value="ns">ns</option>
                    <option value="ps">ps</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Time Step (TSTEP)</span>
                <div className="flex bg-slate-900 border border-slate-700 focus-within:border-neon-blue">
                  <input type="text" value={tstep} onChange={(e) => setTstep(e.target.value)} className="bg-transparent text-neon-blue px-2 py-1 w-16 text-right focus:outline-none" />
                  <select value={tstepUnit} onChange={(e) => setTstepUnit(e.target.value)} className="bg-slate-800 text-neon-blue px-1 border-l border-slate-700 focus:outline-none">
                    <option value="s">s</option>
                    <option value="ms">ms</option>
                    <option value="us">us</option>
                    <option value="ns">ns</option>
                    <option value="ps">ps</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-container-low border border-outline-variant p-4">
            <h3 className="text-warning-yellow font-label-caps mb-4">AC Analysis</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Sweep Type</span>
                <select value={acSweep} onChange={(e) => setAcSweep(e.target.value)} className="bg-slate-900 border border-slate-700 text-warning-yellow px-2 py-1 w-24 focus:border-warning-yellow focus:outline-none">
                  <option value="DEC">DEC</option>
                  <option value="OCT">OCT</option>
                  <option value="LIN">LIN</option>
                </select>
              </div>
              <div className="flex justify-between items-center">
                <span>Start Freq (FSTART)</span>
                <div className="flex bg-slate-900 border border-slate-700 focus-within:border-warning-yellow">
                  <input type="text" value={acStart} onChange={(e) => setAcStart(e.target.value)} className="bg-transparent text-warning-yellow px-2 py-1 w-16 text-right focus:outline-none" />
                  <select value={acStartUnit} onChange={(e) => setAcStartUnit(e.target.value)} className="bg-slate-800 text-warning-yellow px-1 border-l border-slate-700 focus:outline-none">
                    <option value="Hz">Hz</option>
                    <option value="kHz">kHz</option>
                    <option value="MHz">MHz</option>
                    <option value="GHz">GHz</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Stop Freq (FSTOP)</span>
                <div className="flex bg-slate-900 border border-slate-700 focus-within:border-warning-yellow">
                  <input type="text" value={acStop} onChange={(e) => setAcStop(e.target.value)} className="bg-transparent text-warning-yellow px-2 py-1 w-16 text-right focus:outline-none" />
                  <select value={acStopUnit} onChange={(e) => setAcStopUnit(e.target.value)} className="bg-slate-800 text-warning-yellow px-1 border-l border-slate-700 focus:outline-none">
                    <option value="Hz">Hz</option>
                    <option value="kHz">kHz</option>
                    <option value="MHz">MHz</option>
                    <option value="GHz">GHz</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline-variant p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h3 className="text-success-green font-label-caps">Interactive Telemetry Visualization</h3>
              {simulationData && (
                <div className="flex bg-slate-900 rounded border border-outline-variant overflow-hidden">
                  <button 
                    onClick={() => setViewMode('transient')}
                    className={`px-3 py-1 text-[10px] font-label-caps transition-colors ${viewMode === 'transient' ? 'bg-neon-blue/20 text-neon-blue' : 'hover:bg-white/5'}`}
                  >
                    Transient
                  </button>
                  <button 
                    onClick={() => setViewMode('ac')}
                    className={`px-3 py-1 text-[10px] font-label-caps transition-colors ${viewMode === 'ac' ? 'bg-warning-yellow/20 text-warning-yellow' : 'hover:bg-white/5'}`}
                  >
                    AC Sweep
                  </button>
                </div>
              )}
            </div>
            <span className={`material-symbols-outlined text-sm ${simulationData ? 'text-neon-blue' : 'text-success-green animate-pulse'}`}>sensors</span>
          </div>
          <div className="h-64 bg-slate-900 border border-slate-800 flex items-center justify-center relative overflow-hidden group">
            {/* Grid background */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(0, 240, 255, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.2) 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: 'center' }}></div>
            
            {!graphData ? (
              <p className="text-slate-500 z-10 font-label-caps tracking-widest">// AWAITING SIMULATION DATA</p>
            ) : (
              <>
                <div className="absolute top-4 left-4 z-20 text-[10px] font-mono bg-black/50 px-2 py-1 rounded border backdrop-blur-sm" style={{ color: graphData.color, borderColor: `${graphData.color}40` }}>
                  {graphData.title}
                </div>
                <div className="absolute bottom-4 right-4 z-20 text-[10px] font-mono text-on-surface-variant bg-black/50 px-2 py-1 rounded border border-outline-variant/50 backdrop-blur-sm flex gap-2">
                  <span>{graphData.xAxisLabel}</span>
                  <span style={{ color: graphData.color }}>({graphData.maxT} max)</span>
                </div>
                <svg className="w-full h-full z-10" viewBox="0 0 1000 200" preserveAspectRatio="none">
                  {/* Glow filter */}
                  <defs>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  
                  {/* Axis lines */}
                  <line x1="0" y1="180" x2="1000" y2="180" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <line x1="0" y1="20" x2="1000" y2="20" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="5,5" />
                  
                  {/* Y-axis Text */}
                  <text x="10" y="25" fill="rgba(255,255,255,0.4)" fontSize="12" fontFamily="monospace">{graphData.maxV.toFixed(1)}</text>
                  <text x="10" y="175" fill="rgba(255,255,255,0.4)" fontSize="12" fontFamily="monospace">{graphData.minV.toFixed(1)}</text>
                  
                  {/* Data Trace */}
                  <polyline 
                    points={graphData.polyline} 
                    fill="none" 
                    stroke={graphData.color} 
                    strokeWidth="3" 
                    filter="url(#glow)"
                    className="vector-effect-non-scaling-stroke drop-shadow-lg"
                  />
                </svg>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
