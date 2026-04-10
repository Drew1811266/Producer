use crate::domain::project::{
    ActivateGraphRequest, Backend, BackendError, BindNodeAssetRequest, CreateGraphEdgeRequest,
    CreateGraphNodeRequest, CreateProjectRequest, DeleteGraphEdgeRequest,
    DeleteGraphNodeRequest, DeleteGraphNodeResult, GetGraphNodeDetailRequest,
    GetProjectMediaIndexSummaryRequest, GraphEdgeSummary, GraphNodeDetail, GraphNodeSummary,
    GraphNodeTypeOption, GraphNodeTypeOptionRequest, GraphRelationTypeOption,
    ListGraphEdgesRequest, ListGraphNodesRequest, ListGraphRelationTypeOptionsRequest,
    ListProjectAssetsRequest, OpenNodeChildGraphRequest, ProjectAssetSummary,
    ProjectMediaIndexSummary, ProjectPathRequest, ProjectSession,
    RefreshProjectMediaIndexRequest, TemplateSummary, UnbindNodeAssetRequest,
    UpdateGraphNodePayloadRequest, UpdateGraphNodePositionRequest,
};

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn list_available_templates() -> Result<Vec<TemplateSummary>, BackendError> {
    Backend::new()?.list_available_templates()
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn create_project(request: CreateProjectRequest) -> Result<ProjectSession, BackendError> {
    Backend::new()?.create_project(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn open_project(request: ProjectPathRequest) -> Result<ProjectSession, BackendError> {
    Backend::new()?.open_project(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn get_project_session(
    request: ProjectPathRequest,
) -> Result<Option<ProjectSession>, BackendError> {
    Backend::new()?.get_project_session(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn get_project_media_index_summary(
    request: GetProjectMediaIndexSummaryRequest,
) -> Result<ProjectMediaIndexSummary, BackendError> {
    Backend::new()?.get_project_media_index_summary(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn refresh_project_media_index(
    request: RefreshProjectMediaIndexRequest,
) -> Result<ProjectMediaIndexSummary, BackendError> {
    Backend::new()?.refresh_project_media_index(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn list_project_assets(
    request: ListProjectAssetsRequest,
) -> Result<Vec<ProjectAssetSummary>, BackendError> {
    Backend::new()?.list_project_assets(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn bind_node_asset(request: BindNodeAssetRequest) -> Result<GraphNodeDetail, BackendError> {
    Backend::new()?.bind_node_asset(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn unbind_node_asset(request: UnbindNodeAssetRequest) -> Result<GraphNodeDetail, BackendError> {
    Backend::new()?.unbind_node_asset(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn activate_graph(request: ActivateGraphRequest) -> Result<ProjectSession, BackendError> {
    Backend::new()?.activate_graph(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn open_node_child_graph(
    request: OpenNodeChildGraphRequest,
) -> Result<ProjectSession, BackendError> {
    Backend::new()?.open_node_child_graph(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn list_graph_nodes(
    request: ListGraphNodesRequest,
) -> Result<Vec<GraphNodeSummary>, BackendError> {
    Backend::new()?.list_graph_nodes(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn list_graph_node_type_options(
    request: GraphNodeTypeOptionRequest,
) -> Result<Vec<GraphNodeTypeOption>, BackendError> {
    Backend::new()?.list_graph_node_type_options(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn list_graph_edges(
    request: ListGraphEdgesRequest,
) -> Result<Vec<GraphEdgeSummary>, BackendError> {
    Backend::new()?.list_graph_edges(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn list_graph_relation_type_options(
    request: ListGraphRelationTypeOptionsRequest,
) -> Result<Vec<GraphRelationTypeOption>, BackendError> {
    Backend::new()?.list_graph_relation_type_options(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn create_graph_node(request: CreateGraphNodeRequest) -> Result<GraphNodeDetail, BackendError> {
    Backend::new()?.create_graph_node(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn create_graph_edge(
    request: CreateGraphEdgeRequest,
) -> Result<GraphEdgeSummary, BackendError> {
    Backend::new()?.create_graph_edge(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn get_graph_node_detail(
    request: GetGraphNodeDetailRequest,
) -> Result<GraphNodeDetail, BackendError> {
    Backend::new()?.get_graph_node_detail(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn update_graph_node_payload(
    request: UpdateGraphNodePayloadRequest,
) -> Result<GraphNodeDetail, BackendError> {
    Backend::new()?.update_graph_node_payload(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn update_graph_node_position(
    request: UpdateGraphNodePositionRequest,
) -> Result<GraphNodeSummary, BackendError> {
    Backend::new()?.update_graph_node_position(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn delete_graph_node(
    request: DeleteGraphNodeRequest,
) -> Result<DeleteGraphNodeResult, BackendError> {
    Backend::new()?.delete_graph_node(request)
}

#[cfg_attr(feature = "tauri-app", tauri::command)]
pub fn delete_graph_edge(request: DeleteGraphEdgeRequest) -> Result<(), BackendError> {
    Backend::new()?.delete_graph_edge(request)
}
