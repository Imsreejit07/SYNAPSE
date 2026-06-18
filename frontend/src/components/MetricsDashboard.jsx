import EmptyState from './EmptyState';

export default function MetricsDashboard({ metrics, result }) {
  if (!metrics || !result) return <EmptyState icon="insights" title="Awaiting Data" message="Compile the model to view detailed circuit performance metrics." />;

  return (
    <main className="flex-1 flex flex-col relative overflow-auto bg-deep-black">
      <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto w-full flex flex-col gap-8">
        
        {/* Top Header */}
        <div className="flex items-center gap-4 border-b border-outline-variant pb-4">
          <span className="material-symbols-outlined text-neon-blue text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>developer_board</span>
          <div>
            <h1 className="text-headline-lg font-headline-lg text-on-surface">Circuit Performance Terminal</h1>
            <p className="text-on-surface-variant text-xs font-label-caps mt-1">ANALYTICS & VALIDATION SUITE</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Circuit Metrics */}
          <section className="space-y-4">
            <h2 className="text-headline-md font-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-neon-blue">analytics</span> System Metrics
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container p-6 border border-outline-variant hover:border-neon-blue transition-colors group">
                <div className="flex justify-between mb-2">
                  <span className="material-symbols-outlined text-neon-blue">database</span>
                  <span className="text-[10px] font-label-caps text-on-surface-variant">IR NODES</span>
                </div>
                <div className="text-3xl font-headline-md text-neon-blue">{metrics.totalNodes.toLocaleString()}</div>
              </div>
              <div className="bg-surface-container p-6 border border-outline-variant hover:border-neon-purple transition-colors">
                <div className="flex justify-between mb-2">
                  <span className="material-symbols-outlined text-neon-purple">hub</span>
                  <span className="text-[10px] font-label-caps text-on-surface-variant">IR EDGES</span>
                </div>
                <div className="text-3xl font-headline-md text-neon-purple">{metrics.totalEdges.toLocaleString()}</div>
              </div>
              <div className="bg-surface-container p-6 border border-outline-variant hover:border-neon-pink transition-colors">
                <div className="flex justify-between mb-2">
                  <span className="material-symbols-outlined text-neon-pink">bolt</span>
                  <span className="text-[10px] font-label-caps text-on-surface-variant">CONDUCTANCES</span>
                </div>
                <div className="text-3xl font-headline-md text-on-surface">{metrics.conductances.toLocaleString()}</div>
              </div>
              <div className="bg-surface-container p-6 border border-outline-variant hover:border-warning-yellow transition-colors">
                <div className="flex justify-between mb-2">
                  <span className="material-symbols-outlined text-warning-yellow">waves</span>
                  <span className="text-[10px] font-label-caps text-on-surface-variant">TIA STAGES</span>
                </div>
                <div className="text-3xl font-headline-md text-neon-pink">{metrics.tias.toLocaleString()}</div>
              </div>
            </div>
            
            <div className="bg-primary-container p-4 border border-neon-blue/20 mt-4">
              <div className="text-[10px] font-label-caps text-on-primary-container mb-2">ANALOG ARCHITECTURE</div>
              <div className="text-sm font-code-sm leading-relaxed">
                <span className="text-neon-blue">{metrics.inputCount}</span> Voltage Rails → <span className="text-warning-yellow">{metrics.hiddenCount}</span> Rectifiers → <span className="text-neon-pink">{metrics.outputCount}</span> Classifiers
              </div>
            </div>
          </section>

          {/* Validation */}
          <section className="space-y-4">
            <h2 className="text-headline-md font-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-success-green">verified</span> Validation Result
            </h2>
            
            {result.validation && (
              <>
                <div className={`p-6 border flex items-start gap-4 ${result.validation.passed ? 'bg-success-green/10 border-success-green/30' : 'bg-danger-red/10 border-danger-red/30'}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${result.validation.passed ? 'bg-success-green/20' : 'bg-danger-red/20'}`}>
                    <span className={`material-symbols-outlined text-3xl ${result.validation.passed ? 'text-success-green' : 'text-danger-red'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      {result.validation.passed ? 'check_circle' : 'cancel'}
                    </span>
                  </div>
                  <div>
                    <div className={`text-xl font-bold ${result.validation.passed ? 'text-success-green' : 'text-danger-red'}`}>
                      {result.validation.passed ? "Compilation Passed" : "Compilation Failed"}
                    </div>
                    <div className="text-sm text-on-surface-variant mt-1">
                      {result.validation.passed ? "Analog ReLU synthesis verified against PyTorch target." : "Analog mapping diverged from expected values."}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-surface-container p-6 border border-outline-variant">
                    <div className="text-[10px] font-label-caps text-on-surface-variant mb-2">MAX ABS ERROR</div>
                    <div className="text-2xl font-code-sm text-neon-blue">{result.validation.max_abs_error.toExponential(2)}</div>
                  </div>
                  <div className="bg-surface-container p-6 border border-outline-variant">
                    <div className="text-[10px] font-label-caps text-on-surface-variant mb-2">MAX REL ERROR</div>
                    <div className="text-2xl font-code-sm text-neon-purple">{result.validation.max_rel_error.toExponential(2)}</div>
                  </div>
                </div>

                {result.validation.per_output && (
                  <div className="bg-surface-container p-4 border border-outline-variant mt-4">
                    <div className="text-[10px] font-label-caps text-on-surface-variant mb-3 border-b border-outline-variant pb-2">OUTPUT VECTOR VALIDATION</div>
                    <div className="font-code-sm text-xs space-y-2 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                      {result.validation.per_output.map((entry, i) => (
                        <div key={i} className={`flex justify-between items-center ${entry.pass ? 'text-success-green/80' : 'text-danger-red/80'}`}>
                          <span>[{entry.pass ? '✓' : '✗'}] TV{entry.test_vector_index}[{entry.output_index}]</span>
                          <span className="text-on-surface-variant/60">err: {entry.abs_error.toExponential(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
