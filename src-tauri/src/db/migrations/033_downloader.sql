-- 033_downloader: resumable chunked downloads (AI model files, generic assets).
--
-- Ported from SignageMaster plugin-downloader, trimmed for SMEMaster:
-- no fang queue, no app-update/media history tables. Two tables only:
--   download_jobs   — one row per queued/active/finished download
--   download_chunks — per-range state for HTTP Range requests (ETag resume)

CREATE TABLE IF NOT EXISTS download_jobs (
    id              TEXT PRIMARY KEY NOT NULL,
    url             TEXT NOT NULL,
    destination_path TEXT NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('ai_model', 'generic')),
    status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
                        'queued', 'probing', 'downloading', 'paused',
                        'completed', 'failed', 'cancelled'
                    )),
    total_bytes     INTEGER NOT NULL DEFAULT 0,
    downloaded_bytes INTEGER NOT NULL DEFAULT 0,
    expected_sha256 TEXT,
    actual_sha256   TEXT,
    max_connections INTEGER NOT NULL DEFAULT 8,
    priority        INTEGER NOT NULL DEFAULT 5,
    etag            TEXT,
    last_modified   TEXT,
    supports_ranges INTEGER NOT NULL DEFAULT 0,
    last_probe_at   TEXT,
    options_json    TEXT,
    error_message   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_download_jobs_status ON download_jobs(status);
CREATE INDEX IF NOT EXISTS idx_download_jobs_category ON download_jobs(category);
CREATE INDEX IF NOT EXISTS idx_download_jobs_priority ON download_jobs(priority DESC);
CREATE INDEX IF NOT EXISTS idx_download_jobs_resume ON download_jobs(status, etag);
CREATE INDEX IF NOT EXISTS idx_download_jobs_url ON download_jobs(url);

CREATE TABLE IF NOT EXISTS download_chunks (
    id              TEXT PRIMARY KEY NOT NULL,
    job_id          TEXT NOT NULL REFERENCES download_jobs(id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,
    start_byte      INTEGER NOT NULL,
    end_byte        INTEGER NOT NULL,
    downloaded_bytes INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                        'pending', 'downloading', 'completed', 'failed'
                    )),
    sha256          TEXT,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(job_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_download_chunks_job_id ON download_chunks(job_id);
CREATE INDEX IF NOT EXISTS idx_download_chunks_status ON download_chunks(status);
