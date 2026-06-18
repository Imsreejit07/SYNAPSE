import { useState, useEffect } from 'react';

export default function SystemStatusView() {
  const [status, setStatus] = useState(null);
  const [isOffline, setIsOffline] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('http://localhost:8000/status');
        if (!res.ok) throw new Error("Network error");
        const data = await res.json();
        setStatus(data);
        setIsOffline(false);
      } catch (e) {
        setIsOffline(true);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <main className="flex-1 overflow-auto bg-slate-950 p-8 font-body-md text-on-surface flex flex-col">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
        <header className="mb-8 border-b border-outline-variant pb-4 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`material-symbols-outlined text-3xl ${isOffline ? 'text-danger-red' : 'text-success-green'}`}>lan</span>
              <h1 className="text-headline-lg font-headline-lg font-bold text-on-surface">System Status</h1>
            </div>
            <p className="text-on-surface-variant font-label-caps text-xs">LOCAL DAEMON & RUNTIME TELEMETRY</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 font-label-caps text-xs ${isOffline ? 'bg-danger-red/10 border border-danger-red/30 text-danger-red' : 'bg-success-green/10 border border-success-green/30 text-success-green animate-pulse'}`}>
            <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-danger-red' : 'bg-success-green'}`}></div> 
            {isOffline ? 'OFFLINE - ENGINE DISCONNECTED' : 'SYNAPSE ENGINE: ONLINE'}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-surface-container p-6 border border-outline-variant hover:border-success-green/50 transition-colors">
            <div className="text-on-surface-variant font-label-caps text-[10px] mb-2">UPTIME</div>
            <div className="text-3xl font-code-sm text-success-green">{status ? formatUptime(status.uptime) : '--'}</div>
          </div>
          <div className="bg-surface-container p-6 border border-outline-variant hover:border-neon-blue/50 transition-colors">
            <div className="text-on-surface-variant font-label-caps text-[10px] mb-2">MEMORY USAGE</div>
            <div className="text-3xl font-code-sm text-neon-blue">{status ? status.memory_usage : '--'}</div>
          </div>
          <div className="bg-surface-container p-6 border border-outline-variant hover:border-neon-purple/50 transition-colors">
            <div className="text-on-surface-variant font-label-caps text-[10px] mb-2">CPU LOAD</div>
            <div className="text-3xl font-code-sm text-neon-purple">{status ? `${status.cpu_load}%` : '--'}</div>
          </div>
        </div>

        <div className="flex-1 bg-deep-black border border-outline-variant flex flex-col min-h-[300px]">
          <div className="bg-surface-container px-4 py-2 border-b border-outline-variant flex items-center justify-between">
            <span className="text-xs font-label-caps text-on-surface-variant">DAEMON_LOG</span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">terminal</span>
          </div>
          <div className="p-4 font-code-sm text-xs text-on-surface-variant space-y-1 overflow-y-auto">
            <div><span className="text-success-green mr-2">[OK]</span> 2026-06-17 19:42:01 - Engine initialized.</div>
            <div><span className="text-success-green mr-2">[OK]</span> 2026-06-17 19:42:03 - Connected to local CUDA runtime.</div>
            <div><span className="text-neon-blue mr-2">[INFO]</span> 2026-06-17 19:45:12 - Parsing model topology...</div>
            <div><span className="text-success-green mr-2">[OK]</span> 2026-06-17 19:45:14 - Synthesis complete.</div>
            {status && <div><span className="text-neon-blue mr-2">[INFO]</span> Polling system telemetry from fastAPI /status route.</div>}
            {isOffline && <div><span className="text-danger-red mr-2">[ERR]</span> Connection to Python backend lost!</div>}
            <div className="animate-pulse">_</div>
          </div>
        </div>
      </div>
    </main>
  );
}
