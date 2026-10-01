//! SQLite persistence for download jobs and chunks.
//!
//! Tables are created by migration `033_downloader` — no local migrator.

use crate::downloader::types::{DownloadChunk, DownloadJob, JobCategory, JobStatus};
use anyhow::Result;
use sqlx::{Pool, Sqlite};

/// Persist HEAD probe results for resume validation (ETag + range support).
pub async fn update_job_probe(
    pool: &Pool<Sqlite>,
    job_id: &str,
    etag: Option<&str>,
    last_modified: Option<&str>,
    supports_ranges: bool,
    total_bytes: i64,
) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        r#"
        UPDATE download_jobs
        SET etag = COALESCE(?, etag),
            last_modified = COALESCE(?, last_modified),
            supports_ranges = ?,
            total_bytes = CASE WHEN ? > 0 THEN ? ELSE total_bytes END,
            last_probe_at = ?,
            updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(etag)
    .bind(last_modified)
    .bind(if supports_ranges { 1 } else { 0 })
    .bind(total_bytes)
    .bind(total_bytes)
    .bind(&now)
    .bind(&now)
    .bind(job_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_job_etag(pool: &Pool<Sqlite>, job_id: &str) -> Result<Option<String>> {
    let row: Option<(Option<String>,)> =
        sqlx::query_as("SELECT etag FROM download_jobs WHERE id = ?")
            .bind(job_id)
            .fetch_optional(pool)
            .await?;
    Ok(row.and_then(|r| r.0))
}

/// Returns the current status without loading the whole row (cheap
/// cooperative-cancellation probe used inside chunk stream loops).
pub async fn get_job_status(pool: &Pool<Sqlite>, job_id: &str) -> Result<Option<JobStatus>> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT status FROM download_jobs WHERE id = ?")
            .bind(job_id)
            .fetch_optional(pool)
            .await?;
    Ok(row.map(|r| JobStatus::from_str(&r.0)))
}

pub async fn delete_chunks(pool: &Pool<Sqlite>, job_id: &str) -> Result<()> {
    sqlx::query("DELETE FROM download_chunks WHERE job_id = ?")
        .bind(job_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_chunk_progress(
    pool: &Pool<Sqlite>,
    chunk_id: &str,
    downloaded_bytes: i64,
    status: &str,
) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE download_chunks SET downloaded_bytes = ?, status = ?, updated_at = ? WHERE id = ?",
    )
    .bind(downloaded_bytes)
    .bind(status)
    .bind(&now)
    .bind(chunk_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn insert_job(pool: &Pool<Sqlite>, job: &DownloadJob) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO download_jobs (
            id, url, destination_path, category, status, total_bytes, downloaded_bytes,
            expected_sha256, actual_sha256, max_connections, priority, options_json,
            error_message, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#)
        .bind(&job.id)
        .bind(&job.url)
        .bind(&job.destination_path)
        .bind(job.category.as_str())
        .bind(job.status.as_str())
        .bind(job.total_bytes)
        .bind(job.downloaded_bytes)
        .bind(&job.expected_sha256)
        .bind(&job.actual_sha256)
        .bind(job.max_connections)
        .bind(job.priority)
        .bind(&job.options_json)
        .bind(&job.error_message)
        .bind(&job.created_at)
        .bind(&job.updated_at)
        .bind(&job.completed_at)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_job_status(
    pool: &Pool<Sqlite>,
    job_id: &str,
    status: JobStatus,
    error_message: Option<&str>,
    actual_sha256: Option<&str>,
) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    let completed_at = if status == JobStatus::Completed {
        Some(now.clone())
    } else {
        None
    };

    sqlx::query(
        r#"
        UPDATE download_jobs
        SET status = ?, error_message = ?, actual_sha256 = COALESCE(?, actual_sha256),
            updated_at = ?, completed_at = COALESCE(?, completed_at)
        WHERE id = ?
        "#)
        .bind(status.as_str())
        .bind(error_message)
        .bind(actual_sha256)
        .bind(&now)
        .bind(&completed_at)
        .bind(job_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_job_progress(
    pool: &Pool<Sqlite>,
    job_id: &str,
    downloaded_bytes: i64,
    total_bytes: i64,
) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        r#"
        UPDATE download_jobs
        SET downloaded_bytes = ?, total_bytes = ?, updated_at = ?
        WHERE id = ?
        "#)
        .bind(downloaded_bytes)
        .bind(total_bytes)
        .bind(&now)
        .bind(job_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Update mutable identity fields when a job is resumed against a newer
/// upstream revision (ETag rotation): destination path, expected checksum
/// and HF finalize options all follow the fresh metadata probe.
pub async fn refresh_job_identity(
    pool: &Pool<Sqlite>,
    job_id: &str,
    destination_path: &str,
    expected_sha256: Option<&str>,
    options_json: Option<&str>,
) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        r#"
        UPDATE download_jobs
        SET destination_path = ?,
            expected_sha256 = ?,
            options_json = COALESCE(?, options_json),
            updated_at = ?
        WHERE id = ?
        "#)
        .bind(destination_path)
        .bind(expected_sha256)
        .bind(options_json)
        .bind(&now)
        .bind(job_id)
        .execute(pool)
        .await?;
    Ok(())
}

#[derive(sqlx::FromRow)]
struct JobRow {
    id: String,
    url: String,
    destination_path: String,
    category: String,
    status: String,
    total_bytes: Option<i64>,
    downloaded_bytes: Option<i64>,
    expected_sha256: Option<String>,
    actual_sha256: Option<String>,
    max_connections: Option<i64>,
    priority: Option<i64>,
    options_json: Option<String>,
    error_message: Option<String>,
    created_at: String,
    updated_at: String,
    completed_at: Option<String>,
}

impl From<JobRow> for DownloadJob {
    fn from(r: JobRow) -> Self {
        DownloadJob {
            id: r.id,
            url: r.url,
            destination_path: r.destination_path,
            category: JobCategory::from_str(&r.category),
            status: JobStatus::from_str(&r.status),
            total_bytes: r.total_bytes.unwrap_or(0),
            downloaded_bytes: r.downloaded_bytes.unwrap_or(0),
            expected_sha256: r.expected_sha256,
            actual_sha256: r.actual_sha256,
            max_connections: r.max_connections.unwrap_or(8) as i32,
            priority: r.priority.unwrap_or(5) as i32,
            options_json: r.options_json,
            error_message: r.error_message,
            created_at: r.created_at,
            updated_at: r.updated_at,
            completed_at: r.completed_at,
        }
    }
}

const JOB_COLUMNS: &str = r#"id, url, destination_path, category, status, total_bytes,
        downloaded_bytes, expected_sha256, actual_sha256, max_connections, priority,
        options_json, error_message, created_at, updated_at, completed_at"#;

pub async fn get_job(pool: &Pool<Sqlite>, job_id: &str) -> Result<Option<DownloadJob>> {
    let row = sqlx::query_as::<_, JobRow>(sqlx::AssertSqlSafe(format!(
        "SELECT {JOB_COLUMNS} FROM download_jobs WHERE id = ?"
    )))
    .bind(job_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(DownloadJob::from))
}

/// First non-terminal job for a URL (in-flight dedupe + resume lookup).
pub async fn get_active_job_by_url(
    pool: &Pool<Sqlite>,
    url: &str,
) -> Result<Option<DownloadJob>> {
    let row = sqlx::query_as::<_, JobRow>(sqlx::AssertSqlSafe(format!(
        "SELECT {JOB_COLUMNS} FROM download_jobs
         WHERE url = ? AND status NOT IN ('completed', 'cancelled')
         ORDER BY created_at DESC LIMIT 1"
    )))
    .bind(url)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(DownloadJob::from))
}

/// Most recent job for a URL regardless of status (resume-after-failure).
pub async fn get_latest_job_by_url(
    pool: &Pool<Sqlite>,
    url: &str,
) -> Result<Option<DownloadJob>> {
    let row = sqlx::query_as::<_, JobRow>(sqlx::AssertSqlSafe(format!(
        "SELECT {JOB_COLUMNS} FROM download_jobs
         WHERE url = ? ORDER BY created_at DESC LIMIT 1"
    )))
    .bind(url)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(DownloadJob::from))
}

pub async fn list_jobs(
    pool: &Pool<Sqlite>,
    category: Option<JobCategory>,
    status: Option<JobStatus>,
) -> Result<Vec<DownloadJob>> {
    let cat_str = category.map(|c| c.as_str().to_string());
    let status_str = status.map(|s| s.as_str().to_string());

    let rows = sqlx::query_as::<_, JobRow>(sqlx::AssertSqlSafe(format!(
        "SELECT {JOB_COLUMNS} FROM download_jobs
         WHERE (? IS NULL OR category = ?)
           AND (? IS NULL OR status = ?)
         ORDER BY priority DESC, created_at DESC"
    )))
    .bind(&cat_str)
    .bind(&cat_str)
    .bind(&status_str)
    .bind(&status_str)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(DownloadJob::from).collect())
}

/// Jobs left mid-flight by a crash/kill (auto-resume on boot).
pub async fn list_resumable_jobs(pool: &Pool<Sqlite>) -> Result<Vec<DownloadJob>> {
    Ok(list_jobs(pool, None, None)
        .await?
        .into_iter()
        .filter(|j| matches!(j.status, JobStatus::Downloading | JobStatus::Probing | JobStatus::Queued))
        .collect())
}

pub async fn delete_job(pool: &Pool<Sqlite>, job_id: &str) -> Result<()> {
    sqlx::query("DELETE FROM download_jobs WHERE id = ?")
        .bind(job_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn clear_finished_jobs(pool: &Pool<Sqlite>) -> Result<u64> {
    let res = sqlx::query("DELETE FROM download_jobs WHERE status IN ('completed', 'failed', 'cancelled')")
        .execute(pool)
        .await?;
    Ok(res.rows_affected())
}

pub async fn insert_chunks(pool: &Pool<Sqlite>, chunks: &[DownloadChunk]) -> Result<()> {
    for chunk in chunks {
        sqlx::query(
            r#"
            INSERT INTO download_chunks (
                id, job_id, chunk_index, start_byte, end_byte, downloaded_bytes,
                status, sha256, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id, chunk_index) DO UPDATE SET
                downloaded_bytes = excluded.downloaded_bytes,
                status = excluded.status,
                sha256 = excluded.sha256,
                updated_at = excluded.updated_at
            "#)
            .bind(&chunk.id)
            .bind(&chunk.job_id)
            .bind(chunk.chunk_index)
            .bind(chunk.start_byte)
            .bind(chunk.end_byte)
            .bind(chunk.downloaded_bytes)
            .bind(&chunk.status)
            .bind(&chunk.sha256)
            .bind(&chunk.updated_at)
            .execute(pool)
            .await?;
    }
    Ok(())
}

#[derive(sqlx::FromRow)]
struct ChunkRow {
    id: String,
    job_id: String,
    chunk_index: i64,
    start_byte: i64,
    end_byte: i64,
    downloaded_bytes: Option<i64>,
    status: String,
    sha256: Option<String>,
    updated_at: String,
}

pub async fn get_chunks(pool: &Pool<Sqlite>, job_id: &str) -> Result<Vec<DownloadChunk>> {
    let rows = sqlx::query_as::<_, ChunkRow>(
        r#"
        SELECT id, job_id, chunk_index, start_byte, end_byte, downloaded_bytes,
               status, sha256, updated_at
        FROM download_chunks
        WHERE job_id = ?
        ORDER BY chunk_index ASC
        "#,
    )
    .bind(job_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| DownloadChunk {
            id: r.id,
            job_id: r.job_id,
            chunk_index: r.chunk_index as i32,
            start_byte: r.start_byte,
            end_byte: r.end_byte,
            downloaded_bytes: r.downloaded_bytes.unwrap_or(0),
            status: r.status,
            sha256: r.sha256,
            updated_at: r.updated_at,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn test_pool() -> Pool<Sqlite> {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        crate::db::migrations::run_migrations(&pool).await.unwrap();
        pool
    }

    fn sample_job(id: &str) -> DownloadJob {
        DownloadJob {
            id: id.to_string(),
            url: "https://huggingface.co/org/repo/resolve/main/file.bin".to_string(),
            destination_path: "/tmp/models/file.bin".to_string(),
            category: JobCategory::AiModel,
            status: JobStatus::Queued,
            total_bytes: 0,
            downloaded_bytes: 0,
            expected_sha256: None,
            actual_sha256: None,
            max_connections: 4,
            priority: 5,
            options_json: None,
            error_message: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
            completed_at: None,
        }
    }

    #[tokio::test]
    async fn job_lifecycle_roundtrip() {
        let pool = test_pool().await;
        let job = sample_job("job-1");
        insert_job(&pool, &job).await.unwrap();

        let fetched = get_job(&pool, "job-1").await.unwrap().unwrap();
        assert_eq!(fetched.status, JobStatus::Queued);
        assert_eq!(fetched.category, JobCategory::AiModel);

        update_job_status(&pool, "job-1", JobStatus::Downloading, None, None)
            .await
            .unwrap();
        update_job_progress(&pool, "job-1", 512, 1024).await.unwrap();
        let fetched = get_job(&pool, "job-1").await.unwrap().unwrap();
        assert_eq!(fetched.status, JobStatus::Downloading);
        assert_eq!(fetched.downloaded_bytes, 512);
        assert_eq!(fetched.total_bytes, 1024);

        update_job_status(&pool, "job-1", JobStatus::Completed, None, Some("abc"))
            .await
            .unwrap();
        let fetched = get_job(&pool, "job-1").await.unwrap().unwrap();
        assert_eq!(fetched.status, JobStatus::Completed);
        assert_eq!(fetched.actual_sha256.as_deref(), Some("abc"));
        assert!(fetched.completed_at.is_some());
    }

    #[tokio::test]
    async fn resume_and_url_lookup_queries() {
        let pool = test_pool().await;
        let mut job = sample_job("job-a");
        insert_job(&pool, &job).await.unwrap();

        // In-flight lookup by URL
        let found = get_active_job_by_url(&pool, &job.url).await.unwrap().unwrap();
        assert_eq!(found.id, "job-a");

        // Completing removes it from the active lookup but keeps latest lookup
        update_job_status(&pool, "job-a", JobStatus::Completed, None, None)
            .await
            .unwrap();
        assert!(get_active_job_by_url(&pool, &job.url).await.unwrap().is_none());
        assert!(get_latest_job_by_url(&pool, &job.url).await.unwrap().is_some());

        // Resumable = crashed mid-flight only (not paused, not completed)
        job.id = "job-b".to_string();
        job.status = JobStatus::Downloading;
        insert_job(&pool, &job).await.unwrap();
        job.id = "job-c".to_string();
        job.status = JobStatus::Paused;
        insert_job(&pool, &job).await.unwrap();

        let resumable = list_resumable_jobs(&pool).await.unwrap();
        assert_eq!(resumable.len(), 1);
        assert_eq!(resumable[0].id, "job-b");
    }

    #[tokio::test]
    async fn chunk_upsert_and_status_probe() {
        let pool = test_pool().await;
        insert_job(&pool, sample_job("job-c")).await.unwrap();

        let chunk = DownloadChunk {
            id: "job-c_0".to_string(),
            job_id: "job-c".to_string(),
            chunk_index: 0,
            start_byte: 0,
            end_byte: 99,
            downloaded_bytes: 40,
            status: "downloading".to_string(),
            sha256: None,
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
        insert_chunks(&pool, &[chunk.clone()]).await.unwrap();

        // Upsert updates in place (no duplicate row)
        let mut updated = chunk.clone();
        updated.downloaded_bytes = 99;
        updated.status = "completed".to_string();
        insert_chunks(&pool, &[updated]).await.unwrap();
        let chunks = get_chunks(&pool, "job-c").await.unwrap();
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].downloaded_bytes, 99);
        assert_eq!(chunks[0].status, "completed");

        assert_eq!(
            get_job_status(&pool, "job-c").await.unwrap(),
            Some(JobStatus::Queued)
        );
        assert!(get_job_status(&pool, "missing").await.unwrap().is_none());
    }
}
