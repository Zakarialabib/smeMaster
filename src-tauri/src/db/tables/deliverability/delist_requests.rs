//! Delist requests — guided workflow records for getting an account removed from
//! a blacklist/blocklist. CRUD helpers: `list`, `get_by_id`, `create`,
//! `update_status`, `delete`.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use crate::db::common::delete_or_not_found;
use crate::db::error::AppDbError;

/// A single guided delist request for an account.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DelistRequest {
    /// Primary key (UUID).
    pub id: String,
    /// Owning account id.
    pub account_id: String,
    /// Human-readable name of the list being delisted from.
    pub list_name: String,
    /// The IP/domain/identity being delisted.
    pub target: String,
    /// Kind of `target` (e.g. `"ip"`, `"domain"`).
    pub target_type: String,
    /// Free-text reason for the request.
    pub reason: Option<String>,
    /// Workflow status (e.g. `"pending"`, `"submitted"`, `"resolved"`).
    pub status: String,
    /// Delist submission URL, if known.
    pub delist_url: Option<String>,
    /// Unix-epoch time the request was submitted, if submitted.
    pub submitted_at: Option<i64>,
    /// Unix-epoch time the request was resolved, if resolved.
    pub resolved_at: Option<i64>,
    /// Operator notes.
    pub notes: Option<String>,
    /// Unix-epoch creation time.
    pub created_at: i64,
    /// Unix-epoch last-update time.
    pub updated_at: i64,
}

/// List all delist requests for an account.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
///
/// # Returns
/// All requests for the account ordered by `created_at DESC`. An empty `Vec`
/// (not an error) when the account has none.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<DelistRequest>, AppDbError> {
    sqlx::query_as::<_, DelistRequest>(
        "SELECT * FROM delist_requests WHERE account_id = ? ORDER BY created_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get a single delist request by ID.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the request.
///
/// # Returns
/// `Some(DelistRequest)` if found, otherwise `None`. This is **not** an error
/// when the id does not exist.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<DelistRequest>, AppDbError> {
    sqlx::query_as::<_, DelistRequest>(
        "SELECT * FROM delist_requests WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Create a new delist request.
///
/// New requests start in the `"pending"` status (`submitted_at`/`resolved_at`
/// are left `NULL`). `updated_at` equals `created_at` on insert.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
/// * `list_name` — name of the list being delisted from.
/// * `target` — IP/domain/identity being delisted.
/// * `target_type` — kind of `target`.
/// * `reason` — optional free-text reason.
///
/// # Returns
/// The newly inserted `DelistRequest` row (with generated `id`).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn create(
    pool: &SqlitePool,
    account_id: &str,
    list_name: &str,
    target: &str,
    target_type: &str,
    reason: Option<&str>,
) -> Result<DelistRequest, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, DelistRequest>(
        r#"
        INSERT INTO delist_requests (id, account_id, list_name, target, target_type, reason, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(list_name)
    .bind(target)
    .bind(target_type)
    .bind(reason)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update delist request status.
///
/// Transitioning to `"submitted"` stamps `submitted_at`; transitioning to
/// `"resolved"` stamps `resolved_at`. `delist_url` and `notes` are applied via
/// `COALESCE(... , current)` so passing `None` leaves the existing value
/// untouched. `updated_at` is always bumped.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the request.
/// * `status` — new workflow status.
/// * `delist_url` — new delist URL, or `None` to keep the current one.
/// * `notes` — new notes, or `None` to keep the current ones.
///
/// # Returns
/// `Ok(())` on success (the call does **not** verify that a row was updated).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Note: this function does
/// **not** return `AppDbError::NotFound` when `id` is missing (the UPDATE affects
/// zero rows silently).
pub async fn update_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
    delist_url: Option<&str>,
    notes: Option<&str>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let submitted_at = if status == "submitted" { Some(now) } else { None };
    let resolved_at = if status == "resolved" { Some(now) } else { None };

    sqlx::query(
        "UPDATE delist_requests SET status = ?, delist_url = COALESCE(?, delist_url), submitted_at = COALESCE(?, submitted_at), resolved_at = COALESCE(?, resolved_at), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?",
    )
    .bind(status)
    .bind(delist_url)
    .bind(submitted_at)
    .bind(resolved_at)
    .bind(notes)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(())
}

/// Delete a delist request.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the request to delete.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`"DelistRequest with id '<id>' not found"`)
/// when no request matches `id` (the shared `delete_or_not_found` helper wraps
/// the statement in `sqlx::AssertSqlSafe` and interpolates `id` into the SQL).
/// Returns `AppDbError::Database` on query failure.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    delete_or_not_found(
        pool,
        format!("DELETE FROM delist_requests WHERE id = '{id}'"),
        id,
        "DelistRequest",
    )
    .await
}
