//! Workflow command handlers (Tauri `#[command]`s) for the workflows feature.
//!
//! These handlers are thin adapters over the per-table data-access functions in
//! `crate::db::tables::workflows`. Each handler takes a `tauri::State<SqlitePool>`
//! and returns `CmdResult<T>` (a `Result<T, SerializedError>`), mapping any
//! `AppDbError` (including `AppDbError::NotFound`) into a serializable error for
//! the frontend. Missing rows surface as `AppDbError::NotFound`; other failures
//! surface as `AppDbError::Database`. Dynamic `LIKE` patterns are built with the
//! `like_pattern` helper from `crate::db::common`.

use serde::{Deserialize, Serialize};
use tauri::State;
use sqlx::{SqlitePool, QueryBuilder};
use crate::db::common::{count_rows, like_pattern};
use crate::db::error::AppDbError;
use crate::db::workflows::schema::{FollowUpReminder, PendingOperation, WorkflowRule, CleanupRule, CleanupHistory};
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

// ── Request types ──────────────────────────────────────────────────────────

/// Request payload for upserting a workflow rule.
///
/// Field names use `camelCase` on the wire (via `#[serde(rename_all)]`); the
/// Rust struct uses `snake_case`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertWorkflowRuleRequest {
    /// Optional primary key. When `Some`, the rule is updated; when `None`, a
    /// new rule with a generated UUID is created.
    pub id: Option<String>,
    /// Owning company/account id.
    pub company_id: String,
    /// Human-readable rule name.
    pub name: String,
    /// Trigger event that activates the rule (e.g. `"inbound"`).
    pub trigger_event: String,
    /// Optional JSON string describing the trigger conditions.
    pub trigger_conditions: Option<String>,
    /// JSON string describing the actions to perform.
    pub actions: String,
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD COMMANDS – Workflows
// ═══════════════════════════════════════════════════════════════════════════════

/// Total count of all workflow rules across every company.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
///
/// # Returns
/// The number of rows in the `workflow_rules` table.
///
/// # Errors
/// Returns `SerializedError` wrapping `AppDbError::Database` on query failure.
/// Never returns `NotFound`.
///
/// # SQL safety
/// The `SELECT COUNT(*)` is a fixed string; the `count_rows` helper wraps it in
/// `sqlx::AssertSqlSafe` and binds no user input.
#[tauri::command]
pub async fn db_dashboard_workflow_rules_total(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    let count = count_rows(&*pool, "SELECT COUNT(*) FROM workflow_rules", |_| Ok(()))
        .await
        .map_err(SerializedError::from)?;
    Ok(count)
}

#[tauri::command]
pub async fn db_dashboard_workflow_rules_active(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    crate::db::tables::workflows::workflow_rules::count_active(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_workflow_rules(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<WorkflowRule>> {
    crate::db::tables::workflows::workflow_rules::list(&pool, &company_id)
        .await
        .map_err(Into::into)
}

/// List workflow rules for a company with pagination.
///
/// # Errors
/// Returns `SerializedError` wrapping `AppDbError::Database` on query failure.
#[tauri::command]
pub async fn db_list_workflow_rules_paginated(
    pool: State<'_, SqlitePool>,
    company_id: String,
    limit: i64,
    offset: i64,
) -> CmdResult<Vec<WorkflowRule>> {
    crate::db::tables::workflows::workflow_rules::list_paginated(&pool, &company_id, limit, offset)
        .await
        .map_err(Into::into)
}

/// Single-row result for count commands that return a `Vec<CountRow>`.
#[derive(Debug, Serialize)]
pub struct CountRow {
    /// The row count produced by the underlying `COUNT(*)` query.
    pub count: i64,
}

/// Count workflow rules for a company, returned as a single-row `CountRow`.
///
/// # Errors
/// Returns `SerializedError` wrapping `AppDbError::Database` on query failure.
#[tauri::command]
pub async fn db_count_workflow_rules(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<CountRow>> {
    let count = crate::db::tables::workflows::workflow_rules::count_by_account(&pool, &company_id).await?;
    Ok(vec![CountRow { count }])
}

#[tauri::command]
pub async fn db_list_active_workflow_rules(
    pool: State<'_, SqlitePool>,
    company_id: String,
    trigger_event: String,
) -> CmdResult<Vec<WorkflowRule>> {
    crate::db::tables::workflows::workflow_rules::list_by_trigger(&pool, &company_id, &trigger_event)
        .await
        .map_err(Into::into)
}

/// Create or update a workflow rule.
///
/// When `rule.id` is set the existing rule is updated (rows affected > 0);
/// otherwise a new rule with a generated UUID is inserted.
///
/// # Errors
/// Returns `SerializedError` wrapping `AppDbError::Database` on a constraint
/// violation or other query failure.
#[tauri::command]
pub async fn db_upsert_workflow_rule(
    pool: State<'_, SqlitePool>,
    rule: UpsertWorkflowRuleRequest,
) -> CmdResult<String> {
    let now = chrono::Utc::now().timestamp();

    if let Some(id) = rule.id {
        let rows = sqlx::query(
            r#"
            UPDATE workflow_rules
            SET account_id = ?, name = ?, trigger_event = ?, trigger_conditions = ?, actions = ?
            WHERE id = ?
            "#,
        )
        .bind(&rule.company_id)
        .bind(&rule.name)
        .bind(&rule.trigger_event)
        .bind(&rule.trigger_conditions)
        .bind(&rule.actions)
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

        if rows > 0 {
            return Ok(id);
        }

        sqlx::query(
            r#"
            INSERT INTO workflow_rules
                (id, account_id, name, trigger_event, trigger_conditions, actions, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            "#,
        )
        .bind(&id)
        .bind(&rule.company_id)
        .bind(&rule.name)
        .bind(&rule.trigger_event)
        .bind(&rule.trigger_conditions)
        .bind(&rule.actions)
        .bind(now)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;

        return Ok(id);
    }

    let created = crate::db::tables::workflows::workflow_rules::create(
        &pool,
        &rule.company_id,
        &rule.name,
        &rule.trigger_event,
        rule.trigger_conditions.as_deref(),
        &rule.actions,
    )
    .await
    .map_err(SerializedError::from)?;

    Ok(created.id)
}

#[tauri::command]
pub async fn db_update_workflow_rule_active(
    pool: State<'_, SqlitePool>,
    id: String,
    is_active: bool,
) -> CmdResult<()> {
    crate::db::tables::workflows::workflow_rules::update_active(&pool, &id, is_active)
        .await
        .map_err(Into::into)
}

/// Delete a workflow rule by id.
///
/// # Errors
/// Returns `SerializedError` wrapping `AppDbError::NotFound` when the rule does
/// not exist, or `AppDbError::Database` on other failures.
#[tauri::command]
pub async fn db_delete_workflow_rule(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::workflows::workflow_rules::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_workflow_rule(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<WorkflowRule> {
    crate::db::tables::workflows::workflow_rules::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_follow_up_reminder(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<FollowUpReminder> {
    crate::db::tables::workflows::follow_up_reminders::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_follow_up_reminder(
    pool: State<'_, SqlitePool>,
    company_id: String,
    thread_id: String,
    message_id: String,
    remind_at: i64,
) -> CmdResult<FollowUpReminder> {
    crate::db::tables::workflows::follow_up_reminders::create(&pool, &company_id, &thread_id, &message_id, remind_at)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_due_follow_up_reminders(
    pool: State<'_, SqlitePool>,
    now: i64,
) -> CmdResult<Vec<FollowUpReminder>> {
    crate::db::tables::workflows::follow_up_reminders::list_due(&pool, now)
        .await
        .map_err(Into::into)
}

/// Fetch a single pending operation by id.
///
/// # Errors
/// Returns `SerializedError` wrapping `AppDbError::NotFound` when the operation
/// does not exist, or `AppDbError::Database` on other failures.
#[tauri::command]
pub async fn db_get_pending_operation(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<PendingOperation> {
    crate::db::tables::workflows::pending_operations::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_pending_operation(
    pool: State<'_, SqlitePool>,
    company_id: String,
    operation_type: String,
    resource_id: String,
    params: String,
    next_retry_at: Option<i64>,
    campaign_id: Option<String>,
) -> CmdResult<PendingOperation> {
    crate::db::tables::workflows::pending_operations::create(
        &pool, &company_id, &operation_type, &resource_id, &params, next_retry_at, campaign_id.as_deref(),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_retryable_operations(
    pool: State<'_, SqlitePool>,
    now: i64,
) -> CmdResult<Vec<PendingOperation>> {
    crate::db::tables::workflows::pending_operations::list_retryable(&pool, now)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_increment_pending_retry(
    pool: State<'_, SqlitePool>,
    id: String,
    next_retry_at: Option<i64>,
) -> CmdResult<()> {
    crate::db::tables::workflows::pending_operations::increment_retry(&pool, &id, next_retry_at)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_follow_up_reminders(
    pool: State<'_, SqlitePool>,
    company_id: String,
    status: Option<String>,
) -> CmdResult<Vec<FollowUpReminder>> {
    crate::db::tables::workflows::follow_up_reminders::list(&pool, &company_id, status.as_deref())
        .await
        .map_err(Into::into)
}

/// List pending operations for a company with an optional status filter.
///
/// # Errors
/// Returns `SerializedError` wrapping `AppDbError::Database` on query failure.
#[tauri::command]
pub async fn db_list_pending_operations(
    pool: State<'_, SqlitePool>,
    company_id: String,
    status: Option<String>,
) -> CmdResult<Vec<PendingOperation>> {
    crate::db::tables::workflows::pending_operations::list(&pool, &company_id, status.as_deref())
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_operation_status(
    pool: State<'_, SqlitePool>,
    id: String,
    status: String,
    error_message: Option<String>,
) -> CmdResult<()> {
    crate::db::tables::workflows::pending_operations::update_status(
        &pool,
        &id,
        &status,
        error_message.as_deref(),
    )
    .await
    .map_err(Into::into)
}

/// Increment the retry count for a pending operation (failed or non-failed path).
///
/// When `is_failed` is true the status is set to `'failed'`; otherwise only
/// `retry_count` and `next_retry_at` are updated.
///
/// # Errors
/// Returns `SerializedError` wrapping `AppDbError::Database` on query failure.
#[tauri::command]
pub async fn db_increment_retry(
    pool: State<'_, SqlitePool>,
    id: String,
    new_count: i64,
    is_failed: bool,
    next_retry_at: Option<i64>,
) -> CmdResult<()> {
    if is_failed {
        sqlx::query("UPDATE pending_operations SET status = 'failed', retry_count = ? WHERE id = ?")
            .bind(new_count)
            .bind(&id)
            .execute(&*pool)
            .await
            .map_err(AppDbError::Database)?;
    } else {
        sqlx::query("UPDATE pending_operations SET retry_count = ?, next_retry_at = ? WHERE id = ?")
            .bind(new_count)
            .bind(next_retry_at)
            .bind(&id)
            .execute(&*pool)
            .await
            .map_err(AppDbError::Database)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn db_delete_pending_ops_by_ids(
    pool: State<'_, SqlitePool>,
    ids: Vec<String>,
) -> CmdResult<()> {
    if ids.is_empty() {
        return Ok(());
    }
    let mut qb: QueryBuilder<sqlx::Sqlite> = QueryBuilder::new(
        "DELETE FROM pending_operations WHERE id IN (",
    );
    let mut separated = qb.separated(", ");
    for id in &ids {
        separated.push_bind(id);
    }
    qb.push(")");
    qb.build().execute(&*pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

#[tauri::command]
pub async fn db_clear_failed_operations(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
) -> CmdResult<()> {
    if let Some(acct) = company_id {
        sqlx::query("DELETE FROM pending_operations WHERE account_id = ? AND status = 'failed'")
            .bind(&acct)
            .execute(&*pool)
            .await
            .map_err(AppDbError::Database)?;
    } else {
        sqlx::query("DELETE FROM pending_operations WHERE status = 'failed'")
            .execute(&*pool)
            .await
            .map_err(AppDbError::Database)?;
    }
    Ok(())
}

/// Reset failed pending operations back to `'pending'`, optionally scoped to one company.
///
/// # Errors
/// Returns `SerializedError` wrapping `AppDbError::Database` on query failure.
#[tauri::command]
pub async fn db_retry_failed_operations(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
) -> CmdResult<()> {
    if let Some(acct) = company_id {
        sqlx::query(
            "UPDATE pending_operations SET status = 'pending', retry_count = 0, next_retry_at = NULL, error_message = NULL WHERE account_id = ? AND status = 'failed'"
        )
        .bind(&acct)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    } else {
        sqlx::query(
            "UPDATE pending_operations SET status = 'pending', retry_count = 0, next_retry_at = NULL, error_message = NULL WHERE status = 'failed'"
        )
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn db_upsert_pending_operation(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: String,
    operation_type: String,
    resource_id: String,
    params: String,
    status: Option<String>,
    max_retries: Option<i64>,
    campaign_id: Option<String>,
) -> CmdResult<String> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO pending_operations (id, account_id, operation_type, resource_id, params, status, retry_count, max_retries, campaign_id, created_at) VALUES (?,?,?,?,?,?,0,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, params=excluded.params"
    )
    .bind(&id)
    .bind(&company_id)
    .bind(&operation_type)
    .bind(&resource_id)
    .bind(&params)
    .bind(status.as_deref().unwrap_or("pending"))
    .bind(max_retries.unwrap_or(10))
    .bind(&campaign_id)
    .bind(now)
    .execute(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;
    Ok(id)
}

#[tauri::command]
pub async fn db_delete_pending_operation(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::workflows::pending_operations::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_follow_up_status(
    pool: State<'_, SqlitePool>,
    id: String,
    status: String,
) -> CmdResult<()> {
    crate::db::tables::workflows::follow_up_reminders::update_status(&pool, &id, &status)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_cancel_follow_up_for_thread(
    pool: State<'_, SqlitePool>,
    company_id: String,
    thread_id: String,
) -> CmdResult<()> {
    sqlx::query("UPDATE follow_up_reminders SET status = 'cancelled' WHERE account_id = ? AND thread_id = ? AND status = 'pending'")
        .bind(&company_id)
        .bind(&thread_id)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Create or update a follow-up reminder (upsert by id).
///
/// # Errors
/// Returns `SerializedError` wrapping `AppDbError::Database` on a constraint
/// violation or other query failure.
#[tauri::command]
pub async fn db_upsert_follow_up_reminder(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: String,
    thread_id: String,
    message_id: String,
    remind_at: i64,
    status: Option<String>,
) -> CmdResult<String> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO follow_up_reminders (id, account_id, thread_id, message_id, remind_at, status, created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET remind_at=excluded.remind_at, status=excluded.status"
    )
    .bind(&id)
    .bind(&company_id)
    .bind(&thread_id)
    .bind(&message_id)
    .bind(remind_at)
    .bind(status.as_deref().unwrap_or("pending"))
    .bind(now)
    .execute(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;
    Ok(id)
}

/// Delete a follow-up reminder by id.
///
/// # Errors
/// Returns `SerializedError` wrapping `AppDbError::NotFound` when the reminder
/// does not exist, or `AppDbError::Database` on other failures.
#[tauri::command]
pub async fn db_delete_follow_up_reminder(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::workflows::follow_up_reminders::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

// ── Cleanup Rules Commands ───────────────────────────────────────────────────

#[tauri::command]
pub async fn db_list_cleanup_rules(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<CleanupRule>> {
    crate::db::tables::workflows::cleanup_rules::list_rules(&pool, &company_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_cleanup_rule(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: String,
    name: String,
    rule_type: String,
    condition_json: String,
    action: String,
    target_folder: Option<String>,
    retention_days: Option<i64>,
    is_scheduled: i64,
    schedule_cron: Option<String>,
) -> CmdResult<String> {
    crate::db::tables::workflows::cleanup_rules::upsert_rule(
        &pool, &id, &company_id, &name, &rule_type, &condition_json, &action,
        target_folder.as_deref(), retention_days, is_scheduled, schedule_cron.as_deref(),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_cleanup_rule(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::workflows::cleanup_rules::delete_rule(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_cleanup_history(
    pool: State<'_, SqlitePool>,
    company_id: String,
    limit: i64,
) -> CmdResult<Vec<CleanupHistory>> {
    crate::db::tables::workflows::cleanup_rules::list_history(&pool, &company_id, limit)
        .await
        .map_err(Into::into)
}

/// Execute a cleanup rule by id and record the result in cleanup history.
///
/// Loads the rule for the company, applies its condition/action to messages,
/// and inserts a `CleanupHistory` row. Returns a `SerializedError` with code
/// `NOT_FOUND` when the rule does not exist.
///
/// # Errors
/// Returns `SerializedError` (`NOT_FOUND`) when the rule is missing, or wraps
/// `AppDbError::Database` on query failures.
#[tauri::command]
pub async fn db_execute_cleanup_rule(
    pool: State<'_, SqlitePool>,
    company_id: String,
    rule_id: String,
) -> CmdResult<CleanupHistory> {
    // Load the rule
    let rules = crate::db::tables::workflows::cleanup_rules::list_rules(&pool, &company_id).await?;
    let rule = rules.into_iter().find(|r| r.id == rule_id);

    if let Some(rule) = rule {
        // Parse condition and execute cleanup
        let _condition: serde_json::Value = serde_json::from_str(&rule.condition_json).unwrap_or_default();
        let result = execute_cleanup_by_rule(&pool, &company_id, &rule).await?;
        
        // Record history
        let history_id = format!("hist-{}", chrono::Utc::now().timestamp_millis());
        crate::db::tables::workflows::cleanup_rules::record_history(
            &pool, &history_id, &company_id, Some(&rule_id), &rule.action,
            result.thread_count, result.message_count, "completed", None::<&str>,
        ).await.map_err(|e| SerializedError::from(e))?;

        Ok(CleanupHistory {
            id: history_id,
            company_id: company_id,
            rule_id: Some(rule_id),
            action: rule.action,
            thread_count: result.thread_count,
            message_count: result.message_count,
            status: "completed".to_string(),
            error_message: None,
            executed_at: chrono::Utc::now().timestamp(),
        })
    } else {
        Err(SerializedError::new("NOT_FOUND", format!("Cleanup rule {} not found", rule_id)))
    }
}

async fn execute_cleanup_by_rule(
    pool: &SqlitePool,
    company_id: &str,
    rule: &CleanupRule,
) -> CmdResult<CleanupResult> {
    // Parse condition JSON
    let condition: serde_json::Value = serde_json::from_str(&rule.condition_json)
        .unwrap_or_else(|_| serde_json::Value::Object(Default::default()));

    // Count messages to be affected based on rule type
    let message_count: i64 = match rule.rule_type.as_str() {
        "sender" => {
            let sender = condition.get("sender").and_then(|v| v.as_str()).unwrap_or("");
            sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) as cnt FROM messages WHERE account_id = ? AND from_address LIKE ?")
                .bind(company_id)
                .bind(like_pattern(sender))
                .fetch_one(pool)
                .await
                .map_err(|e| SerializedError::new("DATABASE_ERROR", e.to_string()))?
                .0
        }
        "subject" => {
            let subject = condition.get("subject").and_then(|v| v.as_str()).unwrap_or("");
            sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) as cnt FROM messages WHERE account_id = ? AND subject LIKE ?")
                .bind(company_id)
                .bind(like_pattern(subject))
                .fetch_one(pool)
                .await
                .map_err(|e| SerializedError::new("DATABASE_ERROR", e.to_string()))?
                .0
        }
        "age" => {
            let days = condition.get("retention_days").and_then(|v| v.as_i64()).unwrap_or(365);
            let cutoff = chrono::Utc::now().timestamp() - (days * 24 * 60 * 60);
            sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) as cnt FROM messages WHERE account_id = ? AND date < ?")
                .bind(company_id)
                .bind(cutoff)
                .fetch_one(pool)
                .await
                .map_err(|e| SerializedError::new("DATABASE_ERROR", e.to_string()))?
                .0
        }
        "unsubscribe" => {
            sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) as cnt FROM messages WHERE account_id = ? AND list_unsubscribe IS NOT NULL")
                .bind(company_id)
                .fetch_one(pool)
                .await
                .map_err(|e| SerializedError::new("DATABASE_ERROR", e.to_string()))?
                .0
        }
        _ => 0,
    };

    // Execute action
    match rule.action.as_str() {
        "delete" => {
            let sender = condition.get("sender").and_then(|v| v.as_str()).unwrap_or("");
            sqlx::query("DELETE FROM messages WHERE account_id = ? AND from_address LIKE ?")
                .bind(company_id)
                .bind(like_pattern(sender))
                .execute(pool)
                .await
                .map_err(|e| SerializedError::new("DATABASE_ERROR", e.to_string()))?;
        }
        "archive" => {
            let sender = condition.get("sender").and_then(|v| v.as_str()).unwrap_or("");
            sqlx::query("UPDATE messages SET imap_folder = 'Archive' WHERE account_id = ? AND from_address LIKE ?")
                .bind(company_id)
                .bind(like_pattern(sender))
                .execute(pool)
                .await
                .map_err(|e| SerializedError::new("DATABASE_ERROR", e.to_string()))?;
        }
        "mark_read" => {
            let sender = condition.get("sender").and_then(|v| v.as_str()).unwrap_or("");
            sqlx::query("UPDATE messages SET is_read = 1 WHERE account_id = ? AND from_address LIKE ?")
                .bind(company_id)
                .bind(like_pattern(sender))
                .execute(pool)
                .await
                .map_err(|e| SerializedError::new("DATABASE_ERROR", e.to_string()))?;
        }
        "unsubscribe" => {
            // Mark unsubscribe status for tracking
            sqlx::query("UPDATE messages SET unsubscribe_status = 'pending' WHERE account_id = ? AND list_unsubscribe IS NOT NULL")
                .bind(company_id)
                .execute(pool)
                .await
                .map_err(|e| SerializedError::new("DATABASE_ERROR", e.to_string()))?;
        }
        _ => {}
    }

    // Count affected threads
    let thread_count: i64 = sqlx::query_as::<_, (i64,)>("SELECT COUNT(DISTINCT thread_id) FROM messages WHERE account_id = ?")
        .bind(company_id)
        .fetch_one(pool)
        .await
        .map_err(|e| SerializedError::new("DATABASE_ERROR", e.to_string()))?
        .0;

    Ok(CleanupResult { thread_count, message_count })
}

struct CleanupResult {
    thread_count: i64,
    message_count: i64,
}

// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
//     builder
// }
