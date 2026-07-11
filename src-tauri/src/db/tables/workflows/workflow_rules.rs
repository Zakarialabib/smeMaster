//! WorkflowRules table data-access layer.
//!
//! CRUD and dashboard-aggregate queries for the `workflow_rules` table. Every
//! function is `async` and runs against a shared `SqlitePool`. A missing row
//! (on fetch or delete) is surfaced as `AppDbError::NotFound`; other failures
//! surface as `AppDbError::Database`. Shared helpers from `crate::db::common`
//! are used where the existing pattern matches exactly (`fetch_or_not_found`,
//! `delete_or_not_found`).

use sqlx::SqlitePool;
use crate::db::common::{delete_or_not_found, fetch_or_not_found};
use crate::db::error::AppDbError;
use crate::db::workflows::schema::WorkflowRule;

/// List all workflow rules for a given company, newest first.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
///
/// # Returns
/// Every `WorkflowRule` row for the company, ordered descending by
/// `created_at`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<Vec<WorkflowRule>, AppDbError> {
    sqlx::query_as::<_, WorkflowRule>(
        "SELECT * FROM workflow_rules WHERE company_id = ? ORDER BY created_at DESC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List all active workflow rules that match a specific trigger event.
///
/// Filters by `trigger_event` and `is_active = 1`, ordered by `created_at ASC`.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
/// - `trigger_event` — the trigger event to match (e.g. `"inbound"`).
///
/// # Returns
/// Active `WorkflowRule` rows whose `trigger_event` matches, ordered ascending
/// by `created_at`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list_by_trigger(
    pool: &SqlitePool,
    company_id: &str,
    trigger_event: &str,
) -> Result<Vec<WorkflowRule>, AppDbError> {
    sqlx::query_as::<_, WorkflowRule>(
        "SELECT * FROM workflow_rules WHERE company_id = ? AND trigger_event = ? AND is_active = 1 ORDER BY created_at ASC",
    )
    .bind(company_id)
    .bind(trigger_event)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single workflow rule by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the workflow rule's primary key.
///
/// # Returns
/// The full `WorkflowRule` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `WorkflowRule with id '<id>' not found` when no rule matches the key.
/// Returns `AppDbError::Database` for other query failures.
///
/// # SQL safety
/// The `id` is bound as a parameter (`?`); it is never interpolated into the
/// SQL string.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<WorkflowRule, AppDbError> {
    let opt = sqlx::query_as::<_, WorkflowRule>("SELECT * FROM workflow_rules WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "WorkflowRule")
}

/// Create a new workflow rule and return the full row.
///
/// Auto-generates `id` (UUID v4), sets `is_active = 1`, and `created_at` to
/// the current epoch second.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
/// - `name` — human-readable rule name.
/// - `trigger_event` — the event that triggers the rule.
/// - `trigger_conditions` — optional JSON string describing trigger conditions.
/// - `actions` — JSON string describing the actions to perform.
///
/// # Returns
/// The newly created `WorkflowRule` row with server-assigned `id` and
/// `created_at`.
///
/// # Errors
/// Returns `AppDbError::Database` on constraint violations or query failures
/// (e.g. an unknown `company_id` foreign key). Never returns `NotFound`.
///
/// # SQL safety
/// All input fields are bound as positional parameters (`?`); only `is_active`
/// and `created_at` are constants in the SQL.
pub async fn create(
    pool: &SqlitePool,
    company_id: &str,
    name: &str,
    trigger_event: &str,
    trigger_conditions: Option<&str>,
    actions: &str,
) -> Result<WorkflowRule, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, WorkflowRule>(
        r#"
        INSERT INTO workflow_rules (id, company_id, name, trigger_event, trigger_conditions, actions, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(name)
    .bind(trigger_event)
    .bind(trigger_conditions)
    .bind(actions)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Toggle the `is_active` flag on a workflow rule.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the workflow rule's primary key.
/// - `is_active` — `true` to activate, `false` to deactivate.
///
/// # Returns
/// `Ok(())` when the row exists and was updated.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `WorkflowRule with id '<id>' not found` when no rule matches the key
/// (i.e. zero rows were affected). Returns `AppDbError::Database` for other
/// query failures.
///
/// # SQL safety
/// Both the `is_active` value and the `id` are bound as parameters (`?`);
/// neither is interpolated into the SQL string.
pub async fn update_active(
    pool: &SqlitePool,
    id: &str,
    is_active: bool,
) -> Result<(), AppDbError> {
    let val = if is_active { 1_i64 } else { 0_i64 };
    let rows = sqlx::query("UPDATE workflow_rules SET is_active = ? WHERE id = ?")
        .bind(val)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("WorkflowRule with id '{id}' not found")));
    }
    Ok(())
}

/// Delete a workflow rule by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the workflow rule's primary key.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `WorkflowRule with id '<id>' not found` when no row matches the key
/// (i.e. zero rows were affected). Returns `AppDbError::Database` for other
/// query failures.
///
/// # SQL safety
/// The `id` is interpolated into the `DELETE` statement and the SQL is wrapped
/// with `sqlx::AssertSqlSafe` by `delete_or_not_found`. Callers must only pass
/// app-generated ids (e.g. UUIDs); do not pass untrusted input.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    delete_or_not_found(
        pool,
        format!("DELETE FROM workflow_rules WHERE id = '{id}'"),
        id,
        "WorkflowRule",
    )
    .await
}

// ── Dashboard aggregate queries ────────────────────────────────────────────────

/// Count active workflow rules.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
///
/// # Returns
/// The number of `workflow_rules` rows where `is_active = 1`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn count_active(pool: &SqlitePool) -> Result<i64, AppDbError> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM workflow_rules WHERE is_active = 1")
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(row.0)
}

/// List workflow rules with pagination for a company.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
/// - `limit` — maximum number of rows to return.
/// - `offset` — number of rows to skip.
///
/// # Returns
/// Up to `limit` `WorkflowRule` rows for the company, ordered descending by
/// `created_at`, starting at `offset`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list_paginated(
    pool: &SqlitePool,
    company_id: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<WorkflowRule>, AppDbError> {
    sqlx::query_as::<_, WorkflowRule>(
        "SELECT * FROM workflow_rules WHERE company_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
    )
    .bind(company_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Count workflow rules for a company.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
///
/// # Returns
/// The number of `workflow_rules` rows for the company.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn count_by_account(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<i64, AppDbError> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM workflow_rules WHERE company_id = ?"
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
    async fn test_create_and_list() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acc-wf-1";
        helpers::insert_test_account(&pool, company_id).await;

        let rule = create(
            &pool,
            company_id,
            "Auto-archive newsletters",
            "inbound",
            Some(r#"{"category":"newsletter"}"#),
            r#"[{"action":"archive"}]"#,
        )
        .await
        .unwrap();

        assert_eq!(rule.company_id, company_id);
        assert_eq!(rule.name, "Auto-archive newsletters");
        assert_eq!(rule.trigger_event, "inbound");
        assert_eq!(
            rule.trigger_conditions,
            Some(r#"{"category":"newsletter"}"#.to_string())
        );
        assert_eq!(rule.is_active, 1);

        let items = list(&pool, company_id).await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, rule.id);
    }

    #[tokio::test]
    async fn test_list_by_trigger() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acc-wf-2";
        helpers::insert_test_account(&pool, company_id).await;

        create(
            &pool,
            company_id,
            "Rule A",
            "inbound",
            None,
            r#"[{"action":"tag"}]"#,
        )
        .await
        .unwrap();
        create(
            &pool,
            company_id,
            "Rule B",
            "outbound",
            None,
            r#"[{"action":"log"}]"#,
        )
        .await
        .unwrap();
        create(
            &pool,
            company_id,
            "Rule C",
            "inbound",
            None,
            r#"[{"action":"archive"}]"#,
        )
        .await
        .unwrap();

        let inbound_rules = list_by_trigger(&pool, company_id, "inbound").await.unwrap();
        assert_eq!(inbound_rules.len(), 2);
        assert!(inbound_rules.iter().all(|r| r.trigger_event == "inbound"));
    }

    #[tokio::test]
    async fn test_get_by_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-wf-3").await;
        let rule = create(
            &pool,
            "acc-wf-3",
            "VIP notify",
            "inbound",
            Some(r#"{"from":"vip@example.com"}"#),
            r#"[{"action":"notify"}]"#,
        )
        .await
        .unwrap();

        let found = get_by_id(&pool, &rule.id).await.unwrap();
        assert_eq!(found.name, "VIP notify");
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_update_active() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-wf-4").await;
        let rule = create(
            &pool,
            "acc-wf-4",
            "Toggle me",
            "inbound",
            None,
            r#"[{"action":"flag"}]"#,
        )
        .await
        .unwrap();

        assert_eq!(rule.is_active, 1);
        update_active(&pool, &rule.id, false).await.unwrap();

        let updated = get_by_id(&pool, &rule.id).await.unwrap();
        assert_eq!(updated.is_active, 0);
    }

    #[tokio::test]
    async fn test_update_active_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = update_active(&pool, "nonexistent", false).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-wf-5").await;
        let rule = create(
            &pool,
            "acc-wf-5",
            "Delete me",
            "inbound",
            None,
            r#"[{"action":"delete"}]"#,
        )
        .await
        .unwrap();
        delete(&pool, &rule.id).await.unwrap();
        let err = get_by_id(&pool, &rule.id).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = delete(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
