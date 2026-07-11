//! `filter_logs` table data-access layer.
//!
//! Read/log helpers for the `filter_logs` table (audit trail of filter rule
//! evaluations). Functions are async, take a `&SqlitePool`, and return
//! `Result<_, AppDbError>`. `create` returns `AppDbError::Database` on SQL
//! failure; the report helpers return aggregate JSON or row lists.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::FilterLog;

/// List filter-log entries for a rule, newest first.
///
/// * `rule_id` — owning filter rule.
/// * Returns the matching `FilterLog` rows ordered by `created_at` descending.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list_by_rule(
    pool: &SqlitePool,
    rule_id: &str,
) -> Result<Vec<FilterLog>, AppDbError> {
    sqlx::query_as::<_, FilterLog>(
        "SELECT * FROM filter_logs WHERE rule_id = ? ORDER BY created_at DESC",
    )
    .bind(rule_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Insert a new filter-log entry, generating its `id` and `created_at`.
///
/// * `data` — log fields (`id`/`created_at` overwritten by the database).
/// * Returns the newly created `FilterLog`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn create(pool: &SqlitePool, data: &FilterLog) -> Result<FilterLog, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, FilterLog>(
        r#"INSERT INTO filter_logs (
            id, rule_id, message_id, matched, score, applied_actions, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *"#,
    )
    .bind(&id)
    .bind(&data.rule_id)
    .bind(&data.message_id)
    .bind(data.matched)
    .bind(data.score)
    .bind(&data.applied_actions)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List recent filter-log entries across all of an account's rules, newest
/// first, bounded by `limit`.
///
/// * `account_id` — account whose rules' logs to include.
/// * `limit` — maximum number of rows to return.
/// * Returns the matching `FilterLog` rows ordered by `created_at` descending.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list_by_account(pool: &SqlitePool, account_id: &str, limit: i64) -> Result<Vec<FilterLog>, AppDbError> {
    sqlx::query_as::<_, FilterLog>(
        "SELECT fl.* FROM filter_logs fl INNER JOIN filter_rules fr ON fl.rule_id = fr.id WHERE fr.account_id = ? ORDER BY fl.created_at DESC LIMIT ?"
    )
    .bind(account_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Report total and matched filter-log counts for an account.
///
/// * `account_id` — account whose rules' logs to aggregate.
/// * Returns a JSON object `{ "total": i64, "matched": i64 }`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn get_log_stats(pool: &SqlitePool, account_id: &str) -> Result<serde_json::Value, AppDbError> {
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM filter_logs fl INNER JOIN filter_rules fr ON fl.rule_id = fr.id WHERE fr.account_id = ?"
    )
    .bind(account_id)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)?;
    let matched: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM filter_logs fl INNER JOIN filter_rules fr ON fl.rule_id = fr.id WHERE fr.account_id = ? AND fl.matched = 1"
    )
    .bind(account_id)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(serde_json::json!({ "total": total, "matched": matched }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    async fn seed_filter_rule(pool: &SqlitePool, rule_id: &str, account_id: &str) {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT OR IGNORE INTO filter_rules (id, account_id, name, is_enabled, criteria_json, actions_json, group_operator, score_threshold, chaining_action, sort_order, created_at) VALUES (?, ?, 'test', 1, '{}', '{}', 'AND', NULL, 'stop', 0, ?)",
        )
        .bind(rule_id)
        .bind(account_id)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();
    }

    fn make_filter_log(rule_id: &str, message_id: &str) -> FilterLog {
        FilterLog {
            id: String::new(),
            rule_id: rule_id.to_string(),
            message_id: message_id.to_string(),
            matched: 1,
            score: 0.85,
            applied_actions: Some(r#"["move_inbox"]"#.to_string()),
            created_at: 0,
        }
    }

    #[tokio::test]
    async fn test_create_filter_log() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_test_1").await;
        seed_filter_rule(&pool, "rule_1", "acct_test_1").await;
        let data = make_filter_log("rule_1", "msg_1");
        let created = create(&pool, &data).await.unwrap();
        assert!(!created.id.is_empty());
        assert_eq!(created.rule_id, "rule_1");
        assert_eq!(created.message_id, "msg_1");
        assert_eq!(created.matched, 1);
    }

    #[tokio::test]
    async fn test_list_by_rule_empty() {
        let pool = helpers::create_memory_pool().await;
        let rows = list_by_rule(&pool, "rule_none").await.unwrap();
        assert!(rows.is_empty());
    }

    #[tokio::test]
    async fn test_list_by_rule_with_data() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_test_1").await;
        seed_filter_rule(&pool, "rule_1", "acct_test_1").await;
        seed_filter_rule(&pool, "rule_2", "acct_test_1").await;
        create(&pool, &make_filter_log("rule_1", "msg_1")).await.unwrap();
        create(&pool, &make_filter_log("rule_1", "msg_2")).await.unwrap();
        create(&pool, &make_filter_log("rule_2", "msg_3")).await.unwrap();
        let rows = list_by_rule(&pool, "rule_1").await.unwrap();
        assert_eq!(rows.len(), 2);
        let rows_other = list_by_rule(&pool, "rule_2").await.unwrap();
        assert_eq!(rows_other.len(), 1);
    }
}
