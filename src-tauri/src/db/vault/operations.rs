use crate::db::vault::schema::VaultItem;
use crate::error::{SerializedError, ERR_DB};
use sqlx::SqlitePool;

// ─── Vault CRUD operations ───────────────────────────────────────────────

/// Insert or replace a vault item record.
pub async fn upsert_vault_item(
    pool: &SqlitePool,
    item: &VaultItem,
) -> Result<(), SerializedError> {
    sqlx::query(
        "INSERT OR REPLACE INTO vault_items (id, account_id, relative_path, file_name, extension, category, file_size, is_dir, created_at, updated_at, checksum) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
    )
    .bind(&item.id)
    .bind(&item.company_id)
    .bind(&item.relative_path)
    .bind(&item.file_name)
    .bind(&item.extension)
    .bind(&item.category)
    .bind(item.file_size)
    .bind(item.is_dir)
    .bind(&item.created_at)
    .bind(&item.updated_at)
    .bind(&item.checksum)
    .execute(pool)
    .await
    .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to upsert vault item: {e}")))?;
    Ok(())
}

/// List vault items in a directory (by relative path prefix + account).
pub async fn get_vault_items(
    pool: &SqlitePool,
    dir_path: &str,
    account_id: &str,
) -> Result<Vec<VaultItem>, SerializedError> {
    let prefix = if dir_path.is_empty() || dir_path == "." {
        String::new()
    } else {
        format!("{}/", dir_path.trim_start_matches('/'))
    };

    let items = sqlx::query_as::<_, VaultItem>(
        "SELECT * FROM vault_items WHERE account_id = ?1 AND relative_path LIKE ?2 AND relative_path != ?3 AND relative_path NOT LIKE ?4 ORDER BY is_dir DESC, file_name ASC",
    )
    .bind(account_id)
    .bind(format!("{}%", prefix))
    .bind(prefix.trim_end_matches('/'))
    .bind(format!("{}%/%", prefix))
    .fetch_all(pool)
    .await
    .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to list vault items: {e}")))?;

    Ok(items)
}

/// Search vault items by name pattern (SQL LIKE) for a given account.
pub async fn search_vault_items(
    pool: &SqlitePool,
    pattern: &str,
    account_id: &str,
) -> Result<Vec<VaultItem>, SerializedError> {
    let like_pattern = format!("%{}%", pattern);

    let items = sqlx::query_as::<_, VaultItem>(
        "SELECT * FROM vault_items WHERE account_id = ?1 AND (file_name LIKE ?2 OR relative_path LIKE ?2) ORDER BY relative_path ASC",
    )
    .bind(account_id)
    .bind(&like_pattern)
    .fetch_all(pool)
    .await
    .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to search vault items: {e}")))?;

    Ok(items)
}

/// Delete a vault item by its relative path.
pub async fn delete_vault_item(
    pool: &SqlitePool,
    relative_path: &str,
) -> Result<(), SerializedError> {
    sqlx::query("DELETE FROM vault_items WHERE relative_path = ?1")
        .bind(relative_path)
        .execute(pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to delete vault item: {e}")))?;
    Ok(())
}

/// Get vault items filtered by category for a given account.
pub async fn get_vault_items_by_category(
    pool: &SqlitePool,
    category: &str,
    account_id: &str,
) -> Result<Vec<VaultItem>, SerializedError> {
    let items = sqlx::query_as::<_, VaultItem>(
        "SELECT * FROM vault_items WHERE account_id = ?1 AND category = ?2 ORDER BY file_name ASC",
    )
    .bind(account_id)
    .bind(category)
    .fetch_all(pool)
    .await
    .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to get vault items by category: {e}")))?;

    Ok(items)
}

/// Delete all vault items for a given account (used when removing an account).
pub async fn delete_vault_items_by_account(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<(), SerializedError> {
    sqlx::query("DELETE FROM vault_items WHERE account_id = ?1")
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to delete vault items for account: {e}")))?;
    Ok(())
}

/// Count vault items for a given account.
pub async fn count_vault_items(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<i64, SerializedError> {
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM vault_items WHERE account_id = ?1",
    )
    .bind(account_id)
    .fetch_one(pool)
    .await
    .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to count vault items: {e}")))?;

    Ok(count.0)
}
