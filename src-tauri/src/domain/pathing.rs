use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::project::BackendError;

#[derive(Debug, Clone)]
pub struct ProjectPaths {
    root: PathBuf,
}

impl ProjectPaths {
    pub fn new(root: impl AsRef<Path>) -> Self {
        Self {
            root: root.as_ref().to_path_buf(),
        }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn producer_dir(&self) -> PathBuf {
        self.root.join(".producer")
    }

    pub fn database_path(&self) -> PathBuf {
        self.producer_dir().join("project.db")
    }

    pub fn settings_path(&self) -> PathBuf {
        self.producer_dir().join("settings.json")
    }

    pub fn assets_dir(&self) -> PathBuf {
        self.root.join("assets")
    }

    pub fn exports_dir(&self) -> PathBuf {
        self.root.join("exports")
    }

    pub fn ensure_layout(&self) -> Result<(), BackendError> {
        for directory in [
            self.root().to_path_buf(),
            self.producer_dir(),
            self.producer_dir().join("thumbnails"),
            self.producer_dir().join("cache"),
            self.producer_dir().join("logs"),
            self.assets_dir(),
            self.assets_dir().join("docs"),
            self.assets_dir().join("images"),
            self.assets_dir().join("videos"),
            self.assets_dir().join("audio"),
            self.exports_dir(),
        ] {
            fs::create_dir_all(&directory).map_err(|error| {
                BackendError::new(
                    "io_error",
                    format!(
                        "failed to create directory {}: {error}",
                        directory.display()
                    ),
                )
            })?;
        }

        Ok(())
    }

    pub fn relative_asset_path(
        &self,
        asset_path: impl AsRef<Path>,
    ) -> Result<PathBuf, BackendError> {
        let asset_path = asset_path.as_ref();
        let absolute_asset_path = if asset_path.is_absolute() {
            asset_path.to_path_buf()
        } else {
            self.root.join(asset_path)
        };

        let canonical_asset_path = absolute_asset_path.canonicalize().map_err(|error| {
            BackendError::new(
                "invalid_asset_path",
                format!(
                    "failed to resolve asset path {}: {error}",
                    absolute_asset_path.display()
                ),
            )
        })?;
        let canonical_assets_dir = self.assets_dir().canonicalize().map_err(|error| {
            BackendError::new(
                "invalid_asset_path",
                format!(
                    "failed to resolve assets directory {}: {error}",
                    self.assets_dir().display()
                ),
            )
        })?;

        canonical_asset_path
            .strip_prefix(&canonical_assets_dir)
            .map(Path::to_path_buf)
            .map_err(|_| {
                BackendError::new(
                    "invalid_asset_path",
                    format!(
                        "asset path {} is outside the assets directory {}",
                        canonical_asset_path.display(),
                        canonical_assets_dir.display()
                    ),
                )
            })
    }
}
