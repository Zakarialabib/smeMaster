//! Resumable chunked-download engine.
//!
//! Ported from SignageMaster `plugin-downloader/src/chunk_engine.rs` and
//! hardened with gopeed-inspired behaviour:
//!
//! - **Exponential backoff + jitter** per chunk attempt (not fixed delays)
//! - **Adaptive concurrency gate** — chunk plan is fixed (so resume offsets
//!   stay stable), but how many chunks run in parallel shrinks on repeated
//!   failures and grows back on success streaks
//! - **Stall detection** — a chunk that receives zero bytes for
//!   [`IDLE_TIMEOUT_SECS`] aborts and retries instead of hanging forever
//!   (there is deliberately *no* total request timeout: big models are slow)
//! - **Cooperative pause/cancel** — status flips to `paused`/`cancelled`
//!   actually stop in-flight streams (the source crate kept downloading)
//! - **Windowed transfer-rate** progress emitted over `downloader:progress`
//!
//! No `fang`, no range-cache, no media extractors — SMEMaster only needs
//! files.

use crate::downloader::db;
use crate::downloader::types::{DownloadChunk, DownloadError, DownloadJob, JobStatus};
use anyhow::{anyhow, Context, Result};
use rand::Rng;
use reqwest::header::{ACCEPT_RANGES, CONTENT_LENGTH, RANGE};
use reqwest::Client;
use sha2::{Digest, Sha256};
use sqlx::{Pool, Sqlite};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::fs::{self, File};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::watch;

// ── Tuning constants ────────────────────────────────────────────────────────

pub const MIN_CHUNK_SIZE: i64 = 4 * 1024 * 1024; // 4 MB
pub const MAX_CHUNK_SIZE: i64 = 64 * 1024 * 1024; // 64 MB
const CHUNK_RETRY_MAX: usize = 5;
const CHUNK_PROGRESS_FLUSH_BYTES: i64 = 512 * 1024; // flush DB + check pause every 512KB
/// A stream that receives nothing for this long is considered stalled.
const IDLE_TIMEOUT_SECS: u64 = 45;
/// Backoff base: `base * 2^attempt + jitter(0..500ms)`, capped at MAX_BACKOFF.
const BACKOFF_BASE_MS: u64 = 500;
const BACKOFF_MAX_MS: u64 = 15_000;
const BACKOFF_JITTER_MS: u64 = 500;
/// Shrink the concurrency gate after this many consecutive chunk failures,
/// grow it back after this many consecutive successes.
const GATE_SHRINK_AFTER: usize = 1;
const GATE_GROW_AFTER: usize = 4;

pub const EVENT_PROGRESS: &str = "downloader:progress";

// ── Adaptive concurrency gate ───────────────────────────────────────────────

/// Limits how many chunk streams run in parallel. The limit adapts at
/// runtime: repeated failures shrink it (turbulent connections), success
/// streaks grow it back toward `initial` (healthy connections).
#[derive(Debug)]
struct GateInner {
    active: AtomicUsize,
    limit: AtomicUsize,
    initial: usize,
    failures: AtomicUsize,
    successes: AtomicUsize,
    tx: watch::Sender<usize>,
}

/// Async semaphore with a dynamically adjustable permit count.
#[derive(Debug, Clone)]
pub struct ConcurrencyGate {
    inner: Arc<GateInner>,
}

pub struct GatePermit {
    inner: Arc<GateInner>,
}

impl Drop for GatePermit {
    fn drop(&mut self) {
        self.inner.active.fetch_sub(1, Ordering::AcqRel);
        // Wake waiters: a slot just freed up.
        let limit = self.inner.limit.load(Ordering::Acquire);
        let _ = self.inner.tx.send_replace(limit);
    }
}

impl ConcurrencyGate {
    pub fn new(initial: usize) -> Self {
        let initial = initial.max(1);
        let (tx, _rx) = watch::channel(initial);
        Self {
            inner: Arc::new(GateInner {
                active: AtomicUsize::new(0),
                limit: AtomicUsize::new(initial),
                initial,
                failures: AtomicUsize::new(0),
                successes: AtomicUsize::new(0),
                tx,
            }),
        }
    }

    pub async fn acquire(&self) -> GatePermit {
        loop {
            // Subscribe first, then read — guarantees no missed wakeup.
            let mut rx = self.inner.tx.subscribe();
            let limit = *rx.borrow();
            let cur = self.inner.active.load(Ordering::Acquire);
            if cur < limit
                && self
                    .inner
                    .active
                    .compare_exchange(cur, cur + 1, Ordering::AcqRel, Ordering::Acquire)
                    .is_ok()
            {
                return GatePermit {
                    inner: self.inner.clone(),
                };
            }
            if rx.changed().await.is_err() {
                // Sender dropped (never happens while jobs live) — fail open
                // so a download can never deadlock on the gate.
                self.inner.active.fetch_add(1, Ordering::AcqRel);
                return GatePermit {
                    inner: self.inner.clone(),
                };
            }
        }
    }

    /// Record a failed chunk attempt; shrink parallelism after a burst.
    pub fn on_failure(&self) {
        let f = self.inner.failures.fetch_add(1, Ordering::AcqRel) + 1;
        self.inner.successes.store(0, Ordering::Release);
        if f % GATE_SHRINK_AFTER == 0 {
            let cur = self.inner.limit.load(Ordering::Acquire);
            let new = (cur * 2 / 3).max(1);
            if new < cur && self.inner.limit.compare_exchange(cur, new, Ordering::AcqRel, Ordering::Acquire).is_ok() {
                let _ = self.inner.tx.send_replace(new);
            }
        }
    }

    /// Record a completed chunk; periodically grow parallelism back.
    pub fn on_success(&self) {
        let s = self.inner.successes.fetch_add(1, Ordering::AcqRel) + 1;
        self.inner.failures.store(0, Ordering::Release);
        if s % GATE_GROW_AFTER == 0 {
            let cur = self.inner.limit.load(Ordering::Acquire);
            let new = (cur + 1).min(self.inner.initial);
            if new > cur && self.inner.limit.compare_exchange(cur, new, Ordering::AcqRel, Ordering::Acquire).is_ok() {
                let _ = self.inner.tx.send_replace(new);
            }
        }
    }

    /// Current adaptive width — asserted by the gate unit tests.
    #[cfg(test)]
    pub fn current_limit(&self) -> usize {
        self.inner.limit.load(Ordering::Acquire)
    }
}

/// gopeed-style retry delay: exponential growth + jitter, capped.
pub fn backoff_delay(attempt: usize) -> Duration {
    let exp = BACKOFF_BASE_MS.saturating_mul(1u64 << attempt.min(6));
    let capped = exp.min(BACKOFF_MAX_MS);
    let jitter = rand::thread_rng().gen_range(0..BACKOFF_JITTER_MS);
    Duration::from_millis(capped + jitter)
}

// ── Progress events ─────────────────────────────────────────────────────────

/// Job-scoped execution context threaded through the engine.
#[derive(Clone)]
pub struct EngineContext {
    pub pool: Pool<Sqlite>,
    pub client: Client,
    /// When set, progress/status snapshots are emitted as
    /// `downloader:progress` Tauri events. `None` in unit tests.
    pub app: Option<tauri::AppHandle>,
}

fn file_name_of(dest: &str) -> String {
    Path::new(dest)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| dest.to_string())
}

fn emit_progress(
    app: &Option<tauri::AppHandle>,
    job: &DownloadJob,
    status: JobStatus,
    downloaded: i64,
    total: i64,
    rate_bps: i64,
    eta_seconds: Option<i64>,
    error: Option<String>,
) {
    let Some(app) = app else { return };
    let percentage = if total > 0 {
        ((downloaded as f64 / total as f64) * 100.0).clamp(0.0, 100.0)
    } else if status == JobStatus::Completed {
        100.0
    } else {
        0.0
    };
    let payload = serde_json::json!({
        "jobId": job.id,
        "fileName": file_name_of(&job.destination_path),
        "status": status.as_str(),
        "downloadedBytes": downloaded,
        "totalBytes": total,
        "progressPercent": percentage,
        "rateBps": rate_bps,
        "etaSeconds": eta_seconds,
        "error": error,
    });
    use tauri::Emitter;
    let _ = app.emit(EVENT_PROGRESS, payload);
}

/// Emit a status-only snapshot (probe/start/pause/fail/complete transitions)
/// so the UI can react even when no bytes move.
pub fn emit_job_status(app: &Option<tauri::AppHandle>, job: &DownloadJob) {
    let rate = 0;
    let eta = None;
    emit_progress(
        app,
        job,
        job.status.clone(),
        job.downloaded_bytes,
        job.total_bytes,
        rate,
        eta,
        job.error_message.clone(),
    );
}

// ── Probe / planning primitives ─────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ProbeResult {
    pub total_bytes: i64,
    pub supports_ranges: bool,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
}

fn job_headers_map(job: &DownloadJob) -> Option<HashMap<String, String>> {
    let mut map = HashMap::new();
    if let Some(opts) = job.options_json.as_ref() {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(opts) {
            if let Some(token) = v.get("authBearerToken").and_then(|t| t.as_str()) {
                if !token.is_empty() {
                    map.insert("Authorization".to_string(), format!("Bearer {token}"));
                }
            }
        }
    }
    if map.is_empty() {
        None
    } else {
        Some(map)
    }
}

pub async fn probe_url(
    client: &Client,
    url: &str,
    headers_map: Option<&HashMap<String, String>>,
) -> Result<ProbeResult> {
    let mut req = client.head(url);
    if let Some(headers) = headers_map {
        for (k, v) in headers {
            req = req.header(k, v);
        }
    }

    let res = match req.send().await {
        Ok(r) if r.status().is_success() => r,
        _ => {
            let mut get_req = client.get(url).header(RANGE, "bytes=0-0");
            if let Some(headers) = headers_map {
                for (k, v) in headers {
                    get_req = get_req.header(k, v);
                }
            }
            get_req.send().await.context("Failed to probe URL")?
        }
    };

    let mut total_bytes = res
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);

    if let Some(content_range) = res.headers().get("content-range").and_then(|v| v.to_str().ok()) {
        match parse_content_range_validated(content_range) {
            Ok((_s, _e, total)) => {
                if total > 0 {
                    total_bytes = total;
                }
            }
            Err(e) => return Err(anyhow!(e)),
        }
    }

    if total_bytes >= i64::MAX - 10000 {
        return Err(anyhow!(DownloadError::InvalidRangeHeader));
    }

    let supports_ranges = res
        .headers()
        .get(ACCEPT_RANGES)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.contains("bytes"))
        .unwrap_or(res.status() == reqwest::StatusCode::PARTIAL_CONTENT);

    let etag = res
        .headers()
        .get("etag")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim_matches('"').to_string());

    let last_modified = res
        .headers()
        .get("last-modified")
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    Ok(ProbeResult {
        total_bytes,
        supports_ranges,
        etag,
        last_modified,
    })
}

pub fn parse_content_range_validated(header_val: &str) -> Result<(i64, i64, i64), DownloadError> {
    let s = header_val.trim();
    let s = s.strip_prefix("bytes ").unwrap_or(s);
    let parts: Vec<&str> = s.split('/').collect();
    if parts.len() != 2 {
        return Err(DownloadError::InvalidRangeHeader);
    }
    let total: i64 = parts[1].parse().map_err(|_| DownloadError::InvalidRangeHeader)?;
    let range_parts: Vec<&str> = parts[0].split('-').collect();
    if range_parts.len() != 2 {
        return Err(DownloadError::InvalidRangeHeader);
    }
    let start: i64 = range_parts[0].parse().map_err(|_| DownloadError::InvalidRangeHeader)?;
    let end: i64 = range_parts[1].parse().map_err(|_| DownloadError::InvalidRangeHeader)?;

    if start < 0 || end < start || total < 0 || (end >= total && total > 0) || total == i64::MAX {
        return Err(DownloadError::InvalidRangeHeader);
    }

    Ok((start, end, total))
}

pub fn calculate_chunks_validated(
    total_bytes: i64,
    max_connections: usize,
) -> Result<Vec<(i64, i64)>, DownloadError> {
    if total_bytes <= 0 || total_bytes >= i64::MAX - 10000 {
        return Err(DownloadError::InvalidRangeHeader);
    }
    Ok(calculate_chunks(total_bytes, max_connections))
}

pub fn calculate_chunks(total_bytes: i64, max_connections: usize) -> Vec<(i64, i64)> {
    if total_bytes <= 0 || max_connections <= 1 {
        return vec![(0, total_bytes - 1)];
    }

    let raw_chunk_size = total_bytes / (max_connections as i64);
    let chunk_size = raw_chunk_size.clamp(MIN_CHUNK_SIZE, MAX_CHUNK_SIZE);

    let mut chunks = Vec::new();
    let mut start = 0;

    while start < total_bytes {
        let mut end = start + chunk_size - 1;
        if end >= total_bytes || (total_bytes - end) < MIN_CHUNK_SIZE {
            end = total_bytes - 1;
        }
        chunks.push((start, end));
        start = end + 1;
    }

    chunks
}

/// True when a stored ETag differs from the probed one (remote file rotated,
/// invalidating resumed bytes).
fn etag_mismatch(stored: Option<&str>, probed: Option<&str>) -> bool {
    match (stored, probed) {
        (Some(s), Some(p)) if !s.is_empty() && !p.is_empty() => s != p,
        _ => false,
    }
}

fn fresh_chunk_plan(
    job_id: &str,
    total_bytes: i64,
    max_conn: usize,
) -> Result<Vec<DownloadChunk>> {
    let ranges = calculate_chunks_validated(total_bytes, max_conn)?;
    Ok(ranges
        .into_iter()
        .enumerate()
        .map(|(idx, (s, e))| DownloadChunk {
            id: format!("{job_id}_{idx}"),
            job_id: job_id.to_string(),
            chunk_index: idx as i32,
            start_byte: s,
            end_byte: e,
            downloaded_bytes: 0,
            status: "pending".to_string(),
            sha256: None,
            updated_at: chrono::Utc::now().to_rfc3339(),
        })
        .collect())
}

fn planned_connections(probe: &ProbeResult, job: &DownloadJob) -> usize {
    if probe.supports_ranges && probe.total_bytes > MIN_CHUNK_SIZE {
        (job.max_connections as usize).clamp(1, 32)
    } else {
        1
    }
}

/// Offline survival: rebuild or reuse chunks based on ETag + on-disk state.
async fn resolve_chunks_for_resume(
    pool: &Pool<Sqlite>,
    job: &DownloadJob,
    probe: &ProbeResult,
    dest_path: &Path,
) -> Result<Vec<DownloadChunk>> {
    let existing = db::get_chunks(pool, &job.id).await.unwrap_or_default();

    // No prior chunks → fresh plan
    if existing.is_empty() {
        return fresh_chunk_plan(
            &job.id,
            probe.total_bytes,
            planned_connections(probe, job),
        );
    }

    // ETag mismatch → file rotated on server, invalidate resumed bytes
    let stored_etag = db::get_job_etag(pool, &job.id).await.unwrap_or(None);
    if etag_mismatch(stored_etag.as_deref(), probe.etag.as_deref()) {
        log::warn!(
            "ETag mismatch for job {} (stored={:?} probed={:?}) — invalidating {} stale chunks",
            job.id,
            stored_etag,
            probe.etag,
            existing.len()
        );
        for ch in &existing {
            let p = dest_path.with_extension(format!("part_chunk_{}", ch.chunk_index));
            let _ = fs::remove_file(&p).await;
        }
        db::delete_chunks(pool, &job.id).await?;
        return fresh_chunk_plan(
            &job.id,
            probe.total_bytes,
            planned_connections(probe, job),
        );
    }

    // ETag matches (or absent) → validate each chunk's on-disk progress
    let mut validated = Vec::with_capacity(existing.len());
    for mut ch in existing {
        let part_path = dest_path.with_extension(format!("part_chunk_{}", ch.chunk_index));
        if ch.status == "completed" {
            match fs::metadata(&part_path).await {
                Ok(meta) => {
                    let expected = ch.end_byte - ch.start_byte + 1;
                    let actual = meta.len() as i64;
                    if actual != expected && expected > 0 {
                        log::warn!(
                            "Chunk {} completed but file size mismatch (expected {} got {}) → re-queue",
                            ch.chunk_index,
                            expected,
                            actual
                        );
                        ch.status = "pending".to_string();
                        ch.downloaded_bytes = actual.min(expected);
                    } else {
                        ch.downloaded_bytes = actual;
                    }
                }
                Err(_) => {
                    log::warn!("Chunk {} completed but part file missing → re-queue", ch.chunk_index);
                    ch.status = "pending".to_string();
                    ch.downloaded_bytes = 0;
                }
            }
        } else if let Ok(meta) = fs::metadata(&part_path).await {
            ch.downloaded_bytes = meta.len() as i64;
            let expected = ch.end_byte - ch.start_byte + 1;
            if ch.downloaded_bytes >= expected && expected > 0 {
                ch.status = "completed".to_string();
            } else if ch.status == "downloading" {
                ch.status = "pending".to_string(); // reset stale "downloading"
            }
        } else {
            ch.downloaded_bytes = 0;
            ch.status = "pending".to_string();
        }
        ch.updated_at = chrono::Utc::now().to_rfc3339();
        validated.push(ch);
    }

    // Total size changed without an ETag signal → rebuild
    if probe.total_bytes > 0 && !validated.is_empty() {
        let max_end = validated.iter().map(|c| c.end_byte).max().unwrap_or(0);
        if max_end + 1 != probe.total_bytes {
            log::warn!(
                "Total_bytes mismatch for job {} (chunks max_end {} vs probe {}) — rebuilding",
                job.id,
                max_end,
                probe.total_bytes
            );
            for ch in &validated {
                let p = dest_path.with_extension(format!("part_chunk_{}", ch.chunk_index));
                let _ = fs::remove_file(&p).await;
            }
            db::delete_chunks(pool, &job.id).await?;
        return fresh_chunk_plan(
            &job.id,
            probe.total_bytes,
            planned_connections(probe, job),
        );
        }
    }

    Ok(validated)
}

// ── Execution ───────────────────────────────────────────────────────────────

/// Result of a full job run.
#[derive(Debug, PartialEq, Eq)]
pub enum ExecuteOutcome {
    /// Every byte downloaded and finalized.
    Completed,
    /// The job was paused/cancelled mid-flight; status already reflects it.
    Interrupted,
}

fn is_interrupted(err: &anyhow::Error) -> bool {
    matches!(
        err.downcast_ref::<DownloadError>(),
        Some(DownloadError::Interrupted)
    )
}

/// Returns true when the job should keep streaming (status still
/// `downloading`). A paused/cancelled job aborts its streams promptly.
async fn still_downloading(pool: &Pool<Sqlite>, job_id: &str) -> bool {
    match db::get_job_status(pool, job_id).await {
        Ok(Some(JobStatus::Downloading)) => true,
        _ => false,
    }
}

pub async fn execute_download_job(ctx: &EngineContext, job: &DownloadJob) -> Result<ExecuteOutcome> {
    let pool = &ctx.pool;
    db::update_job_status(pool, &job.id, JobStatus::Probing, None, None).await?;
    emit_job_status(&ctx.app, job);

    let probe = probe_url(&ctx.client, &job.url, job_headers_map(job).as_ref()).await?;
    let total_bytes = probe.total_bytes;

    db::update_job_probe(
        pool,
        &job.id,
        probe.etag.as_deref(),
        probe.last_modified.as_deref(),
        probe.supports_ranges,
        total_bytes,
    )
    .await
    .ok();

    // Small files (or range-less servers): single resumable stream.
    if !probe.supports_ranges || total_bytes <= 0 || total_bytes <= MIN_CHUNK_SIZE {
        db::update_job_progress(pool, &job.id, 0, total_bytes).await?;
        return execute_single_stream(ctx, job, &probe).await;
    }

    let dest_path = PathBuf::from(&job.destination_path);
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent).await?;
    }

    // OFFLINE survival: ETag-aware resume planning
    let chunks = resolve_chunks_for_resume(pool, job, &probe, &dest_path).await?;
    db::insert_chunks(pool, &chunks).await?;

    let already_done: i64 = chunks
        .iter()
        .filter(|c| c.status == "completed")
        .map(|c| c.end_byte - c.start_byte + 1)
        .sum();
    db::update_job_progress(pool, &job.id, already_done, total_bytes).await?;
    db::update_job_status(pool, &job.id, JobStatus::Downloading, None, None).await?;
    emit_job_status(&ctx.app, job);

    // Fast-path: all chunks already completed (crash after merge failed)
    if chunks.iter().all(|c| c.status == "completed") {
        finalize_chunks(ctx, job, &dest_path, &chunks, total_bytes).await?;
        emit_final(ctx, job, total_bytes).await;
        return Ok(ExecuteOutcome::Completed);
    }

    let downloaded_counter = Arc::new(std::sync::atomic::AtomicI64::new(already_done));

    // Background progress flusher: DB every 800ms, event every ~500ms
    let flusher = spawn_progress_flusher(ctx.clone(), job.clone(), downloaded_counter.clone(), total_bytes);

    // Fixed chunk plan, adaptive execution width (gopeed-style)
    let pending: Vec<DownloadChunk> = chunks
        .into_iter()
        .filter(|c| c.status != "completed")
        .collect();
    let gate = ConcurrencyGate::new(pending.len().min(job.max_connections.max(1) as usize));

    let mut tasks = Vec::with_capacity(pending.len());
    for chunk in pending {
        let ctx_c = ctx.clone();
        let job_c = job.clone();
        let dest = dest_path.clone();
        let counter = downloaded_counter.clone();
        let headers = job_headers_map(job);
        let etag = probe.etag.clone();
        let gate_c = gate.clone();
        let task = tokio::spawn(async move {
            let _permit = gate_c.acquire().await;
            let res = download_chunk_with_retry(
                &ctx_c, &job_c, &dest, chunk, counter, headers.as_ref(), etag.as_deref(), &gate_c,
            )
            .await;
            match res {
                Ok(()) => Ok(ExecuteOutcome::Completed),
                Err(e) => Err(e),
            }
        });
        tasks.push(task);
    }

    let mut first_error: Option<anyhow::Error> = None;
    for task in tasks {
        match task.await {
            Ok(Ok(_)) => {}
            Ok(Err(e)) => {
                if first_error.is_none() {
                    first_error = Some(e);
                }
            }
            Err(e) => {
                if first_error.is_none() {
                    first_error = Some(anyhow!("Task join error: {e}"));
                }
            }
        }
    }

    flusher.abort();

    if let Some(e) = first_error {
        if is_interrupted(&e) {
            // Paused/cancelled — status already set by the control command.
            return Ok(ExecuteOutcome::Interrupted);
        }
        let msg = e.to_string();
        // Only mark Failed if nothing else already flipped the status.
        if let Ok(Some(JobStatus::Downloading)) | Ok(Some(JobStatus::Probing))
        | Ok(Some(JobStatus::Queued)) = db::get_job_status(pool, &job.id).await
        {
            db::update_job_status(pool, &job.id, JobStatus::Failed, Some(&msg), None).await?;
            let failed_job = db::get_job(pool, &job.id).await?.unwrap_or_else(|| job.clone());
            emit_job_status(&ctx.app, &failed_job);
        }
        return Err(e);
    }

    let final_chunks = db::get_chunks(pool, &job.id).await?;
    finalize_chunks(ctx, job, &dest_path, &final_chunks, total_bytes).await?;
    emit_final(ctx, job, total_bytes).await;
    Ok(ExecuteOutcome::Completed)
}

/// Emit a final 100%/terminal snapshot after a successful run.
async fn emit_final(ctx: &EngineContext, job: &DownloadJob, total_bytes: i64) {
    if let Ok(Some(fresh)) = db::get_job(&ctx.pool, &job.id).await {
        let total = if total_bytes > 0 { total_bytes } else { fresh.downloaded_bytes };
        emit_progress(
            &ctx.app,
            &fresh,
            JobStatus::Completed,
            total,
            total,
            0,
            Some(0),
            None,
        );
    }
}

fn spawn_progress_flusher(
    ctx: EngineContext,
    job: DownloadJob,
    counter: Arc<std::sync::atomic::AtomicI64>,
    total_bytes: i64,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(800));
        let mut last_done: i64 = counter.load(Ordering::Relaxed);
        let mut last_tick = Instant::now();
        let mut last_emit = Instant::now();
        let mut window_rate: i64 = 0;
        loop {
            interval.tick().await;
            let done = counter.load(Ordering::Relaxed);

            // Windowed rate: bytes moved since last tick.
            let now = Instant::now();
            let dt = now.duration_since(last_tick).as_secs_f64();
            if dt > 0.0 {
                let instant_rate = ((done - last_done).max(0) as f64 / dt) as i64;
                // Light smoothing keeps the UI from jittering.
                window_rate = (window_rate * 2 + instant_rate) / 3;
            }
            last_done = done;
            last_tick = now;

            let _ = db::update_job_progress(&ctx.pool, &job.id, done, total_bytes).await;

            let status_now = db::get_job_status(&ctx.pool, &job.id).await.ok().flatten();
            let is_downloading = matches!(status_now, Some(JobStatus::Downloading));

            if last_emit.elapsed() >= Duration::from_millis(500) && is_downloading {
                let eta = if window_rate > 0 && total_bytes > 0 {
                    Some(((total_bytes - done).max(0) as f64 / window_rate as f64).ceil() as i64)
                } else {
                    None
                };
                emit_progress(
                    &ctx.app,
                    &job,
                    JobStatus::Downloading,
                    done,
                    total_bytes,
                    window_rate,
                    eta,
                    None,
                );
                last_emit = Instant::now();
            }

            if total_bytes > 0 && done >= total_bytes {
                break;
            }
            if !is_downloading {
                break;
            }
        }
    })
}

async fn execute_single_stream(
    ctx: &EngineContext,
    job: &DownloadJob,
    probe: &ProbeResult,
) -> Result<ExecuteOutcome> {
    let pool = &ctx.pool;
    let dest_path = PathBuf::from(&job.destination_path);
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent).await?;
    }

    db::update_job_status(pool, &job.id, JobStatus::Downloading, None, None).await?;
    emit_job_status(&ctx.app, job);

    let part_path = dest_path.with_extension("part");
    let resume_offset = fs::metadata(&part_path).await.map(|m| m.len() as i64).unwrap_or(0);
    let supports_resume = probe.supports_ranges && resume_offset > 0 && probe.total_bytes > 0;

    let mut req = ctx.client.get(&job.url);
    if let Some(headers) = &job_headers_map(job) {
        for (k, v) in headers {
            req = req.header(k, v);
        }
    }
    if supports_resume {
        req = req.header(RANGE, format!("bytes={resume_offset}-"));
        if let Some(etag) = &probe.etag {
            req = req.header("If-Range", etag.clone());
        }
    }

    let mut resp = req.send().await.context("Single-stream request failed")?;
    if !resp.status().is_success() && resp.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        let msg = format!("HTTP {}", resp.status());
        db::update_job_status(pool, &job.id, JobStatus::Failed, Some(&msg), None).await?;
        let failed_job = db::get_job(pool, &job.id).await?.unwrap_or_else(|| job.clone());
        emit_job_status(&ctx.app, &failed_job);
        return Err(anyhow!(msg));
    }

    // Server ignored Range (200) → restart from zero.
    let is_resumed = resp.status() == reqwest::StatusCode::PARTIAL_CONTENT && supports_resume;
    let mut file = if is_resumed {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(&part_path)
            .await?
    } else {
        File::create(&part_path).await?
    };

    let mut hasher = Sha256::new();
    // Hash the existing prefix so the final digest covers resumed bytes.
    if is_resumed && resume_offset > 0 {
        let mut existing = File::open(&part_path).await?;
        let mut buf = vec![0u8; 64 * 1024];
        let mut remaining = resume_offset;
        while remaining > 0 {
            let to_read = (remaining as usize).min(buf.len());
            let n = existing.read(&mut buf[..to_read]).await?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
            remaining -= n as i64;
        }
    }

    let mut downloaded = if is_resumed { resume_offset } else { 0 };
    let total = probe.total_bytes.max(0);
    let mut last_flush = Instant::now();
    let mut last_emit = Instant::now();
    let mut last_done = downloaded;
    let mut window_rate: i64 = 0;

    loop {
        if !still_downloading(pool, &job.id).await {
            file.flush().await.ok();
            return Err(DownloadError::Interrupted.into());
        }

        let chunk = tokio::time::timeout(Duration::from_secs(IDLE_TIMEOUT_SECS), resp.chunk())
            .await
            .map_err(|_| DownloadError::Stalled(IDLE_TIMEOUT_SECS))?;
        let Some(bytes) = chunk.context("Stream error")? else { break };

        file.write_all(&bytes).await?;
        hasher.update(&bytes);
        downloaded += bytes.len() as i64;

        if last_flush.elapsed() >= Duration::from_millis(600) {
            db::update_job_progress(pool, &job.id, downloaded, total).await.ok();
            last_flush = Instant::now();
        }
        if last_emit.elapsed() >= Duration::from_millis(500) {
            let dt = last_emit.elapsed().as_secs_f64().max(0.001);
            let instant_rate = ((downloaded - last_done).max(0) as f64 / dt) as i64;
            window_rate = (window_rate * 2 + instant_rate) / 3;
            let eta = if window_rate > 0 && total > 0 {
                Some(((total - downloaded).max(0) as f64 / window_rate as f64).ceil() as i64)
            } else {
                None
            };
            emit_progress(
                &ctx.app,
                job,
                JobStatus::Downloading,
                downloaded,
                total,
                window_rate,
                eta,
                None,
            );
            last_done = downloaded;
            last_emit = Instant::now();
        }
    }
    file.flush().await?;
    drop(file);

    let actual_sha256 = format!("{:x}", hasher.finalize());
    if let Some(expected) = &job.expected_sha256 {
        if !expected.is_empty() && !expected.eq_ignore_ascii_case(&actual_sha256) {
            let _ = fs::remove_file(&part_path).await;
            let err = format!("Checksum mismatch: expected {expected}, got {actual_sha256}");
            db::update_job_status(pool, &job.id, JobStatus::Failed, Some(&err), None).await?;
            let failed_job = db::get_job(pool, &job.id).await?.unwrap_or_else(|| job.clone());
            emit_job_status(&ctx.app, &failed_job);
            return Err(anyhow!(err));
        }
    }

    fs::rename(&part_path, &dest_path).await?;
    db::update_job_progress(pool, &job.id, downloaded, downloaded).await?;
    db::update_job_status(pool, &job.id, JobStatus::Completed, None, Some(&actual_sha256))
        .await?;
    emit_final(ctx, job, downloaded).await;
    Ok(ExecuteOutcome::Completed)
}

async fn finalize_chunks(
    ctx: &EngineContext,
    job: &DownloadJob,
    dest_path: &Path,
    chunks: &[DownloadChunk],
    total_bytes: i64,
) -> Result<()> {
    let pool = &ctx.pool;
    let part_path = dest_path.with_extension("part");
    let mut part_file = match File::create(&part_path).await {
        Ok(f) => f,
        Err(e) => {
            let msg = format!("Failed to create final part file: {e}");
            db::update_job_status(pool, &job.id, JobStatus::Paused, Some(&msg), None).await.ok();
            return Err(anyhow!(msg));
        }
    };
    let mut hasher = Sha256::new();

    for idx in 0..chunks.len() {
        let chunk_part_path = dest_path.with_extension(format!("part_chunk_{idx}"));
        let mut chunk_file = match File::open(&chunk_part_path).await {
            Ok(f) => f,
            Err(e) => {
                let msg = format!("Missing chunk file {idx}: {e}");
                db::update_job_status(pool, &job.id, JobStatus::Paused, Some(&msg), None).await.ok();
                return Err(anyhow!(msg));
            }
        };
        let mut buffer = vec![0u8; 64 * 1024];
        loop {
            let n = match chunk_file.read(&mut buffer).await {
                Ok(n) => n,
                Err(e) => {
                    let msg = format!("Read error on chunk {idx}: {e}");
                    db::update_job_status(pool, &job.id, JobStatus::Paused, Some(&msg), None).await.ok();
                    return Err(anyhow!(msg));
                }
            };
            if n == 0 {
                break;
            }
            if let Err(e) = part_file.write_all(&buffer[..n]).await {
                let msg = format!("Write error during finalize (disk full?): {e}");
                db::update_job_status(pool, &job.id, JobStatus::Paused, Some(&msg), None).await.ok();
                return Err(anyhow!(msg));
            }
            hasher.update(&buffer[..n]);
        }
        let _ = fs::remove_file(&chunk_part_path).await;
    }

    if let Err(e) = part_file.flush().await {
        let msg = format!("Flush error during finalize (disk full?): {e}");
        db::update_job_status(pool, &job.id, JobStatus::Paused, Some(&msg), None).await.ok();
        return Err(anyhow!(msg));
    }
    drop(part_file);

    let actual_sha256 = format!("{:x}", hasher.finalize());

    if let Some(expected) = &job.expected_sha256 {
        if !expected.is_empty() && !expected.eq_ignore_ascii_case(&actual_sha256) {
            let _ = fs::remove_file(&part_path).await;
            let err = format!("Checksum mismatch: expected {expected}, got {actual_sha256}");
            db::update_job_status(pool, &job.id, JobStatus::Failed, Some(&err), None).await?;
            return Err(anyhow!(err));
        }
    }

    fs::rename(&part_path, dest_path).await?;

    let done = if total_bytes > 0 {
        total_bytes
    } else {
        chunks.iter().map(|c| c.downloaded_bytes).sum()
    };
    db::update_job_progress(pool, &job.id, done, done).await?;
    db::update_job_status(pool, &job.id, JobStatus::Completed, None, Some(&actual_sha256))
        .await?;

    Ok(())
}

async fn download_chunk_with_retry(
    ctx: &EngineContext,
    job: &DownloadJob,
    dest_path: &Path,
    mut chunk: DownloadChunk,
    counter: Arc<std::sync::atomic::AtomicI64>,
    headers_map: Option<&HashMap<String, String>>,
    etag: Option<&str>,
    gate: &ConcurrencyGate,
) -> Result<()> {
    let mut last_err: Option<anyhow::Error> = None;
    for attempt in 0..=CHUNK_RETRY_MAX {
        if attempt > 0 {
            let delay = backoff_delay(attempt);
            log::info!(
                "Retrying chunk {} attempt {}/{} after {:?}",
                chunk.chunk_index,
                attempt,
                CHUNK_RETRY_MAX,
                delay
            );
            tokio::time::sleep(delay).await;
        }
        match download_chunk_task(
            ctx, job, dest_path, chunk.clone(), counter.clone(), headers_map, etag,
        )
        .await
        {
            Ok(()) => {
                gate.on_success();
                return Ok(());
            }
            Err(e) => {
                if matches!(e.downcast_ref::<DownloadError>(), Some(DownloadError::Interrupted)) {
                    return Err(e); // never retry a pause/cancel
                }
                gate.on_failure();
                let msg = e.to_string();
                // Don't retry on 4xx (client error) except 408/429/416.
                if msg.contains("HTTP 4")
                    && !msg.contains("408")
                    && !msg.contains("429")
                    && !msg.contains("416")
                {
                    return Err(e);
                }
                last_err = Some(e);
                // Re-read chunk state — resume offset may have advanced.
                if let Ok(existing) = db::get_chunks(&ctx.pool, &chunk.job_id).await {
                    if let Some(c) = existing.into_iter().find(|c| c.chunk_index == chunk.chunk_index)
                    {
                        chunk = c;
                    }
                }
            }
        }
    }
    Err(last_err.unwrap_or_else(|| anyhow!("Chunk {} failed after retries", chunk.chunk_index)))
}

async fn download_chunk_task(
    ctx: &EngineContext,
    job: &DownloadJob,
    dest_path: &Path,
    mut chunk: DownloadChunk,
    counter: Arc<std::sync::atomic::AtomicI64>,
    headers_map: Option<&HashMap<String, String>>,
    etag: Option<&str>,
) -> Result<()> {
    let pool = &ctx.pool;
    let chunk_part_path = dest_path.with_extension(format!("part_chunk_{}", chunk.chunk_index));

    // Resume offset from the existing part file
    let existing_len = fs::metadata(&chunk_part_path)
        .await
        .map(|m| m.len() as i64)
        .unwrap_or(0);
    let resume_from = chunk.start_byte + existing_len;
    let is_resumed = existing_len > 0 && resume_from <= chunk.end_byte;

    let expected_len = chunk.end_byte - chunk.start_byte + 1;

    // Already complete on disk → just record it.
    if existing_len >= expected_len && expected_len > 0 {
        let mut f = File::open(&chunk_part_path).await?;
        let mut hasher = Sha256::new();
        let mut buf = vec![0u8; 64 * 1024];
        loop {
            let n = f.read(&mut buf).await?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
        }
        chunk.downloaded_bytes = expected_len;
        chunk.status = "completed".to_string();
        chunk.sha256 = Some(format!("{:x}", hasher.finalize()));
        db::insert_chunks(pool, &[chunk]).await?;
        return Ok(());
    }

    let mut req = ctx.client.get(&job.url);
    if let Some(headers) = headers_map {
        for (k, v) in headers {
            req = req.header(k, v);
        }
    }

    if resume_from <= chunk.end_byte && is_resumed {
        req = req.header(RANGE, format!("bytes={resume_from}-{}", chunk.end_byte));
        if let Some(e) = etag {
            req = req.header("If-Range", e);
        }
    } else if chunk.end_byte > chunk.start_byte {
        req = req.header(RANGE, format!("bytes={}-{}", chunk.start_byte, chunk.end_byte));
        if let Some(e) = etag {
            req = req.header("If-Match", e);
        }
    }

    let mut response = req.send().await.context("Failed chunk request")?;
    if !response.status().is_success() && response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        return Err(anyhow!("HTTP error status: {}", response.status()));
    }

    let is_partial = response.status() == reqwest::StatusCode::PARTIAL_CONTENT;

    // Server ignored the Range on a resume → restart this chunk from 0.
    let append = is_resumed && is_partial;
    let mut file = if append {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(&chunk_part_path)
            .await?
    } else {
        File::create(&chunk_part_path).await?
    };

    let mut chunk_hasher = Sha256::new();
    if append {
        // Hash the existing prefix so the digest covers resumed bytes.
        let mut buf = vec![0u8; 64 * 1024];
        let mut remaining = existing_len;
        let mut f = File::open(&chunk_part_path).await?;
        while remaining > 0 {
            let to_read = (remaining as usize).min(buf.len());
            let n = f.read(&mut buf[..to_read]).await?;
            if n == 0 {
                break;
            }
            chunk_hasher.update(&buf[..n]);
            remaining -= n as i64;
        }
    }

    let mut downloaded_in_chunk = if append { existing_len } else { 0 };
    let mut bytes_since_flush: i64 = 0;

    loop {
        // Cooperative pause/cancel at flush boundaries.
        if !still_downloading(pool, &job.id).await {
            file.flush().await.ok();
            return Err(DownloadError::Interrupted.into());
        }

        let item = tokio::time::timeout(Duration::from_secs(IDLE_TIMEOUT_SECS), response.chunk())
            .await
            .map_err(|_| DownloadError::Stalled(IDLE_TIMEOUT_SECS))?;
        let Some(bytes) = item.context("Stream error")? else { break };

        file.write_all(&bytes).await?;
        chunk_hasher.update(&bytes);

        let len = bytes.len() as i64;
        downloaded_in_chunk += len;
        counter.fetch_add(len, Ordering::Relaxed);
        bytes_since_flush += len;

        if bytes_since_flush >= CHUNK_PROGRESS_FLUSH_BYTES {
            chunk.downloaded_bytes = downloaded_in_chunk;
            chunk.status = "downloading".to_string();
            chunk.updated_at = chrono::Utc::now().to_rfc3339();
            db::update_chunk_progress(pool, &chunk.id, downloaded_in_chunk, "downloading")
                .await
                .ok();
            bytes_since_flush = 0;
        }
    }

    file.flush().await?;
    drop(file);

    // Finalize chunk hash over the whole on-disk file (covers resumes).
    let mut final_file = File::open(&chunk_part_path).await?;
    let mut final_hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    let mut final_len: i64 = 0;
    loop {
        let n = final_file.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        final_hasher.update(&buf[..n]);
        final_len += n as i64;
    }

    chunk.downloaded_bytes = final_len;
    chunk.status = "completed".to_string();
    chunk.sha256 = Some(format!("{:x}", final_hasher.finalize()));
    db::insert_chunks(pool, &[chunk]).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_handle_malicious_http_range_header_overflow() {
        assert_eq!(
            calculate_chunks_validated(i64::MAX, 4),
            Err(DownloadError::InvalidRangeHeader)
        );
        assert_eq!(
            parse_content_range_validated("bytes 100-50/500"),
            Err(DownloadError::InvalidRangeHeader)
        );
        assert_eq!(
            parse_content_range_validated("bytes 0-600/500"),
            Err(DownloadError::InvalidRangeHeader)
        );
        assert_eq!(
            parse_content_range_validated("bytes 0-99/1000").unwrap(),
            (0, 99, 1000)
        );
    }

    #[test]
    fn test_calculate_chunks_partition_is_contiguous_and_exact() {
        let total = 100 * 1024 * 1024; // 100 MiB
        let chunks = calculate_chunks(total, 8);
        assert!(chunks.len() >= 2);
        assert_eq!(chunks[0].0, 0);
        assert_eq!(chunks.last().unwrap().1, total - 1);
        for w in chunks.windows(2) {
            assert_eq!(w[0].1 + 1, w[1].0, "chunks must be contiguous");
            assert!(w[0].1 - w[0].0 + 1 >= MIN_CHUNK_SIZE);
        }
        // Single connection → one full-range chunk
        assert_eq!(calculate_chunks(total, 1), vec![(0, total - 1)]);
        // Degenerate size → single chunk (no zero-length ranges)
        assert_eq!(calculate_chunks(1, 8), vec![(0, 0)]);
    }

    #[test]
    fn test_backoff_delay_grows_and_stays_capped() {
        let d0 = backoff_delay(0);
        let d3 = backoff_delay(3);
        let d99 = backoff_delay(99);
        assert!(d0 >= Duration::from_millis(BACKOFF_BASE_MS));
        assert!(d3 > d0);
        assert!(d99 <= Duration::from_millis(BACKOFF_MAX_MS + BACKOFF_JITTER_MS));
    }

    #[tokio::test]
    async fn test_gate_limits_concurrency_and_recovers() {
        let gate = ConcurrencyGate::new(4);
        let mut permits = Vec::new();
        for _ in 0..4 {
            permits.push(gate.acquire().await);
        }
        assert_eq!(gate.current_limit(), 4);

        // Failures shrink the gate
        gate.on_failure();
        assert_eq!(gate.current_limit(), 2);
        drop(permits.pop().unwrap());
        drop(permits.pop().unwrap()); // active 2, limit 2 → next acquire works

        let p = tokio::time::timeout(Duration::from_secs(1), gate.acquire())
            .await
            .expect("gate must hand out a permit once slots free");
        drop(p);

        // Success streaks grow the gate back toward initial
        for _ in 0..8 {
            gate.on_success();
        }
        assert_eq!(gate.current_limit(), 4);
    }

    #[tokio::test]
    async fn test_gate_waiters_wake_when_permit_released() {
        let gate = ConcurrencyGate::new(1);
        let p1 = gate.acquire().await;
        let gate2 = gate.clone();
        let waiter = tokio::spawn(async move { gate2.acquire().await });
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert!(!waiter.is_finished(), "waiter must block while limit is 1");
        drop(p1);
        let p2 = tokio::time::timeout(Duration::from_secs(1), waiter)
            .await
            .expect("waiter must wake on release")
            .expect("waiter task must not panic");
        drop(p2);
    }

    #[test]
    fn test_etag_mismatch_semantics() {
        assert!(etag_mismatch(Some("a"), Some("b")));
        assert!(!etag_mismatch(Some("a"), Some("a")));
        assert!(!etag_mismatch(None, Some("a")));
        assert!(!etag_mismatch(Some("a"), None));
        assert!(!etag_mismatch(Some(""), Some("b")));
    }

    #[tokio::test]
    async fn test_finalize_chunks_missing_chunk_marks_paused_and_keeps_parts() {
        let pool = sqlx::sqlite::SqlitePool::connect("sqlite::memory:").await.unwrap();
        crate::db::migrations::run_migrations(&pool).await.unwrap();

        let temp_dir = std::env::temp_dir().join(format!("sm-dl-test-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&temp_dir).await.unwrap();

        let real_dest = temp_dir.join("output.bin");
        let chunk0 = real_dest.with_extension("part_chunk_0");
        tokio::fs::write(&chunk0, b"chunk0_data").await.unwrap();

        // Destination parent doesn't exist → finalize must fail gracefully
        let invalid_dest = temp_dir.join("no_such_folder_xyz").join("output.bin");

        let job = DownloadJob {
            id: "disk-job-1".to_string(),
            url: "https://example.com/large.bin".to_string(),
            destination_path: real_dest.to_string_lossy().to_string(),
            category: crate::downloader::types::JobCategory::AiModel,
            status: JobStatus::Downloading,
            total_bytes: 1000,
            downloaded_bytes: 0,
            expected_sha256: None,
            actual_sha256: None,
            max_connections: 1,
            priority: 5,
            options_json: None,
            error_message: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
            completed_at: None,
        };
        db::insert_job(&pool, &job).await.unwrap();

        let chunks = vec![DownloadChunk {
            id: "disk-job-1_0".to_string(),
            job_id: "disk-job-1".to_string(),
            chunk_index: 0,
            start_byte: 0,
            end_byte: 10,
            downloaded_bytes: 11,
            status: "completed".to_string(),
            sha256: None,
            updated_at: chrono::Utc::now().to_rfc3339(),
        }];

        let ctx = EngineContext {
            pool: pool.clone(),
            client: Client::new(),
            app: None,
        };
        let result = finalize_chunks(&ctx, &job, &invalid_dest, &chunks, 1000).await;
        assert!(result.is_err(), "Expected disk/file I/O error");
        assert!(chunk0.exists(), "Chunk file must be preserved on disk");

        let updated = db::get_job(&pool, "disk-job-1").await.unwrap().unwrap();
        assert_eq!(updated.status, JobStatus::Paused);

        tokio::fs::remove_dir_all(temp_dir).await.ok();
    }

    #[tokio::test]
    async fn test_finalize_verify_checksum_and_rename() {
        let pool = sqlx::sqlite::SqlitePool::connect("sqlite::memory:").await.unwrap();
        crate::db::migrations::run_migrations(&pool).await.unwrap();

        let temp_dir = std::env::temp_dir().join(format!("sm-dl-test-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&temp_dir).await.unwrap();
        let dest = temp_dir.join("model.bin");

        let mut hasher = Sha256::new();
        hasher.update(b"hello world");
        let expected = format!("{:x}", hasher.finalize());

        let job = DownloadJob {
            id: "sum-job-1".to_string(),
            url: "https://example.com/f.bin".to_string(),
            destination_path: dest.to_string_lossy().to_string(),
            category: crate::downloader::types::JobCategory::AiModel,
            status: JobStatus::Downloading,
            total_bytes: 11,
            downloaded_bytes: 11,
            expected_sha256: Some(expected.clone()),
            actual_sha256: None,
            max_connections: 1,
            priority: 5,
            options_json: None,
            error_message: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
            completed_at: None,
        };
        db::insert_job(&pool, &job).await.unwrap();

        let chunk0 = dest.with_extension("part_chunk_0");
        tokio::fs::write(&chunk0, b"hello world").await.unwrap();
        let chunks = vec![DownloadChunk {
            id: "sum-job-1_0".to_string(),
            job_id: "sum-job-1".to_string(),
            chunk_index: 0,
            start_byte: 0,
            end_byte: 10,
            downloaded_bytes: 11,
            status: "completed".to_string(),
            sha256: None,
            updated_at: chrono::Utc::now().to_rfc3339(),
        }];

        let ctx = EngineContext {
            pool: pool.clone(),
            client: Client::new(),
            app: None,
        };
        finalize_chunks(&ctx, &job, &dest, &chunks, 11).await.unwrap();
        assert!(dest.exists());
        assert!(!chunk0.exists(), "chunk parts are consumed during merge");
        let updated = db::get_job(&pool, "sum-job-1").await.unwrap().unwrap();
        assert_eq!(updated.status, JobStatus::Completed);
        assert_eq!(updated.actual_sha256.as_deref(), Some(expected.as_str()));

        tokio::fs::remove_dir_all(temp_dir).await.ok();
    }
}
