import { useState, useEffect } from 'react';

/**
 * useSimulationMetrics — Live synthesis metrics bound to graph topology.
 * POSTs node_count/edge_count to the backend's synthesis engine.
 * Falls back to a deterministic local heuristic if backend is unreachable.
 *
 * Used by: SynthesisDashboard.jsx
 */
export function useSimulationMetrics(nodes, edges) {
  const [metrics, setMetrics] = useState({ area: "0.00", power: "0.00", latency: "0.00" });

  useEffect(() => {
    // Only attempt to fetch if we have an active graph
    if (!nodes || nodes.length === 0) return;

    const abortController = new AbortController();
    
    // Query the backend's synthesis engine with live node/edge counts
    fetch('http://localhost:8000/api/simulation/metrics', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        node_count: nodes.length, 
        edge_count: edges?.length || 0 
      }),
      signal: abortController.signal 
    })
      .then(res => {
        if (!res.ok) throw new Error('METRICS_FAULT');
        return res.json();
      })
      .then(json => {
        setMetrics({
          area: json.area || "0.00",
          power: json.power || "0.00",
          latency: json.latency || "0.00"
        });
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error("[METRICS_FAULT] Failed to fetch physical telemetry. Falling back to local heuristic.", err);
          
          // Deterministic fallback so the UI doesn't show 0.00 if backend is down
          const n = nodes?.length || 0;
          const e = edges?.length || 0;
          setMetrics({
            area: (n * 0.045 + e * 0.001).toFixed(2),
            power: (n * 1.2 + e * 0.08).toFixed(2),
            latency: (n * 0.5 + e * 0.02).toFixed(2)
          });
        }
      });

    return () => abortController.abort();
  }, [nodes?.length, edges?.length]); // Bind only to length to prevent fetch loop on node drags

  return metrics;
}
