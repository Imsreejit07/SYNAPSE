export default function EmptyState({ icon = "memory", title = "Awaiting Compilation", message = "Upload model and test vectors to synthesize analog circuit." }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20 bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#0f172a_0%,_transparent_100%)] opacity-30 pointer-events-none"></div>
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-neon-blue opacity-5 blur-2xl rounded-full"></div>
        <span className="material-symbols-outlined text-on-surface-variant opacity-20 text-[84px]">{icon}</span>
      </div>
      <h2 className="text-on-surface font-headline-md tracking-wider mb-2">{title}</h2>
      <p className="text-on-surface-variant opacity-40 font-label-caps text-label-caps tracking-widest max-w-xs text-center leading-relaxed">
          {message}
      </p>
    </div>
  );
}
