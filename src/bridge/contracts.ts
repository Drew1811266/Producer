export type ProjectTemplate = {
  id: string;
  name: string;
  description?: string;
  recommended?: boolean;
  version?: number;
  layerTypes?: string[];
};

export type ProjectSessionHandle = {
  sessionId: string;
};

export type ProjectSessionLookup = {
  sessionId?: string;
  projectRoot?: string;
};

export type CreateProjectRequest = {
  templateId: string;
  projectName?: string;
  projectRoot?: string;
};

export type ProjectGraphSummary = {
  id: string;
  layerType: string;
  name: string;
  isRoot: boolean;
};

export type GraphContextTrailItem = {
  graphId: string;
  graphName: string;
  layerType: string;
  sourceNodeId?: string;
  sourceNodeTitle?: string;
};

export type GraphNodeLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GraphNodeSummary = {
  id: string;
  graphId: string;
  title: string;
  nodeType: string;
  sourceNodeType?: string;
  storedAssetCount: number;
  status?: string;
  isSystem?: boolean;
  canEnterChildGraph?: boolean;
  layout: GraphNodeLayout;
};

export type GraphNodeDetail = GraphNodeSummary & {
  assetBindings: GraphNodeAssetBinding[];
  assetRoleOptions: NodeAssetRoleOption[];
  payload: Record<string, unknown>;
};

export type NodeAssetRole =
  | 'source'
  | 'reference'
  | 'preview'
  | 'output'
  | 'product_image'
  | 'example_video';

export type NodeAssetRoleOption = {
  role: NodeAssetRole;
  label: string;
  description?: string;
};

export type GraphNodeAssetBinding = {
  assetId: string;
  role: NodeAssetRole;
  asset: ProjectAssetSummary;
};

export type GraphNodeTypeOptionSize = {
  width: number;
  height: number;
};

export type GraphNodeTypeOption = {
  nodeType: string;
  label: string;
  description?: string;
  defaultTitle: string;
  defaultSize: GraphNodeTypeOptionSize;
};

export type GraphNodePosition = {
  x: number;
  y: number;
};

export type ListGraphNodesRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
};

export type ListGraphNodeTypeOptionsRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
};

export type GetGraphNodeDetailRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
  nodeId: string;
};

export type CreateGraphNodeRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
  nodeType: string;
  position: GraphNodePosition;
  payload: Record<string, unknown>;
};

export type UpdateGraphNodePayloadRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
  nodeId: string;
  payload: Record<string, unknown>;
};

export type UpdateGraphNodePositionRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
  nodeId: string;
  position: GraphNodePosition;
};

export type DeleteGraphNodeRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
  nodeId: string;
};

export type DeleteGraphNodeResult = {
  graphId: string;
  nodeId: string;
  deletedGraphIds: string[];
};

export type ActivateGraphRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
};

export type BindNodeAssetRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
  nodeId: string;
  assetId: string;
  role: NodeAssetRole;
};

export type UnbindNodeAssetRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
  nodeId: string;
  assetId: string;
  role: NodeAssetRole;
};

export type GraphEdgeSummary = {
  id: string;
  graphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
};

export type GraphRelationTypeOption = {
  edgeType: string;
  label: string;
  description?: string;
};

export type ListGraphEdgesRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
};

export type ListGraphRelationTypeOptionsRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
};

export type CreateGraphEdgeRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
};

export type DeleteGraphEdgeRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
  edgeId: string;
};

export type OpenNodeChildGraphRequest = {
  sessionId?: string;
  projectRoot?: string;
  graphId: string;
  nodeId: string;
};

export type RefreshProjectMediaIndexRequest = ProjectSessionLookup & {
  reason?: 'startup' | 'manual';
};

export type ProjectMediaIndexSummary = {
  assetCount: number;
  imageCount: number;
  videoCount: number;
  audioCount: number;
  documentCount: number;
  otherCount?: number;
  readyThumbnailCount: number;
  missingThumbnailCount?: number;
  unsupportedThumbnailCount?: number;
  pendingJobCount: number;
  failedJobCount: number;
  lastIndexedAt?: string;
};

export type ProjectAssetThumbnailStatus =
  | 'ready'
  | 'pending'
  | 'error'
  | 'missing'
  | 'unsupported'
  | 'none';

export type ProjectAssetSummary = {
  id: string;
  relativePath: string;
  filePath?: string;
  mediaType: 'image' | 'video' | 'audio' | 'document' | string;
  mimeType?: string;
  byteSize?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  thumbnailPath?: string;
  thumbnailStatus?: ProjectAssetThumbnailStatus;
  indexedAt?: string;
  missing?: boolean;
};

export type ListProjectAssetsRequest = ProjectSessionLookup & {
  mediaType?: ProjectAssetSummary['mediaType'];
  limit?: number;
  query?: string;
};

export type ProjectSession = {
  sessionId: string;
  projectId: string;
  projectName: string;
  projectPath: string;
  templateId?: string;
  templateVersion?: number;
  activeGraph: ProjectGraphSummary;
  availableGraphs: ProjectGraphSummary[];
  graphTrail: GraphContextTrailItem[];
  graphCount?: number;
  assetCount?: number;
};

export interface ProducerBridge {
  list_available_templates(): Promise<ProjectTemplate[]>;
  create_project(payload: CreateProjectRequest): Promise<ProjectSessionHandle>;
  open_project(): Promise<ProjectSessionHandle>;
  get_project_session(payload?: ProjectSessionLookup): Promise<ProjectSession | null>;
  activate_graph(payload: ActivateGraphRequest): Promise<ProjectSession>;
  open_node_child_graph(payload: OpenNodeChildGraphRequest): Promise<ProjectSession>;
  list_graph_nodes(payload: ListGraphNodesRequest): Promise<GraphNodeSummary[]>;
  list_graph_node_type_options(payload: ListGraphNodeTypeOptionsRequest): Promise<GraphNodeTypeOption[]>;
  get_graph_node_detail(payload: GetGraphNodeDetailRequest): Promise<GraphNodeDetail>;
  create_graph_node(payload: CreateGraphNodeRequest): Promise<GraphNodeDetail>;
  update_graph_node_payload(payload: UpdateGraphNodePayloadRequest): Promise<GraphNodeDetail>;
  update_graph_node_position(payload: UpdateGraphNodePositionRequest): Promise<GraphNodeSummary>;
  delete_graph_node(payload: DeleteGraphNodeRequest): Promise<DeleteGraphNodeResult>;
  bind_node_asset(payload: BindNodeAssetRequest): Promise<GraphNodeDetail>;
  unbind_node_asset(payload: UnbindNodeAssetRequest): Promise<GraphNodeDetail>;
  list_graph_edges(payload: ListGraphEdgesRequest): Promise<GraphEdgeSummary[]>;
  list_graph_relation_type_options(
    payload: ListGraphRelationTypeOptionsRequest,
  ): Promise<GraphRelationTypeOption[]>;
  create_graph_edge(payload: CreateGraphEdgeRequest): Promise<GraphEdgeSummary>;
  delete_graph_edge(payload: DeleteGraphEdgeRequest): Promise<void>;
  get_project_media_index_summary(payload?: ProjectSessionLookup): Promise<ProjectMediaIndexSummary>;
  refresh_project_media_index(payload?: RefreshProjectMediaIndexRequest): Promise<ProjectMediaIndexSummary>;
  list_project_assets(payload?: ListProjectAssetsRequest): Promise<ProjectAssetSummary[]>;
}
