import dagre from 'dagre';

self.onmessage = function(e) {
  const { nodes, edges, direction } = e.data;
  
  const dagreGraph = new dagre.graphlib.Graph({ compound: true });
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: direction,
    ranksep: 400,
    nodesep: 80
  });

  const nodeWidth = 200; 
  const nodeHeight = 80;
  const isHorizontal = direction === 'LR';

  const nodeIds = new Set(nodes.map(n => n.id));

  nodes.forEach((node) => {
    // If it's a group, we don't set fixed dimensions; Dagre calculates it based on children
    if (node.type === 'group') {
      dagreGraph.setNode(node.id, { label: node.id });
    } else {
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    }
  });

  // Set parent-child relationships after all nodes are added
  nodes.forEach((node) => {
    if (node.parentNode) {
      dagreGraph.setParent(node.id, node.parentNode);
    }
  });

  edges.forEach((edge) => {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  try {
    dagre.layout(dagreGraph);
  } catch (err) {
    self.postMessage({ error: err.message, nodes, edges });
    return;
  }

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;

    // Apply padding and dimensions to container nodes
    if (node.type === 'group') {
      node.style = {
        ...(node.style || {}),
        width: nodeWithPosition.width + 100, // Add padding
        height: nodeWithPosition.height + 100,
      };
      
      node.position = {
        x: nodeWithPosition.x - nodeWithPosition.width / 2 - 50,
        y: nodeWithPosition.y - nodeWithPosition.height / 2 - 50,
      };
    } else {
      node.targetPosition = isHorizontal ? 'left' : 'top';
      node.sourcePosition = isHorizontal ? 'right' : 'bottom';
      
      // If node has a parent, ReactFlow expects its position to be relative to the parent.
      // Dagre provides absolute coordinates, so we must subtract the parent's absolute origin.
      if (node.parentNode) {
        const parentNode = dagreGraph.node(node.parentNode);
        const parentOriginX = parentNode.x - parentNode.width / 2;
        const parentOriginY = parentNode.y - parentNode.height / 2;
        
        // Dagre computes node coordinates from their center, ReactFlow wants top-left
        node.position = {
          x: (nodeWithPosition.x - nodeWidth / 2) - parentOriginX + 50, // 50 is the padding offset from the group
          y: (nodeWithPosition.y - nodeHeight / 2) - parentOriginY + 50,
        };
      } else {
        node.position = {
          x: nodeWithPosition.x - nodeWidth / 2,
          y: nodeWithPosition.y - nodeHeight / 2,
        };
      }
    }

    return node;
  });

  self.postMessage({ nodes: layoutedNodes, edges });
};
