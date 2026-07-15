//! Thread query functions for the `core` table domain.
//!
//! This module provides read, upsert, label, flag, mute, and snooze operations
//! over the `threads` table and its related `thread_labels` rows, used to model
//! email conversations per account.

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use crate::db::error::AppDbError;
use crate::db::mail::schema::Thread;
use crate::db::commands::{ThreadBatchUpdate, ThreadFilters};
use crate::commands::core::UpsertThreadRequest;
use crate::db::common::like_pattern;

/// Fetch a single thread by its composite primary key (account_id, id).
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `id` — the thread's primary key.
///
/// # Returns
/// The matching `Thread` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` when no thread matches the
/// `(account_id, id)` pair.
///
/// # SQL safety
/// Both `account_id` and `id` are bound as parameters (`?`); they are never
/// interpolated into the SQL string.
pub async fn get_by_id(
    pool: &SqlitePool,
    account_id: &str,
    id: &str,
) -> Result<Thread, AppDbError> {
    sqlx::query_as::<_, Thread>(
        "SELECT * FROM threads WHERE account_id = ? AND id = ?",
    )
    .bind(account_id)
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| {
        AppDbError::NotFound(format!(
            "Thread with account_id '{account_id}' and id '{id}' not found"
        ))
    })
}

/// List threads for an account with optional filtering, pagination, and
/// default sort order (pinned first, then most-recent last-message-at).
///
/// Supported `ThreadFilters`:
/// - `label_id` — filters via a `thread_labels` JOIN
/// - `folder` — filters by `imap_folder` on a JOIN to `messages`
/// - `is_read`, `is_starred`, `is_important`, `is_snoozed`, `is_pinned`
/// - `search_query` — `LIKE '%…%'` on `subject`
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `limit` / `offset` — pagination bounds.
/// - `filters` — optional `ThreadFilters` (see bullets above).
///
/// # Returns
/// `Vec<Thread>` ordered by pinned-first, then `last_message_at` descending.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// The `SELECT` is assembled from filter flags and wrapped in
/// `sqlx::AssertSqlSafe`; every bound value (account_id, each filter, the
/// `LIKE` pattern via `like_pattern`, `limit`, `offset`) is a parameter (`?`).
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
    limit: i64,
    offset: i64,
    filters: Option<ThreadFilters>,
) -> Result<Vec<Thread>, AppDbError> {
    let base_select = "SELECT DISTINCT t.* FROM threads t".to_string();
    let mut joins: Vec<String> = Vec::new();
    let mut conditions: Vec<String> = vec!["t.account_id = ?".to_string()];

    if let Some(f) = &filters {
        // ── label_id → join thread_labels ──
        if f.label_id.is_some() {
            joins.push("JOIN thread_labels tl ON tl.thread_id = t.id AND tl.account_id = t.account_id".to_string());
            conditions.push("tl.label_id = ?".to_string());
        }

        // ── folder → join messages ──
        if f.folder.is_some() {
            joins.push(
                "JOIN messages m ON m.thread_id = t.id AND m.account_id = t.account_id"
                    .to_string(),
            );
            conditions.push("m.imap_folder = ?".to_string());
        }

        // ── Boolean flags ──
        if f.is_read.is_some() {
            conditions.push("t.is_read = ?".to_string());
        }
        if f.is_starred.is_some() {
            conditions.push("t.is_starred = ?".to_string());
        }
        if f.is_important.is_some() {
            conditions.push("t.is_important = ?".to_string());
        }
        if f.is_snoozed.is_some() {
            conditions.push("t.is_snoozed = ?".to_string());
        }
        if f.is_pinned.is_some() {
            conditions.push("t.is_pinned = ?".to_string());
        }

        // ── Full-text LIKE on subject ──
        if f.search_query.is_some() {
            conditions.push("t.subject LIKE ?".to_string());
        }
    }

    let joins_sql = joins.join(" ");
    let where_sql = conditions.join(" AND ");
    let order_sql = "ORDER BY t.is_pinned DESC, t.last_message_at DESC NULLS LAST";

    let sql = format!(
        "{base_select} {joins_sql} WHERE {where_sql} {order_sql} LIMIT ? OFFSET ?"
    );

    let mut q_builder = sqlx::query_as::<_, Thread>(sqlx::AssertSqlSafe(sql.clone()));
    q_builder = q_builder.bind(account_id);

    if let Some(f) = &filters {
        if f.label_id.is_some() {
            q_builder = q_builder.bind(f.label_id.as_deref().unwrap());
        }
        if f.folder.is_some() {
            q_builder = q_builder.bind(f.folder.as_deref().unwrap());
        }
        if let Some(v) = f.is_read {
            q_builder = q_builder.bind(if v { 1_i64 } else { 0_i64 });
        }
        if let Some(v) = f.is_starred {
            q_builder = q_builder.bind(if v { 1_i64 } else { 0_i64 });
        }
        if let Some(v) = f.is_important {
            q_builder = q_builder.bind(if v { 1_i64 } else { 0_i64 });
        }
        if let Some(v) = f.is_snoozed {
            q_builder = q_builder.bind(if v { 1_i64 } else { 0_i64 });
        }
        if let Some(v) = f.is_pinned {
            q_builder = q_builder.bind(if v { 1_i64 } else { 0_i64 });
        }
        if f.search_query.is_some() {
            q_builder = q_builder.bind(like_pattern(f.search_query.as_deref().unwrap()));
        }
    }

    q_builder = q_builder.bind(limit);
    q_builder = q_builder.bind(offset);

    q_builder.fetch_all(pool).await.map_err(AppDbError::Database)
}

/// Update the `metadata_json` column on a thread.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `thread_id` — the thread primary key to update.
/// - `metadata` — the JSON value to serialize and store.
///
/// # Returns
/// `Ok(())` once the column is updated.
///
/// # Errors
/// Returns `AppDbError::Validation` if `metadata` cannot be serialized to a
/// JSON string, or `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `thread_id` is bound as a parameter (`?`); only the column name and the
/// serialized JSON (a bound value) are written.
pub async fn update_metadata(
    pool: &SqlitePool,
    thread_id: &str,
    metadata: &serde_json::Value,
) -> Result<(), AppDbError> {
    let json_str = serde_json::to_string(metadata)
        .map_err(|e| AppDbError::Validation(format!("Invalid metadata JSON: {e}")))?;

    sqlx::query("UPDATE threads SET metadata_json = ? WHERE id = ?")
        .bind(&json_str)
        .bind(thread_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Batch-update a set of threads in a single statement.
///
/// Every `Some` field in `changes` becomes a SET clause. Threads are matched
/// by `id IN (?)` via `sqlx::QueryBuilder`.
///
/// When `add_label_ids` or `remove_label_ids` are provided, corresponding
/// `thread_labels` rows are inserted/deleted after the thread update.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `ids` — thread primary keys to update (no-op when empty).
/// - `changes` — the `ThreadBatchUpdate` describing flag/lable changes.
///
/// # Returns
/// `Ok(())` once the update (and any label changes) complete.
///
/// # Errors
/// Returns `AppDbError::Database` on any query failure.
///
/// # SQL safety
/// The `SET` values are plain literals (`0`/`1`); the `id IN (...)` list
/// and the label `INSERT`/`DELETE` rows use bound parameters (`?`) — no thread
/// id is interpolated into the SQL text.
pub async fn batch_update(
    pool: &SqlitePool,
    ids: &[String],
    changes: &ThreadBatchUpdate,
) -> Result<(), AppDbError> {
    if ids.is_empty() {
        return Ok(());
    }

    let mut set_clauses: Vec<String> = Vec::new();

    if let Some(v) = changes.is_read {
        set_clauses.push(format!("is_read = {}", if v { 1 } else { 0 }));
    }
    if let Some(v) = changes.is_starred {
        set_clauses.push(format!("is_starred = {}", if v { 1 } else { 0 }));
    }
    if let Some(v) = changes.is_important {
        set_clauses.push(format!("is_important = {}", if v { 1 } else { 0 }));
    }
    if let Some(v) = changes.is_snoozed {
        set_clauses.push(format!("is_snoozed = {}", if v { 1 } else { 0 }));
    }
    if let Some(v) = changes.is_pinned {
        set_clauses.push(format!("is_pinned = {}", if v { 1 } else { 0 }));
    }
    if let Some(v) = changes.is_muted {
        set_clauses.push(format!("is_muted = {}", if v { 1 } else { 0 }));
    }

    if !set_clauses.is_empty() {
        let set_sql = set_clauses.join(", ");

        use sqlx::QueryBuilder;
        let mut qb: QueryBuilder<sqlx::Sqlite> = QueryBuilder::new(
            "UPDATE threads SET ",
        );

        qb.push(set_sql);
        qb.push(" WHERE id IN (");

        let mut separated = qb.separated(", ");
        for id in ids {
            separated.push_bind(id);
        }
        qb.push(")");

        qb.build().execute(pool).await.map_err(AppDbError::Database)?;
    }

    // ── Handle label changes on thread_labels table ────────────────────
    if let Some(add_ids) = &changes.add_label_ids {
        for thread_id in ids {
            for label_id in add_ids {
                sqlx::query(
                    "INSERT OR IGNORE INTO thread_labels (thread_id, label_id) VALUES (?1, ?2)",
                )
                .bind(thread_id)
                .bind(label_id)
                .execute(pool)
                .await
                .map_err(AppDbError::Database)?;
            }
        }
    }

    if let Some(remove_ids) = &changes.remove_label_ids {
        for thread_id in ids {
            for label_id in remove_ids {
                sqlx::query(
                    "DELETE FROM thread_labels WHERE thread_id = ?1 AND label_id = ?2",
                )
                .bind(thread_id)
                .bind(label_id)
                .execute(pool)
                .await
                .map_err(AppDbError::Database)?;
            }
        }
    }

    Ok(())
}

// ── Response types ─────────────────────────────────────────────────────────

/// Lightweight sender info for the most-recent message in a thread.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ThreadSender {
    /// Display name of the sender, if known.
    pub from_name: Option<String>,
    /// Email address of the sender.
    pub from_address: Option<String>,
}

/// Per-label unread count.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct LabelUnreadCount {
    /// Label primary key this count applies to.
    pub label_id: String,
    /// Number of unread threads carrying this label.
    pub count: i64,
}

/// Thread id + last sender enrichment.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ThreadSenderEnrichment {
    pub thread_id: String,
    pub from_name: Option<String>,
    pub from_address: Option<String>,
}

// ── Query functions ────────────────────────────────────────────────────────

/// Insert or update a thread row.
///
/// Uses `ON CONFLICT(account_id, id) DO UPDATE` so repeated calls with the
/// same composite key will merge rather than fail.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `thread` — the `UpsertThreadRequest` describing the thread.
///
/// # Returns
/// `Ok(())` once the row is inserted or merged.
///
/// # Errors
/// Returns `AppDbError::Database` on failure.
///
/// # SQL safety
/// Every field of `thread` is bound as a positional parameter (`?`); the
/// `COALESCE`/`EXCLUDED` merge expressions are constants in the SQL.
pub async fn upsert_thread(
    pool: &SqlitePool,
    thread: UpsertThreadRequest,
) -> Result<(), AppDbError> {
    sqlx::query(
        r#"
        INSERT INTO threads (
            id, account_id, subject, snippet, last_message_at, message_count,
            is_read, is_starred, is_important, has_attachments,
            is_muted, is_pinned, is_snoozed, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, '{}')
        ON CONFLICT(account_id, id) DO UPDATE SET
            subject          = COALESCE(EXCLUDED.subject, threads.subject),
            snippet          = COALESCE(EXCLUDED.snippet, threads.snippet),
            last_message_at  = COALESCE(EXCLUDED.last_message_at, threads.last_message_at),
            message_count    = EXCLUDED.message_count,
            is_read          = EXCLUDED.is_read,
            is_starred       = EXCLUDED.is_starred,
            is_important     = EXCLUDED.is_important,
            has_attachments  = EXCLUDED.has_attachments
        "#,
    )
    .bind(&thread.id)
    .bind(&thread.account_id)
    .bind(&thread.subject)
    .bind(&thread.snippet)
    .bind(thread.last_message_at)
    .bind(thread.message_count)
    .bind(if thread.is_read { 1_i64 } else { 0_i64 })
    .bind(if thread.is_starred { 1_i64 } else { 0_i64 })
    .bind(if thread.is_important { 1_i64 } else { 0_i64 })
    .bind(if thread.has_attachments { 1_i64 } else { 0_i64 })
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    // Best-effort auto-categorization (Promotions / Social / Updates). Non-fatal:
    // a categorization failure must never break message ingest.
    if let Some(from) = &thread.from_address {
        let _ = categorize_thread(pool, &thread.account_id, &thread.id, from).await;
    }
    Ok(())
}

/// Derive a mailbox category (Promotions / Social / Updates / Primary) from a
/// sender address using a built-in domain heuristic, then persist it.
///
/// The result is written idempotently into `thread_categories` (so the existing
/// `get_threads_for_category` Focused/Primary split picks it up) and, when a
/// matching `bundle_rules` row is enabled, into `bundled_threads`. Threads that
/// resolve to `Primary` are intentionally *not* written to `thread_categories`
/// (the Primary view is the LEFT JOIN IS NULL case).
///
/// Returns the derived category (defaults to `"Primary"`).
pub async fn categorize_thread(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
    from_address: &str,
) -> Result<String, AppDbError> {
    let category = derive_category(from_address);

    if category != "Primary" {
        sqlx::query(
            "INSERT OR IGNORE INTO thread_categories (account_id, thread_id, category) VALUES (?, ?, ?)",
        )
        .bind(account_id)
        .bind(thread_id)
        .bind(category)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;

        // If a bundle rule enables bundling for this category, also hold it.
        let bundled: Option<i64> = sqlx::query_scalar(
            "SELECT is_bundled FROM bundle_rules WHERE account_id = ? AND category = ?",
        )
        .bind(account_id)
        .bind(category)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;

        if bundled == Some(1) {
            sqlx::query(
                "INSERT OR IGNORE INTO bundled_threads (account_id, thread_id, category) VALUES (?, ?, ?)",
            )
            .bind(account_id)
            .bind(thread_id)
            .bind(category)
            .execute(pool)
            .await
            .map_err(AppDbError::Database)?;
        }
    }

    Ok(category.to_string())
}

/// Map a sender address to a mailbox category using a lightweight domain
/// heuristic. Unknown/principal senders resolve to `Primary`.
pub fn derive_category(from_address: &str) -> &'static str {
    let domain = from_address
        .rsplit('@')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();

    // Social
    if matches!(
        domain.as_str(),
        d if d.contains("facebook")
            || d.contains("twitter")
            || d.contains("instagram")
            || d.contains("linkedin")
            || d.contains("reddit")
            || d.contains("youtube")
            || d.contains("tiktok")
            || d.contains("snapchat")
            || d.contains("whatsapp")
            || d.contains("telegram")
    ) {
        return "Social";
    }

    // Promotions / marketing
    if matches!(
        domain.as_str(),
        d if d.contains("shop")
            || d.contains("store")
            || d.contains("deal")
            || d.contains("offer")
            || d.contains("promo")
            || d.contains("sale")
            || d.contains("mailchimp")
            || d.contains("brevo")
            || d.contains("sendgrid")
            || d.contains("hubspot")
            || d.contains("klaviyo")
            || d.contains("marketing")
            || d.contains("newsletter")
    ) {
        return "Promotions";
    }

    // Updates / transactional
    if matches!(
        domain.as_str(),
        d if d.contains("no-reply")
            || d.contains("noreply")
            || d.contains("notifications")
            || d.contains("notification")
            || d.contains("account")
            || d.contains("support")
            || d.contains("billing")
            || d.contains("security")
            || d.contains("github")
            || d.contains("gitlab")
            || d.contains("npm")
            || d.contains("stripe")
            || d.contains("paypal")
    ) {
        return "Updates";
    }

    "Primary"
}

/// Set the importance flag + optional numeric score for a thread. A higher
/// `importance_score` sorts a thread higher in a Focused inbox. `None` score
/// leaves the existing value unchanged.
pub async fn set_importance(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
    is_important: bool,
    importance_score: Option<i64>,
) -> Result<(), AppDbError> {
    if let Some(score) = importance_score {
        sqlx::query(
            "UPDATE threads SET is_important = ?, importance_score = ? WHERE account_id = ? AND id = ?",
        )
        .bind(if is_important { 1_i64 } else { 0_i64 })
        .bind(score)
        .bind(account_id)
        .bind(thread_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    } else {
        sqlx::query("UPDATE threads SET is_important = ? WHERE account_id = ? AND id = ?")
            .bind(if is_important { 1_i64 } else { 0_i64 })
            .bind(account_id)
            .bind(thread_id)
            .execute(pool)
            .await
            .map_err(AppDbError::Database)?;
    }
    Ok(())
}

/// Delete a single thread by its composite primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `id` — the thread's primary key.
///
/// # Returns
/// `Ok(())` once the statement runs (even if no row matched).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. This operation does not
/// return `AppDbError::NotFound` when the thread is absent.
///
/// # SQL safety
/// `account_id` and `id` are bound as parameters (`?`) on a plain `DELETE`
/// statement.
pub async fn delete_by_composite_id(
    pool: &SqlitePool,
    account_id: &str,
    id: &str,
) -> Result<(), AppDbError> {
    sqlx::query("DELETE FROM threads WHERE account_id = ? AND id = ?")
        .bind(account_id)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete all threads for an account.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
///
/// # Returns
/// The number of deleted rows (`u64`).
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
    let result = sqlx::query("DELETE FROM threads WHERE account_id = ?")
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(result.rows_affected())
}

/// Get all threads for an account, most-recent-last-message first.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
///
/// # Returns
/// Every `Thread` row for the account, ordered by `last_message_at` DESC.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id` is bound as a parameter (`?`); the `ORDER BY` column is a
/// constant.
pub async fn get_all(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<Thread>, AppDbError> {
    sqlx::query_as::<_, Thread>(
        "SELECT * FROM threads WHERE account_id = ? ORDER BY last_message_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get the sender (from_name / from_address) of the most recent message in a
/// thread.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `thread_id` — the thread primary key.
///
/// # Returns
/// `Some(ThreadSender)` when the thread has at least one message, `None`
/// otherwise.
///
/// # Errors
/// Never returns `AppDbError::NotFound`; a thread with no messages is
/// `Ok(None)`. Other failures surface as `AppDbError::Database`.
///
/// # SQL safety
/// `account_id` and `thread_id` are bound as parameters (`?`).
pub async fn get_last_sender_for_thread(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
) -> Result<Option<ThreadSender>, AppDbError> {
    sqlx::query_as::<_, ThreadSender>(
        "SELECT from_name, from_address FROM messages \
         WHERE account_id = ? AND thread_id = ? \
         ORDER BY date DESC LIMIT 1",
    )
    .bind(account_id)
    .bind(thread_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Count all threads for an account.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
///
/// # Returns
/// Total thread count (`i64`), `0` when the account has none.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id` is bound as a parameter (`?`).
pub async fn get_count_for_account(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<i64, AppDbError> {
    let count: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM threads WHERE account_id = ?",
    )
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(count.map(|r| r.0).unwrap_or(0))
}

/// Unread thread count for a specific label.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `label_id` — the label to count unread threads for.
///
/// # Returns
/// Unread thread count (`i64`), `0` when none.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id` and `label_id` are bound as parameters (`?`); the `0`
/// literal is a constant.
pub async fn get_label_unread_count(
    pool: &SqlitePool,
    account_id: &str,
    label_id: &str,
) -> Result<i64, AppDbError> {
    let count: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM threads t \
         JOIN thread_labels tl ON tl.thread_id = t.id AND tl.account_id = t.account_id \
         WHERE t.account_id = ? AND tl.label_id = ? AND t.is_read = 0",
    )
    .bind(account_id)
    .bind(label_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(count.map(|r| r.0).unwrap_or(0))
}

/// Unread counts grouped by label for an account.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
///
/// # Returns
/// `Vec<LabelUnreadCount>` — one entry per label that has unread threads.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id` is bound as a parameter (`?`).
pub async fn get_all_label_unread_counts(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<LabelUnreadCount>, AppDbError> {
    sqlx::query_as::<_, LabelUnreadCount>(
        "SELECT tl.label_id, COUNT(*) as count FROM threads t \
         JOIN thread_labels tl ON tl.thread_id = t.id AND tl.account_id = t.account_id \
         WHERE t.account_id = ? AND t.is_read = 0 \
         GROUP BY tl.label_id",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Cross-account INBOX unread count.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
///
/// # Returns
/// Total unread thread count (`i64`) across all accounts whose label is
/// `INBOX`, `0` when none.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// The `INBOX` label id is a constant string literal in the SQL; no
/// user-supplied value is interpolated.
pub async fn get_unread_inbox_count(
    pool: &SqlitePool,
) -> Result<i64, AppDbError> {
    let count: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM threads t \
         INNER JOIN thread_labels tl ON tl.account_id = t.account_id AND tl.thread_id = t.id \
         WHERE tl.label_id = 'INBOX' AND t.is_read = 0",
    )
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(count.map(|r| r.0).unwrap_or(0))
}

/// Get the IDs of all muted threads for an account.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
///
/// # Returns
/// `Vec<String>` of muted thread primary keys.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id` is bound as a parameter (`?`); the `1` literal is a
/// constant.
pub async fn get_muted_ids(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<String>, AppDbError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT id FROM threads WHERE account_id = ? AND is_muted = 1",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

/// Get the last sender for multiple threads at once.
///
/// Uses a sub-query to pick the most recent message per thread.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `thread_ids` — thread primary keys to enrich (no-op when empty).
///
/// # Returns
/// `Vec<ThreadSenderEnrichment>` (thread_id + last sender), one per input id.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id` is a bound parameter (`?`); the `thread_ids` are pushed via
/// `sqlx::QueryBuilder` with `push_bind`, so each is a bound parameter.
pub async fn enrich_threads_with_sender(
    pool: &SqlitePool,
    account_id: &str,
    thread_ids: &[String],
) -> Result<Vec<ThreadSenderEnrichment>, AppDbError> {
    if thread_ids.is_empty() {
        return Ok(Vec::new());
    }

    use sqlx::QueryBuilder;
    let mut qb: QueryBuilder<sqlx::Sqlite> = QueryBuilder::new(
        "SELECT m.thread_id, m.from_name, m.from_address FROM messages m \
         WHERE m.account_id = ",
    );
    qb.push_bind(account_id);
    qb.push(" AND m.thread_id IN (");
    let mut separated = qb.separated(", ");
    for id in thread_ids {
        separated.push_bind(id);
    }
    qb.push(") AND m.date = (SELECT MAX(m2.date) FROM messages m2 \
         WHERE m2.account_id = ");
    qb.push_bind(account_id);
    qb.push(" AND m2.thread_id = m.thread_id)");

    qb.build_query_as::<ThreadSenderEnrichment>()
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Get threads with sender info filtered by category.
///
/// When `category == "Primary"` the query uses a LEFT JOIN with IS NULL
/// (threads that have **no** category). Otherwise it INNER JOINs on the
/// given category.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `category` — the category to filter on (special value `"Primary"`).
///
/// # Returns
/// `Vec<ThreadSenderEnrichment>` for the matching threads.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id` is a bound parameter (`?`). The join type/SQL is chosen by the
/// `category` constant value in code (not interpolated); `category` is bound as
/// a parameter when used in the `INNER JOIN` condition.
pub async fn get_threads_for_category(
    pool: &SqlitePool,
    account_id: &str,
    category: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<ThreadSenderEnrichment>, AppDbError> {
    if category == "Primary" {
        sqlx::query_as::<_, ThreadSenderEnrichment>(
            "SELECT t.id AS thread_id, m.from_name, m.from_address \
             FROM threads t \
             LEFT JOIN thread_categories tc \
                 ON tc.thread_id = t.id AND tc.account_id = t.account_id \
             LEFT JOIN messages m \
                 ON m.thread_id = t.id AND m.account_id = t.account_id \
             WHERE t.account_id = ? AND tc.category IS NULL \
               AND m.date = (SELECT MAX(m2.date) FROM messages m2 \
                             WHERE m2.account_id = t.account_id AND m2.thread_id = t.thread_id) \
             ORDER BY t.last_message_at DESC \
             LIMIT ? OFFSET ?",
        )
        .bind(account_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
    } else {
        sqlx::query_as::<_, ThreadSenderEnrichment>(
            "SELECT t.id AS thread_id, m.from_name, m.from_address \
             FROM threads t \
             INNER JOIN thread_categories tc \
                 ON tc.thread_id = t.id AND tc.account_id = t.account_id \
             LEFT JOIN messages m \
                 ON m.thread_id = t.id AND m.account_id = t.account_id \
             WHERE t.account_id = ? AND tc.category = ? \
               AND m.date = (SELECT MAX(m2.date) FROM messages m2 \
                             WHERE m2.account_id = t.account_id AND m2.thread_id = t.thread_id) \
             ORDER BY t.last_message_at DESC \
             LIMIT ? OFFSET ?",
        )
        .bind(account_id)
        .bind(category)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
    }
}

/// Replace all labels for a thread (delete-then-insert).
pub async fn set_thread_labels(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
    label_ids: &[String],
) -> Result<(), AppDbError> {
    // Delete existing labels
    sqlx::query("DELETE FROM thread_labels WHERE account_id = ? AND thread_id = ?")
        .bind(account_id)
        .bind(thread_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;

    // Insert new labels
    for lid in label_ids {
        sqlx::query(
            "INSERT OR IGNORE INTO thread_labels (account_id, thread_id, label_id) VALUES (?, ?, ?)",
        )
        .bind(account_id)
        .bind(thread_id)
        .bind(lid)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    }
    Ok(())
}

/// Get all label IDs for a thread.
pub async fn get_thread_label_ids(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
) -> Result<Vec<String>, AppDbError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT label_id FROM thread_labels WHERE account_id = ? AND thread_id = ?",
    )
    .bind(account_id)
    .bind(thread_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

/// Update boolean flags for a single thread.
///
/// Only the `Some` fields are applied. At least one field must be `Some`.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `thread_id` — the thread primary key.
/// - `is_read` / `is_starred` / `is_important` / `is_snoozed` — optional
///   flag values to set (omit via `None`).
///
/// # Returns
/// `Ok(())` once the update runs (no-op when all flags are `None`).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. This operation does not
/// verify the thread exists.
///
/// # SQL safety
/// The `SET` clause is built from whichever flags are `Some` and wrapped in
/// `sqlx::AssertSqlSafe`; only the flag columns named in code are set and all
/// values are bound as parameters (`?`).
pub async fn update_flags(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
    is_read: Option<bool>,
    is_starred: Option<bool>,
    is_important: Option<bool>,
    is_snoozed: Option<bool>,
) -> Result<(), AppDbError> {
    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<String> = Vec::new();
    if let Some(v) = is_read { sets.push("is_read = ?".into()); params.push(if v { "1" } else { "0" }.into()); }
    if let Some(v) = is_starred { sets.push("is_starred = ?".into()); params.push(if v { "1" } else { "0" }.into()); }
    if let Some(v) = is_important { sets.push("is_important = ?".into()); params.push(if v { "1" } else { "0" }.into()); }
    if let Some(v) = is_snoozed { sets.push("is_snoozed = ?".into()); params.push(if v { "1" } else { "0" }.into()); }
    if sets.is_empty() { return Ok(()); }
    let sql = format!("UPDATE threads SET {} WHERE account_id = ? AND id = ?", sets.join(", "));
    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql.clone()));
    for p in &params { q = q.bind(p); }
    q = q.bind(account_id).bind(thread_id);
    q.execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

/// Return all snoozed threads whose snooze_until has passed (the current
/// Unix timestamp is >= snooze_until). Used by the frontend background checker
/// to un-snooze threads that should return to INBOX.
pub async fn get_expired_snoozed(
    pool: &SqlitePool,
    now: i64,
) -> Result<Vec<ExpiredSnoozedRow>, AppDbError> {
    sqlx::query_as::<_, ExpiredSnoozedRow>(
        "SELECT id, account_id, snooze_until FROM threads \
         WHERE is_snoozed = 1 AND snooze_until IS NOT NULL AND snooze_until <= ?",
    )
    .bind(now)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Lightweight row for expired snoozed threads.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ExpiredSnoozedRow {
    /// Thread primary key.
    pub id: String,
    /// Owning account primary key.
    pub account_id: String,
    /// Snooze-until epoch timestamp (the expiry criterion).
    pub snooze_until: Option<i64>,
}

/// Snooze a thread until the given Unix timestamp.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `thread_id` — the thread primary key.
/// - `until` — Unix epoch second at which the thread should return to INBOX.
///
/// # Returns
/// `Ok(())` once the snooze fields are set.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id`, `thread_id`, and `until` are bound as parameters (`?`); only
/// the column names are constants.
pub async fn snooze(pool: &SqlitePool, account_id: &str, thread_id: &str, until: i64) -> Result<(), AppDbError> {
    sqlx::query("UPDATE threads SET is_snoozed = 1, snooze_until = ? WHERE account_id = ? AND id = ?")
        .bind(until)
        .bind(account_id)
        .bind(thread_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Unsnooze a thread (clear snooze state and timestamp).
pub async fn unsnooze(pool: &SqlitePool, account_id: &str, thread_id: &str) -> Result<(), AppDbError> {
    sqlx::query("UPDATE threads SET is_snoozed = 0, snooze_until = NULL WHERE account_id = ? AND id = ?")
        .bind(account_id)
        .bind(thread_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
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

    /// Insert a thread row with the given flags.
    async fn insert_thread(
        pool: &SqlitePool,
        account_id: &str,
        thread_id: &str,
        subject: &str,
        is_read: i64,
        is_starred: i64,
        is_important: i64,
        is_snoozed: i64,
    ) {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT INTO threads (id, account_id, subject, message_count, is_read, is_starred, is_important, has_attachments, is_snoozed, snooze_until, metadata_json, last_message_at) VALUES (?, ?, ?, 1, ?, ?, ?, 0, ?, NULL, '{}', ?)",
        )
        .bind(thread_id)
        .bind(account_id)
        .bind(subject)
        .bind(is_read)
        .bind(is_starred)
        .bind(is_important)
        .bind(is_snoozed)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn test_get_by_id() {
        let pool = create_test_pool().await;
        let account_id = "acc_thr_1";
        seed_account(&pool, account_id, "thr1@example.com").await;
        insert_thread(&pool, account_id, "thr_1", "Test Thread", 0, 0, 0, 0).await;

        let thread = get_by_id(&pool, account_id, "thr_1").await.unwrap();
        assert_eq!(thread.subject.as_deref(), Some("Test Thread"));
        assert_eq!(thread.account_id, account_id);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = create_test_pool().await;
        let err = get_by_id(&pool, "nonexistent", "no_thr").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_list_no_filters() {
        let pool = create_test_pool().await;
        let account_id = "acc_thr_2";
        seed_account(&pool, account_id, "thr2@example.com").await;
        insert_thread(&pool, account_id, "t1", "Alpha", 0, 0, 0, 0).await;
        insert_thread(&pool, account_id, "t2", "Beta", 1, 0, 0, 0).await;

        let threads = list(&pool, account_id, 10, 0, None).await.unwrap();
        assert_eq!(threads.len(), 2);
    }

    #[tokio::test]
    async fn test_list_with_filter_is_read() {
        let pool = create_test_pool().await;
        let account_id = "acc_thr_3";
        seed_account(&pool, account_id, "thr3@example.com").await;
        insert_thread(&pool, account_id, "t_unread", "Unread", 0, 0, 0, 0).await;
        insert_thread(&pool, account_id, "t_read", "Read", 1, 0, 0, 0).await;

        let filters = ThreadFilters {
            label_id: None,
            is_read: Some(true),
            is_starred: None,
            is_important: None,
            is_snoozed: None,
            is_pinned: None,
            search_query: None,
            folder: None,
        };
        let threads = list(&pool, account_id, 10, 0, Some(filters))
            .await
            .unwrap();
        assert_eq!(threads.len(), 1);
        assert_eq!(threads[0].id, "t_read");
    }

    #[tokio::test]
    async fn test_list_with_filter_is_starred() {
        let pool = create_test_pool().await;
        let account_id = "acc_thr_4";
        seed_account(&pool, account_id, "thr4@example.com").await;
        insert_thread(&pool, account_id, "t_star", "Starred", 0, 1, 0, 0).await;
        insert_thread(&pool, account_id, "t_plain", "Plain", 0, 0, 0, 0).await;

        let filters = ThreadFilters {
            label_id: None,
            is_read: None,
            is_starred: Some(true),
            is_important: None,
            is_snoozed: None,
            is_pinned: None,
            search_query: None,
            folder: None,
        };
        let threads = list(&pool, account_id, 10, 0, Some(filters))
            .await
            .unwrap();
        assert_eq!(threads.len(), 1);
        assert_eq!(threads[0].id, "t_star");
    }

    #[tokio::test]
    async fn test_list_pagination() {
        let pool = create_test_pool().await;
        let account_id = "acc_thr_5";
        seed_account(&pool, account_id, "thr5@example.com").await;
        for i in 0..5 {
            insert_thread(
                &pool,
                account_id,
                &format!("t_pg_{i}"),
                &format!("Thread {i}"),
                0, 0, 0, 0,
            )
            .await;
        }

        let page1 = list(&pool, account_id, 2, 0, None).await.unwrap();
        assert_eq!(page1.len(), 2);

        let page2 = list(&pool, account_id, 2, 2, None).await.unwrap();
        assert_eq!(page2.len(), 2);

        let page3 = list(&pool, account_id, 2, 4, None).await.unwrap();
        assert_eq!(page3.len(), 1);
    }

    #[tokio::test]
    async fn test_update_metadata() {
        let pool = create_test_pool().await;
        let account_id = "acc_thr_6";
        seed_account(&pool, account_id, "thr6@example.com").await;
        insert_thread(&pool, account_id, "thr_meta", "Meta Test", 0, 0, 0, 0).await;

        let metadata = serde_json::json!({"category": "important", "score": 42});
        update_metadata(&pool, "thr_meta", &metadata)
            .await
            .unwrap();

        let thread = get_by_id(&pool, account_id, "thr_meta").await.unwrap();
        let parsed: serde_json::Value =
            serde_json::from_str(&thread.metadata_json).unwrap();
        assert_eq!(parsed["category"], "important");
        assert_eq!(parsed["score"], 42);
    }

    #[tokio::test]
    async fn test_batch_update() {
        let pool = create_test_pool().await;
        let account_id = "acc_thr_7";
        seed_account(&pool, account_id, "thr7@example.com").await;
        insert_thread(&pool, account_id, "batch_a", "A", 0, 0, 0, 0).await;
        insert_thread(&pool, account_id, "batch_b", "B", 0, 0, 0, 0).await;

        let changes = ThreadBatchUpdate {
            is_read: Some(true),
            is_starred: Some(true),
            is_important: None,
            is_snoozed: None,
            is_pinned: None,
            is_muted: None,
            add_label_ids: None,
            remove_label_ids: None,
        };

        batch_update(
            &pool,
            &["batch_a".to_string(), "batch_b".to_string()],
            &changes,
        )
        .await
        .unwrap();

        let ta = get_by_id(&pool, account_id, "batch_a").await.unwrap();
        assert_eq!(ta.is_read, 1);
        assert_eq!(ta.is_starred, 1);

        let tb = get_by_id(&pool, account_id, "batch_b").await.unwrap();
        assert_eq!(tb.is_read, 1);
        assert_eq!(tb.is_starred, 1);
    }

    #[tokio::test]
    async fn test_batch_update_empty_ids() {
        let pool = create_test_pool().await;
        let changes = ThreadBatchUpdate {
            is_read: Some(true),
            is_starred: None,
            is_important: None,
            is_snoozed: None,
            is_pinned: None,
            is_muted: None,
            add_label_ids: None,
            remove_label_ids: None,
        };
        // Should not error
        batch_update(&pool, &[], &changes).await.unwrap();
    }

    #[tokio::test]
    async fn test_batch_update_no_changes() {
        let pool = create_test_pool().await;
        let changes = ThreadBatchUpdate {
            is_read: None,
            is_starred: None,
            is_important: None,
            is_snoozed: None,
            is_pinned: None,
            is_muted: None,
            add_label_ids: None,
            remove_label_ids: None,
        };
        batch_update(&pool, &["some_id".to_string()], &changes)
            .await
            .unwrap();
    }
}
