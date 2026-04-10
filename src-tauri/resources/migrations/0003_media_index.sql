CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_relative_path_unique
  ON assets(relative_path);

CREATE INDEX IF NOT EXISTS idx_assets_media_type
  ON assets(media_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_derivatives_unique
  ON asset_derivatives(asset_id, derivative_kind, relative_path);

CREATE INDEX IF NOT EXISTS idx_jobs_type_status
  ON jobs(job_type, status);
