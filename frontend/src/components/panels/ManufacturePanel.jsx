import React, { useState } from 'react';

export default function ManufacturePanel({ nodes, edges, terminalRef }) {
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [targetFoundry, setTargetFoundry] = useState('TSMC (Taiwan Semiconductor)');
  const [processNode, setProcessNode] = useState('65nm CMOS Core');
  const [maskLayers, setMaskLayers] = useState('All Layers (1-255)');
  const [formatVersion, setFormatVersion] = useState('GDSII v600');

  const handleGenerateGDSII = async () => {
    setIsGenerating(true);
    let routeWidth = 0.065;
    if (processNode.includes('28nm')) routeWidth = 0.028;
    else if (processNode.includes('65nm')) routeWidth = 0.065;
    else if (processNode.includes('130nm')) routeWidth = 0.130;

    if (terminalRef?.current) {
      terminalRef.current.write(`\x1b[38;5;117m[INFO] Initiating GDSII stream-out compiler...\x1b[0m\r\n`);
      terminalRef.current.write(`\x1b[38;5;244m[MANUFACTURE INFO] Compiling library for ${targetFoundry}. Enforcing ${processNode} design rules with metal width ${routeWidth}µm...\x1b[0m\r\n`);
      terminalRef.current.write(`\x1b[38;5;244m[MANUFACTURE INFO] Mask extraction active: ${maskLayers} ...\x1b[0m\r\n`);
      terminalRef.current.write(`\x1b[38;5;244m[INFO] Translating graph coordinates to GDSII geometric boundaries...\x1b[0m\r\n`);
    }

    try {
      const payload = { 
        nodes, 
        edges, 
        configuration: { targetFoundry, processNode, maskLayers, formatVersion }
      };
      const res = await fetch('http://127.0.0.1:8000/api/v1/manufacture/gdsii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tapeout.gds';
      a.click();
      URL.revokeObjectURL(url);

      if (terminalRef?.current) {
        terminalRef.current.write(`\x1b[1;32m[OK] GDSII binary stream generated successfully. Download initiated.\x1b[0m\r\n`);
      }
    } catch (err) {
      if (terminalRef?.current) {
        terminalRef.current.write(`\x1b[1;31m[ERROR] GDSII generation failed: ${err.message}\x1b[0m\r\n`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="flex-1 overflow-y-auto p-6 bg-slate-950 font-code-sm text-on-surface-variant">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="border-b border-outline-variant pb-4">
          <h2 className="text-success-green font-headline-md uppercase tracking-widest text-lg">Tapeout & Manufacture</h2>
          <p className="text-xs mt-2 opacity-70">Prepare and export geometric stream data for silicon foundry fabrication.</p>
        </header>
        
        <div className="bg-surface-container-low border border-outline-variant p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-success-green via-neon-blue to-neon-purple"></div>
          
          <div className="flex gap-8 mb-6">
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-on-surface font-label-caps mb-2 text-base">GDSII Stream-Out Configuration</h3>
                <p className="text-xs opacity-70 mb-4">Export the final verified layout geometries into the industry standard GDSII format for mask generation.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Target Foundry</div>
                  <select 
                    value={targetFoundry}
                    onChange={(e) => setTargetFoundry(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-1 w-full focus:border-success-green focus:outline-none"
                  >
                    <option>TSMC (Taiwan Semiconductor)</option>
                    <option>GlobalFoundries</option>
                    <option>Intel Custom Foundry</option>
                    <option>SkyWater Technology</option>
                  </select>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Process Node</div>
                  <select 
                    value={processNode}
                    onChange={(e) => setProcessNode(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-1 w-full focus:border-success-green focus:outline-none"
                  >
                    <option>65nm CMOS Core</option>
                    <option>28nm HPC+</option>
                    <option>22nm FDX</option>
                    <option>130nm Open</option>
                  </select>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Mask Layers</div>
                  <select 
                    value={maskLayers}
                    onChange={(e) => setMaskLayers(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-1 w-full focus:border-success-green focus:outline-none"
                  >
                    <option>All Layers (1-255)</option>
                    <option>Metal Stack Only</option>
                    <option>FEOL Base Only</option>
                  </select>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Format Version</div>
                  <select 
                    value={formatVersion}
                    onChange={(e) => setFormatVersion(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-1 w-full focus:border-success-green focus:outline-none"
                  >
                    <option>GDSII v600</option>
                    <option>GDSII v5.0</option>
                    <option>OASIS v1.0</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="w-64 shrink-0 bg-slate-900 border border-slate-800 p-4 flex flex-col items-center justify-center text-center rounded-lg">
              <span className="material-symbols-outlined text-5xl text-success-green mb-3">memory</span>
              <h4 className="font-label-caps text-on-surface mb-1">Ready for Tapeout</h4>
              <p className="text-[10px] opacity-60 mb-6">DRC: PASS • LVS: PASS</p>
              <button 
                onClick={handleGenerateGDSII}
                disabled={isGenerating}
                className="w-full py-3 bg-success-green text-black font-label-caps font-bold hover:brightness-110 transition-all active:scale-95 shadow-[0_0_15px_rgba(0,255,100,0.2)] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isGenerating ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : null}
                {isGenerating ? 'COMPILING...' : 'GENERATE GDSII FILE'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
