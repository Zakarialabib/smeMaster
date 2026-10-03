//! Resumable chunked downloader for AI models and generic assets.
//!
//! Ported from SignageMaster's `plugin-downloader` crate and adapted to
//! SMEMaster: no `fang` queue (plain tokio tasks + DB-backed recovery), no
//! media extractors, HuggingFace cache-layout finalize. Gopeed-inspired
//! resilience lives in [`engine`] (backoff+jitter, adaptive concurrency,
//! stall detection, cooperative pause).
//!
//! ## Flow (AI model file)
//! 1. `download_hf_file()` — cache hit? return immediately.
//! 2. Probe the HF resolve URL (commit + LFS ETag + size).
//! 3. Create or resume a `download_jobs` row (identity refreshed to the
//!    fresh probe so ETag rotation invalidates stale chunks).
//! 4. Run the chunked engine inline; progress flows via `downloader:progress`.
//! 5. Finalize into `snapshots/<commit>/<file>` + write `refs/<rev>` —
//!    byte-compatible with what `hf-hub` expects, so sidecar + local engine
//!    load the file offline afterwards.

pub mod commands;
pub mod db;
pub mod engine;
pub mod hf;
pub mod types;

use anyhow::{anyhow, Result};
use engine::{EngineContext, ExecuteOutcome};
use sqlx::{Pool, Sqlite};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{Emitter, Manager};
use types::{DownloadJob, DownloadJobOptions, DownloadJobProgress, JobStatus};

pub use engine::EVENT_PROGRESS;

// ── State ───────────────────────────────────────────────────────────────────

/// Managed Tauri state holding the shared engine context.
#[derive(Clone)]
pub struct DownloaderState {
    pub engine: EngineContext,
}

impl DownloaderState {
    pub fn new(app: &tauri::AppHandle, pool: Pool<Sqlite>) -> Self {
        let client = reqwest::Client::builder()
            // Deliberately NO total timeout: multi-hundred-MB model files on
            // slow links must not be killed mid-transfer. Liveness comes from
            // the engine's per-read stall detection instead.
            .connect_timeout(Duration::from_secs(15))
            .pool_idle_timeout(Duration::from_secs(30))
            .user_agent(format!("SMEMaster-Downloader/{}", env!("CARGO_PKG_VERSION")))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        Self {
            engine: EngineContext {
                pool,
                client,
                app: Some(app.clone()),
            },
        }
    }

    pub fn pool(&self) -> &Pool<Sqlite> {
        &self.engine.pool
    }
}

/// `<app_data_dir>/models` — the hf-hub cache root used by `ModelManager`
/// and the ml-sidecar.
pub fn models_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
    let dir = app.path().app_data_dir()?.join("models");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

// ── Progress projection ─────────────────────────────────────────────────────

/// Average rate estimate from job timestamps (fallback when no live event
/// stream is attached — e.g. `downloader_list_jobs` after a reload).
fn db_fallback_rate(job: &DownloadJob) -> i64 {
    let created = chrono::DateTime::parse_from_rfc3339(&job.created_at)
        .map(|d| d.with_timezone(&chrono::Utc))
        .ok();
    let updated = chrono::DateTime::parse_from_rfc3339(&job.updated_at)
        .map(|d| d.with_timezone(&chrono::Utc))
        .ok();
    if let (Some(c), Some(u)) = (created, updated) {
        let elapsed = (u - c).num_seconds().max(1) as f64;
        if elapsed > 0.0 && job.downloaded_bytes > 0 {
            return (job.downloaded_bytes as f64 / elapsed) as i64;
        }
    }
    0
}

pub fn job_to_progress(job: &DownloadJob) -> DownloadJobProgress {
    let progress_percentage = if job.total_bytes > 0 {
        ((job.downloaded_bytes as f64) / (job.total_bytes as f64) * 100.0).clamp(0.0, 100.0)
    } else if job.status == JobStatus::Completed {
        100.0
    } else {
        0.0
    };

    let rate = if job.status == JobStatus::Downloading {
        db_fallback_rate(job)
    } else {
        0
    };
    let eta = if job.status == JobStatus::Downloading && rate > 0 && job.total_bytes > 0 {
        let remaining = (job.total_bytes - job.downloaded_bytes).max(0) as f64;
        Some((remaining / rate as f64).ceil() as i64)
    } else {
        None
    };

    let file_name = std::path::Path::new(&job.destination_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| job.destination_path.clone());

    DownloadJobProgress {
        job_id: job.id.clone(),
        url: job.url.clone(),
        file_name,
        destination_path: job.destination_path.clone(),
        category: job.category.clone(),
        status: job.status.clone(),
        total_bytes: job.total_bytes,
        downloaded_bytes: job.downloaded_bytes,
        transfer_rate_bytes_per_sec: rate,
        eta_seconds: eta,
        progress_percentage,
        active_connections: if job.status == JobStatus::Downloading {
            job.max_connections
        } else {
            0
        },
        priority: job.priority,
        error: job.error_message.clone(),
        created_at: job.created_at.clone(),
        updated_at: job.updated_at.clone(),
    }
}

// ── Job lifecycle helpers ───────────────────────────────────────────────────

fn parse_options(job: &DownloadJob) -> DownloadJobOptions {
    job.options_json
        .as_ref()
        .and_then(|j| serde_json::from_str(j).ok())
        .unwrap_or_default()
}

/// Spawn a fire-and-forget execution (create / resume / boot recovery).
/// On success, HuggingFace jobs get their `refs/<revision>` published so
/// hf-hub resolves the file offline from then on.
pub fn spawn_job(state: &DownloaderState, job: DownloadJob) {
    let state = state.clone();
    tokio::spawn(async move {
        match engine::execute_download_job(&state.engine, &job).await {
            Ok(ExecuteOutcome::Completed) => {
                if let Some(app) = state.engine.app.as_ref() {
                    match models_dir(app) {
                        Ok(cache) => finalize_hf_ref(&job, &cache),
                        Err(e) => log::warn!("[downloader] models_dir unavailable: {e}"),
                    }
                }
                log::info!("[downloader] job {} completed", job.id);
            }
            Ok(ExecuteOutcome::Interrupted) => {
                log::info!("[downloader] job {} interrupted (pause/cancel)", job.id);
            }
            Err(e) => {
                // engine marks the row Failed itself when still active.
                log::warn!("[downloader] job {} failed: {e}", job.id);
            }
        }
    });
}

/// Write `refs/<revision>` after a successful HF download (idempotent).
/// `cache` is the hf-hub cache root (`<app_data>/models` in production).
fn finalize_hf_ref(job: &DownloadJob, cache: &Path) {
    let opts = parse_options(job);
    let (Some(repo_id), Some(revision), Some(commit)) =
        (opts.hf_repo_id, opts.hf_revision, opts.hf_commit_hash)
    else {
        return;
    };
    if let Err(e) = hf::publish_ref(cache, &repo_id, &revision, &commit) {
        log::warn!("[downloader] publish_ref failed for {}: {e}", job.id);
    }
}

/// Poll the DB until the job reaches a resting state.
/// Returns `Ok(job)` on `completed`, an error on `failed`/`paused`/`cancelled`.
async fn await_job(state: &DownloaderState, job_id: &str) -> Result<DownloadJob> {
    loop {
        let job = db::get_job(state.pool(), job_id)
            .await
            .map_err(|e| anyhow!("downloader db error: {e}"))?
            .ok_or_else(|| anyhow!("Job {job_id} not found"))?;

        match job.status {
            JobStatus::Completed => return Ok(job),
            JobStatus::Failed => {
                return Err(anyhow!(
                    "{}",
                    job.error_message
                        .clone()
                        .unwrap_or_else(|| "Download failed".to_string())
                ))
            }
            JobStatus::Paused => return Err(anyhow!("Download paused")),
            JobStatus::Cancelled => return Err(anyhow!("Download cancelled")),
            _ => tokio::time::sleep(Duration::from_millis(200)).await,
        }
    }
}

// ── HuggingFace model download entry point ──────────────────────────────────

/// Download one file from a HuggingFace repo with resume, chunking and
/// integrity verification; finalize into the hf-hub cache layout.
///
/// Returns the absolute path of the finalized snapshot file.
pub async fn download_hf_file(
    app: &tauri::AppHandle,
    repo_id: &str,
    filename: &str,
) -> Result<String, String> {
    let state = app.state::<DownloaderState>().inner().clone();
    let cache = models_dir(app).map_err(|e| e.to_string())?;
    download_hf_file_cached(&state, &cache, repo_id, filename).await
}

/// AppHandle-free core of [`download_hf_file`] — also driven by the
/// `hf_smoke` example, which verifies real-model downloads without a
/// running Tauri app. `cache` is the hf-hub cache root
/// (`<app_data>/models` in production, a temp dir in the example).
pub async fn download_hf_file_cached(
    state: &DownloaderState,
    cache: &Path,
    repo_id: &str,
    filename: &str,
) -> Result<String, String> {
    let pool = state.pool().clone();
    let revision = "main";

    // 1) Cache hit → nothing to do (works fully offline).
    if let Some(path) = hf::cached_file(cache, repo_id, revision, filename) {
        return Ok(path.to_string_lossy().to_string());
    }

    let url = hf::resolve_url(repo_id, filename, revision);

    // 2) A job for this URL is already running (double-click / parallel
    //    callers) → just attach to it.
    if let Some(active) = db::get_active_job_by_url(&pool, &url)
        .await
        .map_err(|e| e.to_string())?
    {
        if matches!(active.status, JobStatus::Downloading | JobStatus::Probing | JobStatus::Queued) {
            let job = await_job(&state, &active.id).await.map_err(|e| e.to_string())?;
            finalize_hf_ref(&job, cache);
            return Ok(job.destination_path);
        }
        // paused/failed → fall through to the resume path below.
    }

    // 3) Fresh metadata probe: commit + LFS ETag (expected SHA-256) + size.
    let meta = hf::probe_metadata(&state.engine.client, &url)
        .await
        .map_err(|e| format!("HuggingFace metadata probe failed: {e:#}"))?;
    let expected_sha256 = meta.expected_sha256();
    let dest = hf::snapshot_path(cache, repo_id, revision, &meta.commit_hash, filename);
    let options = DownloadJobOptions {
        hf_repo_id: Some(repo_id.to_string()),
        hf_filename: Some(filename.to_string()),
        hf_revision: Some(revision.to_string()),
        hf_commit_hash: Some(meta.commit_hash.clone()),
        ..Default::default()
    };
    let options_json = serde_json::to_string(&options).map_err(|e| e.to_string())?;

    // 4) Resume an existing failed/paused job, or create a fresh one.
    let job = match db::get_latest_job_by_url(&pool, &url)
        .await
        .map_err(|e| e.to_string())?
    {
        Some(existing)
            if !matches!(
                existing.status,
                JobStatus::Completed | JobStatus::Cancelled
            ) =>
        {
            // Refresh identity: destination (new commit), checksum, options.
            // Chunk bytes survive only if the ETag still matches — the engine
            // invalidates them otherwise.
            db::refresh_job_identity(
                &pool,
                &existing.id,
                &dest.to_string_lossy(),
                expected_sha256.as_deref(),
                Some(&options_json),
            )
            .await
            .map_err(|e| e.to_string())?;
            db::update_job_status(&pool, &existing.id, JobStatus::Queued, None, None)
                .await
                .map_err(|e| e.to_string())?;
            db::get_job(&pool, &existing.id)
                .await
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "job disappeared".to_string())?
        }
        stale => {
            // Fresh job (or the previous run completed but its ref/finalize
            // never landed — the cache check in step 1 already proved the
            // file is not usable yet).
            if let Some(stale) = stale {
                db::delete_job(&pool, &stale.id)
                    .await
                    .map_err(|e| e.to_string())?;
            }
            let now = chrono::Utc::now().to_rfc3339();
            let job = DownloadJob {
                id: uuid::Uuid::new_v4().to_string(),
                url: url.clone(),
                destination_path: dest.to_string_lossy().to_string(),
                category: types::JobCategory::AiModel,
                status: JobStatus::Queued,
                total_bytes: meta.total_size,
                downloaded_bytes: 0,
                expected_sha256: expected_sha256.clone(),
                actual_sha256: None,
                max_connections: 8,
                priority: 5,
                options_json: Some(options_json.clone()),
                error_message: None,
                created_at: now.clone(),
                updated_at: now,
                completed_at: None,
            };
            db::insert_job(&pool, &job)
                .await
                .map_err(|e| e.to_string())?;
            job
        }
    };

    // 5) Run inline so the caller's promise resolves with the final path.
    //    Progress events stream to the UI while we wait.
    let outcome = engine::execute_download_job(&state.engine, &job)
        .await
        .map_err(|e| format!("{e:#}"))?;

    if outcome != ExecuteOutcome::Completed {
        let status = db::get_job_status(&pool, &job.id)
            .await
            .ok()
            .flatten()
            .unwrap_or(JobStatus::Failed);
        return Err(match status {
            JobStatus::Paused => "Download paused".to_string(),
            JobStatus::Cancelled => "Download cancelled".to_string(),
            _ => "Download interrupted".to_string(),
        });
    }

    finalize_hf_ref(&job, cache);
    Ok(job.destination_path)
}

// ── Boot recovery ───────────────────────────────────────────────────────────

/// Re-queue jobs that were mid-flight when the process died. Call after
/// migrations have run (all `download_*` tables exist by then).
pub fn spawn_boot_recovery(app: tauri::AppHandle, pool: Pool<Sqlite>) {
    tokio::spawn(async move {
        // Give the webview a moment to attach listeners; best-effort anyway.
        tokio::time::sleep(Duration::from_secs(2)).await;
        let state = match app.try_state::<DownloaderState>() {
            Some(s) => s.inner().clone(),
            None => return,
        };
        let resumable = match db::list_resumable_jobs(&pool).await {
            Ok(v) => v,
            Err(e) => {
                log::warn!("[downloader] boot recovery query failed: {e}");
                return;
            }
        };
        if resumable.is_empty() {
            return;
        }
        log::info!("[downloader] recovering {} interrupted job(s)", resumable.len());
        for job in resumable {
            // Back to Queued so the engine's status transitions start clean.
            let _ = db::update_job_status(&pool, &job.id, JobStatus::Queued, None, None).await;
            spawn_job(&state, job);
        }
        let _ = app.emit(EVENT_PROGRESS, serde_json::json!({ "bootRecovery": true }));
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::JobCategory;

    fn job(status: JobStatus, downloaded: i64, total: i64) -> DownloadJob {
        DownloadJob {
            id: "j1".into(),
            url: "https://example.com/f".into(),
            destination_path: "/tmp/models/model.safetensors".into(),
            category: JobCategory::AiModel,
            status,
            total_bytes: total,
            downloaded_bytes: downloaded,
            expected_sha256: None,
            actual_sha256: None,
            max_connections: 8,
            priority: 5,
            options_json: None,
            error_message: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
            completed_at: None,
        }
    }

    #[test]
    fn progress_projection() {
        let p = job_to_progress(&job(JobStatus::Downloading, 25, 100));
        assert_eq!(p.progress_percentage, 25.0);
        assert_eq!(p.file_name, "model.safetensors");

        let p = job_to_progress(&job(JobStatus::Completed, 100, 100));
        assert_eq!(p.progress_percentage, 100.0);

        // Unknown total → 0% while active, 100% when completed
        let p = job_to_progress(&job(JobStatus::Downloading, 5, 0));
        assert_eq!(p.progress_percentage, 0.0);
        let p = job_to_progress(&job(JobStatus::Completed, 5, 0));
        assert_eq!(p.progress_percentage, 100.0);
    }

    #[test]
    fn parse_job_options_defaults() {
        let j = job(JobStatus::Queued, 0, 0);
        assert!(parse_options(&j).hf_repo_id.is_none());

        let mut j = job(JobStatus::Queued, 0, 0);
        j.options_json = Some(
            r#"{"hfRepoId":"BAAI/bge-small-en-v1.5","hfRevision":"main","hfCommitHash":"abc"}"#
                .to_string(),
        );
        let opts = parse_options(&j);
        assert_eq!(opts.hf_repo_id.as_deref(), Some("BAAI/bge-small-en-v1.5"));
        assert_eq!(opts.hf_revision.as_deref(), Some("main"));
        assert_eq!(opts.hf_commit_hash.as_deref(), Some("abc"));
    }
}
