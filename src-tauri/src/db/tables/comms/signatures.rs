//! `signatures` table data-access layer.
//!
//! CRUD helpers for the `signatures` table (per-account email signatures).
//! Functions are async, take a `&SqlitePool`, and return `Result<_, AppDbError>`.
//! Account-scoped lookups/updates/deletes take an `account_id` and return
//! `AppDbError::NotFound` when no matching row exists; all operations return
//! `AppDbError::Database` on SQL failure. `update_fields` uses
//! `sqlx::AssertSqlSafe` (see below).

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::Signature;

/// List signatures for an account, ordered by `sort_order` ascending.
///
/// * `account_id` — owning account.
/// * Returns the matching `Signature` rows.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list(pool: &SqlitePool, account_id: &str) -> Result<Vec<Signature>, AppDbError> {
    sqlx::query_as::<_, Signature>(
        "SELECT * FROM signatures WHERE account_id = ? ORDER BY sort_order ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single signature by id within an account.
///
/// * `id` — primary key of the signature.
/// * `account_id` — owning account (scopes the lookup).
/// * Returns the matching `Signature`.
/// * Errors: `AppDbError::NotFound` when no such signature exists for the
///   account; `AppDbError::Database` on SQL failure.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<Signature, AppDbError> {
    sqlx::query_as::<_, Signature>(
        "SELECT * FROM signatures WHERE id = ? AND account_id = ?",
    )
    .bind(id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Signature {} not found", id)))
}

/// Fetch the default signature (`is_default = 1`) for an account.
///
/// * `account_id` — owning account.
/// * Returns the matching `Signature`.
/// * Errors: `AppDbError::NotFound` when the account has no default signature;
///   `AppDbError::Database` on SQL failure.
pub async fn get_default(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Signature, AppDbError> {
    sqlx::query_as::<_, Signature>(
        "SELECT * FROM signatures WHERE account_id = ? AND is_default = 1 LIMIT 1",
    )
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("No default signature for account {}", account_id)))
}

/// Insert a new signature, generating its `id` and `created_at`.
///
/// * `data` — signature fields (`id`/`created_at` overwritten by the database).
/// * Returns the newly created `Signature`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn create(pool: &SqlitePool, data: &Signature) -> Result<Signature, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, Signature>(
        r#"INSERT INTO signatures (
            id, account_id, name, body_html, is_default, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *"#,
    )
    .bind(&id)
    .bind(&data.account_id)
    .bind(&data.name)
    .bind(&data.body_html)
    .bind(data.is_default)
    .bind(data.sort_order)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update an existing signature by id and account, replacing mutable columns.
///
/// * `data` — signature with updated fields; `data.id` and `data.account_id`
///   scope the update.
/// * Returns the updated `Signature`.
/// * Errors: `AppDbError::NotFound` when no matching signature exists;
///   `AppDbError::Database` on SQL failure.
pub async fn update(pool: &SqlitePool, data: &Signature) -> Result<Signature, AppDbError> {
    sqlx::query_as::<_, Signature>(
        r#"UPDATE signatures SET
            name = ?, body_html = ?, is_default = ?, sort_order = ?
        WHERE id = ? AND account_id = ? RETURNING *"#,
    )
    .bind(&data.name)
    .bind(&data.body_html)
    .bind(data.is_default)
    .bind(data.sort_order)
    .bind(&data.id)
    .bind(&data.account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Signature {} not found", data.id)))
}

/// Delete a signature by id and account.
///
/// * `id` — primary key of the signature.
/// * `account_id` — owning account (scopes the delete).
/// * Returns `()` on success.
/// * Errors: `AppDbError::NotFound` when no matching row exists (0 rows
///   affected); `AppDbError::Database` on SQL failure.
pub async fn delete(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<(), AppDbError> {
    let result = sqlx::query("DELETE FROM signatures WHERE id = ? AND account_id = ?")
        .bind(id)
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    if result.rows_affected() == 0 {
        return Err(AppDbError::NotFound(format!("Signature {} not found", id)));
    }
    Ok(())
}

/// Fetch a signature by id, returning `None` rather than an error if absent.
///
/// * `id` — primary key of the signature.
/// * Returns `Some(Signature)` when found, `None` when absent.
/// * Errors: `AppDbError::Database` on SQL failure (never `NotFound`).
pub async fn get_by_id_opt(pool: &SqlitePool, id: &str) -> Result<Option<Signature>, AppDbError> {
    sqlx::query_as::<_, Signature>("SELECT * FROM signatures WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Partially update signature fields using dynamic `UpdateFields`.
///
/// * `id` — primary key of the signature.
/// * `fields` — columns to set (`fields.set`) and to clear to NULL
///   (`fields.unset`).
/// * Returns `()`. When both maps are empty this is a no-op (returns `Ok(())`
///   without touching the row).
/// * Errors: `AppDbError::Database` on SQL failure. A non-existent `id` does NOT
///   error here (0 rows affected silently).
/// * SQL-safety: the SET list is built from the `fields` keys and executed via
///   `sqlx::AssertSqlSafe`; values are bound positionally, so callers must only
///   supply valid column names in `fields`.
pub async fn update_fields(
    pool: &SqlitePool,
    id: &str,
    fields: &crate::db::commands::UpdateFields,
) -> Result<(), AppDbError> {
    let _now = chrono::Utc::now().timestamp();
    let set_count = fields.set.len();
    if set_count == 0 && fields.unset.is_empty() {
        return Ok(());
    }
    let mut set_parts: Vec<String> = Vec::with_capacity(set_count + 1 + fields.unset.len());
    let mut set_values: Vec<serde_json::Value> = Vec::with_capacity(set_count);
    for key in &fields.unset {
        set_parts.push(format!("\"{key}\" = NULL"));
    }
    for (key, value) in &fields.set {
        set_parts.push(format!("\"{key}\" = ?"));
        set_values.push(value.clone());
    }
    let sql = format!("UPDATE signatures SET {} WHERE id = ?", set_parts.join(", "));
    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql));
    for val in &set_values { q = q.bind(val); }
    q.bind(id).execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

/// Unmark all signatures for an account as default (`is_default = 0`).
///
/// * `account_id` — owning account.
/// * Returns `()`. This does not error when the account has no signatures.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn clear_default(pool: &SqlitePool, account_id: &str) -> Result<(), AppDbError> {
    sqlx::query("UPDATE signatures SET is_default = 0 WHERE account_id = ?")
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Insert a signature, ignoring if id exists.
pub async fn insert_ignore(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
    name: &str,
    body_html: &str,
    is_default: i64,
    sort_order: i64,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT OR IGNORE INTO signatures (id, account_id, name, body_html, is_default, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id).bind(account_id).bind(name).bind(body_html).bind(is_default).bind(sort_order).bind(now)
    .execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;
    

    fn make_signature(account_id: &str) -> Signature {
        Signature {
            id: String::new(),
            account_id: account_id.to_string(),
            name: "My Sig".to_string(),
            body_html: "<p>Best regards</p>".to_string(),
            is_default: 0,
            sort_order: 1,
            created_at: 0,
        }
    }

    #[tokio::test]
    async fn test_create_signature() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let data = make_signature("acct_1");
        let created = create(&pool, &data).await.unwrap();
        assert!(!created.id.is_empty());
        assert_eq!(created.name, "My Sig");
        assert_eq!(created.account_id, "acct_1");
    }

    #[tokio::test]
    async fn test_list_signatures() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        create(&pool, &make_signature("acct_1")).await.unwrap();
        create(&pool, &make_signature("acct_1")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_list_signatures_scoped() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        helpers::insert_test_account(&pool, "acct_2").await;
        create(&pool, &make_signature("acct_1")).await.unwrap();
        create(&pool, &make_signature("acct_2")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[tokio::test]
    async fn test_get_by_id_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_signature("acct_1")).await.unwrap();
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
    async fn test_get_default_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut data = make_signature("acct_1");
        data.is_default = 1;
        data.name = "Default Sig".to_string();
        create(&pool, &data).await.unwrap();
        let default = get_default(&pool, "acct_1").await.unwrap();
        assert_eq!(default.is_default, 1);
    }

    #[tokio::test]
    async fn test_get_default_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_default(&pool, "acct_1").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_signature() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut created = create(&pool, &make_signature("acct_1")).await.unwrap();
        created.name = "Updated Sig".to_string();
        created.body_html = "<p>Updated</p>".to_string();
        let updated = update(&pool, &created).await.unwrap();
        assert_eq!(updated.name, "Updated Sig");
        assert_eq!(updated.body_html, "<p>Updated</p>");
    }

    #[tokio::test]
    async fn test_delete_signature() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_signature("acct_1")).await.unwrap();
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
