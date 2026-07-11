//! Deliverability config — per-type config blobs (dkim/spf/dmarc, …) for an
//! account. One active config per `(account_id, config_type)`. CRUD helpers:
//! `list`, `get_by_type`, `upsert`, `delete`.

use sqlx::SqlitePool;
use crate::db::common::delete_or_not_found;
use crate::db::error::AppDbError;
use crate::db::deliverability::schema::DeliverabilityConfig;

/// List all deliverability configs for an account.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
///
/// # Returns
/// All configs for the account ordered by `created_at DESC`. An empty `Vec`
/// (not an error) when the account has none.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<DeliverabilityConfig>, AppDbError> {
    sqlx::query_as::<_, DeliverabilityConfig>(
        "SELECT * FROM deliverability_config WHERE account_id = ? ORDER BY created_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get the active config for a specific type (e.g. "dkim", "spf", "dmarc").
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
/// * `config_type` — config discriminator to look up.
///
/// # Returns
/// `Some(DeliverabilityConfig)` for the newest row of that type (ordered by
/// `updated_at DESC LIMIT 1`), or `None` when no config of that type exists.
/// This is **not** an error.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn get_by_type(
    pool: &SqlitePool,
    account_id: &str,
    config_type: &str,
) -> Result<Option<DeliverabilityConfig>, AppDbError> {
    sqlx::query_as::<_, DeliverabilityConfig>(
        "SELECT * FROM deliverability_config WHERE account_id = ? AND config_type = ? ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(account_id)
    .bind(config_type)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Insert or replace a deliverability config.
///
/// Uses `ON CONFLICT(account_id, config_type) DO UPDATE`, so each account has
/// at most one config per type. A fresh UUID primary key is generated on every
/// call; on conflict only `config_json`, `is_active` and `updated_at` are
/// overwritten (the original `created_at` is retained by the DB).
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id (part of the conflict key).
/// * `config_type` — config discriminator (part of the conflict key).
/// * `config_json` — JSON config payload.
/// * `is_active` — whether this config is the active one.
///
/// # Returns
/// The freshly written `DeliverabilityConfig` row.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn upsert(
    pool: &SqlitePool,
    account_id: &str,
    config_type: &str,
    config_json: &str,
    is_active: bool,
) -> Result<DeliverabilityConfig, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, DeliverabilityConfig>(
        r#"
        INSERT INTO deliverability_config (id, account_id, config_type, config_json, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, config_type) DO UPDATE
        SET config_json = excluded.config_json,
            is_active = excluded.is_active,
            updated_at = excluded.updated_at
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(config_type)
    .bind(config_json)
    .bind(is_active as i64)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete a deliverability config by its primary key.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the config to delete.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`"DeliverabilityConfig with id '<id>' not
/// found"`) when no config matches `id` (the shared `delete_or_not_found` helper
/// wraps the statement in `sqlx::AssertSqlSafe` and interpolates `id` into the
/// SQL). Returns `AppDbError::Database` on query failure.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    delete_or_not_found(
        pool,
        format!("DELETE FROM deliverability_config WHERE id = '{id}'"),
        id,
        "DeliverabilityConfig",
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_upsert_and_list() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-test-1";
        helpers::insert_test_account(&pool, account_id).await;
        let config_type = "dkim";
        let config_json = r#"{"selector":"default","private_key":"abc"}"#;

        let config = upsert(&pool, account_id, config_type, config_json, true)
            .await
            .unwrap();
        assert_eq!(config.account_id, account_id);
        assert_eq!(config.config_type, config_type);
        assert_eq!(config.config_json, config_json);
        assert_eq!(config.is_active, 1);

        let items = list(&pool, account_id).await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, config.id);
    }

    #[tokio::test]
    async fn test_get_by_type_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-test-2").await;
        let config = upsert(&pool, "acc-test-2", "spf", r#"{"include":"_spf.example.com"}"#, false)
            .await
            .unwrap();
        let found = get_by_type(&pool, "acc-test-2", "spf")
            .await
            .unwrap()
            .expect("should find config");
        assert_eq!(found.id, config.id);
        assert_eq!(found.is_active, 0);
    }

    #[tokio::test]
    async fn test_get_by_type_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_by_type(&pool, "acc-none", "dmarc").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_upsert_replaces_existing() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-test-3";
        helpers::insert_test_account(&pool, account_id).await;
        let _first = upsert(&pool, account_id, "dkim", r#"{"v":"1"}"#, true)
            .await
            .unwrap();
        let second = upsert(&pool, account_id, "dkim", r#"{"v":"2"}"#, false)
            .await
            .unwrap();
        assert_eq!(second.config_json, r#"{"v":"2"}"#);
        assert_eq!(second.is_active, 0);
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-test-4").await;
        let config = upsert(&pool, "acc-test-4", "dmarc", r#"{"rua":"mailto:dmarc@ex.com"}"#, true)
            .await
            .unwrap();
        delete(&pool, &config.id).await.unwrap();
        let result = get_by_type(&pool, "acc-test-4", "dmarc").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = delete(&pool, "non-existent-id").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
