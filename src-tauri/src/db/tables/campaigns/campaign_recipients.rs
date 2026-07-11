//! Campaign recipient query functions.
//!
//! CRUD and analytics queries for the `campaign_recipients` table, which maps
//! contacts to a campaign with their delivery/engagement status. All functions
//! are `async` against a `SqlitePool`; missing rows surface as
//! `AppDbError::NotFound` (see [`update_status`] and [`delete`]).
use crate::db::campaigns::schema::{CampaignRecipient, CampaignRecipientWithCampaign};
use crate::db::error::AppDbError;
use sqlx::SqlitePool;

/// List all recipients of `campaign_id`, ordered by `status`.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `campaign_id`: campaign whose recipients are returned.
///
/// # Returns
/// A `Vec<CampaignRecipient>` (possibly empty) for that campaign, ordered by
/// the `status` column.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Does **not** error for an
/// empty result.
pub async fn list_by_campaign(
    pool: &SqlitePool,
    campaign_id: &str,
) -> Result<Vec<CampaignRecipient>, AppDbError> {
    sqlx::query_as::<_, CampaignRecipient>(
        "SELECT * FROM campaign_recipients WHERE campaign_id = ? ORDER BY status",
    )
    .bind(campaign_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get the recipient row for a specific `(campaign_id, contact_id)` pair.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `campaign_id`: campaign the contact belongs to.
/// - `contact_id`: contact whose recipient row is fetched.
///
/// # Returns
/// `Ok(Some(CampaignRecipient))` if the contact is a recipient of the
/// campaign, or `Ok(None)` if no such row exists.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Does **not** return
/// `NotFound` — a missing row is a normal `None` result.
pub async fn get_status(
    pool: &SqlitePool,
    campaign_id: &str,
    contact_id: &str,
) -> Result<Option<CampaignRecipient>, AppDbError> {
    sqlx::query_as::<_, CampaignRecipient>(
        "SELECT * FROM campaign_recipients WHERE campaign_id = ? AND contact_id = ?",
    )
    .bind(campaign_id)
    .bind(contact_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Insert a campaign recipient, or update it if the `(campaign_id,
/// contact_id)` pair already exists (`ON CONFLICT ... DO UPDATE`).
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `campaign_id`: owning campaign id.
/// - `contact_id`: contact id being added/updated.
/// - `status`: delivery status to set (e.g. `'pending'`).
/// - `variant`: optional A/B variant label; on conflict, `NULL` is preserved
///   via `COALESCE(excluded.variant, campaign_recipients.variant)`.
///
/// # Returns
/// The full `CampaignRecipient` row after the insert/update.
///
/// # Errors
/// Returns `AppDbError::Database` on constraint violations or query failures.
/// Never returns `NotFound`.
pub async fn upsert(
    pool: &SqlitePool,
    campaign_id: &str,
    contact_id: &str,
    status: &str,
    variant: Option<&str>,
) -> Result<CampaignRecipient, AppDbError> {
    sqlx::query_as::<_, CampaignRecipient>(
        r#"
        INSERT INTO campaign_recipients (campaign_id, contact_id, status, variant)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(campaign_id, contact_id) DO UPDATE
        SET status = excluded.status,
            variant = COALESCE(excluded.variant, campaign_recipients.variant)
        RETURNING *
        "#,
    )
    .bind(campaign_id)
    .bind(contact_id)
    .bind(status)
    .bind(variant)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update the delivery/engagement status of a recipient, preserving existing
/// timestamps unless new ones are supplied.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `campaign_id`: campaign the recipient belongs to.
/// - `contact_id`: contact whose recipient row is updated.
/// - `status`: new delivery status.
/// - `opened_at`, `clicked_at`, `is_winner`: optional new values; when `None`,
///   `COALESCE(?, <column>)` leaves the current value unchanged.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `Recipient campaign_id='<campaign_id>' contact_id='<contact_id>' not found`
/// when no row matched the key (`rows_affected() == 0`). Returns
/// `AppDbError::Database` for other failures.
pub async fn update_status(
    pool: &SqlitePool,
    campaign_id: &str,
    contact_id: &str,
    status: &str,
    opened_at: Option<i64>,
    clicked_at: Option<i64>,
    is_winner: Option<i64>,
) -> Result<(), AppDbError> {
    let rows = sqlx::query(
        r#"
        UPDATE campaign_recipients
        SET status = ?,
            opened_at = COALESCE(?, opened_at),
            clicked_at = COALESCE(?, clicked_at),
            is_winner = COALESCE(?, is_winner)
        WHERE campaign_id = ? AND contact_id = ?
        "#,
    )
    .bind(status)
    .bind(opened_at)
    .bind(clicked_at)
    .bind(is_winner)
    .bind(campaign_id)
    .bind(contact_id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?
    .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "Recipient campaign_id='{campaign_id}' contact_id='{contact_id}' not found"
        )));
    }
    Ok(())
}

/// Remove a contact from a campaign's recipient list.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `campaign_id`: campaign the recipient belongs to.
/// - `contact_id`: contact to remove.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `Recipient campaign_id='<campaign_id>' contact_id='<contact_id>' not found`
/// when no row matched the key (`rows_affected() == 0`). Returns
/// `AppDbError::Database` for other failures.
pub async fn delete(
    pool: &SqlitePool,
    campaign_id: &str,
    contact_id: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query(
        "DELETE FROM campaign_recipients WHERE campaign_id = ? AND contact_id = ?",
    )
    .bind(campaign_id)
    .bind(contact_id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?
    .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "Recipient campaign_id='{campaign_id}' contact_id='{contact_id}' not found"
        )));
    }
    Ok(())
}

/// Get all campaigns a contact belongs to, along with that contact's recipient
/// status in each, by joining `campaigns` and `campaign_recipients`.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `contact_id`: contact whose campaign memberships are returned.
///
/// # Returns
/// A `Vec<CampaignRecipientWithCampaign>` (possibly empty), ordered newest
/// campaign (`created_at`) first.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Does **not** error when the
/// contact has no campaigns.
pub async fn get_campaigns_for_contact(
    pool: &SqlitePool,
    contact_id: &str,
) -> Result<Vec<CampaignRecipientWithCampaign>, AppDbError> {
    sqlx::query_as::<_, CampaignRecipientWithCampaign>(
        r#"
        SELECT c.id as campaign_id, c.name as campaign_name, c.status as campaign_status,
               c.sent_at, c.created_at as campaign_created_at,
               cr.status as recipient_status, cr.opened_at, cr.clicked_at, cr.variant, cr.is_winner
        FROM campaign_recipients cr
        JOIN campaigns c ON c.id = cr.campaign_id
        WHERE cr.contact_id = ?
        ORDER BY c.created_at DESC
        "#,
    )
    .bind(contact_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Count recipients grouped by `status` for a campaign (sent, opened,
/// clicked, bounced, etc.).
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `campaign_id`: campaign whose recipient counts are aggregated.
///
/// # Returns
/// A `Vec<(String, i64)>` of `(status, count)` pairs, one per distinct status
/// present (empty if the campaign has no recipients).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Does **not** error for an
/// empty result.
pub async fn count_by_status(
    pool: &SqlitePool,
    campaign_id: &str,
) -> Result<Vec<(String, i64)>, AppDbError> {
    #[derive(sqlx::FromRow)]
    struct StatusCount {
        status: String,
        count: i64,
    }

    let rows = sqlx::query_as::<_, StatusCount>(
        "SELECT status, COUNT(*) as count FROM campaign_recipients WHERE campaign_id = ? GROUP BY status"
    )
    .bind(campaign_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(rows.into_iter().map(|r| (r.status, r.count)).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;
    use sqlx::SqlitePool;

    /// Seed a minimal campaign + contact row for foreign-key dependencies.
    async fn seed_campaign_and_contact(
        pool: &SqlitePool,
        campaign_id: &str,
        contact_id: &str,
    ) {
        let account_id = "acct_recip_test";
        helpers::insert_test_account(pool, account_id).await;
        helpers::insert_test_campaign(pool, campaign_id, account_id).await;
        helpers::insert_test_contact(pool, contact_id).await;
    }

    #[tokio::test]
    async fn test_upsert_recipient() {
        let pool = helpers::create_memory_pool().await;
        let campaign_id = "camp_recip_upsert";
        let contact_id = "contact_upsert";
        seed_campaign_and_contact(&pool, campaign_id, contact_id).await;

        let recipient = upsert(&pool, campaign_id, contact_id, "pending", None)
            .await
            .unwrap();

        assert_eq!(recipient.campaign_id, campaign_id);
        assert_eq!(recipient.contact_id, contact_id);
        assert_eq!(recipient.status, "pending");
        assert!(recipient.opened_at.is_none());
        assert!(recipient.clicked_at.is_none());
    }

    #[tokio::test]
    async fn test_upsert_existing_updates_status() {
        let pool = helpers::create_memory_pool().await;
        let campaign_id = "camp_recip_upsert2";
        let contact_id = "contact_upsert2";
        seed_campaign_and_contact(&pool, campaign_id, contact_id).await;

        upsert(&pool, campaign_id, contact_id, "pending", None)
            .await
            .unwrap();

        let updated = upsert(&pool, campaign_id, contact_id, "sent", Some("A"))
            .await
            .unwrap();

        assert_eq!(updated.status, "sent");
        assert_eq!(updated.variant.as_deref(), Some("A"));
    }

    #[tokio::test]
    async fn test_get_status() {
        let pool = helpers::create_memory_pool().await;
        let campaign_id = "camp_recip_get";
        let contact_id = "contact_get";
        seed_campaign_and_contact(&pool, campaign_id, contact_id).await;

        upsert(&pool, campaign_id, contact_id, "delivered", None)
            .await
            .unwrap();

        let result = get_status(&pool, campaign_id, contact_id).await.unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().status, "delivered");
    }

    #[tokio::test]
    async fn test_get_status_none() {
        let pool = helpers::create_memory_pool().await;
        let result = get_status(&pool, "nonexistent-campaign", "nonexistent-contact")
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_list_by_campaign() {
        let pool = helpers::create_memory_pool().await;
        let campaign_id = "camp_recip_list";
        let contact_a = "contact_list_a";
        let contact_b = "contact_list_b";
        seed_campaign_and_contact(&pool, campaign_id, contact_a).await;
        // Need to seed contact_b separately
        helpers::insert_test_contact(&pool, contact_b).await;

        upsert(&pool, campaign_id, contact_a, "sent", None)
            .await
            .unwrap();
        upsert(&pool, campaign_id, contact_b, "pending", Some("B"))
            .await
            .unwrap();

        let recipients = list_by_campaign(&pool, campaign_id).await.unwrap();
        assert_eq!(recipients.len(), 2);
    }

    #[tokio::test]
    async fn test_update_status_success() {
        let pool = helpers::create_memory_pool().await;
        let campaign_id = "camp_recip_upd_status";
        let contact_id = "contact_upd_status";
        seed_campaign_and_contact(&pool, campaign_id, contact_id).await;

        upsert(&pool, campaign_id, contact_id, "pending", None)
            .await
            .unwrap();

        let now = chrono::Utc::now().timestamp();
        update_status(&pool, campaign_id, contact_id, "opened", Some(now), None, None)
            .await
            .unwrap();

        let result = get_status(&pool, campaign_id, contact_id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(result.status, "opened");
        assert_eq!(result.opened_at, Some(now));
    }

    #[tokio::test]
    async fn test_update_status_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = update_status(&pool, "bad-camp", "bad-contact", "opened", None, None, None)
            .await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_recipient() {
        let pool = helpers::create_memory_pool().await;
        let campaign_id = "camp_recip_del";
        let contact_id = "contact_del";
        seed_campaign_and_contact(&pool, campaign_id, contact_id).await;

        upsert(&pool, campaign_id, contact_id, "pending", None)
            .await
            .unwrap();

        delete(&pool, campaign_id, contact_id).await.unwrap();

        let result = get_status(&pool, campaign_id, contact_id)
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = delete(&pool, "bad-camp", "bad-contact").await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }
}
