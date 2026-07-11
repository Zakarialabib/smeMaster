//! Bundled threads — individual threads grouped into a digest bundle. Keyed by
//! `(account_id, thread_id)`. Helpers: `list`, `add_to_bundle`,
//! `remove_from_bundle`, `get_by_category`.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use crate::db::error::AppDbError;

/// A thread that has been grouped into a bundle for digest delivery.
///
/// Defined inline — this struct exists in `schema.sql` but NOT in `schema.rs`.
/// Rows are uniquely identified by `(account_id, thread_id)`.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BundledThread {
    /// Owning account id (part of the composite key).
    pub account_id: String,
    /// Thread id (part of the composite key).
    pub thread_id: String,
    /// Bundle category this thread is grouped under.
    pub category: String,
    /// Optional unix-epoch time until which the thread is held in the bundle.
    pub held_until: Option<i64>,
}

/// List all bundled threads for an account, ordered by category.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
///
/// # Returns
/// All bundled threads for the account ordered by `category, thread_id`. An
/// empty `Vec` (not an error) when none exist.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<BundledThread>, AppDbError> {
    sqlx::query_as::<_, BundledThread>(
        "SELECT * FROM bundled_threads WHERE account_id = ? ORDER BY category, thread_id",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Add a thread to a bundle.
///
/// Uses `ON CONFLICT(account_id, thread_id) DO NOTHING` so the same thread is
/// not added twice. When a duplicate is detected, the existing row is returned
/// instead (category/held_until of the original are preserved).
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id (part of the composite key).
/// * `thread_id` — thread id (part of the composite key).
/// * `category` — bundle category to assign.
/// * `held_until` — optional hold-until timestamp.
///
/// # Returns
/// The inserted `BundledThread`, or the pre-existing one when the
/// `(account_id, thread_id)` pair already exists.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn add_to_bundle(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
    category: &str,
    held_until: Option<i64>,
) -> Result<BundledThread, AppDbError> {
    let result = sqlx::query_as::<_, BundledThread>(
        r#"
        INSERT INTO bundled_threads (account_id, thread_id, category, held_until)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(account_id, thread_id) DO NOTHING
        RETURNING *
        "#,
    )
    .bind(account_id)
    .bind(thread_id)
    .bind(category)
    .bind(held_until)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?;

    match result {
        Some(row) => Ok(row),
        None => {
            // Duplicate — fetch the existing row
            sqlx::query_as::<_, BundledThread>(
                "SELECT * FROM bundled_threads WHERE account_id = ? AND thread_id = ?",
            )
            .bind(account_id)
            .bind(thread_id)
            .fetch_one(pool)
            .await
            .map_err(AppDbError::Database)
        }
    }
}

/// Remove a thread from its bundle.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id (part of the composite key).
/// * `thread_id` — thread id (part of the composite key).
///
/// # Returns
/// `Ok(())` on success (including the no-op case when the thread was not
/// bundled).
///
/// # Errors
/// Returns `AppDbError::NotFound` (`"BundledThread account_id='<account_id>'
/// thread_id='<thread_id>' not found"`) when no matching row exists. Returns
/// `AppDbError::Database` on query failure. This is left inline (not via the
/// shared helper) because it keys on a composite `(account_id, thread_id)`
/// rather than a single `id`.
pub async fn remove_from_bundle(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query(
        "DELETE FROM bundled_threads WHERE account_id = ? AND thread_id = ?",
    )
    .bind(account_id)
    .bind(thread_id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?
    .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "BundledThread account_id='{account_id}' thread_id='{thread_id}' not found"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    /// Seed a minimal thread so the FK constraint on bundled_threads is satisfied.
    async fn seed_thread(pool: &sqlx::SqlitePool, account_id: &str, thread_id: &str) {
        helpers::insert_test_account(pool, account_id).await;
        sqlx::query(
            "INSERT INTO threads (id, account_id, subject) VALUES (?, ?, ?)",
        )
        .bind(thread_id)
        .bind(account_id)
        .bind("test-thread")
        .execute(pool)
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn test_add_to_bundle_and_list() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-bt-1";
        seed_thread(&pool, account_id, "thread-1").await;

        let bt = add_to_bundle(&pool, account_id, "thread-1", "newsletter", None)
            .await
            .unwrap();
        assert_eq!(bt.account_id, account_id);
        assert_eq!(bt.thread_id, "thread-1");
        assert_eq!(bt.category, "newsletter");

        let items = list(&pool, account_id).await.unwrap();
        assert_eq!(items.len(), 1);
    }

    #[tokio::test]
    async fn test_add_to_bundle_duplicate() {
        let pool = helpers::create_memory_pool().await;
        seed_thread(&pool, "acc-bt-2", "thread-1").await;
        add_to_bundle(&pool, "acc-bt-2", "thread-1", "newsletter", None)
            .await
            .unwrap();
        // Second insert with same key should be a no-op (ON CONFLICT DO NOTHING)
        let dup = add_to_bundle(&pool, "acc-bt-2", "thread-1", "promotions", None)
            .await
            .unwrap();
        assert_eq!(dup.category, "newsletter");
    }

    #[tokio::test]
    async fn test_remove_from_bundle() {
        let pool = helpers::create_memory_pool().await;
        seed_thread(&pool, "acc-bt-3", "thread-1").await;
        add_to_bundle(&pool, "acc-bt-3", "thread-1", "newsletter", None)
            .await
            .unwrap();
        remove_from_bundle(&pool, "acc-bt-3", "thread-1").await.unwrap();
        let items = list(&pool, "acc-bt-3").await.unwrap();
        assert!(items.is_empty());
    }

    #[tokio::test]
    async fn test_remove_from_bundle_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = remove_from_bundle(&pool, "acc-none", "thread-x")
            .await
            .unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_get_by_category() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-bt-4";
        seed_thread(&pool, account_id, "t1").await;
        seed_thread(&pool, account_id, "t2").await;
        seed_thread(&pool, account_id, "t3").await;
        add_to_bundle(&pool, account_id, "t1", "newsletter", None)
            .await
            .unwrap();
        add_to_bundle(&pool, account_id, "t2", "promotions", None)
            .await
            .unwrap();
        add_to_bundle(&pool, account_id, "t3", "newsletter", None)
            .await
            .unwrap();

        let newsletters = get_by_category(&pool, account_id, "newsletter").await.unwrap();
        assert_eq!(newsletters.len(), 2);
        assert!(newsletters.iter().all(|bt| bt.category == "newsletter"));

        let promos = get_by_category(&pool, account_id, "promotions").await.unwrap();
        assert_eq!(promos.len(), 1);
    }
}

/// Get all bundled threads for a specific category.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
/// * `category` — bundle category to filter on.
///
/// # Returns
/// All matching bundled threads ordered by `thread_id`. An empty `Vec` (not an
/// error) when the account has no threads in that category.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn get_by_category(
    pool: &SqlitePool,
    account_id: &str,
    category: &str,
) -> Result<Vec<BundledThread>, AppDbError> {
    sqlx::query_as::<_, BundledThread>(
        "SELECT * FROM bundled_threads WHERE account_id = ? AND category = ? ORDER BY thread_id",
    )
    .bind(account_id)
    .bind(category)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}
