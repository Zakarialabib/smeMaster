// ── Attachments query functions ─────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use crate::db::error::AppDbError;
use crate::db::mail::schema::Attachment;

/// Retrieve all attachments for a given message.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `message_id` — the parent message's primary key.
///
/// # Returns
/// Every `Attachment` row for the message, ordered ascending by `filename`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `message_id` is bound as a parameter (`?`); only the `ORDER BY` column is
/// a constant.
pub async fn get_by_message(
    pool: &SqlitePool,
    message_id: &str,
) -> Result<Vec<Attachment>, AppDbError> {
    sqlx::query_as::<_, Attachment>(
        "SELECT * FROM attachments WHERE message_id = ? ORDER BY filename ASC",
    )
    .bind(message_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single attachment by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the attachment's primary key.
///
/// # Returns
/// `Some(Attachment)` when found, `None` when no row matches.
///
/// # Errors
/// Never returns `AppDbError::NotFound`; a missing row is `Ok(None)`. Other
/// failures surface as `AppDbError::Database`.
///
/// # SQL safety
/// `id` is bound as a parameter (`?`).
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<Attachment>, AppDbError> {
    sqlx::query_as::<_, Attachment>("SELECT * FROM attachments WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Insert a new attachment row.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `attachment` — the fully-populated `Attachment` to insert.
///
/// # Returns
/// `Ok(())` once the row is inserted.
///
/// # Errors
/// Returns `AppDbError::Database` on insert failure (e.g. a constraint
/// violation or FK error).
///
/// # SQL safety
/// Every field of `attachment` is bound as a positional parameter (`?`).
pub async fn create(pool: &SqlitePool, attachment: &Attachment) -> Result<(), AppDbError> {
    sqlx::query(
        r#"
        INSERT INTO attachments (
            id, message_id, account_id,
            filename, mime_type, size,
            gmail_attachment_id, content_id, is_inline,
            local_path, cached_at, cache_size,
            imap_part_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&attachment.id)
    .bind(&attachment.message_id)
    .bind(&attachment.account_id)
    .bind(&attachment.filename)
    .bind(&attachment.mime_type)
    .bind(attachment.size)
    .bind(&attachment.gmail_attachment_id)
    .bind(&attachment.content_id)
    .bind(attachment.is_inline)
    .bind(&attachment.local_path)
    .bind(attachment.cached_at)
    .bind(attachment.cache_size)
    .bind(&attachment.imap_part_id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Update the `local_path` and `cached_at` fields after a file has been
/// saved to disk.
///
/// `cached_at` is set to the current epoch timestamp.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the attachment's primary key.
/// - `local_path` — filesystem path where the attachment body is cached.
///
/// # Returns
/// `Ok(())` once the row is updated.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `local_path`, `cached_at`, and `id` are all bound as parameters (`?`).
pub async fn update_local_path(
    pool: &SqlitePool,
    id: &str,
    local_path: &str,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "UPDATE attachments SET local_path = ?, cached_at = ? WHERE id = ?",
    )
    .bind(local_path)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

// ── Response types ─────────────────────────────────────────────────────────

/// Attachment row enriched with message context (from a JOIN to `messages`).
///
/// Extends the base `Attachment` columns with denormalized sender/thread
/// fields pulled from the parent message.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct AttachmentWithContext {
    /// Attachment primary key.
    pub id: String,
    /// Parent message primary key.
    pub message_id: String,
    /// Owning account primary key.
    pub account_id: String,
    /// Original filename, if any.
    pub filename: Option<String>,
    /// MIME type of the attachment.
    pub mime_type: Option<String>,
    /// Size in bytes.
    pub size: Option<i64>,
    /// Gmail-specific attachment id (for cloud fetch).
    pub gmail_attachment_id: Option<String>,
    /// Content-id used for inline (`cid:`) references.
    pub content_id: Option<String>,
    /// `1` if the attachment is inline, `0` otherwise.
    pub is_inline: i64,
    /// Local filesystem path where the body is cached.
    pub local_path: Option<String>,
    /// Epoch timestamp when the body was cached.
    pub cached_at: Option<i64>,
    /// Size of the cached body in bytes.
    pub cache_size: Option<i64>,
    /// IMAP body-part identifier.
    pub imap_part_id: Option<String>,
    /// Sender address of the parent message.
    pub from_address: Option<String>,
    /// Sender display name of the parent message.
    pub from_name: Option<String>,
    /// Send date (epoch) of the parent message.
    pub date: Option<i64>,
    /// Subject of the parent message.
    pub subject: Option<String>,
    /// Thread id of the parent message.
    pub thread_id: Option<String>,
}

/// A sender along with the number of attachments they sent in the account.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct AttachmentSender {
    /// Sender email address (grouping key).
    pub from_address: String,
    /// Sender display name, if known.
    pub from_name: Option<String>,
    /// Number of matching attachments from this sender.
    pub count: i64,
}

// ── Query functions ────────────────────────────────────────────────────────

/// Insert or replace an attachment row.
///
/// Uses `ON CONFLICT(id) DO UPDATE` so a re-upload merges rather than fails;
/// `is_inline` and any `COALESCE` columns keep their existing value when the
/// new value is `NULL`.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `attachment` — the `Attachment` to upsert.
///
/// # Returns
/// `Ok(())` once the row is inserted or merged.
///
/// # Errors
/// Returns `AppDbError::Database` on failure.
///
/// # SQL safety
/// Every field is bound as a positional parameter (`?`).
pub async fn upsert_attachment(
    pool: &SqlitePool,
    attachment: &Attachment,
) -> Result<(), AppDbError> {
    sqlx::query(
        r#"
        INSERT INTO attachments (
            id, message_id, account_id,
            filename, mime_type, size,
            gmail_attachment_id, content_id, is_inline,
            local_path, cached_at, cache_size,
            imap_part_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            filename           = COALESCE(EXCLUDED.filename, attachments.filename),
            mime_type          = COALESCE(EXCLUDED.mime_type, attachments.mime_type),
            size               = COALESCE(EXCLUDED.size, attachments.size),
            gmail_attachment_id = COALESCE(EXCLUDED.gmail_attachment_id, attachments.gmail_attachment_id),
            content_id         = COALESCE(EXCLUDED.content_id, attachments.content_id),
            is_inline          = EXCLUDED.is_inline,
            local_path         = COALESCE(EXCLUDED.local_path, attachments.local_path),
            cached_at          = COALESCE(EXCLUDED.cached_at, attachments.cached_at),
            cache_size         = COALESCE(EXCLUDED.cache_size, attachments.cache_size),
            imap_part_id       = COALESCE(EXCLUDED.imap_part_id, attachments.imap_part_id)
        "#,
    )
    .bind(&attachment.id)
    .bind(&attachment.message_id)
    .bind(&attachment.account_id)
    .bind(&attachment.filename)
    .bind(&attachment.mime_type)
    .bind(attachment.size)
    .bind(&attachment.gmail_attachment_id)
    .bind(&attachment.content_id)
    .bind(attachment.is_inline)
    .bind(&attachment.local_path)
    .bind(attachment.cached_at)
    .bind(attachment.cache_size)
    .bind(&attachment.imap_part_id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Get attachments for an account, joined with message context.
///
/// Filters out inline-only and unnamed attachments.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `limit` — maximum number of rows to return.
/// - `offset` — number of rows to skip (for pagination).
///
/// # Returns
/// `Vec<AttachmentWithContext>` ordered by the parent message date, descending.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id`, `limit`, and `offset` are bound as parameters (`?`); the
/// column/table names are constants.
pub async fn get_by_account(
    pool: &SqlitePool,
    account_id: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<AttachmentWithContext>, AppDbError> {
    sqlx::query_as::<_, AttachmentWithContext>(
        "SELECT a.*, m.from_address, m.from_name, m.date, m.subject, m.thread_id \
         FROM attachments a \
         JOIN messages m ON a.message_id = m.id AND a.account_id = m.account_id \
         WHERE a.account_id = ? AND a.filename IS NOT NULL AND a.filename != '' \
         ORDER BY m.date DESC \
         LIMIT ? OFFSET ?",
    )
    .bind(account_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get attachment senders grouped by `from_address`, ordered by count DESC.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
///
/// # Returns
/// `Vec<AttachmentSender>` (from_address + message count), most-attachments
/// first.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// Only `account_id` is bound as a parameter (`?`); the `GROUP BY`/`ORDER BY`
/// expressions are constants.
pub async fn get_senders(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<AttachmentSender>, AppDbError> {
    sqlx::query_as::<_, AttachmentSender>(
        "SELECT m.from_address, m.from_name, COUNT(*) as count \
         FROM attachments a \
         JOIN messages m ON a.message_id = m.id AND a.account_id = m.account_id \
         WHERE a.account_id = ? AND a.filename IS NOT NULL AND a.filename != '' \
           AND m.from_address IS NOT NULL \
         GROUP BY m.from_address \
         ORDER BY count DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_migrations;
    use sqlx::SqlitePool;

    async fn create_test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    async fn seed_account(pool: &SqlitePool, id: &str, email: &str) {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT INTO accounts (id, email, provider, auth_method, metadata_json, created_at, updated_at) VALUES (?, ?, 'imap', 'password', '{}', ?, ?)",
        )
        .bind(id)
        .bind(email)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();
    }

    async fn seed_thread(pool: &SqlitePool, account_id: &str, thread_id: &str) {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT INTO threads (id, account_id, subject, message_count, is_read, is_starred, is_important, has_attachments, is_snoozed, metadata_json) VALUES (?, ?, 'Attachment Thread', 1, 0, 0, 0, 0, 0, '{}')",
        )
        .bind(thread_id)
        .bind(account_id)
        .execute(pool)
        .await
        .unwrap();
        sqlx::query("UPDATE threads SET last_message_at = ? WHERE id = ?")
            .bind(now)
            .bind(thread_id)
            .execute(pool)
            .await
            .unwrap();
    }

    async fn seed_message(pool: &SqlitePool, account_id: &str, msg_id: &str, thread_id: &str) {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT INTO messages (id, account_id, thread_id, from_address, subject, date, is_read, is_starred) VALUES (?, ?, ?, 'attach@test.com', 'Attach Test', ?, 0, 0)",
        )
        .bind(msg_id)
        .bind(account_id)
        .bind(thread_id)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();
    }

    fn make_attachment(id: &str, message_id: &str, account_id: &str) -> Attachment {
        Attachment {
            id: id.to_string(),
            message_id: message_id.to_string(),
            account_id: account_id.to_string(),
            filename: Some("report.pdf".to_string()),
            mime_type: Some("application/pdf".to_string()),
            size: Some(1024),
            gmail_attachment_id: Some("gmail_attach_1".to_string()),
            content_id: None,
            is_inline: 0,
            local_path: None,
            cached_at: None,
            cache_size: None,
            imap_part_id: Some("1.2".to_string()),
        }
    }

    #[tokio::test]
    async fn test_create_and_get_by_id() {
        let pool = create_test_pool().await;
        let account_id = "acc_att_1";
        let thread_id = "thread_att_1";
        let msg_id = "msg_att_1";
        seed_account(&pool, account_id, "att1@example.com").await;
        seed_thread(&pool, account_id, thread_id).await;
        seed_message(&pool, account_id, msg_id, thread_id).await;

        let attachment = make_attachment("att_1", msg_id, account_id);
        create(&pool, &attachment).await.unwrap();

        let fetched = get_by_id(&pool, "att_1").await.unwrap().unwrap();
        assert_eq!(fetched.filename.as_deref(), Some("report.pdf"));
        assert_eq!(fetched.mime_type.as_deref(), Some("application/pdf"));
        assert_eq!(fetched.size, Some(1024));
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = create_test_pool().await;
        let result = get_by_id(&pool, "nonexistent").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_by_message() {
        let pool = create_test_pool().await;
        let account_id = "acc_att_2";
        let thread_id = "thread_att_2";
        let msg_id = "msg_att_2";
        seed_account(&pool, account_id, "att2@example.com").await;
        seed_thread(&pool, account_id, thread_id).await;
        seed_message(&pool, account_id, msg_id, thread_id).await;

        let att1 = make_attachment("att_2a", msg_id, account_id);
        create(&pool, &att1).await.unwrap();
        let att2 = Attachment {
            id: "att_2b".to_string(),
            filename: Some("image.png".to_string()),
            mime_type: Some("image/png".to_string()),
            size: Some(2048),
            ..make_attachment("att_2b", msg_id, account_id)
        };
        create(&pool, &att2).await.unwrap();

        let attachments = get_by_message(&pool, msg_id).await.unwrap();
        assert_eq!(attachments.len(), 2);
        assert!(attachments.iter().any(|a| a.filename.as_deref() == Some("report.pdf")));
        assert!(attachments.iter().any(|a| a.filename.as_deref() == Some("image.png")));
    }

    #[tokio::test]
    async fn test_update_local_path() {
        let pool = create_test_pool().await;
        let account_id = "acc_att_3";
        let thread_id = "thread_att_3";
        let msg_id = "msg_att_3";
        seed_account(&pool, account_id, "att3@example.com").await;
        seed_thread(&pool, account_id, thread_id).await;
        seed_message(&pool, account_id, msg_id, thread_id).await;

        let attachment = make_attachment("att_3", msg_id, account_id);
        create(&pool, &attachment).await.unwrap();

        update_local_path(&pool, "att_3", "/tmp/report.pdf")
            .await
            .unwrap();

        let updated = get_by_id(&pool, "att_3").await.unwrap().unwrap();
        assert_eq!(updated.local_path.as_deref(), Some("/tmp/report.pdf"));
        assert!(updated.cached_at.is_some());
    }
}
