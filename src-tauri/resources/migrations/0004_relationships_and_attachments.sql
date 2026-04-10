CREATE INDEX IF NOT EXISTS idx_edges_graph_id
  ON edges(graph_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_graph_relation_unique
  ON edges(graph_id, source_node_id, target_node_id, edge_type);

CREATE INDEX IF NOT EXISTS idx_node_assets_asset_id
  ON node_assets(asset_id);
