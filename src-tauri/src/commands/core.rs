//! Database commands for the core domain.
//!
//! Tauri (`#[tauri::command]`) entry points for the core domain: accounts,
//! folder sync state, labels, messages, attachments, threads, and OAuth
//! tokens. Each command delegates to a `crate::db::tables::core` access
//! function and maps `AppDbError` into `SerializedError` (`CmdResult`) for the
//! frontend. Request payloads are the `pub` deserialized structs declared
//! below (camelCase in JSON). These functions only wrap the DB layer — they do
//! not change SQL or error semantics.

// ── Database Commands – Core Domain ────────────────────────────────────────

use serde::Deserialize;
use tauri::{Manager, State};
use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::core::schema::Account;
use crate::db::mail::schema::{Attachment, FolderSyncState, Label, Message, ScheduledEmail, SyncConflict, SyncJob, Thread};
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

// ── Request types (core‑specific) ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
/// Request payload to create a new account.
///
/// All connection/credential fields are optional so partial configs (OAuth-only
/// vs IMAP/SMTP) can be supplied. Fields mirror the `accounts` table columns.
/// Deserialized from camelCase JSON.
pub struct CreateAccountRequest {
    pub email: String,
    pub display_name: Option<String>,
    pub provider: String,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub imap_host: Option<String>,
    pub imap_port: Option<i64>,
    pub imap_security: Option<String>,
    pub imap_username: Option<String>,
    pub imap_password: Option<String>,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<i64>,
    pub smtp_security: Option<String>,
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>,
    pub oauth_provider: Option<String>,
    pub oauth_client_id: Option<String>,
    pub oauth_client_secret: Option<String>,
    pub auth_method: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
/// Request payload to insert or replace a message row.
///
/// `date` is required; all other fields are optional or have DB defaults.
/// Fields mirror the `messages` table columns. Deserialized from camelCase JSON.
pub struct UpsertMessageRequest {
    pub id: String,
    pub account_id: String,
    pub thread_id: String,
    pub from_address: Option<String>,
    pub from_name: Option<String>,
    pub to_addresses: Option<String>,
    pub cc_addresses: Option<String>,
    pub bcc_addresses: Option<String>,
    pub reply_to: Option<String>,
    pub subject: Option<String>,
    pub snippet: Option<String>,
    pub date: i64,
    pub is_read: Option<bool>,
    pub is_starred: Option<bool>,
    pub body_html: Option<String>,
    pub body_text: Option<String>,
    pub message_id_header: Option<String>,
    pub references_header: Option<String>,
    pub in_reply_to_header: Option<String>,
    pub imap_uid: Option<i64>,
    pub imap_folder: Option<String>,
    pub list_unsubscribe: Option<String>,
    pub list_unsubscribe_post: Option<String>,
    pub auth_results: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
/// Request payload to insert or replace a thread row.
///
/// `message_count` and the boolean flags are required; `subject`/`snippet`/
/// `last_message_at` are optional. Fields mirror the `threads` table columns.
/// Deserialized from camelCase JSON.
pub struct UpsertThreadRequest {
    pub id: String,
    pub account_id: String,
    pub subject: Option<String>,
    pub snippet: Option<String>,
    pub last_message_at: Option<i64>,
    pub message_count: i64,
    pub is_read: bool,
    pub is_starred: bool,
    pub is_important: bool,
    pub has_attachments: bool,
    /// Optional sender address used to auto-categorize the thread into a
    /// bundle/category (Promotions / Social / Updates) on ingest. If omitted,
    /// categorization is skipped and the thread stays in Primary.
    pub from_address: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
/// Request payload to insert or replace a label row.
///
/// `name`, `label_type`, and `id` are required; colors/visibility/sort are
/// optional. Fields mirror the `labels` table columns. Deserialized from
/// camelCase JSON.
pub struct UpsertLabelRequest {
    pub account_id: String,
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub label_type: String,
    pub color_bg: Option<String>,
    pub color_fg: Option<String>,
    pub visible: Option<bool>,
    pub sort_order: Option<i64>,
    pub imap_folder_path: Option<String>,
    pub imap_special_use: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertFolderSyncStateRequest {
    pub account_id: String,
    pub folder_path: String,
    pub uidvalidity: Option<i64>,
    pub last_uid: i64,
    pub modseq: Option<i64>,
    pub last_sync_at: Option<i64>,
    pub sync_phase: Option<String>,
    pub last_error: Option<String>,
    pub retry_count: Option<i64>,
    pub is_paused: Option<i64>,
}

/// Request to create a sync job (one row per migration / backfill run).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSyncJobRequest {
    pub id: String,
    pub account_id: String,
    pub phase: Option<String>,
    pub status: Option<String>,
    pub total_folders: Option<i64>,
    pub estimated_messages: Option<i64>,
}

/// Request to record a source-vs-local sync conflict (audit log entry).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordSyncConflictRequest {
    pub id: String,
    pub account_id: String,
    pub folder_path: String,
    pub conflict_type: String,
    pub message_id_header: Option<String>,
    pub source_value: Option<String>,
    pub local_value: Option<String>,
}

// (LabelSortOrderUpdate, ThreadFilters, ThreadBatchUpdate, UpdateFields remain in db.rs for now)

// ── Register function ──────────────────────────────────────────────────────

// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
//     builder
// }   

// ── Commands ───────────────────────────────────────────────────────────────

#[tauri::command]
/// Fetch a single account by id, optionally served from the accounts cache.
pub async fn db_get_account(
    app: tauri::AppHandle,
    pool: State<'_, SqlitePool>,
    account_id: String,
    use_cache: Option<bool>,
) -> CmdResult<Account> {
    if use_cache.unwrap_or(false) {
        if let Some(cache_service) = app.try_state::<std::sync::Arc<crate::data_cache::DataCacheService>>() {
            if let Some(account) = cache_service.get_accounts_cache().get(&account_id).await {
                return Ok(account);
            }
        }
    }
    crate::db::tables::core::accounts::get_by_id(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// List all accounts ordered by email.
pub async fn db_list_accounts(pool: State<'_, SqlitePool>) -> CmdResult<Vec<Account>> {
    crate::db::tables::core::accounts::get_all(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_account(
    pool: State<'_, SqlitePool>,
    account: CreateAccountRequest,
) -> CmdResult<Account> {
    crate::db::tables::core::accounts::create(&pool, account)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_account(
    pool: State<'_, SqlitePool>,
    id: String,
    fields: crate::db::commands::UpdateFields,   // shared type from db.rs
) -> CmdResult<()> {
    crate::db::tables::core::accounts::update_fields(&pool, &id, &fields)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_account(pool: State<'_, SqlitePool>, id: String) -> CmdResult<()> {
    crate::db::tables::core::accounts::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Look up an account by email (returns `Option`).
pub async fn db_get_account_by_email(
    pool: State<'_, SqlitePool>,
    email: String,
) -> CmdResult<Option<Account>> {
    crate::db::tables::core::accounts::get_by_email(&pool, &email)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Record the latest history id / last-sync timestamp for an account.
pub async fn db_update_account_last_sync(
    pool: State<'_, SqlitePool>,
    id: String,
    history_id: String,
) -> CmdResult<()> {
    crate::db::tables::core::accounts::update_last_sync(&pool, &id, &history_id)
        .await
        .map_err(Into::into)
}

// ── Messages ──

#[tauri::command]
/// Get all messages belonging to a thread.
pub async fn db_get_messages_for_thread(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
) -> CmdResult<Vec<Message>> {
    crate::db::tables::core::messages::get_by_thread(&pool, &account_id, &thread_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_message(
    pool: State<'_, SqlitePool>,
    msg: UpsertMessageRequest,
) -> CmdResult<()> {
    crate::db::tables::core::messages::upsert(&pool, msg)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_message(
    pool: State<'_, SqlitePool>,
    account_id: String,
    message_id: String,
) -> CmdResult<()> {
    crate::db::tables::core::messages::delete_by_id(&pool, &account_id, &message_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Full-text search messages for an account.
pub async fn db_search_messages(
    pool: State<'_, SqlitePool>,
    account_id: String,
    query: String,
    limit: i64,
) -> CmdResult<Vec<Message>> {
    crate::db::tables::core::messages_fts::search(&pool, &account_id, &query, limit)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Toggle the read/starred flags on a message.
pub async fn db_update_message_flags(
    pool: State<'_, SqlitePool>,
    message_id: String,
    is_read: Option<bool>,
    is_starred: Option<bool>,
) -> CmdResult<()> {
    crate::db::tables::core::messages::update_flags(&pool, &message_id, is_read, is_starred)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Re-parent a batch of messages onto a thread.
pub async fn db_bulk_update_message_thread(
    pool: State<'_, SqlitePool>,
    account_id: String,
    message_ids: Vec<String>,
    thread_id: String,
) -> CmdResult<()> {
    crate::db::tables::core::messages::bulk_update_thread(&pool, &account_id, &message_ids, &thread_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_account_messages(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<u64> {
    crate::db::tables::core::messages::delete_all_for_account(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Get recent sent messages from a sender.
pub async fn db_get_recent_sent_messages(
    pool: State<'_, SqlitePool>,
    account_id: String,
    from_address: String,
    limit: i64,
) -> CmdResult<Vec<Message>> {
    crate::db::tables::core::messages::get_recent_sent(&pool, &account_id, &from_address, limit)
        .await
        .map_err(Into::into)
}

// ── Threads ──

#[tauri::command]
pub async fn db_get_threads(
    pool: State<'_, SqlitePool>,
    account_id: String,
    limit: i64,
    offset: i64,
    filters: Option<crate::db::commands::ThreadFilters>,  // shared type
) -> CmdResult<Vec<Thread>> {
    crate::db::tables::core::threads::list(&pool, &account_id, limit, offset, filters)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_thread(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
) -> CmdResult<Thread> {
    crate::db::tables::core::threads::get_by_id(&pool, &account_id, &thread_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_thread_metadata(
    pool: State<'_, SqlitePool>,
    thread_id: String,
    metadata: serde_json::Value,
) -> CmdResult<()> {
    crate::db::tables::core::threads::update_metadata(&pool, &thread_id, &metadata)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_batch_update_threads(
    pool: State<'_, SqlitePool>,
    ids: Vec<String>,
    changes: crate::db::commands::ThreadBatchUpdate,  // shared
) -> CmdResult<()> {
    crate::db::tables::core::threads::batch_update(&pool, &ids, &changes)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Insert or replace a thread row.
pub async fn db_upsert_thread(
    pool: State<'_, SqlitePool>,
    thread: UpsertThreadRequest,
) -> CmdResult<()> {
    crate::db::tables::core::threads::upsert_thread(&pool, thread)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Set a thread's importance flag + optional numeric score (Focused inbox).
pub async fn db_set_thread_importance(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
    is_important: bool,
    importance_score: Option<i64>,
) -> CmdResult<()> {
    crate::db::tables::core::threads::set_importance(
        &pool,
        &account_id,
        &thread_id,
        is_important,
        importance_score,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
/// Re-derive and persist a thread's category (Promotions / Social / Updates)
/// from a sender address. Returns the derived category.
pub async fn db_categorize_thread(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
    from_address: String,
) -> CmdResult<String> {
    crate::db::tables::core::threads::categorize_thread(
        &pool,
        &account_id,
        &thread_id,
        &from_address,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
/// Delete a single thread by (account_id, id).
pub async fn db_delete_thread(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
) -> CmdResult<()> {
    crate::db::tables::core::threads::delete_by_composite_id(&pool, &account_id, &thread_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Delete all threads for an account (returns deleted count).
pub async fn db_delete_account_threads(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<u64> {
    crate::db::tables::core::threads::delete_all_for_account(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_all_threads(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<Thread>> {
    crate::db::tables::core::threads::get_all(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Get the most-recent sender of a thread.
pub async fn db_get_thread_last_sender(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
) -> CmdResult<Option<crate::db::tables::core::threads::ThreadSender>> {
    crate::db::tables::core::threads::get_last_sender_for_thread(&pool, &account_id, &thread_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Count threads for an account.
pub async fn db_get_thread_count(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<i64> {
    crate::db::tables::core::threads::get_count_for_account(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Unread thread count for a specific label.
pub async fn db_get_label_unread_count(
    pool: State<'_, SqlitePool>,
    account_id: String,
    label_id: String,
) -> CmdResult<i64> {
    crate::db::tables::core::threads::get_label_unread_count(&pool, &account_id, &label_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Unread thread counts grouped by label.
pub async fn db_get_all_label_unread_counts(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<crate::db::tables::core::threads::LabelUnreadCount>> {
    crate::db::tables::core::threads::get_all_label_unread_counts(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_unread_inbox_count(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    crate::db::tables::core::threads::get_unread_inbox_count(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// IDs of all muted threads for an account.
pub async fn db_get_muted_thread_ids(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<String>> {
    crate::db::tables::core::threads::get_muted_ids(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Enrich threads with their last sender info.
pub async fn db_enrich_threads_with_sender(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_ids: Vec<String>,
) -> CmdResult<Vec<crate::db::tables::core::threads::ThreadSenderEnrichment>> {
    crate::db::tables::core::threads::enrich_threads_with_sender(&pool, &account_id, &thread_ids)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_threads_for_category(
    pool: State<'_, SqlitePool>,
    account_id: String,
    category: String,
    limit: i64,
    offset: i64,
) -> CmdResult<Vec<crate::db::tables::core::threads::ThreadSenderEnrichment>> {
    crate::db::tables::core::threads::get_threads_for_category(&pool, &account_id, &category, limit, offset)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_set_thread_labels(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
    label_ids: Vec<String>,
) -> CmdResult<()> {
    crate::db::tables::core::threads::set_thread_labels(&pool, &account_id, &thread_id, &label_ids)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_thread_label_ids(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
) -> CmdResult<Vec<String>> {
    crate::db::tables::core::threads::get_thread_label_ids(&pool, &account_id, &thread_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_thread_flags(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
    is_read: Option<bool>,
    is_starred: Option<bool>,
    is_important: Option<bool>,
    is_snoozed: Option<bool>,
) -> CmdResult<()> {
    crate::db::tables::core::threads::update_flags(&pool, &account_id, &thread_id, is_read, is_starred, is_important, is_snoozed)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Get snoozed threads whose snooze window has elapsed.
pub async fn db_get_expired_snoozed_threads(
    pool: State<'_, SqlitePool>,
    now: i64,
) -> CmdResult<Vec<crate::db::tables::core::threads::ExpiredSnoozedRow>> {
    crate::db::tables::core::threads::get_expired_snoozed(&pool, now)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_snooze_thread(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
    until: i64,
) -> CmdResult<()> {
    crate::db::tables::core::threads::snooze(&pool, &account_id, &thread_id, until)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Unsnooze a thread.
pub async fn db_unsnooze_thread(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
) -> CmdResult<()> {
    crate::db::tables::core::threads::unsnooze(&pool, &account_id, &thread_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_add_thread_label(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
    label_id: String,
) -> CmdResult<()> {
    crate::db::tables::core::thread_labels::add_label(&pool, &account_id, &thread_id, &label_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Remove a label from a thread.
pub async fn db_remove_thread_label(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
    label_id: String,
) -> CmdResult<()> {
    crate::db::tables::core::thread_labels::remove_label(&pool, &account_id, &thread_id, &label_id)
        .await
        .map_err(Into::into)
}

// ── Labels ──

#[tauri::command]
pub async fn db_get_labels_for_account(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<Label>> {
    crate::db::tables::core::labels::get_by_account(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_label(
    pool: State<'_, SqlitePool>,
    label: UpsertLabelRequest,
) -> CmdResult<()> {
    crate::db::tables::core::labels::upsert(&pool, label)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Delete a label by (account_id, id).
pub async fn db_delete_label(
    pool: State<'_, SqlitePool>,
    account_id: String,
    label_id: String,
) -> CmdResult<()> {
    crate::db::tables::core::labels::delete_by_id(&pool, &account_id, &label_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_labels_for_account(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<()> {
    crate::db::tables::core::labels::delete_all_for_account(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Update the sort order of multiple labels.
pub async fn db_update_label_sort_order(
    pool: State<'_, SqlitePool>,
    _account_id: String,
    label_orders: Vec<crate::db::commands::LabelSortOrderUpdate>,  // shared
) -> CmdResult<()> {
    for item in label_orders {
        crate::db::tables::core::labels::update_sort_order(&pool, &item.id, item.sort_order)
            .await
            .map_err(SerializedError::from)?;
    }
    Ok(())
}

// ── Attachments ──

#[tauri::command]
pub async fn db_get_attachments_for_message(
    pool: State<'_, SqlitePool>,
    message_id: String,
) -> CmdResult<Vec<Attachment>> {
    crate::db::tables::core::attachments::get_by_message(&pool, &message_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_save_attachment_locally(
    app: tauri::AppHandle,
    pool: State<'_, SqlitePool>,
    message_id: String,
    attachment_id: String,
) -> CmdResult<String> {
    let _att = crate::db::tables::core::attachments::get_by_id(&pool, &attachment_id)
        .await?;

    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| AppDbError::Crypto(format!("Cannot get app data dir: {e}")))?;
    let att_dir = app_data_dir.join("attachments").join(&message_id);
    std::fs::create_dir_all(&att_dir)
        .map_err(|e| AppDbError::Crypto(format!("Cannot create attachment dir: {e}")))?;
    let file_path = att_dir.join(&attachment_id);
    let path_str = file_path.to_string_lossy().to_string();

    if !file_path.exists() {
        std::fs::write(&file_path, "")
            .map_err(|e| AppDbError::Crypto(format!("Cannot write attachment: {e}")))?;
    }

    crate::db::tables::core::attachments::update_local_path(&pool, &attachment_id, &path_str)
        .await?;

    Ok(path_str)
}

#[tauri::command]
/// Insert or replace an attachment row.
pub async fn db_upsert_attachment(
    pool: State<'_, SqlitePool>,
    attachment: Attachment,
) -> CmdResult<()> {
    crate::db::tables::core::attachments::upsert_attachment(&pool, &attachment)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_attachments_for_account(
    pool: State<'_, SqlitePool>,
    account_id: String,
    limit: i64,
    offset: i64,
) -> CmdResult<Vec<crate::db::tables::core::attachments::AttachmentWithContext>> {
    crate::db::tables::core::attachments::get_by_account(&pool, &account_id, limit, offset)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_attachment_senders(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<crate::db::tables::core::attachments::AttachmentSender>> {
    crate::db::tables::core::attachments::get_senders(&pool, &account_id)
        .await
        .map_err(Into::into)
}

// ── Folder Sync State ──

#[tauri::command]
pub async fn db_get_folder_sync_state(
    pool: State<'_, SqlitePool>,
    account_id: String,
    folder_path: String,
) -> CmdResult<Option<FolderSyncState>> {
    crate::db::tables::core::folder_sync_state::get(&pool, &account_id, &folder_path)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Insert or replace a folder sync-state row.
pub async fn db_upsert_folder_sync_state(
    pool: State<'_, SqlitePool>,
    state: UpsertFolderSyncStateRequest,
) -> CmdResult<()> {
    crate::db::tables::core::folder_sync_state::upsert(&pool, &state)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_folder_sync_state(
    pool: State<'_, SqlitePool>,
    account_id: String,
    folder_path: String,
) -> CmdResult<()> {
    crate::db::tables::core::folder_sync_state::delete(&pool, &account_id, &folder_path)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_clear_folder_sync_states(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<()> {
    crate::db::tables::core::folder_sync_state::delete_all_for_account(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// List folder sync states for an account.
pub async fn db_list_folder_sync_states(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<FolderSyncState>> {
    crate::db::tables::core::folder_sync_state::list_by_account(&pool, &account_id)
        .await
        .map_err(Into::into)
}

// ── Sync Jobs (migration / backfill runs, report.md §6.2) ──

#[tauri::command]
/// Create one row per migration run so progress can resume across restarts.
pub async fn db_create_sync_job(
    pool: State<'_, SqlitePool>,
    req: CreateSyncJobRequest,
) -> CmdResult<()> {
    crate::db::tables::core::sync_jobs::create(&pool, &req)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_sync_job(
    pool: State<'_, SqlitePool>,
    job_id: String,
) -> CmdResult<Option<SyncJob>> {
    crate::db::tables::core::sync_jobs::get(&pool, &job_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
/// Update per-folder / per-message counters for a running job (drives the UI bar).
pub async fn db_update_sync_job_progress(
    pool: State<'_, SqlitePool>,
    job_id: String,
    done_folders: i64,
    synced_messages: i64,
) -> CmdResult<()> {
    crate::db::tables::core::sync_jobs::update_progress(&pool, &job_id, done_folders, synced_messages)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_mark_sync_job_done(
    pool: State<'_, SqlitePool>,
    job_id: String,
) -> CmdResult<()> {
    crate::db::tables::core::sync_jobs::mark_done(&pool, &job_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_sync_jobs(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<SyncJob>> {
    crate::db::tables::core::sync_jobs::list_by_account(&pool, &account_id)
        .await
        .map_err(Into::into)
}

// ── Sync Conflicts (audit log, report.md §6.3) ──

#[tauri::command]
/// Record a source-vs-local divergence encountered during import.
pub async fn db_record_sync_conflict(
    pool: State<'_, SqlitePool>,
    req: RecordSyncConflictRequest,
) -> CmdResult<()> {
    crate::db::tables::core::sync_conflicts::record(&pool, &req)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_sync_conflicts(
    pool: State<'_, SqlitePool>,
    account_id: String,
    only_unresolved: Option<bool>,
) -> CmdResult<Vec<SyncConflict>> {
    crate::db::tables::core::sync_conflicts::list_by_account(&pool, &account_id, only_unresolved.unwrap_or(false))
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_resolve_sync_conflict(
    pool: State<'_, SqlitePool>,
    id: String,
    resolution: String,
) -> CmdResult<()> {
    crate::db::tables::core::sync_conflicts::resolve(&pool, &id, &resolution)
        .await
        .map_err(Into::into)
}

// ── Scheduled Emails — Get Pending (all accounts) ──

#[tauri::command]
/// Get all pending scheduled emails across accounts.
pub async fn db_get_pending_scheduled_emails(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<ScheduledEmail>> {
    crate::db::tables::comms::scheduled_emails::list_pending_all(&pool)
        .await
        .map_err(Into::into)
}

// ── Tests ────────────────────────────────────────────────────────────────
//
// These tests verify the IPC contract between frontend and Rust:
// - Request type deserialization (camelCase mapping, optional field handling)
// - Function signatures compile correctly (type-level checks)
//
// We cannot test functions requiring `State<SqlitePool>` without a running
// Tauri app, so we focus on the pure-logic layer.

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ── CreateAccountRequest deserialization ─────────────────────────────

    #[test]
    fn test_create_account_request_deserialize_camel_case() {
        let req: CreateAccountRequest = serde_json::from_value(json!({
            "email": "user@example.com",
            "displayName": "Test User",
            "provider": "google",
            "accessToken": "tok_abc",
            "refreshToken": "ref_xyz",
            "imapHost": "imap.example.com",
            "imapPort": 993,
            "imapSecurity": "tls",
            "imapUsername": "user@example.com",
            "imapPassword": "secret",
            "smtpHost": "smtp.example.com",
            "smtpPort": 465,
            "smtpSecurity": "tls",
            "smtpUsername": "user@example.com",
            "smtpPassword": "secret",
            "oauthProvider": "google",
            "oauthClientId": "client_id",
            "oauthClientSecret": "client_secret",
            "authMethod": "oauth2"
        }))
        .expect("should deserialize CreateAccountRequest from camelCase JSON");

        assert_eq!(req.email, "user@example.com");
        assert_eq!(req.display_name.as_deref(), Some("Test User"));
        assert_eq!(req.provider, "google");
        assert_eq!(req.access_token.as_deref(), Some("tok_abc"));
        assert_eq!(req.refresh_token.as_deref(), Some("ref_xyz"));
        assert_eq!(req.imap_host.as_deref(), Some("imap.example.com"));
        assert_eq!(req.imap_port, Some(993));
        assert_eq!(req.imap_security.as_deref(), Some("tls"));
        assert_eq!(req.smtp_host.as_deref(), Some("smtp.example.com"));
        assert_eq!(req.smtp_port, Some(465));
        assert_eq!(req.auth_method.as_deref(), Some("oauth2"));
        assert_eq!(req.oauth_provider.as_deref(), Some("google"));
    }

    #[test]
    fn test_create_account_request_minimal_fields() {
        let req: CreateAccountRequest = serde_json::from_value(json!({
            "email": "minimal@example.com",
            "provider": "custom",
            "displayName": null
        }))
        .expect("should deserialize with only required + null optional fields");

        assert_eq!(req.email, "minimal@example.com");
        assert_eq!(req.provider, "custom");
        assert!(req.display_name.is_none());
        assert!(req.access_token.is_none());
        assert!(req.refresh_token.is_none());
        assert!(req.imap_host.is_none());
        assert!(req.imap_port.is_none());
    }

    #[test]
    fn test_create_account_request_missing_optional_fields() {
        // When optional fields are simply absent from JSON, they should default to None
        let req: CreateAccountRequest = serde_json::from_value(json!({
            "email": "a@b.com",
            "provider": "imap"
        }))
        .expect("should deserialize with absent optional fields");

        assert!(req.display_name.is_none());
        assert!(req.access_token.is_none());
        assert!(req.imap_port.is_none());
        assert!(req.smtp_port.is_none());
    }

    // ── UpsertMessageRequest deserialization ─────────────────────────────

    #[test]
    fn test_upsert_message_request_deserialize_camel_case() {
        let req: UpsertMessageRequest = serde_json::from_value(json!({
            "id": "msg_001",
            "accountId": "acc_001",
            "threadId": "thr_001",
            "fromAddress": "sender@example.com",
            "fromName": "Sender",
            "toAddresses": "recipient@example.com",
            "ccAddresses": "cc@example.com",
            "bccAddresses": null,
            "replyTo": null,
            "subject": "Hello World",
            "snippet": "Hello...",
            "date": 1700000000,
            "isRead": true,
            "isStarred": false,
            "bodyHtml": "<p>Hello</p>",
            "bodyText": "Hello",
            "messageIdHeader": "<msg001@example.com>",
            "referencesHeader": "<ref001@example.com>",
            "inReplyToHeader": null,
            "imapUid": 42,
            "imapFolder": "INBOX",
            "listUnsubscribe": "<mailto:unsub@example.com>",
            "listUnsubscribePost": "List-Unsubscribe=One-Click",
            "authResults": "spf=pass"
        }))
        .expect("should deserialize UpsertMessageRequest from camelCase JSON");

        assert_eq!(req.id, "msg_001");
        assert_eq!(req.account_id, "acc_001");
        assert_eq!(req.thread_id, "thr_001");
        assert_eq!(req.from_address.as_deref(), Some("sender@example.com"));
        assert_eq!(req.subject.as_deref(), Some("Hello World"));
        assert_eq!(req.date, 1700000000);
        assert_eq!(req.is_read, Some(true));
        assert_eq!(req.is_starred, Some(false));
        assert_eq!(req.imap_uid, Some(42));
        assert_eq!(req.imap_folder.as_deref(), Some("INBOX"));
    }

    #[test]
    fn test_upsert_message_request_minimal_required_fields() {
        let req: UpsertMessageRequest = serde_json::from_value(json!({
            "id": "msg_min",
            "accountId": "acc_min",
            "threadId": "thr_min",
            "date": 0
        }))
        .expect("should deserialize with only required fields");

        assert_eq!(req.id, "msg_min");
        assert_eq!(req.account_id, "acc_min");
        assert_eq!(req.thread_id, "thr_min");
        assert_eq!(req.date, 0);
        assert!(req.from_address.is_none());
        assert!(req.subject.is_none());
        assert!(req.body_html.is_none());
        assert!(req.is_read.is_none());
        assert!(req.imap_uid.is_none());
    }

    // ── UpsertThreadRequest deserialization ──────────────────────────────

    #[test]
    fn test_upsert_thread_request_deserialize_camel_case() {
        let req: UpsertThreadRequest = serde_json::from_value(json!({
            "id": "thr_001",
            "accountId": "acc_001",
            "subject": "Re: Meeting",
            "snippet": "Let's meet at...",
            "lastMessageAt": 1700000000,
            "messageCount": 5,
            "isRead": false,
            "isStarred": true,
            "isImportant": false,
            "hasAttachments": true
        }))
        .expect("should deserialize UpsertThreadRequest");

        assert_eq!(req.id, "thr_001");
        assert_eq!(req.account_id, "acc_001");
        assert_eq!(req.message_count, 5);
        assert!(!req.is_read);
        assert!(req.is_starred);
        assert!(!req.is_important);
        assert!(req.has_attachments);
    }

    // ── UpsertLabelRequest deserialization ───────────────────────────────

    #[test]
    fn test_upsert_label_request_type_field_rename() {
        // The #[serde(rename = "type")] attribute maps JSON "type" -> Rust label_type
        let req: UpsertLabelRequest = serde_json::from_value(json!({
            "accountId": "acc_001",
            "id": "lbl_001",
            "name": "Important",
            "type": "user",
            "colorBg": "#ff0000",
            "colorFg": "#ffffff",
            "visible": true,
            "sortOrder": 10,
            "imapFolderPath": "INBOX/Important",
            "imapSpecialUse": "\\Important"
        }))
        .expect("should deserialize UpsertLabelRequest with type rename");

        assert_eq!(req.account_id, "acc_001");
        assert_eq!(req.id, "lbl_001");
        assert_eq!(req.name, "Important");
        assert_eq!(req.label_type, "user");
        assert_eq!(req.color_bg.as_deref(), Some("#ff0000"));
        assert_eq!(req.color_fg.as_deref(), Some("#ffffff"));
        assert_eq!(req.visible, Some(true));
        assert_eq!(req.sort_order, Some(10));
        assert_eq!(req.imap_folder_path.as_deref(), Some("INBOX/Important"));
        assert_eq!(req.imap_special_use.as_deref(), Some("\\Important"));
    }

    #[test]
    fn test_upsert_label_request_minimal_fields() {
        let req: UpsertLabelRequest = serde_json::from_value(json!({
            "accountId": "acc_min",
            "id": "lbl_min",
            "name": "Label",
            "type": "system"
        }))
        .expect("should deserialize with minimal fields");

        assert_eq!(req.label_type, "system");
        assert!(req.color_bg.is_none());
        assert!(req.visible.is_none());
        assert!(req.sort_order.is_none());
    }

    // ── UpsertFolderSyncStateRequest deserialization ─────────────────────

    #[test]
    fn test_upsert_folder_sync_state_request_deserialize() {
        let req: UpsertFolderSyncStateRequest = serde_json::from_value(json!({
            "accountId": "acc_001",
            "folderPath": "INBOX",
            "uidvalidity": 12345,
            "lastUid": 999,
            "modseq": 67890,
            "lastSyncAt": 1700000000
        }))
        .expect("should deserialize UpsertFolderSyncStateRequest");

        assert_eq!(req.account_id, "acc_001");
        assert_eq!(req.folder_path, "INBOX");
        assert_eq!(req.uidvalidity, Some(12345));
        assert_eq!(req.last_uid, 999);
        assert_eq!(req.modseq, Some(67890));
        assert_eq!(req.last_sync_at, Some(1700000000));
    }

    #[test]
    fn test_upsert_folder_sync_state_request_minimal_fields() {
        let req: UpsertFolderSyncStateRequest = serde_json::from_value(json!({
            "accountId": "acc_min",
            "folderPath": "Sent",
            "lastUid": 0
        }))
        .expect("should deserialize with only required fields");

        assert_eq!(req.uidvalidity, None);
        assert_eq!(req.modseq, None);
        assert_eq!(req.last_sync_at, None);
        assert_eq!(req.last_uid, 0);
    }

    // ── Function signature compile-time checks ───────────────────────────
    //
    // These verify that function signatures match what the IPC layer expects.
    // They compile but never run (type-level assertions).

    #[test]
    fn test_cmd_result_type_is_result() {
        // CmdResult<T> must be Result<T, SerializedError>
        let ok: CmdResult<i32> = Ok(42);
        assert!(ok.is_ok());
        assert_eq!(ok.unwrap(), 42);

        let err: CmdResult<i32> = Err(SerializedError::new("TEST", "msg"));
        assert!(err.is_err());
    }

    #[test]
    fn test_request_types_implement_debug() {
        // All request types must be Debug (required by Tauri derive)
        let account = CreateAccountRequest {
            email: "a@b.com".into(),
            display_name: None,
            provider: "test".into(),
            access_token: None,
            refresh_token: None,
            imap_host: None,
            imap_port: None,
            imap_security: None,
            imap_username: None,
            imap_password: None,
            smtp_host: None,
            smtp_port: None,
            smtp_security: None,
            smtp_username: None,
            smtp_password: None,
            oauth_provider: None,
            oauth_client_id: None,
            oauth_client_secret: None,
            auth_method: None,
        };
        // If this compiles, CreateAccountRequest implements Debug
        let _ = format!("{:?}", account);

        let thread = UpsertThreadRequest {
            id: "t".into(),
            account_id: "a".into(),
            subject: None,
            snippet: None,
            last_message_at: None,
            message_count: 0,
            is_read: false,
            is_starred: false,
            is_important: false,
            has_attachments: false,
        };
        let _ = format!("{:?}", thread);
    }

    #[test]
    fn test_label_sort_order_update_deserialize() {
        use crate::db::commands::LabelSortOrderUpdate;
        let update: LabelSortOrderUpdate = serde_json::from_value(json!({
            "id": "lbl_001",
            "sortOrder": 42
        }))
        .expect("should deserialize LabelSortOrderUpdate");
        assert_eq!(update.id, "lbl_001");
        assert_eq!(update.sort_order, 42);
    }

    #[test]
    fn test_thread_filters_deserialize() {
        use crate::db::commands::ThreadFilters;
        let filters: ThreadFilters = serde_json::from_value(json!({
            "labelId": "lbl_001",
            "isRead": false,
            "isStarred": true,
            "isImportant": null,
            "isSnoozed": false,
            "isPinned": null,
            "searchQuery": "meeting",
            "folder": "INBOX"
        }))
        .expect("should deserialize ThreadFilters");
        assert_eq!(filters.label_id.as_deref(), Some("lbl_001"));
        assert_eq!(filters.is_read, Some(false));
        assert_eq!(filters.is_starred, Some(true));
        assert!(filters.is_important.is_none());
        assert_eq!(filters.search_query.as_deref(), Some("meeting"));
        assert_eq!(filters.folder.as_deref(), Some("INBOX"));
    }

    #[test]
    fn test_thread_batch_update_deserialize() {
        use crate::db::commands::ThreadBatchUpdate;
        let update: ThreadBatchUpdate = serde_json::from_value(json!({
            "isRead": true,
            "isStarred": null,
            "isImportant": null,
            "isSnoozed": null,
            "isPinned": null,
            "isMuted": false,
            "addLabelIds": ["lbl_1", "lbl_2"],
            "removeLabelIds": []
        }))
        .expect("should deserialize ThreadBatchUpdate");
        assert_eq!(update.is_read, Some(true));
        assert_eq!(update.is_muted, Some(false));
        assert_eq!(update.add_label_ids.as_ref().unwrap().len(), 2);
        assert!(update.remove_label_ids.as_ref().unwrap().is_empty());
    }
}

// ── Attachments — Extended ──

#[tauri::command]
pub async fn db_create_attachment(
    pool: State<'_, SqlitePool>,
    attachment: Attachment,
) -> CmdResult<()> {
    crate::db::tables::core::attachments::create(&pool, &attachment)
        .await
        .map_err(Into::into)
}

// ── Labels — Extended ──

#[tauri::command]
pub async fn db_get_label(
    app: tauri::AppHandle,
    pool: State<'_, SqlitePool>,
    account_id: String,
    id: String,
    use_cache: Option<bool>,
) -> CmdResult<Label> {
    if use_cache.unwrap_or(false) {
        if let Some(cache_service) = app.try_state::<std::sync::Arc<crate::data_cache::DataCacheService>>() {
            if let Some(label) = cache_service.get_labels_cache().get(&account_id, &id).await {
                return Ok(label);
            }
        }
    }
    crate::db::tables::core::labels::get_by_id(&pool, &account_id, &id)
        .await
        .map_err(Into::into)
}

// ── Messages — Extended ──

#[tauri::command]
pub async fn db_get_message(
    pool: State<'_, SqlitePool>,
    account_id: String,
    id: String,
) -> CmdResult<Message> {
    crate::db::tables::core::messages::get_by_id(&pool, &account_id, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_message_by_folder_and_uid(
    pool: State<'_, SqlitePool>,
    account_id: String,
    folder: String,
    uid: i64,
) -> CmdResult<Option<Message>> {
    crate::db::tables::core::messages::get_by_folder_and_uid(&pool, &account_id, &folder, uid)
        .await
        .map_err(Into::into)
}

