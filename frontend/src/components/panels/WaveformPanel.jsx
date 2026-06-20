import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

export default function WaveformPanel({ data, nodeLabel, loading, error, isMinimized, setIsMinimized }) {
  // If there's no data and no error and not loading, don't show the oscilloscope
  if (!data?.length && !error && !loading) return null;

  return (
    <div 
      key={JSON.stringify(data)}
      className={`absolute bottom-4 left-4 right-4 bg-slate-950/90 backdrop-blur-md border border-cyan-500/30 rounded-lg shadow-2xl z-30 transition-all duration-300 ${isMinimized ? 'h-12' : 'h-48'} overflow-hidden flex flex-col`}
    >
      <div className="flex justify-between items-center p-3 border-b border-slate-800 shrink-0">
        <h3 className="text-cyan-400 font-mono text-xs font-bold tracking-widest flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">monitor_heart</span>
          OSCILLOSCOPE_OUTPUT_V_T {nodeLabel ? `[${nodeLabel}]` : ''}
        </h3>
        <button 
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-slate-400 hover:text-white transition-colors flex items-center justify-center w-6 h-6 rounded hover:bg-slate-800"
          title={isMinimized ? "Maximize" : "Minimize"}
        >
          <span className="material-symbols-outlined text-sm">
            {isMinimized ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      </div>
      
      {!isMinimized && (
        <div className="p-4 relative flex-1 w-full min-h-0">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 z-10">
              <span className="material-symbols-outlined animate-spin text-cyan-500">autorenew</span>
              <span className="ml-2 font-mono text-xs text-cyan-500 tracking-widest">FETCHING_TELEMETRY...</span>
            </div>
          )}
          
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/20 z-10 border border-red-500/30 rounded-md">
              <span className="material-symbols-outlined text-red-500 text-2xl mb-1">warning</span>
              <span className="font-mono text-xs text-red-400 font-bold tracking-widest">SIMULATION_FAULT</span>
              <span className="font-mono text-[9px] text-slate-400 mt-1">Backend engine failed to return vector data</span>
            </div>
          )}

          {!error && !loading && data?.length > 0 && (
            <ResponsiveContainer width="100%" height="100%" minHeight={140} minWidth={100}>
              <LineChart data={data}>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}
                itemStyle={{ color: '#06b6d4' }}
              />
              <Line 
                type="monotone" 
                dataKey="voltage" 
                stroke="#06b6d4" 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
