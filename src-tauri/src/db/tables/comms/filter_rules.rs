//! `filter_rules` table data-access layer.
//!
//! CRUD and reporting helpers for the `filter_rules` table (mail filtering).
//! Functions are async, take a `&SqlitePool`, and return `Result<_, AppDbError>`.
//! Account-scoped lookups/updates/deletes take an `account_id`; single-row
//! operations return `AppDbError::NotFound` when the row is missing. All
//! operations return `AppDbError::Database` on SQL failure.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::FilterRule;

/// List filter rules for an account, ordered by `sort_order` ascending.
///
/// * `account_id` — owning account.
/// * Returns the matching `FilterRule` rows.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list(pool: &SqlitePool, account_id: &str) -> Result<Vec<FilterRule>, AppDbError> {
    sqlx::query_as::<_, FilterRule>(
        "SELECT * FROM filter_rules WHERE account_id = ? ORDER BY sort_order ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single filter rule by id within an account.
///
/// * `id` — primary key of the rule.
/// * `account_id` — owning account (scopes the lookup).
/// * Returns the matching `FilterRule`.
/// * Errors: `AppDbError::NotFound` when no such rule exists for the account;
///   `AppDbError::Database` on SQL failure.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<FilterRule, AppDbError> {
    sqlx::query_as::<_, FilterRule>(
        "SELECT * FROM filter_rules WHERE id = ? AND account_id = ?",
    )
    .bind(id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Filter rule {} not found", id)))
}

pub async fn create(pool: &SqlitePool, data: &FilterRule) -> Result<FilterRule, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, FilterRule>(
        r#"INSERT INTO filter_rules (
            id, account_id, name, is_enabled, criteria_json, actions_json,
            group_operator, score_threshold, chaining_action, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"#,
    )
    .bind(&id)
    .bind(&data.account_id)
    .bind(&data.name)
    .bind(data.is_enabled)
    .bind(&data.criteria_json)
    .bind(&data.actions_json)
    .bind(&data.group_operator)
    .bind(data.score_threshold)
    .bind(&data.chaining_action)
    .bind(data.sort_order)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update an existing filter rule by id and account, replacing mutable columns.
///
/// * `data` — rule with updated fields; `data.id`/`data.account_id` scope it.
/// * Returns the updated `FilterRule`.
/// * Errors: `AppDbError::NotFound` when no matching rule exists;
///   `AppDbError::Database` on SQL failure.
pub async fn update(pool: &SqlitePool, data: &FilterRule) -> Result<FilterRule, AppDbError> {
    sqlx::query_as::<_, FilterRule>(
        r#"UPDATE filter_rules SET
            name = ?, is_enabled = ?, criteria_json = ?, actions_json = ?,
            group_operator = ?, score_threshold = ?, chaining_action = ?, sort_order = ?
        WHERE id = ? AND account_id = ? RETURNING *"#,
    )
    .bind(&data.name)
    .bind(data.is_enabled)
    .bind(&data.criteria_json)
    .bind(&data.actions_json)
    .bind(&data.group_operator)
    .bind(data.score_threshold)
    .bind(&data.chaining_action)
    .bind(data.sort_order)
    .bind(&data.id)
    .bind(&data.account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Filter rule {} not found", data.id)))
}

pub async fn delete(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<(), AppDbError> {
    let result = sqlx::query("DELETE FROM filter_rules WHERE id = ? AND account_id = ?")
        .bind(id)
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    if result.rows_affected() == 0 {
        return Err(AppDbError::NotFound(format!("Filter rule {} not found", id)));
    }
    Ok(())
}

/// Count all filter rules in the table.
///
/// * Returns the total row count.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn count(pool: &SqlitePool) -> Result<i64, AppDbError> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM filter_rules")
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(row.0)
}

/// List enabled (`is_enabled = 1`) filter rules for an account, ordered by
/// `sort_order` ascending.
///
/// * `account_id` — owning account.
/// * Returns the matching `FilterRule` rows.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn get_enabled_for_account(pool: &SqlitePool, account_id: &str) -> Result<Vec<FilterRule>, AppDbError> {
    sqlx::query_as::<_, FilterRule>(
        "SELECT * FROM filter_rules WHERE account_id = ? AND is_enabled = 1 ORDER BY sort_order ASC"
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Report total and enabled filter-rule counts for an account.
///
/// * `account_id` — owning account.
/// * Returns a JSON object `{ "total": i64, "enabled": i64 }`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn get_stats(pool: &SqlitePool, account_id: &str) -> Result<serde_json::Value, AppDbError> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM filter_rules WHERE account_id = ?")
        .bind(account_id)
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)?;
    let enabled: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM filter_rules WHERE account_id = ? AND is_enabled = 1")
        .bind(account_id)
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(serde_json::json!({ "total": total, "enabled": enabled }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    fn make_rule(account_id: &str, name: &str) -> FilterRule {
        FilterRule {
            id: String::new(),
            account_id: account_id.to_string(),
            name: name.to_string(),
            is_enabled: 1,
            criteria_json: r#"{"from":"spam@example.com"}"#.to_string(),
            actions_json: r#"["move_to_spam"]"#.to_string(),
            group_operator: "AND".to_string(),
            score_threshold: Some(0.5),
            chaining_action: Some("stop".to_string()),
            sort_order: 0,
            created_at: 0,
        }
    }

    #[tokio::test]
    async fn test_create_rule() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let data = make_rule("acct_1", "Spam Filter");
        let created = create(&pool, &data).await.unwrap();
        assert!(!created.id.is_empty());
        assert_eq!(created.name, "Spam Filter");
        assert_eq!(created.account_id, "acct_1");
    }

    #[tokio::test]
    async fn test_list_rules() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        create(&pool, &make_rule("acct_1", "Rule A")).await.unwrap();
        create(&pool, &make_rule("acct_1", "Rule B")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_list_rules_scoped() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        helpers::insert_test_account(&pool, "acct_2").await;
        create(&pool, &make_rule("acct_1", "Rule A")).await.unwrap();
        create(&pool, &make_rule("acct_2", "Rule B")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[tokio::test]
    async fn test_get_by_id_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_rule("acct_1", "Test Rule")).await.unwrap();
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
    async fn test_update_rule() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut created = create(&pool, &make_rule("acct_1", "Old Name")).await.unwrap();
        created.name = "Updated Name".to_string();
        created.is_enabled = 0;
        let updated = update(&pool, &created).await.unwrap();
        assert_eq!(updated.name, "Updated Name");
        assert_eq!(updated.is_enabled, 0);
    }

    #[tokio::test]
    async fn test_delete_rule() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_rule("acct_1", "Delete Me")).await.unwrap();
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
