export default function ProfileView() {
  return (
    <main className="flex-1 overflow-auto bg-slate-950 p-8 font-body-md text-on-surface">
      <div className="max-w-3xl mx-auto">
        <header className="mb-10 flex items-center gap-6 border-b border-outline-variant pb-8">
          <div className="w-20 h-20 bg-primary-container border border-neon-blue flex items-center justify-center">
            <span className="material-symbols-outlined text-neon-blue text-4xl">account_circle</span>
          </div>
          <div>
            <h1 className="text-3xl font-headline-lg font-bold text-on-surface">Sreejit07</h1>
            <p className="text-on-surface-variant font-label-caps text-sm mt-1 tracking-widest text-neon-blue">LEAD ARCHITECT</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-container p-6 border border-outline-variant">
            <div className="text-on-surface-variant font-label-caps text-[10px] mb-4">LICENSE STATUS</div>
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-success-green">verified</span>
              <span className="font-bold text-lg text-success-green">Enterprise Active</span>
            </div>
            <div className="text-xs text-on-surface-variant">Valid until Dec 2026</div>
          </div>
          
          <div className="bg-surface-container p-6 border border-outline-variant">
            <div className="text-on-surface-variant font-label-caps text-[10px] mb-4">CLOUD COMPUTE CREDITS</div>
            <div className="text-3xl font-code-sm text-neon-purple mb-2">84,200</div>
            <div className="w-full h-1 bg-surface-variant overflow-hidden">
              <div className="w-[60%] h-full bg-neon-purple"></div>
            </div>
          </div>
        </div>

        <div className="bg-surface-container border border-outline-variant">
          <div className="p-4 border-b border-outline-variant font-label-caps text-xs text-on-surface-variant">RECENT PROJECTS</div>
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-neon-blue text-sm">memory</span>
                <span>Project Alpha (MNIST)</span>
              </div>
              <span className="text-on-surface-variant font-code-sm text-xs">Edited 2 hrs ago</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-sm">memory</span>
                <span>VGG-16 Analog Map</span>
              </div>
              <span className="text-on-surface-variant font-code-sm text-xs">Edited 3 days ago</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
