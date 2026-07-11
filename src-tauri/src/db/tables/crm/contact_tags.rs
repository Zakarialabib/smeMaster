//! Contact-tags query functions.
//!
//! Manages the `contact_tags` table and its `contact_tag_pivot` membership
//! links. Functions are async and return `Result<_, AppDbError>`.
//
// Note: `contact_tags` is a separate table from `contact_labels`.
// The `contact_tag_pivot` table is the pivot between contacts and tags.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::contacts::schema::DbContactTag;

/// Fetch a single tag by its primary key.
///
/// # Parameters
/// - `id`: the tag's primary key.
///
/// # Returns
/// `Ok(Some(DbContactTag))` when a match exists, or `Ok(None)` (not an error)
/// when no tag has that id.
pub async fn get_tag_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<DbContactTag>, AppDbError> {
    sqlx::query_as::<_, DbContactTag>("SELECT * FROM contact_tags WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Insert or update a contact tag by `ON CONFLICT(account_id, name) DO UPDATE`.
///
/// # Parameters
/// - `id`: primary key to use on insert (ignored on conflict update).
/// - `company_id`: owning account; part of the conflict key.
/// - `name`: tag name; part of the conflict key.
/// - `color`: optional tag color (e.g. hex string).
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`. `sort_order` is fixed to
/// `0` and `created_at` to `now`.
pub async fn upsert_tag(
    pool: &SqlitePool,
    id: &str,
    company_id: &str,
    name: &str,
    color: Option<&str>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();

    sqlx::query(
        r#"
        INSERT INTO contact_tags (id, company_id, name, color, sort_order, created_at)
        VALUES (?, ?, ?, ?, 0, ?)
        ON CONFLICT(company_id, name) DO UPDATE SET
            name  = EXCLUDED.name,
            color = EXCLUDED.color
        "#,
    )
    .bind(id)
    .bind(company_id)
    .bind(name)
    .bind(color)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(())
}

/// Count the contacts associated with a tag via the `contact_tag_pivot` table.
///
/// # Parameters
/// - `tag_id`: the tag whose contacts to count.
///
/// # Returns
/// The associated contact count as `i64` (zero when the tag has no contacts).
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn contact_count_for_tag(
    pool: &SqlitePool,
    tag_id: &str,
) -> Result<i64, AppDbError> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) as count FROM contact_tag_pivot WHERE tag_id = ?",
    )
    .bind(tag_id)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(row.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;
    

    #[tokio::test]
    async fn test_get_tag_by_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct-1").await;

        upsert_tag(&pool, "tag-1", "acct-1", "Important", Some("#ff0000"))
            .await
            .unwrap();

        let tag = get_tag_by_id(&pool, "tag-1").await.unwrap();
        assert!(tag.is_some());
        assert_eq!(tag.as_ref().unwrap().name, "Important");
        assert_eq!(tag.as_ref().unwrap().color.as_deref(), Some("#ff0000"));

        // Missing returns None
        let missing = get_tag_by_id(&pool, "nonexistent").await.unwrap();
        assert!(missing.is_none());
    }

    #[tokio::test]
    async fn test_upsert_tag_create_and_update() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct-1").await;

        // Create
        upsert_tag(&pool, "tag-up", "acct-1", "Follow-up", Some("#00ff00"))
            .await
            .unwrap();

        let tag = get_tag_by_id(&pool, "tag-up").await.unwrap().unwrap();
        assert_eq!(tag.name, "Follow-up");
        assert_eq!(tag.color.as_deref(), Some("#00ff00"));

        // Update by (account_id, name) conflict — must use same account_id
        upsert_tag(&pool, "tag-up-new", "acct-1", "Follow-up", Some("#0000ff"))
            .await
            .unwrap();

        // The ON CONFLICT(account_id, name) DO UPDATE does NOT update the `id` column,
        // so the original id is preserved. Fetch by the original id.
        let updated = get_tag_by_id(&pool, "tag-up").await.unwrap().unwrap();
        assert_eq!(updated.name, "Follow-up");
        assert_eq!(updated.color.as_deref(), Some("#0000ff"));
    }

    #[tokio::test]
    async fn test_contact_count_for_tag() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct-1").await;

        upsert_tag(&pool, "count-tag", "acct-1", "CountTest", None)
            .await
            .unwrap();

        // Insert some pivot entries
        for i in 0..3 {
            let contact_id = format!("contact-{i}");
            // Insert a contact row first so FK constraint passes
            sqlx::query("INSERT OR IGNORE INTO contacts (id, email) VALUES (?, ?)")
                .bind(&contact_id)
                .bind(format!("{contact_id}@test.local"))
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query(
                "INSERT OR IGNORE INTO contact_tag_pivot (contact_id, tag_id) VALUES (?, ?)",
            )
            .bind(&contact_id)
            .bind("count-tag")
            .execute(&pool)
            .await
            .unwrap();
        }

        let count = contact_count_for_tag(&pool, "count-tag").await.unwrap();
        assert_eq!(count, 3);

        // Tag with no contacts
        let zero = contact_count_for_tag(&pool, "no-contacts").await.unwrap();
        assert_eq!(zero, 0);
    }
}
