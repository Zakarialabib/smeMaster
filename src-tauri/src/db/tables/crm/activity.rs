//! Unified contact activity-feed query functions.
//!
//! Provides a single time-ordered activity feed for a contact, combining
//! emails, tasks, and calendar events. Functions are async and return
//! `Result<_, AppDbError>`.

// ── Activity query functions ───────────────────────────────────────────────────
//
// Provides a unified activity feed for a contact across emails, tasks,
// and calendar events.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::contacts::schema::ActivityEvent;

/// Get a unified activity feed for a contact by email.
///
/// # Parameters
/// - `account_id`: the account scope; every leg of the `UNION ALL` is filtered
///   to this account.
/// - `email`: the contact's email used to match emails, tasks, and calendar
///   events.
/// - `limit`: maximum number of events returned.
///
/// # Returns
/// A `Vec<ActivityEvent>` combining `email`, `task`, and `calendar` events in a
/// single `date DESC` ordered list, possibly empty.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_contact_activity(
    pool: &SqlitePool,
    account_id: &str,
    email: &str,
    limit: i64,
) -> Result<Vec<ActivityEvent>, AppDbError> {
    sqlx::query_as::<_, ActivityEvent>(
        r#"
        SELECT 'email' as event_type, m.date, COALESCE(m.subject, '(no subject)') as summary, m.id
        FROM messages m
        WHERE m.account_id = ? AND m.from_address = ?
        UNION ALL
        SELECT 'task' as event_type, t.created_at as date, t.title as summary, t.id
        FROM tasks t
        WHERE t.company_id = ? AND t.contact_id = ?
        UNION ALL
        SELECT 'calendar' as event_type, ce.start_time as date, COALESCE(ce.summary, '(no title)') as summary, ce.id
        FROM calendar_events ce
        WHERE ce.company_id = ? AND ce.organizer_email = ?
        ORDER BY date DESC
        LIMIT ?
        "#,
    )
    .bind(account_id)
    .bind(email)
    .bind(account_id)
    .bind(email)
    .bind(account_id)
    .bind(email)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_get_contact_activity() {
        let pool = helpers::create_memory_pool().await;
        let now = chrono::Utc::now().timestamp();

        // FK: messages.account_id → accounts, messages.(account_id, thread_id) → threads
        helpers::insert_test_account(&pool, "acct-1").await;
        sqlx::query(
            "INSERT INTO threads (id, account_id, subject, message_count) VALUES (?, ?, ?, ?)",
        )
        .bind("thread-1")
        .bind("acct-1")
        .bind("Test Thread")
        .bind(1)
        .execute(&pool)
        .await
        .unwrap();

        // Insert a contact
        helpers::insert_test_contact(&pool, "act-contact").await;

        // Insert a message
        sqlx::query(
            "INSERT INTO messages (id, account_id, thread_id, from_address, subject, date, is_read, is_starred) \
             VALUES ('msg-1', 'acct-1', 'thread-1', 'activity@example.com', 'Hello World', ?, 0, 0)",
        )
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        // Insert a task
        sqlx::query(
            "INSERT INTO tasks (id, account_id, title, priority, is_completed, sort_order, tags_json, created_at, updated_at) \
             VALUES ('task-1', 'acct-1', 'Test Task', 'medium', 0, 0, '[]', ?, ?)",
        )
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        // Activity should return the email (task has no contact_id match)
        let activity = get_contact_activity(&pool, "acct-1", "activity@example.com", 10)
            .await
            .unwrap();
        assert!(!activity.is_empty(), "should have at least the email event");
        assert_eq!(activity[0].event_type, "email");
        assert_eq!(activity[0].summary, "Hello World");
    }
}
