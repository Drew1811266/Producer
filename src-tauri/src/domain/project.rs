use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{LazyLock, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use thiserror::Error;
use uuid::Uuid;

use crate::domain::{
    media,
    pathing::ProjectPaths,
    storage::{
        AssetListItemRecord, GraphEdgeRecord, GraphNodeRecord, MediaIndexSummaryRecord,
        NodeAssetBindingListItemRecord, ProjectMetaRecord, Storage, StoredGraphRecord,
    },
    template::TemplateRegistry,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TemplateSummary {
    pub id: String,
    pub version: u32,
    pub name: String,
    pub description: String,
    pub recommended: bool,
    pub layer_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphSummary {
    pub id: String,
    pub layer_type: String,
    pub name: String,
    pub is_root: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphContextTrailItem {
    pub graph_id: String,
    pub graph_name: String,
    pub layer_type: String,
    pub source_node_id: Option<String>,
    pub source_node_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPathSummary {
    pub root: String,
    pub producer_dir: String,
    pub database_path: String,
    pub settings_path: String,
    pub assets_dir: String,
    pub exports_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSession {
    pub session_id: String,
    pub project_id: String,
    pub project_name: String,
    pub project_path: String,
    pub template_id: String,
    pub template_version: u32,
    pub root_graph: GraphSummary,
    pub active_graph: GraphSummary,
    pub available_graphs: Vec<GraphSummary>,
    pub graph_trail: Vec<GraphContextTrailItem>,
    pub graph_count: u32,
    pub asset_count: u32,
    pub paths: ProjectPathSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMediaIndexSummary {
    pub asset_count: u32,
    pub image_count: u32,
    pub video_count: u32,
    pub audio_count: u32,
    pub document_count: u32,
    pub other_count: u32,
    pub ready_thumbnail_count: u32,
    pub missing_thumbnail_count: u32,
    pub unsupported_thumbnail_count: u32,
    pub pending_job_count: u32,
    pub failed_job_count: u32,
    pub last_indexed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAssetSummary {
    pub id: String,
    pub relative_path: String,
    pub media_type: String,
    pub mime_type: Option<String>,
    pub byte_size: Option<u64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_ms: Option<u64>,
    pub thumbnail_status: String,
    pub thumbnail_path: Option<String>,
    pub indexed_at: Option<String>,
    pub missing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodeAssetBinding {
    pub asset_id: String,
    pub role: String,
    pub asset: ProjectAssetSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodeAssetRoleOption {
    pub role: String,
    pub label: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdgeSummary {
    pub id: String,
    pub graph_id: String,
    pub source_node_id: String,
    pub target_node_id: String,
    pub edge_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphRelationTypeOption {
    pub edge_type: String,
    pub label: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub project_root: Option<String>,
    pub project_name: Option<String>,
    pub template_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPathRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GetProjectMediaIndexSummaryRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RefreshProjectMediaIndexRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListProjectAssetsRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub media_type: Option<String>,
    pub query: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BindNodeAssetRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
    pub node_id: String,
    pub asset_id: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UnbindNodeAssetRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
    pub node_id: String,
    pub asset_id: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListGraphEdgesRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListGraphRelationTypeOptionsRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateGraphEdgeRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
    pub source_node_id: String,
    pub target_node_id: String,
    pub edge_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteGraphEdgeRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
    pub edge_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActivateGraphRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenNodeChildGraphRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListGraphNodesRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CreateGraphNodeRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
    pub node_type: String,
    pub position: GraphNodePosition,
    pub payload: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodeTypeOptionRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodeTypeOptionSize {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodeTypeOption {
    pub node_type: String,
    pub label: String,
    pub description: Option<String>,
    pub default_title: String,
    pub default_size: GraphNodeTypeOptionSize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodeLayout {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodeSummary {
    pub id: String,
    pub graph_id: String,
    pub node_type: String,
    pub source_node_type: Option<String>,
    pub is_system: bool,
    pub can_enter_child_graph: bool,
    pub stored_asset_count: u32,
    pub title: String,
    pub status: Option<String>,
    pub layout: GraphNodeLayout,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GetGraphNodeDetailRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGraphNodePayloadRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
    pub node_id: String,
    pub payload: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGraphNodePositionRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
    pub node_id: String,
    pub position: GraphNodePosition,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteGraphNodeRequest {
    pub project_root: Option<String>,
    pub session_id: Option<String>,
    pub graph_id: String,
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteGraphNodeResult {
    pub graph_id: String,
    pub node_id: String,
    pub deleted_graph_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodeDetail {
    pub id: String,
    pub graph_id: String,
    pub node_type: String,
    pub source_node_type: Option<String>,
    pub is_system: bool,
    pub can_enter_child_graph: bool,
    pub stored_asset_count: u32,
    pub title: String,
    pub status: Option<String>,
    pub layout: GraphNodeLayout,
    pub payload: serde_json::Map<String, Value>,
    pub asset_bindings: Vec<GraphNodeAssetBinding>,
    pub asset_role_options: Vec<GraphNodeAssetRoleOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Error, PartialEq, Eq)]
#[error("{code}: {message}")]
pub struct BackendError {
    pub code: String,
    pub message: String,
}

impl BackendError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct ProjectSettings {
    schema_version: u32,
    template_id: String,
    template_version: u32,
    project_id: String,
    project_name: String,
}

#[derive(Debug, Default)]
struct SessionStore {
    active_session_id: Option<String>,
    sessions: HashMap<String, ProjectSession>,
}

static SESSION_STORE: LazyLock<Mutex<SessionStore>> =
    LazyLock::new(|| Mutex::new(SessionStore::default()));

pub struct Backend {
    template_registry: TemplateRegistry,
}

impl Backend {
    pub fn new() -> Result<Self, BackendError> {
        Ok(Self {
            template_registry: TemplateRegistry::load_embedded()?,
        })
    }

    pub fn list_available_templates(&self) -> Result<Vec<TemplateSummary>, BackendError> {
        Ok(self
            .template_registry
            .all()
            .into_iter()
            .map(|manifest| {
                let layer_types = manifest.layer_types();
                TemplateSummary {
                    id: manifest.id,
                    version: manifest.version,
                    name: manifest.name,
                    description: manifest.description,
                    recommended: manifest.recommended,
                    layer_types,
                }
            })
            .collect())
    }

    pub fn create_project(
        &self,
        request: CreateProjectRequest,
    ) -> Result<ProjectSession, BackendError> {
        let template = self.template_registry.template(&request.template_id)?;
        template.validate()?;
        let project_name = request
            .project_name
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| template.name.clone());
        let project_root = request
            .project_root
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| suggested_project_root(&project_name).display().to_string());

        let paths = ProjectPaths::new(&project_root);
        paths.ensure_layout()?;

        let storage = Storage::open(paths.database_path())?;
        storage.apply_migrations()?;
        if storage.project_exists()? {
            return Err(BackendError::new(
                "project_exists",
                format!("project already exists at {}", paths.root().display()),
            ));
        }

        let timestamp = unix_timestamp_string()?;
        let project_id = Uuid::new_v4().to_string();
        storage.insert_project_meta(&ProjectMetaRecord {
            project_id: project_id.clone(),
            project_name: project_name.clone(),
            template_id: template.id.clone(),
            template_version: template.version,
            created_at: timestamp.clone(),
            updated_at: timestamp.clone(),
        })?;
        storage.seed_root_graph(&template.root_graph_seed, &timestamp)?;
        storage.record_app_event(
            "project_created",
            &json!({
                "projectId": project_id,
                "templateId": template.id,
            })
            .to_string(),
            &timestamp,
        )?;

        write_settings(
            &paths,
            &ProjectSettings {
                schema_version: 1,
                template_id: template.id.clone(),
                template_version: template.version,
                project_id: project_id.clone(),
                project_name: project_name.clone(),
            },
        )?;

        let session = self.load_project_session(ProjectPaths::new(paths.root()))?;
        cache_session(session.clone())?;

        Ok(session)
    }

    pub fn open_project(
        &self,
        request: ProjectPathRequest,
    ) -> Result<ProjectSession, BackendError> {
        if request.project_root.is_none() {
            if let Some(session) = cached_session(request.session_id.as_deref())? {
                return Ok(session);
            }

            if let Some(project_root) = discover_recent_project_root()? {
                let session = self.load_project_session(ProjectPaths::new(project_root))?;
                cache_session(session.clone())?;

                return Ok(session);
            }

            return Err(BackendError::new(
                "no_project_selected",
                "Producer does not have an active project to open.",
            ));
        }

        let session =
            self.load_project_session(ProjectPaths::new(Self::project_root(&request)?))?;
        cache_session(session.clone())?;

        Ok(session)
    }

    pub fn get_project_session(
        &self,
        request: ProjectPathRequest,
    ) -> Result<Option<ProjectSession>, BackendError> {
        if request.project_root.is_some() {
            return self.open_project(request).map(Some);
        }

        cached_session(request.session_id.as_deref())
    }

    pub fn get_project_media_index_summary(
        &self,
        request: GetProjectMediaIndexSummaryRequest,
    ) -> Result<ProjectMediaIndexSummary, BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;

        Ok(project_media_index_summary(storage.media_index_summary()?))
    }

    pub fn refresh_project_media_index(
        &self,
        request: RefreshProjectMediaIndexRequest,
    ) -> Result<ProjectMediaIndexSummary, BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let paths = ProjectPaths::new(&session.project_path);
        let storage = Storage::open(paths.database_path())?;
        storage.apply_migrations()?;

        let timestamp = unix_timestamp_string()?;
        media::refresh_project_media_index_with_reason(
            &storage,
            &paths,
            &timestamp,
            request.reason.as_deref(),
        )?;

        let mut refreshed_session =
            self.load_project_session_with_active_graph(paths, Some(&session.active_graph.id))?;
        refreshed_session.session_id = session.session_id;
        cache_session(refreshed_session)?;

        Ok(project_media_index_summary(storage.media_index_summary()?))
    }

    pub fn list_project_assets(
        &self,
        request: ListProjectAssetsRequest,
    ) -> Result<Vec<ProjectAssetSummary>, BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;
        let query = request
            .query
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());

        storage
            .list_assets(request.media_type.as_deref(), query, request.limit)?
            .into_iter()
            .map(project_asset_summary)
            .collect()
    }

    pub fn bind_node_asset(
        &self,
        request: BindNodeAssetRequest,
    ) -> Result<GraphNodeDetail, BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;

        let graph = storage.load_graph(&request.graph_id)?;
        let allowed_node_types = self.allowed_node_types_for_graph(&session.template_id, &graph)?;
        let node_record = storage.load_graph_node_record(&graph.id, &request.node_id)?;
        let index = graph_node_index(&storage, &graph.id, &node_record.id)?;

        validate_graph_node_record(&graph, &allowed_node_types, &node_record)?;
        ensure_node_is_not_system(
            &node_record,
            "system_node_not_bindable",
            "cannot bind assets",
        )?;
        validate_node_asset_role(&node_record.node_type, &request.role)?;
        storage.load_asset_by_id(&request.asset_id)?;

        let timestamp = unix_timestamp_string()?;
        if storage.insert_node_asset_binding(
            &node_record.id,
            &request.asset_id,
            &request.role,
            &timestamp,
        )? {
            storage.record_app_event(
                "graph_node_asset_bound",
                &json!({
                    "graphId": graph.id,
                    "nodeId": node_record.id,
                    "assetId": request.asset_id,
                    "role": request.role,
                })
                .to_string(),
                &timestamp,
            )?;
        }

        let payload = parse_node_payload_object(&node_record.payload_json, &node_record.id)?;
        self.graph_node_detail(
            &storage,
            &session.template_id,
            &graph,
            &node_record,
            index,
            &payload,
        )
    }

    pub fn unbind_node_asset(
        &self,
        request: UnbindNodeAssetRequest,
    ) -> Result<GraphNodeDetail, BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;

        let graph = storage.load_graph(&request.graph_id)?;
        let allowed_node_types = self.allowed_node_types_for_graph(&session.template_id, &graph)?;
        let node_record = storage.load_graph_node_record(&graph.id, &request.node_id)?;
        let index = graph_node_index(&storage, &graph.id, &node_record.id)?;

        validate_graph_node_record(&graph, &allowed_node_types, &node_record)?;
        ensure_node_is_not_system(
            &node_record,
            "system_node_not_bindable",
            "cannot bind assets",
        )?;
        validate_node_asset_role(&node_record.node_type, &request.role)?;

        let timestamp = unix_timestamp_string()?;
        if storage.delete_node_asset_binding(&node_record.id, &request.asset_id, &request.role)? {
            storage.record_app_event(
                "graph_node_asset_unbound",
                &json!({
                    "graphId": graph.id,
                    "nodeId": node_record.id,
                    "assetId": request.asset_id,
                    "role": request.role,
                })
                .to_string(),
                &timestamp,
            )?;
        }

        let payload = parse_node_payload_object(&node_record.payload_json, &node_record.id)?;
        self.graph_node_detail(
            &storage,
            &session.template_id,
            &graph,
            &node_record,
            index,
            &payload,
        )
    }

    pub fn list_graph_edges(
        &self,
        request: ListGraphEdgesRequest,
    ) -> Result<Vec<GraphEdgeSummary>, BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;

        let graph = storage.load_graph(&request.graph_id)?;
        let allowed_node_types = self.allowed_node_types_for_graph(&session.template_id, &graph)?;
        let allowed_relation_types =
            self.allowed_relation_types_for_graph(&session.template_id, &graph)?;

        storage
            .list_graph_edge_records(&graph.id)?
            .into_iter()
            .map(|record| {
                validate_graph_edge_record(
                    &storage,
                    &graph,
                    &allowed_node_types,
                    &allowed_relation_types,
                    &record,
                )?;
                Ok(graph_edge_summary(&record))
            })
            .collect()
    }

    pub fn list_graph_relation_type_options(
        &self,
        request: ListGraphRelationTypeOptionsRequest,
    ) -> Result<Vec<GraphRelationTypeOption>, BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        let graph = storage.load_graph(&request.graph_id)?;

        self.allowed_relation_types_for_graph(&session.template_id, &graph)?
            .into_iter()
            .map(graph_relation_type_option)
            .collect()
    }

    pub fn create_graph_edge(
        &self,
        request: CreateGraphEdgeRequest,
    ) -> Result<GraphEdgeSummary, BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;

        let graph = storage.load_graph(&request.graph_id)?;
        let allowed_node_types = self.allowed_node_types_for_graph(&session.template_id, &graph)?;
        let allowed_relation_types =
            self.allowed_relation_types_for_graph(&session.template_id, &graph)?;
        validate_graph_edge_type(&graph, &allowed_relation_types, &request.edge_type)?;

        let source_node = storage.load_graph_node_record(&graph.id, &request.source_node_id)?;
        let target_node = storage.load_graph_node_record(&graph.id, &request.target_node_id)?;
        validate_graph_node_record(&graph, &allowed_node_types, &source_node)?;
        validate_graph_node_record(&graph, &allowed_node_types, &target_node)?;
        ensure_source_node_can_participate_in_graph_edges(
            &source_node,
            "system_node_not_connectable",
        )?;
        ensure_target_node_can_participate_in_graph_edges(
            &target_node,
            "system_node_not_connectable",
        )?;

        if storage.graph_edge_exists(
            &graph.id,
            &source_node.id,
            &target_node.id,
            &request.edge_type,
        )? {
            return Err(BackendError::new(
                "duplicate_graph_edge",
                format!(
                    "graph {} already has a {} edge from {} to {}",
                    graph.id, request.edge_type, source_node.id, target_node.id
                ),
            ));
        }

        let timestamp = unix_timestamp_string()?;
        let edge_record = GraphEdgeRecord {
            id: Uuid::new_v4().to_string(),
            graph_id: graph.id.clone(),
            source_node_id: source_node.id.clone(),
            target_node_id: target_node.id.clone(),
            edge_type: request.edge_type,
            payload_json: "{}".into(),
            created_at: timestamp.clone(),
            updated_at: timestamp.clone(),
        };
        storage.insert_graph_edge(&edge_record)?;
        storage.record_app_event(
            "graph_edge_created",
            &json!({
                "graphId": graph.id,
                "edgeId": edge_record.id,
                "sourceNodeId": source_node.id,
                "targetNodeId": target_node.id,
                "edgeType": edge_record.edge_type,
            })
            .to_string(),
            &timestamp,
        )?;

        Ok(graph_edge_summary(&edge_record))
    }

    pub fn delete_graph_edge(&self, request: DeleteGraphEdgeRequest) -> Result<(), BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;

        let graph = storage.load_graph(&request.graph_id)?;
        let edge_record = storage.load_graph_edge_record(&graph.id, &request.edge_id)?;
        let timestamp = unix_timestamp_string()?;
        storage.delete_graph_edge(&graph.id, &edge_record.id)?;
        storage.record_app_event(
            "graph_edge_deleted",
            &json!({
                "graphId": graph.id,
                "edgeId": edge_record.id,
                "sourceNodeId": edge_record.source_node_id,
                "targetNodeId": edge_record.target_node_id,
                "edgeType": edge_record.edge_type,
            })
            .to_string(),
            &timestamp,
        )?;

        Ok(())
    }

    pub fn delete_graph_node(
        &self,
        request: DeleteGraphNodeRequest,
    ) -> Result<DeleteGraphNodeResult, BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;

        let graph = storage.load_graph(&request.graph_id)?;
        let allowed_node_types = self.allowed_node_types_for_graph(&session.template_id, &graph)?;
        let record = storage.load_graph_node_record(&graph.id, &request.node_id)?;

        validate_graph_node_record(&graph, &allowed_node_types, &record)?;
        ensure_node_is_not_system(&record, "system_node_not_deletable", "cannot be deleted")?;

        let deleted_graph_records =
            self.collect_descendant_graph_deletion_order_for_node(&storage, &record)?;
        let deleted_graph_ids = deleted_graph_records
            .iter()
            .map(|graph_record| graph_record.id.clone())
            .collect::<Vec<_>>();

        for graph_record in deleted_graph_records {
            storage.delete_graph_record(&graph_record.id)?;
        }

        storage.delete_graph_node(&graph.id, &record.id)?;

        let timestamp = unix_timestamp_string()?;
        storage.record_app_event(
            "graph_node_deleted",
            &json!({
                "graphId": graph.id,
                "nodeId": record.id,
                "deletedGraphIds": deleted_graph_ids,
            })
            .to_string(),
            &timestamp,
        )?;

        Ok(DeleteGraphNodeResult {
            graph_id: graph.id,
            node_id: record.id,
            deleted_graph_ids,
        })
    }

    pub fn activate_graph(
        &self,
        request: ActivateGraphRequest,
    ) -> Result<ProjectSession, BackendError> {
        let base_session = self.resolve_session(&request.project_root, &request.session_id)?;
        let paths = ProjectPaths::new(&base_session.project_path);
        let mut session =
            self.load_project_session_with_active_graph(paths, Some(&request.graph_id))?;
        session.session_id = base_session.session_id;

        cache_session(session.clone())?;

        Ok(session)
    }

    pub fn open_node_child_graph(
        &self,
        request: OpenNodeChildGraphRequest,
    ) -> Result<ProjectSession, BackendError> {
        let base_session = self.resolve_session(&request.project_root, &request.session_id)?;
        let paths = ProjectPaths::new(&base_session.project_path);
        let storage = Storage::open(paths.database_path())?;
        storage.apply_migrations()?;

        let graph = storage.load_graph(&request.graph_id)?;
        let allowed_node_types =
            self.allowed_node_types_for_graph(&base_session.template_id, &graph)?;
        let graph_record = storage.load_graph_record(&request.graph_id)?;
        let node_record = storage.load_graph_node_record(&graph.id, &request.node_id)?;

        if node_record.is_system {
            return Err(BackendError::new(
                "child_graph_not_supported",
                format!(
                    "node {} does not support child graph entry",
                    request.node_id
                ),
            ));
        }
        validate_graph_node_record(&graph, &allowed_node_types, &node_record)?;

        let child_layer_spec =
            self.resolve_child_layer_for_node(&base_session.template_id, &graph, &node_record)?;
        let child_graph_record = self.ensure_child_graph_for_node(
            &storage,
            &graph_record,
            &node_record,
            &child_layer_spec.layer_type,
            &child_layer_spec.display_name,
        )?;
        self.ensure_system_anchor_for_graph(
            &storage,
            &child_graph_record,
            &node_record,
            &child_layer_spec.layer_type,
            &base_session.template_id,
        )?;

        let mut session =
            self.load_project_session_with_active_graph(paths, Some(&child_graph_record.id))?;
        session.session_id = base_session.session_id;
        cache_session(session.clone())?;

        Ok(session)
    }

    pub fn list_graph_nodes(
        &self,
        request: ListGraphNodesRequest,
    ) -> Result<Vec<GraphNodeSummary>, BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;

        let graph = storage.load_graph(&request.graph_id)?;
        let allowed_node_types = self.allowed_node_types_for_graph(&session.template_id, &graph)?;

        storage
            .list_graph_node_records(&graph.id)?
            .into_iter()
            .enumerate()
            .map(|(index, record)| {
                validate_graph_node_record(&graph, &allowed_node_types, &record)?;

                let payload = parse_node_payload(&record.payload_json);
                let stored_asset_count = graph_node_asset_bindings(&storage, &record)?.len() as u32;
                Ok(summarize_graph_node(
                    &record,
                    &payload,
                    index,
                    can_enter_child_graph_for_node_type(
                        &self.template_registry,
                        &session.template_id,
                        &graph,
                        &record,
                    )?,
                    stored_asset_count,
                ))
            })
            .collect()
    }

    pub fn list_graph_node_type_options(
        &self,
        request: GraphNodeTypeOptionRequest,
    ) -> Result<Vec<GraphNodeTypeOption>, BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        let graph = storage.load_graph(&request.graph_id)?;

        self.user_creatable_node_types_for_graph(&session.template_id, &graph)?
            .into_iter()
            .map(graph_node_type_option)
            .collect()
    }

    pub fn create_graph_node(
        &self,
        request: CreateGraphNodeRequest,
    ) -> Result<GraphNodeDetail, BackendError> {
        validate_graph_node_position(&request.position)?;
        let payload = parse_graph_node_payload_value(request.payload, None)?;
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;

        let graph = storage.load_graph(&request.graph_id)?;
        let allowed_node_types = self.allowed_node_types_for_graph(&session.template_id, &graph)?;
        validate_graph_node_type_name(&graph, &allowed_node_types, &request.node_type)?;

        let timestamp = unix_timestamp_string()?;
        let node_id = Uuid::new_v4().to_string();
        let stored_payload = payload_with_layout(
            payload,
            GraphNodePosition {
                x: request.position.x,
                y: request.position.y,
            },
        );
        let record = GraphNodeRecord {
            id: node_id.clone(),
            graph_id: graph.id.clone(),
            node_type: request.node_type,
            is_system: false,
            payload_json: Value::Object(stored_payload.clone()).to_string(),
            created_at: timestamp.clone(),
            updated_at: timestamp.clone(),
        };

        storage.insert_graph_node(&record)?;
        storage.record_app_event(
            "graph_node_created",
            &json!({
                "graphId": graph.id,
                "nodeId": node_id,
            })
            .to_string(),
            &timestamp,
        )?;

        self.graph_node_detail(
            &storage,
            &session.template_id,
            &graph,
            &record,
            0,
            &stored_payload,
        )
    }

    pub fn get_graph_node_detail(
        &self,
        request: GetGraphNodeDetailRequest,
    ) -> Result<GraphNodeDetail, BackendError> {
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;

        let graph = storage.load_graph(&request.graph_id)?;
        let allowed_node_types = self.allowed_node_types_for_graph(&session.template_id, &graph)?;
        let record = storage.load_graph_node_record(&graph.id, &request.node_id)?;
        let index = graph_node_index(&storage, &graph.id, &record.id)?;

        validate_graph_node_record(&graph, &allowed_node_types, &record)?;

        let payload = parse_node_payload_object(&record.payload_json, &record.id)?;
        self.graph_node_detail(
            &storage,
            &session.template_id,
            &graph,
            &record,
            index,
            &payload,
        )
    }

    pub fn update_graph_node_payload(
        &self,
        request: UpdateGraphNodePayloadRequest,
    ) -> Result<GraphNodeDetail, BackendError> {
        let payload = parse_graph_node_payload_value(request.payload, Some(&request.node_id))?;
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;

        let graph = storage.load_graph(&request.graph_id)?;
        let allowed_node_types = self.allowed_node_types_for_graph(&session.template_id, &graph)?;
        let record = storage.load_graph_node_record(&graph.id, &request.node_id)?;
        let index = graph_node_index(&storage, &graph.id, &record.id)?;

        validate_graph_node_record(&graph, &allowed_node_types, &record)?;
        if record.is_system {
            return Err(BackendError::new(
                "system_node_not_editable",
                format!("node {} is a system anchor and cannot be edited", record.id),
            ));
        }

        let existing_payload = parse_node_payload_object(&record.payload_json, &record.id)?;
        let existing_summary = summarize_graph_node(
            &record,
            &Value::Object(existing_payload),
            index,
            can_enter_child_graph_for_node_type(
                &self.template_registry,
                &session.template_id,
                &graph,
                &record,
            )?,
            0,
        );
        let stored_payload = payload_with_layout(
            payload,
            GraphNodePosition {
                x: existing_summary.layout.x,
                y: existing_summary.layout.y,
            },
        );
        let timestamp = unix_timestamp_string()?;

        storage.update_graph_node_payload(
            &graph.id,
            &record.id,
            &Value::Object(stored_payload.clone()).to_string(),
            &timestamp,
        )?;
        storage.record_app_event(
            "graph_node_updated",
            &json!({
                "graphId": graph.id,
                "nodeId": record.id,
            })
            .to_string(),
            &timestamp,
        )?;

        self.graph_node_detail(
            &storage,
            &session.template_id,
            &graph,
            &record,
            index,
            &stored_payload,
        )
    }

    pub fn update_graph_node_position(
        &self,
        request: UpdateGraphNodePositionRequest,
    ) -> Result<GraphNodeSummary, BackendError> {
        validate_graph_node_position(&request.position)?;
        let session = self.resolve_session(&request.project_root, &request.session_id)?;
        let storage = Storage::open(&session.paths.database_path)?;
        storage.apply_migrations()?;

        let graph = storage.load_graph(&request.graph_id)?;
        let allowed_node_types = self.allowed_node_types_for_graph(&session.template_id, &graph)?;
        let record = storage.load_graph_node_record(&graph.id, &request.node_id)?;
        let index = graph_node_index(&storage, &graph.id, &record.id)?;

        validate_graph_node_record(&graph, &allowed_node_types, &record)?;
        ensure_node_is_not_system(&record, "system_node_not_movable", "cannot be moved")?;

        let existing_payload = parse_node_payload_object(&record.payload_json, &record.id)?;
        let stored_payload = payload_with_layout(existing_payload, request.position.clone());
        let timestamp = unix_timestamp_string()?;

        storage.update_graph_node_payload(
            &graph.id,
            &record.id,
            &Value::Object(stored_payload.clone()).to_string(),
            &timestamp,
        )?;
        storage.record_app_event(
            "graph_node_moved",
            &json!({
                "graphId": graph.id,
                "nodeId": record.id,
            })
            .to_string(),
            &timestamp,
        )?;

        Ok(summarize_graph_node(
            &record,
            &Value::Object(stored_payload),
            index,
            can_enter_child_graph_for_node_type(
                &self.template_registry,
                &session.template_id,
                &graph,
                &record,
            )?,
            graph_node_asset_bindings(&storage, &record)?.len() as u32,
        ))
    }

    pub fn project_root(request: &ProjectPathRequest) -> Result<PathBuf, BackendError> {
        request
            .project_root
            .as_ref()
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from)
            .ok_or_else(|| BackendError::new("missing_project_root", "project root is required"))
    }

    fn load_project_session(&self, paths: ProjectPaths) -> Result<ProjectSession, BackendError> {
        self.load_project_session_with_active_graph(paths, None)
    }

    fn load_project_session_with_active_graph(
        &self,
        paths: ProjectPaths,
        requested_graph_id: Option<&str>,
    ) -> Result<ProjectSession, BackendError> {
        ensure_project_files(&paths)?;

        let settings = read_settings(&paths)?;
        let storage = Storage::open(paths.database_path())?;
        storage.apply_migrations()?;

        let project_meta = storage.load_project_meta()?;
        let root_graph = storage.load_root_graph()?;
        let available_graphs = storage.list_graphs()?;
        let project_path = paths.root().display().to_string();
        let active_graph =
            resolve_active_graph(&storage, &project_path, &root_graph, requested_graph_id)?;
        let graph_trail = build_graph_trail(&storage, &active_graph.id)?;

        if project_meta.template_id != settings.template_id
            || project_meta.project_id != settings.project_id
        {
            return Err(BackendError::new(
                "invalid_project",
                "settings.json does not match the project database",
            ));
        }

        Ok(ProjectSession {
            session_id: Uuid::new_v4().to_string(),
            project_id: project_meta.project_id,
            project_name: project_meta.project_name,
            project_path: project_path.clone(),
            template_id: project_meta.template_id,
            template_version: project_meta.template_version,
            root_graph,
            active_graph,
            available_graphs,
            graph_trail,
            graph_count: storage.count_graphs()?,
            asset_count: storage.count_assets()?,
            paths: ProjectPathSummary {
                root: project_path,
                producer_dir: paths.producer_dir().display().to_string(),
                database_path: paths.database_path().display().to_string(),
                settings_path: paths.settings_path().display().to_string(),
                assets_dir: paths.assets_dir().display().to_string(),
                exports_dir: paths.exports_dir().display().to_string(),
            },
        })
    }

    fn resolve_session(
        &self,
        project_root: &Option<String>,
        session_id: &Option<String>,
    ) -> Result<ProjectSession, BackendError> {
        let requested_project_root = project_root
            .as_ref()
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from);

        if let Some(session) = cached_session(session_id.as_deref())? {
            let matches_requested_project = requested_project_root
                .as_ref()
                .is_none_or(|root| PathBuf::from(&session.project_path) == *root);

            if matches_requested_project {
                return Ok(session);
            }
        }

        if let Some(project_root) = requested_project_root {
            if let Some(session) =
                cached_session_for_project(project_root.to_string_lossy().as_ref())?
            {
                return Ok(session);
            }

            return self.open_project(ProjectPathRequest {
                project_root: Some(project_root.display().to_string()),
                session_id: session_id.clone(),
            });
        }

        if let Some(session) = cached_session(None)? {
            return Ok(session);
        }

        self.open_project(ProjectPathRequest {
            project_root: None,
            session_id: session_id.clone(),
        })
    }

    fn allowed_node_types_for_graph(
        &self,
        template_id: &str,
        graph: &GraphSummary,
    ) -> Result<Vec<String>, BackendError> {
        Ok(self
            .layer_allowed_node_types(template_id, graph)?
            .allowed_node_types
            .clone())
    }

    fn allowed_relation_types_for_graph(
        &self,
        template_id: &str,
        graph: &GraphSummary,
    ) -> Result<Vec<String>, BackendError> {
        Ok(self
            .layer_allowed_node_types(template_id, graph)?
            .default_relations
            .clone())
    }

    fn user_creatable_node_types_for_graph(
        &self,
        template_id: &str,
        graph: &GraphSummary,
    ) -> Result<Vec<String>, BackendError> {
        let layer_spec = self.layer_allowed_node_types(template_id, graph)?;
        let system_anchor_type = layer_spec
            .system_anchor
            .as_ref()
            .map(|anchor| anchor.source_node_type.as_str());

        Ok(layer_spec
            .allowed_node_types
            .iter()
            .filter(|node_type| Some(node_type.as_str()) != system_anchor_type)
            .cloned()
            .collect())
    }

    fn resolve_child_layer_for_node(
        &self,
        template_id: &str,
        graph: &GraphSummary,
        node_record: &GraphNodeRecord,
    ) -> Result<crate::domain::template::LayerSpec, BackendError> {
        let current_layer = self.layer_allowed_node_types(template_id, graph)?;
        let Some(child_canvas_for) = current_layer.child_canvas_for.as_deref() else {
            return Err(BackendError::new(
                "child_graph_not_supported",
                format!("graph {} does not support child graphs", graph.id),
            ));
        };

        if child_canvas_for != node_record.node_type {
            return Err(BackendError::new(
                "child_graph_not_supported",
                format!("node {} does not support child graph entry", node_record.id),
            ));
        }

        let template = self.template_registry.template(template_id)?;
        template
            .layer_specs
            .iter()
            .find(|spec| {
                spec.system_anchor
                    .as_ref()
                    .is_some_and(|anchor| anchor.source_node_type == node_record.node_type)
            })
            .cloned()
            .ok_or_else(|| {
                BackendError::new(
                    "child_graph_not_supported",
                    format!("node {} does not support child graph entry", node_record.id),
                )
            })
    }

    fn ensure_child_graph_for_node(
        &self,
        storage: &Storage,
        parent_graph: &StoredGraphRecord,
        node_record: &GraphNodeRecord,
        layer_type: &str,
        layer_name: &str,
    ) -> Result<StoredGraphRecord, BackendError> {
        if let Some(graph) = storage.load_graph_record_by_source_node_id(&node_record.id)? {
            return Ok(graph);
        }

        let timestamp = unix_timestamp_string()?;
        let child_graph = StoredGraphRecord {
            id: Uuid::new_v4().to_string(),
            layer_type: layer_type.to_string(),
            name: layer_name.to_string(),
            is_root: false,
            parent_graph_id: Some(parent_graph.id.clone()),
            source_node_id: Some(node_record.id.clone()),
        };
        storage.insert_child_graph(&child_graph, &timestamp)?;

        Ok(child_graph)
    }

    fn collect_descendant_graph_deletion_order_for_node(
        &self,
        storage: &Storage,
        node_record: &GraphNodeRecord,
    ) -> Result<Vec<StoredGraphRecord>, BackendError> {
        let Some(child_graph_record) =
            storage.load_graph_record_by_source_node_id(&node_record.id)?
        else {
            return Ok(Vec::new());
        };

        self.collect_graph_deletion_order(storage, &child_graph_record)
    }

    fn collect_graph_deletion_order(
        &self,
        storage: &Storage,
        graph_record: &StoredGraphRecord,
    ) -> Result<Vec<StoredGraphRecord>, BackendError> {
        let mut ordered_graphs = Vec::new();

        for child_graph_record in storage.list_child_graph_records(&graph_record.id)? {
            ordered_graphs.extend(self.collect_graph_deletion_order(storage, &child_graph_record)?);
        }

        ordered_graphs.push(graph_record.clone());

        Ok(ordered_graphs)
    }

    fn ensure_system_anchor_for_graph(
        &self,
        storage: &Storage,
        graph_record: &StoredGraphRecord,
        source_node_record: &GraphNodeRecord,
        layer_type: &str,
        template_id: &str,
    ) -> Result<(), BackendError> {
        let source_payload =
            parse_node_payload_object(&source_node_record.payload_json, &source_node_record.id)?;
        let source_node_title = node_title(
            &source_node_record.node_type,
            &source_node_record.id,
            &Value::Object(source_payload.clone()),
        );
        let anchor_payload = system_anchor_payload(
            &self.template_registry,
            template_id,
            layer_type,
            source_node_record,
            &source_node_title,
        )?;

        if let Some(existing_anchor) = storage.load_system_anchor_node_record(&graph_record.id)? {
            let current_payload =
                parse_node_payload_object(&existing_anchor.payload_json, &existing_anchor.id)?;
            if payload_without_layout(&current_payload) == payload_without_layout(&anchor_payload) {
                return Ok(());
            }

            let timestamp = unix_timestamp_string()?;
            storage.update_graph_node_payload(
                &graph_record.id,
                &existing_anchor.id,
                &Value::Object(anchor_payload).to_string(),
                &timestamp,
            )?;
            return Ok(());
        }

        let timestamp = unix_timestamp_string()?;
        let record = GraphNodeRecord {
            id: Uuid::new_v4().to_string(),
            graph_id: graph_record.id.clone(),
            node_type: "system_anchor".into(),
            is_system: true,
            payload_json: Value::Object(anchor_payload).to_string(),
            created_at: timestamp.clone(),
            updated_at: timestamp,
        };
        storage.insert_graph_node(&record)?;

        Ok(())
    }

    fn layer_allowed_node_types(
        &self,
        template_id: &str,
        graph: &GraphSummary,
    ) -> Result<crate::domain::template::LayerSpec, BackendError> {
        let template = self.template_registry.template(template_id)?;
        template
            .layer_specs
            .iter()
            .find(|spec| spec.layer_type == graph.layer_type)
            .cloned()
            .ok_or_else(|| {
                BackendError::new(
                    "invalid_project",
                    format!(
                        "graph {} uses unknown layer type {} for template {}",
                        graph.id, graph.layer_type, template.id
                    ),
                )
            })
    }

    fn graph_node_detail(
        &self,
        storage: &Storage,
        template_id: &str,
        graph: &GraphSummary,
        record: &GraphNodeRecord,
        index: usize,
        stored_payload: &serde_json::Map<String, Value>,
    ) -> Result<GraphNodeDetail, BackendError> {
        let asset_bindings = graph_node_asset_bindings(storage, record)?;
        let asset_role_options = graph_node_asset_role_options(record);

        Ok(graph_node_detail_from_payload(
            record,
            stored_payload,
            index,
            can_enter_child_graph_for_node_type(
                &self.template_registry,
                template_id,
                graph,
                record,
            )?,
            asset_bindings,
            asset_role_options,
        ))
    }
}

fn cache_session(session: ProjectSession) -> Result<(), BackendError> {
    let mut store = SESSION_STORE
        .lock()
        .map_err(|_| BackendError::new("session_store_error", "failed to lock session store"))?;

    store.active_session_id = Some(session.session_id.clone());
    store.sessions.insert(session.session_id.clone(), session);

    Ok(())
}

fn cached_session(session_id: Option<&str>) -> Result<Option<ProjectSession>, BackendError> {
    let store = SESSION_STORE
        .lock()
        .map_err(|_| BackendError::new("session_store_error", "failed to lock session store"))?;

    if let Some(session_id) = session_id {
        return Ok(store.sessions.get(session_id).cloned());
    }

    Ok(store
        .active_session_id
        .as_ref()
        .and_then(|id| store.sessions.get(id))
        .cloned())
}

fn cached_session_for_project(project_path: &str) -> Result<Option<ProjectSession>, BackendError> {
    let store = SESSION_STORE
        .lock()
        .map_err(|_| BackendError::new("session_store_error", "failed to lock session store"))?;

    if let Some(active_session_id) = store.active_session_id.as_ref() {
        if let Some(session) = store.sessions.get(active_session_id) {
            if session.project_path == project_path {
                return Ok(Some(session.clone()));
            }
        }
    }

    Ok(store
        .sessions
        .values()
        .find(|session| session.project_path == project_path)
        .cloned())
}

fn resolve_active_graph(
    storage: &Storage,
    project_path: &str,
    root_graph: &GraphSummary,
    requested_graph_id: Option<&str>,
) -> Result<GraphSummary, BackendError> {
    if let Some(graph_id) = requested_graph_id {
        return storage.load_graph(graph_id);
    }

    let cached_graph_id =
        cached_session_for_project(project_path)?.map(|session| session.active_graph.id);

    if let Some(graph_id) = cached_graph_id.as_deref() {
        match storage.load_graph(graph_id) {
            Ok(graph) => return Ok(graph),
            Err(error) if error.code == "graph_not_found" => {}
            Err(error) => return Err(error),
        }
    }

    Ok(root_graph.clone())
}

fn build_graph_trail(
    storage: &Storage,
    active_graph_id: &str,
) -> Result<Vec<GraphContextTrailItem>, BackendError> {
    let mut records = Vec::new();
    let mut current = storage.load_graph_record(active_graph_id)?;

    loop {
        let source_node_title = match current.source_node_id.as_deref() {
            Some(source_node_id) => {
                let source_node = storage.load_node_record_by_id(source_node_id)?;
                let payload = parse_node_payload(&source_node.payload_json);
                Some(node_title(
                    &source_node.node_type,
                    &source_node.id,
                    &payload,
                ))
            }
            None => None,
        };

        records.push(GraphContextTrailItem {
            graph_id: current.id.clone(),
            graph_name: current.name.clone(),
            layer_type: current.layer_type.clone(),
            source_node_id: current.source_node_id.clone(),
            source_node_title,
        });

        let Some(parent_graph_id) = current.parent_graph_id.clone() else {
            break;
        };
        current = storage.load_graph_record(&parent_graph_id)?;
    }

    records.reverse();
    Ok(records)
}

fn unix_timestamp_string() -> Result<String, BackendError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| {
            BackendError::new("clock_error", format!("system clock error: {error}"))
        })?;

    Ok(timestamp.as_secs().to_string())
}

fn ensure_project_files(paths: &ProjectPaths) -> Result<(), BackendError> {
    if !paths.producer_dir().is_dir()
        || !paths.database_path().is_file()
        || !paths.settings_path().is_file()
        || !paths.assets_dir().is_dir()
        || !paths.exports_dir().is_dir()
    {
        return Err(BackendError::new(
            "invalid_project",
            format!(
                "missing Producer project structure under {}",
                paths.root().display()
            ),
        ));
    }

    Ok(())
}

fn write_settings(paths: &ProjectPaths, settings: &ProjectSettings) -> Result<(), BackendError> {
    let payload = serde_json::to_vec_pretty(settings).map_err(|error| {
        BackendError::new(
            "io_error",
            format!("failed to serialize settings.json: {error}"),
        )
    })?;

    fs::write(paths.settings_path(), payload).map_err(|error| {
        BackendError::new(
            "io_error",
            format!(
                "failed to write settings file {}: {error}",
                paths.settings_path().display()
            ),
        )
    })
}

fn read_settings(paths: &ProjectPaths) -> Result<ProjectSettings, BackendError> {
    let settings_bytes = fs::read(paths.settings_path()).map_err(|error| {
        BackendError::new(
            "invalid_project",
            format!(
                "failed to read settings file {}: {error}",
                paths.settings_path().display()
            ),
        )
    })?;

    serde_json::from_slice(&settings_bytes).map_err(|error| {
        BackendError::new(
            "invalid_project",
            format!("settings.json is invalid: {error}"),
        )
    })
}

fn suggested_project_root(project_name: &str) -> PathBuf {
    let base = producer_projects_root();

    base.join(format!(
        "{}-{}",
        slugify(project_name),
        unix_timestamp_string().unwrap_or_else(|_| "0".into())
    ))
}

fn producer_projects_root() -> PathBuf {
    if let Some(override_root) = std::env::var_os("PRODUCER_PROJECTS_DIR") {
        return PathBuf::from(override_root);
    }

    home_directory()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
        .join("Documents")
        .join("Producer Projects")
}

fn home_directory() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn slugify(value: &str) -> String {
    let mut slug = String::new();
    let mut previous_was_dash = false;

    for character in value.chars().flat_map(|item| item.to_lowercase()) {
        if character.is_ascii_alphanumeric() {
            slug.push(character);
            previous_was_dash = false;
        } else if !previous_was_dash {
            slug.push('-');
            previous_was_dash = true;
        }
    }

    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        "producer-project".into()
    } else {
        slug
    }
}

fn discover_recent_project_root() -> Result<Option<PathBuf>, BackendError> {
    let projects_root = producer_projects_root();
    if !projects_root.exists() {
        return Ok(None);
    }

    let mut newest: Option<(SystemTime, PathBuf)> = None;
    let entries = fs::read_dir(&projects_root).map_err(|error| {
        BackendError::new(
            "io_error",
            format!(
                "failed to read Producer projects directory {}: {error}",
                projects_root.display()
            ),
        )
    })?;

    for entry in entries {
        let entry = entry.map_err(|error| {
            BackendError::new(
                "io_error",
                format!("failed to inspect recent project entry: {error}"),
            )
        })?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let candidate = ProjectPaths::new(&path);
        if !candidate.database_path().is_file() || !candidate.settings_path().is_file() {
            continue;
        }

        let modified = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .unwrap_or(UNIX_EPOCH);

        match &newest {
            Some((current_modified, _)) if modified <= *current_modified => {}
            _ => newest = Some((modified, path)),
        }
    }

    Ok(newest.map(|(_, path)| path))
}

fn parse_node_payload(payload_json: &str) -> Value {
    serde_json::from_str(payload_json).unwrap_or(Value::Null)
}

fn parse_graph_node_payload_value(
    payload: Value,
    node_id: Option<&str>,
) -> Result<serde_json::Map<String, Value>, BackendError> {
    payload.as_object().cloned().ok_or_else(|| {
        let message = match node_id {
            Some(node_id) => format!("node {node_id} payload must be a JSON object"),
            None => "graph node payload must be a JSON object".into(),
        };

        BackendError::new("invalid_graph_node_payload", message)
    })
}

fn parse_node_payload_object(
    payload_json: &str,
    node_id: &str,
) -> Result<serde_json::Map<String, Value>, BackendError> {
    let payload: Value = serde_json::from_str(payload_json).map_err(|error| {
        BackendError::new(
            "invalid_graph_node_payload",
            format!("node {node_id} payload is not valid JSON: {error}"),
        )
    })?;

    payload.as_object().cloned().ok_or_else(|| {
        BackendError::new(
            "invalid_graph_node_payload",
            format!("node {node_id} payload must be a JSON object"),
        )
    })
}

fn validate_graph_node_record(
    graph: &GraphSummary,
    allowed_node_types: &[String],
    record: &GraphNodeRecord,
) -> Result<(), BackendError> {
    if record.is_system {
        if record.node_type == "system_anchor" {
            return Ok(());
        }

        return Err(BackendError::new(
            "invalid_graph_node",
            format!(
                "node {} with system type {} is not allowed in {} graph {}",
                record.id, record.node_type, graph.layer_type, graph.id
            ),
        ));
    }

    validate_graph_node_type_name(graph, allowed_node_types, &record.node_type).map_err(|error| {
        BackendError::new(
            error.code,
            format!(
                "node {} with type {} is not allowed in {} graph {}",
                record.id, record.node_type, graph.layer_type, graph.id
            ),
        )
    })
}

fn validate_graph_node_type_name(
    graph: &GraphSummary,
    allowed_node_types: &[String],
    node_type: &str,
) -> Result<(), BackendError> {
    if node_type.trim().is_empty() {
        return Err(BackendError::new(
            "invalid_graph_node",
            "node type is required",
        ));
    }

    if allowed_node_types
        .iter()
        .any(|allowed_node_type| allowed_node_type == node_type)
    {
        return Ok(());
    }

    Err(BackendError::new(
        "invalid_graph_node",
        format!(
            "node type {node_type} is not allowed in {} graph {}",
            graph.layer_type, graph.id
        ),
    ))
}

fn validate_graph_node_position(position: &GraphNodePosition) -> Result<(), BackendError> {
    if position.x.is_finite() && position.y.is_finite() {
        return Ok(());
    }

    Err(BackendError::new(
        "invalid_graph_node_layout",
        "graph node position must contain finite x and y coordinates",
    ))
}

fn ensure_node_is_not_system(
    record: &GraphNodeRecord,
    error_code: &str,
    action: &str,
) -> Result<(), BackendError> {
    if record.is_system {
        return Err(BackendError::new(
            error_code,
            format!("node {} is a system anchor and {action}", record.id),
        ));
    }

    Ok(())
}

fn validate_node_asset_role(node_type: &str, role: &str) -> Result<(), BackendError> {
    if graph_node_asset_role_options_for_node_type(node_type)
        .iter()
        .any(|option| option.role == role)
    {
        return Ok(());
    }

    Err(BackendError::new(
        "invalid_node_asset_role",
        format!("role {role} is not allowed for node type {node_type}"),
    ))
}

fn validate_graph_edge_type(
    graph: &GraphSummary,
    allowed_relation_types: &[String],
    edge_type: &str,
) -> Result<(), BackendError> {
    if allowed_relation_types
        .iter()
        .any(|allowed_edge_type| allowed_edge_type == edge_type)
    {
        return Ok(());
    }

    Err(BackendError::new(
        "invalid_graph_edge",
        format!(
            "edge type {edge_type} is not allowed in {} graph {}",
            graph.layer_type, graph.id
        ),
    ))
}

fn validate_graph_edge_record(
    storage: &Storage,
    graph: &GraphSummary,
    allowed_node_types: &[String],
    allowed_relation_types: &[String],
    record: &GraphEdgeRecord,
) -> Result<(), BackendError> {
    validate_graph_edge_type(graph, allowed_relation_types, &record.edge_type)?;

    let source_node = storage
        .load_graph_node_record(&graph.id, &record.source_node_id)
        .map_err(|error| {
            BackendError::new(
                "invalid_graph_edge",
                format!(
                    "edge {} has an invalid source node: {}",
                    record.id, error.message
                ),
            )
        })?;
    let target_node = storage
        .load_graph_node_record(&graph.id, &record.target_node_id)
        .map_err(|error| {
            BackendError::new(
                "invalid_graph_edge",
                format!(
                    "edge {} has an invalid target node: {}",
                    record.id, error.message
                ),
            )
        })?;

    validate_graph_node_record(graph, allowed_node_types, &source_node)?;
    validate_graph_node_record(graph, allowed_node_types, &target_node)?;
    ensure_source_node_can_participate_in_graph_edges(&source_node, "invalid_graph_edge")?;
    ensure_target_node_can_participate_in_graph_edges(&target_node, "invalid_graph_edge")?;

    Ok(())
}

fn ensure_source_node_can_participate_in_graph_edges(
    record: &GraphNodeRecord,
    error_code: &str,
) -> Result<(), BackendError> {
    if !record.is_system || record.node_type == "system_anchor" {
        return Ok(());
    }

    Err(BackendError::new(
        error_code,
        format!(
            "node {} is system-managed and cannot participate in graph edges as a source",
            record.id
        ),
    ))
}

fn ensure_target_node_can_participate_in_graph_edges(
    record: &GraphNodeRecord,
    error_code: &str,
) -> Result<(), BackendError> {
    if !record.is_system {
        return Ok(());
    }

    Err(BackendError::new(
        error_code,
        format!(
            "node {} is system-managed and cannot be targeted by graph edges",
            record.id
        ),
    ))
}

fn graph_node_index(
    storage: &Storage,
    graph_id: &str,
    node_id: &str,
) -> Result<usize, BackendError> {
    storage
        .list_graph_node_records(graph_id)?
        .into_iter()
        .position(|record| record.id == node_id)
        .ok_or_else(|| {
            BackendError::new(
                "graph_node_not_found",
                format!("node {node_id} does not belong to graph {graph_id}"),
            )
        })
}

fn payload_without_layout(
    payload: &serde_json::Map<String, Value>,
) -> serde_json::Map<String, Value> {
    let mut payload = payload.clone();
    payload.remove("layout");
    payload
}

fn payload_with_layout(
    payload: serde_json::Map<String, Value>,
    position: GraphNodePosition,
) -> serde_json::Map<String, Value> {
    let mut stored_payload = payload_without_layout(&payload);
    stored_payload.insert(
        "layout".into(),
        json!({
            "x": position.x,
            "y": position.y,
        }),
    );
    stored_payload
}

fn system_anchor_payload(
    template_registry: &TemplateRegistry,
    template_id: &str,
    layer_type: &str,
    source_node_record: &GraphNodeRecord,
    source_node_title: &str,
) -> Result<serde_json::Map<String, Value>, BackendError> {
    let template = template_registry.template(template_id)?;
    let layer_spec = template
        .layer_specs
        .iter()
        .find(|spec| spec.layer_type == layer_type)
        .ok_or_else(|| {
            BackendError::new(
                "invalid_project",
                format!(
                    "unknown layer type {layer_type} for template {}",
                    template.id
                ),
            )
        })?;
    let anchor_spec = layer_spec.system_anchor.as_ref().ok_or_else(|| {
        BackendError::new(
            "invalid_project",
            format!("layer {layer_type} does not define a system anchor"),
        )
    })?;

    Ok(payload_with_layout(
        serde_json::Map::from_iter([
            ("title".into(), Value::String(source_node_title.to_string())),
            (
                "source_node_id".into(),
                Value::String(source_node_record.id.clone()),
            ),
            (
                "source_node_type".into(),
                Value::String(source_node_record.node_type.clone()),
            ),
            (
                "source_node_title".into(),
                Value::String(source_node_title.to_string()),
            ),
            (
                "anchor_label".into(),
                Value::String(anchor_spec.title.clone()),
            ),
            ("locked".into(), Value::Bool(true)),
        ]),
        GraphNodePosition { x: 64.0, y: 40.0 },
    ))
}

fn graph_node_detail_from_payload(
    record: &GraphNodeRecord,
    stored_payload: &serde_json::Map<String, Value>,
    index: usize,
    can_enter_child_graph: bool,
    asset_bindings: Vec<GraphNodeAssetBinding>,
    asset_role_options: Vec<GraphNodeAssetRoleOption>,
) -> GraphNodeDetail {
    let summary = summarize_graph_node(
        record,
        &Value::Object(stored_payload.clone()),
        index,
        can_enter_child_graph,
        asset_bindings.len() as u32,
    );

    GraphNodeDetail {
        id: summary.id,
        graph_id: summary.graph_id,
        node_type: summary.node_type,
        source_node_type: summary.source_node_type,
        is_system: summary.is_system,
        can_enter_child_graph: summary.can_enter_child_graph,
        stored_asset_count: summary.stored_asset_count,
        title: summary.title,
        status: summary.status,
        layout: summary.layout,
        payload: payload_without_layout(stored_payload),
        asset_bindings,
        asset_role_options,
    }
}

fn graph_node_asset_bindings(
    storage: &Storage,
    record: &GraphNodeRecord,
) -> Result<Vec<GraphNodeAssetBinding>, BackendError> {
    if record.is_system {
        return Ok(Vec::new());
    }

    storage
        .list_node_asset_binding_records(&record.id)?
        .into_iter()
        .map(graph_node_asset_binding)
        .collect()
}

fn graph_node_asset_binding(
    record: NodeAssetBindingListItemRecord,
) -> Result<GraphNodeAssetBinding, BackendError> {
    let NodeAssetBindingListItemRecord {
        asset_id,
        role,
        created_at: _,
        relative_path,
        media_type,
        mime_type,
        byte_size,
        width,
        height,
        duration_ms,
        indexed_at,
        missing_at,
        thumbnail_relative_path,
        thumbnail_status,
    } = record;

    Ok(GraphNodeAssetBinding {
        asset_id: asset_id.clone(),
        role,
        asset: project_asset_summary(AssetListItemRecord {
            id: asset_id,
            relative_path,
            media_type,
            mime_type,
            byte_size,
            width,
            height,
            duration_ms,
            indexed_at,
            missing_at,
            thumbnail_relative_path,
            thumbnail_status,
        })?,
    })
}

fn graph_node_asset_role_options(record: &GraphNodeRecord) -> Vec<GraphNodeAssetRoleOption> {
    if record.is_system {
        Vec::new()
    } else {
        graph_node_asset_role_options_for_node_type(&record.node_type)
    }
}

fn graph_node_asset_role_options_for_node_type(node_type: &str) -> Vec<GraphNodeAssetRoleOption> {
    match node_type {
        "brief" => vec![
            asset_role_option("product_image"),
            asset_role_option("example_video"),
        ],
        "storyboard_shot" => vec![asset_role_option("reference")],
        "prompt" => vec![asset_role_option("reference")],
        "still" | "video" => vec![
            asset_role_option("reference"),
            asset_role_option("preview"),
            asset_role_option("output"),
        ],
        "reference" => vec![asset_role_option("source"), asset_role_option("reference")],
        "review" => vec![asset_role_option("reference")],
        "result" => vec![asset_role_option("reference"), asset_role_option("output")],
        _ => Vec::new(),
    }
}

fn asset_role_option(role: &str) -> GraphNodeAssetRoleOption {
    let (label, description) = match role {
        "source" => ("Source", "Original asset attached directly to this node."),
        "reference" => (
            "Reference",
            "Reference material or inspiration asset for this node.",
        ),
        "preview" => (
            "Preview",
            "Preview frame or representative asset for this node.",
        ),
        "output" => (
            "Output",
            "Final output asset produced or selected by this node.",
        ),
        "product_image" => (
            "Product image",
            "Primary product image displayed in this brief node.",
        ),
        "example_video" => (
            "Example video",
            "Reference example video displayed in this brief node.",
        ),
        _ => (role, "Attachment role."),
    };

    GraphNodeAssetRoleOption {
        role: role.to_string(),
        label: label.to_string(),
        description: Some(description.to_string()),
    }
}

fn graph_edge_summary(record: &GraphEdgeRecord) -> GraphEdgeSummary {
    GraphEdgeSummary {
        id: record.id.clone(),
        graph_id: record.graph_id.clone(),
        source_node_id: record.source_node_id.clone(),
        target_node_id: record.target_node_id.clone(),
        edge_type: record.edge_type.clone(),
    }
}

fn summarize_graph_node(
    record: &GraphNodeRecord,
    payload: &Value,
    index: usize,
    can_enter_child_graph: bool,
    stored_asset_count: u32,
) -> GraphNodeSummary {
    let (width, height) = node_size_for_summary(&record.node_type, payload);
    let (x, y) = resolve_node_coordinates(payload, index);

    GraphNodeSummary {
        id: record.id.clone(),
        graph_id: record.graph_id.clone(),
        node_type: record.node_type.clone(),
        source_node_type: source_node_type(payload),
        is_system: record.is_system,
        can_enter_child_graph,
        stored_asset_count,
        title: node_title(&record.node_type, &record.id, payload),
        status: node_status(payload),
        layout: GraphNodeLayout {
            x,
            y,
            width,
            height,
        },
    }
}

fn can_enter_child_graph_for_node_type(
    template_registry: &TemplateRegistry,
    template_id: &str,
    graph: &GraphSummary,
    record: &GraphNodeRecord,
) -> Result<bool, BackendError> {
    if record.is_system {
        return Ok(false);
    }

    let template = template_registry.template(template_id)?;
    let Some(current_layer) = template
        .layer_specs
        .iter()
        .find(|spec| spec.layer_type == graph.layer_type)
    else {
        return Err(BackendError::new(
            "invalid_project",
            format!(
                "graph {} uses unknown layer type {} for template {}",
                graph.id, graph.layer_type, template.id
            ),
        ));
    };

    let Some(child_canvas_for) = current_layer.child_canvas_for.as_deref() else {
        return Ok(false);
    };
    if child_canvas_for != record.node_type {
        return Ok(false);
    }

    Ok(template.layer_specs.iter().any(|spec| {
        spec.system_anchor
            .as_ref()
            .is_some_and(|anchor| anchor.source_node_type == record.node_type)
    }))
}

fn graph_node_type_option(node_type: String) -> Result<GraphNodeTypeOption, BackendError> {
    let (label, description) = node_type_metadata(&node_type).ok_or_else(|| {
        BackendError::new(
            "invalid_template_manifest",
            format!("missing node type metadata for {node_type}"),
        )
    })?;
    let (width, height) = node_size_preset(&node_type);

    Ok(GraphNodeTypeOption {
        default_title: format!("New {label}"),
        node_type,
        label: label.to_string(),
        description: Some(description.to_string()),
        default_size: GraphNodeTypeOptionSize { width, height },
    })
}

fn graph_relation_type_option(edge_type: String) -> Result<GraphRelationTypeOption, BackendError> {
    let (label, description) = match edge_type.as_str() {
        "contains" => (
            "Contains",
            "Organizes structural containment inside the current graph.",
        ),
        "references" => ("References", "References another node in the same graph."),
        "variant_of" => (
            "Variant Of",
            "Marks this node as a variation of another node.",
        ),
        "approved_from" => (
            "Approved From",
            "Captures approval lineage between related nodes.",
        ),
        "alternative_to" => (
            "Alternative To",
            "Marks two nodes as interchangeable alternatives.",
        ),
        "reuses" => (
            "Reuses",
            "Marks this node as reusing another node's idea or asset.",
        ),
        _ => {
            return Err(BackendError::new(
                "invalid_template_manifest",
                format!("missing relation type metadata for {edge_type}"),
            ));
        }
    };

    Ok(GraphRelationTypeOption {
        edge_type,
        label: label.to_string(),
        description: Some(description.to_string()),
    })
}

fn node_type_metadata(node_type: &str) -> Option<(&'static str, &'static str)> {
    match node_type {
        "brief" => Some(("Brief", "High-level campaign brief and constraints.")),
        "storyboard_shot" => Some((
            "Storyboard Shot",
            "Single storyboard frame for a planned shot.",
        )),
        "prompt" => Some(("Prompt", "Generation prompt and parameter strategy.")),
        "still" => Some(("Still", "Static frame candidate or image variation.")),
        "video" => Some(("Video", "Motion candidate or generated clip variation.")),
        "reference" => Some((
            "Reference",
            "Reference material, style sample, or source cue.",
        )),
        "review" => Some(("Review", "Human review note, decision, or feedback.")),
        "result" => Some((
            "Result",
            "Selected output, deliverable, or final composition.",
        )),
        _ => None,
    }
}

fn node_title(node_type: &str, node_id: &str, payload: &Value) -> String {
    payload
        .get("title")
        .and_then(non_empty_string)
        .or_else(|| payload.get("name").and_then(non_empty_string))
        .unwrap_or_else(|| format!("{node_type} {}", short_node_id(node_id)))
}

fn node_status(payload: &Value) -> Option<String> {
    payload
        .get("status")
        .and_then(non_empty_string)
        .or_else(|| payload.get("decision").and_then(non_empty_string))
}

fn source_node_type(payload: &Value) -> Option<String> {
    payload.get("source_node_type").and_then(non_empty_string)
}

fn non_empty_string(value: &Value) -> Option<String> {
    value
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn short_node_id(node_id: &str) -> String {
    let short_id: String = node_id.chars().take(8).collect();
    if short_id.is_empty() {
        node_id.to_string()
    } else {
        short_id
    }
}

fn resolve_node_coordinates(payload: &Value, index: usize) -> (f64, f64) {
    let coordinates = payload.get("layout").and_then(|layout| {
        let x = layout
            .get("x")
            .and_then(Value::as_f64)
            .filter(|value| value.is_finite());
        let y = layout
            .get("y")
            .and_then(Value::as_f64)
            .filter(|value| value.is_finite());

        match (x, y) {
            (Some(x), Some(y)) => Some((x, y)),
            _ => None,
        }
    });

    coordinates.unwrap_or_else(|| auto_layout_coordinates(index))
}

fn project_media_index_summary(record: MediaIndexSummaryRecord) -> ProjectMediaIndexSummary {
    ProjectMediaIndexSummary {
        asset_count: record.asset_count,
        image_count: record.image_count,
        video_count: record.video_count,
        audio_count: record.audio_count,
        document_count: record.document_count,
        other_count: record.other_count,
        ready_thumbnail_count: record.ready_thumbnail_count,
        missing_thumbnail_count: record.missing_thumbnail_count,
        unsupported_thumbnail_count: record.unsupported_thumbnail_count,
        pending_job_count: record.pending_job_count,
        failed_job_count: record.failed_job_count,
        last_indexed_at: record.last_indexed_at,
    }
}

fn project_asset_summary(record: AssetListItemRecord) -> Result<ProjectAssetSummary, BackendError> {
    let relative_path = project_relative_asset_path(&record.relative_path);
    let missing = record.missing_at.is_some();
    let thumbnail_status = if record.media_type == "image" {
        match record.thumbnail_status.as_deref() {
            Some("ready") => "ready".to_string(),
            Some("pending") => "pending".to_string(),
            Some("error") => "error".to_string(),
            _ => "missing".to_string(),
        }
    } else {
        "unsupported".to_string()
    };
    let media_type = record.media_type;
    let thumbnail_path = if media_type == "image"
        && matches!(thumbnail_status.as_str(), "ready" | "pending" | "error")
    {
        record
            .thumbnail_relative_path
            .map(|value| value.replace('\\', "/"))
    } else {
        None
    };

    Ok(ProjectAssetSummary {
        id: record.id,
        relative_path,
        media_type,
        mime_type: record.mime_type,
        byte_size: record.byte_size.and_then(|value| u64::try_from(value).ok()),
        width: record.width.and_then(|value| u32::try_from(value).ok()),
        height: record.height.and_then(|value| u32::try_from(value).ok()),
        duration_ms: record
            .duration_ms
            .and_then(|value| u64::try_from(value).ok()),
        thumbnail_status,
        thumbnail_path,
        indexed_at: record.indexed_at,
        missing,
    })
}

fn project_relative_asset_path(relative_path: &str) -> String {
    let normalized = relative_path.replace('\\', "/");
    if normalized.starts_with("assets/") {
        normalized
    } else {
        format!("assets/{normalized}")
    }
}

fn auto_layout_coordinates(index: usize) -> (f64, f64) {
    const GRID_COLUMNS: usize = 4;
    const START_X: f64 = 48.0;
    const START_Y: f64 = 48.0;
    const CELL_WIDTH: f64 = 220.0;
    const CELL_HEIGHT: f64 = 200.0;
    const GAP_X: f64 = 32.0;
    const GAP_Y: f64 = 32.0;

    let column = index % GRID_COLUMNS;
    let row = index / GRID_COLUMNS;

    (
        START_X + column as f64 * (CELL_WIDTH + GAP_X),
        START_Y + row as f64 * (CELL_HEIGHT + GAP_Y),
    )
}

fn node_size_for_summary(node_type: &str, payload: &Value) -> (f64, f64) {
    if node_type == "system_anchor" {
        if let Some(source_type) = source_node_type(payload) {
            return node_size_preset(&source_type);
        }
    }

    node_size_preset(node_type)
}

fn node_size_preset(node_type: &str) -> (f64, f64) {
    match node_type {
        "brief" => (208.0, 128.0),
        "storyboard_shot" => (220.0, 200.0),
        "system_anchor" => (208.0, 128.0),
        "prompt" | "reference" | "still" | "video" | "review" | "result" => (220.0, 200.0),
        _ => (220.0, 200.0),
    }
}
