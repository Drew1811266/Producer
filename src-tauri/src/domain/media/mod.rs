use std::{
    fs,
    fs::File,
    io::Read,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

use image::GenericImageView;
use serde_json::json;
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::domain::{
    pathing::ProjectPaths,
    project::BackendError,
    storage::{AssetDerivativeRecord, AssetRecord, JobRecord, MediaIndexSummaryRecord, Storage},
};

pub const THUMBNAIL_DERIVATIVE_KIND: &str = "thumbnail_card";
const THUMBNAIL_GENERATOR: &str = "image_rs";
const THUMBNAIL_MAX_EDGE: u32 = 320;

#[derive(Debug, Clone)]
struct ScannedAsset {
    relative_path: PathBuf,
    media_type: String,
    mime_type: Option<String>,
    byte_size: i64,
    sha256: String,
    width: Option<i64>,
    height: Option<i64>,
    duration_ms: Option<i64>,
    modified_at: String,
    indexed_at: String,
}

pub fn refresh_project_media_index(
    storage: &Storage,
    paths: &ProjectPaths,
    timestamp: &str,
) -> Result<MediaIndexSummaryRecord, BackendError> {
    refresh_project_media_index_with_reason(storage, paths, timestamp, None)
}

pub fn refresh_project_media_index_with_reason(
    storage: &Storage,
    paths: &ProjectPaths,
    timestamp: &str,
    reason: Option<&str>,
) -> Result<MediaIndexSummaryRecord, BackendError> {
    let normalized_reason = reason
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let refresh_payload = json!({
        "projectRoot": paths.root().display().to_string(),
        "reason": normalized_reason.clone(),
    });
    let refresh_job_id = storage.insert_job(&JobRecord {
        id: uuid::Uuid::new_v4().to_string(),
        job_type: "refresh_project_media_index".into(),
        status: "pending".into(),
        payload_json: refresh_payload.to_string(),
        created_at: timestamp.into(),
        updated_at: timestamp.into(),
    })?;

    let refresh_result = run_refresh(storage, paths, timestamp);

    match refresh_result {
        Ok(summary) => {
            storage.update_job_status(
                &refresh_job_id,
                "completed",
                &json!({
                    "assetCount": summary.asset_count,
                    "readyThumbnailCount": summary.ready_thumbnail_count,
                    "missingThumbnailCount": summary.missing_thumbnail_count,
                    "unsupportedThumbnailCount": summary.unsupported_thumbnail_count,
                    "reason": normalized_reason.clone(),
                })
                .to_string(),
                timestamp,
            )?;
            storage.record_app_event(
                "project_media_index_refreshed",
                &json!({
                    "assetCount": summary.asset_count,
                    "imageCount": summary.image_count,
                    "documentCount": summary.document_count,
                    "readyThumbnailCount": summary.ready_thumbnail_count,
                })
                .to_string(),
                timestamp,
            )?;

            Ok(summary)
        }
        Err(error) => {
            storage.update_job_status(
                &refresh_job_id,
                "failed",
                &json!({
                    "reason": normalized_reason.clone(),
                    "error": error.message.clone(),
                })
                .to_string(),
                timestamp,
            )?;
            Err(error)
        }
    }
}

fn run_refresh(
    storage: &Storage,
    paths: &ProjectPaths,
    timestamp: &str,
) -> Result<MediaIndexSummaryRecord, BackendError> {
    let asset_paths = collect_asset_paths(paths)?;
    let mut indexed_relative_paths = Vec::with_capacity(asset_paths.len());

    for asset_path in asset_paths {
        let relative_asset_path = paths.relative_asset_path(&asset_path)?;
        let project_relative_path = PathBuf::from("assets").join(&relative_asset_path);
        indexed_relative_paths.push(normalize_relative_path(&project_relative_path));

        let scanned = scan_asset(paths, &asset_path, &project_relative_path, timestamp)?;
        let asset_id = storage.upsert_asset(&AssetRecord {
            id: None,
            relative_path: normalize_relative_path(&project_relative_path),
            media_type: scanned.media_type.clone(),
            mime_type: scanned.mime_type.clone(),
            byte_size: Some(scanned.byte_size),
            sha256: Some(scanned.sha256.clone()),
            width: scanned.width,
            height: scanned.height,
            duration_ms: scanned.duration_ms,
            modified_at: Some(scanned.modified_at.clone()),
            indexed_at: Some(scanned.indexed_at.clone()),
            missing_at: None,
            created_at: timestamp.into(),
            updated_at: timestamp.into(),
        })?;

        if scanned.media_type == "image" {
            refresh_image_thumbnail(storage, paths, &asset_id, &scanned, timestamp)?;
        } else if let Some(derivative_relative_path) =
            storage.delete_asset_derivative(&asset_id, THUMBNAIL_DERIVATIVE_KIND)?
        {
            remove_relative_file(paths, &derivative_relative_path)?;
        }
    }

    for stale_derivative_path in storage.remove_assets_except(&indexed_relative_paths)? {
        remove_relative_file(paths, &stale_derivative_path)?;
    }

    storage.media_index_summary()
}

fn collect_asset_paths(paths: &ProjectPaths) -> Result<Vec<PathBuf>, BackendError> {
    let mut collected = Vec::new();

    for directory in [
        paths.assets_dir().join("docs"),
        paths.assets_dir().join("images"),
        paths.assets_dir().join("videos"),
        paths.assets_dir().join("audio"),
    ] {
        for entry in WalkDir::new(&directory).into_iter() {
            let entry = entry.map_err(|error| {
                BackendError::new(
                    "media_index_error",
                    format!(
                        "failed to walk asset directory {}: {error}",
                        directory.display()
                    ),
                )
            })?;

            if entry.file_type().is_file() {
                collected.push(entry.into_path());
            }
        }
    }

    collected.sort();
    Ok(collected)
}

fn scan_asset(
    paths: &ProjectPaths,
    absolute_path: &Path,
    relative_path: &Path,
    timestamp: &str,
) -> Result<ScannedAsset, BackendError> {
    let metadata = fs::metadata(absolute_path).map_err(|error| {
        BackendError::new(
            "media_index_error",
            format!(
                "failed to read asset metadata {}: {error}",
                absolute_path.display()
            ),
        )
    })?;
    let byte_size = i64::try_from(metadata.len()).map_err(|error| {
        BackendError::new(
            "media_index_error",
            format!(
                "asset {} is too large to index: {error}",
                absolute_path.display()
            ),
        )
    })?;
    let mime_type = mime_guess::from_path(absolute_path)
        .first_raw()
        .map(ToOwned::to_owned);
    let media_type = classify_media_type(relative_path);
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_secs().to_string())
        .unwrap_or_else(|| timestamp.to_string());
    let sha256 = hash_file(absolute_path)?;
    let (width, height) = if media_type == "image" {
        image::image_dimensions(absolute_path)
            .map(|(width, height)| (Some(i64::from(width)), Some(i64::from(height))))
            .unwrap_or((None, None))
    } else {
        (None, None)
    };

    let _ = paths;

    Ok(ScannedAsset {
        relative_path: relative_path.to_path_buf(),
        media_type,
        mime_type,
        byte_size,
        sha256,
        width,
        height,
        duration_ms: None,
        modified_at,
        indexed_at: timestamp.to_string(),
    })
}

fn refresh_image_thumbnail(
    storage: &Storage,
    paths: &ProjectPaths,
    asset_id: &str,
    asset: &ScannedAsset,
    timestamp: &str,
) -> Result<(), BackendError> {
    let mut derivative_relative_path = PathBuf::from(".producer")
        .join("thumbnails")
        .join(&asset.relative_path);
    derivative_relative_path.set_extension("png");
    let derivative_relative_path_string = normalize_relative_path(&derivative_relative_path);
    let derivative_absolute_path = paths.root().join(&derivative_relative_path);
    let derivative_spec = json!({
        "sourceModifiedAt": asset.modified_at,
        "byteSize": asset.byte_size,
        "mediaType": asset.media_type,
    })
    .to_string();

    if let Some(existing_derivative) =
        storage.load_asset_derivative(asset_id, THUMBNAIL_DERIVATIVE_KIND)?
    {
        if existing_derivative.status == "ready"
            && existing_derivative.spec_json == derivative_spec
            && derivative_absolute_path.is_file()
        {
            return Ok(());
        }
    }

    let generation_result = generate_image_thumbnail(
        &paths.root().join(&asset.relative_path),
        &derivative_absolute_path,
    );

    match generation_result {
        Ok((width, height)) => {
            storage.upsert_asset_derivative(&AssetDerivativeRecord {
                id: None,
                asset_id: asset_id.to_string(),
                derivative_kind: THUMBNAIL_DERIVATIVE_KIND.into(),
                relative_path: derivative_relative_path_string.clone(),
                generator: Some(THUMBNAIL_GENERATOR.into()),
                spec_json: derivative_spec,
                width: Some(i64::from(width)),
                height: Some(i64::from(height)),
                duration_ms: None,
                status: "ready".into(),
                error_message: None,
                created_at: timestamp.into(),
                updated_at: timestamp.into(),
            })?;
            storage.record_app_event(
                "asset_thumbnail_generated",
                &json!({
                    "assetId": asset_id,
                    "relativePath": asset.relative_path.to_string_lossy(),
                })
                .to_string(),
                timestamp,
            )?;
        }
        Err(error) => {
            storage.upsert_asset_derivative(&AssetDerivativeRecord {
                id: None,
                asset_id: asset_id.to_string(),
                derivative_kind: THUMBNAIL_DERIVATIVE_KIND.into(),
                relative_path: derivative_relative_path_string,
                generator: Some(THUMBNAIL_GENERATOR.into()),
                spec_json: derivative_spec,
                width: None,
                height: None,
                duration_ms: None,
                status: "error".into(),
                error_message: Some(error.message.clone()),
                created_at: timestamp.into(),
                updated_at: timestamp.into(),
            })?;
        }
    }

    Ok(())
}

fn generate_image_thumbnail(
    asset_absolute_path: &Path,
    derivative_absolute_path: &Path,
) -> Result<(u32, u32), BackendError> {
    if let Some(parent) = derivative_absolute_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            BackendError::new(
                "thumbnail_generation_error",
                format!(
                    "failed to create thumbnail directory {}: {error}",
                    parent.display()
                ),
            )
        })?;
    }

    let image = image::open(asset_absolute_path).map_err(|error| {
        BackendError::new(
            "thumbnail_generation_error",
            format!(
                "failed to decode image asset {}: {error}",
                asset_absolute_path.display()
            ),
        )
    })?;
    let thumbnail = image.thumbnail(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE);
    let (width, height) = thumbnail.dimensions();

    thumbnail
        .save_with_format(derivative_absolute_path, image::ImageFormat::Png)
        .map_err(|error| {
            BackendError::new(
                "thumbnail_generation_error",
                format!(
                    "failed to write thumbnail {}: {error}",
                    derivative_absolute_path.display()
                ),
            )
        })?;

    Ok((width, height))
}

fn classify_media_type(relative_path: &Path) -> String {
    let components = relative_path
        .components()
        .map(|component| component.as_os_str().to_string_lossy().to_string())
        .collect::<Vec<_>>();
    let category = if components.first().map(String::as_str) == Some("assets") {
        components.get(1).map(String::as_str)
    } else {
        components.first().map(String::as_str)
    };

    match category {
        Some("images") => "image".into(),
        Some("videos") => "video".into(),
        Some("audio") => "audio".into(),
        Some("docs") => "document".into(),
        _ => mime_guess::from_path(relative_path)
            .first_raw()
            .map(|mime| {
                if mime.starts_with("image/") {
                    "image"
                } else if mime.starts_with("video/") {
                    "video"
                } else if mime.starts_with("audio/") {
                    "audio"
                } else {
                    "document"
                }
            })
            .unwrap_or("document")
            .to_string(),
    }
}

fn hash_file(path: &Path) -> Result<String, BackendError> {
    let mut file = File::open(path).map_err(|error| {
        BackendError::new(
            "media_index_error",
            format!("failed to open asset {}: {error}", path.display()),
        )
    })?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 8192];

    loop {
        let bytes_read = file.read(&mut buffer).map_err(|error| {
            BackendError::new(
                "media_index_error",
                format!("failed to read asset {}: {error}", path.display()),
            )
        })?;
        if bytes_read == 0 {
            break;
        }

        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn normalize_relative_path(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn remove_relative_file(paths: &ProjectPaths, relative_path: &str) -> Result<(), BackendError> {
    let absolute_path = paths.root().join(relative_path);
    match fs::remove_file(&absolute_path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(BackendError::new(
            "media_index_error",
            format!(
                "failed to remove stale derivative {}: {error}",
                absolute_path.display()
            ),
        )),
    }
}
