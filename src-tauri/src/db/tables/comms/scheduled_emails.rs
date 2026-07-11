//! `scheduled_emails` table data-access layer.
//!
//! CRUD helpers for the `scheduled_emails` table (emails queued to send later).
//! Functions are async, take a `&SqlitePool`, and return `Result<_, AppDbError>`.
//! Account-scoped lookups/updates/deletes take an `account_id`; single-row
//! operations return `AppDbError::NotFound` when the row is missing. All
//! operations return `AppDbError::Database` on SQL failure.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::ScheduledEmail;

/// List every pending scheduled email whose `scheduled_at` is now or in the
/// past, across all accounts (used by the send worker).
///
/// * Returns the due `ScheduledEmail` rows ordered by `scheduled_at`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list_pending_all(pool: &SqlitePool) -> Result<Vec<ScheduledEmail>, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, ScheduledEmail>(
        "SELECT * FROM scheduled_emails WHERE status = 'pending' AND scheduled_at <= ? ORDER BY scheduled_at ASC"
    )
    .bind(now)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List scheduled emails for an account, ordered by `scheduled_at` ascending.
///
/// * `account_id` — owning account.
/// * Returns the matching `ScheduledEmail` rows.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<ScheduledEmail>, AppDbError> {
    sqlx::query_as::<_, ScheduledEmail>(
        "SELECT * FROM scheduled_emails WHERE account_id = ? ORDER BY scheduled_at ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List pending scheduled emails for an account that are due now or earlier.
///
/// * `account_id` — owning account.
/// * Returns the due `ScheduledEmail` rows ordered by `scheduled_at`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list_pending(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<ScheduledEmail>, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, ScheduledEmail>(
        "SELECT * FROM scheduled_emails WHERE account_id = ? AND status = 'pending' AND scheduled_at <= ? ORDER BY scheduled_at ASC",
    )
    .bind(account_id)
    .bind(now)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single scheduled email by id within an account.
///
/// * `id` — primary key of the scheduled email.
/// * `account_id` — owning account (scopes the lookup).
/// * Returns the matching `ScheduledEmail`.
/// * Errors: `AppDbError::NotFound` when no such email exists for the account;
///   `AppDbError::Database` on SQL failure.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<ScheduledEmail, AppDbError> {
    sqlx::query_as::<_, ScheduledEmail>(
        "SELECT * FROM scheduled_emails WHERE id = ? AND account_id = ?",
    )
    .bind(id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Scheduled email {} not found", id)))
}

/// Insert a new scheduled email, generating its `id` and `created_at`.
///
/// * `data` — email fields (`id`/`created_at` overwritten by the database).
/// * Returns the newly created `ScheduledEmail`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn create(
    pool: &SqlitePool,
    data: &ScheduledEmail,
) -> Result<ScheduledEmail, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, ScheduledEmail>(
        r#"INSERT INTO scheduled_emails (
            id, account_id, to_addresses, cc_addresses, bcc_addresses,
            subject, body_html, reply_to_message_id, thread_id,
            scheduled_at, signature_id, attachment_paths, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"#,
    )
    .bind(&id)
    .bind(&data.account_id)
    .bind(&data.to_addresses)
    .bind(&data.cc_addresses)
    .bind(&data.bcc_addresses)
    .bind(&data.subject)
    .bind(&data.body_html)
    .bind(&data.reply_to_message_id)
    .bind(&data.thread_id)
    .bind(data.scheduled_at)
    .bind(&data.signature_id)
    .bind(&data.attachment_paths)
    .bind(&data.status)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Set the `status` of a scheduled email by id and account.
///
/// * `id` — primary key of the scheduled email.
/// * `account_id` — owning account (scopes the update).
/// * `status` — new status string (e.g. `"sent"`).
/// * Returns the updated `ScheduledEmail`.
/// * Errors: `AppDbError::NotFound` when no matching email exists;
///   `AppDbError::Database` on SQL failure.
pub async fn update_status(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
    status: &str,
) -> Result<ScheduledEmail, AppDbError> {
    sqlx::query_as::<_, ScheduledEmail>(
        r#"UPDATE scheduled_emails SET status = ?
        WHERE id = ? AND account_id = ? RETURNING *"#,
    )
    .bind(status)
    .bind(id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Scheduled email {} not found", id)))
}

/// Delete a scheduled email by id and account.
///
/// * `id` — primary key of the scheduled email.
/// * `account_id` — owning account (scopes the delete).
/// * Returns `()` on success.
/// * Errors: `AppDbError::NotFound` when no matching row exists (0 rows
///   affected); `AppDbError::Database` on SQL failure.
pub async fn delete(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<(), AppDbError> {
    let result = sqlx::query("DELETE FROM scheduled_emails WHERE id = ? AND account_id = ?")
        .bind(id)
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    if result.rows_affected() == 0 {
        return Err(AppDbError::NotFound(format!(
            "Scheduled email {} not found",
            id
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    fn make_scheduled(account_id: &str) -> ScheduledEmail {
        ScheduledEmail {
            id: String::new(),
            account_id: account_id.to_string(),
            to_addresses: "recipient@example.com".to_string(),
            cc_addresses: None,
            bcc_addresses: None,
            subject: Some("Scheduled Email".to_string()),
            body_html: "<p>Body</p>".to_string(),
            reply_to_message_id: None,
            thread_id: None,
            scheduled_at: chrono::Utc::now().timestamp() + 3600,
            signature_id: None,
            attachment_paths: None,
            status: "pending".to_string(),
            created_at: 0,
        }
    }

    #[tokio::test]
    async fn test_create_scheduled() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let data = make_scheduled("acct_1");
        let created = create(&pool, &data).await.unwrap();
        assert!(!created.id.is_empty());
        assert_eq!(created.to_addresses, "recipient@example.com");
        assert_eq!(created.status, "pending");
    }

    #[tokio::test]
    async fn test_list_scheduled() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        create(&pool, &make_scheduled("acct_1")).await.unwrap();
        create(&pool, &make_scheduled("acct_1")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_list_scheduled_scoped() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        helpers::insert_test_account(&pool, "acct_2").await;
        create(&pool, &make_scheduled("acct_1")).await.unwrap();
        create(&pool, &make_scheduled("acct_2")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[tokio::test]
    async fn test_list_pending() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let past_schedule = {
            let mut s = make_scheduled("acct_1");
            s.scheduled_at = chrono::Utc::now().timestamp() - 60; // 1 minute ago
            s
        };
        create(&pool, &past_schedule).await.unwrap();
        // Future schedule should not appear
        create(&pool, &make_scheduled("acct_1")).await.unwrap();
        let pending = list_pending(&pool, "acct_1").await.unwrap();
        assert_eq!(pending.len(), 1);
    }

    #[tokio::test]
    async fn test_get_by_id_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_scheduled("acct_1")).await.unwrap();
        let fetched = get_by_id(&pool, &created.id, "acct_1").await.unwrap();
        assert_eq!(fetched.id, created.id);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_by_id(&pool, "nonexistent", "acct_1").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_status() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_scheduled("acct_1")).await.unwrap();
        let updated = update_status(&pool, &created.id, "acct_1", "sent").await.unwrap();
        assert_eq!(updated.status, "sent");
    }

    #[tokio::test]
    async fn test_update_status_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = update_status(&pool, "nonexistent", "acct_1", "sent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_scheduled() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_scheduled("acct_1")).await.unwrap();
        delete(&pool, &created.id, "acct_1").await.unwrap();
        let result = get_by_id(&pool, &created.id, "acct_1").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = delete(&pool, "nonexistent", "acct_1").await;
        assert!(result.is_err());
    }
}
