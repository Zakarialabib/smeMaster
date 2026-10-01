//! Tauri commands for the resumable downloader.
//!
//! Six commands only — no dashboard: the UI consumes `downloader:progress`
//! events plus `downloader_list_jobs` for rehydration.

use crate::downloader::engine;
use crate::downloader::types::{
    CreateDownloadJob, DownloadJob, DownloadJobProgress, JobCategory, JobStatus,
};
use crate::downloader::{db, job_to_progress, spawn_job, DownloaderState};
use crate::error::SerializedError;
use tauri::State;

type CmdResult<T> = Result<T, SerializedError>;

fn err(e: impl std::fmt::Display) -> SerializedError {
    SerializedError::new("DOWNLOADER_ERROR", e.to_string())
}

/// Validates a URL for allowed schemes and blocks SSRF against
/// loopback/private targets.
pub fn validate_url(url: &str) -> Result<(), String> {
    let url_lower = url.to_lowercase();
    if url_lower.starts_with("file:") || url_lower.starts_with("ftp:") {
        return Err("Only http/https URLs are allowed".into());
    }
    if !url_lower.starts_with("http://") && !url_lower.starts_with("https://") {
        return Err("URL must start with http:// or https://".into());
    }
    if url_lower.contains("127.0.0.1")
        || url_lower.contains("0.0.0.0")
        || url_lower.contains("localhost")
        || url_lower.contains("169.254.")
        || url_lower.contains("[::1]")
        || url_lower.contains("[::]")
    {
        return Err("Loopback/private URLs are not allowed".into());
    }
    Ok(())
}

/// Enqueue a download. Fire-and-forget: progress arrives via
/// `downloader:progress` events; poll `downloader_get_job` as fallback.
#[tauri::command]
pub async fn downloader_create_job(
    state: State<'_, DownloaderState>,
    payload: CreateDownloadJob,
) -> CmdResult<DownloadJobProgress> {
    create_job_impl(&state, payload).await.map_err(err)
}

pub async fn create_job_impl(
    state: &DownloaderState,
    payload: CreateDownloadJob,
) -> Result<DownloadJobProgress, String> {
    // Path-traversal guard on the destination.
    if payload.destination_path.contains("..") {
        return Err("Path traversal detected in destination_path: '..' not allowed".into());
    }
    validate_url(&payload.url)?;

    let now = chrono::Utc::now().to_rfc3339();
    let job = DownloadJob {
        id: uuid::Uuid::new_v4().to_string(),
        url: payload.url,
        destination_path: payload.destination_path,
        category: payload.category,
        status: JobStatus::Queued,
        total_bytes: 0,
        downloaded_bytes: 0,
        expected_sha256: payload.expected_sha256,
        actual_sha256: None,
        max_connections: payload.max_connections.clamp(1, 32),
        priority: payload.priority,
        options_json: payload
            .options
            .as_ref()
            .and_then(|o| serde_json::to_string(o).ok()),
        error_message: None,
        created_at: now.clone(),
        updated_at: now,
        completed_at: None,
    };

    db::insert_job(state.pool(), &job)
        .await
        .map_err(|e| e.to_string())?;

    let progress = job_to_progress(&job);
    spawn_job(state, job);
    Ok(progress)
}

#[tauri::command]
pub async fn downloader_get_job(
    state: State<'_, DownloaderState>,
    job_id: String,
) -> CmdResult<DownloadJobProgress> {
    let job = db::get_job(state.pool(), &job_id)
        .await
        .map_err(err)?
        .ok_or_else(|| SerializedError::new("DOWNLOADER_ERROR", format!("Job {job_id} not found")))?;
    Ok(job_to_progress(&job))
}

#[tauri::command]
pub async fn downloader_list_jobs(
    state: State<'_, DownloaderState>,
    category: Option<String>,
    status: Option<String>,
) -> CmdResult<Vec<DownloadJobProgress>> {
    let cat = category.map(|c| JobCategory::from_str(&c));
    let st = status.map(|s| JobStatus::from_str(&s));
    let jobs = db::list_jobs(state.pool(), cat, st).await.map_err(err)?;
    Ok(jobs.iter().map(job_to_progress).collect())
}

/// Flip to `paused`. In-flight streams notice at the next flush boundary
/// (≤512KB / ~600ms) and abort without losing downloaded bytes.
#[tauri::command]
pub async fn downloader_pause_job(
    state: State<'_, DownloaderState>,
    job_id: String,
) -> CmdResult<()> {
    let job = db::get_job(state.pool(), &job_id)
        .await
        .map_err(err)?
        .ok_or_else(|| SerializedError::new("DOWNLOADER_ERROR", format!("Job {job_id} not found")))?;
    if job.status.is_terminal() {
        return Err(SerializedError::new(
            "DOWNLOADER_ERROR",
            format!("Job is already {}", job.status),
        ));
    }
    db::update_job_status(state.pool(), &job_id, JobStatus::Paused, None, None)
        .await
        .map_err(err)?;
    if let Ok(Some(fresh)) = db::get_job(state.pool(), &job_id).await {
        engine::emit_job_status(&state.engine.app, &fresh);
    }
    Ok(())
}

/// Resume a paused/failed job. Chunk offsets + ETag validation make this a
/// true resume — already-downloaded bytes are never re-fetched.
#[tauri::command]
pub async fn downloader_resume_job(
    state: State<'_, DownloaderState>,
    job_id: String,
) -> CmdResult<()> {
    let job = db::get_job(state.pool(), &job_id)
        .await
        .map_err(err)?
        .ok_or_else(|| SerializedError::new("DOWNLOADER_ERROR", format!("Job {job_id} not found")))?;
    if job.status == JobStatus::Completed {
        return Err(SerializedError::new(
            "DOWNLOADER_ERROR",
            "Job already completed".into(),
        ));
    }
    db::update_job_status(state.pool(), &job_id, JobStatus::Queued, None, None)
        .await
        .map_err(err)?;
    if let Ok(Some(fresh)) = db::get_job(state.pool(), &job_id).await {
        spawn_job(&state, fresh);
    }
    Ok(())
}

/// Cancel a job; optionally remove partial `.part` / `.part_chunk_N` files.
#[tauri::command]
pub async fn downloader_cancel_job(
    state: State<'_, DownloaderState>,
    job_id: String,
    delete_partial_files: Option<bool>,
) -> CmdResult<()> {
    let job = db::get_job(state.pool(), &job_id)
        .await
        .map_err(err)?
        .ok_or_else(|| SerializedError::new("DOWNLOADER_ERROR", format!("Job {job_id} not found")))?;

    db::update_job_status(state.pool(), &job_id, JobStatus::Cancelled, None, None)
        .await
        .map_err(err)?;

    if delete_partial_files.unwrap_or(false) {
        let dest = std::path::PathBuf::from(&job.destination_path);
        let _ = tokio::fs::remove_file(dest.with_extension("part")).await;
        for idx in 0..job.max_connections.max(0) {
            let _ = tokio::fs::remove_file(dest.with_extension(format!("part_chunk_{idx}"))).await;
        }
        if let Ok(chunks) = db::get_chunks(state.pool(), &job_id).await {
            for ch in chunks {
                let _ = tokio::fs::remove_file(dest.with_extension(format!("part_chunk_{}", ch.chunk_index))).await;
            }
        }
    }

    if let Ok(Some(fresh)) = db::get_job(state.pool(), &job_id).await {
        engine::emit_job_status(&state.engine.app, &fresh);
    }
    Ok(())
}

/// Remove finished (completed/failed/cancelled) job rows.
#[tauri::command]
pub async fn downloader_clear_finished(state: State<'_, DownloaderState>) -> CmdResult<u64> {
    db::clear_finished_jobs(state.pool()).await.map_err(err)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_url_rejects_ssrf_and_invalid_schemes() {
        let invalid = [
            "file:///etc/passwd",
            "ftp://example.com/file",
            "gopher://x",
            "http://127.0.0.1:8080/admin",
            "https://localhost/secret",
            "http://0.0.0.0/",
            "http://169.254.169.254/latest/meta-data/",
            "http://[::1]/status",
            "http://[::]/",
            "notaurl",
        ];
        for u in invalid {
            assert!(validate_url(u).is_err(), "expected reject: {u}");
        }
        let valid = [
            "https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/f.safetensors",
            "http://cdn.example.com/asset.bin",
        ];
        for u in valid {
            assert!(validate_url(u).is_ok(), "expected accept: {u}");
        }
    }
}
