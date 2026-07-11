//! UTM link query functions.
//!
//! CRUD queries for the `utm_links` table, which stores the tracking URLs
//! attached to a campaign. All functions are `async` against a `SqlitePool`;
//! missing rows surface as `AppDbError::NotFound` (see [`get_by_id`] and
//! [`delete`]).
use crate::db::campaigns::schema::UtmLink;
use crate::db::common::fetch_or_not_found;
use crate::db::error::AppDbError;
use sqlx::SqlitePool;

/// List all UTM links for `campaign_id`, ordered newest (`created_at`) first.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `campaign_id`: campaign whose links are returned.
///
/// # Returns
/// A `Vec<UtmLink>` (possibly empty) for that campaign.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Does **not** error for an
/// empty result.
pub async fn list_by_campaign(
    pool: &SqlitePool,
    campaign_id: &str,
) -> Result<Vec<UtmLink>, AppDbError> {
    sqlx::query_as::<_, UtmLink>(
        "SELECT * FROM utm_links WHERE campaign_id = ? ORDER BY created_at DESC",
    )
    .bind(campaign_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single UTM link by its primary key `id`.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `id`: primary key of the UTM link to fetch.
///
/// # Returns
/// The full `UtmLink` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `UtmLink with id '<id>' not found` when no link matches the key. Returns
/// `AppDbError::Database` for other query failures.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<UtmLink, AppDbError> {
    let opt = sqlx::query_as::<_, UtmLink>("SELECT * FROM utm_links WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "UtmLink")
}

/// Create a new UTM link and return the full inserted row.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `campaign_id`: owning campaign id.
/// - `url`: the destination/tracking URL.
/// - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`: optional UTM
///   tag values attached to the link.
///
/// A new UUID primary key and `created_at` timestamp are generated and
/// `click_count` is seeded to `0`.
///
/// # Returns
/// The created `UtmLink` with all server-assigned columns populated.
///
/// # Errors
/// Returns `AppDbError::Database` on constraint violations or query failures
/// (e.g. an unknown `campaign_id` foreign key). Never returns `NotFound`.
pub async fn create(
    pool: &SqlitePool,
    campaign_id: &str,
    url: &str,
    utm_source: Option<&str>,
    utm_medium: Option<&str>,
    utm_campaign: Option<&str>,
    utm_content: Option<&str>,
) -> Result<UtmLink, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, UtmLink>(
        r#"
        INSERT INTO utm_links (id, campaign_id, url, utm_source, utm_medium, utm_campaign, utm_content, click_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(campaign_id)
    .bind(url)
    .bind(utm_source)
    .bind(utm_medium)
    .bind(utm_campaign)
    .bind(utm_content)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Atomically increment `click_count` for a UTM link by one.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `id`: primary key of the UTM link.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `UtmLink with id '<id>' not found` when no row matched the key
/// (`rows_affected() == 0`). Returns `AppDbError::Database` for other failures.
pub async fn increment_click(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query(
        "UPDATE utm_links SET click_count = click_count + 1 WHERE id = ?",
    )
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?
    .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("UtmLink with id '{id}' not found")));
    }
    Ok(())
}

/// Delete a UTM link by its primary key `id`.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `id`: primary key of the UTM link to delete.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `UtmLink with id '<id>' not found` when no row matched the key
/// (`rows_affected() == 0`). Returns `AppDbError::Database` for other failures.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM utm_links WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("UtmLink with id '{id}' not found")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    /// Seed a minimal campaign (with account) for foreign-key dependencies.
    async fn seed_campaign(pool: &SqlitePool, campaign_id: &str) {
        helpers::insert_test_account(pool, "acct_utm_test").await;
        helpers::insert_test_campaign(pool, campaign_id, "acct_utm_test").await;
    }

    #[tokio::test]
    async fn test_create_utm_link() {
        let pool = helpers::create_memory_pool().await;
        let campaign_id = "camp_utm_create";
        seed_campaign(&pool, campaign_id).await;

        let link = create(
            &pool,
            campaign_id,
            "https://example.com",
            Some("newsletter"),
            Some("email"),
            Some("spring_sale"),
            None,
        )
        .await
        .unwrap();

        assert_eq!(link.url, "https://example.com");
        assert_eq!(link.utm_source.as_deref(), Some("newsletter"));
        assert_eq!(link.utm_medium.as_deref(), Some("email"));
        assert_eq!(link.utm_campaign.as_deref(), Some("spring_sale"));
        assert!(link.utm_content.is_none());
        assert_eq!(link.click_count, 0);
    }

    #[tokio::test]
    async fn test_create_utm_link_minimal() {
        let pool = helpers::create_memory_pool().await;
        let campaign_id = "camp_utm_minimal";
        seed_campaign(&pool, campaign_id).await;

        let link = create(&pool, campaign_id, "https://example.com/page", None, None, None, None)
            .await
            .unwrap();

        assert_eq!(link.url, "https://example.com/page");
        assert!(link.utm_source.is_none());
        assert!(link.utm_medium.is_none());
    }

    #[tokio::test]
    async fn test_get_by_id_success() {
        let pool = helpers::create_memory_pool().await;
        let campaign_id = "camp_utm_get";
        seed_campaign(&pool, campaign_id).await;

        let created = create(&pool, campaign_id, "https://example.com/get", None, None, None, None)
            .await
            .unwrap();

        let fetched = get_by_id(&pool, &created.id).await.unwrap();
        assert_eq!(fetched.id, created.id);
        assert_eq!(fetched.url, "https://example.com/get");
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_by_id(&pool, "nonexistent-id").await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_list_by_campaign() {
        let pool = helpers::create_memory_pool().await;
        let campaign_id = "camp_utm_list";
        seed_campaign(&pool, campaign_id).await;

        create(&pool, campaign_id, "https://example.com/1", None, None, None, None)
            .await
            .unwrap();
        create(&pool, campaign_id, "https://example.com/2", None, None, None, None)
            .await
            .unwrap();

        let links = list_by_campaign(&pool, campaign_id).await.unwrap();
        assert_eq!(links.len(), 2);
    }

    #[tokio::test]
    async fn test_increment_click() {
        let pool = helpers::create_memory_pool().await;
        let campaign_id = "camp_utm_inc";
        seed_campaign(&pool, campaign_id).await;

        let link = create(&pool, campaign_id, "https://example.com/inc", None, None, None, None)
            .await
            .unwrap();

        assert_eq!(link.click_count, 0);

        increment_click(&pool, &link.id).await.unwrap();
        let fetched = get_by_id(&pool, &link.id).await.unwrap();
        assert_eq!(fetched.click_count, 1);

        increment_click(&pool, &link.id).await.unwrap();
        let fetched = get_by_id(&pool, &link.id).await.unwrap();
        assert_eq!(fetched.click_count, 2);
    }

    #[tokio::test]
    async fn test_increment_click_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = increment_click(&pool, "nonexistent-id").await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_utm_link() {
        let pool = helpers::create_memory_pool().await;
        let campaign_id = "camp_utm_del";
        seed_campaign(&pool, campaign_id).await;

        let link = create(&pool, campaign_id, "https://example.com/del", None, None, None, None)
            .await
            .unwrap();

        delete(&pool, &link.id).await.unwrap();
        let result = get_by_id(&pool, &link.id).await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = delete(&pool, "nonexistent-id").await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }
}
