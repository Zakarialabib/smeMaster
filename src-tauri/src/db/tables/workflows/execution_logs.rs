//! WorkflowExecutionLogs table data-access layer.
//!
//! CRUD queries for the `workflow_execution_logs` table. Every function is
//! `async` and runs against a shared `SqlitePool`.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::workflows::schema::WorkflowExecutionLog;

/// Insert a new workflow execution log record.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
/// - `rule_id` — the workflow rule that was executed.
/// - `rule_name` — human-readable rule name.
/// - `trigger_event` — the trigger event that fired.
/// - `actions_executed` — JSON array of action results.
/// - `status` — `'success'`, `'partial'`, or `'failed'`.
/// - `error_message` — optional error message on failure.
///
/// # Returns
/// The newly created `WorkflowExecutionLog` row.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
pub async fn insert(
    pool: &SqlitePool,
    company_id: &str,
    rule_id: &str,
    rule_name: Option<&str>,
    trigger_event: &str,
    actions_executed: Option<&str>,
    status: &str,
    error_message: Option<&str>,
) -> Result<WorkflowExecutionLog, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = format!("wflog-{}-{}", now, uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));

    sqlx::query_as::<_, WorkflowExecutionLog>(
        r#"
        INSERT INTO workflow_execution_logs (
            id, company_id, rule_id, rule_name, trigger_event,
            actions_executed, status, error_message, executed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(rule_id)
    .bind(rule_name)
    .bind(trigger_event)
    .bind(actions_executed)
    .bind(status)
    .bind(error_message)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List workflow execution logs for a company with pagination.
///
/// Results are ordered by `executed_at DESC` (newest first).
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
/// - `limit` — maximum number of rows to return.
/// - `offset` — number of rows to skip.
///
/// # Returns
/// `WorkflowExecutionLog` rows for the company, ordered descending by
/// `executed_at`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list(
    pool: &SqlitePool,
    company_id: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<WorkflowExecutionLog>, AppDbError> {
    sqlx::query_as::<_, WorkflowExecutionLog>(
        "SELECT * FROM workflow_execution_logs WHERE company_id = ? ORDER BY executed_at DESC LIMIT ? OFFSET ?",
    )
    .bind(company_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Count workflow execution logs for a company.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
///
/// # Returns
/// The number of execution log rows for the company.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn count(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<i64, AppDbError> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM workflow_execution_logs WHERE company_id = ?",
    )
    .bind(company_id)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(row.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_insert_and_list() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acc-wflog-1";
        helpers::insert_test_account(&pool, company_id).await;
        let rule_id = "rule-1";
        helpers::insert_test_workflow_rule(&pool, rule_id, company_id).await;

        let log_entry = insert(
            &pool,
            company_id,
            rule_id,
            Some("Auto-archive"),
            "inbound",
            Some(r#"[{"action":"archive","status":"ok"}]"#),
            "success",
            None,
        )
        .await
        .unwrap();

        assert_eq!(log_entry.company_id, company_id);
        assert_eq!(log_entry.rule_id, rule_id);
        assert_eq!(log_entry.status, "success");

        let items = list(&pool, company_id, 10, 0).await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, log_entry.id);
    }

    #[tokio::test]
    async fn test_count() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acc-wflog-2";
        helpers::insert_test_account(&pool, company_id).await;
        let rule_id = "rule-2";
        helpers::insert_test_workflow_rule(&pool, rule_id, company_id).await;

        insert(&pool, company_id, rule_id, None, "inbound", None, "success", None)
            .await
            .unwrap();
        insert(&pool, company_id, rule_id, None, "inbound", None, "failed", Some("error"))
            .await
            .unwrap();

        let cnt = count(&pool, company_id).await.unwrap();
        assert_eq!(cnt, 2);
    }
}
