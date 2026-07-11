//! `template_categories` table data-access layer.
//!
//! CRUD helpers for the `template_categories` table, which organises email
//! templates into user- or system-defined groups. Functions are async, take a
//! `&SqlitePool`, and return `Result<_, AppDbError>`. Lookups/updates/deletes
//! return `AppDbError::NotFound` when the row is missing; all operations return
//! `AppDbError::Database` on SQL failure.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use crate::db::error::AppDbError;

/// Inline struct — NOT defined in schema.rs.
/// Represents a category used to organise email templates.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TemplateCategory {
    /// Primary key of the category.
    pub id: String,
    /// Owning company (foreign key to `companies`).
    pub company_id: String,
    /// Display name of the category.
    pub name: String,
    /// Optional icon identifier.
    pub icon: Option<String>,
    /// Sort order for display.
    pub sort_order: i64,
    /// Flag (1/0) marking this as a built-in system category.
    pub is_system: i64,
    /// Creation timestamp (unix epoch seconds).
    pub created_at: i64,
}

/// Row shape for a count aggregation over template categories.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CountRow {
    /// Number of rows matched by the query.
    pub count: i64,
}

/// List categories belonging to a company, ordered by `sort_order` ascending.
///
/// * `company_id` — owning company.
/// * Returns the matching `TemplateCategory` rows.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<Vec<TemplateCategory>, AppDbError> {
    sqlx::query_as::<_, TemplateCategory>(
        "SELECT * FROM template_categories WHERE company_id = ? ORDER BY sort_order ASC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single template category by id.
///
/// * `id` — primary key of the category.
/// * Returns the matching `TemplateCategory`.
/// * Errors: `AppDbError::NotFound` when no category has `id`;
///   `AppDbError::Database` on SQL failure.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<TemplateCategory, AppDbError> {
    sqlx::query_as::<_, TemplateCategory>("SELECT * FROM template_categories WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("Template category {} not found", id)))
}

/// Insert a new template category, generating its `id` and `created_at`.
///
/// * `data` — category fields (`id`/`created_at` overwritten by the database).
/// * Returns the newly created `TemplateCategory`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn create(
    pool: &SqlitePool,
    data: &TemplateCategory,
) -> Result<TemplateCategory, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, TemplateCategory>(
        r#"INSERT INTO template_categories (
            id, company_id, name, icon, sort_order, is_system, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *"#,
    )
    .bind(&id)
    .bind(&data.company_id)
    .bind(&data.name)
    .bind(&data.icon)
    .bind(data.sort_order)
    .bind(data.is_system)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update an existing template category by id, replacing mutable columns.
///
/// * `data` — category with updated fields; `data.id` selects the row.
/// * Returns the updated `TemplateCategory`.
/// * Errors: `AppDbError::NotFound` when no category has `data.id`;
///   `AppDbError::Database` on SQL failure.
pub async fn update(
    pool: &SqlitePool,
    data: &TemplateCategory,
) -> Result<TemplateCategory, AppDbError> {
    sqlx::query_as::<_, TemplateCategory>(
        r#"UPDATE template_categories SET
            name = ?, icon = ?, sort_order = ?, is_system = ?
        WHERE id = ? RETURNING *"#,
    )
    .bind(&data.name)
    .bind(&data.icon)
    .bind(data.sort_order)
    .bind(data.is_system)
    .bind(&data.id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Template category {} not found", data.id)))
}

/// Delete a template category by id.
///
/// * `id` — primary key of the category.
/// * Returns `()` on success.
/// * Errors: `AppDbError::NotFound` when no row with `id` exists (0 rows
///   affected); `AppDbError::Database` on SQL failure.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let result = sqlx::query("DELETE FROM template_categories WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    if result.rows_affected() == 0 {
        return Err(AppDbError::NotFound(format!("Template category {} not found", id)));
    }
    Ok(())
}

/// Count template categories.
pub async fn count(pool: &SqlitePool) -> Result<i64, AppDbError> {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM template_categories")
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Insert a template category with `INSERT OR IGNORE`.
///
/// * Parameters mirror `create`; a duplicate `id` is skipped silently.
/// * Returns `()` whether or not a row was inserted.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn insert_ignore(
    pool: &SqlitePool,
    id: &str,
    company_id: &str,
    name: &str,
    icon: Option<&str>,
    sort_order: i64,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        r#"INSERT OR IGNORE INTO template_categories (id, company_id, name, icon, sort_order, is_system, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)"#,
    )
    .bind(id)
    .bind(company_id)
    .bind(name)
    .bind(icon)
    .bind(sort_order)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Upsert a template category: insert it, or update `name`/`icon` if the `id`
/// already exists (`ON CONFLICT(id) DO UPDATE`).
///
/// * `id` — primary key (used for conflict resolution).
/// * `company_id` / `name` / `icon` — category fields; `is_system` defaults to 0.
/// * Returns `()`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn upsert(
    pool: &SqlitePool,
    id: &str,
    company_id: &str,
    name: &str,
    icon: Option<&str>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        r#"INSERT INTO template_categories (id, company_id, name, icon, sort_order, is_system, created_at)
        VALUES (?, ?, ?, ?, 0, 0, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon"#,
    )
    .bind(id)
    .bind(company_id)
    .bind(name)
    .bind(icon)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    /// The schema.sql template_categories table lacks a `created_at` column that
    /// the Rust struct expects.  After running migrations, add it with ALTER TABLE.
    async fn create_test_pool() -> sqlx::SqlitePool {
        let pool = helpers::create_memory_pool().await;
        let _ = sqlx::query(
            "ALTER TABLE template_categories ADD COLUMN created_at INTEGER NOT NULL DEFAULT (unixepoch())",
        )
        .execute(&pool)
        .await;
        pool
    }

    fn make_category(company_id: &str, name: &str) -> TemplateCategory {
        TemplateCategory {
            id: String::new(),
            company_id: company_id.to_string(),
            name: name.to_string(),
            icon: Some("Folder".to_string()),
            sort_order: 0,
            is_system: 0,
            created_at: 0,
        }
    }

    #[tokio::test]
    async fn test_create_category() {
        let pool = create_test_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let data = make_category("acct_1", "Work");
        let created = create(&pool, &data).await.unwrap();
        assert!(!created.id.is_empty());
        assert_eq!(created.name, "Work");
    }

    #[tokio::test]
    async fn test_list_categories() {
        let pool = create_test_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        create(&pool, &make_category("acct_1", "Work")).await.unwrap();
        create(&pool, &make_category("acct_1", "Personal")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_list_categories_filters_by_company() {
        let pool = create_test_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        create(&pool, &make_category("acct_1", "Company A")).await.unwrap();
        create(&pool, &make_category("acct_1", "Company A - Second")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_get_by_id_found() {
        let pool = create_test_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_category("acct_1", "Test")).await.unwrap();
        let fetched = get_by_id(&pool, &created.id).await.unwrap();
        assert_eq!(fetched.id, created.id);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = create_test_pool().await;
        let result = get_by_id(&pool, "nonexistent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_category() {
        let pool = create_test_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut created = create(&pool, &make_category("acct_1", "Old")).await.unwrap();
        created.name = "Updated".to_string();
        created.sort_order = 5;
        let updated = update(&pool, &created).await.unwrap();
        assert_eq!(updated.name, "Updated");
        assert_eq!(updated.sort_order, 5);
    }

    #[tokio::test]
    async fn test_delete_category() {
        let pool = create_test_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_category("acct_1", "Delete Me")).await.unwrap();
        delete(&pool, &created.id).await.unwrap();
        let result = get_by_id(&pool, &created.id).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = create_test_pool().await;
        let result = delete(&pool, "nonexistent").await;
        assert!(result.is_err());
    }
}
