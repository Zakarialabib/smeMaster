//! FollowUpReminders table data-access layer.
//!
//! CRUD queries for the `follow_up_reminders` table. Every function is `async`
//! and runs against a shared `SqlitePool`. A missing row (on fetch or delete)
//! is surfaced as `AppDbError::NotFound`; other failures surface as
//! `AppDbError::Database`. Shared helpers from `crate::db::common` are used
//! where the existing pattern matches exactly (`fetch_or_not_found`,
//! `delete_or_not_found`).

use sqlx::SqlitePool;
use crate::db::common::{delete_or_not_found, fetch_or_not_found};
use crate::db::error::AppDbError;
use crate::db::workflows::schema::FollowUpReminder;

/// List follow-up reminders for a company with optional status filter.
///
/// When `status` is `None`, reminders in any status are returned.
/// Results are ordered by `remind_at ASC`.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
/// - `status` — optional status filter (e.g. `"pending"`, `"completed"`).
///
/// # Returns
/// `FollowUpReminder` rows for the company (optionally filtered by `status`),
/// ordered ascending by `remind_at`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
///
/// # SQL safety
/// The `WHERE` clause is built dynamically from fixed fragments (`company_id`
/// always, `status` only when present); only the filter values are bound as
/// parameters (`?`). The assembled SQL is wrapped with `sqlx::AssertSqlSafe`
/// because it is not a compile-time constant.
pub async fn list(
    pool: &SqlitePool,
    company_id: &str,
    status: Option<&str>,
) -> Result<Vec<FollowUpReminder>, AppDbError> {
    let mut conditions: Vec<String> = vec!["company_id = ?".to_string()];

    if status.is_some() {
        conditions.push("status = ?".to_string());
    }

    let where_sql = conditions.join(" AND ");
    let sql = format!(
        "SELECT * FROM follow_up_reminders WHERE {where_sql} ORDER BY remind_at ASC"
    );

    let mut q = sqlx::query_as::<_, FollowUpReminder>(sqlx::AssertSqlSafe(sql.clone()));
    q = q.bind(company_id);
    if let Some(s) = status {
        q = q.bind(s);
    }

    q.fetch_all(pool).await.map_err(AppDbError::Database)
}

/// List all pending reminders that are due at or before the given timestamp.
///
/// Filters by `status = 'pending'` and `remind_at <= ?`, ordered by
/// `remind_at ASC`.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `now` — epoch-second cutoff; reminders with `remind_at <= now` are due.
///
/// # Returns
/// Due `FollowUpReminder` rows (status `'pending'`), ordered ascending by
/// `remind_at`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list_due(
    pool: &SqlitePool,
    now: i64,
) -> Result<Vec<FollowUpReminder>, AppDbError> {
    sqlx::query_as::<_, FollowUpReminder>(
        "SELECT * FROM follow_up_reminders WHERE status = 'pending' AND remind_at <= ? ORDER BY remind_at ASC",
    )
    .bind(now)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single follow-up reminder by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the follow-up reminder's primary key.
///
/// # Returns
/// The full `FollowUpReminder` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `FollowUpReminder with id '<id>' not found` when no reminder matches the
/// key. Returns `AppDbError::Database` for other query failures.
///
/// # SQL safety
/// The `id` is bound as a parameter (`?`); it is never interpolated into the
/// SQL string.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<FollowUpReminder, AppDbError> {
    let opt = sqlx::query_as::<_, FollowUpReminder>("SELECT * FROM follow_up_reminders WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "FollowUpReminder")
}

/// Create a new follow-up reminder and return the full row.
///
/// Auto-generates `id` (UUID v4), sets `status = 'pending'`, and `created_at`
/// to the current epoch second.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
/// - `thread_id` — the thread this reminder is attached to.
/// - `message_id` — the message this reminder is attached to.
/// - `remind_at` — epoch second at which the reminder becomes due.
///
/// # Returns
/// The newly created `FollowUpReminder` row with server-assigned `id` and
/// `created_at`.
///
/// # Errors
/// Returns `AppDbError::Database` on constraint violations or query failures
/// (e.g. an unknown `company_id`/`thread_id` foreign key). Never returns
/// `NotFound`.
///
/// # SQL safety
/// All input fields are bound as positional parameters (`?`); only `status`
/// and `created_at` are constants in the SQL.
pub async fn create(
    pool: &SqlitePool,
    company_id: &str,
    thread_id: &str,
    message_id: &str,
    remind_at: i64,
) -> Result<FollowUpReminder, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, FollowUpReminder>(
        r#"
        INSERT INTO follow_up_reminders (id, company_id, thread_id, message_id, remind_at, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(thread_id)
    .bind(message_id)
    .bind(remind_at)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update the status of a follow-up reminder.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the follow-up reminder's primary key.
/// - `status` — new status value (e.g. `"completed"`, `"cancelled"`).
///
/// # Returns
/// `Ok(())` when the row exists and was updated.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `FollowUpReminder with id '<id>' not found` when no reminder matches the
/// key (i.e. zero rows were affected). Returns `AppDbError::Database` for
/// other query failures.
///
/// # SQL safety
/// Both the `status` value and the `id` are bound as parameters (`?`); neither
/// is interpolated into the SQL string.
pub async fn update_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query("UPDATE follow_up_reminders SET status = ? WHERE id = ?")
        .bind(status)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("FollowUpReminder with id '{id}' not found")));
    }
    Ok(())
}

/// Delete a follow-up reminder by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the follow-up reminder's primary key.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `FollowUpReminder with id '<id>' not found` when no row matches the key
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
        format!("DELETE FROM follow_up_reminders WHERE id = '{id}'"),
        id,
        "FollowUpReminder",
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    /// Seed a company and a thread so FK constraints on follow_up_reminders are satisfied.
    async fn seed_account_and_thread(pool: &sqlx::SqlitePool, company_id: &str, thread_id: &str) {
        helpers::insert_test_account(pool, company_id).await;
        sqlx::query(
            "INSERT INTO threads (id, company_id, subject) VALUES (?, ?, ?)",
        )
        .bind(thread_id)
        .bind(company_id)
        .bind("test-thread")
        .execute(pool)
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn test_create_and_list() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acc-fu-1";
        seed_account_and_thread(&pool, company_id, "thread-fu-1").await;
        let remind_at = chrono::Utc::now().timestamp() + 3600;

        let reminder = create(&pool, company_id, "thread-fu-1", "msg-1", remind_at)
            .await
            .unwrap();

        assert_eq!(reminder.company_id, company_id);
        assert_eq!(reminder.thread_id, "thread-fu-1");
        assert_eq!(reminder.message_id, "msg-1");
        assert_eq!(reminder.remind_at, remind_at);
        assert_eq!(reminder.status, "pending");

        let items = list(&pool, company_id, None).await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, reminder.id);
    }

    #[tokio::test]
    async fn test_list_with_status_filter() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acc-fu-2";
        seed_account_and_thread(&pool, company_id, "t1").await;
        let now = chrono::Utc::now().timestamp();

        create(&pool, company_id, "t1", "m1", now + 3600)
            .await
            .unwrap();
        let r2 = create(&pool, company_id, "t1", "m2", now + 7200)
            .await
            .unwrap();
        update_status(&pool, &r2.id, "completed").await.unwrap();

        let pending = list(&pool, company_id, Some("pending")).await.unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].thread_id, "t1");
    }

    #[tokio::test]
    async fn test_list_due() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acc-fu-3";
        seed_account_and_thread(&pool, company_id, "t1").await;
        let now = chrono::Utc::now().timestamp();

        create(&pool, company_id, "t1", "m1", now - 100)
            .await
            .unwrap();
        create(&pool, company_id, "t1", "m2", now + 9999)
            .await
            .unwrap();
        create(&pool, company_id, "t1", "m3", now - 50)
            .await
            .unwrap();

        let due = list_due(&pool, now).await.unwrap();
        assert!(due.len() >= 2);
        assert!(
            due.iter()
                .all(|r| r.remind_at <= now && r.status == "pending")
        );
    }

    #[tokio::test]
    async fn test_get_by_id() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acc-fu-4";
        seed_account_and_thread(&pool, company_id, "t1").await;
        let now = chrono::Utc::now().timestamp();
        let reminder = create(&pool, company_id, "t1", "m1", now + 3600)
            .await
            .unwrap();

        let found = get_by_id(&pool, &reminder.id).await.unwrap();
        assert_eq!(found.id, reminder.id);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_update_status() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acc-fu-5";
        seed_account_and_thread(&pool, company_id, "t1").await;
        let now = chrono::Utc::now().timestamp();
        let reminder = create(&pool, company_id, "t1", "m1", now + 3600)
            .await
            .unwrap();

        update_status(&pool, &reminder.id, "completed").await.unwrap();
        let updated = get_by_id(&pool, &reminder.id).await.unwrap();
        assert_eq!(updated.status, "completed");
    }

    #[tokio::test]
    async fn test_update_status_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = update_status(&pool, "nonexistent", "completed")
            .await
            .unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acc-fu-6";
        seed_account_and_thread(&pool, company_id, "t1").await;
        let now = chrono::Utc::now().timestamp();
        let reminder = create(&pool, company_id, "t1", "m1", now + 3600)
            .await
            .unwrap();
        delete(&pool, &reminder.id).await.unwrap();
        let err = get_by_id(&pool, &reminder.id).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = delete(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
