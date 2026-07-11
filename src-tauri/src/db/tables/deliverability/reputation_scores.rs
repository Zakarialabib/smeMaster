//! Reputation scores — aggregate health metrics (blacklist/bounce/complaint/warmup
//! factors) computed per account. Read via `get_by_account`; written via the
//! `upsert` helper (one row per account, keyed by `account_id`).

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use crate::db::error::AppDbError;

/// A single account's aggregate reputation snapshot.
///
/// Rows are keyed by `account_id` (see `upsert`). Fields are raw contributing
/// factors plus a pre-computed `overall_score`.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ReputationScore {
    /// Primary key (UUID) for this reputation row.
    pub id: String,
    /// Owning account id.
    pub account_id: String,
    /// Pre-computed overall reputation score.
    pub overall_score: f64,
    /// Contribution of blacklist presence to the score.
    pub blacklist_factor: f64,
    /// Contribution of bounce rate to the score.
    pub bounce_factor: f64,
    /// Contribution of complaint rate to the score.
    pub complaint_factor: f64,
    /// Contribution of warmup state to the score.
    pub warmup_factor: f64,
    /// Unix-epoch timestamp when the score was calculated.
    pub calculated_at: i64,
}

/// Look up the reputation score for an account.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
///
/// # Returns
/// `Some(ReputationScore)` if a row exists for `account_id`, otherwise `None`.
/// This is **not** an error when no score has been computed yet.
///
/// # Errors
/// Returns `AppDbError::Database` if the underlying query fails (e.g. pool/SQL
/// error). Never returns `AppDbError::NotFound`.
pub async fn get_by_account(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Option<ReputationScore>, AppDbError> {
    sqlx::query_as::<_, ReputationScore>(
        "SELECT * FROM reputation_scores WHERE account_id = ?",
    )
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Insert or replace the reputation score for an account.
///
/// Uses `ON CONFLICT(account_id) DO UPDATE`, so each account has exactly one
/// reputation row. A fresh UUID primary key is generated on every call; if a row
/// already exists for `account_id`, all factor fields and `calculated_at` are
/// overwritten.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id (the conflict key).
/// * `overall_score` — pre-computed overall score to store.
/// * `blacklist_factor` / `bounce_factor` / `complaint_factor` / `warmup_factor`
///   — contributing factors.
///
/// # Returns
/// The freshly written `ReputationScore` row (with generated `id` and
/// `calculated_at`).
///
/// # Errors
/// Returns `AppDbError::Database` if the query fails. Never returns
/// `AppDbError::NotFound`.
pub async fn upsert(
    pool: &SqlitePool,
    account_id: &str,
    overall_score: f64,
    blacklist_factor: f64,
    bounce_factor: f64,
    complaint_factor: f64,
    warmup_factor: f64,
) -> Result<ReputationScore, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, ReputationScore>(
        r#"
        INSERT INTO reputation_scores (id, account_id, overall_score, blacklist_factor, bounce_factor, complaint_factor, warmup_factor, calculated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
            overall_score = excluded.overall_score,
            blacklist_factor = excluded.blacklist_factor,
            bounce_factor = excluded.bounce_factor,
            complaint_factor = excluded.complaint_factor,
            warmup_factor = excluded.warmup_factor,
            calculated_at = excluded.calculated_at
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(overall_score)
    .bind(blacklist_factor)
    .bind(bounce_factor)
    .bind(complaint_factor)
    .bind(warmup_factor)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}
