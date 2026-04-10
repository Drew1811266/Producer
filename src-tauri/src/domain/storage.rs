use std::path::Path;
use std::path::PathBuf;

use rusqlite::{Connection, OptionalExtension, Row, params};
use uuid::Uuid;

use crate::domain::{
    project::{BackendError, GraphSummary},
    template::RootGraphSeed,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectMetaRecord {
    pub project_id: String,
    pub project_name: String,
    pub template_id: String,
    pub template_version: u32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphNodeRecord {
    pub id: String,
    pub graph_id: String,
    pub node_type: String,
    pub is_system: bool,
    pub payload_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredGraphRecord {
    pub id: String,
    pub layer_type: String,
    pub name: String,
    pub is_root: bool,
    pub parent_graph_id: Option<String>,
    pub source_node_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetRecord {
    pub id: Option<String>,
    pub relative_path: String,
    pub media_type: String,
    pub mime_type: Option<String>,
    pub byte_size: Option<i64>,
    pub sha256: Option<String>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub duration_ms: Option<i64>,
    pub modified_at: Option<String>,
    pub indexed_at: Option<String>,
    pub missing_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredAssetRecord {
    pub id: String,
    pub relative_path: String,
    pub media_type: String,
    pub mime_type: Option<String>,
    pub byte_size: Option<i64>,
    pub sha256: Option<String>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub duration_ms: Option<i64>,
    pub modified_at: Option<String>,
    pub indexed_at: Option<String>,
    pub missing_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetDerivativeRecord {
    pub id: Option<String>,
    pub asset_id: String,
    pub derivative_kind: String,
    pub relative_path: String,
    pub generator: Option<String>,
    pub spec_json: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub duration_ms: Option<i64>,
    pub status: String,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredAssetDerivativeRecord {
    pub id: String,
    pub asset_id: String,
    pub derivative_kind: String,
    pub relative_path: String,
    pub generator: Option<String>,
    pub spec_json: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub duration_ms: Option<i64>,
    pub status: String,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JobRecord {
    pub id: String,
    pub job_type: String,
    pub status: String,
    pub payload_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MediaIndexSummaryRecord {
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetListItemRecord {
    pub id: String,
    pub relative_path: String,
    pub media_type: String,
    pub mime_type: Option<String>,
    pub byte_size: Option<i64>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub duration_ms: Option<i64>,
    pub indexed_at: Option<String>,
    pub missing_at: Option<String>,
    pub thumbnail_relative_path: Option<String>,
    pub thumbnail_status: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NodeAssetBindingListItemRecord {
    pub asset_id: String,
    pub role: String,
    pub created_at: String,
    pub relative_path: String,
    pub media_type: String,
    pub mime_type: Option<String>,
    pub byte_size: Option<i64>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub duration_ms: Option<i64>,
    pub indexed_at: Option<String>,
    pub missing_at: Option<String>,
    pub thumbnail_relative_path: Option<String>,
    pub thumbnail_status: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphEdgeRecord {
    pub id: String,
    pub graph_id: String,
    pub source_node_id: String,
    pub target_node_id: String,
    pub edge_type: String,
    pub payload_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug)]
pub struct Storage {
    conn: Connection,
    database_path: PathBuf,
}

impl Storage {
    pub fn open(database_path: impl AsRef<Path>) -> Result<Self, BackendError> {
        let database_path = database_path.as_ref().to_path_buf();
        if let Some(parent) = database_path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| {
                BackendError::new(
                    "io_error",
                    format!(
                        "failed to create database parent {}: {error}",
                        parent.display()
                    ),
                )
            })?;
        }

        let conn = Connection::open(&database_path).map_err(|error| {
            BackendError::new(
                "storage_error",
                format!(
                    "failed to open database {}: {error}",
                    database_path.display()
                ),
            )
        })?;
        conn.pragma_update(None, "foreign_keys", true)
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to enable foreign keys: {error}"),
                )
            })?;

        Ok(Self {
            conn,
            database_path,
        })
    }

    pub fn apply_migrations(&self) -> Result<(), BackendError> {
        self.conn
            .execute_batch(include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/resources/migrations/0001_init.sql"
            )))
            .map_err(|error| {
                BackendError::new(
                    "migration_error",
                    format!(
                        "failed to apply migrations to {}: {error}",
                        self.database_path.display()
                    ),
                )
            })?;

        if !self.column_exists("graphs", "parent_graph_id")? {
            self.conn
                .execute_batch("ALTER TABLE graphs ADD COLUMN parent_graph_id TEXT NULL;")
                .map_err(|error| {
                    BackendError::new(
                        "migration_error",
                        format!(
                            "failed to add parent_graph_id to {}: {error}",
                            self.database_path.display()
                        ),
                    )
                })?;
        }

        if !self.column_exists("graphs", "source_node_id")? {
            self.conn
                .execute_batch("ALTER TABLE graphs ADD COLUMN source_node_id TEXT NULL;")
                .map_err(|error| {
                    BackendError::new(
                        "migration_error",
                        format!(
                            "failed to add source_node_id to {}: {error}",
                            self.database_path.display()
                        ),
                    )
                })?;
        }

        if !self.column_exists("nodes", "is_system")? {
            self.conn
                .execute_batch("ALTER TABLE nodes ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;")
                .map_err(|error| {
                    BackendError::new(
                        "migration_error",
                        format!(
                            "failed to add is_system to {}: {error}",
                            self.database_path.display()
                        ),
                    )
                })?;
        }

        if !self.index_exists("idx_graphs_source_node_unique")?
            || !self.index_exists("idx_graphs_parent_graph_id")?
            || !self.index_exists("idx_nodes_graph_is_system")?
        {
            self.conn
                .execute_batch(include_str!(concat!(
                    env!("CARGO_MANIFEST_DIR"),
                    "/resources/migrations/0002_graph_contexts.sql"
                )))
                .map_err(|error| {
                    BackendError::new(
                        "migration_error",
                        format!(
                            "failed to apply graph context indexes to {}: {error}",
                            self.database_path.display()
                        ),
                    )
                })?;
        }

        self.ensure_column("assets", "mime_type", "TEXT")?;
        self.ensure_column("assets", "byte_size", "INTEGER")?;
        self.ensure_column("assets", "sha256", "TEXT")?;
        self.ensure_column("assets", "width", "INTEGER")?;
        self.ensure_column("assets", "height", "INTEGER")?;
        self.ensure_column("assets", "duration_ms", "INTEGER")?;
        self.ensure_column("assets", "modified_at", "TEXT")?;
        self.ensure_column("assets", "indexed_at", "TEXT")?;
        self.ensure_column("assets", "missing_at", "TEXT")?;

        self.ensure_column("asset_derivatives", "generator", "TEXT")?;
        self.ensure_column(
            "asset_derivatives",
            "spec_json",
            "TEXT NOT NULL DEFAULT '{}'",
        )?;
        self.ensure_column("asset_derivatives", "width", "INTEGER")?;
        self.ensure_column("asset_derivatives", "height", "INTEGER")?;
        self.ensure_column("asset_derivatives", "duration_ms", "INTEGER")?;
        self.ensure_column(
            "asset_derivatives",
            "status",
            "TEXT NOT NULL DEFAULT 'ready'",
        )?;
        self.ensure_column("asset_derivatives", "error_message", "TEXT")?;

        if !self.index_exists("idx_assets_relative_path_unique")?
            || !self.index_exists("idx_assets_media_type")?
            || !self.index_exists("idx_asset_derivatives_unique")?
            || !self.index_exists("idx_jobs_type_status")?
        {
            self.conn
                .execute_batch(include_str!(concat!(
                    env!("CARGO_MANIFEST_DIR"),
                    "/resources/migrations/0003_media_index.sql"
                )))
                .map_err(|error| {
                    BackendError::new(
                        "migration_error",
                        format!(
                            "failed to apply media index indexes to {}: {error}",
                            self.database_path.display()
                        ),
                    )
                })?;
        }

        if !self.index_exists("idx_edges_graph_id")?
            || !self.index_exists("idx_edges_graph_relation_unique")?
            || !self.index_exists("idx_node_assets_asset_id")?
        {
            self.conn
                .execute_batch(include_str!(concat!(
                    env!("CARGO_MANIFEST_DIR"),
                    "/resources/migrations/0004_relationships_and_attachments.sql"
                )))
                .map_err(|error| {
                    BackendError::new(
                        "migration_error",
                        format!(
                            "failed to apply relationship and attachment indexes to {}: {error}",
                            self.database_path.display()
                        ),
                    )
                })?;
        }

        Ok(())
    }

    fn ensure_column(
        &self,
        table_name: &str,
        column_name: &str,
        column_definition: &str,
    ) -> Result<(), BackendError> {
        if self.column_exists(table_name, column_name)? {
            return Ok(());
        }

        self.conn
            .execute_batch(&format!(
                "ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition};"
            ))
            .map_err(|error| {
                BackendError::new(
                    "migration_error",
                    format!(
                        "failed to add {column_name} to {}: {error}",
                        self.database_path.display()
                    ),
                )
            })?;

        Ok(())
    }

    fn column_exists(&self, table_name: &str, column_name: &str) -> Result<bool, BackendError> {
        let mut statement = self
            .conn
            .prepare(&format!("PRAGMA table_info({table_name})"))
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to inspect table info for {table_name}: {error}"),
                )
            })?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to query table info for {table_name}: {error}"),
                )
            })?;

        let columns = rows.collect::<Result<Vec<_>, _>>().map_err(|error| {
            BackendError::new(
                "storage_error",
                format!("failed to read table info for {table_name}: {error}"),
            )
        })?;

        Ok(columns.iter().any(|column| column == column_name))
    }

    fn index_exists(&self, index_name: &str) -> Result<bool, BackendError> {
        let exists: i64 = self
            .conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?1)",
                [index_name],
                |row| row.get(0),
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to inspect index {index_name}: {error}"),
                )
            })?;

        Ok(exists == 1)
    }

    pub fn table_exists(&self, table_name: &str) -> Result<bool, BackendError> {
        let exists: i64 = self
            .conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name = ?1)",
                [table_name],
                |row| row.get(0),
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to check table {table_name}: {error}"),
                )
            })?;

        Ok(exists == 1)
    }

    pub fn count_graphs(&self) -> Result<u32, BackendError> {
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM graphs", [], |row| row.get(0))
            .map_err(|error| {
                BackendError::new("storage_error", format!("failed to count graphs: {error}"))
            })?;

        Ok(count as u32)
    }

    pub fn list_graphs(&self) -> Result<Vec<GraphSummary>, BackendError> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT id, layer_type, name, is_root, parent_graph_id, source_node_id
                 FROM graphs
                 ORDER BY is_root DESC, name ASC, id ASC",
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to prepare graph list: {error}"),
                )
            })?;

        let rows = statement.query_map([], map_graph_record).map_err(|error| {
            BackendError::new("storage_error", format!("failed to list graphs: {error}"))
        })?;

        rows.collect::<Result<Vec<_>, _>>()
            .map(|records| {
                records
                    .into_iter()
                    .map(|record| record_to_graph_summary(&record))
                    .collect()
            })
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to read graph list: {error}"),
                )
            })
    }

    pub fn load_graph(&self, graph_id: &str) -> Result<GraphSummary, BackendError> {
        Ok(record_to_graph_summary(&self.load_graph_record(graph_id)?))
    }

    pub fn load_graph_record(&self, graph_id: &str) -> Result<StoredGraphRecord, BackendError> {
        self.conn
            .query_row(
                "SELECT id, layer_type, name, is_root, parent_graph_id, source_node_id
                 FROM graphs
                 WHERE id = ?1
                 LIMIT 1",
                [graph_id],
                map_graph_record,
            )
            .optional()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to load graph {graph_id}: {error}"),
                )
            })?
            .ok_or_else(|| {
                BackendError::new("graph_not_found", format!("unknown graph_id {graph_id}"))
            })
    }

    pub fn load_root_graph(&self) -> Result<GraphSummary, BackendError> {
        Ok(record_to_graph_summary(&self.load_root_graph_record()?))
    }

    pub fn load_root_graph_record(&self) -> Result<StoredGraphRecord, BackendError> {
        self.conn
            .query_row(
                "SELECT id, layer_type, name, is_root, parent_graph_id, source_node_id
                 FROM graphs
                 WHERE is_root = 1
                 LIMIT 1",
                [],
                map_graph_record,
            )
            .optional()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to load root graph: {error}"),
                )
            })?
            .ok_or_else(|| BackendError::new("invalid_project", "project is missing a root graph"))
    }

    pub fn load_graph_record_by_source_node_id(
        &self,
        source_node_id: &str,
    ) -> Result<Option<StoredGraphRecord>, BackendError> {
        self.conn
            .query_row(
                "SELECT id, layer_type, name, is_root, parent_graph_id, source_node_id
                 FROM graphs
                 WHERE source_node_id = ?1
                 LIMIT 1",
                [source_node_id],
                map_graph_record,
            )
            .optional()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to load graph for source node {source_node_id}: {error}"),
                )
            })
    }

    pub fn list_child_graph_records(
        &self,
        parent_graph_id: &str,
    ) -> Result<Vec<StoredGraphRecord>, BackendError> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT id, layer_type, name, is_root, parent_graph_id, source_node_id
                 FROM graphs
                 WHERE parent_graph_id = ?1
                 ORDER BY created_at ASC, id ASC",
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to prepare child graph list for {parent_graph_id}: {error}"),
                )
            })?;

        let rows = statement
            .query_map(params![parent_graph_id], map_graph_record)
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to list child graphs for {parent_graph_id}: {error}"),
                )
            })?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|error| {
            BackendError::new(
                "storage_error",
                format!("failed to read child graphs for {parent_graph_id}: {error}"),
            )
        })
    }

    pub fn count_assets(&self) -> Result<u32, BackendError> {
        let query = if self.column_exists("assets", "missing_at")? {
            "SELECT COUNT(*) FROM assets WHERE missing_at IS NULL"
        } else {
            "SELECT COUNT(*) FROM assets"
        };
        let count: i64 = self
            .conn
            .query_row(query, [], |row| row.get(0))
            .map_err(|error| {
                BackendError::new("storage_error", format!("failed to count assets: {error}"))
            })?;

        Ok(count as u32)
    }

    pub fn media_index_summary(&self) -> Result<MediaIndexSummaryRecord, BackendError> {
        let asset_count = self.count_assets()?;
        let image_count = self.count_assets_by_media_type("image")?;
        let video_count = self.count_assets_by_media_type("video")?;
        let audio_count = self.count_assets_by_media_type("audio")?;
        let document_count = self.count_assets_by_media_type("document")?;
        let other_count = self.count_other_assets()?;
        let ready_thumbnail_count = self.count_ready_thumbnails()?;
        let missing_thumbnail_count = image_count.saturating_sub(ready_thumbnail_count);
        let unsupported_thumbnail_count = asset_count.saturating_sub(image_count);
        let pending_job_count = self.count_jobs_by_status("pending")?;
        let failed_job_count = self.count_jobs_by_status("failed")?;
        let last_indexed_at = self.last_indexed_at()?;

        Ok(MediaIndexSummaryRecord {
            asset_count,
            image_count,
            video_count,
            audio_count,
            document_count,
            other_count,
            ready_thumbnail_count,
            missing_thumbnail_count,
            unsupported_thumbnail_count,
            pending_job_count,
            failed_job_count,
            last_indexed_at,
        })
    }

    pub fn list_assets(
        &self,
        media_type: Option<&str>,
        query: Option<&str>,
        limit: Option<u32>,
    ) -> Result<Vec<AssetListItemRecord>, BackendError> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT
                    assets.id,
                    assets.relative_path,
                    assets.media_type,
                    assets.mime_type,
                    assets.byte_size,
                    assets.width,
                    assets.height,
                    assets.duration_ms,
                    assets.indexed_at,
                    assets.missing_at,
                    derivative.relative_path,
                    derivative.status
                 FROM assets
                 LEFT JOIN asset_derivatives AS derivative
                   ON derivative.asset_id = assets.id
                  AND derivative.derivative_kind = 'thumbnail_card'
                 WHERE assets.missing_at IS NULL
                   AND (?1 IS NULL OR assets.media_type = ?1)
                   AND (
                     ?2 IS NULL
                     OR LOWER(assets.relative_path) LIKE '%' || LOWER(?2) || '%'
                     OR LOWER(COALESCE(assets.mime_type, '')) LIKE '%' || LOWER(?2) || '%'
                   )
                 ORDER BY assets.relative_path ASC
                 LIMIT ?3",
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to prepare asset list query: {error}"),
                )
            })?;

        let rows = statement
            .query_map(
                params![media_type, query, i64::from(limit.unwrap_or(200))],
                |row| {
                    Ok(AssetListItemRecord {
                        id: row.get(0)?,
                        relative_path: row.get(1)?,
                        media_type: row.get(2)?,
                        mime_type: row.get(3)?,
                        byte_size: row.get(4)?,
                        width: row.get(5)?,
                        height: row.get(6)?,
                        duration_ms: row.get(7)?,
                        indexed_at: row.get(8)?,
                        missing_at: row.get(9)?,
                        thumbnail_relative_path: row.get(10)?,
                        thumbnail_status: row.get(11)?,
                    })
                },
            )
            .map_err(|error| {
                BackendError::new("storage_error", format!("failed to list assets: {error}"))
            })?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|error| {
            BackendError::new("storage_error", format!("failed to read assets: {error}"))
        })
    }

    pub fn list_node_asset_binding_records(
        &self,
        node_id: &str,
    ) -> Result<Vec<NodeAssetBindingListItemRecord>, BackendError> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT
                    node_assets.asset_id,
                    node_assets.role,
                    node_assets.created_at,
                    assets.relative_path,
                    assets.media_type,
                    assets.mime_type,
                    assets.byte_size,
                    assets.width,
                    assets.height,
                    assets.duration_ms,
                    assets.indexed_at,
                    assets.missing_at,
                    derivative.relative_path,
                    derivative.status
                 FROM node_assets
                 INNER JOIN assets ON assets.id = node_assets.asset_id
                 LEFT JOIN asset_derivatives AS derivative
                   ON derivative.asset_id = assets.id
                  AND derivative.derivative_kind = 'thumbnail_card'
                 WHERE node_assets.node_id = ?1
                 ORDER BY node_assets.created_at ASC, node_assets.asset_id ASC, node_assets.role ASC",
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to prepare node asset bindings for {node_id}: {error}"),
                )
            })?;

        let rows = statement
            .query_map(params![node_id], |row| {
                Ok(NodeAssetBindingListItemRecord {
                    asset_id: row.get(0)?,
                    role: row.get(1)?,
                    created_at: row.get(2)?,
                    relative_path: row.get(3)?,
                    media_type: row.get(4)?,
                    mime_type: row.get(5)?,
                    byte_size: row.get(6)?,
                    width: row.get(7)?,
                    height: row.get(8)?,
                    duration_ms: row.get(9)?,
                    indexed_at: row.get(10)?,
                    missing_at: row.get(11)?,
                    thumbnail_relative_path: row.get(12)?,
                    thumbnail_status: row.get(13)?,
                })
            })
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to list node asset bindings for {node_id}: {error}"),
                )
            })?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|error| {
            BackendError::new(
                "storage_error",
                format!("failed to read node asset bindings for {node_id}: {error}"),
            )
        })
    }

    pub fn insert_node_asset_binding(
        &self,
        node_id: &str,
        asset_id: &str,
        role: &str,
        created_at: &str,
    ) -> Result<bool, BackendError> {
        let inserted_rows = self
            .conn
            .execute(
                "INSERT OR IGNORE INTO node_assets (node_id, asset_id, role, created_at)
                 VALUES (?1, ?2, ?3, ?4)",
                params![node_id, asset_id, role, created_at],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!(
                        "failed to insert node asset binding {node_id}:{asset_id}:{role}: {error}"
                    ),
                )
            })?;

        Ok(inserted_rows > 0)
    }

    pub fn delete_node_asset_binding(
        &self,
        node_id: &str,
        asset_id: &str,
        role: &str,
    ) -> Result<bool, BackendError> {
        let deleted_rows = self
            .conn
            .execute(
                "DELETE FROM node_assets WHERE node_id = ?1 AND asset_id = ?2 AND role = ?3",
                params![node_id, asset_id, role],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!(
                        "failed to delete node asset binding {node_id}:{asset_id}:{role}: {error}"
                    ),
                )
            })?;

        Ok(deleted_rows > 0)
    }

    pub fn upsert_asset(&self, record: &AssetRecord) -> Result<String, BackendError> {
        if let Some(existing) = self.load_asset_by_relative_path(&record.relative_path)? {
            self.conn
                .execute(
                    "UPDATE assets
                     SET media_type = ?1,
                         mime_type = ?2,
                         byte_size = ?3,
                         sha256 = ?4,
                         width = ?5,
                         height = ?6,
                         duration_ms = ?7,
                         modified_at = ?8,
                         indexed_at = ?9,
                         missing_at = ?10,
                         updated_at = ?11
                     WHERE id = ?12",
                    params![
                        record.media_type,
                        record.mime_type,
                        record.byte_size,
                        record.sha256,
                        record.width,
                        record.height,
                        record.duration_ms,
                        record.modified_at,
                        record.indexed_at,
                        record.missing_at,
                        record.updated_at,
                        existing.id,
                    ],
                )
                .map_err(|error| {
                    BackendError::new(
                        "storage_error",
                        format!("failed to update asset {}: {error}", record.relative_path),
                    )
                })?;

            return Ok(existing.id);
        }

        let asset_id = record
            .id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        self.conn
            .execute(
                "INSERT INTO assets (
                    id,
                    relative_path,
                    media_type,
                    mime_type,
                    byte_size,
                    sha256,
                    width,
                    height,
                    duration_ms,
                    modified_at,
                    indexed_at,
                    missing_at,
                    created_at,
                    updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                params![
                    asset_id,
                    record.relative_path,
                    record.media_type,
                    record.mime_type,
                    record.byte_size,
                    record.sha256,
                    record.width,
                    record.height,
                    record.duration_ms,
                    record.modified_at,
                    record.indexed_at,
                    record.missing_at,
                    record.created_at,
                    record.updated_at,
                ],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to insert asset {}: {error}", record.relative_path),
                )
            })?;

        Ok(asset_id)
    }

    pub fn load_asset_by_relative_path(
        &self,
        relative_path: &str,
    ) -> Result<Option<StoredAssetRecord>, BackendError> {
        self.conn
            .query_row(
                "SELECT
                    id,
                    relative_path,
                    media_type,
                    mime_type,
                    byte_size,
                    sha256,
                    width,
                    height,
                    duration_ms,
                    modified_at,
                    indexed_at,
                    missing_at,
                    created_at,
                    updated_at
                 FROM assets
                 WHERE relative_path = ?1
                 LIMIT 1",
                [relative_path],
                map_asset_record,
            )
            .optional()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to load asset {relative_path}: {error}"),
                )
            })
    }

    pub fn load_asset_by_id(&self, asset_id: &str) -> Result<StoredAssetRecord, BackendError> {
        self.conn
            .query_row(
                "SELECT
                    id,
                    relative_path,
                    media_type,
                    mime_type,
                    byte_size,
                    sha256,
                    width,
                    height,
                    duration_ms,
                    modified_at,
                    indexed_at,
                    missing_at,
                    created_at,
                    updated_at
                 FROM assets
                 WHERE id = ?1
                 LIMIT 1",
                [asset_id],
                map_asset_record,
            )
            .optional()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to load asset {asset_id}: {error}"),
                )
            })?
            .ok_or_else(|| {
                BackendError::new("asset_not_found", format!("unknown asset_id {asset_id}"))
            })
    }

    pub fn load_asset_derivative(
        &self,
        asset_id: &str,
        derivative_kind: &str,
    ) -> Result<Option<StoredAssetDerivativeRecord>, BackendError> {
        self.conn
            .query_row(
                "SELECT
                    id,
                    asset_id,
                    derivative_kind,
                    relative_path,
                    generator,
                    spec_json,
                    width,
                    height,
                    duration_ms,
                    status,
                    error_message,
                    created_at,
                    updated_at
                 FROM asset_derivatives
                 WHERE asset_id = ?1 AND derivative_kind = ?2
                 LIMIT 1",
                params![asset_id, derivative_kind],
                map_asset_derivative_record,
            )
            .optional()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!(
                        "failed to load derivative {derivative_kind} for asset {asset_id}: {error}"
                    ),
                )
            })
    }

    pub fn upsert_asset_derivative(
        &self,
        record: &AssetDerivativeRecord,
    ) -> Result<String, BackendError> {
        if let Some(existing) =
            self.load_asset_derivative(&record.asset_id, &record.derivative_kind)?
        {
            self.conn
                .execute(
                    "UPDATE asset_derivatives
                     SET relative_path = ?1,
                         generator = ?2,
                         spec_json = ?3,
                         width = ?4,
                         height = ?5,
                         duration_ms = ?6,
                         status = ?7,
                         error_message = ?8,
                         updated_at = ?9
                     WHERE id = ?10",
                    params![
                        record.relative_path,
                        record.generator,
                        record.spec_json,
                        record.width,
                        record.height,
                        record.duration_ms,
                        record.status,
                        record.error_message,
                        record.updated_at,
                        existing.id,
                    ],
                )
                .map_err(|error| {
                    BackendError::new(
                        "storage_error",
                        format!(
                            "failed to update derivative {} for asset {}: {error}",
                            record.derivative_kind, record.asset_id
                        ),
                    )
                })?;

            return Ok(existing.id);
        }

        let derivative_id = record
            .id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        self.conn
            .execute(
                "INSERT INTO asset_derivatives (
                    id,
                    asset_id,
                    derivative_kind,
                    relative_path,
                    generator,
                    spec_json,
                    width,
                    height,
                    duration_ms,
                    status,
                    error_message,
                    created_at,
                    updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![
                    derivative_id,
                    record.asset_id,
                    record.derivative_kind,
                    record.relative_path,
                    record.generator,
                    record.spec_json,
                    record.width,
                    record.height,
                    record.duration_ms,
                    record.status,
                    record.error_message,
                    record.created_at,
                    record.updated_at,
                ],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!(
                        "failed to insert derivative {} for asset {}: {error}",
                        record.derivative_kind, record.asset_id
                    ),
                )
            })?;

        Ok(derivative_id)
    }

    pub fn delete_asset_derivative(
        &self,
        asset_id: &str,
        derivative_kind: &str,
    ) -> Result<Option<String>, BackendError> {
        let existing = self.load_asset_derivative(asset_id, derivative_kind)?;
        if let Some(existing) = existing {
            self.conn
                .execute(
                    "DELETE FROM asset_derivatives WHERE id = ?1",
                    [existing.id.as_str()],
                )
                .map_err(|error| {
                    BackendError::new(
                        "storage_error",
                        format!(
                            "failed to delete derivative {derivative_kind} for asset {asset_id}: {error}"
                        ),
                    )
                })?;

            return Ok(Some(existing.relative_path));
        }

        Ok(None)
    }

    pub fn remove_assets_except(
        &self,
        relative_paths: &[String],
    ) -> Result<Vec<String>, BackendError> {
        let known_paths = relative_paths
            .iter()
            .cloned()
            .collect::<std::collections::BTreeSet<_>>();
        let mut statement = self
            .conn
            .prepare(
                "SELECT assets.id, assets.relative_path, asset_derivatives.relative_path
                 FROM assets
                 LEFT JOIN asset_derivatives ON asset_derivatives.asset_id = assets.id",
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to prepare stale asset scan: {error}"),
                )
            })?;
        let existing_rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            })
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to query existing assets: {error}"),
                )
            })?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to read existing assets: {error}"),
                )
            })?;

        let mut stale_asset_ids = Vec::new();
        let mut stale_derivative_paths = Vec::new();
        for (asset_id, relative_path, derivative_relative_path) in existing_rows {
            if known_paths.contains(&relative_path) {
                continue;
            }

            if !stale_asset_ids.iter().any(|existing| existing == &asset_id) {
                stale_asset_ids.push(asset_id);
            }
            if let Some(derivative_relative_path) = derivative_relative_path {
                stale_derivative_paths.push(derivative_relative_path);
            }
        }

        for asset_id in stale_asset_ids {
            self.conn
                .execute("DELETE FROM assets WHERE id = ?1", [asset_id.as_str()])
                .map_err(|error| {
                    BackendError::new(
                        "storage_error",
                        format!("failed to delete stale asset {asset_id}: {error}"),
                    )
                })?;
        }

        stale_derivative_paths.sort();
        stale_derivative_paths.dedup();
        Ok(stale_derivative_paths)
    }

    pub fn clear_media_jobs(&self) -> Result<(), BackendError> {
        self.conn
            .execute(
                "DELETE FROM jobs WHERE job_type = 'generate_asset_thumbnail'",
                [],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to clear media jobs: {error}"),
                )
            })?;

        Ok(())
    }

    pub fn insert_job(&self, record: &JobRecord) -> Result<String, BackendError> {
        self.conn
            .execute(
                "INSERT INTO jobs (id, job_type, status, payload_json, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    record.id,
                    record.job_type,
                    record.status,
                    record.payload_json,
                    record.created_at,
                    record.updated_at,
                ],
            )
            .map_err(|error| {
                BackendError::new("storage_error", format!("failed to insert job: {error}"))
            })?;

        Ok(record.id.clone())
    }

    pub fn update_job_status(
        &self,
        job_id: &str,
        status: &str,
        payload_json: &str,
        updated_at: &str,
    ) -> Result<(), BackendError> {
        self.conn
            .execute(
                "UPDATE jobs SET status = ?1, payload_json = ?2, updated_at = ?3 WHERE id = ?4",
                params![status, payload_json, updated_at, job_id],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to update job {job_id}: {error}"),
                )
            })?;

        Ok(())
    }

    pub fn list_graph_node_records(
        &self,
        graph_id: &str,
    ) -> Result<Vec<GraphNodeRecord>, BackendError> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT id, graph_id, node_type, is_system, payload_json, created_at, updated_at
                 FROM nodes
                 WHERE graph_id = ?1
                 ORDER BY created_at ASC, id ASC",
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to prepare graph node list for {graph_id}: {error}"),
                )
            })?;

        let rows = statement
            .query_map([graph_id], map_graph_node_record)
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to list graph nodes for {graph_id}: {error}"),
                )
            })?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|error| {
            BackendError::new(
                "storage_error",
                format!("failed to read graph nodes for {graph_id}: {error}"),
            )
        })
    }

    pub fn load_graph_node_record(
        &self,
        graph_id: &str,
        node_id: &str,
    ) -> Result<GraphNodeRecord, BackendError> {
        self.conn
            .query_row(
                "SELECT id, graph_id, node_type, is_system, payload_json, created_at, updated_at
                 FROM nodes
                 WHERE graph_id = ?1 AND id = ?2
                 LIMIT 1",
                params![graph_id, node_id],
                map_graph_node_record,
            )
            .optional()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to load node {node_id} for graph {graph_id}: {error}"),
                )
            })?
            .ok_or_else(|| {
                BackendError::new(
                    "graph_node_not_found",
                    format!("node {node_id} does not belong to graph {graph_id}"),
                )
            })
    }

    pub fn load_node_record_by_id(&self, node_id: &str) -> Result<GraphNodeRecord, BackendError> {
        self.conn
            .query_row(
                "SELECT id, graph_id, node_type, is_system, payload_json, created_at, updated_at
                 FROM nodes
                 WHERE id = ?1
                 LIMIT 1",
                [node_id],
                map_graph_node_record,
            )
            .optional()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to load node {node_id}: {error}"),
                )
            })?
            .ok_or_else(|| {
                BackendError::new("graph_node_not_found", format!("unknown node_id {node_id}"))
            })
    }

    pub fn load_system_anchor_node_record(
        &self,
        graph_id: &str,
    ) -> Result<Option<GraphNodeRecord>, BackendError> {
        self.conn
            .query_row(
                "SELECT id, graph_id, node_type, is_system, payload_json, created_at, updated_at
                 FROM nodes
                 WHERE graph_id = ?1 AND is_system = 1
                 ORDER BY created_at ASC, id ASC
                 LIMIT 1",
                [graph_id],
                map_graph_node_record,
            )
            .optional()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to load system anchor for graph {graph_id}: {error}"),
                )
            })
    }

    pub fn list_graph_edge_records(
        &self,
        graph_id: &str,
    ) -> Result<Vec<GraphEdgeRecord>, BackendError> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT id, graph_id, source_node_id, target_node_id, edge_type, payload_json, created_at, updated_at
                 FROM edges
                 WHERE graph_id = ?1
                 ORDER BY created_at ASC, id ASC",
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to prepare graph edge list for {graph_id}: {error}"),
                )
            })?;

        let rows = statement
            .query_map([graph_id], map_graph_edge_record)
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to list graph edges for {graph_id}: {error}"),
                )
            })?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|error| {
            BackendError::new(
                "storage_error",
                format!("failed to read graph edges for {graph_id}: {error}"),
            )
        })
    }

    pub fn load_graph_edge_record(
        &self,
        graph_id: &str,
        edge_id: &str,
    ) -> Result<GraphEdgeRecord, BackendError> {
        self.conn
            .query_row(
                "SELECT id, graph_id, source_node_id, target_node_id, edge_type, payload_json, created_at, updated_at
                 FROM edges
                 WHERE graph_id = ?1 AND id = ?2
                 LIMIT 1",
                params![graph_id, edge_id],
                map_graph_edge_record,
            )
            .optional()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to load edge {edge_id} for graph {graph_id}: {error}"),
                )
            })?
            .ok_or_else(|| {
                BackendError::new(
                    "graph_edge_not_found",
                    format!("edge {edge_id} does not belong to graph {graph_id}"),
                )
            })
    }

    pub fn graph_edge_exists(
        &self,
        graph_id: &str,
        source_node_id: &str,
        target_node_id: &str,
        edge_type: &str,
    ) -> Result<bool, BackendError> {
        let exists: i64 = self
            .conn
            .query_row(
                "SELECT EXISTS(
                    SELECT 1
                    FROM edges
                    WHERE graph_id = ?1
                      AND source_node_id = ?2
                      AND target_node_id = ?3
                      AND edge_type = ?4
                 )",
                params![graph_id, source_node_id, target_node_id, edge_type],
                |row| row.get(0),
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!(
                        "failed to inspect duplicate graph edge {graph_id}:{source_node_id}:{target_node_id}:{edge_type}: {error}"
                    ),
                )
            })?;

        Ok(exists == 1)
    }

    pub fn insert_graph_edge(&self, record: &GraphEdgeRecord) -> Result<(), BackendError> {
        self.conn
            .execute(
                "INSERT INTO edges (
                    id,
                    graph_id,
                    source_node_id,
                    target_node_id,
                    edge_type,
                    payload_json,
                    created_at,
                    updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    record.id,
                    record.graph_id,
                    record.source_node_id,
                    record.target_node_id,
                    record.edge_type,
                    record.payload_json,
                    record.created_at,
                    record.updated_at,
                ],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to insert graph edge {}: {error}", record.id),
                )
            })?;

        Ok(())
    }

    pub fn delete_graph_edge(&self, graph_id: &str, edge_id: &str) -> Result<(), BackendError> {
        let deleted_rows = self
            .conn
            .execute(
                "DELETE FROM edges WHERE graph_id = ?1 AND id = ?2",
                params![graph_id, edge_id],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to delete graph edge {edge_id}: {error}"),
                )
            })?;

        if deleted_rows == 0 {
            return Err(BackendError::new(
                "graph_edge_not_found",
                format!("edge {edge_id} does not belong to graph {graph_id}"),
            ));
        }

        Ok(())
    }

    pub fn delete_graph_node(&self, graph_id: &str, node_id: &str) -> Result<(), BackendError> {
        let deleted_rows = self
            .conn
            .execute(
                "DELETE FROM nodes WHERE graph_id = ?1 AND id = ?2",
                params![graph_id, node_id],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to delete graph node {node_id}: {error}"),
                )
            })?;

        if deleted_rows == 0 {
            return Err(BackendError::new(
                "graph_node_not_found",
                format!("node {node_id} does not belong to graph {graph_id}"),
            ));
        }

        Ok(())
    }

    pub fn delete_graph_record(&self, graph_id: &str) -> Result<(), BackendError> {
        let deleted_rows = self
            .conn
            .execute("DELETE FROM graphs WHERE id = ?1", params![graph_id])
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to delete graph {graph_id}: {error}"),
                )
            })?;

        if deleted_rows == 0 {
            return Err(BackendError::new(
                "graph_not_found",
                format!("unknown graph_id {graph_id}"),
            ));
        }

        Ok(())
    }

    pub fn project_exists(&self) -> Result<bool, BackendError> {
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM project_meta", [], |row| row.get(0))
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to inspect project metadata: {error}"),
                )
            })?;

        Ok(count > 0)
    }

    pub fn insert_project_meta(&self, record: &ProjectMetaRecord) -> Result<(), BackendError> {
        self.conn
            .execute(
                "INSERT INTO project_meta (project_id, project_name, template_id, template_version, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    record.project_id,
                    record.project_name,
                    record.template_id,
                    i64::from(record.template_version),
                    record.created_at,
                    record.updated_at
                ],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to insert project metadata: {error}"),
                )
            })?;

        Ok(())
    }

    pub fn load_project_meta(&self) -> Result<ProjectMetaRecord, BackendError> {
        self.conn
            .query_row(
                "SELECT project_id, project_name, template_id, template_version, created_at, updated_at
                 FROM project_meta LIMIT 1",
                [],
                |row| {
                    Ok(ProjectMetaRecord {
                        project_id: row.get(0)?,
                        project_name: row.get(1)?,
                        template_id: row.get(2)?,
                        template_version: row.get::<_, i64>(3)? as u32,
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                },
            )
            .optional()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to load project metadata: {error}"),
                )
            })?
            .ok_or_else(|| BackendError::new("invalid_project", "project metadata is missing"))
    }

    pub fn seed_root_graph(
        &self,
        seed: &RootGraphSeed,
        timestamp: &str,
    ) -> Result<GraphSummary, BackendError> {
        if let Ok(root_graph) = self.load_root_graph() {
            return Ok(root_graph);
        }

        let graph = GraphSummary {
            id: Uuid::new_v4().to_string(),
            layer_type: seed.layer_type.clone(),
            name: seed.graph_name.clone(),
            is_root: true,
        };

        self.conn
            .execute(
                "INSERT INTO graphs (id, layer_type, name, is_root, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    graph.id,
                    graph.layer_type,
                    graph.name,
                    1_i64,
                    timestamp,
                    timestamp
                ],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to seed root graph: {error}"),
                )
            })?;

        Ok(graph)
    }

    pub fn insert_child_graph(
        &self,
        graph: &StoredGraphRecord,
        timestamp: &str,
    ) -> Result<(), BackendError> {
        self.conn
            .execute(
                "INSERT INTO graphs (
                    id,
                    layer_type,
                    name,
                    is_root,
                    parent_graph_id,
                    source_node_id,
                    created_at,
                    updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    graph.id,
                    graph.layer_type,
                    graph.name,
                    if graph.is_root { 1_i64 } else { 0_i64 },
                    graph.parent_graph_id,
                    graph.source_node_id,
                    timestamp,
                    timestamp
                ],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to insert child graph {}: {error}", graph.id),
                )
            })?;

        Ok(())
    }

    pub fn insert_graph_node(&self, record: &GraphNodeRecord) -> Result<(), BackendError> {
        self.conn
            .execute(
                "INSERT INTO nodes (id, graph_id, node_type, is_system, payload_json, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    record.id,
                    record.graph_id,
                    record.node_type,
                    if record.is_system { 1_i64 } else { 0_i64 },
                    record.payload_json,
                    record.created_at,
                    record.updated_at
                ],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to insert graph node {}: {error}", record.id),
                )
            })?;

        Ok(())
    }

    pub fn update_graph_node_payload(
        &self,
        graph_id: &str,
        node_id: &str,
        payload_json: &str,
        updated_at: &str,
    ) -> Result<(), BackendError> {
        self.conn.execute_batch("BEGIN IMMEDIATE TRANSACTION").map_err(|error| {
            BackendError::new(
                "storage_error",
                format!(
                    "failed to begin node update transaction for {node_id} in {graph_id}: {error}"
                ),
            )
        })?;

        let updated_rows = match self.conn.execute(
            "UPDATE nodes
             SET payload_json = ?1, updated_at = ?2
             WHERE graph_id = ?3 AND id = ?4",
            params![payload_json, updated_at, graph_id, node_id],
        ) {
            Ok(updated_rows) => updated_rows,
            Err(error) => {
                let _ = self.conn.execute_batch("ROLLBACK");
                return Err(BackendError::new(
                    "storage_error",
                    format!("failed to update payload for node {node_id}: {error}"),
                ));
            }
        };

        if updated_rows == 0 {
            let _ = self.conn.execute_batch("ROLLBACK");
            return Err(BackendError::new(
                "graph_node_not_found",
                format!("node {node_id} does not belong to graph {graph_id}"),
            ));
        }

        self.conn.execute_batch("COMMIT").map_err(|error| {
            let _ = self.conn.execute_batch("ROLLBACK");
            BackendError::new(
                "storage_error",
                format!("failed to commit payload update for node {node_id}: {error}"),
            )
        })?;

        Ok(())
    }

    pub fn record_app_event(
        &self,
        event_type: &str,
        payload_json: &str,
        timestamp: &str,
    ) -> Result<(), BackendError> {
        self.conn
            .execute(
                "INSERT INTO app_events (event_type, payload_json, created_at) VALUES (?1, ?2, ?3)",
                params![event_type, payload_json, timestamp],
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to record app event: {error}"),
                )
            })?;

        Ok(())
    }

    fn count_assets_by_media_type(&self, media_type: &str) -> Result<u32, BackendError> {
        let count: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM assets WHERE media_type = ?1 AND missing_at IS NULL",
                [media_type],
                |row| row.get(0),
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to count {media_type} assets: {error}"),
                )
            })?;

        Ok(count as u32)
    }

    fn count_other_assets(&self) -> Result<u32, BackendError> {
        let count: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*)
                 FROM assets
                 WHERE missing_at IS NULL
                   AND media_type NOT IN ('image', 'video', 'audio', 'document')",
                [],
                |row| row.get(0),
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to count other assets: {error}"),
                )
            })?;

        Ok(count as u32)
    }

    fn count_ready_thumbnails(&self) -> Result<u32, BackendError> {
        let count: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*)
                 FROM asset_derivatives
                 INNER JOIN assets ON assets.id = asset_derivatives.asset_id
                 WHERE derivative_kind = 'thumbnail_card'
                   AND status = 'ready'
                   AND assets.missing_at IS NULL",
                [],
                |row| row.get(0),
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to count ready thumbnails: {error}"),
                )
            })?;

        Ok(count as u32)
    }

    fn count_jobs_by_status(&self, status: &str) -> Result<u32, BackendError> {
        let count: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*)
                 FROM jobs
                 WHERE status = ?1
                   AND job_type IN ('refresh_project_media_index', 'generate_asset_thumbnail')",
                [status],
                |row| row.get(0),
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to count jobs with status {status}: {error}"),
                )
            })?;

        Ok(count as u32)
    }

    fn last_indexed_at(&self) -> Result<Option<String>, BackendError> {
        let last_asset_indexed_at: Option<String> = self
            .conn
            .query_row(
                "SELECT MAX(indexed_at) FROM assets WHERE missing_at IS NULL",
                [],
                |row| row.get(0),
            )
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to read latest asset indexed_at: {error}"),
                )
            })?;

        if last_asset_indexed_at.is_some() {
            return Ok(last_asset_indexed_at);
        }

        self.conn
            .query_row(
                "SELECT updated_at
                 FROM jobs
                 WHERE job_type = 'refresh_project_media_index' AND status = 'completed'
                 ORDER BY updated_at DESC
                 LIMIT 1",
                [],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| {
                BackendError::new(
                    "storage_error",
                    format!("failed to read latest media index job: {error}"),
                )
            })
    }
}

fn map_graph_record(row: &Row<'_>) -> rusqlite::Result<StoredGraphRecord> {
    Ok(StoredGraphRecord {
        id: row.get(0)?,
        layer_type: row.get(1)?,
        name: row.get(2)?,
        is_root: row.get::<_, i64>(3)? == 1,
        parent_graph_id: row.get(4)?,
        source_node_id: row.get(5)?,
    })
}

fn map_graph_node_record(row: &Row<'_>) -> rusqlite::Result<GraphNodeRecord> {
    Ok(GraphNodeRecord {
        id: row.get(0)?,
        graph_id: row.get(1)?,
        node_type: row.get(2)?,
        is_system: row.get::<_, i64>(3)? == 1,
        payload_json: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn map_graph_edge_record(row: &Row<'_>) -> rusqlite::Result<GraphEdgeRecord> {
    Ok(GraphEdgeRecord {
        id: row.get(0)?,
        graph_id: row.get(1)?,
        source_node_id: row.get(2)?,
        target_node_id: row.get(3)?,
        edge_type: row.get(4)?,
        payload_json: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn map_asset_record(row: &Row<'_>) -> rusqlite::Result<StoredAssetRecord> {
    Ok(StoredAssetRecord {
        id: row.get(0)?,
        relative_path: row.get(1)?,
        media_type: row.get(2)?,
        mime_type: row.get(3)?,
        byte_size: row.get(4)?,
        sha256: row.get(5)?,
        width: row.get(6)?,
        height: row.get(7)?,
        duration_ms: row.get(8)?,
        modified_at: row.get(9)?,
        indexed_at: row.get(10)?,
        missing_at: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

fn map_asset_derivative_record(row: &Row<'_>) -> rusqlite::Result<StoredAssetDerivativeRecord> {
    Ok(StoredAssetDerivativeRecord {
        id: row.get(0)?,
        asset_id: row.get(1)?,
        derivative_kind: row.get(2)?,
        relative_path: row.get(3)?,
        generator: row.get(4)?,
        spec_json: row.get(5)?,
        width: row.get(6)?,
        height: row.get(7)?,
        duration_ms: row.get(8)?,
        status: row.get(9)?,
        error_message: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

fn record_to_graph_summary(record: &StoredGraphRecord) -> GraphSummary {
    GraphSummary {
        id: record.id.clone(),
        layer_type: record.layer_type.clone(),
        name: record.name.clone(),
        is_root: record.is_root,
    }
}
