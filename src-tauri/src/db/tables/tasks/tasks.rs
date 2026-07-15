// ── Tasks query functions ────────────────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::tasks::schema::Task;

/// List tasks, optionally filtered by company and completion status.
///
/// # Parameters
/// - `pool`: SQLite connection pool.
/// - `company_id`: when `Some`, restrict to that company's tasks; `None` returns
///   tasks across all companies.
/// - `is_completed`: when `Some`, restrict to completed (`true`) or pending
///   (`false`) tasks; `None` returns both.
///
/// # Returns
/// All matching tasks ordered by `sort_order ASC`, then `created_at DESC`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`
/// (an empty filter simply yields an empty `Vec`).
pub async fn list(
    pool: &SqlitePool,
    company_id: Option<&str>,
    is_completed: Option<bool>,
) -> Result<Vec<Task>, AppDbError> {
    let is_completed_i64 = is_completed.map(|v| if v { 1_i64 } else { 0_i64 });

    sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE (?1 IS NULL OR company_id = ?1) AND (?2 IS NULL OR is_completed = ?2) ORDER BY sort_order ASC, created_at DESC",
    )
    .bind(company_id)
    .bind(is_completed_i64)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single task by its primary key.
///
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Task, AppDbError> {
    sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("Task with id '{id}' not found")))
}

/// Fetch a single task by primary key, returning `None` if absent.
///
/// # Parameters
/// - `pool`: SQLite connection pool.
/// - `id`: the task's primary key.
///
/// # Returns
/// `Some(Task)` when found, `None` when no task matches (never errors with
/// `NotFound`).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure only.
pub async fn get_by_id_opt(pool: &SqlitePool, id: &str) -> Result<Option<Task>, AppDbError> {
    sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Create a new task and return the inserted row.
///
/// # Parameters
/// All task fields (`company_id`, `title`, `description`, `priority`, `due_date`,
/// `parent_id`, `contact_id`, `thread_id`, `thread_account_id`, `recurrence_rule`,
/// `tags_json`, `workflow_config_json`, `reminder_config_json`) are passed
/// individually; `None` values are stored as SQL `NULL`/defaults.
///
/// # Returns
/// The freshly created [`Task`] (with generated `id`, `sort_order = 0`,
/// `is_completed = 0`, `tags_json` defaulting to `'[]'`, and timestamps).
///
/// # Errors
/// Returns `AppDbError::Database` on insert/constraint failure (e.g. a foreign
/// key violation). Never returns `NotFound`.
#[allow(clippy::too_many_arguments)]
pub async fn create(
    pool: &SqlitePool,
    company_id: Option<&str>,
    title: &str,
    description: Option<&str>,
    priority: &str,
    due_date: Option<i64>,
    parent_id: Option<&str>,
    contact_id: Option<&str>,
    thread_id: Option<&str>,
    thread_account_id: Option<&str>,
    recurrence_rule: Option<&str>,
    tags_json: Option<&str>,
    workflow_config_json: Option<&str>,
    reminder_config_json: Option<&str>,
) -> Result<Task, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();
    let tags = tags_json.unwrap_or("[]");

    sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (
            id, company_id, title, description, priority,
            is_completed, completed_at, due_date,
            parent_id, contact_id, thread_id, thread_account_id,
            sort_order, recurrence_rule, next_recurrence_at,
            tags_json, workflow_config_json, reminder_config_json,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, 0, ?, NULL, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(title)
    .bind(description)
    .bind(priority)
    .bind(due_date)
    .bind(parent_id)
    .bind(contact_id)
    .bind(thread_id)
    .bind(thread_account_id)
    .bind(recurrence_rule)
    .bind(tags)
    .bind(workflow_config_json)
    .bind(reminder_config_json)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update mutable fields on a task.
///
/// # Parameters
/// Each field is an `Option`; only `Some` values are applied, `None` leaves the
/// column unchanged. `is_completed = Some(true/false)` additionally sets/clears
/// `completed_at`. `updated_at` is always bumped.
///
/// # Returns
/// `()` on success. When every field is `None`, the row is still touched to bump
/// `updated_at` (not an error).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. The generated `SET` clause is
/// wrapped in `sqlx::AssertSqlSafe` because column values are interpolated with
/// manual `''` escaping rather than bound parameters. Never returns `NotFound`.
#[allow(clippy::too_many_arguments)]
pub async fn update(
    pool: &SqlitePool,
    id: &str,
    title: Option<&str>,
    description: Option<Option<&str>>,
    priority: Option<&str>,
    is_completed: Option<bool>,
    due_date: Option<Option<i64>>,
    parent_id: Option<Option<&str>>,
    sort_order: Option<i64>,
    recurrence_rule: Option<Option<&str>>,
    tags_json: Option<&str>,
    workflow_config_json: Option<Option<&str>>,
    reminder_config_json: Option<Option<&str>>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let mut sets: Vec<String> = Vec::new();

    if let Some(v) = title {
        sets.push(format!("\"title\" = '{}'", v.replace('\'', "''")));
    }
    if let Some(v) = description {
        if let Some(val) = v {
            sets.push(format!("\"description\" = '{}'", val.replace('\'', "''")));
        } else {
            sets.push("\"description\" = NULL".to_string());
        }
    }
    if let Some(v) = priority {
        sets.push(format!("\"priority\" = '{}'", v.replace('\'', "''")));
    }
    if let Some(v) = is_completed {
        let val = if v { 1_i64 } else { 0_i64 };
        sets.push(format!("\"is_completed\" = {val}"));
        if v {
            sets.push(format!("\"completed_at\" = {now}"));
        } else {
            sets.push("\"completed_at\" = NULL".to_string());
        }
    }
    if let Some(v) = due_date {
        if let Some(val) = v {
            sets.push(format!("\"due_date\" = {val}"));
        } else {
            sets.push("\"due_date\" = NULL".to_string());
        }
    }
    if let Some(v) = parent_id {
        if let Some(val) = v {
            sets.push(format!("\"parent_id\" = '{}'", val.replace('\'', "''")));
        } else {
            sets.push("\"parent_id\" = NULL".to_string());
        }
    }
    if let Some(v) = sort_order {
        sets.push(format!("\"sort_order\" = {v}"));
    }
    if let Some(v) = recurrence_rule {
        if let Some(val) = v {
            sets.push(format!("\"recurrence_rule\" = '{}'", val.replace('\'', "''")));
        } else {
            sets.push("\"recurrence_rule\" = NULL".to_string());
        }
    }
    if let Some(v) = tags_json {
        sets.push(format!(
            "\"tags_json\" = '{}'",
            v.replace('\'', "''")
        ));
    }
    if let Some(v) = workflow_config_json {
        if let Some(val) = v {
            sets.push(format!(
                "\"workflow_config_json\" = '{}'",
                val.replace('\'', "''")
            ));
        } else {
            sets.push("\"workflow_config_json\" = NULL".to_string());
        }
    }
    if let Some(v) = reminder_config_json {
        if let Some(val) = v {
            sets.push(format!(
                "\"reminder_config_json\" = '{}'",
                val.replace('\'', "''")
            ));
        } else {
            sets.push("\"reminder_config_json\" = NULL".to_string());
        }
    }

    if sets.is_empty() {
        // Nothing to update — still bump updated_at
        sqlx::query("UPDATE tasks SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppDbError::Database)?;
        return Ok(());
    }

    sets.push(format!("\"updated_at\" = {now}"));

    let sql = format!("UPDATE tasks SET {} WHERE id = ?", sets.join(", "));
    sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete a task by primary key.
///
/// # Parameters
/// - `pool`: SQLite connection pool.
/// - `id`: the task's primary key.
///
/// # Returns
/// `()` when a row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`Task with id '<id>' not found`) when no task
/// matches, and `AppDbError::Database` on query failure.
///
/// NOTE: kept inline (parameterized `?` bind) rather than `delete_or_not_found`,
/// which expects an interpolated id string; this preserves the exact SQL.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("Task with id '{id}' not found")));
    }
    Ok(())
}

/// List all tasks associated with a specific contact.
///
/// Filters by `contact_id` and orders by `created_at DESC`.
/// List tasks belonging to a specific contact.
///
/// # Parameters
/// - `pool`: SQLite connection pool.
/// - `contact_id`: the contact's primary key.
/// - `include_completed`: when `false`, only pending tasks are returned.
///
/// # Returns
/// Tasks for `contact_id` ordered by `created_at DESC`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list_by_contact(
    pool: &SqlitePool,
    contact_id: &str,
    include_completed: bool,
) -> Result<Vec<Task>, AppDbError> {
    if include_completed {
        sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE contact_id = ? ORDER BY created_at DESC",
        )
        .bind(contact_id)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
    } else {
        sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE contact_id = ? AND is_completed = 0 ORDER BY created_at DESC",
        )
        .bind(contact_id)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
    }
}

/// List tasks belonging to a specific thread.
///
/// # Parameters
/// - `pool`: SQLite connection pool.
/// - `thread_id`: the thread's primary key.
///
/// # Returns
/// Tasks for `thread_id` ordered by `created_at DESC`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list_by_thread(
    pool: &SqlitePool,
    thread_id: &str,
) -> Result<Vec<Task>, AppDbError> {
    sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE thread_id = ? ORDER BY created_at DESC",
    )
    .bind(thread_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Count tasks grouped by contact_id.
pub async fn count_by_contact(pool: &SqlitePool) -> Result<Vec<(String, i64)>, AppDbError> {
    #[derive(sqlx::FromRow)]
    struct CountRow { contact_id: String, cnt: i64 }
    let rows = sqlx::query_as::<_, CountRow>(
        "SELECT contact_id, COUNT(*) as cnt FROM tasks WHERE contact_id IS NOT NULL GROUP BY contact_id"
    )
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(rows.into_iter().map(|r| (r.contact_id, r.cnt)).collect())
}

/// List tasks for a company, optionally including completed tasks.
///
/// # Parameters
/// - `pool`: SQLite connection pool.
/// - `company_id`: the company's primary key.
/// - `include_completed`: when `false`, only pending tasks are returned.
///
/// # Returns
/// Tasks ordered by `sort_order ASC`, then `created_at DESC`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list_by_account(
    pool: &SqlitePool,
    company_id: &str,
    include_completed: bool,
) -> Result<Vec<Task>, AppDbError> {
    if include_completed {
        sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE company_id = ? ORDER BY sort_order ASC, created_at DESC"
        )
        .bind(company_id)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
    } else {
        sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE company_id = ? AND is_completed = 0 ORDER BY sort_order ASC, created_at DESC"
        )
        .bind(company_id)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
    }
}

/// Count tasks for a company, optionally including completed tasks.
pub async fn count_by_account(
    pool: &SqlitePool,
    company_id: Option<&str>,
    include_completed: bool,
) -> Result<i64, AppDbError> {
    if include_completed {
        if let Some(cid) = company_id {
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM tasks WHERE company_id = ?"
            )
            .bind(cid)
            .fetch_one(pool)
            .await
            .map_err(AppDbError::Database)
        } else {
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM tasks"
            )
            .fetch_one(pool)
            .await
            .map_err(AppDbError::Database)
        }
    } else {
        if let Some(cid) = company_id {
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM tasks WHERE company_id = ? AND is_completed = 0"
            )
            .bind(cid)
            .fetch_one(pool)
            .await
            .map_err(AppDbError::Database)
        } else {
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM tasks WHERE is_completed = 0"
            )
            .fetch_one(pool)
            .await
            .map_err(AppDbError::Database)
        }
    }
}

/// List tasks joined with contact info, for a company, with pagination.
pub async fn list_with_contacts_paginated(
    pool: &SqlitePool,
    company_id: Option<&str>,
    include_completed: bool,
    limit: i64,
    offset: i64,
) -> Result<Vec<(Task, Option<String>, Option<String>, Option<String>)>, AppDbError> {
    // Treat an empty/missing company_id as "show tasks for all accounts". This keeps the
    // task table populated even when no specific account is active, and mirrors the behaviour
    // of `list`/`count_by_account` (which already return all rows for a NULL company_id).
    let show_all = company_id.map(|c| c.is_empty()).unwrap_or(true);

    let base = if include_completed {
        "SELECT t.*, c.display_name as contact_name, c.avatar_url as contact_avatar, c.email as contact_email \
         FROM tasks t LEFT JOIN contacts c ON t.contact_id = c.id"
    } else {
        "SELECT t.*, c.display_name as contact_name, c.avatar_url as contact_avatar, c.email as contact_email \
         FROM tasks t LEFT JOIN contacts c ON t.contact_id = c.id \
         WHERE t.is_completed = 0"
    };

    let query = if show_all {
        format!(
            "{base} ORDER BY t.sort_order ASC, t.created_at DESC LIMIT ? OFFSET ?"
        )
    } else {
        format!(
            "{base} AND t.company_id = ? ORDER BY t.sort_order ASC, t.created_at DESC LIMIT ? OFFSET ?"
        )
    };

    #[derive(sqlx::FromRow)]
    struct TaskWithContact {
        id: String, company_id: String, title: String, description: Option<String>,
        priority: String, is_completed: i64, completed_at: Option<i64>, due_date: Option<i64>,
        parent_id: Option<String>, contact_id: Option<String>, thread_id: Option<String>,
        thread_account_id: Option<String>, sort_order: i64, recurrence_rule: Option<String>,
        next_recurrence_at: Option<i64>, tags_json: String, workflow_config_json: Option<String>,
        reminder_config_json: Option<String>, created_at: i64, updated_at: i64,
        contact_name: Option<String>, contact_avatar: Option<String>, contact_email: Option<String>,
    }

    let mut q = sqlx::query_as::<_, TaskWithContact>(sqlx::AssertSqlSafe(query));
    if !show_all {
        q = q.bind(company_id.unwrap());
    }
    let rows = q
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)?;

    Ok(rows.into_iter().map(|r| {
        let task = Task {
            id: r.id, company_id: r.company_id, title: r.title, description: r.description,
            priority: r.priority, is_completed: r.is_completed, completed_at: r.completed_at,
            due_date: r.due_date, parent_id: r.parent_id, contact_id: r.contact_id,
            thread_id: r.thread_id, thread_account_id: r.thread_account_id, sort_order: r.sort_order,
            recurrence_rule: r.recurrence_rule, next_recurrence_at: r.next_recurrence_at,
            tags_json: r.tags_json, workflow_config_json: r.workflow_config_json,
            reminder_config_json: r.reminder_config_json, created_at: r.created_at, updated_at: r.updated_at,
        };
        (task, r.contact_name, r.contact_avatar, r.contact_email)
    }).collect())
}

/// List tasks with joined contact info, for a given company.
/// List tasks joined with contact info, for a company (no pagination).
///
/// # Parameters
/// - `pool`: SQLite connection pool.
/// - `company_id`: the company's primary key.
/// - `include_completed`: when `false`, only pending tasks are returned.
///
/// # Returns
/// A `Vec` of `(Task, contact_name, contact_avatar, contact_email)` tuples,
/// ordered by `sort_order ASC`, then `created_at DESC`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list_with_contacts(
    pool: &SqlitePool,
    company_id: Option<&str>,
    include_completed: bool,
) -> Result<Vec<(Task, Option<String>, Option<String>, Option<String>)>, AppDbError> {
    // Treat an empty/missing company_id as "show tasks for all accounts" (see
    // `list_with_contacts_paginated` for the rationale).
    let show_all = company_id.map(|c| c.is_empty()).unwrap_or(true);

    let base = if include_completed {
        "SELECT t.*, c.display_name as contact_name, c.avatar_url as contact_avatar, c.email as contact_email \
         FROM tasks t LEFT JOIN contacts c ON t.contact_id = c.id"
    } else {
        "SELECT t.*, c.display_name as contact_name, c.avatar_url as contact_avatar, c.email as contact_email \
         FROM tasks t LEFT JOIN contacts c ON t.contact_id = c.id \
         WHERE t.is_completed = 0"
    };

    let query = if show_all {
        format!(
            "{base} ORDER BY t.sort_order ASC, t.created_at DESC"
        )
    } else {
        format!(
            "{base} AND t.company_id = ? ORDER BY t.sort_order ASC, t.created_at DESC"
        )
    };

    #[derive(sqlx::FromRow)]
    struct TaskWithContact {
        // Task fields
        id: String, company_id: String, title: String, description: Option<String>,
        priority: String, is_completed: i64, completed_at: Option<i64>, due_date: Option<i64>,
        parent_id: Option<String>, contact_id: Option<String>, thread_id: Option<String>,
        thread_account_id: Option<String>, sort_order: i64, recurrence_rule: Option<String>,
        next_recurrence_at: Option<i64>, tags_json: String, workflow_config_json: Option<String>,
        reminder_config_json: Option<String>, created_at: i64, updated_at: i64,
        // Contact fields
        contact_name: Option<String>, contact_avatar: Option<String>, contact_email: Option<String>,
    }

    let mut q = sqlx::query_as::<_, TaskWithContact>(sqlx::AssertSqlSafe(query));
    if !show_all {
        q = q.bind(company_id.unwrap());
    }
    let rows = q
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)?;

    Ok(rows.into_iter().map(|r| {
        let task = Task {
            id: r.id, company_id: r.company_id, title: r.title, description: r.description,
            priority: r.priority, is_completed: r.is_completed, completed_at: r.completed_at,
            due_date: r.due_date, parent_id: r.parent_id, contact_id: r.contact_id,
            thread_id: r.thread_id, thread_account_id: r.thread_account_id, sort_order: r.sort_order,
            recurrence_rule: r.recurrence_rule, next_recurrence_at: r.next_recurrence_at,
            tags_json: r.tags_json, workflow_config_json: r.workflow_config_json,
            reminder_config_json: r.reminder_config_json, created_at: r.created_at, updated_at: r.updated_at,
        };
        (task, r.contact_name, r.contact_avatar, r.contact_email)
    }).collect())
}

/// List tasks that have the given parent_id.
/// List the direct subtasks of a parent task.
///
/// # Parameters
/// - `pool`: SQLite connection pool.
/// - `parent_id`: the parent task's primary key.
///
/// # Returns
/// Child tasks ordered by `sort_order ASC`, then `created_at DESC`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list_subtasks(
    pool: &SqlitePool,
    parent_id: &str,
) -> Result<Vec<Task>, AppDbError> {
    sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE parent_id = ? ORDER BY sort_order ASC, created_at DESC"
    )
    .bind(parent_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Set a task's completion status (and `completed_at` timestamp).
///
/// # Parameters
/// - `pool`: SQLite connection pool.
/// - `id`: the task's primary key.
/// - `completed`: when `true`, marks completed (`completed_at` = now); when
///   `false`, marks pending (`completed_at` = NULL). `updated_at` is bumped in
///   both cases.
///
/// # Returns
/// `()` when the target row exists.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`Task with id '<id>' not found`) when no task
/// matches, and `AppDbError::Database` on query failure.
pub async fn set_completed(
    pool: &SqlitePool,
    id: &str,
    completed: bool,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let rows = if completed {
        sqlx::query("UPDATE tasks SET is_completed = 1, completed_at = ?, updated_at = ? WHERE id = ?")
            .bind(now).bind(now).bind(id)
            .execute(pool).await.map_err(AppDbError::Database)?.rows_affected()
    } else {
        sqlx::query("UPDATE tasks SET is_completed = 0, completed_at = NULL, updated_at = ? WHERE id = ?")
            .bind(now).bind(id)
            .execute(pool).await.map_err(AppDbError::Database)?.rows_affected()
    };
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("Task with id '{id}' not found")));
    }
    Ok(())
}

/// Reorder tasks by setting sort_order based on the given ordered list of task ids.
pub async fn reorder(
    pool: &SqlitePool,
    task_ids: &[String],
) -> Result<(), AppDbError> {
    for (i, task_id) in task_ids.iter().enumerate() {
        sqlx::query("UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?")
            .bind(i as i64)
            .bind(chrono::Utc::now().timestamp())
            .bind(task_id)
            .execute(pool)
            .await
            .map_err(AppDbError::Database)?;
    }
    Ok(())
}

/// Count incomplete tasks for a given company (or all companies if None).
pub async fn count_incomplete(
    pool: &SqlitePool,
    company_id: Option<&str>,
) -> Result<i64, AppDbError> {
    if let Some(cid) = company_id {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM tasks WHERE company_id = ? AND is_completed = 0"
        )
        .bind(cid)
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)
    } else {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM tasks WHERE is_completed = 0"
        )
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)
    }
}

/// List incomplete tasks whose `due_date` is due (or past) for reminders.
///
/// # Parameters
/// - `pool`: SQLite connection pool.
///
/// # Returns
/// Tasks where `is_completed = 0`, `due_date IS NOT NULL`, and `due_date <= now`,
/// ordered by `due_date ASC`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list_due_for_reminder(pool: &SqlitePool) -> Result<Vec<Task>, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE is_completed = 0 AND due_date IS NOT NULL AND due_date <= ? ORDER BY due_date ASC"
    )
    .bind(now)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List tasks that have a workflow_config_json (non-null, non-empty).
/// List tasks that carry a workflow configuration.
///
/// # Parameters
/// - `pool`: SQLite connection pool.
///
/// # Returns
/// Tasks whose `workflow_config_json` is non-null, not `'null'`, and not empty.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list_with_workflow(pool: &SqlitePool) -> Result<Vec<Task>, AppDbError> {
    sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE workflow_config_json IS NOT NULL AND workflow_config_json != 'null' AND workflow_config_json != ''"
    )
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

// ── Dashboard aggregate queries ────────────────────────────────────────────────

/// Count tasks due today or earlier that are not completed.
/// Dashboard: count tasks due today or earlier that are not completed.
///
/// # Parameters
/// - `pool`: SQLite connection pool.
///
/// # Returns
/// Number of tasks where `due_date <= now`, `due_date IS NOT NULL`, and
/// `is_completed = 0`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn count_due_today(pool: &SqlitePool) -> Result<i64, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM tasks WHERE due_date <= ? AND due_date IS NOT NULL AND is_completed = 0"
    )
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(row.0)
}

/// Dashboard: count all incomplete tasks (no company filter).
pub async fn count_incomplete_all(pool: &SqlitePool) -> Result<i64, AppDbError> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tasks WHERE is_completed = 0")
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(row.0)
}

/// Count overdue tasks (due before now and not completed).
/// Dashboard: count overdue tasks (due before now, not completed).
///
/// # Parameters
/// - `pool`: SQLite connection pool.
///
/// # Returns
/// Number of tasks where `due_date < now` and `is_completed = 0`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn count_overdue(pool: &SqlitePool) -> Result<i64, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM tasks WHERE due_date < ? AND is_completed = 0"
    )
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(row.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    /// Helper to create a minimal task.
    async fn create_test_task(
        pool: &SqlitePool,
        company_id: Option<&str>,
        title: &str,
        priority: &str,
    ) -> Task {
        create(
            pool,
            company_id,
            title,
            None,        // description
            priority,
            None,        // due_date
            None,        // parent_id
            None,        // contact_id
            None,        // thread_id
            None,        // thread_account_id
            None,        // recurrence_rule
            None,        // tags_json
            None,        // workflow_config_json
            None,        // reminder_config_json
        )
        .await
        .expect("create task should succeed")
    }

    #[tokio::test]
    async fn test_create_and_get_by_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;

        let task = create_test_task(&pool, Some("acc1"), "My Task", "high").await;

        assert_eq!(task.company_id, "acc1".to_string());
        assert_eq!(task.title, "My Task");
        assert_eq!(task.priority, "high");
        assert_eq!(task.is_completed, 0);
        assert_eq!(task.sort_order, 0);
        assert!(task.completed_at.is_none());
        assert!(task.created_at > 0);
        assert!(task.updated_at > 0);

        let fetched = get_by_id(&pool, &task.id).await.expect("get_by_id should succeed");
        assert_eq!(fetched.id, task.id);
        assert_eq!(fetched.title, "My Task");
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_create_with_all_fields() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        helpers::insert_test_contact(&pool, "contact-456").await;
        // Seed a parent task so the FK constraint on parent_id passes
        create_test_task(&pool, Some("acc1"), "Parent Task", "high").await;
        // Get the parent task id
        let parent_tasks = list(&pool, Some("acc1"), None).await.unwrap();
        let parent_id = parent_tasks[0].id.clone();
        let now = chrono::Utc::now().timestamp();

        let task = create(
            &pool,
            Some("acc1"),
            "Full Task",
            Some("A description"),
            "low",
            Some(now + 86400),  // due tomorrow
            Some(&parent_id), // parent_id
            Some("contact-456"),
            Some("thread-789"),
            Some("acc1"),
            Some("FREQ=DAILY"),
            Some("[\"work\", \"important\"]"),
            Some("{\"step\":1}"),
            Some("{\"remind\":true}"),
        )
        .await
        .expect("create with all fields should succeed");

        assert_eq!(task.title, "Full Task");
        assert_eq!(task.description, Some("A description".to_string()));
        assert_eq!(task.priority, "low");
        assert_eq!(task.due_date, Some(now + 86400));
        assert_eq!(task.parent_id, Some(parent_id));
        assert_eq!(task.contact_id, Some("contact-456".to_string()));
        assert_eq!(task.thread_id, Some("thread-789".to_string()));
        assert_eq!(task.thread_account_id, Some("acc1".to_string()));
        assert_eq!(task.recurrence_rule, Some("FREQ=DAILY".to_string()));
        assert_eq!(task.tags_json, "[\"work\", \"important\"]");
        assert_eq!(task.workflow_config_json, Some("{\"step\":1}".to_string()));
        assert_eq!(task.reminder_config_json, Some("{\"remind\":true}".to_string()));
    }

    #[tokio::test]
    async fn test_list_all() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        helpers::insert_test_account(&pool, "acc2").await;

        create_test_task(&pool, Some("acc1"), "Task A", "high").await;
        create_test_task(&pool, Some("acc1"), "Task B", "low").await;
        create_test_task(&pool, Some("acc2"), "Task C", "medium").await;

        // All tasks
        let all = list(&pool, None, None).await.expect("list all should succeed");
        assert_eq!(all.len(), 3);

        // Filter by account
        let acc1_tasks = list(&pool, Some("acc1"), None).await.unwrap();
        assert_eq!(acc1_tasks.len(), 2);

        let acc2_tasks = list(&pool, Some("acc2"), None).await.unwrap();
        assert_eq!(acc2_tasks.len(), 1);
    }

    #[tokio::test]
    async fn test_list_filter_completed() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;

        let _task1 = create_test_task(&pool, Some("acc1"), "Pending", "high").await;
        let task2 = create_test_task(&pool, Some("acc1"), "Done", "low").await;

        // Mark task2 as completed
        update(&pool, &task2.id, None, None, None, Some(true), None, None, None, None, None, None, None)
            .await
            .unwrap();

        let pending = list(&pool, Some("acc1"), Some(false)).await.unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].title, "Pending");

        let completed = list(&pool, Some("acc1"), Some(true)).await.unwrap();
        assert_eq!(completed.len(), 1);
        assert_eq!(completed[0].title, "Done");
    }

    #[tokio::test]
    async fn test_update_title() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let task = create_test_task(&pool, Some("acc1"), "Original", "medium").await;

        update(&pool, &task.id, Some("Updated Title"), None, None, None, None, None, None, None, None, None, None)
            .await
            .expect("update title should succeed");

        let updated = get_by_id(&pool, &task.id).await.unwrap();
        assert_eq!(updated.title, "Updated Title");
        assert_eq!(updated.priority, "medium"); // unchanged
    }

    #[tokio::test]
    async fn test_update_priority() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let task = create_test_task(&pool, Some("acc1"), "Priorities", "low").await;

        update(&pool, &task.id, None, None, Some("high"), None, None, None, None, None, None, None, None)
            .await
            .unwrap();

        let updated = get_by_id(&pool, &task.id).await.unwrap();
        assert_eq!(updated.priority, "high");
    }

    #[tokio::test]
    async fn test_update_completion() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let task = create_test_task(&pool, Some("acc1"), "To Complete", "high").await;

        // Mark as completed
        update(&pool, &task.id, None, None, None, Some(true), None, None, None, None, None, None, None)
            .await
            .unwrap();

        let updated = get_by_id(&pool, &task.id).await.unwrap();
        assert_eq!(updated.is_completed, 1);
        assert!(updated.completed_at.is_some());
        assert!(updated.updated_at >= task.updated_at);

        // Mark as not completed
        update(&pool, &task.id, None, None, None, Some(false), None, None, None, None, None, None, None)
            .await
            .unwrap();

        let reverted = get_by_id(&pool, &task.id).await.unwrap();
        assert_eq!(reverted.is_completed, 0);
        assert!(reverted.completed_at.is_none());
    }

    #[tokio::test]
    async fn test_update_set_fields_to_null() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let now = chrono::Utc::now().timestamp();

        let task = create(
            &pool, Some("acc1"), "Nullable", Some("desc"), "high",
            Some(now), None, None, None, None, Some("FREQ=WEEKLY"),
            None, Some("{\"w\":1}"), Some("{\"r\":1}"),
        )
        .await
        .unwrap();

        assert!(task.description.is_some());
        assert!(task.due_date.is_some());
        assert!(task.recurrence_rule.is_some());

        // Set optional fields to NULL
        update(
            &pool, &task.id,
            None,
            Some(None),   // description → NULL
            None,
            None,
            Some(None),   // due_date → NULL
            None,
            None,
            Some(None),   // recurrence_rule → NULL
            None,
            Some(None),   // workflow_config_json → NULL
            Some(None),   // reminder_config_json → NULL
        )
        .await
        .unwrap();

        let updated = get_by_id(&pool, &task.id).await.unwrap();
        assert!(updated.description.is_none());
        assert!(updated.due_date.is_none());
        assert!(updated.recurrence_rule.is_none());
        assert!(updated.workflow_config_json.is_none());
        assert!(updated.reminder_config_json.is_none());
    }

    #[tokio::test]
    async fn test_update_no_changes() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let task = create_test_task(&pool, Some("acc1"), "No change", "low").await;

        // Update with nothing changed — still bumps updated_at
        update(&pool, &task.id, None, None, None, None, None, None, None, None, None, None, None)
            .await
            .unwrap();

        let updated = get_by_id(&pool, &task.id).await.unwrap();
        assert!(updated.updated_at >= task.updated_at);
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let task = create_test_task(&pool, Some("acc1"), "Delete Me", "high").await;

        delete(&pool, &task.id).await.expect("delete should succeed");

        let err = get_by_id(&pool, &task.id).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = delete(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_list_by_contact() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        helpers::insert_test_contact(&pool, "contact-1").await;
        helpers::insert_test_contact(&pool, "contact-2").await;

        create(
            &pool, Some("acc1"), "Task A", None, "high",
            None, None, Some("contact-1"), None, None, None, None, None, None,
        )
        .await
        .unwrap();

        create(
            &pool, Some("acc1"), "Task B", None, "low",
            None, None, Some("contact-1"), None, None, None, None, None, None,
        )
        .await
        .unwrap();

        create(
            &pool, Some("acc1"), "Task C", None, "medium",
            None, None, Some("contact-2"), None, None, None, None, None, None,
        )
        .await
        .unwrap();

        let contact1_tasks = list_by_contact(&pool, "contact-1", true).await.unwrap();
        assert_eq!(contact1_tasks.len(), 2);

        let contact2_tasks = list_by_contact(&pool, "contact-2", true).await.unwrap();
        assert_eq!(contact2_tasks.len(), 1);
    }

    #[tokio::test]
    async fn test_list_by_thread() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        helpers::insert_test_account(&pool, "acc2").await;

        create(
            &pool, Some("acc1"), "Task A", None, "high",
            None, None, None, Some("thread-1"), Some("acc1"), None, None, None, None,
        )
        .await
        .unwrap();

        create(
            &pool, Some("acc1"), "Task B", None, "low",
            None, None, None, Some("thread-1"), Some("acc1"), None, None, None, None,
        )
        .await
        .unwrap();

        create(
            &pool, Some("acc2"), "Task C", None, "medium",
            None, None, None, Some("thread-1"), Some("acc2"), None, None, None, None,
        )
        .await
        .unwrap();

        let thread1_tasks = list_by_thread(&pool, "thread-1").await.unwrap();
        assert_eq!(thread1_tasks.len(), 3);

        let empty = list_by_thread(&pool, "no-such-thread").await.unwrap();
        assert!(empty.is_empty());
    }

    #[tokio::test]
    async fn test_full_crud_cycle() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        helpers::insert_test_contact(&pool, "crud-contact").await;

        // Create
        let task = create(
            &pool, Some("acc1"), "CRUD Task", Some("CRUD desc"), "high",
            None, None, Some("crud-contact"), None, None, None, Some("[\"crud\"]"), None, None,
        )
        .await
        .unwrap();
        assert_eq!(task.title, "CRUD Task");

        // List
        assert_eq!(list(&pool, Some("acc1"), None).await.unwrap().len(), 1);

        // Update
        update(&pool, &task.id, Some("CRUD Updated"), None, None, Some(true), None, None, None, None, None, None, None)
            .await
            .unwrap();
        let updated = get_by_id(&pool, &task.id).await.unwrap();
        assert_eq!(updated.title, "CRUD Updated");
        assert_eq!(updated.is_completed, 1);

        // List by contact (include completed since we just marked it completed)
        let contact_tasks = list_by_contact(&pool, "crud-contact", true).await.unwrap();
        assert_eq!(contact_tasks.len(), 1);

        // Delete
        delete(&pool, &task.id).await.unwrap();
        assert!(list(&pool, Some("acc1"), None).await.unwrap().is_empty());
    }
}
