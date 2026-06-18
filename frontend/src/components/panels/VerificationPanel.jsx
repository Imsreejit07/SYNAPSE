import React, { useState } from 'react';

export default function VerificationPanel({ nodes, edges, terminalRef }) {
  const [drcStatus, setDrcStatus] = useState('IDLE'); // IDLE, RUNNING, PASS, FAIL
  const [lvsStatus, setLvsStatus] = useState('IDLE'); // IDLE, RUNNING, PASS, FAIL
  
  const handleExecuteDRC = async () => {
    setDrcStatus('RUNNING');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/verify/drc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      setDrcStatus(data.status);
      
      if (terminalRef?.current) {
        if (data.status === 'FAIL') {
          terminalRef.current.write(`\x1b[1;31m[DRC ERROR] Layout violations detected:\x1b[0m\r\n`);
          data.violations.forEach(v => {
            terminalRef.current.write(` - ${v.type} at (${v.x}, ${v.y}) on layer ${v.layer}: ${v.message}\r\n`);
          });
        } else {
          terminalRef.current.write(`\x1b[1;32m[DRC PASS] Layout geometry verified against TSMC 65nm Core constraints.\x1b[0m\r\n`);
        }
      }
    } catch (err) {
      setDrcStatus('FAIL');
      if (terminalRef?.current) terminalRef.current.write(`\x1b[1;31m[DRC ERROR] Execution failed: ${err.message}\x1b[0m\r\n`);
    }
  };

  const handleExecuteLVS = async () => {
    setLvsStatus('RUNNING');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/verify/lvs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      setLvsStatus(data.status);
      
      if (terminalRef?.current) {
        if (data.status === 'FAIL') {
          terminalRef.current.write(`\x1b[1;31m[LVS ERROR] Logical mismatches detected:\x1b[0m\r\n`);
          data.mismatches.forEach(m => {
            terminalRef.current.write(` - ${m.type}: ${m.message}\r\n`);
          });
        } else {
          terminalRef.current.write(`\x1b[1;32m[LVS PASS] Extracted layout topology matches source schematic intent.\x1b[0m\r\n`);
        }
      }
    } catch (err) {
      setLvsStatus('FAIL');
      if (terminalRef?.current) terminalRef.current.write(`\x1b[1;31m[LVS ERROR] Execution failed: ${err.message}\x1b[0m\r\n`);
    }
  };
  
  const renderStatus = (status) => {
    switch(status) {
      case 'RUNNING':
        return <><span className="material-symbols-outlined animate-spin text-[14px] text-neon-blue">progress_activity</span> RUNNING</>;
      case 'PASS':
        return <><span className="w-2 h-2 rounded-full bg-success-green shadow-[0_0_8px_rgba(0,255,0,0.8)]"></span> PASS</>;
      case 'FAIL':
        return <><span className="w-2 h-2 rounded-full bg-error-red shadow-[0_0_8px_rgba(255,0,0,0.8)]"></span> FAIL</>;
      default:
        return <><span className="w-2 h-2 rounded-full bg-slate-600"></span> IDLE</>;
    }
  };

  return (
    <section className="flex-1 overflow-y-auto p-6 bg-slate-950 font-code-sm text-on-surface-variant">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="border-b border-outline-variant pb-4">
          <h2 className="text-neon-pink font-headline-md uppercase tracking-widest text-lg">Physical Verification</h2>
          <p className="text-xs mt-2 opacity-70">Design Rule Checking (DRC) and Layout Versus Schematic (LVS) execution dashboard.</p>
        </header>
        
        <div className="space-y-6">
          <div className="bg-surface-container-low border border-outline-variant p-6 relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${drcStatus === 'PASS' ? 'bg-success-green shadow-[0_0_10px_rgba(0,255,0,0.5)]' : drcStatus === 'FAIL' ? 'bg-error-red shadow-[0_0_10px_rgba(255,0,0,0.5)]' : drcStatus === 'RUNNING' ? 'bg-neon-blue shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'bg-slate-600'}`}></div>
            <div className="flex justify-between items-start mb-4 pl-2">
              <div>
                <h3 className="text-on-surface font-label-caps mb-1 text-base">Design Rule Check (DRC)</h3>
                <p className="text-xs opacity-70 max-w-xl">Verifies that the layout geometry meets foundry spacing, width, and enclosure rules. Prevents manufacturing defects during lithography.</p>
              </div>
              <button 
                onClick={handleExecuteDRC}
                disabled={drcStatus === 'RUNNING'}
                className="px-6 py-2 bg-slate-800 text-on-surface font-label-caps text-xs border border-slate-600 hover:border-neon-pink hover:text-neon-pink transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                EXECUTE DRC
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 border-t border-outline-variant/30 pt-4 mt-2 pl-2">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Rule Deck</div>
                <select className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-1 w-full focus:border-neon-pink focus:outline-none">
                  <option>TSMC 65nm Core</option>
                  <option>GlobalFoundries 22FDX</option>
                  <option>SkyWater 130nm Open</option>
                </select>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Density Checks</div>
                <select className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-1 w-full focus:border-neon-pink focus:outline-none">
                  <option>Enabled (Standard)</option>
                  <option>Disabled (Fast)</option>
                </select>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Status</div>
                <div className="text-slate-300 font-label-caps flex items-center gap-2 mt-1 min-h-[28px]">
                  {renderStatus(drcStatus)}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-container-low border border-outline-variant p-6 relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${lvsStatus === 'PASS' ? 'bg-success-green shadow-[0_0_10px_rgba(0,255,0,0.5)]' : lvsStatus === 'FAIL' ? 'bg-error-red shadow-[0_0_10px_rgba(255,0,0,0.5)]' : lvsStatus === 'RUNNING' ? 'bg-neon-blue shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'bg-slate-600'}`}></div>
            <div className="flex justify-between items-start mb-4 pl-2">
              <div>
                <h3 className="text-on-surface font-label-caps mb-1 text-base">Layout vs Schematic (LVS)</h3>
                <p className="text-xs opacity-70 max-w-xl">Ensures the synthesized physical layout mathematically matches the source electrical netlist. Detects shorts, opens, and parameter mismatches.</p>
              </div>
              <button 
                onClick={handleExecuteLVS}
                disabled={lvsStatus === 'RUNNING'}
                className="px-6 py-2 bg-slate-800 text-on-surface font-label-caps text-xs border border-slate-600 hover:border-neon-pink hover:text-neon-pink transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                EXECUTE LVS
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 border-t border-outline-variant/30 pt-4 mt-2 pl-2">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Extraction Mode</div>
                <select className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-1 w-full focus:border-neon-pink focus:outline-none">
                  <option>Hierarchical</option>
                  <option>Flat</option>
                </select>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Parasitics (PEX)</div>
                <select className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-1 w-full focus:border-neon-pink focus:outline-none">
                  <option>None (Topology Only)</option>
                  <option>R Only</option>
                  <option>R + C</option>
                  <option>R + C + CC</option>
                </select>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Status</div>
                <div className="text-slate-300 font-label-caps flex items-center gap-2 mt-1 min-h-[28px]">
                  {renderStatus(lvsStatus)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
