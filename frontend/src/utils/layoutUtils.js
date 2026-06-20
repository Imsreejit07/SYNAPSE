import dagre from 'dagre';

// 150 and 50 are fallback width/heights. Adjust based on our custom node sizes.
const nodeWidth = 200; 
const nodeHeight = 80;

export const getLayoutedElementsAsync = (nodes, edges, direction = 'LR') => {
  return new Promise((resolve) => {
    // If the graph is insanely massive, Dagre will take infinite time and lock the thread/worker.
    // Bypass auto-layout and fall back to the naive mathematical column layout.
    if (edges.length > 10000 || nodes.length > 2000) {
      console.warn(`Graph too large for Dagre (${nodes.length} nodes, ${edges.length} edges). Bypassing auto-layout.`);
      return resolve({ nodes, edges });
    }

    try {
      const worker = new Worker(new URL('../workers/layoutWorker.js', import.meta.url), { type: 'module' });
      
      const timeoutId = setTimeout(() => {
        console.error("Dagre Layout Timeout: Worker took too long. Force-killing and falling back to naive layout.");
        worker.terminate();
        resolve({ nodes, edges });
      }, 15000);

      worker.onmessage = (e) => {
        clearTimeout(timeoutId);
        if (e.data.error) {
          console.warn("Worker layout failed, using raw nodes:", e.data.error);
        }
        resolve({ nodes: e.data.nodes, edges: e.data.edges });
        worker.terminate();
      };

      worker.onerror = (err) => {
        clearTimeout(timeoutId);
        console.error("Worker fatal error:", err);
        resolve({ nodes, edges });
        worker.terminate();
      };

      worker.postMessage({ nodes, edges, direction });
    } catch (err) {
      console.error("Failed to spawn layout worker:", err);
      resolve({ nodes, edges });
    }
  });
};
