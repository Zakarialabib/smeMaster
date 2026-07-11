//! `quick_steps` table data-access layer.
//!
//! CRUD helpers for the `quick_steps` table (one-click action bundles).
//! Functions are async, take a `&SqlitePool`, and return `Result<_, AppDbError>`.
//! Account-scoped lookups/updates/deletes take an `account_id`; single-row
//! operations return `AppDbError::NotFound` when the row is missing. All
//! operations return `AppDbError::Database` on SQL failure. `update_fields` uses
//! `sqlx::AssertSqlSafe` (see below).

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::QuickStep;

/// List quick steps for an account, ordered by `sort_order` ascending.
///
/// * `account_id` — owning account.
/// * Returns the matching `QuickStep` rows.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list(pool: &SqlitePool, account_id: &str) -> Result<Vec<QuickStep>, AppDbError> {
    sqlx::query_as::<_, QuickStep>(
        "SELECT * FROM quick_steps WHERE account_id = ? ORDER BY sort_order ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single quick step by id within an account.
///
/// * `id` — primary key of the quick step.
/// * `account_id` — owning account (scopes the lookup).
/// * Returns the matching `QuickStep`.
/// * Errors: `AppDbError::NotFound` when no such step exists for the account;
///   `AppDbError::Database` on SQL failure.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<QuickStep, AppDbError> {
    sqlx::query_as::<_, QuickStep>(
        "SELECT * FROM quick_steps WHERE id = ? AND account_id = ?",
    )
    .bind(id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Quick step {} not found", id)))
}

/// Insert a new quick step, generating its `id` and `created_at`.
///
/// * `data` — step fields (`id`/`created_at` overwritten by the database).
/// * Returns the newly created `QuickStep`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn create(pool: &SqlitePool, data: &QuickStep) -> Result<QuickStep, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, QuickStep>(
        r#"INSERT INTO quick_steps (
            id, account_id, name, description, shortcut, actions_json,
            icon, is_enabled, continue_on_error, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"#,
    )
    .bind(&id)
    .bind(&data.account_id)
    .bind(&data.name)
    .bind(&data.description)
    .bind(&data.shortcut)
    .bind(&data.actions_json)
    .bind(&data.icon)
    .bind(data.is_enabled)
    .bind(data.continue_on_error)
    .bind(data.sort_order)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update an existing quick step by id and account, replacing mutable columns.
///
/// * `data` — step with updated fields; `data.id`/`data.account_id` scope it.
/// * Returns the updated `QuickStep`.
/// * Errors: `AppDbError::NotFound` when no matching step exists;
///   `AppDbError::Database` on SQL failure.
pub async fn update(pool: &SqlitePool, data: &QuickStep) -> Result<QuickStep, AppDbError> {
    sqlx::query_as::<_, QuickStep>(
        r#"UPDATE quick_steps SET
            name = ?, description = ?, shortcut = ?, actions_json = ?,
            icon = ?, is_enabled = ?, continue_on_error = ?, sort_order = ?
        WHERE id = ? AND account_id = ? RETURNING *"#,
    )
    .bind(&data.name)
    .bind(&data.description)
    .bind(&data.shortcut)
    .bind(&data.actions_json)
    .bind(&data.icon)
    .bind(data.is_enabled)
    .bind(data.continue_on_error)
    .bind(data.sort_order)
    .bind(&data.id)
    .bind(&data.account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Quick step {} not found", data.id)))
}

pub async fn delete(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<(), AppDbError> {
    let result = sqlx::query("DELETE FROM quick_steps WHERE id = ? AND account_id = ?")
        .bind(id)
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    if result.rows_affected() == 0 {
        return Err(AppDbError::NotFound(format!("Quick step {} not found", id)));
    }
    Ok(())
}

/// Fetch a quick step by id, returning `None` rather than an error if absent.
///
/// * `id` — primary key of the quick step.
/// * Returns `Some(QuickStep)` when found, `None` when absent.
/// * Errors: `AppDbError::Database` on SQL failure (never `NotFound`).
pub async fn get_by_id_opt(pool: &SqlitePool, id: &str) -> Result<Option<QuickStep>, AppDbError> {
    sqlx::query_as::<_, QuickStep>("SELECT * FROM quick_steps WHERE id = ?")
        .bind(id).fetch_optional(pool).await.map_err(AppDbError::Database)
}

/// Partially update quick step fields using dynamic `UpdateFields`.
///
/// * `id` — primary key of the quick step.
/// * `fields` — columns to set (`fields.set`) and to clear to NULL
///   (`fields.unset`).
/// * Returns `()`. When both maps are empty this is a no-op (returns `Ok(())`
///   without touching the row).
/// * Errors: `AppDbError::Database` on SQL failure. A non-existent `id` does NOT
///   error here (0 rows affected silently).
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
    let sql = format!("UPDATE quick_steps SET {} WHERE id = ?", set_parts.join(", "));
    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql));
    for val in &set_values { q = q.bind(val); }
    q.bind(id).execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

/// Persist a new display order for a set of quick steps.
///
/// * `account_id` — owning account (scopes each `UPDATE`).
/// * `ordered_ids` — quick step ids in their desired order; index becomes
///   `sort_order`.
/// * Returns `()`. Missing ids are simply skipped.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn reorder(pool: &SqlitePool, account_id: &str, ordered_ids: &[String]) -> Result<(), AppDbError> {
    for (i, id) in ordered_ids.iter().enumerate() {
        sqlx::query("UPDATE quick_steps SET sort_order = ? WHERE id = ? AND account_id = ?")
            .bind(i as i64).bind(id).bind(account_id)
            .execute(pool).await.map_err(AppDbError::Database)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    fn make_step(account_id: &str, name: &str) -> QuickStep {
        QuickStep {
            id: String::new(),
            account_id: account_id.to_string(),
            name: name.to_string(),
            description: Some("A quick step".to_string()),
            shortcut: Some("qs".to_string()),
            actions_json: r#"["mark_read","archive"]"#.to_string(),
            icon: Some("Archive".to_string()),
            is_enabled: 1,
            continue_on_error: 0,
            sort_order: 0,
            created_at: 0,
        }
    }

    #[tokio::test]
    async fn test_create_step() {
        let pool = helpers::create_memory_pool().await;
        let data = make_step("acct_1", "Archive & Read");
        let created = create(&pool, &data).await.unwrap();
        assert!(!created.id.is_empty());
        assert_eq!(created.name, "Archive & Read");
        assert_eq!(created.account_id, "acct_1");
    }

    #[tokio::test]
    async fn test_list_steps() {
        let pool = helpers::create_memory_pool().await;
        create(&pool, &make_step("acct_1", "Step A")).await.unwrap();
        create(&pool, &make_step("acct_1", "Step B")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_list_steps_scoped() {
        let pool = helpers::create_memory_pool().await;
        create(&pool, &make_step("acct_1", "Step A")).await.unwrap();
        create(&pool, &make_step("acct_2", "Step B")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[tokio::test]
    async fn test_get_by_id_found() {
        let pool = helpers::create_memory_pool().await;
        let created = create(&pool, &make_step("acct_1", "Test Step")).await.unwrap();
        let fetched = get_by_id(&pool, &created.id, "acct_1").await.unwrap();
        assert_eq!(fetched.id, created.id);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_by_id(&pool, "nonexistent", "acct_1").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_step() {
        let pool = helpers::create_memory_pool().await;
        let mut created = create(&pool, &make_step("acct_1", "Old Name")).await.unwrap();
        created.name = "New Name".to_string();
        created.is_enabled = 0;
        let updated = update(&pool, &created).await.unwrap();
        assert_eq!(updated.name, "New Name");
        assert_eq!(updated.is_enabled, 0);
    }

    #[tokio::test]
    async fn test_delete_step() {
        let pool = helpers::create_memory_pool().await;
        let created = create(&pool, &make_step("acct_1", "Delete Me")).await.unwrap();
        delete(&pool, &created.id, "acct_1").await.unwrap();
        let result = get_by_id(&pool, &created.id, "acct_1").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = delete(&pool, "nonexistent", "acct_1").await;
        assert!(result.is_err());
    }
}
