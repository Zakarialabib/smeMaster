//! `quick_replies` table data-access layer.
//!
//! CRUD helpers for the `quick_replies` table (canned responses). Functions are
//! async, take a `&SqlitePool`, and return `Result<_, AppDbError>`.
//! Account-scoped lookups/updates/deletes take an `account_id`; single-row
//! operations return `AppDbError::NotFound` when the row is missing. All
//! operations return `AppDbError::Database` on SQL failure.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::QuickReply;

/// List quick replies for an account, ordered by `sort_order` ascending.
///
/// * `account_id` — owning account.
/// * Returns the matching `QuickReply` rows.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list(pool: &SqlitePool, account_id: &str) -> Result<Vec<QuickReply>, AppDbError> {
    sqlx::query_as::<_, QuickReply>(
        "SELECT * FROM quick_replies WHERE account_id = ? ORDER BY sort_order ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single quick reply by id within an account.
///
/// * `id` — primary key of the quick reply.
/// * `account_id` — owning account (scopes the lookup).
/// * Returns the matching `QuickReply`.
/// * Errors: `AppDbError::NotFound` when no such reply exists for the account;
///   `AppDbError::Database` on SQL failure.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<QuickReply, AppDbError> {
    sqlx::query_as::<_, QuickReply>(
        "SELECT * FROM quick_replies WHERE id = ? AND account_id = ?",
    )
    .bind(id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Quick reply {} not found", id)))
}

/// Insert a new quick reply, generating its `id` and `created_at`.
///
/// * `data` — reply fields (`id`/`created_at`/`usage_count` overwritten by the
///   database; usage starts at 0).
/// * Returns the newly created `QuickReply`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn create(pool: &SqlitePool, data: &QuickReply) -> Result<QuickReply, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, QuickReply>(
        r#"INSERT INTO quick_replies (
            id, account_id, title, body_html, shortcut, sort_order, usage_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?) RETURNING *"#,
    )
    .bind(&id)
    .bind(&data.account_id)
    .bind(&data.title)
    .bind(&data.body_html)
    .bind(&data.shortcut)
    .bind(data.sort_order)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update an existing quick reply by id and account, replacing mutable columns.
///
/// * `data` — reply with updated fields; `data.id`/`data.account_id` scope it.
/// * Returns the updated `QuickReply`.
/// * Errors: `AppDbError::NotFound` when no matching reply exists;
///   `AppDbError::Database` on SQL failure.
pub async fn update(pool: &SqlitePool, data: &QuickReply) -> Result<QuickReply, AppDbError> {
    sqlx::query_as::<_, QuickReply>(
        r#"UPDATE quick_replies SET
            title = ?, body_html = ?, shortcut = ?, sort_order = ?
        WHERE id = ? AND account_id = ? RETURNING *"#,
    )
    .bind(&data.title)
    .bind(&data.body_html)
    .bind(&data.shortcut)
    .bind(data.sort_order)
    .bind(&data.id)
    .bind(&data.account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Quick reply {} not found", data.id)))
}

/// Increment a quick reply's `usage_count` within an account.
///
/// * `id` — primary key of the quick reply.
/// * `account_id` — owning account (scopes the update).
/// * Returns the updated `QuickReply`.
/// * Errors: `AppDbError::NotFound` when no matching reply exists;
///   `AppDbError::Database` on SQL failure.
pub async fn increment_usage_for_account(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<QuickReply, AppDbError> {
    sqlx::query_as::<_, QuickReply>(
        r#"UPDATE quick_replies SET usage_count = usage_count + 1
        WHERE id = ? AND account_id = ? RETURNING *"#,
    )
    .bind(id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Quick reply {} not found", id)))
}

/// Delete a quick reply by id and account.
///
/// * `id` — primary key of the quick reply.
/// * `account_id` — owning account (scopes the delete).
/// * Returns `()` on success.
/// * Errors: `AppDbError::NotFound` when no matching row exists (0 rows
///   affected); `AppDbError::Database` on SQL failure.
pub async fn delete(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<(), AppDbError> {
    let result = sqlx::query("DELETE FROM quick_replies WHERE id = ? AND account_id = ?")
        .bind(id)
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    if result.rows_affected() == 0 {
        return Err(AppDbError::NotFound(format!("Quick reply {} not found", id)));
    }
    Ok(())
}

/// Fetch a quick reply by id, returning `None` rather than an error if absent.
///
/// * `id` — primary key of the quick reply.
/// * Returns `Some(QuickReply)` when found, `None` when absent.
/// * Errors: `AppDbError::Database` on SQL failure (never `NotFound`).
pub async fn get_by_id_opt(pool: &SqlitePool, id: &str) -> Result<Option<QuickReply>, AppDbError> {
    sqlx::query_as::<_, QuickReply>("SELECT * FROM quick_replies WHERE id = ?")
        .bind(id).fetch_optional(pool).await.map_err(AppDbError::Database)
}

/// Increment a quick reply's `usage_count` by `id` (any account).
///
/// * `id` — primary key of the quick reply.
/// * Returns `()`. Does not error when the id is absent (0 rows affected).
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn increment_usage(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    sqlx::query("UPDATE quick_replies SET usage_count = usage_count + 1 WHERE id = ?")
        .bind(id).execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

/// Insert a quick reply with `INSERT OR IGNORE`; a duplicate `id` is skipped.
///
/// * Parameters mirror `create`; `usage_count` starts at 0 and `created_at` is
///   set to now.
/// * Returns `()` whether or not a row was inserted.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn insert_ignore(pool: &SqlitePool, id: &str, account_id: &str, title: &str, body_html: &str, shortcut: Option<&str>, sort_order: i64) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query("INSERT OR IGNORE INTO quick_replies (id, account_id, title, body_html, shortcut, sort_order, usage_count, created_at) VALUES (?,?,?,?,?,?,0,?)")
        .bind(id).bind(account_id).bind(title).bind(body_html).bind(shortcut).bind(sort_order).bind(now)
        .execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    async fn create_test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        crate::db::migrations::run_migrations(&pool).await.unwrap();
        pool
    }

    async fn seed_account(pool: &SqlitePool, account_id: &str) {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT INTO accounts (id, email, provider, auth_method, metadata_json, created_at, updated_at) VALUES (?, ?, 'test', 'none', '{}', ?, ?)",
        )
        .bind(account_id)
        .bind(format!("{}@test.com", account_id))
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();
    }

    fn make_reply(account_id: &str) -> QuickReply {
        QuickReply {
            id: String::new(),
            account_id: account_id.to_string(),
            title: "Thanks".to_string(),
            body_html: "<p>Thank you</p>".to_string(),
            shortcut: Some("thx".to_string()),
            sort_order: 1,
            usage_count: 0,
            created_at: 0,
        }
    }

    #[tokio::test]
    async fn test_create_reply() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acct_1").await;
        let data = make_reply("acct_1");
        let created = create(&pool, &data).await.unwrap();
        assert!(!created.id.is_empty());
        assert_eq!(created.title, "Thanks");
        assert_eq!(created.account_id, "acct_1");
        assert_eq!(created.usage_count, 0);
    }

    #[tokio::test]
    async fn test_list_replies() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acct_1").await;
        create(&pool, &make_reply("acct_1")).await.unwrap();
        create(&pool, &make_reply("acct_1")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_list_replies_scoped() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acct_1").await;
        seed_account(&pool, "acct_2").await;
        create(&pool, &make_reply("acct_1")).await.unwrap();
        create(&pool, &make_reply("acct_2")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[tokio::test]
    async fn test_get_by_id_found() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acct_1").await;
        let created = create(&pool, &make_reply("acct_1")).await.unwrap();
        let fetched = get_by_id(&pool, &created.id, "acct_1").await.unwrap();
        assert_eq!(fetched.id, created.id);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = create_test_pool().await;
        let result = get_by_id(&pool, "nonexistent", "acct_1").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_reply() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acct_1").await;
        let mut created = create(&pool, &make_reply("acct_1")).await.unwrap();
        created.title = "Updated Thanks".to_string();
        created.shortcut = Some("ty".to_string());
        let updated = update(&pool, &created).await.unwrap();
        assert_eq!(updated.title, "Updated Thanks");
        assert_eq!(updated.shortcut, Some("ty".to_string()));
    }

    #[tokio::test]
    async fn test_increment_usage() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acct_1").await;
        let created = create(&pool, &make_reply("acct_1")).await.unwrap();
        let incremented = increment_usage_for_account(&pool, &created.id, "acct_1").await.unwrap();
        assert_eq!(incremented.usage_count, 1);
        let incremented_again = increment_usage_for_account(&pool, &created.id, "acct_1").await.unwrap();
        assert_eq!(incremented_again.usage_count, 2);
    }

    #[tokio::test]
    async fn test_increment_usage_not_found() {
        let pool = create_test_pool().await;
        let result = increment_usage_for_account(&pool, "nonexistent", "acct_1").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_reply() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acct_1").await;
        let created = create(&pool, &make_reply("acct_1")).await.unwrap();
        delete(&pool, &created.id, "acct_1").await.unwrap();
        let result = get_by_id(&pool, &created.id, "acct_1").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = create_test_pool().await;
        let result = delete(&pool, "nonexistent", "acct_1").await;
        assert!(result.is_err());
    }
}
