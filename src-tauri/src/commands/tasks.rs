//! Task & task-tag Tauri command handlers.
//!
//! Each `#[tauri::command]` below is a thin FFI wrapper that pulls the
//! [`sqlx::SqlitePool`] from Tauri [`tauri::State`], delegates to the
//! `db::tables::tasks` query layer, and maps `AppDbError` into
//! [`crate::error::SerializedError`] via `Into`. These handlers are registered
//! centrally in `commands::register()` (not via a local `invoke_handler`).

use serde::{Deserialize, Serialize};
use tauri::State;
use sqlx::SqlitePool;

use crate::db::tasks::schema::{Task, TaskTag};
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

// ── Request types (task‑specific) ──────────────────────────────────────────

/// Request payload for updating a task (`db_update_task`).
///
/// Field names use camelCase over the wire (`rename_all = "camelCase"`). Every
/// field is optional: only the provided fields are applied by the DB layer;
/// omitted/`None` fields leave the stored value unchanged.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskRequest {
    /// New title (applied only when present).
    pub title: Option<String>,
    /// New description; an explicit `null` body value clears the column.
    pub description: Option<Option<String>>,
    /// New priority label.
    pub priority: Option<String>,
    /// New completion flag; toggling also sets/clears `completed_at`.
    pub is_completed: Option<bool>,
    /// New due date; an explicit `null` clears it.
    pub due_date: Option<Option<i64>>,
    /// New parent task id; an explicit `null` clears the parent.
    pub parent_id: Option<Option<String>>,
    /// New manual sort order.
    pub sort_order: Option<i64>,
    /// New recurrence rule; an explicit `null` clears it.
    pub recurrence_rule: Option<Option<String>>,
    /// New tags as a JSON string.
    pub tags_json: Option<String>,
    /// New workflow config JSON; an explicit `null` clears it.
    pub workflow_config_json: Option<Option<String>>,
    /// New reminder config JSON; an explicit `null` clears it.
    pub reminder_config_json: Option<Option<String>>,
}

/// Serialized task plus the linked contact's display fields.
///
/// Returned by `db_get_tasks_with_contacts` / `db_get_tasks_with_contacts_paginated`.
/// The three `contact_*` fields are `None` when the task has no associated
/// contact.
#[derive(Debug, Serialize)]
pub struct TaskWithContactResponse {
    /// Task primary key.
    pub id: String,
    /// Owning company id.
    pub company_id: String,
    /// Task title.
    pub title: String,
    /// Free-form description.
    pub description: Option<String>,
    /// Priority label (e.g. "high"/"low").
    pub priority: String,
    /// `1` if completed, `0` otherwise.
    pub is_completed: i64,
    /// Epoch-second completion timestamp, if completed.
    pub completed_at: Option<i64>,
    /// Epoch-second due date, if set.
    pub due_date: Option<i64>,
    /// Parent task id, if this is a subtask.
    pub parent_id: Option<String>,
    /// Linked contact id, if any.
    pub contact_id: Option<String>,
    /// Linked thread id, if any.
    pub thread_id: Option<String>,
    /// Linked thread account id, if any.
    pub thread_account_id: Option<String>,
    /// Manual sort order.
    pub sort_order: i64,
    /// Recurrence rule (RFC-5545 style), if set.
    pub recurrence_rule: Option<String>,
    /// Epoch-second of the next recurrence, if applicable.
    pub next_recurrence_at: Option<i64>,
    /// Tags stored as a JSON string.
    pub tags_json: String,
    /// Workflow config JSON, if set.
    pub workflow_config_json: Option<String>,
    /// Reminder config JSON, if set.
    pub reminder_config_json: Option<String>,
    /// Epoch-second creation time.
    pub created_at: i64,
    /// Epoch-second last-update time.
    pub updated_at: i64,
    /// Linked contact display name.
    pub contact_name: Option<String>,
    /// Linked contact avatar URL.
    pub contact_avatar: Option<String>,
    /// Linked contact email.
    pub contact_email: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ContactCountRow {
    pub contact_id: String,
    pub cnt: i64,
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD COMMANDS – Tasks
// ═══════════════════════════════════════════════════════════════════════════════

#[tauri::command]
/// Dashboard command: number of tasks due today or earlier that are not completed.
///
/// Delegates to `tasks::count_due_today`. Returns `i64`.
pub async fn db_dashboard_tasks_due_today(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    crate::db::tables::tasks::tasks::count_due_today(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Dashboard command: total number of incomplete tasks across all companies.
///
/// Delegates to `tasks::count_incomplete_all`. Returns `i64`.
pub async fn db_dashboard_tasks_incomplete(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    crate::db::tables::tasks::tasks::count_incomplete_all(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Dashboard command: number of overdue (past-due, incomplete) tasks.
///
/// Delegates to `tasks::count_overdue`. Returns `i64`.
pub async fn db_dashboard_tasks_overdue(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    crate::db::tables::tasks::tasks::count_overdue(&pool)
        .await
        .map_err(Into::into)
}

// ── Register function ──────────────────────────────────────────────────────

// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
//     builder
// }

// ── Commands ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn db_list_tasks(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
    is_completed: Option<bool>,
) -> CmdResult<Vec<Task>> {
    crate::db::tables::tasks::tasks::list(&pool, company_id.as_deref(), is_completed)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// List all task tags.
///
/// Delegates to `task_tags::list`. Returns `Vec<TaskTag>`.
pub async fn db_list_task_tags(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<TaskTag>> {
    crate::db::tables::tasks::task_tags::list(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_task(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Option<Task>> {
    crate::db::tables::tasks::tasks::get_by_id_opt(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Fetch a single task by id, erroring when not found.
///
/// Delegates to `tasks::get_by_id`. Returns `Task`, or `NotFound` if absent.
pub async fn db_get_task_by_id(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Task> {
    crate::db::tables::tasks::tasks::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_task(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
    title: String,
    description: Option<String>,
    priority: String,
    due_date: Option<i64>,
    parent_id: Option<String>,
    contact_id: Option<String>,
    thread_id: Option<String>,
    thread_account_id: Option<String>,
    recurrence_rule: Option<String>,
    tags_json: Option<String>,
    workflow_config_json: Option<String>,
    reminder_config_json: Option<String>,
) -> CmdResult<Task> {
    crate::db::tables::tasks::tasks::create(
        &pool,
        company_id.as_deref(),
        &title,
        description.as_deref(),
        &priority,
        due_date,
        parent_id.as_deref(),
        contact_id.as_deref(),
        thread_id.as_deref(),
        thread_account_id.as_deref(),
        recurrence_rule.as_deref(),
        tags_json.as_deref(),
        workflow_config_json.as_deref(),
        reminder_config_json.as_deref(),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_task(
    pool: State<'_, SqlitePool>,
    id: String,
    request: UpdateTaskRequest,
) -> CmdResult<()> {
    crate::db::tables::tasks::tasks::update(
        &pool,
        &id,
        request.title.as_deref(),
        request.description.as_ref().map(|v| v.as_deref()),
        request.priority.as_deref(),
        request.is_completed,
        request.due_date,
        request.parent_id.as_ref().map(|v| v.as_deref()),
        request.sort_order,
        request.recurrence_rule.as_ref().map(|v| v.as_deref()),
        request.tags_json.as_deref(),
        request.workflow_config_json.as_ref().map(|v| v.as_deref()),
        request.reminder_config_json.as_ref().map(|v| v.as_deref()),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
/// Delete a task by id.
///
/// Delegates to `tasks::delete`. Returns `()`; errors `NotFound` if absent.
pub async fn db_delete_task(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::tasks::tasks::delete(&pool, &id).await.map_err(Into::into)
}

#[tauri::command]
/// Mark a task completed (`completed_at` = now).
///
/// Delegates to `tasks::set_completed(id, true)`. Returns `()`.
pub async fn db_complete_task(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::tasks::tasks::set_completed(&pool, &id, true).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_uncomplete_task(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::tasks::tasks::set_completed(&pool, &id, false).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_reorder_tasks(
    pool: State<'_, SqlitePool>,
    task_ids: Vec<String>,
) -> CmdResult<()> {
    crate::db::tables::tasks::tasks::reorder(&pool, &task_ids).await.map_err(Into::into)
}

#[tauri::command]
/// Count incomplete tasks for a company (or globally).
///
/// Delegates to `tasks::count_incomplete`. `company_id` of `None` counts all.
/// Returns `i64`.
pub async fn db_get_incomplete_task_count(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
) -> CmdResult<i64> {
    crate::db::tables::tasks::tasks::count_incomplete(&pool, company_id.as_deref()).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_tasks_for_contact(
    pool: State<'_, SqlitePool>,
    contact_id: String,
    include_completed: Option<bool>,
) -> CmdResult<Vec<Task>> {
    crate::db::tables::tasks::tasks::list_by_contact(&pool, &contact_id, include_completed.unwrap_or(false))
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_tasks_due_for_reminder(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<Task>> {
    crate::db::tables::tasks::tasks::list_due_for_reminder(&pool).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_tasks_with_workflow(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<Task>> {
    crate::db::tables::tasks::tasks::list_with_workflow(&pool).await.map_err(Into::into)
}

#[tauri::command]
/// List task tags for a company (plus account-agnostic tags).
///
/// Delegates to `task_tags::list_by_account`. `company_id` of `None` lists all.
/// Returns `Vec<TaskTag>`.
pub async fn db_get_task_tags(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
) -> CmdResult<Vec<TaskTag>> {
    crate::db::tables::tasks::task_tags::list_by_account(&pool, company_id.as_deref()).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_task_tag(
    pool: State<'_, SqlitePool>,
    tag: String,
    company_id: Option<String>,
    color: Option<String>,
) -> CmdResult<()> {
    crate::db::tables::tasks::task_tags::upsert(&pool, &tag, company_id.as_deref(), color.as_deref(), 0).await.map_err(Into::into)
}

#[tauri::command]
/// Delete a task tag by tag name.
///
/// Delegates to `task_tags::delete`. Returns `()`; errors `NotFound` if absent.
/// (The `_company_id` argument is accepted for API symmetry but unused.)
pub async fn db_delete_task_tag(
    pool: State<'_, SqlitePool>,
    tag: String,
_company_id: Option<String>,
) -> CmdResult<()> {
    crate::db::tables::tasks::task_tags::delete(&pool, &tag).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_task_tag_by_tag(
    pool: State<'_, SqlitePool>,
    tag: String,
) -> CmdResult<TaskTag> {
    crate::db::tables::tasks::task_tags::get_by_tag(&pool, &tag).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_tasks_for_account(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
    include_completed: Option<bool>,
) -> CmdResult<Vec<Task>> {
    if let Some(aid) = company_id {
        crate::db::tables::tasks::tasks::list_by_account(&pool, &aid, include_completed.unwrap_or(false)).await.map_err(Into::into)
    } else {
        crate::db::tables::tasks::tasks::list(&pool, None, if include_completed.unwrap_or(false) { None } else { Some(false) }).await.map_err(Into::into)
    }
}

#[tauri::command]
/// List tasks joined with contact info, for a company.
///
/// Delegates to `tasks::list_with_contacts`. Returns `Vec<TaskWithContactResponse>`.
pub async fn db_get_tasks_with_contacts(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
    include_completed: Option<bool>,
) -> CmdResult<Vec<TaskWithContactResponse>> {
    let results = crate::db::tables::tasks::tasks::list_with_contacts(&pool, company_id.as_deref(), include_completed.unwrap_or(false)).await?;

    Ok(results.into_iter().map(|(t, name, avatar, email)| TaskWithContactResponse {
        id: t.id, company_id: t.company_id, title: t.title,
        description: t.description, priority: t.priority,
        is_completed: t.is_completed, completed_at: t.completed_at,
        due_date: t.due_date, parent_id: t.parent_id,
        contact_id: t.contact_id, thread_id: t.thread_id,
        thread_account_id: t.thread_account_id, sort_order: t.sort_order,
        recurrence_rule: t.recurrence_rule, next_recurrence_at: t.next_recurrence_at,
        tags_json: t.tags_json, workflow_config_json: t.workflow_config_json,
        reminder_config_json: t.reminder_config_json, created_at: t.created_at,
        updated_at: t.updated_at,
        contact_name: name, contact_avatar: avatar, contact_email: email,
    }).collect())
}

#[tauri::command]
pub async fn db_get_tasks_with_contacts_paginated(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
    include_completed: Option<bool>,
    limit: i64,
    offset: i64,
) -> CmdResult<Vec<TaskWithContactResponse>> {
    let results = crate::db::tables::tasks::tasks::list_with_contacts_paginated(
        &pool, company_id.as_deref(), include_completed.unwrap_or(false), limit, offset
    ).await?;

    Ok(results.into_iter().map(|(t, name, avatar, email)| TaskWithContactResponse {
        id: t.id, company_id: t.company_id, title: t.title,
        description: t.description, priority: t.priority,
        is_completed: t.is_completed, completed_at: t.completed_at,
        due_date: t.due_date, parent_id: t.parent_id,
        contact_id: t.contact_id, thread_id: t.thread_id,
        thread_account_id: t.thread_account_id, sort_order: t.sort_order,
        recurrence_rule: t.recurrence_rule, next_recurrence_at: t.next_recurrence_at,
        tags_json: t.tags_json, workflow_config_json: t.workflow_config_json,
        reminder_config_json: t.reminder_config_json, created_at: t.created_at,
        updated_at: t.updated_at,
        contact_name: name, contact_avatar: avatar, contact_email: email,
    }).collect())
}

#[tauri::command]
pub async fn db_count_tasks(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
    include_completed: Option<bool>,
) -> CmdResult<Vec<CountRow>> {
    let count = crate::db::tables::tasks::tasks::count_by_account(
        &pool, company_id.as_deref(), include_completed.unwrap_or(false)
    ).await?;
    Ok(vec![CountRow { count }])
}

/// Single `count` value wrapper returned by `db_count_tasks`.
#[derive(Debug, Serialize)]
pub struct CountRow {
    /// Number of matching tasks.
    pub count: i64,
}

#[tauri::command]
/// List tasks for a thread.
///
/// Delegates to `tasks::list_by_thread`. The `_company_id` argument is accepted
/// for API symmetry but unused. Returns `Vec<Task>`.
pub async fn db_get_tasks_for_thread(
    pool: State<'_, SqlitePool>,
    _company_id: String,
    thread_id: String,
) -> CmdResult<Vec<Task>> {
    crate::db::tables::tasks::tasks::list_by_thread(&pool, &thread_id).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_subtasks(
    pool: State<'_, SqlitePool>,
    parent_id: String,
) -> CmdResult<Vec<Task>> {
    crate::db::tables::tasks::tasks::list_subtasks(&pool, &parent_id).await.map_err(Into::into)
}

#[tauri::command]
/// Filter tasks for a company with optional priority / date / search predicates
/// and a sort order (backend counterpart to the Tasks UI SmartFilterBar).
///
/// Delegates to `tasks::filter` and maps each `(Task, name, avatar, email)`
/// tuple into [`TaskWithContactResponse`]. Returns `Vec<TaskWithContactResponse>`.
pub async fn db_filter_tasks(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
    include_completed: Option<bool>,
    priority: Option<String>,
    date_filter: Option<String>,
    search: Option<String>,
    sort_field: Option<String>,
    sort_direction: Option<String>,
    limit: i64,
    offset: i64,
) -> CmdResult<Vec<TaskWithContactResponse>> {
    let results = crate::db::tables::tasks::tasks::filter(
        &pool,
        company_id.as_deref(),
        include_completed.unwrap_or(false),
        priority.as_deref(),
        date_filter.as_deref(),
        search.as_deref(),
        sort_field.as_deref().unwrap_or("sort_order"),
        sort_direction.as_deref().unwrap_or("asc"),
        limit,
        offset,
    )
    .await?;

    Ok(results
        .into_iter()
        .map(|(t, name, avatar, email)| TaskWithContactResponse {
            id: t.id,
            company_id: t.company_id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            is_completed: t.is_completed,
            completed_at: t.completed_at,
            due_date: t.due_date,
            parent_id: t.parent_id,
            contact_id: t.contact_id,
            thread_id: t.thread_id,
            thread_account_id: t.thread_account_id,
            sort_order: t.sort_order,
            recurrence_rule: t.recurrence_rule,
            next_recurrence_at: t.next_recurrence_at,
            tags_json: t.tags_json,
            workflow_config_json: t.workflow_config_json,
            reminder_config_json: t.reminder_config_json,
            created_at: t.created_at,
            updated_at: t.updated_at,
            contact_name: name,
            contact_avatar: avatar,
            contact_email: email,
        })
        .collect())
}

#[tauri::command]
/// Count tasks grouped by contact.
///
/// Delegates to `tasks::count_by_contact` and maps each pair into
/// [`ContactCountRow`]. Returns `Vec<ContactCountRow>`.
pub async fn db_tasks_count_by_contact(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<ContactCountRow>> {
    let results = crate::db::tables::tasks::tasks::count_by_contact(&pool).await?;
    Ok(results.into_iter().map(|(contact_id, cnt)| ContactCountRow { contact_id, cnt }).collect())
}