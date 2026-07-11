//! Deliverability Tauri commands. Each `#[tauri::command]` here is a thin
//! wrapper that delegates to a DB helper under `crate::db::tables::deliverability`
//! (or the `deliverability::schema` structs) and maps `AppDbError` into
//! `SerializedError`. These are registered centrally in `commands::register()`.

use tauri::State;
use sqlx::SqlitePool;
use serde::Serialize;
use crate::db::tables::deliverability::alert_preferences::AlertPreferences;
use crate::db::tables::deliverability::blacklist_monitors::BlacklistMonitor;
use crate::db::tables::deliverability::bulk_check_jobs::BulkCheckJob;
use crate::db::tables::deliverability::delist_requests::DelistRequest;
use crate::db::tables::deliverability::reputation_scores::ReputationScore;
use crate::db::deliverability::schema::{DeliverabilityConfig, DeliverabilityEvent, NewsletterBundle};
use crate::db::tables::deliverability::arf_reports::ArfReport;
use crate::db::tables::deliverability::blacklist_checks::BlacklistCheck;
use crate::db::tables::deliverability::bundle_rules::BundleRule;
use crate::db::tables::deliverability::bundled_threads::BundledThread;
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
//     builder
// }

#[tauri::command]
pub async fn db_list_deliverability_configs(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<DeliverabilityConfig>> {
    crate::db::tables::deliverability::config::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_deliverability_events(
    pool: State<'_, SqlitePool>,
    account_id: String,
    event_type: Option<String>,
) -> CmdResult<Vec<DeliverabilityEvent>> {
    match event_type {
        Some(et) => crate::db::tables::deliverability::events::list_by_type(&pool, &account_id, &et)
            .await
            .map_err(Into::into),
        None => crate::db::tables::deliverability::events::list(&pool, &account_id)
            .await
            .map_err(Into::into),
    }
}

#[tauri::command]
pub async fn db_list_newsletter_bundles(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<NewsletterBundle>> {
    crate::db::tables::deliverability::newsletter_bundles::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_blacklist_cache(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<BlacklistCheck>> {
    crate::db::tables::deliverability::blacklist_checks::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

/// Insert or replace a blacklist check cache entry.
///
/// Delegates to `blacklist_checks::upsert`, mapping `is_listed` to `1`/`0`.
/// Errors are surfaced as `SerializedError`.
#[tauri::command]
pub async fn db_upsert_blacklist_cache(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    dnsbl_server: String,
    query_target: String,
    is_listed: bool,
    response_text: Option<String>,
) -> CmdResult<()> {
    crate::db::tables::deliverability::blacklist_checks::upsert(
        &pool,
        &id,
        &account_id,
        &dnsbl_server,
        &query_target,
        if is_listed { 1 } else { 0 },
        response_text.as_deref(),
    )
    .await
    .map_err(Into::into)
}

/// Delete a blacklist check cache entry by id.
///
/// Delegates to `blacklist_checks::delete`. A `NotFound` (unknown id) is
/// surfaced as `SerializedError`.
#[tauri::command]
pub async fn db_delete_blacklist_cache(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::deliverability::blacklist_checks::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_arf_reports(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<ArfReport>> {
    crate::db::tables::deliverability::arf_reports::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

/// Create a new ARF report.
///
/// Delegates to `arf_reports::create` (all string/option fields passed through).
/// Errors are surfaced as `SerializedError`.
#[tauri::command]
pub async fn db_create_arf_report(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    original_recipient: Option<String>,
    reported_domain: Option<String>,
    feedback_type: Option<String>,
    user_agent: Option<String>,
    source_ip: Option<String>,
    arrival_date: Option<i64>,
    report_raw: Option<String>,
) -> CmdResult<()> {
    crate::db::tables::deliverability::arf_reports::create(
        &pool,
        &id,
        &account_id,
        original_recipient.as_deref(),
        reported_domain.as_deref(),
        feedback_type.as_deref(),
        user_agent.as_deref(),
        source_ip.as_deref(),
        arrival_date,
        report_raw.as_deref(),
    )
    .await
    .map_err(Into::into)
}

/// Mark an ARF report as processed by id.
///
/// Delegates to `arf_reports::mark_processed`. A `NotFound` (unknown id) is
/// surfaced as `SerializedError`.
#[tauri::command]
pub async fn db_update_arf_report_processed(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::deliverability::arf_reports::mark_processed(&pool, &id)
        .await
        .map_err(Into::into)
}

// ── New deliverability commands ───────────────────────────────────────────────

#[tauri::command]
pub async fn db_get_arf_report(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<ArfReport> {
    crate::db::tables::deliverability::arf_reports::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_arf_report(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::deliverability::arf_reports::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_blacklist_check(
    pool: State<'_, SqlitePool>,
    account_id: String,
    dnsbl_server: String,
    query_target: String,
    is_listed: bool,
    response_text: Option<String>,
) -> CmdResult<BlacklistCheck> {
    crate::db::tables::deliverability::blacklist_checks::create(
        &pool,
        &account_id,
        &dnsbl_server,
        &query_target,
        is_listed,
        response_text.as_deref(),
    )
    .await
    .map_err(Into::into)
}

/// Update the result of an existing blacklist check.
///
/// Delegates to `blacklist_checks::update_result`. A `NotFound` (unknown id) is
/// surfaced as `SerializedError`.
#[tauri::command]
pub async fn db_update_blacklist_check_result(
    pool: State<'_, SqlitePool>,
    id: String,
    is_listed: bool,
    response_text: Option<String>,
) -> CmdResult<()> {
    crate::db::tables::deliverability::blacklist_checks::update_result(
        &pool,
        &id,
        is_listed,
        response_text.as_deref(),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_bundle_rule(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Option<BundleRule>> {
    crate::db::tables::deliverability::bundle_rules::get_by_id_opt(&pool, &id)
        .await
        .map_err(Into::into)
}

/// List all bundled threads for an account.
///
/// Delegates to `bundled_threads::list`. Errors are surfaced as `SerializedError`.
#[tauri::command]
pub async fn db_list_bundled_threads(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<BundledThread>> {
    crate::db::tables::deliverability::bundled_threads::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_add_to_bundle(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
    category: String,
    held_until: Option<i64>,
) -> CmdResult<BundledThread> {
    crate::db::tables::deliverability::bundled_threads::add_to_bundle(
        &pool, &account_id, &thread_id, &category, held_until,
    )
    .await
    .map_err(Into::into)
}

/// Remove a thread from its bundle.
///
/// Delegates to `bundled_threads::remove_from_bundle`. A `NotFound` is surfaced
/// as `SerializedError`.
#[tauri::command]
pub async fn db_remove_from_bundle(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
) -> CmdResult<()> {
    crate::db::tables::deliverability::bundled_threads::remove_from_bundle(&pool, &account_id, &thread_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_bundled_threads_by_category(
    pool: State<'_, SqlitePool>,
    account_id: String,
    category: String,
) -> CmdResult<Vec<BundledThread>> {
    crate::db::tables::deliverability::bundled_threads::get_by_category(&pool, &account_id, &category)
        .await
        .map_err(Into::into)
}

/// Get the deliverability config for an account by type (returns `None` if absent).
///
/// Delegates to `config::get_by_type`. Errors are surfaced as `SerializedError`.
#[tauri::command]
pub async fn db_get_deliverability_config_by_type(
    pool: State<'_, SqlitePool>,
    account_id: String,
    config_type: String,
) -> CmdResult<Option<DeliverabilityConfig>> {
    crate::db::tables::deliverability::config::get_by_type(&pool, &account_id, &config_type)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_deliverability_config(
    pool: State<'_, SqlitePool>,
    account_id: String,
    config_type: String,
    config_json: String,
    is_active: bool,
) -> CmdResult<DeliverabilityConfig> {
    crate::db::tables::deliverability::config::upsert(&pool, &account_id, &config_type, &config_json, is_active)
        .await
        .map_err(Into::into)
}

/// Delete a deliverability config by id.
///
/// Delegates to `config::delete`. A `NotFound` (unknown id) is surfaced as
/// `SerializedError`.
#[tauri::command]
pub async fn db_delete_deliverability_config(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::deliverability::config::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_deliverability_event(
    pool: State<'_, SqlitePool>,
    account_id: String,
    event_type: String,
    event_data_json: String,
) -> CmdResult<DeliverabilityEvent> {
    crate::db::tables::deliverability::events::create(&pool, &account_id, &event_type, &event_data_json)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_newsletter_bundle(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<NewsletterBundle> {
    crate::db::tables::deliverability::newsletter_bundles::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_newsletter_bundle(
    pool: State<'_, SqlitePool>,
    account_id: String,
    name: String,
    rules_json: String,
    thread_ids_json: String,
) -> CmdResult<NewsletterBundle> {
    crate::db::tables::deliverability::newsletter_bundles::create(
        &pool, &account_id, &name, &rules_json, &thread_ids_json,
    )
    .await
    .map_err(Into::into)
}

/// Update mutable fields of a newsletter bundle.
///
/// Delegates to `newsletter_bundles::update` (options passed through). A
/// `NotFound` (unknown id) is surfaced as `SerializedError`.
#[tauri::command]
pub async fn db_update_newsletter_bundle(
    pool: State<'_, SqlitePool>,
    id: String,
    name: Option<String>,
    rules_json: Option<String>,
    thread_ids_json: Option<String>,
) -> CmdResult<NewsletterBundle> {
    crate::db::tables::deliverability::newsletter_bundles::update(
        &pool,
        &id,
        name.as_deref(),
        rules_json.as_deref(),
        thread_ids_json.as_deref(),
    )
    .await
    .map_err(Into::into)
}

/// Delete a newsletter bundle by id.
///
/// Delegates to `newsletter_bundles::delete`. A `NotFound` (unknown id) is
/// surfaced as `SerializedError`.
#[tauri::command]
pub async fn db_delete_newsletter_bundle(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::deliverability::newsletter_bundles::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

// ── Blacklist Monitoring Commands ──────────────────────────────────────────────

/// List all blacklist monitors for an account.
///
/// Delegates to `blacklist_monitors::list`. Errors are surfaced as
/// `SerializedError`.
#[tauri::command]
pub async fn db_list_blacklist_monitors(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<BlacklistMonitor>> {
    crate::db::tables::deliverability::blacklist_monitors::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

/// Fetch a single blacklist monitor by id (returns `None` if absent).
///
/// Delegates to `blacklist_monitors::get_by_id`. Errors are surfaced as
/// `SerializedError`.
#[tauri::command]
pub async fn db_get_blacklist_monitor(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Option<BlacklistMonitor>> {
    crate::db::tables::deliverability::blacklist_monitors::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

/// Create a new blacklist monitor.
///
/// Delegates to `blacklist_monitors::create`. Errors are surfaced as
/// `SerializedError`.
#[tauri::command]
pub async fn db_create_blacklist_monitor(
    pool: State<'_, SqlitePool>,
    account_id: String,
    target: String,
    check_type: String,
    interval_minutes: i64,
    alerts_json: String,
) -> CmdResult<BlacklistMonitor> {
    crate::db::tables::deliverability::blacklist_monitors::create(
        &pool,
        &account_id,
        &target,
        &check_type,
        interval_minutes,
        &alerts_json,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_blacklist_monitor(
    pool: State<'_, SqlitePool>,
    id: String,
    interval_minutes: Option<i64>,
    alerts_json: Option<String>,
    enabled: Option<bool>,
) -> CmdResult<()> {
    crate::db::tables::deliverability::blacklist_monitors::update(
        &pool,
        &id,
        interval_minutes,
        alerts_json.as_deref(),
        enabled,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_blacklist_monitor(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::deliverability::blacklist_monitors::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

// ── Delist Request Commands ────────────────────────────────────────────────────

#[tauri::command]
pub async fn db_list_delist_requests(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<DelistRequest>> {
    crate::db::tables::deliverability::delist_requests::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_delist_request(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Option<DelistRequest>> {
    crate::db::tables::deliverability::delist_requests::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

/// Create a new delist request.
///
/// Delegates to `delist_requests::create` (option passed through). Errors are
/// surfaced as `SerializedError`.
#[tauri::command]
pub async fn db_create_delist_request(
    pool: State<'_, SqlitePool>,
    account_id: String,
    list_name: String,
    target: String,
    target_type: String,
    reason: Option<String>,
) -> CmdResult<DelistRequest> {
    crate::db::tables::deliverability::delist_requests::create(
        &pool,
        &account_id,
        &list_name,
        &target,
        &target_type,
        reason.as_deref(),
    )
    .await
    .map_err(Into::into)
}

/// Update the status (and optionally URL/notes) of a delist request.
///
/// Delegates to `delist_requests::update_status` (options passed through).
/// Errors are surfaced as `SerializedError`.
#[tauri::command]
pub async fn db_update_delist_request_status(
    pool: State<'_, SqlitePool>,
    id: String,
    status: String,
    delist_url: Option<String>,
    notes: Option<String>,
) -> CmdResult<()> {
    crate::db::tables::deliverability::delist_requests::update_status(
        &pool,
        &id,
        &status,
        delist_url.as_deref(),
        notes.as_deref(),
    )
    .await
    .map_err(Into::into)
}

/// Delete a delist request by id.
///
/// Delegates to `delist_requests::delete`. A `NotFound` (unknown id) is surfaced
/// as `SerializedError`.
#[tauri::command]
pub async fn db_delete_delist_request(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::deliverability::delist_requests::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

// ── Bulk Check Job Commands ───────────────────────────────────────────────────

#[tauri::command]
pub async fn db_get_bulk_check_job(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Option<BulkCheckJob>> {
    crate::db::tables::deliverability::bulk_check_jobs::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_bulk_check_jobs(
    pool: State<'_, SqlitePool>,
    account_id: String,
    limit: i64,
) -> CmdResult<Vec<BulkCheckJob>> {
    crate::db::tables::deliverability::bulk_check_jobs::list_recent(&pool, &account_id, limit)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_bulk_check_job(
    pool: State<'_, SqlitePool>,
    account_id: String,
    total_targets: i64,
) -> CmdResult<BulkCheckJob> {
    crate::db::tables::deliverability::bulk_check_jobs::create(&pool, &account_id, total_targets)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_bulk_check_job_progress(
    pool: State<'_, SqlitePool>,
    id: String,
    processed_targets: i64,
    results_json: String,
) -> CmdResult<()> {
    crate::db::tables::deliverability::bulk_check_jobs::update_progress(&pool, &id, processed_targets, &results_json)
        .await
        .map_err(Into::into)
}

/// Mark a bulk check job as completed.
///
/// Delegates to `bulk_check_jobs::complete`. Errors are surfaced as
/// `SerializedError`.
#[tauri::command]
pub async fn db_complete_bulk_check_job(
    pool: State<'_, SqlitePool>,
    id: String,
    results_json: String,
) -> CmdResult<()> {
    crate::db::tables::deliverability::bulk_check_jobs::complete(&pool, &id, &results_json)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_fail_bulk_check_job(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::deliverability::bulk_check_jobs::fail(&pool, &id)
        .await
        .map_err(Into::into)
}

// ── Reputation Score Commands ──────────────────────────────────────────────────

#[tauri::command]
pub async fn db_get_reputation_score(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Option<ReputationScore>> {
    crate::db::tables::deliverability::reputation_scores::get_by_account(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_reputation_score(
    pool: State<'_, SqlitePool>,
    account_id: String,
    overall_score: f64,
    blacklist_factor: f64,
    bounce_factor: f64,
    complaint_factor: f64,
    warmup_factor: f64,
) -> CmdResult<ReputationScore> {
    crate::db::tables::deliverability::reputation_scores::upsert(
        &pool,
        &account_id,
        overall_score,
        blacklist_factor,
        bounce_factor,
        complaint_factor,
        warmup_factor,
    )
    .await
    .map_err(Into::into)
}

// ── Alert Preferences Commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn db_get_alert_preferences(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Option<AlertPreferences>> {
    crate::db::tables::deliverability::alert_preferences::get_by_account(&pool, &account_id)
        .await
        .map_err(Into::into)
}

/// Insert or replace alert preferences for an account.
///
/// Delegates to `alert_preferences::upsert`. Errors are surfaced as
/// `SerializedError`.
#[tauri::command]
pub async fn db_upsert_alert_preferences(
    pool: State<'_, SqlitePool>,
    account_id: String,
    blacklist_enabled: bool,
    channels_json: String,
    threshold: String,
) -> CmdResult<AlertPreferences> {
    crate::db::tables::deliverability::alert_preferences::upsert(
        &pool,
        &account_id,
        blacklist_enabled,
        &channels_json,
        &threshold,
    )
    .await
    .map_err(Into::into)
}

/// A single subscription entry returned by `db_get_subscriptions`.
/// Mirrors the frontend's `SubscriptionEntry` interface.
#[derive(Debug, Serialize)]
pub struct SubscriptionEntry {
    /// Sender email address (the grouping key).
    pub from_address: String,
    /// Sender display name (from the most recent message).
    pub from_name: Option<String>,
    /// Most recent `List-Unsubscribe` header value for the sender.
    pub latest_unsubscribe_header: Option<String>,
    /// Most recent `List-Unsubscribe-Post` header value for the sender.
    pub latest_unsubscribe_post: Option<String>,
    /// Total number of messages from this sender.
    pub message_count: i64,
    /// Unix-epoch date of the most recent message.
    pub latest_date: i64,
    /// Subscription status from `unsubscribe_actions`, if recorded.
    pub status: Option<String>,
}

/// List subscriptions (grouped by sender) for an account, with latest
/// unsubscribe headers and subscription status.
///
/// Returns senders with message count, latest unsubscribe headers, and
/// subscription status from `unsubscribe_actions`. Runs a grouped SQL query
/// over `messages`/`unsubscribe_actions`. Errors are surfaced as `SerializedError`.
#[tauri::command]
pub async fn db_get_subscriptions(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<SubscriptionEntry>> {
    let rows = sqlx::query_as::<_, SubscriptionEntryRow>(
        r#"
        WITH ranked AS (
            SELECT
                from_address,
                from_name,
                list_unsubscribe,
                list_unsubscribe_post,
                ROW_NUMBER() OVER (PARTITION BY from_address ORDER BY date DESC) AS rn
            FROM messages
            WHERE account_id = ? AND from_address IS NOT NULL AND from_address != ''
        ),
        stats AS (
            SELECT
                from_address,
                COUNT(*) AS msg_count,
                MAX(date) AS latest_date
            FROM messages
            WHERE account_id = ? AND from_address IS NOT NULL AND from_address != ''
            GROUP BY from_address
        )
        SELECT
            stats.from_address,
            ranked.from_name,
            ranked.list_unsubscribe AS latest_unsubscribe_header,
            ranked.list_unsubscribe_post AS latest_unsubscribe_post,
            stats.msg_count AS message_count,
            stats.latest_date AS latest_date,
            ua.status
        FROM stats
        LEFT JOIN ranked ON ranked.from_address = stats.from_address AND ranked.rn = 1
        LEFT JOIN unsubscribe_actions ua ON ua.account_id = ? AND ua.from_address = stats.from_address
        ORDER BY stats.latest_date DESC
        "#,
    )
    .bind(&account_id)
    .bind(&account_id)
    .bind(&account_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e| SerializedError::from(format!("Database error: {e}")))?;

    Ok(rows.into_iter().map(|r| SubscriptionEntry {
        from_address: r.from_address,
        from_name: r.from_name,
        latest_unsubscribe_header: r.latest_unsubscribe_header,
        latest_unsubscribe_post: r.latest_unsubscribe_post,
        message_count: r.msg_count,
        latest_date: r.latest_date,
        status: r.status,
    }).collect())
}

/// Internal row struct matching the query columns
#[derive(Debug, sqlx::FromRow)]
struct SubscriptionEntryRow {
    from_address: String,
    from_name: Option<String>,
    latest_unsubscribe_header: Option<String>,
    latest_unsubscribe_post: Option<String>,
    msg_count: i64,
    latest_date: i64,
    status: Option<String>,
}
