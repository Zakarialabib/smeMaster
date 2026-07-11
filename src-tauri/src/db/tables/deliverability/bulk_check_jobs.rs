//! Bulk check jobs — batch operations that scan many targets (e.g. blacklist
//! checks) at once. Helpers: `get_by_id`, `list_recent`, `create`,
//! `update_progress`, `complete`, `fail`.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use crate::db::error::AppDbError;

/// A single multi-target batch check job and its progress/results.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BulkCheckJob {
    /// Primary key (UUID).
    pub id: String,
    /// Owning account id.
    pub account_id: String,
    /// Job status (e.g. `"pending"`, `"completed"`, `"failed"`).
    pub status: String,
    /// Total number of targets in the batch.
    pub total_targets: i64,
    /// Number of targets processed so far.
    pub processed_targets: i64,
    /// JSON array of per-target results.
    pub results_json: String,
    /// Unix-epoch creation time.
    pub created_at: i64,
    /// Unix-epoch last-update time.
    pub updated_at: i64,
    /// Optional unix-epoch completion time.
    pub completed_at: Option<i64>,
}

/// Get a bulk check job by ID.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the job.
///
/// # Returns
/// `Some(BulkCheckJob)` if found, otherwise `None`. This is **not** an error.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<BulkCheckJob>, AppDbError> {
    sqlx::query_as::<_, BulkCheckJob>(
        "SELECT * FROM bulk_check_jobs WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List recent bulk check jobs for an account.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
/// * `limit` — maximum number of jobs to return.
///
/// # Returns
/// Up to `limit` jobs for the account ordered by `created_at DESC` (newest
/// first). An empty `Vec` (not an error) when none exist.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn list_recent(
    pool: &SqlitePool,
    account_id: &str,
    limit: i64,
) -> Result<Vec<BulkCheckJob>, AppDbError> {
    sqlx::query_as::<_, BulkCheckJob>(
        "SELECT * FROM bulk_check_jobs WHERE account_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(account_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Create a new bulk check job.
///
/// New jobs start in the `"pending"` status with `processed_targets = 0` and an
/// empty `results_json` of `"[]"`.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
/// * `total_targets` — number of targets in the batch.
///
/// # Returns
/// The newly inserted `BulkCheckJob` row (with generated `id`, `created_at`,
/// `updated_at`).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn create(
    pool: &SqlitePool,
    account_id: &str,
    total_targets: i64,
) -> Result<BulkCheckJob, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, BulkCheckJob>(
        r#"
        INSERT INTO bulk_check_jobs (id, account_id, status, total_targets, processed_targets, results_json, created_at, updated_at)
        VALUES (?, ?, 'pending', ?, 0, '[]', ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(total_targets)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update job status and progress.
///
/// Bumps `updated_at`. Note this is a plain UPDATE and does **not** verify that
/// a row was affected.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the job.
/// * `processed_targets` — new processed-count value.
/// * `results_json` — new results JSON (replace, not merge).
///
/// # Returns
/// `Ok(())` on success (even if `id` does not exist — the UPDATE is silent).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn update_progress(
    pool: &SqlitePool,
    id: &str,
    processed_targets: i64,
    results_json: &str,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "UPDATE bulk_check_jobs SET processed_targets = ?, results_json = ?, updated_at = ? WHERE id = ?",
    )
    .bind(processed_targets)
    .bind(results_json)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Mark job as completed.
///
/// Sets `status = 'completed'`, copies `total_targets` into `processed_targets`,
/// stamps `completed_at` and `updated_at`, and stores `results_json`. Does **not**
/// verify that a row was affected.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the job.
/// * `results_json` — final results JSON to persist.
///
/// # Returns
/// `Ok(())` on success (even if `id` does not exist — the UPDATE is silent).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn complete(
    pool: &SqlitePool,
    id: &str,
    results_json: &str,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "UPDATE bulk_check_jobs SET status = 'completed', processed_targets = total_targets, results_json = ?, completed_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(results_json)
    .bind(now)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Mark job as failed.
///
/// Sets `status = 'failed'` and bumps `updated_at`. Does **not** verify that a
/// row was affected.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the job.
///
/// # Returns
/// `Ok(())` on success (even if `id` does not exist — the UPDATE is silent).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn fail(
    pool: &SqlitePool,
    id: &str,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "UPDATE bulk_check_jobs SET status = 'failed', updated_at = ? WHERE id = ?",
    )
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}
