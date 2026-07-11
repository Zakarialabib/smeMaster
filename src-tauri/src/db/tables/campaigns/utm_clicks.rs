//! UTM click query functions.
//!
//! Insert and listing queries for the `utm_clicks` table, which records an
//! individual click event on a UTM link. All functions are `async` against a
//! `SqlitePool`. These helpers only record/list clicks — they do **not**
//! update `utm_links.click_count`; call [`super::utm_links::increment_click`]
//! for that. Errors are reported via [`crate::db::error::AppDbError`].
use crate::db::campaigns::schema::UtmClick;
use crate::db::error::AppDbError;
use sqlx::SqlitePool;

/// List all clicks for `link_id`, ordered most recent (`clicked_at`) first.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `link_id`: UTM link whose clicks are returned.
///
/// # Returns
/// A `Vec<UtmClick>` (possibly empty) for that link.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Does **not** error for an
/// empty result.
pub async fn list_by_link(
    pool: &SqlitePool,
    link_id: &str,
) -> Result<Vec<UtmClick>, AppDbError> {
    sqlx::query_as::<_, UtmClick>(
        "SELECT * FROM utm_clicks WHERE link_id = ? ORDER BY clicked_at DESC",
    )
    .bind(link_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Record a new click on a UTM link and return the full inserted row.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `link_id`: UTM link that was clicked.
/// - `contact_id`: contact that performed the click.
///
/// A new UUID primary key and `clicked_at` timestamp are generated. The
/// `utm_links.click_count` counter is **not** modified by this function — call
/// [`super::utm_links::increment_click`] separately to bump it.
///
/// # Returns
/// The created `UtmClick` row with server-assigned columns populated.
///
/// # Errors
/// Returns `AppDbError::Database` on constraint violations or query failures
/// (e.g. unknown `link_id`/`contact_id` foreign keys). Never returns
/// `NotFound`.
pub async fn create(
    pool: &SqlitePool,
    link_id: &str,
    contact_id: &str,
) -> Result<UtmClick, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, UtmClick>(
        r#"
        INSERT INTO utm_clicks (id, link_id, contact_id, clicked_at)
        VALUES (?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(link_id)
    .bind(contact_id)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;
    use sqlx::SqlitePool;

    /// Seed a full chain: account → campaign → utm_link + contact
    async fn seed_link_and_contact(pool: &SqlitePool, link_id: &str, contact_id: &str) {
        let account_id = "acct_click_test";
        let campaign_id = "camp_click_test";
        helpers::insert_test_account(pool, account_id).await;
        helpers::insert_test_campaign(pool, campaign_id, account_id).await;

        // UTM link
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT INTO utm_links (id, campaign_id, url, click_count, created_at) VALUES (?, ?, 'https://example.com', 0, ?)",
        )
        .bind(link_id)
        .bind(campaign_id)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();

        // Contact
        helpers::insert_test_contact(pool, contact_id).await;
    }

    #[tokio::test]
    async fn test_create_utm_click() {
        let pool = helpers::create_memory_pool().await;
        let link_id = "link_click_create";
        let contact_id = "contact_click_create";
        seed_link_and_contact(&pool, link_id, contact_id).await;

        let click = create(&pool, link_id, contact_id).await.unwrap();

        assert_eq!(click.link_id, link_id);
        assert_eq!(click.contact_id, contact_id);
        assert!(click.clicked_at > 0);
    }

    #[tokio::test]
    async fn test_list_by_link() {
        let pool = helpers::create_memory_pool().await;
        let link_id = "link_click_list";
        let contact_a = "contact_click_list_a";
        let contact_b = "contact_click_list_b";
        seed_link_and_contact(&pool, link_id, contact_a).await;

        // Seed second contact
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT INTO contacts (id, email, health_status, engagement_score, created_at, updated_at) VALUES (?, ?, 'cold', 0.0, ?, ?)",
        )
        .bind(contact_b)
        .bind("contact_list_b@test.com")
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        create(&pool, link_id, contact_a).await.unwrap();
        create(&pool, link_id, contact_b).await.unwrap();

        let clicks = list_by_link(&pool, link_id).await.unwrap();
        assert_eq!(clicks.len(), 2);
        // Most recent first
        assert!(clicks[0].clicked_at >= clicks[1].clicked_at);
    }

    #[tokio::test]
    async fn test_list_by_link_empty() {
        let pool = helpers::create_memory_pool().await;
        let link_id = "link_click_empty";
        let contact_id = "contact_empty";
        seed_link_and_contact(&pool, link_id, contact_id).await;

        let clicks = list_by_link(&pool, link_id).await.unwrap();
        assert!(clicks.is_empty());
    }
}
