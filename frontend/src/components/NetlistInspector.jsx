import { useState } from 'react';
import EmptyState from './EmptyState';

export default function NetlistInspector({ result }) {
  const [copied, setCopied] = useState(false);

  if (!result || !result.netlist) return <EmptyState icon="terminal" title="Terminal Idle" message="No netlist generated. Awaiting compilation." />;

  const lines = result.netlist.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(result.netlist);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    if (!result || !result.netlist) return;
    const blob = new Blob([result.netlist], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MNIST_CONV_LAYER_01.SP';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 flex flex-col bg-deep-black relative overflow-hidden" style={{
      backgroundImage: `radial-gradient(circle, #353436 1px, transparent 1px)`,
      backgroundSize: `24px 24px`
    }}>
      <div className="h-12 bg-surface-container flex items-center justify-between px-6 border-b border-outline-variant shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-neon-blue">
            <span className="material-symbols-outlined text-[20px]">code</span>
            <span className="text-label-caps font-bold">SPICE NETLIST</span>
          </div>
          <div className="text-on-surface-variant text-[11px] font-label-caps bg-surface-container-highest px-2 py-0.5 border border-outline-variant">
            MNIST_CONV_LAYER_01.SP
          </div>
          <div className="text-on-surface-variant text-[10px] font-label-caps opacity-60">{lines.length} LINES</div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleCopy} className="flex items-center space-x-2 text-on-surface-variant hover:text-on-surface px-2 py-1 transition-colors">
            {copied ? (
              <>
                <span className="material-symbols-outlined text-[18px] text-success-green">done</span>
                <span className="text-label-caps text-success-green">COPIED</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                <span className="text-label-caps">COPY</span>
              </>
            )}
          </button>
          <button onClick={handleExport} className="flex items-center space-x-2 text-on-surface-variant hover:text-on-surface px-2 py-1 transition-colors">
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span className="text-label-caps">EXPORT</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto flex">
        <div className="w-12 bg-surface-container-lowest border-r border-outline-variant flex flex-col items-center py-4 text-on-surface-variant/30 text-[10px] font-code-sm select-none shrink-0" style={{ lineHeight: '24px' }}>
          {lines.map((_, i) => (
            <span key={i} className="block">{i + 1}</span>
          ))}
        </div>
        <div className="flex-1 p-4 font-code-sm text-code-sm text-emerald-300/80">
          <pre style={{ lineHeight: '24px', margin: 0 }}>{result.netlist}</pre>
        </div>
        <div className="w-16 bg-surface-container-lowest border-l border-outline-variant flex flex-col pt-2 relative shrink-0 hidden md:flex">
          <div className="absolute top-4 right-2 left-2 h-32 border border-neon-blue bg-neon-blue/10 pointer-events-none"></div>
          <div className="space-y-0.5 opacity-20 px-2 w-full flex flex-col items-center">
            {Array(30).fill(0).map((_, i) => (
               <div key={i} className={`h-1 w-full mb-[2px] ${i%3===0 ? 'bg-neon-blue' : i%5===0 ? 'bg-neon-purple' : 'bg-on-surface-variant'} ${i%4===0 ? 'w-4/5' : 'w-full'}`}></div>
            ))}
          </div>
        </div>
      </div>
      
      <footer className="h-10 bg-surface-container border-t border-outline-variant flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 text-success-green">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            <span className="text-label-caps">LVS VALID</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-on-surface-variant">
          <span className="text-label-caps">UTF-8</span>
          <span className="text-label-caps">SPICE</span>
        </div>
      </footer>
    </main>
  );
}
