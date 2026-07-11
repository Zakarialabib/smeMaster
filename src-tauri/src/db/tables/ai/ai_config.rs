// ── AI Config query functions ─────────────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::ai::schema::AiConfig;

/// List all AI configs for a given account, ordered by `config_type`.
pub async fn list(pool: &SqlitePool, account_id: &str) -> Result<Vec<AiConfig>, AppDbError> {
    sqlx::query_as::<_, AiConfig>(
        "SELECT * FROM ai_config WHERE account_id = ? ORDER BY config_type ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single AI config by account and type.
///
/// Returns `None` (not an error) when no config matches.
pub async fn get_by_type(
    pool: &SqlitePool,
    account_id: &str,
    config_type: &str,
) -> Result<Option<AiConfig>, AppDbError> {
    sqlx::query_as::<_, AiConfig>(
        "SELECT * FROM ai_config WHERE account_id = ? AND config_type = ?",
    )
    .bind(account_id)
    .bind(config_type)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Insert or replace an AI config for a given account and type.
///
/// Uses `INSERT OR REPLACE` on the composite key `(account_id, config_type)`.
/// Auto-generates `id` (UUID v4) and sets timestamps to `now`.
pub async fn upsert(
    pool: &SqlitePool,
    account_id: &str,
    config_type: &str,
    config_json: &str,
    is_enabled: bool,
) -> Result<AiConfig, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();
    let is_enabled_int: i64 = if is_enabled { 1 } else { 0 };

    sqlx::query_as::<_, AiConfig>(
        "INSERT OR REPLACE INTO ai_config \
         (id, account_id, config_type, config_json, is_enabled, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
    )
    .bind(&id)
    .bind(account_id)
    .bind(config_type)
    .bind(config_json)
    .bind(is_enabled_int)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete an AI config by account and type.
pub async fn delete(
    pool: &SqlitePool,
    account_id: &str,
    config_type: &str,
) -> Result<(), AppDbError> {
    sqlx::query("DELETE FROM ai_config WHERE account_id = ? AND config_type = ?")
        .bind(account_id)
        .bind(config_type)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_upsert_and_get_by_type() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;

        let cfg = upsert(&pool, "acc-1", "model", r#"{"provider":"openai"}"#, true)
            .await
            .unwrap();
        assert_eq!(cfg.account_id, "acc-1");
        assert_eq!(cfg.config_type, "model");
        assert_eq!(cfg.config_json, r#"{"provider":"openai"}"#);
        assert_eq!(cfg.is_enabled, 1);

        let fetched = get_by_type(&pool, "acc-1", "model")
            .await
            .unwrap()
            .expect("config should exist");
        assert_eq!(fetched.id, cfg.id);
        assert_eq!(fetched.config_json, r#"{"provider":"openai"}"#);
    }

    #[tokio::test]
    async fn test_upsert_overwrites_existing() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;

        upsert(&pool, "acc-1", "model", r#"{"provider":"openai"}"#, true)
            .await
            .unwrap();
        let second = upsert(&pool, "acc-1", "model", r#"{"provider":"anthropic"}"#, false)
            .await
            .unwrap();

        assert_eq!(second.config_json, r#"{"provider":"anthropic"}"#);
        assert_eq!(second.is_enabled, 0);

        let fetched = get_by_type(&pool, "acc-1", "model")
            .await
            .unwrap()
            .expect("should exist after overwrite");
        assert_eq!(fetched.config_json, r#"{"provider":"anthropic"}"#);
        assert_eq!(fetched.is_enabled, 0);
    }

    #[tokio::test]
    async fn test_list_returns_all_configs_ordered_by_type() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;

        upsert(&pool, "acc-1", "model", r#"{}"#, true)
            .await
            .unwrap();
        upsert(&pool, "acc-1", "prompt", r#"{}"#, true)
            .await
            .unwrap();
        upsert(&pool, "acc-1", "agent", r#"{}"#, false)
            .await
            .unwrap();

        let configs = list(&pool, "acc-1").await.unwrap();
        assert_eq!(configs.len(), 3);
        // Ordered by config_type ASC: agent, model, prompt
        assert_eq!(configs[0].config_type, "agent");
        assert_eq!(configs[1].config_type, "model");
        assert_eq!(configs[2].config_type, "prompt");
    }

    #[tokio::test]
    async fn test_list_filters_by_account() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;
        helpers::insert_test_account(&pool, "acc-2").await;

        upsert(&pool, "acc-1", "model", r#"{}"#, true)
            .await
            .unwrap();
        upsert(&pool, "acc-2", "model", r#"{}"#, true)
            .await
            .unwrap();

        let list_a = list(&pool, "acc-1").await.unwrap();
        assert_eq!(list_a.len(), 1);
        assert_eq!(list_a[0].account_id, "acc-1");

        let list_b = list(&pool, "acc-2").await.unwrap();
        assert_eq!(list_b.len(), 1);
        assert_eq!(list_b[0].account_id, "acc-2");
    }

    #[tokio::test]
    async fn test_delete_removes_config() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;

        upsert(&pool, "acc-1", "model", r#"{}"#, true)
            .await
            .unwrap();
        delete(&pool, "acc-1", "model").await.unwrap();

        let result = get_by_type(&pool, "acc-1", "model")
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_by_type_returns_none_for_missing() {
        let pool = helpers::create_memory_pool().await;

        let result = get_by_type(&pool, "acc-1", "nonexistent")
            .await
            .unwrap();
        assert!(result.is_none());
    }
}
