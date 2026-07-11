// ── AI Cache query functions ──────────────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::ai::schema::AiCache;

/// Retrieve a cached value by its composite key.
///
/// Returns `None` (not an error) when no cache entry matches.
pub async fn get(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
    cache_type: &str,
) -> Result<Option<AiCache>, AppDbError> {
    sqlx::query_as::<_, AiCache>(
        "SELECT * FROM ai_cache WHERE account_id = ? AND thread_id = ? AND type = ?",
    )
    .bind(account_id)
    .bind(thread_id)
    .bind(cache_type)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Set (insert or replace) a cache entry.
///
/// Uses `INSERT OR REPLACE` on the composite key
/// `(account_id, thread_id, type)`. Auto-generates `id` (UUID v4) and
/// timestamps to `now`.
pub async fn set(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
    cache_type: &str,
    content: &str,
) -> Result<AiCache, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, AiCache>(
        "INSERT OR REPLACE INTO ai_cache (id, account_id, thread_id, type, content, created_at) \
         VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
    )
    .bind(&id)
    .bind(account_id)
    .bind(thread_id)
    .bind(cache_type)
    .bind(content)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete a specific cache entry by its composite key.
pub async fn delete(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
    cache_type: &str,
) -> Result<(), AppDbError> {
    sqlx::query("DELETE FROM ai_cache WHERE account_id = ? AND thread_id = ? AND type = ?")
        .bind(account_id)
        .bind(thread_id)
        .bind(cache_type)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;

    Ok(())
}

/// Delete all cache entries for a given thread within an account.
pub async fn delete_by_thread(
    pool: &SqlitePool,
    account_id: &str,
    thread_id: &str,
) -> Result<(), AppDbError> {
    sqlx::query("DELETE FROM ai_cache WHERE account_id = ? AND thread_id = ?")
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
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_get_returns_none_for_missing() {
        let pool = helpers::create_memory_pool().await;
        let result = get(&pool, "missing-account", "missing-thread", "test-type")
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_set_and_get_cycle() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;

        let cached = set(&pool, "acc-1", "thread-1", "summary", "Hello world")
            .await
            .unwrap();
        assert_eq!(cached.account_id, "acc-1");
        assert_eq!(cached.thread_id, "thread-1");
        assert_eq!(cached.cache_type, "summary");
        assert_eq!(cached.content, "Hello world");

        let fetched = get(&pool, "acc-1", "thread-1", "summary")
            .await
            .unwrap()
            .expect("should exist after set");
        assert_eq!(fetched.id, cached.id);
        assert_eq!(fetched.content, "Hello world");
    }

    #[tokio::test]
    async fn test_set_overwrites_existing() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;

        set(&pool, "acc-1", "thread-1", "summary", "original")
            .await
            .unwrap();
        set(&pool, "acc-1", "thread-1", "summary", "updated")
            .await
            .unwrap();

        let fetched = get(&pool, "acc-1", "thread-1", "summary")
            .await
            .unwrap()
            .expect("should exist after overwrite");
        assert_eq!(fetched.content, "updated");
    }

    #[tokio::test]
    async fn test_delete_removes_entry() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;

        set(&pool, "acc-1", "thread-1", "summary", "to-delete")
            .await
            .unwrap();
        delete(&pool, "acc-1", "thread-1", "summary")
            .await
            .unwrap();

        let result = get(&pool, "acc-1", "thread-1", "summary")
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_delete_by_thread_removes_all_for_thread() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;

        set(&pool, "acc-1", "thread-1", "summary", "s1")
            .await
            .unwrap();
        set(&pool, "acc-1", "thread-1", "full", "f1")
            .await
            .unwrap();
        set(&pool, "acc-1", "thread-2", "summary", "other")
            .await
            .unwrap();

        delete_by_thread(&pool, "acc-1", "thread-1")
            .await
            .unwrap();

        // Both entries for thread-1 are gone
        assert!(
            get(&pool, "acc-1", "thread-1", "summary")
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            get(&pool, "acc-1", "thread-1", "full")
                .await
                .unwrap()
                .is_none()
        );
        // Other thread unaffected
        assert!(
            get(&pool, "acc-1", "thread-2", "summary")
                .await
                .unwrap()
                .is_some()
        );
    }
}
