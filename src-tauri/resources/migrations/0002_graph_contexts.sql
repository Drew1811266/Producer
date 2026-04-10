CREATE UNIQUE INDEX IF NOT EXISTS idx_graphs_source_node_unique
ON graphs(source_node_id)
WHERE source_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_graphs_parent_graph_id
ON graphs(parent_graph_id);

CREATE INDEX IF NOT EXISTS idx_nodes_graph_is_system
ON nodes(graph_id, is_system);
