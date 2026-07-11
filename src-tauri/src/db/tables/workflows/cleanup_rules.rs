//! Account Cleanup Rules table data-access layer.
//!
//! CRUD, upsert, and history queries for the `account_cleanup_rules` and
//! `cleanup_history` tables. Every function is `async` and runs against a
//! shared `SqlitePool`. Failures surface as `AppDbError::Database` (these
//! functions never return `NotFound`).

use sqlx::SqlitePool;
use crate::db::error::AppDbError;

// Re-export types for command visibility
pub use crate::db::workflows::schema::{CleanupRule, CleanupHistory};

/// List all cleanup rules for a company, newest first.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
///
/// # Returns
/// Every `CleanupRule` row for the company, ordered descending by
/// `created_at`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
///
/// # SQL safety
/// The `company_id` is bound as a parameter (`?`); it is never interpolated
/// into the SQL string.
pub async fn list_rules(pool: &SqlitePool, company_id: &str) -> Result<Vec<CleanupRule>, AppDbError> {
    sqlx::query_as::<_, CleanupRule>(
        "SELECT * FROM account_cleanup_rules WHERE company_id = ? ORDER BY created_at DESC"
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Insert a new cleanup rule or update an existing one (upsert by `id`).
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — primary key of the rule (insert if absent, update if present).
/// - `company_id` — the owning company/account id.
/// - `name` — human-readable rule name.
/// - `rule_type` — rule type (e.g. `"sender"`, `"subject"`, `"age"`).
/// - `condition_json` — JSON string describing the match condition.
/// - `action` — cleanup action (e.g. `"delete"`, `"archive"`).
/// - `target_folder` — optional destination folder for move-style actions.
/// - `retention_days` — optional retention window in days.
/// - `is_scheduled` — `1` if the rule runs on a schedule, `0` otherwise.
/// - `schedule_cron` — optional cron expression for scheduled rules.
///
/// # Returns
/// The `id` that was inserted/updated (echoed back to the caller).
///
/// # Errors
/// Returns `AppDbError::Database` on constraint violations or query failures.
/// Never returns `NotFound`.
///
/// # SQL safety
/// All input fields are bound as positional parameters (`?`); only the
/// timestamps (`created_at`, `updated_at`) are constants in the SQL.
pub async fn upsert_rule(
    pool: &SqlitePool,
    id: &str,
    company_id: &str,
    name: &str,
    rule_type: &str,
    condition_json: &str,
    action: &str,
    target_folder: Option<&str>,
    retention_days: Option<i64>,
    is_scheduled: i64,
    schedule_cron: Option<&str>,
) -> Result<String, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        r#"
        INSERT INTO account_cleanup_rules
            (id, company_id, name, rule_type, condition_json, action, target_folder, retention_days, is_scheduled, schedule_cron, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            rule_type=excluded.rule_type,
            condition_json=excluded.condition_json,
            action=excluded.action,
            target_folder=excluded.target_folder,
            retention_days=excluded.retention_days,
            is_scheduled=excluded.is_scheduled,
            schedule_cron=excluded.schedule_cron,
            updated_at=excluded.updated_at
        "#,
    )
    .bind(id)
    .bind(company_id)
    .bind(name)
    .bind(rule_type)
    .bind(condition_json)
    .bind(action)
    .bind(target_folder)
    .bind(retention_days)
    .bind(is_scheduled)
    .bind(schedule_cron)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(id.to_string())
}

/// Delete a cleanup rule by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the cleanup rule's primary key.
///
/// # Returns
/// `Ok(())` regardless of whether a row existed (a no-op delete is not an
/// error).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
///
/// # SQL safety
/// The `id` is bound as a parameter (`?`); it is never interpolated into the
/// SQL string.
pub async fn delete_rule(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    sqlx::query("DELETE FROM account_cleanup_rules WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// List cleanup-execution history for a company, most recent first.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
/// - `limit` — maximum number of history rows to return.
///
/// # Returns
/// Up to `limit` `CleanupHistory` rows for the company, ordered descending by
/// `executed_at`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
///
/// # SQL safety
/// Both `company_id` and `limit` are bound as parameters (`?`); neither is
/// interpolated into the SQL string.
pub async fn list_history(pool: &SqlitePool, company_id: &str, limit: i64) -> Result<Vec<CleanupHistory>, AppDbError> {
    sqlx::query_as(
        "SELECT * FROM cleanup_history WHERE company_id = ? ORDER BY executed_at DESC LIMIT ?"
    )
    .bind(company_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Record a single cleanup-execution history entry.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — primary key of the history entry.
/// - `company_id` — the owning company/account id.
/// - `rule_id` — optional originating cleanup rule id.
/// - `action` — the action that was performed.
/// - `thread_count` — number of threads affected.
/// - `message_count` — number of messages affected.
/// - `status` — result status (e.g. `"completed"`, `"failed"`).
/// - `error_message` — optional error description on failure.
///
/// # Returns
/// `Ok(())` when the entry was inserted.
///
/// # Errors
/// Returns `AppDbError::Database` on constraint violations or query failures.
/// Never returns `NotFound`.
///
/// # SQL safety
/// All input fields are bound as positional parameters (`?`); only
/// `executed_at` is a constant in the SQL.
pub async fn record_history(
    pool: &SqlitePool,
    id: &str,
    company_id: &str,
    rule_id: Option<&str>,
    action: &str,
    thread_count: i64,
    message_count: i64,
    status: &str,
    error_message: Option<&str>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        r#"
        INSERT INTO cleanup_history (id, company_id, rule_id, action, thread_count, message_count, status, error_message, executed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(id)
    .bind(company_id)
    .bind(rule_id)
    .bind(action)
    .bind(thread_count)
    .bind(message_count)
    .bind(status)
    .bind(error_message)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}
