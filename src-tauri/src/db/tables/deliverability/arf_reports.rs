//! ARF reports — Abuse Report Format feedback received from mailbox providers.
//! Helpers: `list`, `get_by_id`, `mark_processed`, `delete`, `create`.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use crate::db::common::delete_or_not_found;
use crate::db::common::fetch_or_not_found;
use crate::db::error::AppDbError;

/// An Abuse Report Format (ARF) report received from a mailbox provider.
///
/// Defined inline — this struct exists in `schema.sql` but NOT in `schema.rs`.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ArfReport {
    /// Primary key (UUID).
    pub id: String,
    /// Owning account id.
    pub account_id: String,
    /// Original recipient the report concerns.
    pub original_recipient: Option<String>,
    /// Domain that was reported.
    pub reported_domain: Option<String>,
    /// Feedback type (e.g. `"abuse"`).
    pub feedback_type: Option<String>,
    /// User agent that generated the report.
    pub user_agent: Option<String>,
    /// Source IP implicated in the report.
    pub source_ip: Option<String>,
    /// Optional unix-epoch arrival time of the original message.
    pub arrival_date: Option<i64>,
    /// Raw report payload.
    pub report_raw: Option<String>,
    /// Whether the report has been processed (1/0).
    pub processed: i64,
    /// Unix-epoch creation time.
    pub created_at: i64,
}

/// List all ARF reports for an account, most recent first.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
///
/// # Returns
/// All reports for the account ordered by `created_at DESC`. An empty `Vec` (not
/// an error) when none exist.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<ArfReport>, AppDbError> {
    sqlx::query_as::<_, ArfReport>(
        "SELECT * FROM arf_reports WHERE account_id = ? ORDER BY created_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single ARF report by its primary key.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the report.
///
/// # Returns
/// The matching `ArfReport` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`"ArfReport with id '<id>' not found"`) when
/// no report matches `id`. Returns `AppDbError::Database` on query failure.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<ArfReport, AppDbError> {
    let opt = sqlx::query_as::<_, ArfReport>("SELECT * FROM arf_reports WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "ArfReport")
}

/// Mark an ARF report as processed.
///
/// Sets `processed = 1` for the given report.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the report.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`"ArfReport with id '<id>' not found"`) when
/// no report matches `id`. This is an `UPDATE` and is left inline (the
/// `delete_or_not_found` helper is DELETE-specific). Returns `AppDbError::Database`
/// on query failure.
pub async fn mark_processed(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query(
        "UPDATE arf_reports SET processed = 1 WHERE id = ?",
    )
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?
    .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("ArfReport with id '{id}' not found")));
    }
    Ok(())
}

/// Delete an ARF report by its primary key.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the report to delete.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`"ArfReport with id '<id>' not found"`) when
/// no report matches `id` (the shared `delete_or_not_found` helper wraps the
/// statement in `sqlx::AssertSqlSafe` and interpolates `id` into the SQL).
/// Returns `AppDbError::Database` on query failure.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    delete_or_not_found(
        pool,
        format!("DELETE FROM arf_reports WHERE id = '{id}'"),
        id,
        "ArfReport",
    )
    .await
}

/// Create a new ARF report with the given fields.
///
/// New reports start with `processed = 0`.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key to use for the new report.
/// * `account_id` — owning account id.
/// * `original_recipient` / `reported_domain` / `feedback_type` / `user_agent` /
///   `source_ip` / `arrival_date` / `report_raw` — report fields (all optional
///   except via `Option`). `None` stores SQL NULL.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn create(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
    original_recipient: Option<&str>,
    reported_domain: Option<&str>,
    feedback_type: Option<&str>,
    user_agent: Option<&str>,
    source_ip: Option<&str>,
    arrival_date: Option<i64>,
    report_raw: Option<&str>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO arf_reports (id, account_id, original_recipient, reported_domain, feedback_type, user_agent, source_ip, arrival_date, report_raw, processed, created_at) VALUES (?,?,?,?,?,?,?,?,?,0,?)"
    )
    .bind(id)
    .bind(account_id)
    .bind(original_recipient)
    .bind(reported_domain)
    .bind(feedback_type)
    .bind(user_agent)
    .bind(source_ip)
    .bind(arrival_date)
    .bind(report_raw)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;
    

    fn make_report(id: &str, account_id: &str, now: i64) -> ArfReport {
        ArfReport {
            id: id.to_string(),
            account_id: account_id.to_string(),
            original_recipient: Some("recipient@example.com".to_string()),
            reported_domain: Some("example.com".to_string()),
            feedback_type: Some("abuse".to_string()),
            user_agent: Some("TestAgent/1.0".to_string()),
            source_ip: Some("192.0.2.1".to_string()),
            arrival_date: Some(now),
            report_raw: Some("raw feedback report".to_string()),
            processed: 0,
            created_at: now,
        }
    }

    #[tokio::test]
    async fn test_list() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-arf-1").await;
        let now = chrono::Utc::now().timestamp();
        let report = make_report("r1", "acc-arf-1", now);
        sqlx::query(
            "INSERT INTO arf_reports (id, account_id, original_recipient, reported_domain, feedback_type, user_agent, source_ip, arrival_date, report_raw, processed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(&report.id).bind(&report.account_id).bind(&report.original_recipient).bind(&report.reported_domain).bind(&report.feedback_type).bind(&report.user_agent).bind(&report.source_ip).bind(report.arrival_date).bind(&report.report_raw).bind(report.processed).bind(report.created_at)
            .execute(&pool).await.unwrap();

        let items = list(&pool, "acc-arf-1").await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, "r1");
    }

    #[tokio::test]
    async fn test_get_by_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-arf-2").await;
        let now = chrono::Utc::now().timestamp();
        let report = make_report("r2", "acc-arf-2", now);
        sqlx::query(
            "INSERT INTO arf_reports (id, account_id, original_recipient, reported_domain, feedback_type, user_agent, source_ip, arrival_date, report_raw, processed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(&report.id).bind(&report.account_id).bind(&report.original_recipient).bind(&report.reported_domain).bind(&report.feedback_type).bind(&report.user_agent).bind(&report.source_ip).bind(report.arrival_date).bind(&report.report_raw).bind(report.processed).bind(report.created_at)
            .execute(&pool).await.unwrap();

        let found = get_by_id(&pool, "r2").await.unwrap();
        assert_eq!(found.feedback_type, Some("abuse".to_string()));
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_mark_processed() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-arf-3").await;
        let now = chrono::Utc::now().timestamp();
        let report = make_report("r3", "acc-arf-3", now);
        sqlx::query(
            "INSERT INTO arf_reports (id, account_id, original_recipient, reported_domain, feedback_type, user_agent, source_ip, arrival_date, report_raw, processed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(&report.id).bind(&report.account_id).bind(&report.original_recipient).bind(&report.reported_domain).bind(&report.feedback_type).bind(&report.user_agent).bind(&report.source_ip).bind(report.arrival_date).bind(&report.report_raw).bind(report.processed).bind(report.created_at)
            .execute(&pool).await.unwrap();

        mark_processed(&pool, "r3").await.unwrap();
        let updated = get_by_id(&pool, "r3").await.unwrap();
        assert_eq!(updated.processed, 1);
    }

    #[tokio::test]
    async fn test_mark_processed_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = mark_processed(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-arf-4").await;
        let now = chrono::Utc::now().timestamp();
        let report = make_report("r4", "acc-arf-4", now);
        sqlx::query(
            "INSERT INTO arf_reports (id, account_id, original_recipient, reported_domain, feedback_type, user_agent, source_ip, arrival_date, report_raw, processed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(&report.id).bind(&report.account_id).bind(&report.original_recipient).bind(&report.reported_domain).bind(&report.feedback_type).bind(&report.user_agent).bind(&report.source_ip).bind(report.arrival_date).bind(&report.report_raw).bind(report.processed).bind(report.created_at)
            .execute(&pool).await.unwrap();

        delete(&pool, "r4").await.unwrap();
        let err = get_by_id(&pool, "r4").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = delete(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
