import json

def generate_dense_json(node_count=100, edge_probability=0.2):
    nodes = []
    edges = []
    
    # Generate layers
    layers = [20, 50, 20, 10]
    
    node_id_counter = 0
    layer_nodes = []
    
    for layer_idx, count in enumerate(layers):
        current_layer = []
        for i in range(count):
            node_id = f"N_L{layer_idx}_{i}"
            current_layer.append(node_id)
            
            node_type = 'transistor'
            if layer_idx == 0: node_type = 'input'
            elif layer_idx == len(layers) - 1: node_type = 'output'
            else: node_type = 'memristor'
            
            nodes.append({
                "id": node_id,
                "type": node_type,
                "position": {"x": 0, "y": 0}, # Layout engine will fix this
                "data": {"label": f"Node {node_id}", "layer": layer_idx}
            })
        layer_nodes.append(current_layer)
        
    # Generate massive fully-connected bipartite edges between layers
    edge_counter = 0
    for l in range(len(layer_nodes) - 1):
        source_layer = layer_nodes[l]
        target_layer = layer_nodes[l+1]
        
        for src in source_layer:
            for tgt in target_layer:
                edges.append({
                    "id": f"E_{edge_counter}",
                    "source": src,
                    "target": tgt,
                    "type": "smoothstep"
                })
                edge_counter += 1
                
    return {"nodes": nodes, "edges": edges}

if __name__ == "__main__":
    dense_graph = generate_dense_json()
    with open("test_massive_graph.json", "w") as f:
        json.dump(dense_graph, f, indent=2)
        
    # A smaller one
    small_graph = {
        "nodes": [
            {"id": "IN1", "type": "input", "position": {"x":0, "y":0}, "data": {"label": "Input 1"}},
            {"id": "IN2", "type": "input", "position": {"x":0, "y":0}, "data": {"label": "Input 2"}},
            {"id": "MEM1", "type": "memristor", "position": {"x":0, "y":0}, "data": {"label": "Memristor"}},
            {"id": "OUT1", "type": "output", "position": {"x":0, "y":0}, "data": {"label": "Output 1"}}
        ],
        "edges": [
            {"id": "e1", "source": "IN1", "target": "MEM1"},
            {"id": "e2", "source": "IN2", "target": "MEM1"},
            {"id": "e3", "source": "MEM1", "target": "OUT1"}
        ]
    }
    
    with open("test_small_graph.json", "w") as f:
        json.dump(small_graph, f, indent=2)
        
    print(f"Generated test_massive_graph.json ({len(dense_graph['edges'])} edges)")
    print("Generated test_small_graph.json (3 edges)")
