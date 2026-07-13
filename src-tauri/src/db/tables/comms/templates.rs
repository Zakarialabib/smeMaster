//! Email `templates` table data-access layer.
//!
//! Provides CRUD and query helpers for the `templates` table. All functions are
//! async, take a `&SqlitePool`, and return `Result<_, AppDbError>`. Single-row
//! lookups and updates return `AppDbError::NotFound` when the row is absent;
//! every operation returns `AppDbError::Database` on SQL failure. Dynamically
//! built statements use `sqlx::AssertSqlSafe` (see notes below).

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::Template;

/// Row shape for a count aggregation over templates.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CountRow {
    /// Number of rows matched by the query.
    pub count: i64,
}

/// List all templates visible to a company, including global (NULL company)
/// ones, ordered by `sort_order` ascending.
///
/// * `company_id` — company scope; rows with a NULL `company_id` are always
///   included.
/// * Returns the matching `Template` rows.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<Vec<Template>, AppDbError> {
    sqlx::query_as::<_, Template>(
        "SELECT * FROM templates WHERE company_id IS NULL OR company_id = ? ORDER BY sort_order ASC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single template by id.
///
/// * `id` — primary key of the template.
/// * Returns the matching `Template`.
/// * Errors: `AppDbError::NotFound` when no template has that `id`;
///   `AppDbError::Database` on SQL failure.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Template, AppDbError> {
    sqlx::query_as::<_, Template>("SELECT * FROM templates WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("Template {} not found", id)))
}

/// Fetch a single template by id, returning `None` rather than an error if it
/// does not exist.
///
/// * `id` — primary key of the template.
/// * Returns `Some(Template)` when found, `None` when absent.
/// * Errors: `AppDbError::Database` on SQL failure (never `NotFound`).
pub async fn get_by_id_opt(pool: &SqlitePool, id: &str) -> Result<Option<Template>, AppDbError> {
    sqlx::query_as::<_, Template>("SELECT * FROM templates WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Insert a new template, generating its `id` and `created_at`.
///
/// * `data` — template fields; `id`/`created_at`/`usage_count` are overwritten
///   by the database (usage starts at 0).
/// * Returns the newly created `Template`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn create(pool: &SqlitePool, data: &Template) -> Result<Template, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    // SQLite can't enforce a FK on category_id (added via ALTER in 024), so
    // validate ownership here: a category must belong to the same company
    // (or be a system category) to prevent orphaned references.
    if let Some(cat_id) = &data.category_id {
        let owns = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM template_categories \
             WHERE id = ? AND (company_id = ? OR is_system = 1)",
        )
        .bind(cat_id)
        .bind(&data.company_id)
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)?;
        if owns == 0 {
            return Err(AppDbError::Validation(format!(
                "category {cat_id} does not belong to company {}",
                data.company_id
            )));
        }
    }

    sqlx::query_as::<_, Template>(
        r#"INSERT INTO templates (
            id, company_id, name, subject, body_html, shortcut, sort_order,
            category_id, is_favorite, usage_count, last_used_at,
            conditional_blocks_json, template_type, origin,
            delivery_config_json, ai_config_json, voice_config_json,
            compliance_profile_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"#,
    )
    .bind(&id)
    .bind(&data.company_id)
    .bind(&data.name)
    .bind(&data.subject)
    .bind(&data.body_html)
    .bind(&data.shortcut)
    .bind(data.sort_order)
    .bind(&data.category_id)
    .bind(data.is_favorite)
    .bind(&data.conditional_blocks_json)
    .bind(&data.template_type)
    .bind(&data.origin)
    .bind(&data.delivery_config_json)
    .bind(&data.ai_config_json)
    .bind(&data.voice_config_json)
    .bind(&data.compliance_profile_id)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

pub async fn update(pool: &SqlitePool, data: &Template) -> Result<Template, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, Template>(
        r#"UPDATE templates SET
            name = ?, subject = ?, body_html = ?, shortcut = ?, sort_order = ?,
            category_id = ?, is_favorite = ?,
            conditional_blocks_json = ?, template_type = ?, origin = ?,
            delivery_config_json = ?, ai_config_json = ?, voice_config_json = ?,
            compliance_profile_id = ?, updated_at = ?
        WHERE id = ? RETURNING *"#,
    )
    .bind(&data.name)
    .bind(&data.subject)
    .bind(&data.body_html)
    .bind(&data.shortcut)
    .bind(data.sort_order)
    .bind(&data.category_id)
    .bind(data.is_favorite)
    .bind(&data.conditional_blocks_json)
    .bind(&data.template_type)
    .bind(&data.origin)
    .bind(&data.delivery_config_json)
    .bind(&data.ai_config_json)
    .bind(&data.voice_config_json)
    .bind(&data.compliance_profile_id)
    .bind(now)
    .bind(&data.id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Template {} not found", data.id)))
}

/// Persist an explicit template ordering for a company.
///
/// * `ordered_ids` — template ids in the desired order; index becomes `sort_order`.
///   Ids not present keep their existing order. Runs in a transaction.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn reorder(
    pool: &SqlitePool,
    ordered_ids: &[String],
) -> Result<(), AppDbError> {
    let mut tx = pool.begin().await.map_err(AppDbError::Database)?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        sqlx::query("UPDATE templates SET sort_order = ?, updated_at = ? WHERE id = ?")
            .bind(idx as i64)
            .bind(chrono::Utc::now().timestamp())
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(AppDbError::Database)?;
    }
    tx.commit().await.map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete a template by id.
///
/// * `id` — primary key of the template.
/// * Returns `()` on success.
/// * Errors: `AppDbError::NotFound` when no row with `id` exists (0 rows
///   affected); `AppDbError::Database` on SQL failure.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let result = sqlx::query("DELETE FROM templates WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    if result.rows_affected() == 0 {
        return Err(AppDbError::NotFound(format!("Template {} not found", id)));
    }
    Ok(())
}

/// Increment a template's `usage_count` and set `last_used_at` to now.
///
/// * `id` — primary key of the template.
/// * Returns the updated `Template`.
/// * Errors: `AppDbError::NotFound` when no template has `id`;
///   `AppDbError::Database` on SQL failure.
pub async fn increment_usage(
    pool: &SqlitePool,
    id: &str,
) -> Result<Template, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, Template>(
        r#"UPDATE templates SET
            usage_count = usage_count + 1,
            last_used_at = ?
        WHERE id = ? RETURNING *"#,
    )
    .bind(now)
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Template {} not found", id)))
}

/// Count templates optionally filtered by `template_type` and `origin`.
///
/// * `template_type` — optional exact match on the `template_type` column.
/// * `origin` — optional exact match on the `origin` column.
/// * Returns the matching row count.
/// * Errors: `AppDbError::Database` on SQL failure.
/// * SQL-safety: the WHERE clause is assembled dynamically and executed via
///   `sqlx::AssertSqlSafe`, so callers must not pass untrusted literals into it.
pub async fn count(
    pool: &SqlitePool,
    template_type: Option<&str>,
    origin: Option<&str>,
) -> Result<i64, AppDbError> {
    let mut sql = "SELECT COUNT(*) as cnt FROM templates WHERE 1=1".to_string();
    if template_type.is_some() { sql.push_str(" AND template_type = ?"); }
    if origin.is_some() { sql.push_str(" AND origin = ?"); }
    
    let mut q = sqlx::query_as::<_, (i64,)>(sqlx::AssertSqlSafe(sql));
    if let Some(tt) = template_type { q = q.bind(tt); }
    if let Some(o) = origin { q = q.bind(o); }
    
    q.fetch_one(pool).await.map(|r| r.0).map_err(AppDbError::Database)
}

/// Insert a template, ignoring if a row with the same id already exists.
pub async fn insert_ignore(
    pool: &SqlitePool,
    id: &str,
    company_id: Option<&str>,
    name: &str,
    subject: Option<&str>,
    body_html: &str,
    shortcut: Option<&str>,
    sort_order: i64,
    category_id: Option<&str>,
    is_favorite: i64,
    template_type: &str,
    origin: &str,
    delivery_config_json: Option<&str>,
    ai_config_json: Option<&str>,
    voice_config_json: Option<&str>,
    compliance_profile_id: Option<&str>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        r#"INSERT OR IGNORE INTO templates (
            id, company_id, name, subject, body_html, shortcut, sort_order,
            category_id, is_favorite, usage_count, last_used_at,
            conditional_blocks_json, template_type, origin,
            delivery_config_json, ai_config_json, voice_config_json,
            compliance_profile_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, '[]', ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(id)
    .bind(company_id)
    .bind(name)
    .bind(subject)
    .bind(body_html)
    .bind(shortcut)
    .bind(sort_order)
    .bind(category_id)
    .bind(is_favorite)
    .bind(template_type)
    .bind(origin)
    .bind(delivery_config_json)
    .bind(ai_config_json)
    .bind(voice_config_json)
    .bind(compliance_profile_id)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Partially update template fields using dynamic `UpdateFields`.
///
/// * `id` — primary key of the template.
/// * `fields` — map of column values to set (`fields.set`) and columns to clear
///   to NULL (`fields.unset`).
/// * Returns `()`. When both maps are empty the row is still touched by a no-op
/// Columns that may be partially updated via `update_fields`. Any other key is
/// rejected to prevent column-identifier injection: keys are interpolated into
/// the SET clause, while only values are parameter-bound.
const ALLOWED_TEMPLATE_FIELDS: &[&str] = &[
    "name",
    "subject",
    "body_html",
    "shortcut",
    "sort_order",
    "category_id",
    "is_favorite",
    "conditional_blocks_json",
    "template_type",
    "origin",
    "delivery_config_json",
    "ai_config_json",
    "voice_config_json",
    "compliance_profile_id",
    "usage_count",
    "last_used_at",
];

pub async fn update_fields(
    pool: &SqlitePool,
    id: &str,
    fields: &crate::db::commands::UpdateFields,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    if fields.set.is_empty() && fields.unset.is_empty() {
        sqlx::query("UPDATE templates SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppDbError::Database)?;
        return Ok(());
    }
    let mut set_parts: Vec<String> =
        Vec::with_capacity(fields.set.len() + 1 + fields.unset.len());
    let mut set_values: Vec<serde_json::Value> = Vec::with_capacity(fields.set.len());
    for key in &fields.unset {
        if !ALLOWED_TEMPLATE_FIELDS.contains(&key.as_str()) {
            return Err(AppDbError::Validation(format!(
                "unknown template field: {key}"
            )));
        }
        set_parts.push(format!("\"{key}\" = NULL"));
    }
    for (key, value) in &fields.set {
        if !ALLOWED_TEMPLATE_FIELDS.contains(&key.as_str()) {
            return Err(AppDbError::Validation(format!(
                "unknown template field: {key}"
            )));
        }
        set_parts.push(format!("\"{key}\" = ?"));
        set_values.push(value.clone());
    }
    set_parts.push("\"updated_at\" = ?".to_string());
    let sql = format!(
        "UPDATE templates SET {} WHERE id = ?",
        set_parts.join(", ")
    );
    // Safe: every key in `set_parts` was validated against ALLOWED_TEMPLATE_FIELDS
    // above, so no caller-controlled identifier reaches the SQL text.
    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql));
    for val in &set_values {
        q = q.bind(val);
    }
    q = q.bind(now);
    q = q.bind(id);
    q.execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

/// Get templates by template_type for an account.
pub async fn list_by_type(
    pool: &SqlitePool,
    company_id: &str,
    template_type: &str,
) -> Result<Vec<Template>, AppDbError> {
    sqlx::query_as::<_, Template>(
        "SELECT * FROM templates WHERE (company_id IS NULL OR company_id = ?) AND template_type = ? ORDER BY sort_order ASC",
    )
    .bind(company_id)
    .bind(template_type)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List favorite (`is_favorite = 1`) templates for a company.
///
/// * `company_id` — company scope (NULL-company rows included).
/// * Returns the matching `Template` rows ordered by `sort_order`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list_favorites(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<Vec<Template>, AppDbError> {
    sqlx::query_as::<_, Template>(
        "SELECT * FROM templates WHERE (company_id IS NULL OR company_id = ?) AND is_favorite = 1 ORDER BY sort_order ASC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List the most-used templates for a company, bounded by `limit`.
///
/// * `company_id` — company scope (NULL-company rows included).
/// * `limit` — maximum number of rows to return.
/// * Returns `Template` rows ordered by `usage_count` then `last_used_at`,
///   descending.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list_most_used(
    pool: &SqlitePool,
    company_id: &str,
    limit: i64,
) -> Result<Vec<Template>, AppDbError> {
    sqlx::query_as::<_, Template>(
        "SELECT * FROM templates WHERE (company_id IS NULL OR company_id = ?) ORDER BY usage_count DESC, last_used_at DESC LIMIT ?",
    )
    .bind(company_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ContentRow {
    pub subject: Option<String>,
    pub body_html: String,
}

/// Get template content (subject, body_html) by id.
pub async fn get_content(
    pool: &SqlitePool,
    template_id: &str,
) -> Result<Option<ContentRow>, AppDbError> {
    sqlx::query_as::<_, ContentRow>(
        "SELECT subject, body_html FROM templates WHERE id = ?"
    )
    .bind(template_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List templates for a company with pagination and optional type/origin filters.
///
/// * `company_id` — company scope.
/// * `limit` / `offset` — pagination window.
/// * `template_type` / `origin` — optional exact-match filters.
/// * Returns the matching `Template` rows ordered by `sort_order`, `name`.
/// * Errors: `AppDbError::Database` on SQL failure.
/// * SQL-safety: the WHERE clause is assembled dynamically and executed via
///   `sqlx::AssertSqlSafe`; only the bind values are user-supplied.
pub async fn list_paginated(
    pool: &SqlitePool,
    company_id: &str,
    limit: i64,
    offset: i64,
    template_type: Option<&str>,
    origin: Option<&str>,
) -> Result<Vec<Template>, AppDbError> {
    let mut sql = "SELECT * FROM templates WHERE company_id = ?".to_string();
    if template_type.is_some() { sql.push_str(" AND template_type = ?"); }
    if origin.is_some() { sql.push_str(" AND origin = ?"); }
    sql.push_str(" ORDER BY sort_order ASC, name ASC LIMIT ? OFFSET ?");

    let mut q = sqlx::query_as::<_, Template>(sqlx::AssertSqlSafe(sql));
    q = q.bind(company_id);
    if let Some(tt) = template_type { q = q.bind(tt); }
    if let Some(o) = origin { q = q.bind(o); }
    q = q.bind(limit).bind(offset);

    q.fetch_all(pool).await.map_err(AppDbError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;
    

    fn make_template(company_id: &str, name: &str) -> Template {
        Template {
            id: String::new(),
            company_id: company_id.to_string(),
            name: name.to_string(),
            subject: Some("Subject".to_string()),
            body_html: "<p>Body</p>".to_string(),
            shortcut: Some("t".to_string()),
            sort_order: 0,
            category_id: None,
            is_favorite: 0,
            usage_count: 0,
            last_used_at: None,
            conditional_blocks_json: None,
            template_type: "email".to_string(),
            origin: "user_created".to_string(),
            delivery_config_json: None,
            ai_config_json: None,
            voice_config_json: None,
            compliance_profile_id: None,
            created_at: 0,
        }
    }

    #[tokio::test]
    async fn test_create_template() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let data = make_template("acct_1", "Welcome Email");
        let created = create(&pool, &data).await.unwrap();
        assert!(!created.id.is_empty());
        assert_eq!(created.name, "Welcome Email");
        assert_eq!(created.template_type, "email");
    }

    #[tokio::test]
    async fn test_list_templates() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        create(&pool, &make_template("acct_1", "Template A")).await.unwrap();
        create(&pool, &make_template("acct_1", "Template B")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_list_templates_includes_global() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut global = make_template("acct_1", "Global");
        global.company_id = String::new();
        create(&pool, &global).await.unwrap();
        create(&pool, &make_template("acct_1", "Personal")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_get_by_id_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_template("acct_1", "Test Template")).await.unwrap();
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
    async fn test_update_template() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut created = create(&pool, &make_template("acct_1", "Old Name")).await.unwrap();
        created.name = "New Name".to_string();
        created.subject = Some("New Subject".to_string());
        let updated = update(&pool, &created).await.unwrap();
        assert_eq!(updated.name, "New Name");
        assert_eq!(updated.subject, Some("New Subject".to_string()));
    }

    #[tokio::test]
    async fn test_delete_template() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_template("acct_1", "Delete Me")).await.unwrap();
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

    #[tokio::test]
    async fn test_increment_usage() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_template("acct_1", "Usage Test")).await.unwrap();
        let incremented = increment_usage(&pool, &created.id).await.unwrap();
        assert_eq!(incremented.usage_count, 1);
        assert!(incremented.last_used_at.is_some());
        let incremented_again = increment_usage(&pool, &created.id).await.unwrap();
        assert_eq!(incremented_again.usage_count, 2);
    }

    #[tokio::test]
    async fn test_increment_usage_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = increment_usage(&pool, "nonexistent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_fields_rejects_unknown_column() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_template("acct_1", "Col Test")).await.unwrap();
        // A caller-supplied key that is not an allowlisted column must be rejected,
        // not interpolated into the SET clause (column-identifier injection guard).
        let bad = crate::db::commands::UpdateFields {
            set: std::collections::HashMap::from([
                ("is_admin".to_string(), serde_json::json!(1)),
            ]),
            unset: vec![],
        };
        let res = update_fields(&pool, &created.id, &bad).await;
        assert!(matches!(res, Err(AppDbError::Validation(_))), "expected Validation error, got {res:?}");
    }

    #[tokio::test]
    async fn test_reorder_persists_sort_order() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let a = create(&pool, &make_template("acct_1", "A")).await.unwrap();
        let b = create(&pool, &make_template("acct_1", "B")).await.unwrap();
        let c = create(&pool, &make_template("acct_1", "C")).await.unwrap();
        reorder(&pool, &[c.id.clone(), b.id.clone(), a.id.clone()]).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        let by_name: std::collections::HashMap<_, _> = rows
            .iter()
            .map(|t| (t.name.clone(), t.sort_order))
            .collect();
        assert_eq!(by_name["C"], 0);
        assert_eq!(by_name["B"], 1);
        assert_eq!(by_name["A"], 2);
    }
}
