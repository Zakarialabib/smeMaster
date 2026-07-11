//! `local_drafts` table data-access layer.
//!
//! CRUD/upsert helpers for the `local_drafts` table (composer drafts cached
//! locally before sync). Functions are async, take a `&SqlitePool`, and return
//! `Result<_, AppDbError>`. Account-scoped lookups/deletes take an `account_id`;
//! single-row operations return `AppDbError::NotFound` when the row is missing.
//! All operations return `AppDbError::Database` on SQL failure.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::LocalDraft;

/// List local drafts for an account, most recently updated first.
///
/// * `account_id` — owning account.
/// * Returns the matching `LocalDraft` rows.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<LocalDraft>, AppDbError> {
    sqlx::query_as::<_, LocalDraft>(
        "SELECT * FROM local_drafts WHERE account_id = ? ORDER BY updated_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single local draft by id within an account.
///
/// * `id` — primary key of the draft.
/// * `account_id` — owning account (scopes the lookup).
/// * Returns the matching `LocalDraft`.
/// * Errors: `AppDbError::NotFound` when no such draft exists for the account;
///   `AppDbError::Database` on SQL failure.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<LocalDraft, AppDbError> {
    sqlx::query_as::<_, LocalDraft>(
        "SELECT * FROM local_drafts WHERE id = ? AND account_id = ?",
    )
    .bind(id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Local draft {} not found", id)))
}

/// Fetch a local draft by its remote (server) draft id within an account.
///
/// * `remote_draft_id` — server-side draft id to match.
/// * `account_id` — owning account (scopes the lookup).
/// * Returns `Some(LocalDraft)` when found, `None` when absent.
/// * Errors: `AppDbError::Database` on SQL failure (never `NotFound`).
pub async fn get_by_remote_id(
    pool: &SqlitePool,
    remote_draft_id: &str,
    account_id: &str,
) -> Result<Option<LocalDraft>, AppDbError> {
    sqlx::query_as::<_, LocalDraft>(
        "SELECT * FROM local_drafts WHERE remote_draft_id = ? AND account_id = ?",
    )
    .bind(remote_draft_id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Insert or update a local draft.
///
/// If `data.id` is non-empty and a row with that id exists for the account,
/// the draft is updated. Otherwise a new row is inserted with a generated UUID.
///
/// * `account_id` — owning account (used when inserting and to scope updates).
/// * `data` — draft fields; `data.id` selects an existing row when non-empty.
/// * Returns the inserted or updated `LocalDraft`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn upsert(
    pool: &SqlitePool,
    account_id: &str,
    data: &LocalDraft,
) -> Result<LocalDraft, AppDbError> {
    let now = chrono::Utc::now().timestamp();

    // If an id was provided, try an update first.
    if !data.id.is_empty() {
        let updated = sqlx::query_as::<_, LocalDraft>(
            r#"UPDATE local_drafts SET
                to_addresses = ?, cc_addresses = ?, bcc_addresses = ?,
                subject = ?, body_html = ?, reply_to_message_id = ?,
                thread_id = ?, from_email = ?, signature_id = ?,
                remote_draft_id = ?, attachments = ?, sync_status = ?,
                updated_at = ?
            WHERE id = ? AND account_id = ? RETURNING *"#,
        )
        .bind(&data.to_addresses)
        .bind(&data.cc_addresses)
        .bind(&data.bcc_addresses)
        .bind(&data.subject)
        .bind(&data.body_html)
        .bind(&data.reply_to_message_id)
        .bind(&data.thread_id)
        .bind(&data.from_email)
        .bind(&data.signature_id)
        .bind(&data.remote_draft_id)
        .bind(&data.attachments)
        .bind(&data.sync_status)
        .bind(now)
        .bind(&data.id)
        .bind(account_id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;

        if let Some(draft) = updated {
            return Ok(draft);
        }
    }

    // No id or no row matched — insert a new draft.
    let id = if data.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        data.id.clone()
    };

    sqlx::query_as::<_, LocalDraft>(
        r#"INSERT INTO local_drafts (
            id, account_id, to_addresses, cc_addresses, bcc_addresses,
            subject, body_html, reply_to_message_id, thread_id,
            from_email, signature_id, remote_draft_id, attachments,
            sync_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(&data.to_addresses)
    .bind(&data.cc_addresses)
    .bind(&data.bcc_addresses)
    .bind(&data.subject)
    .bind(&data.body_html)
    .bind(&data.reply_to_message_id)
    .bind(&data.thread_id)
    .bind(&data.from_email)
    .bind(&data.signature_id)
    .bind(&data.remote_draft_id)
    .bind(&data.attachments)
    .bind(&data.sync_status)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete a local draft by id and account.
///
/// * `id` — primary key of the draft.
/// * `account_id` — owning account (scopes the delete).
/// * Returns `()` on success.
/// * Errors: `AppDbError::NotFound` when no matching row exists (0 rows
///   affected); `AppDbError::Database` on SQL failure.
pub async fn delete(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<(), AppDbError> {
    let result = sqlx::query("DELETE FROM local_drafts WHERE id = ? AND account_id = ?")
        .bind(id)
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    if result.rows_affected() == 0 {
        return Err(AppDbError::NotFound(format!("Local draft {} not found", id)));
    }
    Ok(())
}

/// Fetch a local draft by id, returning `None` rather than an error if absent.
///
/// * `id` — primary key of the draft.
/// * Returns `Some(LocalDraft)` when found, `None` when absent.
/// * Errors: `AppDbError::Database` on SQL failure (never `NotFound`).
pub async fn get_by_id_opt(pool: &SqlitePool, id: &str) -> Result<Option<LocalDraft>, AppDbError> {
    sqlx::query_as::<_, LocalDraft>("SELECT * FROM local_drafts WHERE id = ?")
        .bind(id).fetch_optional(pool).await.map_err(AppDbError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    fn make_draft(account_id: &str) -> LocalDraft {
        LocalDraft {
            id: String::new(),
            account_id: account_id.to_string(),
            to_addresses: Some("recipient@example.com".to_string()),
            cc_addresses: None,
            bcc_addresses: None,
            subject: Some("Test Subject".to_string()),
            body_html: Some("<p>Hello</p>".to_string()),
            reply_to_message_id: None,
            thread_id: None,
            from_email: Some("me@example.com".to_string()),
            signature_id: None,
            remote_draft_id: None,
            attachments: None,
            sync_status: "pending".to_string(),
            created_at: 0,
            updated_at: 0,
        }
    }

    #[tokio::test]
    async fn test_upsert_insert() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let data = make_draft("acct_1");
        let created = upsert(&pool, "acct_1", &data).await.unwrap();
        assert!(!created.id.is_empty());
        assert_eq!(created.subject, Some("Test Subject".to_string()));
        assert_eq!(created.account_id, "acct_1");
    }

    #[tokio::test]
    async fn test_upsert_update() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut created = upsert(&pool, "acct_1", &make_draft("acct_1")).await.unwrap();
        created.subject = Some("Updated Subject".to_string());
        let updated = upsert(&pool, "acct_1", &created).await.unwrap();
        assert_eq!(updated.subject, Some("Updated Subject".to_string()));
        assert_eq!(updated.id, created.id);
    }

    #[tokio::test]
    async fn test_list_drafts() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        upsert(&pool, "acct_1", &make_draft("acct_1")).await.unwrap();
        upsert(&pool, "acct_1", &make_draft("acct_1")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_list_drafts_scoped() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        helpers::insert_test_account(&pool, "acct_2").await;
        upsert(&pool, "acct_1", &make_draft("acct_1")).await.unwrap();
        upsert(&pool, "acct_2", &make_draft("acct_2")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[tokio::test]
    async fn test_get_by_id_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = upsert(&pool, "acct_1", &make_draft("acct_1")).await.unwrap();
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
    async fn test_get_by_remote_id_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut data = make_draft("acct_1");
        data.remote_draft_id = Some("remote_123".to_string());
        let created = upsert(&pool, "acct_1", &data).await.unwrap();
        let fetched = get_by_remote_id(&pool, "remote_123", "acct_1").await.unwrap();
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().id, created.id);
    }

    #[tokio::test]
    async fn test_get_by_remote_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_by_remote_id(&pool, "nonexistent_remote", "acct_1").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_delete_draft() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = upsert(&pool, "acct_1", &make_draft("acct_1")).await.unwrap();
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
