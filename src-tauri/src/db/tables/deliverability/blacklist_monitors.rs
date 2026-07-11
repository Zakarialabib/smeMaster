//! Blacklist monitors — automated scanning configurations (target + check type
//! + interval + alert channels). CRUD helpers: `list`, `get_by_id`, `create`,
//! `update`, `delete`.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use crate::db::common::delete_or_not_found;
use crate::db::error::AppDbError;

/// A single automated blacklist monitor configuration.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BlacklistMonitor {
    /// Primary key (UUID).
    pub id: String,
    /// Owning account id.
    pub account_id: String,
    /// IP/domain being monitored.
    pub target: String,
    /// Kind of check (e.g. `"dnsbl"`).
    pub check_type: String,
    /// Scan interval in minutes.
    pub interval_minutes: i64,
    /// JSON describing alert channels.
    pub alerts_json: String,
    /// Whether the monitor is enabled (1/0).
    pub enabled: i64,
    /// Unix-epoch creation time.
    pub created_at: i64,
    /// Unix-epoch last-update time.
    pub updated_at: i64,
    /// Optional unix-epoch time of the last scan.
    pub last_check_at: Option<i64>,
}

/// List all blacklist monitors for an account.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
///
/// # Returns
/// All monitors for the account ordered by `created_at DESC`. An empty `Vec`
/// (not an error) when the account has none.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<BlacklistMonitor>, AppDbError> {
    sqlx::query_as::<_, BlacklistMonitor>(
        "SELECT * FROM blacklist_monitors WHERE account_id = ? ORDER BY created_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get a single blacklist monitor by ID.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the monitor.
///
/// # Returns
/// `Some(BlacklistMonitor)` if found, otherwise `None`. This is **not** an error.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<BlacklistMonitor>, AppDbError> {
    sqlx::query_as::<_, BlacklistMonitor>(
        "SELECT * FROM blacklist_monitors WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Create a new blacklist monitor.
///
/// New monitors are created with `enabled = 1`.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
/// * `target` — IP/domain to monitor.
/// * `check_type` — kind of check (e.g. `"dnsbl"`).
/// * `interval_minutes` — scan interval in minutes.
/// * `alerts_json` — JSON describing alert channels.
///
/// # Returns
/// The newly inserted `BlacklistMonitor` row (with generated `id`,
/// `created_at`, `updated_at`, `last_check_at = NULL`).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn create(
    pool: &SqlitePool,
    account_id: &str,
    target: &str,
    check_type: &str,
    interval_minutes: i64,
    alerts_json: &str,
) -> Result<BlacklistMonitor, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, BlacklistMonitor>(
        r#"
        INSERT INTO blacklist_monitors (id, account_id, target, check_type, interval_minutes, alerts_json, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(target)
    .bind(check_type)
    .bind(interval_minutes)
    .bind(alerts_json)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update a blacklist monitor.
///
/// Each supplied (`Some`) field is applied in its own `UPDATE` statement; all
/// supplied fields bump `updated_at`. `None` fields are left unchanged. This is
/// left inline (not via the shared `apply_field_updates` helper) because it uses
/// per-field `UPDATE`s rather than an `UpdateFields` builder.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the monitor.
/// * `interval_minutes` — new interval, or `None` to keep current.
/// * `alerts_json` — new alert JSON, or `None` to keep current.
/// * `enabled` — new enabled flag, or `None` to keep current.
///
/// # Returns
/// `Ok(())` on success. When all three fields are `None`, no statements run but
/// the call still succeeds.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. This function does **not**
/// return `AppDbError::NotFound` when `id` is missing (each `UPDATE` affects
/// zero rows silently).
pub async fn update(
    pool: &SqlitePool,
    id: &str,
    interval_minutes: Option<i64>,
    alerts_json: Option<&str>,
    enabled: Option<bool>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();

    if let Some(interval) = interval_minutes {
        sqlx::query("UPDATE blacklist_monitors SET interval_minutes = ?, updated_at = ? WHERE id = ?")
            .bind(interval)
            .bind(now)
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppDbError::Database)?;
    }

    if let Some(alerts) = alerts_json {
        sqlx::query("UPDATE blacklist_monitors SET alerts_json = ?, updated_at = ? WHERE id = ?")
            .bind(alerts)
            .bind(now)
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppDbError::Database)?;
    }

    if let Some(enabled_val) = enabled {
        sqlx::query("UPDATE blacklist_monitors SET enabled = ?, updated_at = ? WHERE id = ?")
            .bind(if enabled_val { 1 } else { 0 })
            .bind(now)
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppDbError::Database)?;
    }

    Ok(())
}

/// Delete a blacklist monitor.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the monitor to delete.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`"BlacklistMonitor with id '<id>' not found"`)
/// when no monitor matches `id` (the shared `delete_or_not_found` helper wraps
/// the statement in `sqlx::AssertSqlSafe` and interpolates `id` into the SQL).
/// Returns `AppDbError::Database` on query failure.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    delete_or_not_found(
        pool,
        format!("DELETE FROM blacklist_monitors WHERE id = '{id}'"),
        id,
        "BlacklistMonitor",
    )
    .await
}
