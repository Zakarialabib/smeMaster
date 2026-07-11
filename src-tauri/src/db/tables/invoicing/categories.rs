// ── Category table operations (lightweight item grouping) ───────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::invoicing::schema::Category;

/// List all categories for a company.
pub async fn list(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<Vec<Category>, AppDbError> {
    sqlx::query_as::<_, Category>(
        "SELECT * FROM categories WHERE company_id = ? ORDER BY name ASC"
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get a single category by ID.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Category, AppDbError> {
    sqlx::query_as::<_, Category>("SELECT * FROM categories WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("Category {id} not found")))
}

/// Create a new category.
pub async fn create<'e, E>(
    executor: E,
    name: &str,
    company_id: &str,
) -> Result<Category, AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    sqlx::query_as::<_, Category>(
        r#"
        INSERT INTO categories (id, name, company_id, created_at)
        VALUES (?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(name)
    .bind(company_id)
    .bind(now)
    .fetch_one(executor)
    .await
    .map_err(AppDbError::Database)
}

/// Update a category name.
pub async fn update<'e, E>(
    executor: E,
    id: &str,
    name: &str,
) -> Result<Category, AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    sqlx::query_as::<_, Category>(
        "UPDATE categories SET name = ? WHERE id = ? RETURNING *"
    )
    .bind(name)
    .bind(id)
    .fetch_optional(executor)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Category {id} not found")))
}

/// Delete a category.
pub async fn delete<'e, E>(executor: E, id: &str) -> Result<(), AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let rows = sqlx::query("DELETE FROM categories WHERE id = ?")
        .bind(id)
        .execute(executor)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("Category {id} not found")));
    }
    Ok(())
}
