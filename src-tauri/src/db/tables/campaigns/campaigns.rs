//! Campaigns query functions.
//!
//! CRUD and dashboard-aggregate queries for the `campaigns` table. All
//! functions are `async` and run against a shared `SqlitePool`. Missing rows
//! are surfaced as `AppDbError::NotFound` (see [`get_by_id`] and [`delete`]).
use crate::db::campaigns::schema::Campaign;
use crate::db::common::fetch_or_not_found;
use crate::db::error::AppDbError;
use sqlx::SqlitePool;

/// List all campaigns for an account, newest first.
pub async fn list(pool: &SqlitePool, company_id: &str) -> Result<Vec<Campaign>, AppDbError> {
    sqlx::query_as::<_, Campaign>(
        "SELECT * FROM campaigns WHERE company_id = ? ORDER BY created_at DESC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single campaign by its primary key `id`.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `id`: primary key of the campaign to fetch.
///
/// # Returns
/// The full `Campaign` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `Campaign with id '<id>' not found` when no campaign matches the key.
/// Returns `AppDbError::Database` for other query failures.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Campaign, AppDbError> {
    let opt = sqlx::query_as::<_, Campaign>("SELECT * FROM campaigns WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "Campaign")
}

/// Create a new campaign row and return the full inserted row.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `company_id`: owning account/company id.
/// - `name`: human-readable campaign name.
/// - `template_id`: optional email template id.
/// - `segment_id`: optional contact segment id.
/// - `ab_test_config`: optional A/B-test configuration JSON string.
/// - `analytics_json`: optional analytics payload JSON string.
/// - `scheduled_at`: optional epoch-second timestamp for scheduled sending.
/// - `recurring_cron`: optional cron expression for recurring campaigns.
///
/// A new UUID primary key and `created_at` timestamp are generated; `status`
/// is seeded to `'draft'` and `sent_count` to `0`.
///
/// # Returns
/// The created `Campaign` with all server-assigned columns populated.
///
/// # Errors
/// Returns `AppDbError::Database` on constraint violations or query failures
/// (e.g. an unknown `company_id` foreign key). Never returns `NotFound`.
pub async fn create(
    pool: &SqlitePool,
    company_id: &str,
    name: &str,
    template_id: Option<&str>,
    segment_id: Option<&str>,
    ab_test_config: Option<&str>,
    analytics_json: Option<&str>,
    scheduled_at: Option<i64>,
    recurring_cron: Option<&str>,
) -> Result<Campaign, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, Campaign>(
        r#"
        INSERT INTO campaigns (
            id, company_id, name, template_id, segment_id,
            status, sent_count, ab_test_config, analytics_json,
            scheduled_at, recurring_cron, created_at
        ) VALUES (?, ?, ?, ?, ?, 'draft', 0, ?, ?,
                  ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(name)
    .bind(template_id)
    .bind(segment_id)
    .bind(ab_test_config)
    .bind(analytics_json)
    .bind(scheduled_at)
    .bind(recurring_cron)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update mutable fields of a campaign, carrying forward existing values for
/// any field left as `None`, and return the updated row.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `id`: primary key of the campaign to update.
/// - `name`, `template_id`, `segment_id`, `ab_test_config`, `analytics_json`:
///   optional new values; `None` keeps the current persisted value.
/// - `scheduled_at`: optional epoch-second timestamp; `None` keeps current.
///
/// # Returns
/// The updated `Campaign` row after the write.
///
/// # Errors
/// Returns `AppDbError::NotFound` (propagated from the internal [`get_by_id`]
/// lookup) when `id` does not exist. Returns `AppDbError::Database` for other
/// query failures.
pub async fn update(
    pool: &SqlitePool,
    id: &str,
    name: Option<&str>,
    template_id: Option<&str>,
    segment_id: Option<&str>,
    ab_test_config: Option<&str>,
    analytics_json: Option<&str>,
    scheduled_at: Option<i64>,
) -> Result<Campaign, AppDbError> {
    // Always update all mutable columns, carrying forward existing
    // values when not provided.
    let existing = get_by_id(pool, id).await?;

    let new_name = name.unwrap_or(&existing.name).to_string();
    let new_template_id = template_id.or(existing.template_id.as_deref()).map(String::from);
    let new_segment_id = segment_id.or(existing.segment_id.as_deref()).map(String::from);
    let new_ab_test = ab_test_config.or(existing.ab_test_config.as_deref()).map(String::from);
    let new_analytics = analytics_json.or(existing.analytics_json.as_deref()).map(String::from);
    let new_scheduled_at = scheduled_at.or(existing.scheduled_at);

    sqlx::query_as::<_, Campaign>(
        r#"
        UPDATE campaigns
        SET name = ?,
            template_id = ?,
            segment_id = ?,
            ab_test_config = ?,
            analytics_json = ?,
            scheduled_at = ?
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(&new_name)
    .bind(&new_template_id)
    .bind(&new_segment_id)
    .bind(&new_ab_test)
    .bind(&new_analytics)
    .bind(new_scheduled_at)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update only the status of a campaign.
pub async fn update_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let rows = sqlx::query(
        "UPDATE campaigns SET status = ?, sent_at = CASE WHEN ? = 'sent' THEN ? ELSE sent_at END WHERE id = ?",
    )
    .bind(status)
    .bind(status)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?
    .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("Campaign with id '{id}' not found")));
    }
    Ok(())
}

/// Atomically increment `sent_count` for a campaign by one.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `id`: primary key of the campaign.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Note: this does **not**
/// verify the row exists first — a missing `id` silently affects zero rows
/// and still returns `Ok(())`.
pub async fn increment_sent_count(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    sqlx::query("UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete a campaign by its primary key.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM campaigns WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("Campaign with id '{id}' not found")));
    }
    Ok(())
}

// ── Dashboard aggregate queries ────────────────────────────────────────────────

/// Count the total number of campaigns across all accounts.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
///
/// # Returns
/// Total campaign count as `i64` (zero if the table is empty).
///
/// # Errors
/// Returns `AppDbError::Database` if the `SELECT COUNT(*)` query fails.
/// Never returns `NotFound`.
pub async fn count_all(pool: &SqlitePool) -> Result<i64, AppDbError> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM campaigns")
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
    async fn test_create_campaign() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acct_campaign_test_1";
        helpers::insert_test_account(&pool, company_id).await;

        let campaign = create(
            &pool,
            company_id,
            "Test Campaign",
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .unwrap();

        assert_eq!(campaign.company_id, company_id);
        assert_eq!(campaign.name, "Test Campaign");
        assert_eq!(campaign.status, "draft");
        assert_eq!(campaign.sent_count, 0);
        assert!(campaign.template_id.is_none());
        assert!(campaign.segment_id.is_none());
    }

    #[tokio::test]
    async fn test_get_by_id_success() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acct_campaign_get";
        helpers::insert_test_account(&pool, company_id).await;

        let created = create(
            &pool,
            company_id,
            "Get Test",
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .unwrap();

        let fetched = get_by_id(&pool, &created.id).await.unwrap();
        assert_eq!(fetched.id, created.id);
        assert_eq!(fetched.name, "Get Test");
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_by_id(&pool, "nonexistent-id").await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_list_campaigns() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acct_campaign_list";
        helpers::insert_test_account(&pool, company_id).await;

        create(&pool, company_id, "Campaign A", None, None, None, None, None, None)
            .await
            .unwrap();
        create(&pool, company_id, "Campaign B", None, None, None, None, None, None)
            .await
            .unwrap();

        let campaigns = list(&pool, company_id).await.unwrap();
        assert_eq!(campaigns.len(), 2);
        // Newest first
        assert!(campaigns[0].created_at >= campaigns[1].created_at);
    }

    #[tokio::test]
    async fn test_update_campaign() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acct_campaign_update";
        helpers::insert_test_account(&pool, company_id).await;

        let created = create(&pool, company_id, "Original", None, None, None, None, None, None)
            .await
            .unwrap();

        let updated = update(
            &pool,
            &created.id,
            Some("Updated Name"),
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .unwrap();

        assert_eq!(updated.name, "Updated Name");
        // Verify persistence
        let fetched = get_by_id(&pool, &created.id).await.unwrap();
        assert_eq!(fetched.name, "Updated Name");
    }

    #[tokio::test]
    async fn test_update_status() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acct_campaign_status";
        helpers::insert_test_account(&pool, company_id).await;

        let created = create(&pool, company_id, "Status Test", None, None, None, None, None, None)
            .await
            .unwrap();

        update_status(&pool, &created.id, "sent").await.unwrap();
        let fetched = get_by_id(&pool, &created.id).await.unwrap();
        assert_eq!(fetched.status, "sent");
        assert!(fetched.sent_at.is_some());
    }

    #[tokio::test]
    async fn test_update_status_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = update_status(&pool, "bad-id", "sent").await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_campaign() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acct_campaign_delete";
        helpers::insert_test_account(&pool, company_id).await;

        let created = create(&pool, company_id, "Delete Me", None, None, None, None, None, None)
            .await
            .unwrap();

        delete(&pool, &created.id).await.unwrap();
        let result = get_by_id(&pool, &created.id).await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = delete(&pool, "nonexistent-id").await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }
}
