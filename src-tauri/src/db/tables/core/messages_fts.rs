//! Messages full-text-search data-access layer.
//!
//! The single helper here queries the `messages_fts` FTS5 virtual table and
//! joins back to `messages` for the full row. It takes a `&SqlitePool` and
//! returns `Result<_, AppDbError>`.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::Message;

/// Full-text search across messages using the `messages_fts` FTS5 virtual table.
///
/// Joins back to `messages` to return the full `Message` struct, filtered by
/// `account_id` and limited to `limit` rows.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `query` — the FTS5 MATCH expression (passed verbatim to the FTS engine).
/// - `limit` — maximum number of rows to return.
///
/// # Returns
/// Matching `Message` rows (full struct), up to `limit`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure (including a malformed FTS
/// `query`).
///
/// # SQL safety
/// `account_id`, `query`, and `limit` are bound as parameters (`?`); the
/// FTS expression is supplied to `MATCH ?` and is never concatenated into the
/// SQL text.
pub async fn search(
    pool: &SqlitePool,
    account_id: &str,
    query: &str,
    limit: i64,
) -> Result<Vec<Message>, AppDbError> {
    sqlx::query_as::<_, Message>(
        r#"
        SELECT m.*
        FROM messages m
        JOIN messages_fts fts ON m.rowid = fts.rowid
        WHERE messages_fts MATCH ?
          AND m.account_id = ?
        LIMIT ?
        "#,
    )
    .bind(query)
    .bind(account_id)
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
            "INSERT INTO threads (id, account_id, subject, message_count, is_read, is_starred, is_important, has_attachments, is_snoozed, metadata_json) VALUES (?, ?, 'FTS Thread', 1, 0, 0, 0, 0, 0, '{}')",
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

    /// Insert a message with raw SQL so the `messages_ai` trigger fires and
    /// populates the FTS index automatically.
    async fn insert_message(
        pool: &SqlitePool,
        account_id: &str,
        msg_id: &str,
        thread_id: &str,
        subject: &str,
        body_text: &str,
    ) {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            INSERT INTO messages (
                id, account_id, thread_id, from_address, from_name,
                subject, snippet, date, is_read, is_starred,
                body_html, body_text, message_id_header
            ) VALUES (?, ?, ?, 'fts@test.com', 'FTS Tester', ?, ?, ?, 0, 0, ?, ?, '<msg@test>')
            "#,
        )
        .bind(msg_id)
        .bind(account_id)
        .bind(thread_id)
        .bind(subject)
        .bind(body_text)
        .bind(now)
        .bind(format!("<p>{body_text}</p>"))
        .bind(body_text)
        .execute(pool)
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn test_search_finds_matching_messages() {
        let pool = create_test_pool().await;
        let account_id = "acc_fts_1";
        let thread_id = "thread_fts_1";
        seed_account(&pool, account_id, "fts1@example.com").await;
        seed_thread(&pool, account_id, thread_id).await;

        insert_message(
            &pool,
            account_id,
            "msg_fts_a",
            thread_id,
            "Hello World",
            "This is a test message about Rust programming",
        )
        .await;
        insert_message(
            &pool,
            account_id,
            "msg_fts_b",
            thread_id,
            "Meeting Notes",
            "Discussed quarterly results and Rust code review",
        )
        .await;

        // Search for "Rust" — should match both because the FTS index is trigram-based
        // With trigram tokenizer, "Rus" would be a trigram present in "Rust" in both messages
        let results = search(&pool, account_id, "Rust", 10).await.unwrap();
        assert!(!results.is_empty(), "Expected at least one match for 'Rust'");
    }

    #[tokio::test]
    async fn test_search_empty_results() {
        let pool = create_test_pool().await;
        let account_id = "acc_fts_2";
        let thread_id = "thread_fts_2";
        seed_account(&pool, account_id, "fts2@example.com").await;
        seed_thread(&pool, account_id, thread_id).await;

        insert_message(
            &pool,
            account_id,
            "msg_fts_c",
            thread_id,
            "Only Topic",
            "Nothing to see here",
        )
        .await;

        let results = search(&pool, account_id, "ZZZZnotfoundZZZZ", 10)
            .await
            .unwrap();
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_search_respects_account_filter() {
        let pool = create_test_pool().await;

        let account_a = "acc_fts_a";
        let thread_a = "thread_fts_a";
        seed_account(&pool, account_a, "ftsa@example.com").await;
        seed_thread(&pool, account_a, thread_a).await;
        insert_message(
            &pool, account_a, "msg_a1", thread_a, "Alpha Mail", "alpha content",
        )
        .await;

        let account_b = "acc_fts_b";
        let thread_b = "thread_fts_b";
        seed_account(&pool, account_b, "ftsb@example.com").await;
        seed_thread(&pool, account_b, thread_b).await;
        insert_message(
            &pool, account_b, "msg_b1", thread_b, "Beta Mail", "alpha content",
        )
        .await;

        // Searching in account_a should only return account_a's messages
        let results = search(&pool, account_a, "alpha", 10).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].account_id, account_a);
    }

    #[tokio::test]
    async fn test_search_limit() {
        let pool = create_test_pool().await;
        let account_id = "acc_fts_3";
        let thread_id = "thread_fts_3";
        seed_account(&pool, account_id, "fts3@example.com").await;
        seed_thread(&pool, account_id, thread_id).await;

        for i in 0..5 {
            insert_message(
                &pool,
                account_id,
                &format!("msg_fts_{i}"),
                thread_id,
                &format!("Subject {i}"),
                "common search term here",
            )
            .await;
        }

        let results = search(&pool, account_id, "common", 3).await.unwrap();
        assert_eq!(results.len(), 3);
    }
}
