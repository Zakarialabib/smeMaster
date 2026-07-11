//! `send_as_aliases` table data-access layer.
//!
//! CRUD helpers for the `send_as_aliases` table (aliases an account can send
//! mail as). Functions are async, take a `&SqlitePool`, and return
//! `Result<_, AppDbError>`. Account-scoped lookups/updates/deletes take an
//! `account_id`; single-row operations return `AppDbError::NotFound` when the
//! row is missing. All operations return `AppDbError::Database` on SQL failure.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::SendAsAlias;

/// List send-as aliases for an account (primary/default first, then oldest).
///
/// * `account_id` — owning account.
/// * Returns the matching `SendAsAlias` rows.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<SendAsAlias>, AppDbError> {
    sqlx::query_as::<_, SendAsAlias>(
        "SELECT * FROM send_as_aliases WHERE account_id = ? ORDER BY is_primary DESC, is_default DESC, created_at ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single send-as alias by id within an account.
///
/// * `id` — primary key of the alias.
/// * `account_id` — owning account (scopes the lookup).
/// * Returns the matching `SendAsAlias`.
/// * Errors: `AppDbError::NotFound` when no such alias exists for the account;
///   `AppDbError::Database` on SQL failure.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<SendAsAlias, AppDbError> {
    sqlx::query_as::<_, SendAsAlias>(
        "SELECT * FROM send_as_aliases WHERE id = ? AND account_id = ?",
    )
    .bind(id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Alias {} not found", id)))
}

/// Fetch the primary send-as alias (`is_primary = 1`) for an account.
///
/// * `account_id` — owning account.
/// * Returns the matching `SendAsAlias`.
/// * Errors: `AppDbError::NotFound` when the account has no primary alias;
///   `AppDbError::Database` on SQL failure.
pub async fn get_primary(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<SendAsAlias, AppDbError> {
    sqlx::query_as::<_, SendAsAlias>(
        "SELECT * FROM send_as_aliases WHERE account_id = ? AND is_primary = 1 LIMIT 1",
    )
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("No primary alias for account {}", account_id)))
}

/// Insert a new send-as alias, generating its `id` and `created_at`.
///
/// * `data` — alias fields (`id`/`created_at` overwritten by the database).
/// * Returns the newly created `SendAsAlias`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn create(
    pool: &SqlitePool,
    data: &SendAsAlias,
) -> Result<SendAsAlias, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, SendAsAlias>(
        r#"INSERT INTO send_as_aliases (
            id, account_id, email, display_name, reply_to_address,
            signature_id, is_primary, is_default, treat_as_alias,
            verification_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"#,
    )
    .bind(&id)
    .bind(&data.account_id)
    .bind(&data.email)
    .bind(&data.display_name)
    .bind(&data.reply_to_address)
    .bind(&data.signature_id)
    .bind(data.is_primary)
    .bind(data.is_default)
    .bind(data.treat_as_alias)
    .bind(&data.verification_status)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update an existing send-as alias by id and account, replacing mutable
/// columns.
///
/// * `data` — alias with updated fields; `data.id`/`data.account_id` scope it.
/// * Returns the updated `SendAsAlias`.
/// * Errors: `AppDbError::NotFound` when no matching alias exists;
///   `AppDbError::Database` on SQL failure.
pub async fn update(
    pool: &SqlitePool,
    data: &SendAsAlias,
) -> Result<SendAsAlias, AppDbError> {
    sqlx::query_as::<_, SendAsAlias>(
        r#"UPDATE send_as_aliases SET
            email = ?, display_name = ?, reply_to_address = ?, signature_id = ?,
            is_primary = ?, is_default = ?, treat_as_alias = ?, verification_status = ?
        WHERE id = ? AND account_id = ? RETURNING *"#,
    )
    .bind(&data.email)
    .bind(&data.display_name)
    .bind(&data.reply_to_address)
    .bind(&data.signature_id)
    .bind(data.is_primary)
    .bind(data.is_default)
    .bind(data.treat_as_alias)
    .bind(&data.verification_status)
    .bind(&data.id)
    .bind(&data.account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Alias {} not found", data.id)))
}

/// Delete a send-as alias by id and account.
///
/// * `id` — primary key of the alias.
/// * `account_id` — owning account (scopes the delete).
/// * Returns `()` on success.
/// * Errors: `AppDbError::NotFound` when no matching row exists (0 rows
///   affected); `AppDbError::Database` on SQL failure.
pub async fn delete(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<(), AppDbError> {
    let result = sqlx::query("DELETE FROM send_as_aliases WHERE id = ? AND account_id = ?")
        .bind(id)
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    if result.rows_affected() == 0 {
        return Err(AppDbError::NotFound(format!("Alias {} not found", id)));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    fn make_alias(account_id: &str, email: &str) -> SendAsAlias {
        SendAsAlias {
            id: String::new(),
            account_id: account_id.to_string(),
            email: email.to_string(),
            display_name: Some("Test User".to_string()),
            reply_to_address: None,
            signature_id: None,
            is_primary: 0,
            is_default: 0,
            treat_as_alias: 1,
            verification_status: "accepted".to_string(),
            created_at: 0,
        }
    }

    #[tokio::test]
    async fn test_create_alias() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let data = make_alias("acct_1", "test@example.com");
        let created = create(&pool, &data).await.unwrap();
        assert!(!created.id.is_empty());
        assert_eq!(created.email, "test@example.com");
        assert_eq!(created.account_id, "acct_1");
    }

    #[tokio::test]
    async fn test_list_aliases() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        create(&pool, &make_alias("acct_1", "a@example.com")).await.unwrap();
        create(&pool, &make_alias("acct_1", "b@example.com")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_list_aliases_scoped_to_account() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        helpers::insert_test_account(&pool, "acct_2").await;
        create(&pool, &make_alias("acct_1", "a@example.com")).await.unwrap();
        create(&pool, &make_alias("acct_2", "b@example.com")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[tokio::test]
    async fn test_get_by_id_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_alias("acct_1", "test@example.com")).await.unwrap();
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
    async fn test_get_primary_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut data = make_alias("acct_1", "primary@example.com");
        data.is_primary = 1;
        create(&pool, &data).await.unwrap();
        let primary = get_primary(&pool, "acct_1").await.unwrap();
        assert_eq!(primary.email, "primary@example.com");
        assert_eq!(primary.is_primary, 1);
    }

    #[tokio::test]
    async fn test_get_primary_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_primary(&pool, "acct_1").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_alias() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut created = create(&pool, &make_alias("acct_1", "old@example.com")).await.unwrap();
        created.email = "updated@example.com".to_string();
        created.display_name = Some("Updated Name".to_string());
        let updated = update(&pool, &created).await.unwrap();
        assert_eq!(updated.email, "updated@example.com");
        assert_eq!(updated.display_name, Some("Updated Name".to_string()));
    }

    #[tokio::test]
    async fn test_delete_alias() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_alias("acct_1", "delete@example.com")).await.unwrap();
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
