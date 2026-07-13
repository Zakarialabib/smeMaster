//! Campaign orchestration operations.
//!
//! Higher-level, multi-step workflows for campaigns that span several tables
//! and must run atomically. These move the "create campaign + resolve
//! recipients + send" orchestration into Rust so the frontend can issue a
//! single `invoke` call instead of chaining 3–4 round-trips. Each operation
//! runs inside a `sqlx` transaction (`pool.begin()`) and reports failures via
//! [`crate::db::error::AppDbError`].
use crate::db::campaigns::schema::Campaign;
use crate::db::error::AppDbError;
use crate::db::tables::campaigns::campaigns;
use sqlx::SqlitePool;

/// Create a campaign together with all of its recipients in a single
/// transaction.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `company_id`: owning account/company id.
/// - `name`: campaign name.
/// - `template_id`: optional email template id.
/// - `segment_id`: optional contact segment id.
/// - `ab_test_config`: optional A/B-test configuration JSON string.
/// - `contact_ids`: slice of contact ids to add as recipients. Each is inserted
///   with status `'pending'`; an empty slice is allowed.
/// - `scheduled_at`: optional epoch-second timestamp for scheduled sending.
///   When set, the campaign status is `'scheduled'` and a `CampaignSchedule`
///   row + pending_operation are created.
/// - `recurring_cron`: optional cron expression for recurring campaigns.
///
/// # Returns
/// The created `Campaign` row (with full row data) once the transaction
/// commits.
///
/// # Errors
/// Returns `AppDbError::Database` if the transaction fails (e.g. unknown
/// `company_id` foreign key, or a recipient contact that does not exist). The
/// whole operation is rolled back on error. Never returns `NotFound`.
pub async fn create_with_recipients(
    pool: &SqlitePool,
    company_id: &str,
    name: &str,
    template_id: Option<&str>,
    segment_id: Option<&str>,
    ab_test_config: Option<&str>,
    contact_ids: &[String],
    scheduled_at: Option<i64>,
    recurring_cron: Option<&str>,
) -> Result<Campaign, AppDbError> {
    let mut tx = pool.begin().await.map_err(AppDbError::Database)?;

    // Step 1: Create the campaign
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    let status = if scheduled_at.is_some() { "scheduled" } else { "draft" };

    let campaign = sqlx::query_as::<_, Campaign>(
        r#"
        INSERT INTO campaigns (
            id, company_id, name, template_id, segment_id,
            status, sent_count, ab_test_config, analytics_json,
            scheduled_at, recurring_cron, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL,
                  ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(name)
    .bind(template_id)
    .bind(segment_id)
    .bind(status)
    .bind(ab_test_config)
    .bind(scheduled_at)
    .bind(recurring_cron)
    .bind(now)
    .fetch_one(&mut *tx)
    .await
    .map_err(AppDbError::Database)?;

    // Step 2: Bulk-insert recipients in a tight loop within the same transaction
    for contact_id in contact_ids {
        sqlx::query(
            "INSERT INTO campaign_recipients (campaign_id, contact_id, status) VALUES (?, ?, 'pending')",
        )
        .bind(&id)
        .bind(contact_id)
        .execute(&mut *tx)
        .await
        .map_err(AppDbError::Database)?;
    }

    // Step 3: If scheduled, create a CampaignSchedule row and a pending_operation
    if let Some(sched_at) = scheduled_at {
        let schedule_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO campaign_schedules (id, campaign_id, scheduled_at, status, created_at)
            VALUES (?, ?, ?, 'pending', ?)
            "#,
        )
        .bind(&schedule_id)
        .bind(&id)
        .bind(sched_at)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(AppDbError::Database)?;

        // Create a pending_operation that the queue service will pick up
        let op_id = uuid::Uuid::new_v4().to_string();
        let params = serde_json::json!({
            "campaignId": id,
            "scheduleId": schedule_id,
        });
        let params_str = serde_json::to_string(&params)
            .map_err(|e| AppDbError::Internal(format!("JSON serialization error: {e}")))?;

        sqlx::query(
            r#"
            INSERT INTO pending_operations (
                id, company_id, operation_type, resource_id, params,
                status, retry_count, max_retries, next_retry_at, error_message,
                campaign_id, created_at
            ) VALUES (?, ?, 'send_campaign', ?, ?, 'pending', 0, 3, ?, NULL, ?, ?)
            "#,
        )
        .bind(&op_id)
        .bind(company_id)
        .bind(&format!("campaign:{id}"))
        .bind(&params_str)
        .bind(sched_at)
        .bind(&id)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(AppDbError::Database)?;
    }

    tx.commit().await.map_err(AppDbError::Database)?;

    Ok(campaign)
}

/// Execute the full "send campaign" pipeline in a single transaction.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `campaign_id`: primary key of the campaign to send.
///
/// # Returns
/// The number of recipients processed (`i64`), equal to the campaign's
/// recipient count.
///
/// # Errors
/// Returns `AppDbError::NotFound` (propagated from the internal
/// [`campaigns::get_by_id`] lookup) when `campaign_id` does not exist. Returns
/// `AppDbError::Database` for JSON/serialization failures (mapped to
/// `AppDbError::Internal`) or other query failures; the whole operation is
/// rolled back on error.
pub async fn send_campaign(
    pool: &SqlitePool,
    campaign_id: &str,
) -> Result<i64, AppDbError> {
    // Step 1: Load campaign (validates existence)
    let campaign = campaigns::get_by_id(pool, campaign_id).await?;
    let company_id = campaign.company_id.clone();
    let now = chrono::Utc::now().timestamp();

    // Parse AB test config if present
    let ab_config: Option<AbTestConfig> = campaign
        .ab_test_config
        .as_deref()
        .and_then(|json| serde_json::from_str(json).ok());

    let mut tx = pool.begin().await.map_err(AppDbError::Database)?;

    // Step 2: Load recipients within the transaction
    let recipients = sqlx::query_as::<_, crate::db::campaigns::schema::CampaignRecipient>(
        "SELECT * FROM campaign_recipients WHERE campaign_id = ?",
    )
    .bind(campaign_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(AppDbError::Database)?;

    let recipient_count = recipients.len() as i64;

    // Step 3: Enqueue pending operations for each recipient
    for recipient in &recipients {
        // Assign variant if AB test is configured
        let variant = if let Some(ref config) = ab_config {
            let variant_idx = deterministic_variant(
                recipient.contact_id.as_bytes(),
                config.split_ratio,
            );
            let variant_name = if variant_idx == 0 { "A" } else { "B" };

            sqlx::query(
                "UPDATE campaign_recipients SET variant = ? WHERE campaign_id = ? AND contact_id = ?",
            )
            .bind(variant_name)
            .bind(campaign_id)
            .bind(&recipient.contact_id)
            .execute(&mut *tx)
            .await
            .map_err(AppDbError::Database)?;

            variant_name.to_string()
        } else {
            String::new()
        };

        // Build params JSON for the pending operation
        let params = serde_json::json!({
            "campaignId": campaign_id,
            "contactId": recipient.contact_id,
            "templateId": campaign.template_id,
            "variant": variant,
        });

        let params_str = serde_json::to_string(&params)
            .map_err(|e| AppDbError::Internal(format!("JSON serialization error: {e}")))?;

        let op_id = uuid::Uuid::new_v4().to_string();
        let resource_id = format!("campaign:{campaign_id}:{}", recipient.contact_id);

        sqlx::query(
            r#"
            INSERT INTO pending_operations (
                id, company_id, operation_type, resource_id, params,
                status, retry_count, max_retries, next_retry_at, error_message,
                campaign_id, created_at
            ) VALUES (?, ?, 'send_campaign_email', ?, ?, 'pending', 0, 3, NULL, NULL, ?, ?)
            "#,
        )
        .bind(&op_id)
        .bind(&company_id)
        .bind(&resource_id)
        .bind(&params_str)
        .bind(campaign_id)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(AppDbError::Database)?;
    }

    // Step 4: Update campaign status to "sent" with sent_at timestamp.
    // If the campaign is already 'scheduled', the queue service will handle
    // the status transition — we only update sent_count here.
    if campaign.status != "scheduled" {
        sqlx::query(
            "UPDATE campaigns SET status = 'sent', sent_at = ?, sent_count = sent_count + 1 WHERE id = ?",
        )
        .bind(now)
        .bind(campaign_id)
        .execute(&mut *tx)
        .await
        .map_err(AppDbError::Database)?;
    } else {
        // For scheduled campaigns, just increment sent_count without changing status
        sqlx::query(
            "UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?",
        )
        .bind(campaign_id)
        .execute(&mut *tx)
        .await
        .map_err(AppDbError::Database)?;
    }

    tx.commit().await.map_err(AppDbError::Database)?;

    Ok(recipient_count)
}

/// Deterministically assign a variant (0 = A, 1 = B) based on a contact's ID
/// and the configured split ratio.
fn deterministic_variant(contact_id: &[u8], split_ratio: f64) -> usize {
    use sha2::{Sha256, Digest};
    let hash = Sha256::digest(contact_id);
    let hash_u64 = u64::from_be_bytes([
        hash[0], hash[1], hash[2], hash[3],
        hash[4], hash[5], hash[6], hash[7],
    ]);
    let normalized = (hash_u64 as f64) / (u64::MAX as f64);
    if normalized < split_ratio { 0 } else { 1 }
}

#[derive(serde::Deserialize)]
struct AbTestConfig {
    #[serde(rename = "splitRatio")]
    split_ratio: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::campaigns::campaign_recipients;
    use crate::db::tables::test_helpers::helpers;
    use sqlx::SqlitePool;

    async fn seed_env(pool: &SqlitePool) -> (String, Vec<String>) {
        let account_id = "acct_campaign_op_test";
        helpers::insert_test_account(pool, account_id).await;
        helpers::insert_test_campaign(pool, "existing_camp", account_id).await;

        let contact_ids: Vec<String> = (0..5)
            .map(|i| format!("contact_op_{i}"))
            .collect();
        for cid in &contact_ids {
            helpers::insert_test_contact(pool, cid).await;
        }

        (account_id.to_string(), contact_ids)
    }

    #[tokio::test]
    async fn test_create_with_recipients_basic() {
        let pool = helpers::create_memory_pool().await;
        let (account_id, contact_ids) = seed_env(&pool).await;

        let campaign = create_with_recipients(
            &pool,
            &account_id,
            "Test Operation Campaign",
            None,
            None,
            None,
            &contact_ids,
            None,
            None,
        )
        .await
        .unwrap();

        assert_eq!(campaign.name, "Test Operation Campaign");
        assert_eq!(campaign.status, "draft");

        // Verify recipients were inserted
        let recipients = campaign_recipients::list_by_campaign(&pool, &campaign.id)
            .await
            .unwrap();
        assert_eq!(recipients.len(), 5);
        for r in &recipients {
            assert_eq!(r.status, "pending");
        }
    }

    #[tokio::test]
    async fn test_create_with_recipients_empty_contacts() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acct_campaign_empty";
        helpers::insert_test_account(&pool, &account_id).await;

        let campaign = create_with_recipients(
            &pool,
            &account_id,
            "Empty Recipients",
            None,
            None,
            None,
            &[],
            None,
            None,
        )
        .await
        .unwrap();

        assert_eq!(campaign.status, "draft");
        let recipients = campaign_recipients::list_by_campaign(&pool, &campaign.id)
            .await
            .unwrap();
        assert_eq!(recipients.len(), 0);
    }

    #[tokio::test]
    async fn test_create_with_recipients_with_template() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acct_campaign_tpl";
        helpers::insert_test_account(&pool, &account_id).await;

        let campaign = create_with_recipients(
            &pool,
            &account_id,
            "With Template",
            Some("tpl_001"),
            None,
            None,
            &[],
            None,
            None,
        )
        .await
        .unwrap();

        assert_eq!(campaign.template_id.as_deref(), Some("tpl_001"));
    }

    #[tokio::test]
    async fn test_deterministic_variant_consistency() {
        let id = b"contact_abc_123";
        let result1 = deterministic_variant(id, 0.5);
        let result2 = deterministic_variant(id, 0.5);
        assert_eq!(result1, result2, "Variant assignment must be deterministic");
    }

    #[tokio::test]
    async fn test_deterministic_variant_distribution() {
        // With split_ratio = 1.0, all should go to A (0)
        let result = deterministic_variant(b"anything", 1.0);
        assert_eq!(result, 0);

        // With split_ratio = 0.0, all should go to B (1)
        let result = deterministic_variant(b"anything_else", 0.0);
        assert_eq!(result, 1);
    }
}
