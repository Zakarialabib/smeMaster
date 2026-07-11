//! Newsletter bundles — groups of threads (with their own rules + thread id
//! lists) rendered as a single digest. CRUD helpers: `list`, `get_by_id`,
//! `create`, `update`, `delete`.

use sqlx::SqlitePool;
use crate::db::common::delete_or_not_found;
use crate::db::common::fetch_or_not_found;
use crate::db::error::AppDbError;
use crate::db::deliverability::schema::NewsletterBundle;

/// List all newsletter bundles for an account, newest first.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
///
/// # Returns
/// All bundles for the account ordered by `created_at DESC`. An empty `Vec`
/// (not an error) when the account has none.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<NewsletterBundle>, AppDbError> {
    sqlx::query_as::<_, NewsletterBundle>(
        "SELECT * FROM newsletter_bundles WHERE account_id = ? ORDER BY created_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single newsletter bundle by its primary key.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the bundle.
///
/// # Returns
/// The matching `NewsletterBundle` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`"NewsletterBundle with id '<id>' not found"`)
/// when no bundle matches `id`. Returns `AppDbError::Database` on query failure.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<NewsletterBundle, AppDbError> {
    let opt = sqlx::query_as::<_, NewsletterBundle>("SELECT * FROM newsletter_bundles WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "NewsletterBundle")
}

/// Create a new newsletter bundle and return the full row.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
/// * `name` — display name of the bundle.
/// * `rules_json` — JSON describing bundle membership rules.
/// * `thread_ids_json` — JSON array of thread ids belonging to the bundle.
///
/// # Returns
/// The newly inserted `NewsletterBundle` row (with generated `id`,
/// `created_at`, `updated_at`).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn create(
    pool: &SqlitePool,
    account_id: &str,
    name: &str,
    rules_json: &str,
    thread_ids_json: &str,
) -> Result<NewsletterBundle, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, NewsletterBundle>(
        r#"
        INSERT INTO newsletter_bundles (id, account_id, name, rules_json, thread_ids_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(name)
    .bind(rules_json)
    .bind(thread_ids_json)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update mutable fields of a newsletter bundle and return the updated row.
///
/// Unsupplied (`None`) fields keep their existing value (loaded via
/// `get_by_id`), so partial updates are supported. `updated_at` is always
/// bumped.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the bundle to update.
/// * `name` / `rules_json` / `thread_ids_json` — new values, or `None` to leave
///   unchanged.
///
/// # Returns
/// The updated `NewsletterBundle` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` when `id` does not exist (propagated from
/// `get_by_id`). Returns `AppDbError::Database` on query failure.
pub async fn update(
    pool: &SqlitePool,
    id: &str,
    name: Option<&str>,
    rules_json: Option<&str>,
    thread_ids_json: Option<&str>,
) -> Result<NewsletterBundle, AppDbError> {
    let existing = get_by_id(pool, id).await?;

    let new_name = name.map(String::from).unwrap_or(existing.name);
    let new_rules = rules_json.map(String::from).unwrap_or(existing.rules_json);
    let new_threads = thread_ids_json.map(String::from).unwrap_or(existing.thread_ids_json);
    let now = chrono::Utc::now().timestamp();

    sqlx::query_as::<_, NewsletterBundle>(
        r#"
        UPDATE newsletter_bundles
        SET name = ?,
            rules_json = ?,
            thread_ids_json = ?,
            updated_at = ?
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(&new_name)
    .bind(&new_rules)
    .bind(&new_threads)
    .bind(now)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete a newsletter bundle by its primary key.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the bundle to delete.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`"NewsletterBundle with id '<id>' not found"`)
/// when no bundle matches `id` (the shared `delete_or_not_found` helper wraps the
/// statement in `sqlx::AssertSqlSafe` and interpolates `id` into the SQL). Returns
/// `AppDbError::Database` on query failure.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    delete_or_not_found(
        pool,
        format!("DELETE FROM newsletter_bundles WHERE id = '{id}'"),
        id,
        "NewsletterBundle",
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_create_and_list() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-bdl-1";
        helpers::insert_test_account(&pool, account_id).await;
        let bundle = create(
            &pool,
            account_id,
            "Weekly Digest",
            r#"{"min_score":0.5}"#,
            r#"["thread-1","thread-2"]"#,
        )
        .await
        .unwrap();

        assert_eq!(bundle.account_id, account_id);
        assert_eq!(bundle.name, "Weekly Digest");
        assert_eq!(bundle.rules_json, r#"{"min_score":0.5}"#);
        assert_eq!(bundle.thread_ids_json, r#"["thread-1","thread-2"]"#);

        let items = list(&pool, account_id).await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, bundle.id);
    }

    #[tokio::test]
    async fn test_get_by_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-bdl-2").await;
        let bundle = create(
            &pool,
            "acc-bdl-2",
            "Monthly Roundup",
            "{}",
            "[]",
        )
        .await
        .unwrap();

        let found = get_by_id(&pool, &bundle.id).await.unwrap();
        assert_eq!(found.name, "Monthly Roundup");
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = get_by_id(&pool, "non-existent-id").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_update_name_only() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-bdl-3").await;
        let mut bundle = create(
            &pool,
            "acc-bdl-3",
            "Old Name",
            r#"{"min_score":0.3}"#,
            r#"["t1"]"#,
        )
        .await
        .unwrap();

        bundle = update(&pool, &bundle.id, Some("New Name"), None, None)
            .await
            .unwrap();
        assert_eq!(bundle.name, "New Name");
        assert_eq!(bundle.rules_json, r#"{"min_score":0.3}"#);
        assert_eq!(bundle.thread_ids_json, r#"["t1"]"#);
    }

    #[tokio::test]
    async fn test_update_all_fields() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-bdl-4").await;
        let mut bundle = create(
            &pool,
            "acc-bdl-4",
            "Original",
            r#"{"min_score":0.1}"#,
            r#"[]"#,
        )
        .await
        .unwrap();

        bundle = update(
            &pool,
            &bundle.id,
            Some("Renamed"),
            Some(r#"{"min_score":0.9}"#),
            Some(r#"["t1","t2","t3"]"#),
        )
        .await
        .unwrap();
        assert_eq!(bundle.name, "Renamed");
        assert_eq!(bundle.rules_json, r#"{"min_score":0.9}"#);
        assert_eq!(bundle.thread_ids_json, r#"["t1","t2","t3"]"#);
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-bdl-5").await;
        let bundle = create(&pool, "acc-bdl-5", "To Delete", "{}", "[]")
            .await
            .unwrap();
        delete(&pool, &bundle.id).await.unwrap();
        let err = get_by_id(&pool, &bundle.id).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = delete(&pool, "non-existent-id").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
