//! TaskTags table query functions.
//!
//! CRUD queries against the `task_tags` table (per-company, color-coded labels
//! attached to tasks). Every async function takes a [`sqlx::SqlitePool`] and
//! returns `Result<_, crate::db::error::AppDbError>`.

use sqlx::SqlitePool;
use crate::db::common::fetch_or_not_found;
use crate::db::error::AppDbError;
use crate::db::tasks::schema::TaskTag;

/// List all task tags.
///
/// # Parameters
/// - `pool`: SQLite connection pool.
///
/// # Returns
/// Every task tag ordered by `sort_order ASC`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list(pool: &SqlitePool) -> Result<Vec<TaskTag>, AppDbError> {
    sqlx::query_as::<_, TaskTag>("SELECT * FROM task_tags ORDER BY sort_order ASC")
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Fetch a single task tag by its primary key (`tag`).
///
/// # Parameters
/// - `pool`: SQLite connection pool.
/// - `tag`: the tag's primary key.
///
/// # Returns
/// The matching [`TaskTag`].
///
/// # Errors
/// Returns `AppDbError::NotFound` (`TaskTag with tag '<tag>' not found`) when no
/// tag matches, and `AppDbError::Database` on query failure.
pub async fn get_by_tag(pool: &SqlitePool, tag: &str) -> Result<TaskTag, AppDbError> {
    let opt = sqlx::query_as::<_, TaskTag>("SELECT * FROM task_tags WHERE tag = ?")
        .bind(tag)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, tag, "TaskTag")
}

/// Insert or replace a task tag (`ON CONFLICT(tag, company_id) DO UPDATE`).
///
/// # Parameters
/// - `pool`: SQLite connection pool.
/// - `tag`: the tag's primary key.
/// - `company_id`: owning company (used in the conflict key); `None` for
///   account-agnostic tags.
/// - `color`: optional hex color used by the UI.
/// - `sort_order`: display order.
///
/// # Returns
/// `()` after the row is inserted or updated. `created_at` is set on insert
/// only (the conflict update leaves it unchanged).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn upsert(
    pool: &SqlitePool,
    tag: &str,
    company_id: Option<&str>,
    color: Option<&str>,
    sort_order: i64,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();

    sqlx::query(
        r#"
        INSERT INTO task_tags (tag, company_id, color, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(tag, company_id) DO UPDATE SET
            company_id = excluded.company_id,
            color = excluded.color,
            sort_order = excluded.sort_order
        "#,
    )
    .bind(tag)
    .bind(company_id)
    .bind(color)
    .bind(sort_order)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete a task tag by primary key.
///
/// # Parameters
/// - `pool`: SQLite connection pool.
/// - `tag`: the tag's primary key.
///
/// # Returns
/// `()` when a row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`TaskTag with tag '<tag>' not found`) when no
/// tag matches, and `AppDbError::Database` on query failure.
///
/// NOTE: kept inline (parameterized `?` bind) rather than `delete_or_not_found`,
/// which expects an interpolated id string; this preserves the exact SQL.
pub async fn delete(pool: &SqlitePool, tag: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM task_tags WHERE tag = ?")
        .bind(tag)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("TaskTag with tag '{tag}' not found")));
    }
    Ok(())
}

/// List task tags optionally filtered by account_id.
pub async fn list_by_account(
    pool: &SqlitePool,
    company_id: Option<&str>,
) -> Result<Vec<TaskTag>, AppDbError> {
    if let Some(cid) = company_id {
        sqlx::query_as::<_, TaskTag>(
            "SELECT * FROM task_tags WHERE company_id IS NULL OR company_id = ? ORDER BY sort_order ASC"
        )
        .bind(cid)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
    } else {
        sqlx::query_as::<_, TaskTag>(
            "SELECT * FROM task_tags ORDER BY sort_order ASC"
        )
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_upsert_and_get_by_tag() {
        let pool = helpers::create_memory_pool().await;

        upsert(&pool, "urgent", Some("acc1"), Some("#ff0000"), 1)
            .await
            .expect("upsert should succeed");

        let tag = get_by_tag(&pool, "urgent").await.expect("get_by_tag should succeed");
        assert_eq!(tag.tag, "urgent");
        assert_eq!(tag.company_id, Some("acc1".to_string()));
        assert_eq!(tag.color, Some("#ff0000".to_string()));
        assert_eq!(tag.sort_order, 1);
        assert!(tag.created_at > 0);
    }

    #[tokio::test]
    async fn test_get_by_tag_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = get_by_tag(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_upsert_update_existing() {
        let pool = helpers::create_memory_pool().await;

        // First insert
        upsert(&pool, "work", Some("acc1"), Some("#00ff00"), 1).await.unwrap();

        let tag = get_by_tag(&pool, "work").await.unwrap();
        assert_eq!(tag.color, Some("#00ff00".to_string()));

        // Upsert with new values — ON CONFLICT(tag, company_id) DO UPDATE
        // Must use same company_id to trigger the conflict/update
        upsert(&pool, "work", Some("acc1"), Some("#0000ff"), 5).await.unwrap();

        let updated = get_by_tag(&pool, "work").await.unwrap();
        assert_eq!(updated.company_id, Some("acc1".to_string()));
        assert_eq!(updated.color, Some("#0000ff".to_string()));
        assert_eq!(updated.sort_order, 5);
    }

    #[tokio::test]
    async fn test_upsert_with_nulls() {
        let pool = helpers::create_memory_pool().await;

        upsert(&pool, "minimal", None, None, 0).await.unwrap();

        let tag = get_by_tag(&pool, "minimal").await.unwrap();
        assert_eq!(tag.tag, "minimal");
        assert!(tag.company_id.is_none());
        assert!(tag.color.is_none());
        assert_eq!(tag.sort_order, 0);
    }

    #[tokio::test]
    async fn test_list() {
        let pool = helpers::create_memory_pool().await;

        upsert(&pool, "tag_c", Some("acc1"), Some("#ccc"), 3).await.unwrap();
        upsert(&pool, "tag_a", Some("acc1"), Some("#aaa"), 1).await.unwrap();
        upsert(&pool, "tag_b", Some("acc1"), Some("#bbb"), 2).await.unwrap();

        let all = list(&pool).await.expect("list should succeed");
        assert_eq!(all.len(), 3);
        assert_eq!(all[0].tag, "tag_a");
        assert_eq!(all[1].tag, "tag_b");
        assert_eq!(all[2].tag, "tag_c");
    }

    #[tokio::test]
    async fn test_list_empty() {
        let pool = helpers::create_memory_pool().await;
        let all = list(&pool).await.unwrap();
        assert!(all.is_empty());
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;

        upsert(&pool, "delete_me", Some("acc1"), None, 1).await.unwrap();
        delete(&pool, "delete_me").await.expect("delete should succeed");

        let all = list(&pool).await.unwrap();
        assert!(all.is_empty());
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = delete(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_full_crud_cycle() {
        let pool = helpers::create_memory_pool().await;

        upsert(&pool, "important", Some("acc1"), Some("#ff0"), 1).await.unwrap();
        assert_eq!(get_by_tag(&pool, "important").await.unwrap().tag, "important");

        upsert(&pool, "important", Some("acc1"), Some("#f00"), 2).await.unwrap();
        assert_eq!(get_by_tag(&pool, "important").await.unwrap().color, Some("#f00".to_string()));

        assert_eq!(list(&pool).await.unwrap().len(), 1);

        delete(&pool, "important").await.unwrap();
        assert!(list(&pool).await.unwrap().is_empty());
    }
}
