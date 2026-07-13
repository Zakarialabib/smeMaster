//! Tauri command handlers for the campaigns / deliverability / email-warming
//! domains.
//!
//! NOTE: despite the `crm.rs` file name, the handlers here operate on campaign,
//! deliverability, bounce, suppression, and email-warming tables rather than the
//! CRM `contacts` tables. They are documented here per the refactor's file list.
//! Each `#[tauri::command]` delegates to the corresponding DB-layer function in
//! `crate::db::tables::*` and maps `AppDbError` into `SerializedError`.

// ── Database Commands – Campaigns Domain ──────────────────────────────────

use serde::{Deserialize, Serialize};
use tauri::State;
use sqlx::SqlitePool;

use crate::db::commands::UpdateFields;
use crate::db::error::AppDbError;
use crate::db::campaigns::schema::{
    BackupSchedule, Campaign, CampaignRecipient, CampaignRecipientWithCampaign, UtmClick, UtmLink,
};
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

// ── Request types ──────────────────────────────────────────────────────────

/// A row of the `email_warming` table as returned to the frontend.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EmailWarmingRow {
    /// Primary key of the warming entry.
    pub id: String,
    /// Owning account id.
    pub account_id: String,
    /// Whether warming is enabled (0/1).
    pub enabled: i64,
    /// Starting daily send volume.
    pub start_volume: i64,
    /// Current daily send volume.
    pub current_volume: i64,
    /// Target daily send volume.
    pub target_volume: i64,
    /// Ramp-up duration in days.
    pub ramp_days: i64,
    /// Creation timestamp (unix epoch seconds).
    pub created_at: i64,
    /// Last-update timestamp (unix epoch seconds).
    pub updated_at: i64,
}

/// Request payload for upserting an `email_warming` entry.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertWarmingEntry {
    /// Owning account id.
    pub account_id: String,
    /// Optional new `enabled` flag (0/1).
    pub enabled: Option<i64>,
    /// Optional new `start_volume`.
    pub start_volume: Option<i64>,
    /// Optional new `current_volume`.
    pub current_volume: Option<i64>,
    /// Optional new `target_volume`.
    pub target_volume: Option<i64>,
    /// Optional new `ramp_days`.
    pub ramp_days: Option<i64>,
}

/// Request payload for recording a bounced email.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsertBounceRequest {
    /// Primary key for the bounce record.
    pub id: String,
    /// Optional associated campaign id.
    pub campaign_id: Option<String>,
    /// Optional associated contact id.
    pub contact_id: Option<String>,
    /// Recipient email that bounced.
    pub recipient_email: String,
    /// Bounce classification (e.g. `hard`, `soft`).
    pub bounce_type: String,
    /// Optional SMTP diagnostic code.
    pub diagnostic_code: Option<String>,
    /// Optional human-readable reason.
    pub reason: Option<String>,
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD COMMANDS – Campaigns
// ═══════════════════════════════════════════════════════════════════════════════

/// Count the total number of campaigns for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// # Returns
/// The campaign count as `i64`.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_dashboard_campaigns_total(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    crate::db::tables::campaigns::campaigns::count_all(&pool)
        .await
        .map_err(Into::into)
}

/// Count campaigns for an account with a `sent` status.
///
/// # Parameters
/// - `account_id`: owning account.
/// # Returns
/// The `sent` campaign count as `i64`.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_dashboard_campaigns_sent(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    let row: (i64,) = sqlx::query_as("SELECT COALESCE(SUM(sent_count), 0) FROM campaigns")
        .fetch_one(&*pool)
        .await
        .map_err(|e| SerializedError::from(AppDbError::Database(e)))?;
    Ok(row.0)
}

/// Compute the aggregate open rate (opened / sent) across an account's campaigns.
///
/// # Parameters
/// - `account_id`: owning account.
/// # Returns
/// The open rate as `f64` (0.0 when there are no sent campaigns).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_dashboard_campaigns_open_rate(
    pool: State<'_, SqlitePool>,
) -> CmdResult<f64> {
    let result: (i64, i64) = sqlx::query_as(
        "SELECT COALESCE((SELECT SUM(sent_count) FROM campaigns WHERE id IN (SELECT DISTINCT campaign_id FROM campaign_recipients WHERE opened_at IS NOT NULL)), 0), COUNT(*) FROM campaign_recipients WHERE opened_at IS NOT NULL"
    )
    .fetch_one(&*pool)
    .await
    .map_err(|e| SerializedError::from(AppDbError::Database(e)))?;
    if result.0 == 0 { return Ok(0.0); }
    Ok(result.1 as f64 / result.0 as f64 * 100.0)
}

/// Compute the aggregate click rate (clicked / sent) across an account's campaigns.
///
/// # Parameters
/// - `account_id`: owning account.
/// # Returns
/// The click rate as `f64` (0.0 when there are no sent campaigns).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_dashboard_campaigns_click_rate(
    pool: State<'_, SqlitePool>,
) -> CmdResult<f64> {
    let result: (i64, i64) = sqlx::query_as(
        "SELECT COALESCE((SELECT SUM(sent_count) FROM campaigns WHERE id IN (SELECT DISTINCT campaign_id FROM campaign_recipients WHERE clicked_at IS NOT NULL)), 0), COUNT(*) FROM campaign_recipients WHERE clicked_at IS NOT NULL"
    )
    .fetch_one(&*pool)
    .await
    .map_err(|e| SerializedError::from(AppDbError::Database(e)))?;
    if result.0 == 0 { return Ok(0.0); }
    Ok(result.1 as f64 / result.0 as f64 * 100.0)
}

// ── Register function ──────────────────────────────────────────────────────

// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
    // builder
// }

// ── Commands ───────────────────────────────────────────────────────────────

/// List all campaigns for an account, newest first.
///
/// # Parameters
/// - `account_id`: owning account.
/// # Returns
/// A `Vec<Campaign>` ordered by `created_at DESC` (possibly empty).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_list_campaigns(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<Campaign>> {
    crate::db::tables::campaigns::campaigns::list(&pool, &company_id)
        .await
        .map_err(Into::into)
}

/// List every campaign a contact is a recipient of, with that contact's
/// delivery/engagement status in each. Powers the contact sidebar "relations"
/// view.
///
/// # Parameters
/// - `contact_id`: contact whose campaign memberships are returned.
/// # Returns
/// A `Vec<CampaignRecipientWithCampaign>` (possibly empty).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_list_campaigns_by_contact(
    pool: State<'_, SqlitePool>,
    contact_id: String,
) -> CmdResult<Vec<CampaignRecipientWithCampaign>> {
    crate::db::tables::campaigns::campaign_recipients::get_campaigns_for_contact(&pool, &contact_id)
        .await
        .map_err(Into::into)
}

/// List all backup schedules for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// # Returns
/// A `Vec<BackupSchedule>` (possibly empty).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_list_backup_schedules(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
) -> CmdResult<Vec<BackupSchedule>> {
    crate::db::tables::campaigns::backup_schedules::list(&pool, company_id.as_deref())
        .await
        .map_err(Into::into)
}

/// Insert an analytics snapshot row for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `snapshot_at`: timestamp for the snapshot.
/// - `metrics`: JSON-encoded metrics payload.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_insert_analytics_snapshot(
    pool: State<'_, SqlitePool>,
    id: String,
    campaign_id: String,
    snapshot_data: String,
) -> CmdResult<()> {
    sqlx::query("INSERT INTO analytics_snapshots (id, campaign_id, snapshot_data) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&campaign_id)
        .bind(&snapshot_data)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Persist the A/B test configuration JSON for a campaign.
///
/// # Parameters
/// - `campaign_id`: the campaign to update.
/// - `config`: A/B test configuration JSON string.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures (e.g. unknown campaign) surface as `SerializedError`.
#[tauri::command]
pub async fn db_update_campaign_ab_test_config(
    pool: State<'_, SqlitePool>,
    campaign_id: String,
    config: String,
) -> CmdResult<()> {
    crate::db::tables::campaigns::campaigns::update(
        &pool, &campaign_id, None, None, None, Some(&config), None,
    )
    .await?;
    Ok(())
}

/// Assign an A/B test `variant` to a campaign recipient.
///
/// # Parameters
/// - `campaign_id`: the campaign.
/// - `contact_id`: the recipient contact.
/// - `variant`: variant label to assign (e.g. `A`/`B`).
/// # Returns
/// `Ok(())` on success (no-op if the recipient link is absent).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_set_recipient_variant(
    pool: State<'_, SqlitePool>,
    campaign_id: String,
    contact_id: String,
    variant: String,
    is_winner: Option<bool>,
) -> CmdResult<()> {
    if let Some(winner) = is_winner {
        sqlx::query("UPDATE campaign_recipients SET variant = ?, is_winner = ? WHERE campaign_id = ? AND contact_id = ?")
            .bind(&variant)
            .bind(if winner { 1_i64 } else { 0_i64 })
            .bind(&campaign_id)
            .bind(&contact_id)
            .execute(&*pool)
            .await
            .map_err(AppDbError::Database)?;
    } else {
        sqlx::query("UPDATE campaign_recipients SET variant = ? WHERE campaign_id = ? AND contact_id = ?")
            .bind(&variant)
            .bind(&campaign_id)
            .bind(&contact_id)
            .execute(&*pool)
            .await
            .map_err(AppDbError::Database)?;
    }
    Ok(())
}

/// Append a log entry to an email-warming run.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `entry_id`: primary key for the log entry.
/// - `warming_id`: the warming entry this log belongs to.
/// - `sent_count`: number of messages sent in this run.
/// - `status`: run status label.
/// - `notes`: optional free-text notes.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_insert_warming_log(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    sent_date: String,
    volume: i64,
) -> CmdResult<()> {
    sqlx::query("INSERT INTO warming_log (id, account_id, sent_date, volume) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&account_id)
        .bind(&sent_date)
        .bind(volume)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Remove a domain from the phishing allowlist for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `domain`: the domain to remove.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_remove_phishing_allowlist(
    pool: State<'_, SqlitePool>,
    account_id: String,
    sender_address: String,
) -> CmdResult<()> {
    sqlx::query("DELETE FROM phishing_allowlist WHERE account_id = ? AND sender_address = ?")
        .bind(&account_id)
        .bind(&sender_address)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Remove a domain from the image allowlist for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `domain`: the domain to remove.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_remove_image_allowlist(
    pool: State<'_, SqlitePool>,
    account_id: String,
    sender_address: String,
) -> CmdResult<()> {
    sqlx::query("DELETE FROM image_allowlist WHERE account_id = ? AND sender_address = ?")
        .bind(&account_id)
        .bind(&sender_address)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Hold a bundled thread (suppress sending) for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `thread_id`: the thread to hold.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_hold_bundled_thread(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
    category: String,
    held_until: Option<i64>,
) -> CmdResult<()> {
    sqlx::query(
        "INSERT INTO bundled_threads (account_id, thread_id, category, held_until) VALUES (?, ?, ?, ?) ON CONFLICT(account_id, thread_id) DO UPDATE SET category = excluded.category, held_until = excluded.held_until"
    )
        .bind(&account_id)
        .bind(&thread_id)
        .bind(&category)
        .bind(held_until)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Release previously held bundled threads for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_release_held_threads(
    pool: State<'_, SqlitePool>,
    account_id: String,
    category: String,
) -> CmdResult<u64> {
    let result = sqlx::query("DELETE FROM bundled_threads WHERE account_id = ? AND category = ? AND held_until IS NOT NULL")
        .bind(&account_id)
        .bind(&category)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(result.rows_affected())
}

/// Mark a bundle rule as delivered for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `rule_id`: the bundle rule to update.
/// - `delivered`: new delivered flag (0/1).
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_update_bundle_rule_delivered(
    pool: State<'_, SqlitePool>,
    account_id: String,
    category: String,
    now: i64,
) -> CmdResult<()> {
    sqlx::query("UPDATE bundle_rules SET last_delivered_at = ? WHERE account_id = ? AND category = ?")
        .bind(now)
        .bind(&account_id)
        .bind(&category)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// List all bundle rules for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// # Returns
/// A `Vec<BundleRule>` (possibly empty).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_list_bundle_rules(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<crate::db::tables::deliverability::bundle_rules::BundleRule>> {
    crate::db::tables::deliverability::bundle_rules::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

/// Insert or update a bundle rule for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `rule`: the `BundleRule` payload to upsert.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_upsert_bundle_rule(
    pool: State<'_, SqlitePool>,
    _id: String,
    account_id: String,
    category: String,
    is_bundled: Option<bool>,
    delivery_enabled: Option<bool>,
    delivery_schedule: Option<String>,
) -> CmdResult<()> {
    crate::db::tables::deliverability::bundle_rules::upsert_bundle_rule(
        &pool,
        &account_id,
        &category,
        is_bundled.unwrap_or(false),
        delivery_enabled.unwrap_or(false),
        delivery_schedule.as_deref(),
    )
    .await?;
    Ok(())
}

/// Delete a bundle rule for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `rule_id`: the bundle rule to delete.
/// # Returns
/// `Ok(())` on success (affects zero rows when the rule is absent, not an error).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_delete_bundle_rule(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::deliverability::bundle_rules::delete(&pool, &id)
        .await?;
    Ok(())
}

/// Record a bounced email (`InsertBounceRequest`).
///
/// # Parameters
/// - `account_id`: owning account.
/// - `req`: the bounce record payload (id, recipient, type, reason, etc.).
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_insert_bounce(
    pool: State<'_, SqlitePool>,
    bounce: InsertBounceRequest,
) -> CmdResult<()> {
    sqlx::query("INSERT INTO bounces (id, campaign_id, contact_id, recipient_email, bounce_type, diagnostic_code, reason) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&bounce.id)
        .bind(&bounce.campaign_id)
        .bind(&bounce.contact_id)
        .bind(&bounce.recipient_email)
        .bind(&bounce.bounce_type)
        .bind(&bounce.diagnostic_code)
        .bind(&bounce.reason)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Add an email to the suppression list for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `entry_id`: primary key for the suppression entry.
/// - `email`: the email to suppress.
/// - `reason`: optional reason for suppression.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_insert_suppression(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    email: String,
    reason: String,
) -> CmdResult<()> {
    sqlx::query("INSERT OR IGNORE INTO suppression_list (id, account_id, email, reason) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&account_id)
        .bind(&email)
        .bind(&reason)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Remove an email from the suppression list for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `email`: the email to remove from suppression.
/// # Returns
/// `Ok(())` on success (affects zero rows when the email is absent, not an error).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_remove_suppression(
    pool: State<'_, SqlitePool>,
    account_id: String,
    email: String,
) -> CmdResult<()> {
    sqlx::query("DELETE FROM suppression_list WHERE account_id = ? AND email = ?")
        .bind(&account_id)
        .bind(&email)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

// ── Campaign CRUD ──────────────────────────────────────────────────────────

/// Create a new campaign for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `name`: campaign name.
/// - `template_id`: optional template id.
/// - `segment_id`: optional segment id.
/// - `ab_test_config`: optional A/B test config JSON.
/// # Returns
/// The newly created `Campaign`.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_create_campaign(
    pool: State<'_, SqlitePool>,
    company_id: String,
    name: String,
    template_id: Option<String>,
    segment_id: Option<String>,
    ab_test_config: Option<String>,
    analytics_json: Option<String>,
) -> CmdResult<Campaign> {
    crate::db::tables::campaigns::campaigns::create(
        &pool,
        &company_id,
        &name,
        template_id.as_deref(),
        segment_id.as_deref(),
        ab_test_config.as_deref(),
        analytics_json.as_deref(),
    )
    .await
    .map_err(Into::into)
}

/// Fetch a single campaign by id.
///
/// # Parameters
/// - `campaign_id`: the campaign primary key.
/// # Returns
/// `Ok(Some(Campaign))` when found, or `Ok(None)` (not an error) when absent.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_get_campaign(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Campaign> {
    crate::db::tables::campaigns::campaigns::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

/// Delete a campaign by id.
///
/// # Parameters
/// - `campaign_id`: the campaign primary key.
/// # Returns
/// `Ok(())` when deleted.
/// # Errors
/// Returns `SerializedError` (`AppDbError::NotFound`) when the campaign does not
/// exist (zero rows affected).
#[tauri::command]
pub async fn db_delete_campaign(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::campaigns::campaigns::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

/// Update a campaign's status.
///
/// # Parameters
/// - `campaign_id`: the campaign to update.
/// - `status`: new status label (e.g. `draft`, `sent`, `paused`).
/// # Returns
/// The updated `Campaign`.
/// # Errors
/// Database failures (e.g. unknown campaign) surface as `SerializedError`.
#[tauri::command]
pub async fn db_update_campaign_status(
    pool: State<'_, SqlitePool>,
    id: String,
    status: String,
) -> CmdResult<()> {
    crate::db::tables::campaigns::campaigns::update_status(&pool, &id, &status)
        .await
        .map_err(Into::into)
}

/// A single (status, count) pair for campaign recipient stats.
#[derive(Debug, Serialize)]
pub struct CampaignStatRow {
    /// Recipient status label (e.g. `sent`, `opened`, `clicked`).
    pub status: String,
    /// Number of recipients in that status.
    pub count: i64,
}

/// Get recipient counts grouped by status for a campaign.
///
/// # Parameters
/// - `campaign_id`: the campaign to summarize.
/// # Returns
/// A `Vec<CampaignStatRow>` (status + count) for the campaign's recipients.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_get_campaign_stats_by_status(
    pool: State<'_, SqlitePool>,
    campaign_id: String,
) -> CmdResult<Vec<CampaignStatRow>> {
    let results = crate::db::tables::campaigns::campaign_recipients::count_by_status(
        &pool, &campaign_id
    ).await?;
    Ok(results.into_iter().map(|(status, count)| CampaignStatRow { status, count }).collect())
}

/// Increment a campaign's `sent_count` by `amount`.
///
/// # Parameters
/// - `campaign_id`: the campaign to update.
/// - `amount`: how much to add (may be negative).
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_increment_campaign_sent_count(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::campaigns::campaigns::increment_sent_count(&pool, &id)
        .await
        .map_err(Into::into)
}

// ── Campaign Orchestration (combined operations) ──────────────────────────

/// Input for creating a campaign together with its recipient contacts.
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCampaignWithRecipientsInput {
    /// Owning account id.
    pub company_id: String,
    /// Campaign display name.
    pub name: String,
    /// Optional template id.
    pub template_id: Option<String>,
    /// Optional segment id used to scope recipients.
    pub segment_id: Option<String>,
    /// Optional A/B test configuration JSON.
    pub ab_test_config: Option<String>,
    /// Contact ids to add as recipients.
    pub contact_ids: Vec<String>,
}

/// Result of creating a campaign with recipients.
#[derive(Debug, Serialize)]
pub struct CreateCampaignWithRecipientsResult {
    /// The newly created `Campaign`.
    pub campaign: Campaign,
    /// Number of recipient contacts provided.
    pub recipient_count: usize,
}

/// Create a campaign and attach its recipient contacts in one call.
///
/// Runs inside a single transaction, replacing the old frontend
/// orchestration (`campaignService.createCampaign`).
///
/// # Parameters
/// - `account_id`: owning account.
/// - `input`: `CreateCampaignWithRecipientsInput` (name, template, segment,
///   A/B config, and contact ids).
/// # Returns
/// A `CreateCampaignWithRecipientsResult` with the created `Campaign` and the
/// recipient count.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_create_campaign_with_recipients(
    pool: State<'_, SqlitePool>,
    input: CreateCampaignWithRecipientsInput,
) -> CmdResult<CreateCampaignWithRecipientsResult> {
    let campaign = crate::db::campaigns::operations::create_with_recipients(
        &pool,
        &input.company_id,
        &input.name,
        input.template_id.as_deref(),
        input.segment_id.as_deref(),
        input.ab_test_config.as_deref(),
        &input.contact_ids,
    )
    .await?;

    let recipient_count = input.contact_ids.len();

    Ok(CreateCampaignWithRecipientsResult {
        campaign,
        recipient_count,
    })
}

/// Trigger sending a campaign.
///
/// Assigns A/B variants, enqueues pending operations, and updates status,
/// replacing the old frontend orchestration (`campaignService.sendCampaign`).
///
/// # Parameters
/// - `campaign_id`: the campaign to send.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures (e.g. campaign not found or not in a sendable state)
/// surface as `SerializedError`.
#[tauri::command]
pub async fn db_send_campaign(
    pool: State<'_, SqlitePool>,
    campaign_id: String,
) -> CmdResult<i64> {
    crate::db::campaigns::operations::send_campaign(&pool, &campaign_id)
        .await
        .map_err(Into::into)
}

/// Bulk-add recipient contacts to a campaign.
///
/// Accepts a list of contact IDs and inserts them all as pending recipients.
///
/// # Parameters
/// - `campaign_id`: the campaign to add recipients to.
/// - `contact_ids`: contact ids to add.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_add_campaign_recipients_bulk(
    pool: State<'_, SqlitePool>,
    campaign_id: String,
    contact_ids: Vec<String>,
) -> CmdResult<usize> {
    let _count = contact_ids.len();
    let mut any_inserted = 0usize;

    let mut tx = pool.begin().await.map_err(|e| {
        SerializedError::from(crate::db::error::AppDbError::Database(e))
    })?;

    for cid in &contact_ids {
        let rows = sqlx::query(
            "INSERT OR IGNORE INTO campaign_recipients (campaign_id, contact_id, status) VALUES (?, ?, 'pending')",
        )
        .bind(&campaign_id)
        .bind(cid)
        .execute(&mut *tx)
        .await
        .map_err(|e| SerializedError::from(crate::db::error::AppDbError::Database(e)))?;

        if rows.rows_affected() > 0 {
            any_inserted += 1;
        }
    }

    tx.commit().await.map_err(|e| {
        SerializedError::from(crate::db::error::AppDbError::Database(e))
    })?;

    Ok(any_inserted)
}

// ── Backup Schedule CRUD ───────────────────────────────────────────────────

/// Create a backup schedule for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `schedule`: the `BackupSchedule` payload to create.
/// # Returns
/// The created `BackupSchedule`.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_create_backup_schedule(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
    name: String,
    format: String,
    cron_expression: String,
    destination_path: Option<String>,
    encrypt: bool,
    is_enabled: bool,
) -> CmdResult<BackupSchedule> {
    crate::db::tables::campaigns::backup_schedules::create(
        &pool,
        company_id.as_deref(),
        &name,
        &format,
        &cron_expression,
        destination_path.as_deref(),
        encrypt,
        is_enabled,
    )
    .await
    .map_err(Into::into)
}

/// Update an existing backup schedule for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `schedule`: the `BackupSchedule` payload (with id) to update.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_update_backup_schedule(
    pool: State<'_, SqlitePool>,
    id: String,
    name: Option<String>,
    format: Option<String>,
    cron_expression: Option<String>,
    destination_path: Option<String>,
    encrypt: Option<bool>,
    is_enabled: Option<bool>,
) -> CmdResult<BackupSchedule> {
    crate::db::tables::campaigns::backup_schedules::update(
        &pool,
        &id,
        name.as_deref(),
        format.as_deref(),
        cron_expression.as_deref(),
        destination_path.as_deref(),
        encrypt,
        is_enabled,
    )
    .await
    .map_err(Into::into)
}

/// Delete a backup schedule for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `schedule_id`: the schedule to delete.
/// # Returns
/// `Ok(())` on success (affects zero rows when absent, not an error).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_delete_backup_schedule(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::campaigns::backup_schedules::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

/// Record the last-run timestamp of a backup schedule.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `schedule_id`: the schedule to update.
/// - `last_run`: new last-run timestamp.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_update_backup_schedule_last_run(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::campaigns::backup_schedules::update_last_run(&pool, &id)
        .await
        .map_err(Into::into)
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL WARMING
// ═══════════════════════════════════════════════════════════════════════════════

/// List email-warming entries for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// # Returns
/// A `Vec<EmailWarmingRow>` (possibly empty).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_list_warming(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<EmailWarmingRow>> {
    let rows = sqlx::query_as::<_, EmailWarmingRow>(
        "SELECT * FROM email_warming WHERE account_id = ? ORDER BY created_at DESC",
    )
    .bind(&account_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;
    Ok(rows)
}

/// Insert or update an email-warming entry for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `entry`: `UpsertWarmingEntry` payload (only the provided fields are changed).
/// # Returns
/// The resulting `EmailWarmingRow`.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_upsert_warming(
    pool: State<'_, SqlitePool>,
    entry: UpsertWarmingEntry,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO email_warming (id, account_id, enabled, start_volume, current_volume, target_volume, ramp_days, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) \
         ON CONFLICT(account_id) DO UPDATE SET \
            enabled = COALESCE(?, email_warming.enabled), \
            start_volume = COALESCE(?, email_warming.start_volume), \
            current_volume = COALESCE(?, email_warming.current_volume), \
            target_volume = COALESCE(?, email_warming.target_volume), \
            ramp_days = COALESCE(?, email_warming.ramp_days), \
            updated_at = ?",
    )
    .bind(&id)
    .bind(&entry.account_id)
    .bind(entry.enabled.unwrap_or(0))
    .bind(entry.start_volume.unwrap_or(10))
    .bind(entry.current_volume.unwrap_or(10))
    .bind(entry.target_volume.unwrap_or(50))
    .bind(entry.ramp_days.unwrap_or(30))
    .bind(now)
    .bind(now)
    .bind(entry.enabled)
    .bind(entry.start_volume)
    .bind(entry.current_volume)
    .bind(entry.target_volume)
    .bind(entry.ramp_days)
    .bind(now)
    .execute(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;
    Ok(())
}

/// Partially update an email-warming entry's fields.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `id`: the warming entry primary key.
/// - `fields`: `UpdateFields` describing `set`/`unset` columns.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Returns `SerializedError` (`AppDbError::NotFound`) with message
/// `EmailWarming {id}` when the entry does not exist; other database failures
/// surface as `SerializedError`.
///
/// # SQL-safety
/// The dynamic `UPDATE` set-clause is built from `fields` keys and the values
/// are bound parameters, so the statement is wrapped in `AssertSqlSafe` (no raw
/// user input reaches the SQL text).
#[tauri::command]
pub async fn db_update_warming(
    pool: State<'_, SqlitePool>,
    id: String,
    fields: UpdateFields,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    let set_count = fields.set.len();
    if set_count == 0 && fields.unset.is_empty() {
        sqlx::query("UPDATE email_warming SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(&id)
            .execute(&*pool)
            .await
            .map_err(|e| AppDbError::Database(e))?;
        return Ok(());
    }
    let mut set_parts: Vec<String> = Vec::with_capacity(set_count + 1 + fields.unset.len());
    let mut set_values: Vec<serde_json::Value> = Vec::with_capacity(set_count);
    for key in &fields.unset {
        set_parts.push(format!("\"{key}\" = NULL"));
    }
    for (key, value) in &fields.set {
        set_parts.push(format!("\"{key}\" = ?"));
        set_values.push(value.clone());
    }
    set_parts.push("\"updated_at\" = ?".to_string());
    let sql = format!("UPDATE email_warming SET {} WHERE id = ?", set_parts.join(", "));
    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql));
    for val in &set_values {
        q = q.bind(val);
    }
    q = q.bind(now);
    q = q.bind(&id);
    q.execute(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    Ok(())
}

/// Delete an email-warming entry for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `id`: the warming entry primary key.
/// # Returns
/// `Ok(())` when deleted.
/// # Errors
/// Returns `SerializedError` (`AppDbError::NotFound`) with message
/// `EmailWarming {id}` when the entry does not exist (zero rows affected).
#[tauri::command]
pub async fn db_delete_warming(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    let rows = sqlx::query("DELETE FROM email_warming WHERE id = ?")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| AppDbError::Database(e))?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("EmailWarming {id}")).into());
    }
    Ok(())
}

// ── Campaign Recipients ─────────────────────────────────────────────────

/// List recipients of a campaign.
///
/// # Parameters
/// - `campaign_id`: the campaign whose recipients to return.
/// # Returns
/// A `Vec<CampaignRecipient>` (possibly empty).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_list_campaign_recipients(
    pool: State<'_, SqlitePool>,
    campaign_id: String,
) -> CmdResult<Vec<CampaignRecipient>> {
    crate::db::tables::campaigns::campaign_recipients::list_by_campaign(&pool, &campaign_id)
        .await
        .map_err(Into::into)
}

/// Get the status of a single campaign recipient.
///
/// # Parameters
/// - `campaign_id`: the campaign.
/// - `contact_id`: the recipient contact.
/// # Returns
/// `Ok(Some(status))` when the recipient link exists, or `Ok(None)` (not an error)
/// when it does not.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_get_campaign_recipient_status(
    pool: State<'_, SqlitePool>,
    campaign_id: String,
    contact_id: String,
) -> CmdResult<Option<CampaignRecipient>> {
    crate::db::tables::campaigns::campaign_recipients::get_status(&pool, &campaign_id, &contact_id)
        .await
        .map_err(Into::into)
}

/// Insert or update a campaign recipient link.
///
/// # Parameters
/// - `campaign_id`: the campaign.
/// - `contact_id`: the recipient contact.
/// - `status`: recipient status label.
/// - `metadata`: optional JSON metadata.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_upsert_campaign_recipient(
    pool: State<'_, SqlitePool>,
    campaign_id: String,
    contact_id: String,
    status: String,
    variant: Option<String>,
) -> CmdResult<CampaignRecipient> {
    crate::db::tables::campaigns::campaign_recipients::upsert(
        &pool, &campaign_id, &contact_id, &status, variant.as_deref(),
    )
    .await
    .map_err(Into::into)
}

/// Update a campaign recipient's status.
///
/// # Parameters
/// - `campaign_id`: the campaign.
/// - `contact_id`: the recipient contact.
/// - `status`: new status label.
/// # Returns
/// `Ok(())` on success (affects zero rows when the link is absent, not an error).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_update_campaign_recipient_status(
    pool: State<'_, SqlitePool>,
    campaign_id: String,
    contact_id: String,
    status: String,
    opened_at: Option<i64>,
    clicked_at: Option<i64>,
    is_winner: Option<i64>,
) -> CmdResult<()> {
    crate::db::tables::campaigns::campaign_recipients::update_status(
        &pool, &campaign_id, &contact_id, &status, opened_at, clicked_at, is_winner,
    )
    .await
    .map_err(Into::into)
}

/// Delete a campaign recipient link.
///
/// # Parameters
/// - `campaign_id`: the campaign.
/// - `contact_id`: the recipient contact to remove.
/// # Returns
/// `Ok(())` on success (affects zero rows when the link is absent, not an error).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_delete_campaign_recipient(
    pool: State<'_, SqlitePool>,
    campaign_id: String,
    contact_id: String,
) -> CmdResult<()> {
    crate::db::tables::campaigns::campaign_recipients::delete(&pool, &campaign_id, &contact_id)
        .await
        .map_err(Into::into)
}

/// List the campaigns that include a given contact as a recipient.
///
/// # Parameters
/// - `contact_id`: the contact to look up.
/// # Returns
/// A `Vec<Campaign>` (possibly empty).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_get_campaigns_for_contact(
    pool: State<'_, SqlitePool>,
    contact_id: String,
) -> CmdResult<Vec<CampaignRecipientWithCampaign>> {
    crate::db::tables::campaigns::campaign_recipients::get_campaigns_for_contact(&pool, &contact_id)
        .await
        .map_err(Into::into)
}

// ── UTM Clicks ─────────────────────────────────────────────────────────

/// List UTM click records for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// # Returns
/// A `Vec<UtmClick>` (possibly empty).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_list_utm_clicks(
    pool: State<'_, SqlitePool>,
    link_id: String,
) -> CmdResult<Vec<UtmClick>> {
    crate::db::tables::campaigns::utm_clicks::list_by_link(&pool, &link_id)
        .await
        .map_err(Into::into)
}

/// Record a UTM click event.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `click`: the `UtmClick` payload to insert.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_create_utm_click(
    pool: State<'_, SqlitePool>,
    link_id: String,
    contact_id: String,
) -> CmdResult<UtmClick> {
    crate::db::tables::campaigns::utm_clicks::create(&pool, &link_id, &contact_id)
        .await
        .map_err(Into::into)
}

// ── UTM Links ─────────────────────────────────────────────────────────

/// List UTM links for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// # Returns
/// A `Vec<UtmLink>` (possibly empty).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_list_utm_links(
    pool: State<'_, SqlitePool>,
    campaign_id: String,
) -> CmdResult<Vec<UtmLink>> {
    crate::db::tables::campaigns::utm_links::list_by_campaign(&pool, &campaign_id)
        .await
        .map_err(Into::into)
}

/// Fetch a single UTM link by id.
///
/// # Parameters
/// - `link_id`: the UTM link primary key.
/// # Returns
/// `Ok(Some(UtmLink))` when found, or `Ok(None)` (not an error) when absent.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_get_utm_link(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<UtmLink> {
    crate::db::tables::campaigns::utm_links::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

/// Create a UTM link for an account.
///
/// # Parameters
/// - `account_id`: owning account.
/// - `link`: the `UtmLink` payload to create.
/// # Returns
/// The created `UtmLink`.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_create_utm_link(
    pool: State<'_, SqlitePool>,
    campaign_id: String,
    url: String,
    utm_source: Option<String>,
    utm_medium: Option<String>,
    utm_campaign: Option<String>,
    utm_content: Option<String>,
) -> CmdResult<UtmLink> {
    crate::db::tables::campaigns::utm_links::create(
        &pool, &campaign_id, &url,
        utm_source.as_deref(), utm_medium.as_deref(),
        utm_campaign.as_deref(), utm_content.as_deref(),
    )
    .await
    .map_err(Into::into)
}

/// Increment the click count of a UTM link.
///
/// # Parameters
/// - `link_id`: the UTM link to increment.
/// # Returns
/// `Ok(())` on success.
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_increment_utm_click_count(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::campaigns::utm_links::increment_click(&pool, &id)
        .await
        .map_err(Into::into)
}

/// Delete a UTM link by id.
///
/// # Parameters
/// - `link_id`: the UTM link primary key.
/// # Returns
/// `Ok(())` on success (affects zero rows when absent, not an error).
/// # Errors
/// Database failures surface as `SerializedError`.
#[tauri::command]
pub async fn db_delete_utm_link(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::campaigns::utm_links::delete(&pool, &id)
        .await
        .map_err(Into::into)
}