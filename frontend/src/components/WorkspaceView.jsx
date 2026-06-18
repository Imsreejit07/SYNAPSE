export default function WorkspaceView({ result, metrics, setActiveTab }) {
  return (
    <section className="flex-1 relative overflow-hidden flex flex-col bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#0f172a_0%,_transparent_100%)] opacity-30 pointer-events-none"></div>
      
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-slate-950/60 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-neon-blue text-sm">folder_open</span>
          <span className="font-headline-md text-label-caps text-xs tracking-wider">PROJECT WORKSPACE</span>
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <div className="relative mb-6 pointer-events-none">
          <div className="absolute inset-0 bg-neon-blue opacity-5 blur-2xl rounded-full"></div>
          <span className="material-symbols-outlined text-on-surface-variant opacity-20 text-[84px]">{result ? 'memory' : 'hub'}</span>
        </div>
        
        {result ? (
           <div className="flex flex-col items-center">
             <h2 className="text-2xl font-headline-md text-on-surface mb-2">Project Alpha Active</h2>
             <p className="text-on-surface-variant font-label-caps text-xs tracking-widest text-center mb-8 uppercase">
               Silicon compilation successful
             </p>
             <div className="flex gap-4 mb-8">
                <div className="bg-surface-container-low p-6 border border-slate-800 rounded-sm flex flex-col items-center min-w-[140px]">
                  <span className="text-neon-blue font-headline-lg text-3xl">{metrics?.totalNodes || 0}</span>
                  <span className="text-[10px] font-label-caps text-on-surface-variant mt-2">IR NODES</span>
                </div>
                <div className="bg-surface-container-low p-6 border border-slate-800 rounded-sm flex flex-col items-center min-w-[140px]">
                  <span className="text-neon-purple font-headline-lg text-3xl">{metrics?.totalEdges || 0}</span>
                  <span className="text-[10px] font-label-caps text-on-surface-variant mt-2">IR EDGES</span>
                </div>
             </div>
             <button 
               onClick={() => setActiveTab('hardware')}
               className="bg-neon-blue text-black font-label-caps text-xs px-6 py-3 hover:brightness-110 transition-all flex items-center gap-2"
             >
               VIEW TOPOLOGY <span className="material-symbols-outlined text-sm">chevron_right</span>
             </button>
           </div>
        ) : (
          <p className="text-on-surface-variant opacity-40 font-label-caps text-label-caps tracking-widest max-w-xs text-center leading-relaxed pointer-events-none">
              Select files in the sidebar and compile to initialize your workspace.
          </p>
        )}
      </div>
    </section>
  );
}
