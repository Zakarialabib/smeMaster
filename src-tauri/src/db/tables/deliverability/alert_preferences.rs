//! Alert preferences — per-account notification settings (blacklist alerting
//! toggle, channels, threshold). One row per account (keyed by `account_id`).
//! Helpers: `get_by_account`, `upsert`.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use crate::db::error::AppDbError;

/// Per-account alert/notification preferences.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AlertPreferences {
    /// Primary key (UUID).
    pub id: String,
    /// Owning account id (the effective unique key).
    pub account_id: String,
    /// Whether blacklist alerts are enabled (1/0).
    pub blacklist_enabled: i64,
    /// JSON describing notification channels.
    pub channels_json: String,
    /// Alert threshold string (semantics defined by caller).
    pub threshold: String,
    /// Unix-epoch creation time.
    pub created_at: i64,
    /// Unix-epoch last-update time.
    pub updated_at: i64,
}

/// Get alert preferences for an account.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
///
/// # Returns
/// `Some(AlertPreferences)` if the account has preferences, otherwise `None`.
/// This is **not** an error when none exist.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn get_by_account(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Option<AlertPreferences>, AppDbError> {
    sqlx::query_as::<_, AlertPreferences>(
        "SELECT * FROM alert_preferences WHERE account_id = ?",
    )
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Upsert alert preferences.
///
/// Uses `ON CONFLICT(account_id) DO UPDATE`, so each account has exactly one
/// preferences row. A fresh UUID primary key is generated on every call; on
/// conflict `blacklist_enabled`, `channels_json`, `threshold` and `updated_at`
/// are overwritten (the original `created_at` is retained by the DB).
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id (the conflict key).
/// * `blacklist_enabled` — whether blacklist alerts are enabled.
/// * `channels_json` — JSON describing notification channels.
/// * `threshold` — alert threshold string.
///
/// # Returns
/// The freshly written `AlertPreferences` row.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn upsert(
    pool: &SqlitePool,
    account_id: &str,
    blacklist_enabled: bool,
    channels_json: &str,
    threshold: &str,
) -> Result<AlertPreferences, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, AlertPreferences>(
        r#"
        INSERT INTO alert_preferences (id, account_id, blacklist_enabled, channels_json, threshold, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
            blacklist_enabled = excluded.blacklist_enabled,
            channels_json = excluded.channels_json,
            threshold = excluded.threshold,
            updated_at = excluded.updated_at
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(if blacklist_enabled { 1 } else { 0 })
    .bind(channels_json)
    .bind(threshold)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}
