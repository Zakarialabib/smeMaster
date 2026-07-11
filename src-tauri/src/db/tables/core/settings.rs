// ── Settings query functions ────────────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;

/// Retrieve the value for a given settings key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `key` — the settings key to look up.
///
/// # Returns
/// `Some(String)` when the key exists, `None` when it does not.
///
/// # Errors
/// Never returns `AppDbError::NotFound`; a missing key is `Ok(None)`. Other
/// failures surface as `AppDbError::Database`.
///
/// # SQL safety
/// `key` is bound as a parameter (`?`); it is not interpolated into the SQL.
pub async fn get(pool: &SqlitePool, key: &str) -> Result<Option<String>, AppDbError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = ?")
            .bind(key)
            .fetch_optional(pool)
            .await
            .map_err(AppDbError::Database)?;

    Ok(row.map(|r| r.0))
}

/// Set (insert or replace) a settings value.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `key` — the settings key to write.
/// - `value` — the value to store.
///
/// # Returns
/// `Ok(())` once the row is inserted or replaced.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `key` and `value` are bound as parameters (`?`); only the table/column
/// names are constants.
pub async fn set(pool: &SqlitePool, key: &str, value: &str) -> Result<(), AppDbError> {
    sqlx::query(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete a settings key.
///
/// Does **not** error if the key did not exist.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `key` — the settings key to delete.
///
/// # Returns
/// `Ok(())` once the statement runs (even if no row matched).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
///
/// # SQL safety
/// `key` is bound as a parameter (`?`).
pub async fn delete(pool: &SqlitePool, key: &str) -> Result<(), AppDbError> {
    sqlx::query("DELETE FROM settings WHERE key = ?")
        .bind(key)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// List all settings as key-value pairs.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
///
/// # Returns
/// Every `Setting` (key + value) row, ordered ascending by `key`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// No user-supplied values are interpolated; the `ORDER BY` column is a
/// constant.
pub async fn list_all(pool: &SqlitePool) -> Result<Vec<crate::db::core::schema::Setting>, AppDbError> {
    sqlx::query_as::<_, crate::db::core::schema::Setting>("SELECT key, value FROM settings ORDER BY key")
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

    #[tokio::test]
    async fn test_set_and_get() {
        let pool = create_test_pool().await;

        set(&pool, "theme", "dark").await.unwrap();

        let value = get(&pool, "theme").await.unwrap();
        assert_eq!(value, Some("dark".to_string()));
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let pool = create_test_pool().await;

        let value = get(&pool, "nonexistent_key").await.unwrap();
        assert!(value.is_none());
    }

    #[tokio::test]
    async fn test_set_overwrites() {
        let pool = create_test_pool().await;

        set(&pool, "language", "en").await.unwrap();
        set(&pool, "language", "fr").await.unwrap();

        let value = get(&pool, "language").await.unwrap();
        assert_eq!(value, Some("fr".to_string()));
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = create_test_pool().await;

        set(&pool, "temp_key", "temp_value").await.unwrap();
        delete(&pool, "temp_key").await.unwrap();

        let value = get(&pool, "temp_key").await.unwrap();
        assert!(value.is_none());
    }

    #[tokio::test]
    async fn test_delete_nonexistent() {
        let pool = create_test_pool().await;

        // Should not error when key does not exist
        delete(&pool, "never_set").await.unwrap();
    }

    #[tokio::test]
    async fn test_multiple_settings() {
        let pool = create_test_pool().await;

        set(&pool, "key1", "val1").await.unwrap();
        set(&pool, "key2", "val2").await.unwrap();
        set(&pool, "key3", "val3").await.unwrap();

        assert_eq!(get(&pool, "key1").await.unwrap(), Some("val1".to_string()));
        assert_eq!(get(&pool, "key2").await.unwrap(), Some("val2".to_string()));
        assert_eq!(get(&pool, "key3").await.unwrap(), Some("val3".to_string()));
    }
}
