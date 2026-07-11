//! `smart_folders` table data-access layer.
//!
//! CRUD helpers for the `smart_folders` table (saved search views). Functions
//! are async, take a `&SqlitePool`, and return `Result<_, AppDbError>`.
//! Lookups/updates/deletes return `AppDbError::NotFound` when the row is
//! missing; the dynamic `update_fields` uses `sqlx::AssertSqlSafe` (see below).
//! All operations return `AppDbError::Database` on SQL failure.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::SmartFolder;

/// List smart folders visible to an account, including global (NULL account)
/// ones, ordered by `sort_order` ascending.
///
/// * `account_id` — account scope; NULL-account rows are always included.
/// * Returns the matching `SmartFolder` rows.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list(pool: &SqlitePool, account_id: &str) -> Result<Vec<SmartFolder>, AppDbError> {
    sqlx::query_as::<_, SmartFolder>(
        "SELECT * FROM smart_folders WHERE account_id IS NULL OR account_id = ? ORDER BY sort_order ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single smart folder by id.
///
/// * `id` — primary key of the folder.
/// * Returns the matching `SmartFolder`.
/// * Errors: `AppDbError::NotFound` when no folder has `id`;
///   `AppDbError::Database` on SQL failure.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<SmartFolder, AppDbError> {
    sqlx::query_as::<_, SmartFolder>(
        "SELECT * FROM smart_folders WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Smart folder {} not found", id)))
}

/// Insert a new smart folder, generating its `id` and `created_at`.
///
/// * `data` — folder fields (`id`/`created_at` overwritten by the database).
/// * Returns the newly created `SmartFolder`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn create(pool: &SqlitePool, data: &SmartFolder) -> Result<SmartFolder, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, SmartFolder>(
        r#"INSERT INTO smart_folders (
            id, account_id, name, query, icon, color, sort_order, is_default, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"#,
    )
    .bind(&id)
    .bind(&data.account_id)
    .bind(&data.name)
    .bind(&data.query)
    .bind(&data.icon)
    .bind(&data.color)
    .bind(data.sort_order)
    .bind(data.is_default)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update an existing smart folder by id, replacing mutable columns.
///
/// * `data` — folder with updated fields; `data.id` selects the row.
/// * Returns the updated `SmartFolder`.
/// * Errors: `AppDbError::NotFound` when no folder has `data.id`;
///   `AppDbError::Database` on SQL failure.
pub async fn update(pool: &SqlitePool, data: &SmartFolder) -> Result<SmartFolder, AppDbError> {
    sqlx::query_as::<_, SmartFolder>(
        r#"UPDATE smart_folders SET
            name = ?, query = ?, icon = ?, color = ?, sort_order = ?, is_default = ?
        WHERE id = ? RETURNING *"#,
    )
    .bind(&data.name)
    .bind(&data.query)
    .bind(&data.icon)
    .bind(&data.color)
    .bind(data.sort_order)
    .bind(data.is_default)
    .bind(&data.id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Smart folder {} not found", data.id)))
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let result = sqlx::query("DELETE FROM smart_folders WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    if result.rows_affected() == 0 {
        return Err(AppDbError::NotFound(format!("Smart folder {} not found", id)));
    }
    Ok(())
}

pub async fn get_by_id_opt(pool: &SqlitePool, id: &str) -> Result<Option<SmartFolder>, AppDbError> {
    sqlx::query_as::<_, SmartFolder>("SELECT * FROM smart_folders WHERE id = ?")
        .bind(id).fetch_optional(pool).await.map_err(AppDbError::Database)
}

/// Partially update smart folder fields using dynamic `UpdateFields`.
///
/// * `id` — primary key of the folder.
/// * `fields` — columns to set (`fields.set`) and to clear to NULL
///   (`fields.unset`).
/// * Returns `()`. When both maps are empty this is a no-op (returns `Ok(())`
///   without touching the row).
/// * Errors: `AppDbError::Database` on SQL failure. Note: a non-existent `id`
///   does NOT error here — 0 rows are affected silently.
/// * SQL-safety: the SET list is built from the `fields` keys and executed via
///   `sqlx::AssertSqlSafe`; values are bound positionally, so callers must only
///   supply valid column names in `fields`.
pub async fn update_fields(pool: &SqlitePool, id: &str, fields: &crate::db::commands::UpdateFields) -> Result<(), AppDbError> {
    let set_count = fields.set.len();
    if set_count == 0 && fields.unset.is_empty() { return Ok(()); }
    let mut set_parts: Vec<String> = Vec::with_capacity(set_count + fields.unset.len());
    let mut set_values: Vec<serde_json::Value> = Vec::with_capacity(set_count);
    for key in &fields.unset { set_parts.push(format!("\"{key}\" = NULL")); }
    for (key, value) in &fields.set { set_parts.push(format!("\"{key}\" = ?")); set_values.push(value.clone()); }
    let sql = format!("UPDATE smart_folders SET {} WHERE id = ?", set_parts.join(", "));
    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql));
    for val in &set_values { q = q.bind(val); }
    q.bind(id).execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    fn make_folder(account_id: &str, name: &str) -> SmartFolder {
        SmartFolder {
            id: String::new(),
            account_id: Some(account_id.to_string()),
            name: name.to_string(),
            query: "is:unread".to_string(),
            icon: "Inbox".to_string(),
            color: Some("#FF0000".to_string()),
            sort_order: 0,
            is_default: 0,
            created_at: 0,
        }
    }

    #[tokio::test]
    async fn test_create_folder() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let data = make_folder("acct_1", "Unread");
        let created = create(&pool, &data).await.unwrap();
        assert!(!created.id.is_empty());
        assert_eq!(created.name, "Unread");
        assert_eq!(created.query, "is:unread");
    }

    #[tokio::test]
    async fn test_list_folders() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        create(&pool, &make_folder("acct_1", "Folder A")).await.unwrap();
        create(&pool, &make_folder("acct_1", "Folder B")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_list_folders_includes_global() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        // Global folder (account_id IS NULL)
        let mut global = make_folder("acct_1", "Global");
        global.account_id = None;
        create(&pool, &global).await.unwrap();
        // Account-specific folder
        create(&pool, &make_folder("acct_1", "Personal")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_get_by_id_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_folder("acct_1", "Test")).await.unwrap();
        let fetched = get_by_id(&pool, &created.id).await.unwrap();
        assert_eq!(fetched.id, created.id);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_by_id(&pool, "nonexistent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_folder() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut created = create(&pool, &make_folder("acct_1", "Old Name")).await.unwrap();
        created.name = "New Name".to_string();
        created.query = "is:starred".to_string();
        let updated = update(&pool, &created).await.unwrap();
        assert_eq!(updated.name, "New Name");
        assert_eq!(updated.query, "is:starred");
    }

    #[tokio::test]
    async fn test_delete_folder() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_folder("acct_1", "Delete Me")).await.unwrap();
        delete(&pool, &created.id).await.unwrap();
        let result = get_by_id(&pool, &created.id).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = delete(&pool, "nonexistent").await;
        assert!(result.is_err());
    }
}
