use std::fs;
use std::path::Path;

use producer_backend::{
    commands::{
        activate_graph, bind_node_asset, create_graph_edge, create_graph_node, delete_graph_edge,
        get_graph_node_detail, get_project_media_index_summary, list_graph_edges,
        list_graph_node_type_options, list_graph_nodes, list_graph_relation_type_options,
        list_project_assets, open_node_child_graph, refresh_project_media_index, unbind_node_asset,
        update_graph_node_payload, update_graph_node_position, delete_graph_node,
    },
    domain::{
        pathing::ProjectPaths,
        project::{
            ActivateGraphRequest, Backend, BindNodeAssetRequest, CreateGraphEdgeRequest,
            CreateGraphNodeRequest, CreateProjectRequest, DeleteGraphEdgeRequest,
            DeleteGraphNodeRequest, GetGraphNodeDetailRequest,
            GetProjectMediaIndexSummaryRequest, GraphNodePosition, GraphNodeTypeOption,
            GraphNodeTypeOptionRequest, GraphNodeTypeOptionSize, ListGraphEdgesRequest,
            ListGraphNodesRequest, ListGraphRelationTypeOptionsRequest,
            ListProjectAssetsRequest, OpenNodeChildGraphRequest, ProjectPathRequest,
            RefreshProjectMediaIndexRequest, UnbindNodeAssetRequest,
            UpdateGraphNodePayloadRequest, UpdateGraphNodePositionRequest,
        },
        storage::{AssetRecord, Storage},
        template::{
            LayerSpec, RootGraphSeed, SystemAnchorSpec, TemplateManifest, TemplateRegistry,
        },
    },
};
use rusqlite::params;
use serde_json::json;
use tempfile::tempdir;

fn insert_graph_record(project_root: &std::path::Path, graph_id: &str, graph_name: &str) {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    conn.execute(
        "INSERT INTO graphs (id, layer_type, name, is_root, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![graph_id, "storyboard", graph_name, 0_i64, "1", "1"],
    )
    .expect("graph record should insert");
}

fn insert_graph_record_for_layer(
    project_root: &std::path::Path,
    graph_id: &str,
    graph_name: &str,
    layer_type: &str,
    created_at: &str,
) {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    conn.execute(
        "INSERT INTO graphs (id, layer_type, name, is_root, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            graph_id, layer_type, graph_name, 0_i64, created_at, created_at
        ],
    )
    .expect("graph record should insert");
}

fn insert_node_record(
    project_root: &std::path::Path,
    node_id: &str,
    graph_id: &str,
    node_type: &str,
    payload_json: serde_json::Value,
    created_at: &str,
) {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    conn.execute(
        "INSERT INTO nodes (id, graph_id, node_type, payload_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            node_id,
            graph_id,
            node_type,
            payload_json.to_string(),
            created_at,
            created_at
        ],
    )
    .expect("node record should insert");
}

fn insert_raw_node_record(
    project_root: &std::path::Path,
    node_id: &str,
    graph_id: &str,
    node_type: &str,
    payload_json: &str,
    created_at: &str,
) {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    conn.execute(
        "INSERT INTO nodes (id, graph_id, node_type, payload_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            node_id,
            graph_id,
            node_type,
            payload_json,
            created_at,
            created_at
        ],
    )
    .expect("node record should insert");
}

fn table_row_count(project_root: &std::path::Path, table: &str) -> i64 {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
        row.get(0)
    })
    .expect("row count should load")
}

fn load_node_payload(project_root: &std::path::Path, node_id: &str) -> serde_json::Value {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    let payload_json: String = conn
        .query_row(
            "SELECT payload_json FROM nodes WHERE id = ?1 LIMIT 1",
            params![node_id],
            |row| row.get(0),
        )
        .expect("node payload should load");

    serde_json::from_str(&payload_json).expect("node payload should parse")
}

fn load_latest_app_event(project_root: &std::path::Path) -> (String, serde_json::Value) {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    let (event_type, payload_json): (String, String) = conn
        .query_row(
            "SELECT event_type, payload_json FROM app_events ORDER BY id DESC LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("app event should load");

    (
        event_type,
        serde_json::from_str(&payload_json).expect("app event payload should parse"),
    )
}

fn load_latest_job(project_root: &std::path::Path) -> (String, String, serde_json::Value) {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    let (job_type, status, payload_json): (String, String, String) = conn
        .query_row(
            "SELECT job_type, status, payload_json FROM jobs ORDER BY created_at DESC, id DESC LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("job should load");

    (
        job_type,
        status,
        serde_json::from_str(&payload_json).expect("job payload should parse"),
    )
}

fn load_asset_relative_paths(project_root: &std::path::Path) -> Vec<String> {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    let mut statement = conn
        .prepare("SELECT relative_path FROM assets ORDER BY relative_path ASC")
        .expect("asset query should prepare");
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .expect("asset query should run");

    rows.collect::<Result<Vec<_>, _>>()
        .expect("asset rows should load")
}

fn count_nodes_by_type(project_root: &std::path::Path, graph_id: &str, node_type: &str) -> i64 {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    conn.query_row(
        "SELECT COUNT(*) FROM nodes WHERE graph_id = ?1 AND node_type = ?2",
        params![graph_id, node_type],
        |row| row.get(0),
    )
    .expect("node count should load")
}

fn load_graph_context(
    project_root: &std::path::Path,
    graph_id: &str,
) -> (Option<String>, Option<String>) {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    conn.query_row(
        "SELECT parent_graph_id, source_node_id FROM graphs WHERE id = ?1 LIMIT 1",
        params![graph_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .expect("graph context should load")
}

fn load_graph_ids(project_root: &std::path::Path) -> Vec<String> {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    let mut statement = conn
        .prepare("SELECT id FROM graphs ORDER BY id ASC")
        .expect("graph id query should prepare");
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .expect("graph id query should run");

    rows.collect::<Result<Vec<_>, _>>()
        .expect("graph ids should load")
}

fn load_node_system_flag(project_root: &std::path::Path, node_id: &str) -> i64 {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    conn.query_row(
        "SELECT is_system FROM nodes WHERE id = ?1 LIMIT 1",
        params![node_id],
        |row| row.get(0),
    )
    .expect("node system flag should load")
}

fn table_columns(database_path: &std::path::Path, table: &str) -> Vec<String> {
    let conn = rusqlite::Connection::open(database_path).expect("database should open");
    let mut statement = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .expect("pragma table_info should prepare");
    let rows = statement
        .query_map([], |row| row.get::<_, String>(1))
        .expect("table_info query should run");

    rows.collect::<Result<Vec<_>, _>>()
        .expect("table columns should load")
}

fn index_exists(database_path: &std::path::Path, index_name: &str) -> bool {
    let conn = rusqlite::Connection::open(database_path).expect("database should open");
    let exists: i64 = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?1)",
            params![index_name],
            |row| row.get(0),
        )
        .expect("index lookup should work");

    exists == 1
}

fn insert_system_node_record(
    project_root: &std::path::Path,
    node_id: &str,
    graph_id: &str,
    payload_json: serde_json::Value,
    created_at: &str,
) {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    conn.execute(
        "INSERT INTO nodes (id, graph_id, node_type, is_system, payload_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            node_id,
            graph_id,
            "system_anchor",
            1_i64,
            payload_json.to_string(),
            created_at,
            created_at
        ],
    )
    .expect("system node record should insert");
}

fn upsert_asset_record(
    project_root: &std::path::Path,
    asset_id: &str,
    relative_path: &str,
    media_type: &str,
    mime_type: Option<&str>,
    indexed_at: &str,
) {
    let paths = ProjectPaths::new(project_root);
    let storage = Storage::open(paths.database_path()).expect("storage should open");
    storage
        .apply_migrations()
        .expect("migrations should apply before asset insert");
    storage
        .upsert_asset(&AssetRecord {
            id: Some(asset_id.to_string()),
            relative_path: relative_path.to_string(),
            media_type: media_type.to_string(),
            mime_type: mime_type.map(str::to_string),
            byte_size: Some(1_024),
            sha256: Some(format!("sha-{asset_id}")),
            width: Some(1_280),
            height: Some(720),
            duration_ms: None,
            modified_at: Some(indexed_at.to_string()),
            indexed_at: Some(indexed_at.to_string()),
            missing_at: None,
            created_at: indexed_at.to_string(),
            updated_at: indexed_at.to_string(),
        })
        .expect("asset record should upsert");
}

fn insert_node_asset_binding(
    project_root: &std::path::Path,
    node_id: &str,
    asset_id: &str,
    role: &str,
    created_at: &str,
) {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    conn.execute(
        "INSERT INTO node_assets (node_id, asset_id, role, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![node_id, asset_id, role, created_at],
    )
    .expect("node asset binding should insert");
}

fn load_node_asset_bindings(
    project_root: &std::path::Path,
    node_id: &str,
) -> Vec<(String, String)> {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    let mut statement = conn
        .prepare(
            "SELECT asset_id, role
             FROM node_assets
             WHERE node_id = ?1
             ORDER BY created_at ASC, asset_id ASC, role ASC",
        )
        .expect("node asset binding query should prepare");
    let rows = statement
        .query_map(params![node_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .expect("node asset binding query should run");

    rows.collect::<Result<Vec<_>, _>>()
        .expect("node asset bindings should load")
}

fn load_graph_edges(
    project_root: &std::path::Path,
    graph_id: &str,
) -> Vec<(String, String, String, String)> {
    let paths = ProjectPaths::new(project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    let mut statement = conn
        .prepare(
            "SELECT id, source_node_id, target_node_id, edge_type
             FROM edges
             WHERE graph_id = ?1
             ORDER BY created_at ASC, id ASC",
        )
        .expect("edge query should prepare");
    let rows = statement
        .query_map(params![graph_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .expect("edge query should run");

    rows.collect::<Result<Vec<_>, _>>()
        .expect("edges should load")
}

fn write_test_png(path: &Path, width: u32, height: u32, rgba: [u8; 4]) {
    let image = image::RgbaImage::from_pixel(width, height, image::Rgba(rgba));
    image.save(path).expect("png should save");
}

#[test]
fn lists_embedded_template() {
    let backend = Backend::new().expect("backend should initialize");
    let templates = backend
        .list_available_templates()
        .expect("embedded templates should load");

    assert_eq!(templates.len(), 1);
    let template = &templates[0];
    assert_eq!(template.id, "ecommerce_ad_v1");
    assert!(template.layer_types.iter().any(|value| value == "brief"));
    assert!(
        template
            .layer_types
            .iter()
            .any(|value| value == "storyboard")
    );
}

#[test]
fn validates_template_manifest_and_rejects_unknown_root_layer_type() {
    let valid_manifest = TemplateManifest {
        id: "ecommerce_ad_v1".into(),
        version: 1,
        name: "Ecommerce Ad".into(),
        description: "Three-layer ecommerce workspace".into(),
        recommended: true,
        layer_specs: vec![
            LayerSpec {
                layer_type: "brief".into(),
                display_name: "Brief".into(),
                allowed_node_types: vec!["brief".into()],
                system_anchor: None,
                child_canvas_for: Some("brief".into()),
                default_relations: vec!["contains".into()],
            },
            LayerSpec {
                layer_type: "storyboard".into(),
                display_name: "Storyboard".into(),
                allowed_node_types: vec!["storyboard_shot".into()],
                system_anchor: Some(SystemAnchorSpec {
                    title: "Brief Anchor".into(),
                    source_node_type: "brief".into(),
                }),
                child_canvas_for: Some("storyboard_shot".into()),
                default_relations: vec!["references".into(), "approved_from".into()],
            },
        ],
        root_graph_seed: RootGraphSeed {
            layer_type: "brief".into(),
            graph_name: "Brief".into(),
        },
    };

    valid_manifest
        .validate()
        .expect("valid manifest should pass validation");

    let invalid_manifest = TemplateManifest {
        root_graph_seed: RootGraphSeed {
            layer_type: "unknown".into(),
            graph_name: "Brief".into(),
        },
        ..valid_manifest
    };

    let error = invalid_manifest
        .validate()
        .expect_err("unknown root graph layer type should fail validation");

    assert_eq!(error.code, "invalid_template_manifest");
}

#[test]
fn embedded_registry_returns_ecommerce_template() {
    let registry = TemplateRegistry::load_embedded().expect("template registry should load");
    let manifest = registry
        .template("ecommerce_ad_v1")
        .expect("known template should exist");

    assert_eq!(manifest.id, "ecommerce_ad_v1");
    assert_eq!(manifest.root_graph_seed.layer_type, "brief");
    assert!(
        manifest
            .layer_types()
            .iter()
            .any(|value| value == "shot_lab")
    );
    assert!(
        manifest
            .allowed_node_kinds_by_layer()
            .get("shot_lab")
            .expect("shot lab layer should exist")
            .iter()
            .any(|value| value == "video")
    );
}

#[test]
fn creates_project_layout_and_opens_existing_project() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("launch-campaign");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Launch Campaign".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let paths = ProjectPaths::new(&project_root);
    assert!(paths.producer_dir().is_dir());
    assert!(paths.database_path().is_file());
    assert!(paths.settings_path().is_file());
    assert!(paths.assets_dir().is_dir());
    assert!(paths.exports_dir().is_dir());
    assert!(paths.assets_dir().join("images").is_dir());
    assert!(paths.producer_dir().join("thumbnails").is_dir());
    assert_eq!(created.project_name, "Launch Campaign");
    assert_eq!(created.project_path, project_root.display().to_string());
    assert_eq!(created.template_id, "ecommerce_ad_v1");
    assert_eq!(created.root_graph.layer_type, "brief");
    assert_eq!(created.graph_count, 1);
    assert_eq!(created.active_graph, created.root_graph);
    assert_eq!(created.available_graphs, vec![created.root_graph.clone()]);

    let reopened = backend
        .open_project(ProjectPathRequest {
            project_root: Some(project_root.display().to_string()),
            session_id: None,
        })
        .expect("created project should open");

    assert_eq!(reopened.project_id, created.project_id);
    assert_eq!(
        reopened.root_graph.layer_type,
        created.root_graph.layer_type
    );
    assert_eq!(reopened.active_graph, reopened.root_graph);
    assert_eq!(reopened.available_graphs, vec![reopened.root_graph.clone()]);
}

#[test]
fn detects_invalid_project_root() {
    let temp = tempdir().expect("tempdir");
    let backend = Backend::new().expect("backend should initialize");
    let error = backend
        .open_project(ProjectPathRequest {
            project_root: Some(temp.path().display().to_string()),
            session_id: None,
        })
        .expect_err("missing producer metadata should be rejected");

    assert_eq!(error.code, "invalid_project");
}

#[test]
fn migrations_are_idempotent() {
    let temp = tempdir().expect("tempdir");
    let database_path = temp.path().join("project.db");
    let storage = Storage::open(&database_path).expect("storage should open");

    storage
        .apply_migrations()
        .expect("first migration run should succeed");
    storage
        .apply_migrations()
        .expect("second migration run should also succeed");

    for table in [
        "project_meta",
        "graphs",
        "nodes",
        "edges",
        "assets",
        "asset_derivatives",
        "node_assets",
        "jobs",
        "app_events",
        "search_documents",
    ] {
        assert!(
            storage
                .table_exists(table)
                .expect("table lookup should work"),
            "expected table {table} to exist after migrations"
        );
    }

    let graph_columns = table_columns(&database_path, "graphs");
    assert!(
        graph_columns
            .iter()
            .any(|column| column == "parent_graph_id"),
        "graphs table should include parent_graph_id after Module G migration"
    );
    assert!(
        graph_columns
            .iter()
            .any(|column| column == "source_node_id"),
        "graphs table should include source_node_id after Module G migration"
    );

    let node_columns = table_columns(&database_path, "nodes");
    assert!(
        node_columns.iter().any(|column| column == "is_system"),
        "nodes table should include is_system after Module G migration"
    );

    let asset_columns = table_columns(&database_path, "assets");
    for column in [
        "mime_type",
        "byte_size",
        "sha256",
        "width",
        "height",
        "duration_ms",
        "modified_at",
        "indexed_at",
        "missing_at",
    ] {
        assert!(
            asset_columns.iter().any(|existing| existing == column),
            "assets table should include {column} after Module H migration"
        );
    }
}

#[test]
fn project_creation_seeds_only_root_brief_graph() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("seed-check");
    let backend = Backend::new().expect("backend should initialize");

    backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Seed Check".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let storage = Storage::open(ProjectPaths::new(&project_root).database_path())
        .expect("storage should open for seeded project");

    assert_eq!(storage.count_graphs().expect("graph count should load"), 1);
    let root_graph = storage
        .load_root_graph()
        .expect("root graph should be present");
    assert_eq!(root_graph.layer_type, "brief");
    assert!(root_graph.is_root);
}

#[test]
fn asset_paths_are_recorded_relative_to_assets_directory() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("assets-check");
    fs::create_dir_all(project_root.join("assets/images")).expect("asset tree should exist");
    let asset_path = project_root.join("assets/images/product.png");
    fs::write(&asset_path, b"png").expect("asset file should exist");

    let paths = ProjectPaths::new(&project_root);
    let relative = paths
        .relative_asset_path(&asset_path)
        .expect("asset path under assets directory should relativize");

    assert_eq!(relative.to_string_lossy(), "images/product.png");
}

#[test]
fn returns_cached_project_session_after_creation() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("cached-session");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Cached Session".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let resolved = backend
        .get_project_session(ProjectPathRequest {
            project_root: None,
            session_id: Some(created.session_id.clone()),
        })
        .expect("session lookup should succeed")
        .expect("session should be cached");

    assert_eq!(resolved.project_id, created.project_id);
    assert_eq!(resolved.project_name, created.project_name);
    assert_eq!(resolved.active_graph, created.root_graph);
    assert_eq!(resolved.available_graphs, vec![created.root_graph.clone()]);
}

#[test]
fn opens_most_recent_project_from_default_projects_directory_when_no_path_is_given() {
    let temp = tempdir().expect("tempdir");
    let projects_root = temp.path().join("producer-projects");
    unsafe {
        std::env::set_var("PRODUCER_PROJECTS_DIR", &projects_root);
    }

    let backend = Backend::new().expect("backend should initialize");
    let created = backend
        .create_project(CreateProjectRequest {
            project_root: None,
            project_name: Some("Recent Project".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created in default projects directory");

    let reopened = backend
        .open_project(ProjectPathRequest {
            project_root: None,
            session_id: Some("missing-session".into()),
        })
        .expect("backend should reopen the most recent project");

    assert_eq!(reopened.project_id, created.project_id);
    assert!(
        reopened
            .project_path
            .starts_with(projects_root.to_string_lossy().as_ref())
    );

    unsafe {
        std::env::remove_var("PRODUCER_PROJECTS_DIR");
    }
}

#[test]
fn activate_graph_rejects_unknown_graph_id() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("activate-unknown");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Activate Unknown".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let error = activate_graph(ActivateGraphRequest {
        project_root: None,
        session_id: Some(created.session_id),
        graph_id: "missing-graph".into(),
    })
    .expect_err("unknown graph should fail activation");

    assert_eq!(error.code, "graph_not_found");
}

#[test]
fn activate_graph_switches_to_second_graph_and_preserves_cached_selection_on_reload() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("activate-second");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Activate Second".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");
    let session_id = created.session_id.clone();

    insert_graph_record(&project_root, "storyboard-graph", "Storyboard");

    let activated = activate_graph(ActivateGraphRequest {
        project_root: Some(project_root.display().to_string()),
        session_id: Some(session_id.clone()),
        graph_id: "storyboard-graph".into(),
    })
    .expect("existing graph should activate");

    assert_eq!(activated.session_id, session_id);
    assert_eq!(activated.active_graph.id, "storyboard-graph");
    assert_eq!(activated.graph_count, 2);
    assert_eq!(activated.available_graphs.len(), 2);
    assert_eq!(activated.available_graphs[0], activated.root_graph);
    assert_eq!(activated.available_graphs[1].id, "storyboard-graph");

    let reopened = backend
        .open_project(ProjectPathRequest {
            project_root: Some(project_root.display().to_string()),
            session_id: None,
        })
        .expect("project should reopen");

    assert_eq!(reopened.root_graph.id, created.root_graph.id);
    assert_eq!(reopened.active_graph.id, "storyboard-graph");
    assert_eq!(reopened.available_graphs.len(), 2);
}

#[test]
fn open_node_child_graph_creates_storyboard_graph_anchor_and_graph_trail() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("open-brief-child-graph");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Open Brief Child Graph".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let brief_detail = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_type: "brief".into(),
        position: GraphNodePosition { x: 120.0, y: 240.0 },
        payload: json!({
            "title": "Hero Campaign Brief",
            "status": "draft"
        }),
    })
    .expect("brief node should be created");

    let opened = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_id: brief_detail.id.clone(),
    })
    .expect("brief node child graph should open");

    assert_eq!(opened.active_graph.layer_type, "storyboard");
    assert_eq!(opened.available_graphs.len(), 2);
    assert_eq!(opened.graph_trail.len(), 2);
    assert_eq!(opened.graph_trail[0].graph_id, created.root_graph.id);
    assert_eq!(opened.graph_trail[1].graph_id, opened.active_graph.id);
    assert_eq!(
        opened.graph_trail[1].source_node_id.as_deref(),
        Some(brief_detail.id.as_str())
    );
    assert_eq!(
        opened.graph_trail[1].source_node_title.as_deref(),
        Some("Hero Campaign Brief")
    );

    let (parent_graph_id, source_node_id) =
        load_graph_context(&project_root, &opened.active_graph.id);
    assert_eq!(
        parent_graph_id.as_deref(),
        Some(created.root_graph.id.as_str())
    );
    assert_eq!(source_node_id.as_deref(), Some(brief_detail.id.as_str()));

    assert_eq!(
        count_nodes_by_type(&project_root, &opened.active_graph.id, "system_anchor"),
        1
    );

    let child_nodes = list_graph_nodes(ListGraphNodesRequest {
        session_id: Some(opened.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: opened.active_graph.id.clone(),
    })
    .expect("child graph nodes should load");

    assert_eq!(child_nodes.len(), 1);
    assert_eq!(child_nodes[0].node_type, "system_anchor");
    assert!(child_nodes[0].is_system);
    assert!(!child_nodes[0].can_enter_child_graph);
    assert_eq!(child_nodes[0].title, "Hero Campaign Brief");
    assert_eq!(child_nodes[0].layout.width, 208.0);
    assert_eq!(child_nodes[0].layout.height, 128.0);
    assert_eq!(
        serde_json::to_value(&child_nodes[0])
            .expect("anchor summary should serialize")
            .get("sourceNodeType"),
        Some(&json!("brief"))
    );

    let anchor_detail = get_graph_node_detail(GetGraphNodeDetailRequest {
        session_id: Some(opened.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: child_nodes[0].graph_id.clone(),
        node_id: child_nodes[0].id.clone(),
    })
    .expect("anchor detail should load");

    assert_eq!(load_node_system_flag(&project_root, &anchor_detail.id), 1);
    assert_eq!(
        anchor_detail.payload.get("source_node_id"),
        Some(&json!(brief_detail.id))
    );
    assert_eq!(
        anchor_detail.payload.get("source_node_type"),
        Some(&json!("brief"))
    );
    assert_eq!(
        anchor_detail.payload.get("source_node_title"),
        Some(&json!("Hero Campaign Brief"))
    );
    assert_eq!(anchor_detail.payload.get("locked"), Some(&json!(true)));
    assert_eq!(
        serde_json::to_value(&anchor_detail)
            .expect("anchor detail should serialize")
            .get("sourceNodeType"),
        Some(&json!("brief"))
    );
}

#[test]
fn open_node_child_graph_is_idempotent_and_persists_created_graphs_after_reopen() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("open-child-graph-idempotent");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Open Child Graph Idempotent".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let brief_detail = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_type: "brief".into(),
        position: GraphNodePosition { x: 60.0, y: 80.0 },
        payload: json!({
            "title": "Repeatable Brief"
        }),
    })
    .expect("brief node should be created");

    let first_open = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_id: brief_detail.id.clone(),
    })
    .expect("first child graph open should succeed");

    let graph_count_after_first_open = table_row_count(&project_root, "graphs");
    let node_count_after_first_open = table_row_count(&project_root, "nodes");

    let second_open = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(first_open.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_id: brief_detail.id,
    })
    .expect("second child graph open should reuse existing graph");

    assert_eq!(second_open.active_graph.id, first_open.active_graph.id);
    assert_eq!(
        table_row_count(&project_root, "graphs"),
        graph_count_after_first_open
    );
    assert_eq!(
        table_row_count(&project_root, "nodes"),
        node_count_after_first_open
    );
    assert_eq!(
        count_nodes_by_type(&project_root, &first_open.active_graph.id, "system_anchor"),
        1
    );

    let reopened = backend
        .open_project(ProjectPathRequest {
            project_root: Some(project_root.display().to_string()),
            session_id: None,
        })
        .expect("project should reopen");

    assert_eq!(reopened.active_graph.id, first_open.active_graph.id);
    assert_eq!(reopened.graph_trail.len(), 2);
    assert_eq!(reopened.graph_trail[1].graph_id, first_open.active_graph.id);
}

#[test]
fn open_node_child_graph_creates_shot_lab_graph_for_storyboard_shot() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("open-shot-lab-child-graph");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Open Shot Lab Child Graph".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let brief_detail = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_type: "brief".into(),
        position: GraphNodePosition { x: 32.0, y: 48.0 },
        payload: json!({
            "title": "Nested Brief"
        }),
    })
    .expect("brief node should be created");

    let storyboard_session = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_id: brief_detail.id,
    })
    .expect("storyboard graph should open");

    let shot_detail = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(storyboard_session.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: storyboard_session.active_graph.id.clone(),
        node_type: "storyboard_shot".into(),
        position: GraphNodePosition { x: 220.0, y: 180.0 },
        payload: json!({
            "title": "Shot 03"
        }),
    })
    .expect("storyboard shot should be created");

    let shot_lab_session = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(storyboard_session.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: storyboard_session.active_graph.id.clone(),
        node_id: shot_detail.id.clone(),
    })
    .expect("shot lab graph should open");

    assert_eq!(shot_lab_session.active_graph.layer_type, "shot_lab");
    assert_eq!(shot_lab_session.graph_trail.len(), 3);
    assert_eq!(
        shot_lab_session.graph_trail[2].source_node_id.as_deref(),
        Some(shot_detail.id.as_str())
    );
    assert_eq!(
        shot_lab_session.graph_trail[2].source_node_title.as_deref(),
        Some("Shot 03")
    );
    assert_eq!(
        count_nodes_by_type(
            &project_root,
            &shot_lab_session.active_graph.id,
            "system_anchor"
        ),
        1
    );
    let shot_lab_nodes = list_graph_nodes(ListGraphNodesRequest {
        session_id: Some(shot_lab_session.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: shot_lab_session.active_graph.id.clone(),
    })
    .expect("shot lab nodes should load");
    let anchor_node = shot_lab_nodes
        .into_iter()
        .find(|node| node.is_system)
        .expect("shot lab graph should contain an anchor node");
    assert_eq!(anchor_node.layout.width, 220.0);
    assert_eq!(anchor_node.layout.height, 200.0);
    assert_eq!(
        serde_json::to_value(&anchor_node)
            .expect("shot lab anchor should serialize")
            .get("sourceNodeType"),
        Some(&json!("storyboard_shot"))
    );
}

#[test]
fn open_node_child_graph_rejects_nodes_without_supported_child_canvas_and_system_anchors() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("open-child-graph-invalid");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Open Child Graph Invalid".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let brief_detail = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_type: "brief".into(),
        position: GraphNodePosition { x: 40.0, y: 72.0 },
        payload: json!({
            "title": "Reject Invalid Child Canvas"
        }),
    })
    .expect("brief node should be created");

    let storyboard_session = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_id: brief_detail.id,
    })
    .expect("storyboard graph should open");

    let unsupported_node = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(storyboard_session.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: storyboard_session.active_graph.id.clone(),
        node_type: "storyboard_shot".into(),
        position: GraphNodePosition { x: 80.0, y: 120.0 },
        payload: json!({
            "title": "Shot That Can Open"
        }),
    })
    .expect("storyboard shot should be created");

    let shot_lab_session = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(storyboard_session.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: storyboard_session.active_graph.id.clone(),
        node_id: unsupported_node.id,
    })
    .expect("shot lab graph should open");

    let shot_lab_user_node = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(shot_lab_session.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: shot_lab_session.active_graph.id.clone(),
        node_type: "prompt".into(),
        position: GraphNodePosition { x: 180.0, y: 160.0 },
        payload: json!({
            "title": "Prompt Without Child Canvas"
        }),
    })
    .expect("prompt node should be created");

    let unsupported_error = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(shot_lab_session.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: shot_lab_session.active_graph.id.clone(),
        node_id: shot_lab_user_node.id,
    })
    .expect_err("prompt should not support child canvas");
    assert_eq!(unsupported_error.code, "child_graph_not_supported");

    let anchor_node = list_graph_nodes(ListGraphNodesRequest {
        session_id: Some(shot_lab_session.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: shot_lab_session.active_graph.id.clone(),
    })
    .expect("shot lab nodes should load")
    .into_iter()
    .find(|node| node.is_system)
    .expect("shot lab graph should contain an anchor node");

    let anchor_error = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(shot_lab_session.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: anchor_node.graph_id,
        node_id: anchor_node.id,
    })
    .expect_err("system anchors must not support child canvas");
    assert_eq!(anchor_error.code, "child_graph_not_supported");
}

#[test]
fn refresh_project_media_index_indexes_images_and_generates_thumbnail_cache() {
    let root = tempdir().expect("tempdir should create");
    let backend = Backend::new().expect("backend should initialize");
    let project_root = root.path().join("producer-media");
    let session = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Producer Media".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let image_path = ProjectPaths::new(&project_root)
        .assets_dir()
        .join("images")
        .join("hero-card.png");
    write_test_png(&image_path, 48, 32, [240, 128, 64, 255]);
    fs::write(
        ProjectPaths::new(&project_root)
            .assets_dir()
            .join("docs")
            .join("brief.txt"),
        "campaign brief",
    )
    .expect("document asset should write");

    let before = get_project_media_index_summary(GetProjectMediaIndexSummaryRequest {
        project_root: Some(project_root.display().to_string()),
        session_id: Some(session.session_id.clone()),
    })
    .expect("summary should load before refresh");

    assert_eq!(before.asset_count, 0);
    assert_eq!(before.ready_thumbnail_count, 0);
    assert_eq!(before.unsupported_thumbnail_count, 0);

    let refreshed = refresh_project_media_index(RefreshProjectMediaIndexRequest {
        project_root: Some(project_root.display().to_string()),
        session_id: Some(session.session_id.clone()),
        reason: Some("module_h_test".into()),
    })
    .expect("media index refresh should succeed");

    assert_eq!(refreshed.asset_count, 2);
    assert_eq!(refreshed.image_count, 1);
    assert_eq!(refreshed.document_count, 1);
    assert_eq!(refreshed.ready_thumbnail_count, 1);
    assert_eq!(refreshed.missing_thumbnail_count, 0);
    assert_eq!(refreshed.unsupported_thumbnail_count, 1);
    assert_eq!(refreshed.failed_job_count, 0);
    assert_eq!(refreshed.pending_job_count, 0);
    assert!(refreshed.last_indexed_at.is_some());

    let assets = list_project_assets(ListProjectAssetsRequest {
        project_root: Some(project_root.display().to_string()),
        session_id: Some(session.session_id),
        media_type: None,
        query: None,
        limit: None,
    })
    .expect("assets should list");

    assert_eq!(assets.len(), 2);
    assert_eq!(assets[0].relative_path, "assets/docs/brief.txt");
    assert_eq!(assets[0].media_type, "document");
    assert_eq!(assets[0].thumbnail_status, "unsupported");
    assert_eq!(assets[0].thumbnail_path, None);

    assert_eq!(assets[1].relative_path, "assets/images/hero-card.png");
    assert_eq!(assets[1].media_type, "image");
    assert_eq!(assets[1].width, Some(48));
    assert_eq!(assets[1].height, Some(32));
    assert_eq!(assets[1].thumbnail_status, "ready");
    assert_eq!(
        assets[1].thumbnail_path.as_deref(),
        Some(".producer/thumbnails/assets/images/hero-card.png")
    );

    let thumbnail_path = project_root.join(
        assets[1]
            .thumbnail_path
            .as_deref()
            .expect("image thumbnail path should exist"),
    );
    assert!(
        thumbnail_path.is_file(),
        "thumbnail should be written to disk"
    );
    assert_eq!(
        load_asset_relative_paths(&project_root),
        vec![
            "assets/docs/brief.txt".to_string(),
            "assets/images/hero-card.png".to_string()
        ]
    );

    let paths = ProjectPaths::new(&project_root);
    let conn = rusqlite::Connection::open(paths.database_path()).expect("database should open");
    let asset_record_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM assets", [], |row| row.get(0))
        .expect("asset count should load");
    let derivative_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM asset_derivatives", [], |row| {
            row.get(0)
        })
        .expect("derivative count should load");

    assert_eq!(asset_record_count, 2);
    assert_eq!(derivative_count, 1);

    let (job_type, status, payload) = load_latest_job(&project_root);
    assert_eq!(job_type, "refresh_project_media_index");
    assert_eq!(status, "completed");
    assert_eq!(
        payload,
        json!({
            "assetCount": 2,
            "readyThumbnailCount": 1,
            "missingThumbnailCount": 0,
            "unsupportedThumbnailCount": 1,
            "reason": "module_h_test"
        })
    );

    let (event_type, event_payload) = load_latest_app_event(&project_root);
    assert_eq!(event_type, "project_media_index_refreshed");
    assert_eq!(
        event_payload,
        json!({
            "assetCount": 2,
            "imageCount": 1,
            "documentCount": 1,
            "readyThumbnailCount": 1
        })
    );
}

#[test]
fn refresh_project_media_index_cleans_stale_thumbnail_cache_entries_for_deleted_assets() {
    let root = tempdir().expect("tempdir should create");
    let backend = Backend::new().expect("backend should initialize");
    let project_root = root.path().join("producer-media-repeat");
    let session = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Producer Media Repeat".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");
    let paths = ProjectPaths::new(&project_root);

    let image_path = paths.assets_dir().join("images").join("frame.png");
    write_test_png(&image_path, 16, 16, [16, 32, 48, 255]);

    let first = refresh_project_media_index(RefreshProjectMediaIndexRequest {
        project_root: Some(project_root.display().to_string()),
        session_id: Some(session.session_id.clone()),
        reason: Some("first_pass".into()),
    })
    .expect("first refresh should succeed");
    let listed = list_project_assets(ListProjectAssetsRequest {
        project_root: Some(project_root.display().to_string()),
        session_id: Some(session.session_id.clone()),
        media_type: None,
        query: None,
        limit: None,
    })
    .expect("assets should list after first refresh");

    assert_eq!(first.asset_count, 1);
    assert_eq!(first.image_count, 1);
    assert_eq!(first.ready_thumbnail_count, 1);
    assert_eq!(listed.len(), 1);

    let thumbnail_path = project_root
        .join(
            listed
                .iter()
                .find(|asset| asset.relative_path == "assets/images/frame.png")
                .and_then(|asset| asset.thumbnail_path.as_deref())
                .expect("thumbnail path should exist"),
        )
        .to_path_buf();
    assert!(
        thumbnail_path.is_file(),
        "thumbnail should exist after first refresh"
    );

    fs::remove_file(&image_path).expect("source image should delete");

    let second = refresh_project_media_index(RefreshProjectMediaIndexRequest {
        project_root: None,
        session_id: Some(session.session_id),
        reason: Some("cleanup".into()),
    })
    .expect("cleanup refresh should succeed");

    assert_eq!(second.asset_count, 0);
    assert_eq!(second.ready_thumbnail_count, 0);
    assert_eq!(second.missing_thumbnail_count, 0);
    assert_eq!(second.unsupported_thumbnail_count, 0);
    assert!(
        list_project_assets(ListProjectAssetsRequest {
            project_root: Some(project_root.display().to_string()),
            session_id: None,
            media_type: None,
            query: None,
            limit: None,
        })
        .expect("assets should list after cleanup")
        .is_empty()
    );
    assert_eq!(table_row_count(&project_root, "assets"), 0);
    assert_eq!(table_row_count(&project_root, "asset_derivatives"), 0);
    assert_eq!(table_row_count(&project_root, "jobs"), 2);
    assert!(
        !thumbnail_path.exists(),
        "stale thumbnail should be removed"
    );
}

#[test]
fn list_graph_nodes_returns_empty_array_for_new_root_graph() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("empty-root-graph");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Empty Root Graph".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let nodes = list_graph_nodes(ListGraphNodesRequest {
        session_id: Some(created.session_id),
        project_root: None,
        graph_id: created.root_graph.id,
    })
    .expect("empty root graph should load");

    assert!(nodes.is_empty());
}

#[test]
fn list_graph_node_type_options_returns_only_brief_for_brief_graph() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("brief-node-options");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Brief Node Options".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let node_count_before = table_row_count(&project_root, "nodes");
    let app_event_count_before = table_row_count(&project_root, "app_events");

    let options = list_graph_node_type_options(GraphNodeTypeOptionRequest {
        session_id: Some(created.session_id),
        project_root: None,
        graph_id: created.root_graph.id,
    })
    .expect("brief graph options should load");

    assert_eq!(
        options,
        vec![GraphNodeTypeOption {
            node_type: "brief".into(),
            label: "Brief".into(),
            description: Some("High-level campaign brief and constraints.".into()),
            default_title: "New Brief".into(),
            default_size: GraphNodeTypeOptionSize {
                width: 208.0,
                height: 128.0,
            },
        }]
    );
    assert_eq!(table_row_count(&project_root, "nodes"), node_count_before);
    assert_eq!(
        table_row_count(&project_root, "app_events"),
        app_event_count_before
    );
}

#[test]
fn list_graph_node_type_options_excludes_system_anchor_types_for_storyboard_graph() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("storyboard-node-options");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Storyboard Node Options".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "storyboard-node-options-graph",
        "Storyboard Node Options",
        "storyboard",
        "10",
    );

    let options = list_graph_node_type_options(GraphNodeTypeOptionRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: "storyboard-node-options-graph".into(),
    })
    .expect("storyboard graph options should load");

    assert_eq!(
        options,
        vec![GraphNodeTypeOption {
            node_type: "storyboard_shot".into(),
            label: "Storyboard Shot".into(),
            description: Some("Single storyboard frame for a planned shot.".into()),
            default_title: "New Storyboard Shot".into(),
            default_size: GraphNodeTypeOptionSize {
                width: 220.0,
                height: 200.0,
            },
        }]
    );
    assert!(
        options.iter().all(|option| option.node_type != "brief"),
        "storyboard options must not expose the brief system anchor type"
    );
}

#[test]
fn list_graph_node_type_options_returns_shot_lab_whitelist_in_manifest_order() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("shot-lab-node-options");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Shot Lab Node Options".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "shot-lab-node-options-graph",
        "Shot Lab Node Options",
        "shot_lab",
        "20",
    );

    let options = list_graph_node_type_options(GraphNodeTypeOptionRequest {
        session_id: Some(created.session_id),
        project_root: None,
        graph_id: "shot-lab-node-options-graph".into(),
    })
    .expect("shot lab graph options should load");

    assert_eq!(
        options
            .iter()
            .map(|option| option.node_type.as_str())
            .collect::<Vec<_>>(),
        vec!["prompt", "still", "video", "reference", "review", "result"]
    );
    assert_eq!(
        options
            .iter()
            .map(|option| (
                option.node_type.as_str(),
                option.default_size.width,
                option.default_size.height,
            ))
            .collect::<Vec<_>>(),
        vec![
            ("prompt", 220.0, 200.0),
            ("still", 220.0, 200.0),
            ("video", 220.0, 200.0),
            ("reference", 220.0, 200.0),
            ("review", 220.0, 200.0),
            ("result", 220.0, 200.0),
        ]
    );
}

#[test]
fn list_graph_node_type_options_returns_clear_error_for_invalid_graph() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("missing-graph-node-options");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Missing Graph Node Options".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let error = list_graph_node_type_options(GraphNodeTypeOptionRequest {
        session_id: Some(created.session_id),
        project_root: None,
        graph_id: "missing-graph".into(),
    })
    .expect_err("missing graph should fail");

    assert_eq!(error.code, "graph_not_found");
    assert!(
        error.message.contains("missing-graph"),
        "expected missing graph id in error message"
    );
}

#[test]
fn graph_node_type_option_structs_serialize_with_camel_case_keys() {
    let request = GraphNodeTypeOptionRequest {
        session_id: Some("session-1".into()),
        project_root: Some("/tmp/project".into()),
        graph_id: "graph-1".into(),
    };
    let request_json = serde_json::to_value(&request).expect("request should serialize");
    assert_eq!(
        request_json,
        json!({
            "sessionId": "session-1",
            "projectRoot": "/tmp/project",
            "graphId": "graph-1"
        })
    );

    let option = GraphNodeTypeOption {
        node_type: "prompt".into(),
        label: "Prompt".into(),
        description: Some("Prompt card".into()),
        default_title: "New Prompt".into(),
        default_size: GraphNodeTypeOptionSize {
            width: 220.0,
            height: 200.0,
        },
    };
    let option_json = serde_json::to_value(&option).expect("response should serialize");
    assert_eq!(
        option_json,
        json!({
            "nodeType": "prompt",
            "label": "Prompt",
            "description": "Prompt card",
            "defaultTitle": "New Prompt",
            "defaultSize": {
                "width": 220.0,
                "height": 200.0
            }
        })
    );
}

#[test]
fn list_graph_nodes_loads_legal_nodes_for_one_graph() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("legal-node-load");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Legal Node Load".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_node_record(
        &project_root,
        "brief-node-12345678",
        &created.root_graph.id,
        "brief",
        json!({
            "title": "Campaign Brief",
            "status": "ready",
        }),
        "100",
    );

    let nodes = list_graph_nodes(ListGraphNodesRequest {
        session_id: None,
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
    })
    .expect("legal graph nodes should load");

    assert_eq!(nodes.len(), 1);
    let node = &nodes[0];
    assert_eq!(node.id, "brief-node-12345678");
    assert_eq!(node.graph_id, created.root_graph.id);
    assert_eq!(node.node_type, "brief");
    assert_eq!(node.title, "Campaign Brief");
    assert_eq!(node.status.as_deref(), Some("ready"));
    assert_eq!(node.stored_asset_count, 0);
    assert_eq!(node.layout.width, 208.0);
    assert_eq!(node.layout.height, 128.0);
}

#[test]
fn list_graph_nodes_reads_layout_coordinates_from_payload() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("payload-layout");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Payload Layout".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "storyboard-graph-layout",
        "Storyboard Layout",
        "storyboard",
        "10",
    );
    insert_node_record(
        &project_root,
        "storyboard-node-layout",
        "storyboard-graph-layout",
        "storyboard_shot",
        json!({
            "name": "Hero opener",
            "decision": "approved",
            "layout": {
                "x": 96.5,
                "y": 240.25
            }
        }),
        "11",
    );

    let nodes = list_graph_nodes(ListGraphNodesRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: "storyboard-graph-layout".into(),
    })
    .expect("graph nodes with payload layout should load");

    assert_eq!(nodes.len(), 1);
    let node = &nodes[0];
    assert_eq!(node.title, "Hero opener");
    assert_eq!(node.status.as_deref(), Some("approved"));
    assert_eq!(node.layout.x, 96.5);
    assert_eq!(node.layout.y, 240.25);
    assert_eq!(node.layout.width, 220.0);
    assert_eq!(node.layout.height, 200.0);
}

#[test]
fn list_graph_nodes_falls_back_to_deterministic_auto_layout_and_default_title() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("auto-layout");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Auto Layout".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "shot-lab-graph",
        "Shot Lab",
        "shot_lab",
        "20",
    );
    insert_node_record(
        &project_root,
        "bbbbbb22-node",
        "shot-lab-graph",
        "video",
        json!({
            "layout": {
                "x": "bad",
                "y": null
            }
        }),
        "31",
    );
    insert_node_record(
        &project_root,
        "aaaaaa11-node",
        "shot-lab-graph",
        "prompt",
        json!({}),
        "30",
    );

    let nodes = list_graph_nodes(ListGraphNodesRequest {
        session_id: Some(created.session_id),
        project_root: None,
        graph_id: "shot-lab-graph".into(),
    })
    .expect("graph nodes should auto-layout");

    assert_eq!(nodes.len(), 2);
    assert_eq!(nodes[0].id, "aaaaaa11-node");
    assert_eq!(nodes[0].title, "prompt aaaaaa11");
    assert_eq!(nodes[0].layout.x, 48.0);
    assert_eq!(nodes[0].layout.y, 48.0);
    assert_eq!(nodes[0].layout.width, 220.0);
    assert_eq!(nodes[0].layout.height, 200.0);

    assert_eq!(nodes[1].id, "bbbbbb22-node");
    assert_eq!(nodes[1].title, "video bbbbbb22");
    assert_eq!(nodes[1].layout.x, 300.0);
    assert_eq!(nodes[1].layout.y, 48.0);
    assert_eq!(nodes[1].layout.width, 220.0);
    assert_eq!(nodes[1].layout.height, 200.0);
}

#[test]
fn list_graph_nodes_rejects_node_types_outside_graph_layer_whitelist() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("invalid-node-type");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Invalid Node Type".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "storyboard-graph-invalid",
        "Storyboard Invalid",
        "storyboard",
        "20",
    );
    insert_node_record(
        &project_root,
        "invalid-prompt-node",
        "storyboard-graph-invalid",
        "prompt",
        json!({
            "title": "Illegal Prompt"
        }),
        "21",
    );

    let error = list_graph_nodes(ListGraphNodesRequest {
        session_id: Some(created.session_id),
        project_root: None,
        graph_id: "storyboard-graph-invalid".into(),
    })
    .expect_err("invalid node type should be rejected");

    assert_eq!(error.code, "invalid_graph_node");
    assert!(
        error.message.contains("prompt"),
        "expected error message to name offending node type"
    );
}

#[test]
fn list_graph_nodes_only_returns_nodes_from_requested_graph() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("graph-scoping");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Graph Scoping".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "storyboard-graph-scope",
        "Storyboard Scope",
        "storyboard",
        "10",
    );
    insert_node_record(
        &project_root,
        "storyboard-node-scope",
        "storyboard-graph-scope",
        "storyboard_shot",
        json!({
            "title": "Scoped Node"
        }),
        "11",
    );
    insert_node_record(
        &project_root,
        "root-brief-node",
        &created.root_graph.id,
        "brief",
        json!({
            "title": "Root Brief Node"
        }),
        "12",
    );

    let nodes = list_graph_nodes(ListGraphNodesRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: "storyboard-graph-scope".into(),
    })
    .expect("graph scoping should filter nodes");

    assert_eq!(nodes.len(), 1);
    assert_eq!(nodes[0].id, "storyboard-node-scope");
    assert_eq!(nodes[0].graph_id, "storyboard-graph-scope");
}

#[test]
fn get_graph_node_detail_returns_full_payload_for_legal_node() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("detail-legal-node");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Detail Legal Node".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let payload = json!({
        "title": "Campaign Brief",
        "status": "ready",
        "layout": {
            "x": 128.0,
            "y": 256.0
        },
        "meta": {
            "owner": "producer",
            "tags": ["launch", "hero"]
        }
    });
    insert_node_record(
        &project_root,
        "brief-node-detail",
        &created.root_graph.id,
        "brief",
        payload.clone(),
        "100",
    );

    let detail = get_graph_node_detail(GetGraphNodeDetailRequest {
        session_id: Some(created.session_id),
        project_root: None,
        graph_id: created.root_graph.id.clone(),
        node_id: "brief-node-detail".into(),
    })
    .expect("legal node detail should load");

    assert_eq!(detail.id, "brief-node-detail");
    assert_eq!(detail.graph_id, created.root_graph.id);
    assert_eq!(detail.node_type, "brief");
    assert_eq!(detail.title, "Campaign Brief");
    assert_eq!(detail.status.as_deref(), Some("ready"));
    assert_eq!(detail.layout.x, 128.0);
    assert_eq!(detail.layout.y, 256.0);
    assert_eq!(detail.layout.width, 208.0);
    assert_eq!(detail.layout.height, 128.0);
    assert_eq!(
        detail.payload,
        json!({
            "title": "Campaign Brief",
            "status": "ready",
            "meta": {
                "owner": "producer",
                "tags": ["launch", "hero"]
            }
        })
        .as_object()
        .expect("object payload should convert")
        .clone()
    );
}

#[test]
fn create_graph_node_persists_layout_in_payload_and_records_app_event() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("create-graph-node");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Create Graph Node".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let node_count_before = table_row_count(&project_root, "nodes");
    let app_event_count_before = table_row_count(&project_root, "app_events");

    let detail = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_type: "brief".into(),
        position: GraphNodePosition {
            x: 144.5,
            y: 288.25,
        },
        payload: json!({
            "title": "Producer Brief",
            "status": "draft",
            "meta": {
                "owner": "backend"
            }
        }),
    })
    .expect("graph node should be created");

    assert_eq!(
        table_row_count(&project_root, "nodes"),
        node_count_before + 1
    );
    assert_eq!(
        table_row_count(&project_root, "app_events"),
        app_event_count_before + 1
    );
    assert_eq!(detail.graph_id, created.root_graph.id);
    assert_eq!(detail.node_type, "brief");
    assert_eq!(detail.title, "Producer Brief");
    assert_eq!(detail.status.as_deref(), Some("draft"));
    assert_eq!(detail.layout.x, 144.5);
    assert_eq!(detail.layout.y, 288.25);
    assert_eq!(detail.layout.width, 208.0);
    assert_eq!(detail.layout.height, 128.0);
    assert_eq!(
        detail.payload,
        json!({
            "title": "Producer Brief",
            "status": "draft",
            "meta": {
                "owner": "backend"
            }
        })
        .as_object()
        .expect("payload should be object")
        .clone()
    );

    let stored_payload = load_node_payload(&project_root, &detail.id);
    assert_eq!(
        stored_payload,
        json!({
            "title": "Producer Brief",
            "status": "draft",
            "meta": {
                "owner": "backend"
            },
            "layout": {
                "x": 144.5,
                "y": 288.25
            }
        })
    );

    let (event_type, event_payload) = load_latest_app_event(&project_root);
    assert_eq!(event_type, "graph_node_created");
    assert_eq!(
        event_payload,
        json!({
            "graphId": created.root_graph.id,
            "nodeId": detail.id
        })
    );
}

#[test]
fn create_graph_node_rejects_invalid_coordinates_payload_and_node_type() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("create-invalid-graph-node");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Create Invalid Graph Node".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let invalid_payload_error = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: None,
        graph_id: created.root_graph.id.clone(),
        node_type: "brief".into(),
        position: GraphNodePosition { x: 0.0, y: 0.0 },
        payload: json!(["not", "an", "object"]),
    })
    .expect_err("non-object payload should be rejected");
    assert_eq!(invalid_payload_error.code, "invalid_graph_node_payload");

    let invalid_coordinates_error = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: None,
        graph_id: created.root_graph.id.clone(),
        node_type: "brief".into(),
        position: GraphNodePosition {
            x: f64::NAN,
            y: 32.0,
        },
        payload: json!({}),
    })
    .expect_err("non-finite coordinates should be rejected");
    assert_eq!(invalid_coordinates_error.code, "invalid_graph_node_layout");

    let invalid_type_error = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id,
        node_type: "video".into(),
        position: GraphNodePosition { x: 24.0, y: 48.0 },
        payload: json!({}),
    })
    .expect_err("disallowed node type should be rejected");
    assert_eq!(invalid_type_error.code, "invalid_graph_node");

    assert_eq!(table_row_count(&project_root, "nodes"), 0);
}

#[test]
fn update_graph_node_payload_preserves_layout_and_records_app_event() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("update-graph-node");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Update Graph Node".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_node_record(
        &project_root,
        "brief-node-update",
        &created.root_graph.id,
        "brief",
        json!({
            "title": "Before",
            "status": "draft",
            "layout": {
                "x": 96.0,
                "y": 192.0
            },
            "meta": {
                "version": 1
            }
        }),
        "100",
    );

    let app_event_count_before = table_row_count(&project_root, "app_events");

    let detail = update_graph_node_payload(UpdateGraphNodePayloadRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_id: "brief-node-update".into(),
        payload: json!({
            "title": "After",
            "status": "ready",
            "meta": {
                "version": 2
            }
        }),
    })
    .expect("graph node payload should update");

    assert_eq!(
        table_row_count(&project_root, "app_events"),
        app_event_count_before + 1
    );
    assert_eq!(detail.id, "brief-node-update");
    assert_eq!(detail.title, "After");
    assert_eq!(detail.status.as_deref(), Some("ready"));
    assert_eq!(detail.layout.x, 96.0);
    assert_eq!(detail.layout.y, 192.0);
    assert_eq!(
        detail.payload,
        json!({
            "title": "After",
            "status": "ready",
            "meta": {
                "version": 2
            }
        })
        .as_object()
        .expect("payload should be object")
        .clone()
    );

    let stored_payload = load_node_payload(&project_root, "brief-node-update");
    assert_eq!(
        stored_payload,
        json!({
            "title": "After",
            "status": "ready",
            "meta": {
                "version": 2
            },
            "layout": {
                "x": 96.0,
                "y": 192.0
            }
        })
    );

    let (event_type, event_payload) = load_latest_app_event(&project_root);
    assert_eq!(event_type, "graph_node_updated");
    assert_eq!(
        event_payload,
        json!({
            "graphId": created.root_graph.id,
            "nodeId": "brief-node-update"
        })
    );
}

#[test]
fn update_graph_node_payload_rejects_missing_node_invalid_payload_and_disallowed_type() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("update-invalid-graph-node");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Update Invalid Graph Node".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let missing_node_error = update_graph_node_payload(UpdateGraphNodePayloadRequest {
        session_id: Some(created.session_id.clone()),
        project_root: None,
        graph_id: created.root_graph.id.clone(),
        node_id: "missing-node".into(),
        payload: json!({}),
    })
    .expect_err("missing node should be rejected");
    assert_eq!(missing_node_error.code, "graph_node_not_found");

    insert_graph_record_for_layer(
        &project_root,
        "storyboard-update-invalid",
        "Storyboard Update Invalid",
        "storyboard",
        "20",
    );
    insert_node_record(
        &project_root,
        "storyboard-invalid-node",
        "storyboard-update-invalid",
        "prompt",
        json!({
            "title": "Illegal Prompt",
            "layout": {
                "x": 32.0,
                "y": 64.0
            }
        }),
        "21",
    );

    let invalid_type_error = update_graph_node_payload(UpdateGraphNodePayloadRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: "storyboard-update-invalid".into(),
        node_id: "storyboard-invalid-node".into(),
        payload: json!({
            "title": "Still Illegal"
        }),
    })
    .expect_err("disallowed stored node type should be rejected");
    assert_eq!(invalid_type_error.code, "invalid_graph_node");

    let invalid_payload_error = update_graph_node_payload(UpdateGraphNodePayloadRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id,
        node_id: "missing-node".into(),
        payload: json!(null),
    })
    .expect_err("non-object payload should be rejected");
    assert_eq!(invalid_payload_error.code, "invalid_graph_node_payload");
}

#[test]
fn update_graph_node_position_persists_layout_updates_and_records_app_event() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("update-graph-node-position");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Update Graph Node Position".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");
    let session_id = created.session_id.clone();
    let graph_id = created.root_graph.id.clone();

    insert_node_record(
        &project_root,
        "brief-node-position",
        &created.root_graph.id,
        "brief",
        json!({
            "title": "Before Position",
            "status": "draft",
            "layout": {
                "x": 96.0,
                "y": 192.0
            },
            "meta": {
                "version": 1
            }
        }),
        "100",
    );

    let app_event_count_before = table_row_count(&project_root, "app_events");

    let summary = update_graph_node_position(UpdateGraphNodePositionRequest {
        session_id: Some(session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: graph_id.clone(),
        node_id: "brief-node-position".into(),
        position: GraphNodePosition { x: 220.0, y: 340.0 },
    })
    .expect("graph node position should update");

    assert_eq!(
        table_row_count(&project_root, "app_events"),
        app_event_count_before + 1
    );
    assert_eq!(summary.id, "brief-node-position");
    assert_eq!(summary.graph_id, graph_id);
    assert_eq!(summary.layout.x, 220.0);
    assert_eq!(summary.layout.y, 340.0);

    let stored_payload = load_node_payload(&project_root, "brief-node-position");
    assert_eq!(
        stored_payload,
        json!({
            "title": "Before Position",
            "status": "draft",
            "meta": {
                "version": 1
            },
            "layout": {
                "x": 220.0,
                "y": 340.0
            }
        })
    );

    let (event_type, event_payload) = load_latest_app_event(&project_root);
    assert_eq!(event_type, "graph_node_moved");
    assert_eq!(
        event_payload,
        json!({
            "graphId": created.root_graph.id,
            "nodeId": "brief-node-position"
        })
    );
}

#[test]
fn update_graph_node_position_rejects_system_nodes_and_invalid_coordinates() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("update-graph-node-position-invalid");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Update Graph Node Position Invalid".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");
    let session_id = created.session_id.clone();
    let graph_id = created.root_graph.id.clone();

    let brief_detail = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: graph_id.clone(),
        node_type: "brief".into(),
        position: GraphNodePosition { x: 120.0, y: 240.0 },
        payload: json!({
            "title": "Position Brief",
            "status": "draft"
        }),
    })
    .expect("brief node should be created");

    let opened = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: graph_id.clone(),
        node_id: brief_detail.id,
    })
    .expect("brief node child graph should open");

    let child_nodes = list_graph_nodes(ListGraphNodesRequest {
        session_id: Some(opened.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: opened.active_graph.id.clone(),
    })
    .expect("child graph nodes should load");
    let system_anchor = child_nodes
        .iter()
        .find(|node| node.is_system)
        .cloned()
        .expect("child graph should contain system anchor");

    let system_node_error = update_graph_node_position(UpdateGraphNodePositionRequest {
        session_id: Some(session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: opened.active_graph.id.clone(),
        node_id: system_anchor.id.clone(),
        position: GraphNodePosition { x: 12.0, y: 24.0 },
    })
    .expect_err("system nodes should be rejected");
    assert_eq!(system_node_error.code, "system_node_not_movable");

    let invalid_coordinate_error = update_graph_node_position(UpdateGraphNodePositionRequest {
        session_id: Some(session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: graph_id,
        node_id: "brief-node-position".into(),
        position: GraphNodePosition {
            x: f64::INFINITY,
            y: 24.0,
        },
    })
    .expect_err("invalid coordinates should be rejected");
    assert_eq!(invalid_coordinate_error.code, "invalid_graph_node_layout");
}

#[test]
fn get_graph_node_detail_rejects_wrong_graph_or_missing_node_with_clear_errors() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("detail-missing-node");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Detail Missing Node".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let missing_node_error = get_graph_node_detail(GetGraphNodeDetailRequest {
        session_id: Some(created.session_id.clone()),
        project_root: None,
        graph_id: created.root_graph.id.clone(),
        node_id: "missing-node".into(),
    })
    .expect_err("unknown node should be rejected");

    assert_eq!(missing_node_error.code, "graph_node_not_found");
    assert!(
        missing_node_error.message.contains("missing-node"),
        "expected missing node id in error message"
    );

    let missing_graph_error = get_graph_node_detail(GetGraphNodeDetailRequest {
        session_id: Some(created.session_id),
        project_root: None,
        graph_id: "missing-graph".into(),
        node_id: "missing-node".into(),
    })
    .expect_err("unknown graph should be rejected");

    assert_eq!(missing_graph_error.code, "graph_not_found");
    assert!(
        missing_graph_error.message.contains("missing-graph"),
        "expected missing graph id in error message"
    );
}

#[test]
fn get_graph_node_detail_returns_invalid_graph_node_for_disallowed_node_type() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("detail-invalid-node-type");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Detail Invalid Node Type".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "storyboard-graph-detail-invalid",
        "Storyboard Invalid",
        "storyboard",
        "20",
    );
    insert_node_record(
        &project_root,
        "illegal-prompt-node",
        "storyboard-graph-detail-invalid",
        "prompt",
        json!({
            "title": "Illegal Prompt"
        }),
        "21",
    );

    let error = get_graph_node_detail(GetGraphNodeDetailRequest {
        session_id: Some(created.session_id),
        project_root: None,
        graph_id: "storyboard-graph-detail-invalid".into(),
        node_id: "illegal-prompt-node".into(),
    })
    .expect_err("invalid node type should be rejected");

    assert_eq!(error.code, "invalid_graph_node");
    assert!(
        error.message.contains("prompt"),
        "expected error message to name offending node type"
    );
}

#[test]
fn get_graph_node_detail_returns_invalid_graph_node_payload_for_invalid_json_or_non_object() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("detail-invalid-payload");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Detail Invalid Payload".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_raw_node_record(
        &project_root,
        "brief-node-bad-json",
        &created.root_graph.id,
        "brief",
        "{bad json",
        "30",
    );
    insert_raw_node_record(
        &project_root,
        "brief-node-array-payload",
        &created.root_graph.id,
        "brief",
        "[1,2,3]",
        "31",
    );

    let invalid_json_error = get_graph_node_detail(GetGraphNodeDetailRequest {
        session_id: Some(created.session_id.clone()),
        project_root: None,
        graph_id: created.root_graph.id.clone(),
        node_id: "brief-node-bad-json".into(),
    })
    .expect_err("invalid json payload should be rejected");

    assert_eq!(invalid_json_error.code, "invalid_graph_node_payload");
    assert!(
        invalid_json_error.message.contains("brief-node-bad-json"),
        "expected error message to name the offending node"
    );

    let non_object_error = get_graph_node_detail(GetGraphNodeDetailRequest {
        session_id: Some(created.session_id),
        project_root: None,
        graph_id: created.root_graph.id,
        node_id: "brief-node-array-payload".into(),
    })
    .expect_err("non-object payload should be rejected");

    assert_eq!(non_object_error.code, "invalid_graph_node_payload");
    assert!(
        non_object_error
            .message
            .contains("brief-node-array-payload"),
        "expected error message to name the offending node"
    );
}

#[test]
fn get_graph_node_detail_rejects_node_requested_from_another_graph() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("detail-graph-membership");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Detail Graph Membership".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "storyboard-graph-membership",
        "Storyboard Membership",
        "storyboard",
        "10",
    );
    insert_node_record(
        &project_root,
        "storyboard-node-membership",
        "storyboard-graph-membership",
        "storyboard_shot",
        json!({
            "title": "Other Graph Node"
        }),
        "11",
    );

    let error = get_graph_node_detail(GetGraphNodeDetailRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id,
        node_id: "storyboard-node-membership".into(),
    })
    .expect_err("node from a different graph should be rejected");

    assert_eq!(error.code, "graph_node_not_found");
    assert!(
        error.message.contains("storyboard-node-membership"),
        "expected error message to name the offending node"
    );
}

#[test]
fn module_j_migrations_create_relationship_and_attachment_indexes() {
    let temp = tempdir().expect("tempdir");
    let database_path = temp.path().join("project.db");
    let storage = Storage::open(&database_path).expect("storage should open");

    storage
        .apply_migrations()
        .expect("migrations should apply cleanly");

    assert!(
        index_exists(&database_path, "idx_edges_graph_id"),
        "Module J should add an index for listing graph edges by graph"
    );
    assert!(
        index_exists(&database_path, "idx_edges_graph_relation_unique"),
        "Module J should add a duplicate-prevention index for graph relations"
    );
    assert!(
        index_exists(&database_path, "idx_node_assets_asset_id"),
        "Module J should add an attachment lookup index for node asset bindings"
    );
}

#[test]
fn module_j_list_project_assets_filters_by_query() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("module-j-asset-query");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Module J Asset Query".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    upsert_asset_record(
        &project_root,
        "asset-preview",
        "images/preview-frame.png",
        "image",
        Some("image/png"),
        "100",
    );
    upsert_asset_record(
        &project_root,
        "asset-manual",
        "docs/manual.pdf",
        "document",
        Some("application/pdf"),
        "101",
    );

    let listed = list_project_assets(ListProjectAssetsRequest {
        session_id: Some(created.session_id),
        project_root: None,
        media_type: None,
        query: Some("preview".into()),
        limit: Some(20),
    })
    .expect("asset query filter should work");

    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, "asset-preview");
    assert_eq!(listed[0].relative_path, "assets/images/preview-frame.png");
}

#[test]
fn module_j_get_graph_node_detail_returns_asset_bindings_and_role_options() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("module-j-node-detail-assets");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Module J Node Detail Assets".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "shot-lab-assets",
        "Shot Lab Assets",
        "shot_lab",
        "10",
    );
    insert_node_record(
        &project_root,
        "still-node-assets",
        "shot-lab-assets",
        "still",
        json!({
            "title": "Hero Still",
            "status": "candidate",
            "layout": {
                "x": 160.0,
                "y": 240.0
            }
        }),
        "11",
    );
    upsert_asset_record(
        &project_root,
        "asset-preview",
        "images/preview-frame.png",
        "image",
        Some("image/png"),
        "12",
    );
    insert_node_asset_binding(
        &project_root,
        "still-node-assets",
        "asset-preview",
        "preview",
        "13",
    );

    let detail = get_graph_node_detail(GetGraphNodeDetailRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: "shot-lab-assets".into(),
        node_id: "still-node-assets".into(),
    })
    .expect("node detail should include Module J attachment data");
    let summary = list_graph_nodes(ListGraphNodesRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: "shot-lab-assets".into(),
    })
    .expect("node summary should include Module J attachment counts")
    .into_iter()
    .find(|node| node.id == "still-node-assets")
    .expect("still node should appear in graph summary");

    assert_eq!(
        detail
            .asset_role_options
            .iter()
            .map(|option| option.role.as_str())
            .collect::<Vec<_>>(),
        vec!["reference", "preview", "output"]
    );
    assert_eq!(summary.stored_asset_count, 1);
    assert_eq!(detail.stored_asset_count, 1);
    assert_eq!(detail.asset_bindings.len(), 1);
    assert_eq!(detail.asset_bindings[0].asset_id, "asset-preview");
    assert_eq!(detail.asset_bindings[0].role, "preview");
    assert_eq!(
        detail.asset_bindings[0].asset.relative_path,
        "assets/images/preview-frame.png"
    );
}

#[test]
fn module_j_brief_node_detail_returns_dedicated_media_role_options() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("module-j-brief-media-roles");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Module J Brief Media Roles".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "brief-assets",
        "Brief Assets",
        "brief",
        "10",
    );
    insert_node_record(
        &project_root,
        "brief-node-assets",
        "brief-assets",
        "brief",
        json!({
            "title": "Opening Brief",
            "description": "Describe the launch direction"
        }),
        "11",
    );

    let detail = get_graph_node_detail(GetGraphNodeDetailRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: "brief-assets".into(),
        node_id: "brief-node-assets".into(),
    })
    .expect("brief node detail should include dedicated media roles");

    assert_eq!(
        detail
            .asset_role_options
            .iter()
            .map(|option| option.role.as_str())
            .collect::<Vec<_>>(),
        vec!["product_image", "example_video"]
    );
}

#[test]
fn module_j_bind_and_unbind_node_asset_persist_and_emit_events() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("module-j-bind-unbind");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Module J Bind Unbind".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "shot-lab-bindings",
        "Shot Lab Bindings",
        "shot_lab",
        "10",
    );
    insert_node_record(
        &project_root,
        "still-node-bindings",
        "shot-lab-bindings",
        "still",
        json!({
            "title": "Hero Still"
        }),
        "11",
    );
    upsert_asset_record(
        &project_root,
        "asset-preview",
        "images/preview-frame.png",
        "image",
        Some("image/png"),
        "12",
    );

    let bound_detail = bind_node_asset(BindNodeAssetRequest {
        session_id: Some(created.session_id.clone()),
        project_root: None,
        graph_id: "shot-lab-bindings".into(),
        node_id: "still-node-bindings".into(),
        asset_id: "asset-preview".into(),
        role: "preview".into(),
    })
    .expect("binding an allowed asset role should succeed");

    assert_eq!(
        load_node_asset_bindings(&project_root, "still-node-bindings"),
        vec![("asset-preview".into(), "preview".into())]
    );
    assert_eq!(bound_detail.asset_bindings.len(), 1);
    let (event_type, event_payload) = load_latest_app_event(&project_root);
    assert_eq!(event_type, "graph_node_asset_bound");
    assert_eq!(
        event_payload,
        json!({
            "graphId": "shot-lab-bindings",
            "nodeId": "still-node-bindings",
            "assetId": "asset-preview",
            "role": "preview"
        })
    );

    let unbound_detail = unbind_node_asset(UnbindNodeAssetRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: "shot-lab-bindings".into(),
        node_id: "still-node-bindings".into(),
        asset_id: "asset-preview".into(),
        role: "preview".into(),
    })
    .expect("unbinding an existing asset binding should succeed");

    assert!(unbound_detail.asset_bindings.is_empty());
    assert!(load_node_asset_bindings(&project_root, "still-node-bindings").is_empty());
    let (event_type, event_payload) = load_latest_app_event(&project_root);
    assert_eq!(event_type, "graph_node_asset_unbound");
    assert_eq!(
        event_payload,
        json!({
            "graphId": "shot-lab-bindings",
            "nodeId": "still-node-bindings",
            "assetId": "asset-preview",
            "role": "preview"
        })
    );
}

#[test]
fn module_j_bind_node_asset_rejects_invalid_roles_and_system_nodes() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("module-j-bind-validation");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Module J Bind Validation".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "shot-lab-bind-validation",
        "Shot Lab Bind Validation",
        "shot_lab",
        "10",
    );
    insert_node_record(
        &project_root,
        "prompt-node-bind-validation",
        "shot-lab-bind-validation",
        "prompt",
        json!({
            "title": "Prompt A"
        }),
        "11",
    );
    insert_system_node_record(
        &project_root,
        "system-node-bind-validation",
        "shot-lab-bind-validation",
        json!({
            "title": "Storyboard Anchor"
        }),
        "12",
    );
    upsert_asset_record(
        &project_root,
        "asset-reference",
        "images/reference-board.png",
        "image",
        Some("image/png"),
        "13",
    );

    let invalid_role_error = bind_node_asset(BindNodeAssetRequest {
        session_id: Some(created.session_id.clone()),
        project_root: None,
        graph_id: "shot-lab-bind-validation".into(),
        node_id: "prompt-node-bind-validation".into(),
        asset_id: "asset-reference".into(),
        role: "preview".into(),
    })
    .expect_err("prompt nodes should reject preview role bindings");
    assert_eq!(invalid_role_error.code, "invalid_node_asset_role");

    let system_node_error = bind_node_asset(BindNodeAssetRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: "shot-lab-bind-validation".into(),
        node_id: "system-node-bind-validation".into(),
        asset_id: "asset-reference".into(),
        role: "reference".into(),
    })
    .expect_err("system nodes should not accept bindings");
    assert_eq!(system_node_error.code, "system_node_not_bindable");

    assert!(load_node_asset_bindings(&project_root, "prompt-node-bind-validation").is_empty());
    assert!(load_node_asset_bindings(&project_root, "system-node-bind-validation").is_empty());
}

#[test]
fn module_j_lists_relation_options_and_persists_graph_edges() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("module-j-graph-edges");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Module J Graph Edges".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "shot-lab-edges",
        "Shot Lab Edges",
        "shot_lab",
        "10",
    );
    insert_node_record(
        &project_root,
        "prompt-node-edge",
        "shot-lab-edges",
        "prompt",
        json!({
            "title": "Prompt A"
        }),
        "11",
    );
    insert_node_record(
        &project_root,
        "reference-node-edge",
        "shot-lab-edges",
        "reference",
        json!({
            "title": "Reference B"
        }),
        "12",
    );

    let relation_options = list_graph_relation_type_options(ListGraphRelationTypeOptionsRequest {
        session_id: Some(created.session_id.clone()),
        project_root: None,
        graph_id: "shot-lab-edges".into(),
    })
    .expect("shot lab relation options should load");

    assert_eq!(
        relation_options
            .iter()
            .map(|option| option.edge_type.as_str())
            .collect::<Vec<_>>(),
        vec![
            "references",
            "variant_of",
            "alternative_to",
            "approved_from",
            "reuses"
        ]
    );

    let created_edge = create_graph_edge(CreateGraphEdgeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: "shot-lab-edges".into(),
        source_node_id: "prompt-node-edge".into(),
        target_node_id: "reference-node-edge".into(),
        edge_type: "references".into(),
    })
    .expect("valid graph relation should persist");

    assert_eq!(
        load_graph_edges(&project_root, "shot-lab-edges"),
        vec![(
            created_edge.id.clone(),
            "prompt-node-edge".into(),
            "reference-node-edge".into(),
            "references".into()
        )]
    );
    let listed_edges = list_graph_edges(ListGraphEdgesRequest {
        session_id: Some(created.session_id.clone()),
        project_root: None,
        graph_id: "shot-lab-edges".into(),
    })
    .expect("graph edges should list after creation");
    assert_eq!(listed_edges.len(), 1);
    assert_eq!(listed_edges[0].id, created_edge.id);
    assert_eq!(listed_edges[0].edge_type, "references");

    let (event_type, event_payload) = load_latest_app_event(&project_root);
    assert_eq!(event_type, "graph_edge_created");
    assert_eq!(
        event_payload,
        json!({
            "graphId": "shot-lab-edges",
            "edgeId": created_edge.id,
            "sourceNodeId": "prompt-node-edge",
            "targetNodeId": "reference-node-edge",
            "edgeType": "references"
        })
    );

    delete_graph_edge(DeleteGraphEdgeRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: "shot-lab-edges".into(),
        edge_id: created_edge.id.clone(),
    })
    .expect("graph edge deletion should succeed");

    assert!(load_graph_edges(&project_root, "shot-lab-edges").is_empty());
    let (event_type, event_payload) = load_latest_app_event(&project_root);
    assert_eq!(event_type, "graph_edge_deleted");
    assert_eq!(
        event_payload,
        json!({
            "graphId": "shot-lab-edges",
            "edgeId": created_edge.id,
            "sourceNodeId": "prompt-node-edge",
            "targetNodeId": "reference-node-edge",
            "edgeType": "references"
        })
    );
}

#[test]
fn module_j_create_graph_edge_rejects_duplicates_invalid_types_and_system_targets() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("module-j-edge-validation");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Module J Edge Validation".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    insert_graph_record_for_layer(
        &project_root,
        "shot-lab-edge-validation",
        "Shot Lab Edge Validation",
        "shot_lab",
        "10",
    );
    insert_node_record(
        &project_root,
        "prompt-node-validation",
        "shot-lab-edge-validation",
        "prompt",
        json!({
            "title": "Prompt A"
        }),
        "11",
    );
    insert_node_record(
        &project_root,
        "reference-node-validation",
        "shot-lab-edge-validation",
        "reference",
        json!({
            "title": "Reference B"
        }),
        "12",
    );
    insert_system_node_record(
        &project_root,
        "system-node-edge-validation",
        "shot-lab-edge-validation",
        json!({
            "title": "Storyboard Anchor"
        }),
        "13",
    );

    create_graph_edge(CreateGraphEdgeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: None,
        graph_id: "shot-lab-edge-validation".into(),
        source_node_id: "prompt-node-validation".into(),
        target_node_id: "reference-node-validation".into(),
        edge_type: "references".into(),
    })
    .expect("first relation should create");

    let duplicate_error = create_graph_edge(CreateGraphEdgeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: None,
        graph_id: "shot-lab-edge-validation".into(),
        source_node_id: "prompt-node-validation".into(),
        target_node_id: "reference-node-validation".into(),
        edge_type: "references".into(),
    })
    .expect_err("duplicate relations should be rejected");
    assert_eq!(duplicate_error.code, "duplicate_graph_edge");

    let invalid_type_error = create_graph_edge(CreateGraphEdgeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: "shot-lab-edge-validation".into(),
        source_node_id: "prompt-node-validation".into(),
        target_node_id: "reference-node-validation".into(),
        edge_type: "contains".into(),
    })
    .expect_err("shot lab should reject relation kinds outside its default_relations");
    assert_eq!(invalid_type_error.code, "invalid_graph_edge");

    let anchor_source_edge = create_graph_edge(CreateGraphEdgeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: "shot-lab-edge-validation".into(),
        source_node_id: "system-node-edge-validation".into(),
        target_node_id: "prompt-node-validation".into(),
        edge_type: "references".into(),
    })
    .expect("system anchors should be allowed as graph edge sources");
    assert_eq!(anchor_source_edge.source_node_id, "system-node-edge-validation");
    assert_eq!(anchor_source_edge.target_node_id, "prompt-node-validation");

    let system_target_error = create_graph_edge(CreateGraphEdgeRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: "shot-lab-edge-validation".into(),
        source_node_id: "prompt-node-validation".into(),
        target_node_id: "system-node-edge-validation".into(),
        edge_type: "references".into(),
    })
    .expect_err("system anchors should not be valid graph edge targets");
    assert_eq!(system_target_error.code, "system_node_not_connectable");

    assert_eq!(
        load_graph_edges(&project_root, "shot-lab-edge-validation").len(),
        2
    );
}

#[test]
fn delete_graph_node_removes_node_edges_bindings_and_records_app_event() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("delete-graph-node");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Delete Graph Node".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let prompt = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_type: "brief".into(),
        position: GraphNodePosition { x: 120.0, y: 160.0 },
        payload: json!({
            "title": "Delete Me"
        }),
    })
    .expect("source node should be created");
    let reference = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_type: "brief".into(),
        position: GraphNodePosition { x: 360.0, y: 220.0 },
        payload: json!({
            "title": "Keep Me"
        }),
    })
    .expect("target node should be created");
    let edge = create_graph_edge(CreateGraphEdgeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        source_node_id: prompt.id.clone(),
        target_node_id: reference.id.clone(),
        edge_type: "references".into(),
    })
    .expect("edge should be created");
    upsert_asset_record(
        &project_root,
        "asset-delete-1",
        "images/delete-me.png",
        "image",
        Some("image/png"),
        "1710000200",
    );
    insert_node_asset_binding(
        &project_root,
        &prompt.id,
        "asset-delete-1",
        "reference",
        "1710000200",
    );

    let result = delete_graph_node(DeleteGraphNodeRequest {
        session_id: Some(created.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_id: prompt.id.clone(),
    })
    .expect("graph node deletion should succeed");

    assert_eq!(result.graph_id, created.root_graph.id);
    assert_eq!(result.node_id, prompt.id);
    assert!(result.deleted_graph_ids.is_empty());
    assert_eq!(table_row_count(&project_root, "nodes"), 1);
    assert_eq!(table_row_count(&project_root, "edges"), 0);
    assert!(load_node_asset_bindings(&project_root, &prompt.id).is_empty());
    assert!(load_graph_edges(&project_root, &created.root_graph.id).is_empty());

    let remaining_nodes = list_graph_nodes(ListGraphNodesRequest {
        session_id: None,
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
    })
    .expect("remaining nodes should load");
    assert_eq!(remaining_nodes.len(), 1);
    assert_eq!(remaining_nodes[0].id, reference.id);
    assert_ne!(edge.id, remaining_nodes[0].id);

    let (event_type, event_payload) = load_latest_app_event(&project_root);
    assert_eq!(event_type, "graph_node_deleted");
    assert_eq!(
        event_payload,
        json!({
            "graphId": created.root_graph.id,
            "nodeId": prompt.id,
            "deletedGraphIds": []
        })
    );
}

#[test]
fn delete_graph_node_rejects_missing_wrong_graph_and_system_nodes() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("delete-graph-node-validation");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Delete Graph Node Validation".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let brief = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_type: "brief".into(),
        position: GraphNodePosition { x: 40.0, y: 80.0 },
        payload: json!({
            "title": "Brief To Validate"
        }),
    })
    .expect("brief node should be created");
    let storyboard_session = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_id: brief.id.clone(),
    })
    .expect("storyboard graph should open");
    let anchor = list_graph_nodes(ListGraphNodesRequest {
        session_id: Some(storyboard_session.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: storyboard_session.active_graph.id.clone(),
    })
    .expect("storyboard nodes should load")
    .into_iter()
    .find(|node| node.is_system)
    .expect("storyboard graph should contain an anchor");

    let missing_node_error = delete_graph_node(DeleteGraphNodeRequest {
        session_id: Some(storyboard_session.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_id: "missing-node".into(),
    })
    .expect_err("missing node should be rejected");
    assert_eq!(missing_node_error.code, "graph_node_not_found");

    let wrong_graph_error = delete_graph_node(DeleteGraphNodeRequest {
        session_id: Some(storyboard_session.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: storyboard_session.active_graph.id.clone(),
        node_id: brief.id,
    })
    .expect_err("node should not delete from another graph");
    assert_eq!(wrong_graph_error.code, "graph_node_not_found");

    let system_node_error = delete_graph_node(DeleteGraphNodeRequest {
        session_id: Some(storyboard_session.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: storyboard_session.active_graph.id,
        node_id: anchor.id,
    })
    .expect_err("system nodes should not be deletable");
    assert_eq!(system_node_error.code, "system_node_not_deletable");
}

#[test]
fn delete_graph_node_recursively_deletes_descendant_graphs() {
    let temp = tempdir().expect("tempdir");
    let project_root = temp.path().join("delete-graph-node-cascade");
    let backend = Backend::new().expect("backend should initialize");

    let created = backend
        .create_project(CreateProjectRequest {
            project_root: Some(project_root.display().to_string()),
            project_name: Some("Delete Graph Node Cascade".into()),
            template_id: "ecommerce_ad_v1".into(),
        })
        .expect("project should be created");

    let brief = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_type: "brief".into(),
        position: GraphNodePosition { x: 60.0, y: 90.0 },
        payload: json!({
            "title": "Cascade Brief"
        }),
    })
    .expect("brief node should be created");
    let storyboard_session = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(created.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_id: brief.id.clone(),
    })
    .expect("storyboard graph should open");
    let storyboard_shot = create_graph_node(CreateGraphNodeRequest {
        session_id: Some(storyboard_session.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: storyboard_session.active_graph.id.clone(),
        node_type: "storyboard_shot".into(),
        position: GraphNodePosition { x: 180.0, y: 210.0 },
        payload: json!({
            "title": "Cascade Shot"
        }),
    })
    .expect("storyboard shot should be created");
    let shot_lab_session = open_node_child_graph(OpenNodeChildGraphRequest {
        session_id: Some(storyboard_session.session_id.clone()),
        project_root: Some(project_root.display().to_string()),
        graph_id: storyboard_session.active_graph.id.clone(),
        node_id: storyboard_shot.id.clone(),
    })
    .expect("shot lab graph should open");

    let result = delete_graph_node(DeleteGraphNodeRequest {
        session_id: Some(storyboard_session.session_id),
        project_root: Some(project_root.display().to_string()),
        graph_id: created.root_graph.id.clone(),
        node_id: brief.id.clone(),
    })
    .expect("brief deletion should cascade");

    assert_eq!(
        result.deleted_graph_ids,
        vec![
            shot_lab_session.active_graph.id.clone(),
            storyboard_session.active_graph.id.clone()
        ]
    );
    assert_eq!(table_row_count(&project_root, "graphs"), 1);
    assert_eq!(load_graph_ids(&project_root), vec![created.root_graph.id.clone()]);
    assert_eq!(table_row_count(&project_root, "nodes"), 0);
    assert_eq!(table_row_count(&project_root, "edges"), 0);
    assert_eq!(
        list_graph_nodes(ListGraphNodesRequest {
            session_id: Some(created.session_id),
            project_root: Some(project_root.display().to_string()),
            graph_id: created.root_graph.id,
        })
        .expect("root nodes should load after cascade")
        .len(),
        0
    );
}
