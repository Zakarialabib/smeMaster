//! Thread labels join-table data-access layer.
//!
//! Helpers for the `thread_labels` join table linking threads to labels.
//! Every function takes a `&SqlitePool` and returns `Result<_, AppDbError>`.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;

/// Add a single label to a thread (no-op if already assigned).
///
/// Uses `INSERT OR IGNORE`, so assigning an existing (thread, label) pair is a
/// silent no-op rather than an error.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `thread_id` — the thread primary key.
/// - `label_id` — the label primary key to assign.
///
/// # Returns
/// `Ok(())` once the row is inserted or ignored.
///
/// # Errors
/// Returns `AppDbError::Database` on a non-ignorable failure.
///
/// # SQL safety
/// `account_id`, `thread_id`, and `label_id` are bound as parameters (`?`).
pub async fn add_label(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
    label_id: &str,
) -> Result<(), AppDbError> {
    sqlx::query("INSERT OR IGNORE INTO thread_labels (account_id, thread_id, label_id) VALUES (?, ?, ?)")
        .bind(account_id)
        .bind(thread_id)
        .bind(label_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Remove a single label from a thread.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `thread_id` — the thread primary key.
/// - `label_id` — the label primary key to remove.
///
/// # Returns
/// `Ok(())` once the statement runs (even if no row matched).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
///
/// # SQL safety
/// `account_id`, `thread_id`, and `label_id` are bound as parameters (`?`).
pub async fn remove_label(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
    label_id: &str,
) -> Result<(), AppDbError> {
    sqlx::query("DELETE FROM thread_labels WHERE account_id = ? AND thread_id = ? AND label_id = ?")
        .bind(account_id)
        .bind(thread_id)
        .bind(label_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}
