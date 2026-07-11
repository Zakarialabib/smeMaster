//! Bundle rules — per-category policy deciding whether matching threads are
//! bundled for digest delivery. One rule per `(account_id, category)`. CRUD
//! helpers: `list`, `upsert_bundle_rule`, `delete`, `get_by_id_opt`.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use crate::db::common::delete_or_not_found;
use crate::db::error::AppDbError;

/// A rule that determines whether threads matching a category should be
/// bundled for digest-style delivery.
///
/// Defined inline — this struct exists in `schema.sql` but NOT in `schema.rs`.
/// Rows are uniquely identified by `(account_id, category)`.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BundleRule {
    /// Primary key (UUID).
    pub id: String,
    /// Owning account id (part of the composite constraint).
    pub account_id: String,
    /// Bundle category this rule applies to (part of the composite constraint).
    pub category: String,
    /// Whether threads in this category are bundled (1/0).
    pub is_bundled: i64,
    /// Whether digest delivery is enabled for this category (1/0).
    pub delivery_enabled: i64,
    /// Optional cron-style delivery schedule expression.
    pub delivery_schedule: Option<String>,
    /// Optional unix-epoch time the digest was last delivered.
    pub last_delivered_at: Option<i64>,
    /// Unix-epoch creation time.
    pub created_at: i64,
}

/// List all bundle rules for an account, ordered by category.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
///
/// # Returns
/// All rules for the account ordered by `category`. An empty `Vec` (not an
/// error) when the account has none.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<BundleRule>, AppDbError> {
    sqlx::query_as::<_, BundleRule>(
        "SELECT * FROM bundle_rules WHERE account_id = ? ORDER BY category",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Insert or update a bundle rule.
///
/// Each account has at most one rule per category, so we upsert on
/// `(account_id, category)`. A fresh UUID primary key is generated on every
/// call; on conflict only `is_bundled`, `delivery_enabled` and
/// `delivery_schedule` are overwritten (the original `created_at` is retained).
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id (part of the conflict key).
/// * `category` — bundle category (part of the conflict key).
/// * `is_bundled` — whether threads in this category are bundled.
/// * `delivery_enabled` — whether digest delivery is enabled.
/// * `delivery_schedule` — optional cron-style schedule expression.
///
/// # Returns
/// The freshly written `BundleRule` row.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn upsert_bundle_rule(
    pool: &SqlitePool,
    account_id: &str,
    category: &str,
    is_bundled: bool,
    delivery_enabled: bool,
    delivery_schedule: Option<&str>,
) -> Result<BundleRule, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, BundleRule>(
        r#"
        INSERT INTO bundle_rules (id, account_id, category, is_bundled, delivery_enabled, delivery_schedule, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, category) DO UPDATE
        SET is_bundled = excluded.is_bundled,
            delivery_enabled = excluded.delivery_enabled,
            delivery_schedule = excluded.delivery_schedule
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(category)
    .bind(is_bundled as i64)
    .bind(delivery_enabled as i64)
    .bind(delivery_schedule)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete a bundle rule by its primary key.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the rule to delete.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`"BundleRule with id '<id>' not found"`) when
/// no rule matches `id` (the shared `delete_or_not_found` helper wraps the
/// statement in `sqlx::AssertSqlSafe` and interpolates `id` into the SQL).
/// Returns `AppDbError::Database` on query failure.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    delete_or_not_found(
        pool,
        format!("DELETE FROM bundle_rules WHERE id = '{id}'"),
        id,
        "BundleRule",
    )
    .await
}

/// Fetch a bundle rule by its primary key, returning `None` if not found.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the rule.
///
/// # Returns
/// `Some(BundleRule)` if found, otherwise `None`. This is **not** an error when
/// the id does not exist.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn get_by_id_opt(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<BundleRule>, AppDbError> {
    sqlx::query_as::<_, BundleRule>("SELECT * FROM bundle_rules WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;
    

    #[tokio::test]
    async fn test_upsert_and_list() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-br-1";
        helpers::insert_test_account(&pool, account_id).await;

        let rule = upsert_bundle_rule(
            &pool,
            account_id,
            "newsletter",
            true,
            true,
            Some("0 8 * * 1"),
        )
        .await
        .unwrap();

        assert_eq!(rule.account_id, account_id);
        assert_eq!(rule.category, "newsletter");
        assert_eq!(rule.is_bundled, 1);
        assert_eq!(rule.delivery_enabled, 1);
        assert_eq!(rule.delivery_schedule, Some("0 8 * * 1".to_string()));

        let items = list(&pool, account_id).await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, rule.id);
    }

    #[tokio::test]
    async fn test_upsert_replaces_existing() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-br-2";
        helpers::insert_test_account(&pool, account_id).await;

        let _first = upsert_bundle_rule(&pool, account_id, "promotions", true, true, None)
            .await
            .unwrap();

        let second = upsert_bundle_rule(&pool, account_id, "promotions", false, false, Some("0 6 * * 3"))
            .await
            .unwrap();

        assert_eq!(second.is_bundled, 0);
        assert_eq!(second.delivery_enabled, 0);
        assert_eq!(second.delivery_schedule, Some("0 6 * * 3".to_string()));
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-br-3").await;
        let rule = upsert_bundle_rule(&pool, "acc-br-3", "social", true, false, None)
            .await
            .unwrap();
        delete(&pool, &rule.id).await.unwrap();
        let items = list(&pool, "acc-br-3").await.unwrap();
        assert!(items.is_empty());
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = delete(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
