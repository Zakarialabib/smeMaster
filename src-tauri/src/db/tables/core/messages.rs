//! Messages table data-access layer.
//!
//! CRUD, partial-flag updates, and bulk helpers for the `messages` table.
//! Every function takes a `&SqlitePool` and returns `Result<_, AppDbError>`.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::Message;
use crate::commands::core::UpsertMessageRequest;

/// Fetch a single message by its composite primary key (account_id, id).
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `id` — the message's primary key.
///
/// # Returns
/// The matching `Message` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` when no message matches the `(account_id, id)`
/// pair.
///
/// # SQL safety
/// Both `account_id` and `id` are bound as parameters (`?`); they are never
/// interpolated into the SQL string.
pub async fn get_by_id(
    pool: &SqlitePool,
    account_id: &str,
    id: &str,
) -> Result<Message, AppDbError> {
    sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE account_id = ? AND id = ?",
    )
    .bind(account_id)
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| {
        AppDbError::NotFound(format!(
            "Message with account_id '{account_id}' and id '{id}' not found"
        ))
    })
}

/// Retrieve all messages belonging to a thread, ordered by date ascending.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `thread_id` — the parent thread's primary key.
///
/// # Returns
/// Every `Message` row for the thread, ordered ascending by `date`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id` and `thread_id` are bound as parameters (`?`); the `ORDER BY`
/// column is a constant.
pub async fn get_by_thread(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
) -> Result<Vec<Message>, AppDbError> {
    sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE account_id = ? AND thread_id = ? ORDER BY date ASC",
    )
    .bind(account_id)
    .bind(thread_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Insert-or-replace a single message.
///
/// Converts `Option<bool>` flags (`is_read`, `is_starred`) into `i64` for
/// SQLite storage.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `msg` — the `UpsertMessageRequest` describing the message.
///
/// # Returns
/// `Ok(())` once the row is inserted or replaced.
///
/// # Errors
/// Returns `AppDbError::Database` on failure (e.g. a constraint violation or
/// missing parent thread/account).
///
/// # SQL safety
/// Every field of `msg` is bound as a positional parameter (`?`).
pub async fn upsert(pool: &SqlitePool, msg: UpsertMessageRequest) -> Result<(), AppDbError> {
    sqlx::query(
        r#"
        INSERT OR REPLACE INTO messages (
            id, account_id, thread_id,
            from_address, from_name,
            to_addresses, cc_addresses, bcc_addresses, reply_to,
            subject, snippet, date,
            is_read, is_starred,
            body_html, body_text,
            message_id_header, references_header, in_reply_to_header,
            imap_uid, imap_folder,
            list_unsubscribe, list_unsubscribe_post,
            auth_results
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&msg.id)
    .bind(&msg.account_id)
    .bind(&msg.thread_id)
    .bind(&msg.from_address)
    .bind(&msg.from_name)
    .bind(&msg.to_addresses)
    .bind(&msg.cc_addresses)
    .bind(&msg.bcc_addresses)
    .bind(&msg.reply_to)
    .bind(&msg.subject)
    .bind(&msg.snippet)
    .bind(msg.date)
    .bind(msg.is_read.map(|v| if v { 1 } else { 0 }))
    .bind(msg.is_starred.map(|v| if v { 1 } else { 0 }))
    .bind(&msg.body_html)
    .bind(&msg.body_text)
    .bind(&msg.message_id_header)
    .bind(&msg.references_header)
    .bind(&msg.in_reply_to_header)
    .bind(msg.imap_uid)
    .bind(&msg.imap_folder)
    .bind(&msg.list_unsubscribe)
    .bind(&msg.list_unsubscribe_post)
    .bind(&msg.auth_results)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete a message by its composite primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `id` — the message's primary key.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` when no message matches the `(account_id, id)`
/// pair (zero rows affected).
///
/// # SQL safety
/// `account_id` and `id` are bound as parameters (`?`) on a plain `DELETE`
/// statement (no dynamic SQL).
pub async fn delete_by_id(
    pool: &SqlitePool,
    account_id: &str,
    id: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM messages WHERE account_id = ? AND id = ?")
        .bind(account_id)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "Message with account_id '{account_id}' and id '{id}' not found"
        )));
    }
    Ok(())
}

/// Toggle the `is_read` and/or `is_starred` flags on a message.
///
/// Only the `Some` fields are applied; `None` fields are left unchanged.
pub async fn update_flags(
    pool: &SqlitePool,
    message_id: &str,
    is_read: Option<bool>,
    is_starred: Option<bool>,
) -> Result<(), AppDbError> {
    let mut sets: Vec<&str> = Vec::new();
    if is_read.is_some() {
        sets.push("is_read");
    }
    if is_starred.is_some() {
        sets.push("is_starred");
    }

    if sets.is_empty() {
        return Ok(());
    }

    let set_sql = sets
        .iter()
        .map(|c| format!("\"{c}\" = ?"))
        .collect::<Vec<_>>()
        .join(", ");

    let sql = format!("UPDATE messages SET {set_sql} WHERE id = ?");

    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql));
    if let Some(v) = is_read {
        q = q.bind(if v { 1_i64 } else { 0_i64 });
    }
    if let Some(v) = is_starred {
        q = q.bind(if v { 1_i64 } else { 0_i64 });
    }
    q = q.bind(message_id);

    q.execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

/// Look up a message by its IMAP folder + UID.
///
/// Returns `None` (not an error) when no message matches.
pub async fn get_by_folder_and_uid(
    pool: &SqlitePool,
    account_id: &str,
    folder: &str,
    uid: i64,
) -> Result<Option<Message>, AppDbError> {
    sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE account_id = ? AND imap_folder = ? AND imap_uid = ?",
    )
    .bind(account_id)
    .bind(folder)
    .bind(uid)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Bulk-update the `thread_id` for a batch of messages.
///
/// When `message_ids` is empty the function returns immediately without
/// executing any SQL.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key (scopes the `WHERE` clause).
/// - `message_ids` — the message primary keys to re-parent.
/// - `thread_id` — the destination thread primary key.
///
/// # Returns
/// `Ok(())` once the batch update runs (or immediately when `message_ids` is
/// empty).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// The `IN (...)` list is built with `sqlx::QueryBuilder` using `push_bind`,
/// so every `message_id` is a bound parameter — nothing is interpolated.
pub async fn bulk_update_thread(
    pool: &SqlitePool,
    account_id: &str,
    message_ids: &[String],
    thread_id: &str,
) -> Result<(), AppDbError> {
    if message_ids.is_empty() {
        return Ok(());
    }

    use sqlx::QueryBuilder;
    let mut qb: QueryBuilder<sqlx::Sqlite> = QueryBuilder::new("UPDATE messages SET thread_id = ");
    qb.push_bind(thread_id);
    qb.push(" WHERE account_id = ");
    qb.push_bind(account_id);
    qb.push(" AND id IN (");
    let mut separated = qb.separated(", ");
    for id in message_ids {
        separated.push_bind(id);
    }
    qb.push(")");
    qb.build().execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete **all** messages belonging to an account.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
///
/// # Returns
/// The number of rows deleted (`u64`).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
///
/// # SQL safety
/// `account_id` is bound as a parameter (`?`).
pub async fn delete_all_for_account(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<u64, AppDbError> {
    let result = sqlx::query("DELETE FROM messages WHERE account_id = ?")
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(result.rows_affected())
}

/// Fetch recent sent messages from a given sender address.
///
/// Messages must have a non-null `body_text` longer than 50 characters
/// (i.e. they are real sent messages, not stubs).
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `from_address` — sender address to match (case-insensitive).
/// - `limit` — maximum number of rows to return.
///
/// # Returns
/// `Vec<Message>` ordered by `date` descending.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id`, `from_address`, and `limit` are bound as parameters (`?`);
/// the length threshold (`50`) is an inline constant.
pub async fn get_recent_sent(
    pool: &SqlitePool,
    account_id: &str,
    from_address: &str,
    limit: i64,
) -> Result<Vec<Message>, AppDbError> {
    sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE account_id = ? AND LOWER(from_address) = LOWER(?) \
         AND body_text IS NOT NULL AND LENGTH(body_text) > 50 \
         ORDER BY date DESC LIMIT ?",
    )
    .bind(account_id)
    .bind(from_address)
    .bind(limit)
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
            "INSERT INTO threads (id, account_id, subject, message_count, is_read, is_starred, is_important, has_attachments, is_snoozed, metadata_json) VALUES (?, ?, 'Test Subject', 1, 0, 0, 0, 0, 0, '{}')",
        )
        .bind(thread_id)
        .bind(account_id)
        .execute(pool)
        .await
        .unwrap();
        // Update last_message_at separately to avoid unixepoch() quirks
        sqlx::query("UPDATE threads SET last_message_at = ? WHERE id = ?")
            .bind(now)
            .bind(thread_id)
            .execute(pool)
            .await
            .unwrap();
    }

    fn make_upsert_msg_req(account_id: &str, msg_id: &str, thread_id: &str) -> UpsertMessageRequest {
        UpsertMessageRequest {
            id: msg_id.to_string(),
            account_id: account_id.to_string(),
            thread_id: thread_id.to_string(),
            from_address: Some("sender@example.com".to_string()),
            from_name: Some("Sender".to_string()),
            to_addresses: Some("recipient@example.com".to_string()),
            cc_addresses: None,
            bcc_addresses: None,
            reply_to: None,
            subject: Some("Hello".to_string()),
            snippet: Some("Hello world".to_string()),
            date: chrono::Utc::now().timestamp(),
            is_read: Some(false),
            is_starred: Some(false),
            body_html: Some("<p>Hello</p>".to_string()),
            body_text: Some("Hello".to_string()),
            message_id_header: Some("<abc@example.com>".to_string()),
            references_header: None,
            in_reply_to_header: None,
            imap_uid: Some(42),
            imap_folder: Some("INBOX".to_string()),
            list_unsubscribe: None,
            list_unsubscribe_post: None,
            auth_results: None,
        }
    }

    #[tokio::test]
    async fn test_upsert_and_get_by_id() {
        let pool = create_test_pool().await;
        let account_id = "acc_msg_1";
        let thread_id = "thread_1";
        seed_account(&pool, account_id, "msg@example.com").await;
        seed_thread(&pool, account_id, thread_id).await;

        let req = make_upsert_msg_req(account_id, "msg_1", thread_id);
        upsert(&pool, req).await.unwrap();

        let msg = get_by_id(&pool, account_id, "msg_1").await.unwrap();
        assert_eq!(msg.subject.as_deref(), Some("Hello"));
        assert_eq!(msg.from_address.as_deref(), Some("sender@example.com"));
        assert_eq!(msg.is_read, 0);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = create_test_pool().await;
        let err = get_by_id(&pool, "nonexistent", "no_msg").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_get_by_thread() {
        let pool = create_test_pool().await;
        let account_id = "acc_msg_2";
        let thread_id = "thread_2";
        seed_account(&pool, account_id, "msg2@example.com").await;
        seed_thread(&pool, account_id, thread_id).await;

        let req1 = make_upsert_msg_req(account_id, "msg_a", thread_id);
        upsert(&pool, req1).await.unwrap();

        let req2 = make_upsert_msg_req(account_id, "msg_b", thread_id);
        upsert(&pool, req2).await.unwrap();

        let msgs = get_by_thread(&pool, account_id, thread_id).await.unwrap();
        assert_eq!(msgs.len(), 2);
    }

    #[tokio::test]
    async fn test_delete_by_id() {
        let pool = create_test_pool().await;
        let account_id = "acc_msg_3";
        let thread_id = "thread_3";
        seed_account(&pool, account_id, "msg3@example.com").await;
        seed_thread(&pool, account_id, thread_id).await;

        let req = make_upsert_msg_req(account_id, "msg_del", thread_id);
        upsert(&pool, req).await.unwrap();

        delete_by_id(&pool, account_id, "msg_del").await.unwrap();

        let err = get_by_id(&pool, account_id, "msg_del").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_by_id_not_found() {
        let pool = create_test_pool().await;
        let err = delete_by_id(&pool, "nonexistent", "no_msg").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_update_flags() {
        let pool = create_test_pool().await;
        let account_id = "acc_msg_4";
        let thread_id = "thread_4";
        seed_account(&pool, account_id, "msg4@example.com").await;
        seed_thread(&pool, account_id, thread_id).await;

        let req = make_upsert_msg_req(account_id, "msg_flags", thread_id);
        upsert(&pool, req).await.unwrap();

        update_flags(&pool, "msg_flags", Some(true), Some(true))
            .await
            .unwrap();

        let msg = get_by_id(&pool, account_id, "msg_flags").await.unwrap();
        assert_eq!(msg.is_read, 1);
        assert_eq!(msg.is_starred, 1);
    }

    #[tokio::test]
    async fn test_update_flags_no_op() {
        let pool = create_test_pool().await;
        // Should not error when both options are None
        update_flags(&pool, "any_id", None, None).await.unwrap();
    }

    #[tokio::test]
    async fn test_get_by_folder_and_uid() {
        let pool = create_test_pool().await;
        let account_id = "acc_msg_5";
        let thread_id = "thread_5";
        seed_account(&pool, account_id, "msg5@example.com").await;
        seed_thread(&pool, account_id, thread_id).await;

        let req = make_upsert_msg_req(account_id, "msg_fuid", thread_id);
        upsert(&pool, req).await.unwrap();

        let found = get_by_folder_and_uid(&pool, account_id, "INBOX", 42)
            .await
            .unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().id, "msg_fuid");

        let not_found = get_by_folder_and_uid(&pool, account_id, "SPAM", 99)
            .await
            .unwrap();
        assert!(not_found.is_none());
    }
}
