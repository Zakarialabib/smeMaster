//! Tauri command handlers for the communications (comms) domain.
//!
//! Each `#[tauri::command]` function here is a thin async wrapper around the
//! per-table helpers in `crate::db::tables::comms::*`, mapping the database
//! `AppDbError` into `SerializedError` for the frontend. Commands that look up
//! a single row translate a missing row into `AppDbError::NotFound`; the
//! dynamic `db_update_filter` builds its `UPDATE` with `sqlx::AssertSqlSafe`
//! (see its doc). Request/response DTOs are declared at module scope.

// ── Communication Commands ─────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use tauri::State;
use sqlx::{SqlitePool, QueryBuilder};
use crate::db::commands::{LabelSortOrderUpdate, UpdateFields};
use crate::db::error::AppDbError;
use crate::db::mail::schema::{
    ComposerPreset, FilterLog, FilterRule, LocalDraft, QuickReply, QuickStep,
    ScheduledEmail, SendAsAlias, Signature, SmartFolder, Template,
};
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

// ── Request types ──────────────────────────────────────────────────────────

/// Request DTO: a single thread-to-category mapping to persist.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadCategoryEntry {
    /// Account that owns the thread.
    pub account_id: String,
    /// Thread whose category is being set.
    pub thread_id: String,
    /// Category label to assign.
    pub category: String,
}

/// Row DTO: a thread category as stored (returned to the frontend).
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ThreadCategoryRow {
    /// Account that owns the thread.
    pub account_id: String,
    /// Thread the category applies to.
    pub thread_id: String,
    /// Assigned category label.
    pub category: String,
    /// Flag (1/0): category was set manually.
    pub is_manual: i64,
    /// Flag (1/0): category was set by a user override.
    pub is_user_override: i64,
}

/// Request DTO: upsert a thread category, with optional manual/override flags.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertThreadCategoryRequest {
    /// Account that owns the thread.
    pub account_id: String,
    /// Thread whose category is being set.
    pub thread_id: String,
    /// Category label to assign.
    pub category: String,
    /// Optional flag marking the assignment as manual.
    pub is_manual: Option<bool>,
    /// Optional flag marking the assignment as a user override.
    pub is_user_override: Option<bool>,
}

/// Row DTO: the `group_operator` of a filter rule (legacy compatibility shape).
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FilterGroupOperatorResult {
    /// Filter group operator, or `None` when the rule has none set.
    pub group_operator: Option<String>,
}

/// Request DTO for creating a scheduled email.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateScheduledEmailRequest {
    /// Owning account.
    pub account_id: String,
    /// Recipient "To" addresses.
    pub to_addresses: String,
    /// Optional "Cc" addresses.
    pub cc_addresses: Option<String>,
    /// Optional "Bcc" addresses.
    pub bcc_addresses: Option<String>,
    /// Optional subject.
    pub subject: Option<String>,
    /// HTML body.
    pub body_html: String,
    /// Optional message id this is a reply to.
    pub reply_to_message_id: Option<String>,
    /// Optional thread id.
    pub thread_id: Option<String>,
    /// Unix epoch seconds at which to send.
    pub scheduled_at: i64,
    /// Optional signature id to attach.
    pub signature_id: Option<String>,
    /// Optional JSON-encoded attachment paths.
    pub attachment_paths: Option<String>,
    /// Initial status (e.g. `"pending"`).
    pub status: String,
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMS DOMAIN
// ═══════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn db_list_filter_rules(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<FilterRule>> {
    crate::db::tables::comms::filter_rules::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_filter_rule(
    pool: State<'_, SqlitePool>,
    rule: serde_json::Value,
) -> CmdResult<FilterRule> {
    let parsed: FilterRule = serde_json::from_value(rule).map_err(SerializedError::from)?;
    crate::db::tables::comms::filter_rules::create(&pool, &parsed)
        .await
        .map_err(Into::into)
}

/// List templates visible to a company, including global ones.
///
/// * `company_id` — when `None`/`""` only global (NULL-company) templates are returned.
/// * Returns the matching `Template` rows.
#[tauri::command]
pub async fn db_list_templates(
    pool: State<'_, SqlitePool>,
    company_id: Option<String>,
) -> CmdResult<Vec<Template>> {
    crate::db::tables::comms::templates::list(&pool, company_id.as_deref().unwrap_or(""))
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_templates_paginated(
    pool: State<'_, SqlitePool>,
    company_id: String,
    limit: i64,
    offset: i64,
    template_type: Option<String>,
    origin: Option<String>,
) -> CmdResult<Vec<Template>> {
    crate::db::tables::comms::templates::list_paginated(
        &pool, &company_id, limit, offset,
        template_type.as_deref(), origin.as_deref(),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_template(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Option<Template>> {
    crate::db::tables::comms::templates::get_by_id_opt(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_count_templates(
    pool: State<'_, SqlitePool>,
    template_type: Option<String>,
    origin: Option<String>,
) -> CmdResult<Vec<crate::db::tables::comms::templates::CountRow>> {
    let cnt = crate::db::tables::comms::templates::count(&pool, template_type.as_deref(), origin.as_deref()).await?;
    Ok(vec![crate::db::tables::comms::templates::CountRow { count: cnt }])
}

/// Insert or update a template identified by `id`.
///
/// * `id` — template primary key; an existing row is updated, otherwise a new
///   one is created from the remaining fields.
/// * Returns `()`.
/// * Errors: `SerializedError` on `AppDbError` (e.g. `NotFound` if update targets
///   a missing row).
#[tauri::command]
pub async fn db_upsert_template(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: Option<String>,
    name: String,
    subject: Option<String>,
    body_html: String,
    shortcut: Option<String>,
    sort_order: Option<i64>,
    category_id: Option<String>,
    is_favorite: Option<bool>,
    conditional_blocks_json: Option<String>,
    template_type: Option<String>,
    origin: Option<String>,
    delivery_config_json: Option<String>,
    ai_config_json: Option<String>,
    voice_config_json: Option<String>,
    compliance_profile_id: Option<String>,
) -> CmdResult<()> {
    let existing = crate::db::tables::comms::templates::get_by_id_opt(&pool, &id).await?;
    if let Some(mut existing) = existing {
        existing.name = name;
        existing.subject = subject;
        existing.body_html = body_html;
        existing.shortcut = shortcut;
        if let Some(s) = sort_order { existing.sort_order = s; }
        existing.category_id = category_id;
        if let Some(fav) = is_favorite { existing.is_favorite = if fav { 1 } else { 0 }; }
        existing.conditional_blocks_json = conditional_blocks_json;
        existing.template_type = template_type.unwrap_or(existing.template_type);
        existing.origin = origin.unwrap_or(existing.origin);
        existing.delivery_config_json = delivery_config_json;
        existing.ai_config_json = ai_config_json;
        existing.voice_config_json = voice_config_json;
        existing.compliance_profile_id = compliance_profile_id;
        crate::db::tables::comms::templates::update(&pool, &existing).await?;
    } else {
        let tmpl = crate::db::mail::schema::Template {
            id,
            company_id: company_id.unwrap_or_default(),
            name,
            subject,
            body_html,
            shortcut,
            sort_order: sort_order.unwrap_or(0),
            category_id,
            is_favorite: is_favorite.map(|f| if f { 1 } else { 0 }).unwrap_or(0),
            usage_count: 0,
            last_used_at: None,
            conditional_blocks_json,
            template_type: template_type.unwrap_or_else(|| "email".to_string()),
            origin: origin.unwrap_or_else(|| "user_created".to_string()),
            delivery_config_json,
            ai_config_json,
            voice_config_json,
            compliance_profile_id,
            created_at: 0,
        };
        crate::db::tables::comms::templates::create(&pool, &tmpl).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn db_delete_template(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::comms::templates::delete(&pool, &id).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_increment_template_usage(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::comms::templates::increment_usage(&pool, &id).await?;
    Ok(())
}

/// Partially update template fields by id using `UpdateFields`.
///
/// * `id` — template primary key; `fields` — dynamic column set/unset map.
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_update_template(
    pool: State<'_, SqlitePool>,
    id: String,
    fields: UpdateFields,
) -> CmdResult<()> {
    crate::db::tables::comms::templates::update_fields(&pool, &id, &fields).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_favorite_templates(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<Template>> {
    crate::db::tables::comms::templates::list_favorites(&pool, &company_id).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_most_used_templates(
    pool: State<'_, SqlitePool>,
    company_id: String,
    limit: Option<i64>,
) -> CmdResult<Vec<Template>> {
    crate::db::tables::comms::templates::list_most_used(&pool, &company_id, limit.unwrap_or(5)).await.map_err(Into::into)
}

/// List templates for a company filtered by `template_type`.
///
/// * `company_id` — owning company; `template_type` — exact type match.
/// * Returns the matching `Template` rows.
#[tauri::command]
pub async fn db_get_templates_by_type(
    pool: State<'_, SqlitePool>,
    company_id: String,
    template_type: String,
) -> CmdResult<Vec<Template>> {
    crate::db::tables::comms::templates::list_by_type(&pool, &company_id, &template_type).await.map_err(Into::into)
}

/// List template categories visible to a company (including global ones).
///
/// * `company_id` — owning company.
/// * Returns the matching `TemplateCategory` rows.
#[tauri::command]
pub async fn db_list_template_categories(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<crate::db::tables::comms::template_categories::TemplateCategory>> {
    crate::db::tables::comms::template_categories::list(&pool, &company_id).await.map_err(Into::into)
}

/// Insert or update a template category identified by `id`.
///
/// * `id` — category primary key; existing row updated, else created.
/// * Returns `()`. Errors: `SerializedError` on `AppDbError`.
#[tauri::command]
pub async fn db_upsert_template_category(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: String,
    name: String,
    icon: Option<String>,
) -> CmdResult<()> {
    crate::db::tables::comms::template_categories::upsert(&pool, &id, &company_id, &name, icon.as_deref()).await.map_err(Into::into)
}

/// Delete a template category by id.
///
/// * `id` — category primary key.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_delete_template_category(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::comms::template_categories::delete(&pool, &id).await.map_err(Into::into)
}

/// Insert a template using `INSERT OR IGNORE` from a raw JSON value.
///
/// * `params` — JSON object with template fields (duplicate id is skipped).
/// * Returns `()`. Errors: `SerializedError` on parse/SQL failure.
#[tauri::command(rename_all = "camelCase")]
pub async fn db_insert_template_ignore(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: Option<String>,
    name: String,
    subject: Option<String>,
    body_html: String,
    shortcut: Option<String>,
    sort_order: Option<i64>,
    category_id: Option<String>,
    is_favorite: Option<bool>,
    template_type: Option<String>,
    origin: Option<String>,
    delivery_config_json: Option<String>,
    ai_config_json: Option<String>,
    voice_config_json: Option<String>,
    compliance_profile_id: Option<String>,
) -> CmdResult<()> {
    crate::db::tables::comms::templates::insert_ignore(
        &pool, &id, company_id.as_deref(), &name, subject.as_deref(), &body_html,
        shortcut.as_deref(), sort_order.unwrap_or(0), category_id.as_deref(),
        is_favorite.map(|f| if f { 1 } else { 0 }).unwrap_or(0),
        template_type.as_deref().unwrap_or("email"),
        origin.as_deref().unwrap_or("user_created"),
        delivery_config_json.as_deref(), ai_config_json.as_deref(),
        voice_config_json.as_deref(), compliance_profile_id.as_deref(),
    ).await.map_err(Into::into)
}

/// Count all template categories.
///
/// * Returns a single-element `Vec<CountRow>` (the row count).
#[tauri::command]
pub async fn db_count_template_categories(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<crate::db::tables::comms::template_categories::CountRow>> {
    let cnt = crate::db::tables::comms::template_categories::count(&pool).await?;
    Ok(vec![crate::db::tables::comms::template_categories::CountRow { count: cnt }])
}

/// Insert a template category using `INSERT OR IGNORE` from raw JSON.
///
/// * `params` — JSON object with category fields (duplicate id skipped).
/// * Returns `()`. Errors: `SerializedError` on parse/SQL failure.
#[tauri::command(rename_all = "camelCase")]
pub async fn db_insert_template_category_ignore(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: String,
    name: String,
    icon: Option<String>,
    sort_order: Option<i64>,
) -> CmdResult<()> {
    crate::db::tables::comms::template_categories::insert_ignore(
        &pool, &id, &company_id, &name, icon.as_deref(), sort_order.unwrap_or(0),
    ).await.map_err(Into::into)
}

/// Fetch a template's subject and HTML body by id (returns an empty vector if
/// not found).
///
/// * `template_id` — template primary key.
/// * Returns a `Vec<ContentRow>` (one element when found, empty when absent).
#[tauri::command(rename_all = "camelCase")]
pub async fn db_get_template_content(
    pool: State<'_, SqlitePool>,
    template_id: String,
) -> CmdResult<Vec<crate::db::tables::comms::templates::ContentRow>> {
    let result = crate::db::tables::comms::templates::get_content(&pool, &template_id).await?;
    match result {
        Some(row) => Ok(vec![row]),
        None => Ok(vec![]),
    }
}

/// List signatures for an account.
///
/// * `account_id` — owning account.
/// * Returns the matching `Signature` rows.
#[tauri::command]
pub async fn db_list_signatures(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<Signature>> {
    crate::db::tables::comms::signatures::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

/// List local drafts for an account.
///
/// * `account_id` — owning account.
/// * Returns the matching `LocalDraft` rows.
#[tauri::command]
pub async fn db_list_local_drafts(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<LocalDraft>> {
    crate::db::tables::comms::local_drafts::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_scheduled_emails(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<ScheduledEmail>> {
    crate::db::tables::comms::scheduled_emails::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_smart_folders(
    pool: State<'_, SqlitePool>,
    account_id: Option<String>,
) -> CmdResult<Vec<SmartFolder>> {
    crate::db::tables::comms::smart_folders::list(&pool, account_id.as_deref().unwrap_or(""))
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_quick_steps(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<QuickStep>> {
    crate::db::tables::comms::quick_steps::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

/// List quick replies for an account.
///
/// * `account_id` — owning account.
/// * Returns the matching `QuickReply` rows.
#[tauri::command]
pub async fn db_list_quick_replies(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<QuickReply>> {
    crate::db::tables::comms::quick_replies::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_send_as_aliases(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<SendAsAlias>> {
    crate::db::tables::comms::aliases::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

/// List composer presets for an account.
///
/// * `account_id` — owning account.
/// * Returns the matching `ComposerPreset` rows.
#[tauri::command]
pub async fn db_list_composer_presets(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<ComposerPreset>> {
    crate::db::tables::comms::composer_presets::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

// ── Signatures ──

/// Fetch a signature by id (returns `None` if absent).
///
/// * `id` — signature primary key.
/// * Returns `Some(Signature)` when found, `None` when absent.
#[tauri::command]
pub async fn db_get_signature(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Option<Signature>> {
    crate::db::tables::comms::signatures::get_by_id_opt(&pool, &id).await.map_err(Into::into)
}

/// Insert or update a signature identified by `id`.
///
/// * `id` — signature primary key; existing row updated, else created (with
///   prior default cleared if `is_default` is true).
/// * Returns `()`. Errors: `SerializedError` on `AppDbError`.
#[tauri::command]
pub async fn db_upsert_signature(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    name: String,
    body_html: String,
    is_default: Option<bool>,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    let sig = Signature {
        id, account_id, name, body_html,
        is_default: if is_default.unwrap_or(false) { 1 } else { 0 },
        sort_order: 0,
        created_at: now,
    };
    let existing = crate::db::tables::comms::signatures::get_by_id_opt(&pool, &sig.id).await?;
    if existing.is_some() {
        crate::db::tables::comms::signatures::update(&pool, &sig).await?;
    } else {
        crate::db::tables::comms::signatures::insert_ignore(
            &pool, &sig.id, &sig.account_id, &sig.name, &sig.body_html, sig.is_default, sig.sort_order,
        ).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn db_delete_signature(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    let sig = crate::db::tables::comms::signatures::get_by_id_opt(&pool, &id).await?
        .ok_or_else(|| AppDbError::NotFound(format!("Signature {id}")))?;
    crate::db::tables::comms::signatures::delete(&pool, &id, &sig.account_id).await?;
    Ok(())
}

#[tauri::command]
pub async fn db_update_signature(
    pool: State<'_, SqlitePool>,
    id: String,
    fields: UpdateFields,
) -> CmdResult<()> {
    crate::db::tables::comms::signatures::update_fields(&pool, &id, &fields).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_clear_default_signature(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<()> {
    crate::db::tables::comms::signatures::clear_default(&pool, &account_id).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_insert_signature_ignore(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    name: String,
    body_html: String,
    is_default: Option<bool>,
    sort_order: Option<i64>,
) -> CmdResult<()> {
    crate::db::tables::comms::signatures::insert_ignore(
        &pool, &id, &account_id, &name, &body_html,
        if is_default.unwrap_or(false) { 1 } else { 0 },
        sort_order.unwrap_or(0),
    ).await.map_err(Into::into)
}

// ── Quick Steps ──

/// Insert or update a quick step identified by `id`.
///
/// * `id` — quick step primary key; existing row updated, else created.
/// * Returns `()`. Errors: `SerializedError` on `AppDbError`.
#[tauri::command]
pub async fn db_upsert_quick_step(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    name: String,
    description: Option<String>,
    shortcut: Option<String>,
    actions_json: String,
    icon: Option<String>,
    is_enabled: Option<bool>,
    sort_order: Option<i64>,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    let existing = crate::db::tables::comms::quick_steps::get_by_id_opt(&pool, &id).await?;
    if existing.is_some() {
        sqlx::query("UPDATE quick_steps SET name=?, description=?, shortcut=?, actions_json=?, icon=?, is_enabled=?, sort_order=? WHERE id=?")
            .bind(&name).bind(&description).bind(&shortcut).bind(&actions_json).bind(&icon)
            .bind(is_enabled.map(|v| if v {1} else {0}).unwrap_or(1)).bind(sort_order.unwrap_or(0)).bind(&id)
            .execute(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    } else {
        sqlx::query("INSERT INTO quick_steps (id, account_id, name, description, shortcut, actions_json, icon, is_enabled, sort_order, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
            .bind(&id).bind(&account_id).bind(&name).bind(&description).bind(&shortcut).bind(&actions_json)
            .bind(&icon).bind(is_enabled.map(|v| if v {1} else {0}).unwrap_or(1)).bind(sort_order.unwrap_or(0)).bind(now)
            .execute(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    }
    Ok(())
}

/// Partially update quick step fields by id using `UpdateFields`.
///
/// * `id` — quick step primary key; `fields` — dynamic column set/unset map.
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_update_quick_step(
    pool: State<'_, SqlitePool>,
    id: String,
    fields: UpdateFields,
) -> CmdResult<()> {
    crate::db::tables::comms::quick_steps::update_fields(&pool, &id, &fields).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_quick_step(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    let qs = crate::db::tables::comms::quick_steps::get_by_id_opt(&pool, &id).await?
        .ok_or_else(|| AppDbError::NotFound(format!("QuickStep {id}")))?;
    crate::db::tables::comms::quick_steps::delete(&pool, &id, &qs.account_id).await?;
    Ok(())
}

#[tauri::command]
pub async fn db_reorder_quick_steps(
    pool: State<'_, SqlitePool>,
    account_id: String,
    ordered_ids: Vec<String>,
) -> CmdResult<()> {
    crate::db::tables::comms::quick_steps::reorder(&pool, &account_id, &ordered_ids).await.map_err(Into::into)
}

// ── Quick Replies ──

/// Insert or update a quick reply identified by `id`.
///
/// * `id` — quick reply primary key; existing row updated, else created.
/// * Returns `()`. Errors: `SerializedError` on `AppDbError`.
#[tauri::command]
pub async fn db_upsert_quick_reply(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    title: String,
    body_html: String,
    shortcut: Option<String>,
    sort_order: Option<i64>,
) -> CmdResult<()> {
    let existing = crate::db::tables::comms::quick_replies::get_by_id_opt(&pool, &id).await?;
    if existing.is_some() {
        let qr = crate::db::mail::schema::QuickReply {
            id,
            account_id,
            title,
            body_html,
            shortcut,
            sort_order: sort_order.unwrap_or(0),
            usage_count: 0,
            created_at: 0,
        };
        crate::db::tables::comms::quick_replies::update(&pool, &qr).await?;
    } else {
        crate::db::tables::comms::quick_replies::insert_ignore(
            &pool, &id, &account_id, &title, &body_html, shortcut.as_deref(), sort_order.unwrap_or(0),
        ).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn db_delete_quick_reply(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    let qr = crate::db::tables::comms::quick_replies::get_by_id_opt(&pool, &id).await?
        .ok_or_else(|| AppDbError::NotFound(format!("QuickReply {id}")))?;
    crate::db::tables::comms::quick_replies::delete(&pool, &id, &qr.account_id).await?;
    Ok(())
}

/// Increment a quick reply's usage count by id.
///
/// * `id` — quick reply primary key.
/// * Returns `()`. Does not error if the id is absent.
#[tauri::command]
pub async fn db_increment_quick_reply_usage(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::comms::quick_replies::increment_usage(&pool, &id).await.map_err(Into::into)
}

#[tauri::command]
pub async fn db_insert_quick_reply_ignore(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    title: String,
    body_html: String,
    shortcut: Option<String>,
    sort_order: Option<i64>,
) -> CmdResult<()> {
    crate::db::tables::comms::quick_replies::insert_ignore(&pool, &id, &account_id, &title, &body_html, shortcut.as_deref(), sort_order.unwrap_or(0)).await.map_err(Into::into)
}

// ── Smart Folders ──

/// Insert or update a smart folder identified by `id`.
///
/// * `id` — smart folder primary key; existing row updated, else created.
/// * Returns `()`. Errors: `SerializedError` on `AppDbError`.
#[tauri::command]
pub async fn db_upsert_smart_folder(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: Option<String>,
    name: String,
    query: String,
    icon: Option<String>,
    color: Option<String>,
    sort_order: Option<i64>,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    let existing = crate::db::tables::comms::smart_folders::get_by_id_opt(&pool, &id).await?;
    if existing.is_some() {
        sqlx::query("UPDATE smart_folders SET name=?, query=?, icon=?, color=?, sort_order=? WHERE id=?")
            .bind(&name).bind(&query).bind(&icon).bind(&color).bind(sort_order.unwrap_or(0)).bind(&id)
            .execute(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    } else {
        sqlx::query("INSERT INTO smart_folders (id, account_id, name, query, icon, color, sort_order, is_default, created_at) VALUES (?,?,?,?,?,?,?,0,?)")
            .bind(&id).bind(&account_id).bind(&name).bind(&query).bind(&icon).bind(&color).bind(sort_order.unwrap_or(0)).bind(now)
            .execute(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    }
    Ok(())
}

/// Insert or update a single filter condition (by `condition.id`).
///
/// * `condition` — `UpsertFilterConditionRequest`; a new UUID is generated when
///   `id` is `None`.
/// * Returns `()`. Errors: `SerializedError` on `AppDbError`.
#[tauri::command]
pub async fn db_upsert_filter_condition(
    pool: State<'_, SqlitePool>,
    condition: UpsertFilterConditionRequest,
) -> CmdResult<FilterConditionRow> {
    let id = condition.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let row = sqlx::query_as::<_, FilterConditionRow>(
        "INSERT INTO filter_conditions (id, filter_id, field, operator, value) \
         VALUES (?1, ?2, ?3, ?4, ?5) \
         ON CONFLICT(id) DO UPDATE SET field=?3, operator=?4, value=?5 \
         RETURNING id, filter_id, field, operator, value",
    )
    .bind(&id)
    .bind(&condition.filter_id)
    .bind(&condition.field)
    .bind(&condition.operator)
    .bind(&condition.value)
    .fetch_one(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;
    Ok(row)
}

/// Partially update smart folder fields by id using `UpdateFields`.
///
/// * `id` — smart folder primary key; `fields` — dynamic column set/unset map.
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_update_smart_folder(
    pool: State<'_, SqlitePool>,
    id: String,
    fields: UpdateFields,
) -> CmdResult<()> {
    crate::db::tables::comms::smart_folders::update_fields(&pool, &id, &fields).await.map_err(Into::into)
}

/// Delete a smart folder by id.
///
/// * `id` — smart folder primary key.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_delete_smart_folder(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::comms::smart_folders::delete(&pool, &id).await.map_err(Into::into)
}

// ── Local Drafts ──

/// Fetch a local draft by id (returns `None` if absent).
///
/// * `id` — local draft primary key.
/// * Returns `Some(LocalDraft)` when found, `None` when absent.
#[tauri::command]
pub async fn db_get_local_draft(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Option<LocalDraft>> {
    crate::db::tables::comms::local_drafts::get_by_id_opt(&pool, &id).await.map_err(Into::into)
}

/// Insert or update a local draft identified by `id`.
///
/// * `id` — local draft primary key; existing row updated, else created.
/// * Returns `()`. Errors: `SerializedError` on `AppDbError`.
#[tauri::command]
pub async fn db_upsert_local_draft(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    to_addresses: Option<String>,
    cc_addresses: Option<String>,
    bcc_addresses: Option<String>,
    subject: Option<String>,
    body_html: Option<String>,
    reply_to_message_id: Option<String>,
    thread_id: Option<String>,
    from_email: Option<String>,
    signature_id: Option<String>,
    remote_draft_id: Option<String>,
    attachments: Option<String>,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    let draft = crate::db::mail::schema::LocalDraft {
        id,
        account_id,
        to_addresses,
        cc_addresses,
        bcc_addresses,
        subject,
        body_html,
        reply_to_message_id,
        thread_id,
        from_email,
        signature_id,
        remote_draft_id,
        attachments,
        sync_status: "pending".to_string(),
        created_at: now,
        updated_at: now,
    };
    crate::db::tables::comms::local_drafts::upsert(&pool, &draft.account_id, &draft).await?;
    Ok(())
}

/// Delete a local draft by id.
///
/// * `id` — local draft primary key.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_delete_local_draft(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    let draft = crate::db::tables::comms::local_drafts::get_by_id_opt(&pool, &id).await?
        .ok_or_else(|| AppDbError::NotFound(format!("LocalDraft {id}")))?;
    crate::db::tables::comms::local_drafts::delete(&pool, &id, &draft.account_id).await?;
    Ok(())
}

// ── Send-As Aliases ──

/// Insert or update a send-as alias identified by `id`.
///
/// * `id` — alias primary key; existing row updated, else created.
/// * Returns `()`. Errors: `SerializedError` on `AppDbError`.
#[tauri::command]
pub async fn db_upsert_send_as_alias(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    email: String,
    display_name: Option<String>,
    reply_to_address: Option<String>,
    signature_id: Option<String>,
    is_primary: Option<bool>,
    is_default: Option<bool>,
    treat_as_alias: Option<bool>,
    verification_status: Option<String>,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    let mut q = sqlx::query(
        "INSERT INTO send_as_aliases (id, account_id, email, display_name, reply_to_address, signature_id, is_primary, is_default, treat_as_alias, verification_status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, reply_to_address=excluded.reply_to_address, signature_id=excluded.signature_id, is_primary=excluded.is_primary, is_default=excluded.is_default, treat_as_alias=excluded.treat_as_alias, verification_status=excluded.verification_status"
    );
    q = q.bind(&id).bind(&account_id).bind(&email).bind(&display_name).bind(&reply_to_address).bind(&signature_id)
        .bind(is_primary.map(|v| if v {1} else {0}).unwrap_or(0))
        .bind(is_default.map(|v| if v {1} else {0}).unwrap_or(0))
        .bind(treat_as_alias.map(|v| if v {1} else {0}).unwrap_or(1))
        .bind(verification_status.as_deref().unwrap_or("accepted"))
        .bind(now);
    q.execute(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    Ok(())
}

/// Delete a send-as alias by id.
///
/// * `id` — alias primary key.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_delete_send_as_alias(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    let rows = sqlx::query("DELETE FROM send_as_aliases WHERE id = ?").bind(&id).execute(&*pool).await.map_err(|e| AppDbError::Database(e))?.rows_affected();
    if rows == 0 { return Err(AppDbError::NotFound(id).into()); }
    Ok(())
}

// ── Scheduled Emails ──

/// Set the status of a scheduled email by id.
///
/// * `id` — scheduled email primary key; `status` — new status string.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_update_scheduled_email_status(
    pool: State<'_, SqlitePool>,
    id: String,
    status: String,
) -> CmdResult<()> {
    sqlx::query("UPDATE scheduled_emails SET status = ? WHERE id = ?")
        .bind(&status).bind(&id).execute(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    Ok(())
}

/// Delete a scheduled email by id.
///
/// * `id` — scheduled email primary key.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_delete_scheduled_email(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    let rows = sqlx::query("DELETE FROM scheduled_emails WHERE id = ?").bind(&id).execute(&*pool).await.map_err(|e| AppDbError::Database(e))?.rows_affected();
    if rows == 0 { return Err(AppDbError::NotFound(id).into()); }
    Ok(())
}

// ── Filter Rules ──

/// Partially update a filter rule's columns by id using `UpdateFields`.
///
/// * `id` — filter rule primary key; `fields` — dynamic column set/unset map.
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
/// * SQL-safety: the `SET` list is built from the `fields` keys and executed via
///   `sqlx::AssertSqlSafe`; values are bound positionally, so only valid column
///   names may appear in `fields`.
#[tauri::command]
pub async fn db_update_filter(
    pool: State<'_, SqlitePool>,
    id: String,
    fields: UpdateFields,
) -> CmdResult<()> {
    let set_count = fields.set.len();
    if set_count == 0 && fields.unset.is_empty() { return Ok(()); }
    let mut set_parts: Vec<String> = Vec::with_capacity(set_count + fields.unset.len());
    let mut set_values: Vec<serde_json::Value> = Vec::with_capacity(set_count);
    for key in &fields.unset { set_parts.push(format!("\"{key}\" = NULL")); }
    for (key, value) in &fields.set { set_parts.push(format!("\"{key}\" = ?")); set_values.push(value.clone()); }
    let sql = format!("UPDATE filter_rules SET {} WHERE id = ?", set_parts.join(", "));
    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql));
    for val in &set_values { q = q.bind(val); }
    q.bind(&id).execute(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    Ok(())
}

/// Delete a filter rule by id.
///
/// * `id` — filter rule primary key.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_delete_filter(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    let rows = sqlx::query("DELETE FROM filter_rules WHERE id = ?").bind(&id).execute(&*pool).await.map_err(|e| AppDbError::Database(e))?.rows_affected();
    if rows == 0 { return Err(AppDbError::NotFound(id).into()); }
    Ok(())
}

// ── Filter Logs ──

/// Append a filter-evaluation log entry.
///
/// * Parameters record the rule, message, match result, score and applied
///   actions.
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_log_filter_match(
    pool: State<'_, SqlitePool>,
    id: String,
    rule_id: String,
    message_id: String,
    matched: bool,
    score: Option<f64>,
    applied_actions: Option<String>,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    let log = crate::db::mail::schema::FilterLog {
        id,
        rule_id,
        message_id,
        matched: if matched { 1 } else { 0 },
        score: score.unwrap_or(0.0),
        applied_actions,
        created_at: now,
    };
    let _ = crate::db::tables::comms::filter_logs::create(&pool, &log).await?;
    Ok(())
}

/// Delete filter logs for an account older than a timestamp.
///
/// * `account_id` — owning account; `older_than` — unix epoch seconds cutoff.
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_delete_filter_logs_older_than(
    pool: State<'_, SqlitePool>,
    account_id: String,
    older_than: i64,
) -> CmdResult<()> {
    sqlx::query("DELETE FROM filter_logs WHERE created_at < ? AND rule_id IN (SELECT id FROM filter_rules WHERE account_id = ?)")
        .bind(older_than).bind(&account_id)
        .execute(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    Ok(())
}

// ── Filter Rules — Count ──

/// Count all filter rules.
///
/// * Returns a single-element `Vec<CountRow>` (the row count).
#[tauri::command]
pub async fn db_count_filter_rules(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    crate::db::tables::comms::filter_rules::count(&pool)
        .await
        .map_err(Into::into)
}

// ── Filter Rules — Get enabled for account ──

/// List enabled filter rules for an account.
///
/// * `account_id` — owning account.
/// * Returns the matching `FilterRule` rows.
#[tauri::command]
pub async fn db_get_enabled_filter_rules(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<FilterRule>> {
    crate::db::tables::comms::filter_rules::get_enabled_for_account(&pool, &account_id)
        .await
        .map_err(Into::into)
}

// ── Filter Rules — Get by id ──

/// Fetch a single filter rule by id and account.
///
/// * `id` — rule primary key; `account_id` — owning account.
/// * Returns `Some(FilterRule)` when found, `None` when absent.
#[tauri::command]
pub async fn db_get_filter_rule(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<FilterRule> {
    crate::db::tables::comms::filter_rules::get_by_id(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

// ── Filter Rules — Get stats ──

/// Report total/enabled filter-rule counts for an account.
///
/// * `account_id` — owning account.
/// * Returns `{ "total": i64, "enabled": i64 }`.
#[tauri::command]
pub async fn db_get_filter_stats(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<serde_json::Value> {
    crate::db::tables::comms::filter_rules::get_stats(&pool, &account_id)
        .await
        .map_err(Into::into)
}

// ── Filter Logs — Get by rule id ──

/// List filter logs for a rule (newest first).
///
/// * `rule_id` — rule whose logs to return; `_limit` — currently ignored.
/// * Returns the matching `FilterLog` rows.
#[tauri::command]
pub async fn db_get_filter_logs(
    pool: State<'_, SqlitePool>,
    rule_id: String,
    _limit: Option<i64>,
) -> CmdResult<Vec<FilterLog>> {
    crate::db::tables::comms::filter_logs::list_by_rule(&pool, &rule_id)
        .await
        .map_err(Into::into)
}

// ── Filter Logs — Get recent by account ──

/// List recent filter logs across an account's rules (newest first).
///
/// * `account_id` — owning account; `limit` — maximum rows.
/// * Returns the matching `FilterLog` rows.
#[tauri::command]
pub async fn db_get_recent_filter_logs(
    pool: State<'_, SqlitePool>,
    account_id: String,
    limit: Option<i64>,
) -> CmdResult<Vec<FilterLog>> {
    crate::db::tables::comms::filter_logs::list_by_account(&pool, &account_id, limit.unwrap_or(50))
        .await
        .map_err(Into::into)
}

// ── Filter Logs — Get stats ──

/// Report total/matched filter-log counts for an account.
///
/// * `account_id` — owning account.
/// * Returns `{ "total": i64, "matched": i64 }`.
#[tauri::command]
pub async fn db_get_filter_log_stats(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<serde_json::Value> {
    crate::db::tables::comms::filter_logs::get_log_stats(&pool, &account_id)
        .await
        .map_err(Into::into)
}

// ── Smart Folders — Update sort order ──

/// Persist a new display order for smart folders.
///
/// * `orders` — vector of `(id, sort_order)` pairs applied per folder.
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_update_smart_folder_sort_order(
    pool: State<'_, SqlitePool>,
    orders: Vec<LabelSortOrderUpdate>,
) -> CmdResult<()> {
    for item in orders {
        sqlx::query("UPDATE smart_folders SET sort_order = ? WHERE id = ?")
            .bind(item.sort_order)
            .bind(&item.id)
            .execute(&*pool)
            .await
            .map_err(AppDbError::Database)?;
    }
    Ok(())
}

// ── Send-As Aliases — Set default alias (transactional) ──

/// Mark a send-as alias as the default for its account.
///
/// * `account_id` — owning account; `alias_id` — alias to make default.
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_set_default_alias(
    pool: State<'_, SqlitePool>,
    account_id: String,
    alias_id: String,
) -> CmdResult<()> {
    // Clear all defaults
    sqlx::query("UPDATE send_as_aliases SET is_default = 0 WHERE account_id = ?")
        .bind(&account_id)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    // Set new default
    sqlx::query("UPDATE send_as_aliases SET is_default = 1 WHERE id = ? AND account_id = ?")
        .bind(&alias_id)
        .bind(&account_id)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

// ── Local Drafts — Mark as synced ──

/// Record that a local draft has been synced, storing its remote draft id.
///
/// * `id` — local draft primary key; `remote_draft_id` — server draft id.
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_mark_draft_synced(
    pool: State<'_, SqlitePool>,
    id: String,
    remote_draft_id: String,
) -> CmdResult<()> {
    sqlx::query(
        "UPDATE local_drafts SET sync_status = 'synced', remote_draft_id = ? WHERE id = ?",
    )
    .bind(&remote_draft_id)
    .bind(&id)
    .execute(&*pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

// ── Thread Categories — Batch set categories ──

/// Upsert a batch of thread-to-category mappings.
///
/// * `entries` — vector of `ThreadCategoryEntry` to insert/replace.
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_set_thread_categories_batch(
    pool: State<'_, SqlitePool>,
    entries: Vec<ThreadCategoryEntry>,
) -> CmdResult<()> {
    for entry in entries {
        sqlx::query(
            "INSERT INTO thread_categories (account_id, thread_id, category, is_manual) VALUES (?, ?, ?, 0) ON CONFLICT(account_id, thread_id) DO UPDATE SET category = ? WHERE is_manual = 0 AND is_user_override = 0"
        )
        .bind(&entry.account_id)
        .bind(&entry.thread_id)
        .bind(&entry.category)
        .bind(&entry.category)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    }
    Ok(())
}

// ── Messages — Update IMAP folder batch ──

/// Move many messages to a new IMAP folder within an account.
///
/// * `account_id` — owning account; `message_ids` — messages to move;
///   `new_folder` — target folder.
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_bulk_update_message_imap_folder(
    pool: State<'_, SqlitePool>,
    account_id: String,
    message_ids: Vec<String>,
    new_folder: String,
) -> CmdResult<()> {
    if message_ids.is_empty() {
        return Ok(());
    }
    let mut qb: QueryBuilder<sqlx::Sqlite> = QueryBuilder::new(
        "UPDATE messages SET imap_folder = ",
    );
    qb.push_bind(&new_folder);
    qb.push(" WHERE account_id = ");
    qb.push_bind(&account_id);
    qb.push(" AND id IN (");
    let mut separated = qb.separated(", ");
    for id in &message_ids {
        separated.push_bind(id);
    }
    qb.push(")");
    qb.build().execute(&*pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

// ── Thread Categories ──

/// List thread-category mappings for an account.
///
/// * `account_id` — owning account.
/// * Returns the matching `ThreadCategoryRow` rows.
#[tauri::command]
pub async fn db_list_thread_categories(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<ThreadCategoryRow>> {
    sqlx::query_as::<_, ThreadCategoryRow>(
        "SELECT * FROM thread_categories WHERE account_id = ? ORDER BY category ASC"
    )
    .bind(&account_id)
    .fetch_all(&*pool)
    .await
    .map_err(AppDbError::Database)
    .map_err(Into::into)
}

/// Insert or update a thread category from a `UpsertThreadCategoryRequest`.
///
/// * `cat` — the mapping to persist (replaces any existing thread/category row).
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_upsert_thread_category(
    pool: State<'_, SqlitePool>,
    cat: UpsertThreadCategoryRequest,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO thread_categories (account_id, thread_id, category, is_manual, is_user_override, applied_at) \
         VALUES (?, ?, ?, ?, ?, ?) \
         ON CONFLICT(account_id, thread_id) DO UPDATE SET \
         category = excluded.category, \
         is_manual = excluded.is_manual, \
         is_user_override = excluded.is_user_override, \
         applied_at = excluded.applied_at"
    )
    .bind(&cat.account_id)
    .bind(&cat.thread_id)
    .bind(&cat.category)
    .bind(cat.is_manual.map(|v| if v { 1 } else { 0 }).unwrap_or(0))
    .bind(cat.is_user_override.map(|v| if v { 1 } else { 0 }).unwrap_or(0))
    .bind(now)
    .execute(&*pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

// ── Signatures — Extended Queries ──

/// Look up the owning account id of a signature.
///
/// * `id` — signature primary key.
/// * Returns `Option<SignatureAccountRow>` (the account id) when found.
#[tauri::command]
pub async fn db_get_signature_account(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Vec<SignatureAccountRow>> {
    sqlx::query_as::<_, SignatureAccountRow>(
        "SELECT account_id FROM signatures WHERE id = ?"
    )
    .bind(&id)
    .fetch_all(&*pool)
    .await
    .map_err(AppDbError::Database)
    .map_err(Into::into)
}

/// Fetch the default signature for an account.
///
/// * `account_id` — owning account.
/// * Returns `Some(Signature)` when a default exists, `None` otherwise.
#[tauri::command]
pub async fn db_get_default_signature(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Option<Signature>> {
    match crate::db::tables::comms::signatures::get_default(&pool, &account_id).await {
        Ok(sig) => Ok(Some(sig)),
        Err(AppDbError::NotFound(_)) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

// ── Quick Replies — Count ──

/// Count all quick replies.
///
/// * Returns a single-element `Vec<CountRow>` (the row count).
#[tauri::command]
pub async fn db_count_quick_replies(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM quick_replies")
        .fetch_one(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(row.0)
}

// ── Quick Steps — Get Enabled ──

/// List enabled quick steps for an account.
///
/// * `account_id` — owning account.
/// * Returns the matching `QuickStep` rows.
#[tauri::command]
pub async fn db_get_enabled_quick_steps(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<QuickStep>> {
    sqlx::query_as::<_, QuickStep>(
        "SELECT * FROM quick_steps WHERE account_id = ? AND is_enabled = 1 ORDER BY sort_order ASC"
    )
    .bind(&account_id)
    .fetch_all(&*pool)
    .await
    .map_err(AppDbError::Database)
    .map_err(Into::into)
}

// ── Filter Groups — Get Operator ──

#[tauri::command]
pub async fn db_get_filter_group_operator(
    pool: State<'_, SqlitePool>,
    rule_id: String,
) -> CmdResult<Vec<FilterGroupOperatorResult>> {
    // For backward compatibility: if filter_groups table exists, query from there.
    // Otherwise, fall back to filter_rules.group_operator.
    let result = sqlx::query_as::<_, FilterGroupOperatorResult>(
        "SELECT group_operator FROM filter_rules WHERE id = ?"
    )
    .bind(&rule_id)
    .fetch_all(&*pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(result)
}

// ── Filter Conditions ──

/// Request DTO for upserting a single filter condition.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertFilterConditionRequest {
    /// Optional existing condition id; a new UUID is generated when `None`.
    pub id: Option<String>,
    /// Parent filter rule id.
    pub filter_id: String,
    /// Field the condition matches on.
    pub field: String,
    /// Comparison operator.
    pub operator: String,
    /// Comparison value.
    pub value: String,
}

/// Row DTO: a persisted filter condition.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FilterConditionRow {
    /// Condition id.
    pub id: String,
    /// Parent filter rule id.
    pub filter_id: String,
    /// Field the condition matches on.
    pub field: String,
    /// Comparison operator.
    pub operator: String,
    /// Comparison value.
    pub value: String,
}

/// Delete a filter condition by id.
///
/// * `id` — filter condition primary key.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_delete_filter_condition(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    let rows = sqlx::query("DELETE FROM filter_conditions WHERE id = ?")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("FilterCondition {id}")).into());
    }
    Ok(())
}

// ── Filter Groups (alias for filter_rules) ──

/// Request DTO for upserting a filter rule (treated as a "group").
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertFilterGroupRequest {
    /// Optional existing rule id; a new UUID is generated when `None`.
    pub id: Option<String>,
    /// Owning account (default `""`).
    #[serde(default)]
    pub account_id: String,
    /// Rule name (default `""`).
    #[serde(default)]
    pub name: String,
    /// Optional enabled flag.
    pub is_enabled: Option<bool>,
    /// Optional criteria JSON.
    pub criteria_json: Option<String>,
    /// Optional actions JSON.
    pub actions_json: Option<String>,
    /// Optional group operator.
    pub group_operator: Option<String>,
    /// Optional score threshold.
    pub score_threshold: Option<f64>,
    /// Optional chaining action.
    pub chaining_action: Option<String>,
    /// Optional sort order.
    pub sort_order: Option<i64>,
}

#[tauri::command]
pub async fn db_upsert_filter_group(
    pool: State<'_, SqlitePool>,
    group: UpsertFilterGroupRequest,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    let id = group.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    // Check if rule exists
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM filter_rules WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&*pool)
    .await
    .map_err(AppDbError::Database)?;

    if existing.is_some() {
        sqlx::query(
            "UPDATE filter_rules SET name = COALESCE(?, name), is_enabled = COALESCE(?, is_enabled), \
             criteria_json = COALESCE(?, criteria_json), actions_json = COALESCE(?, actions_json), \
             group_operator = COALESCE(?, group_operator), score_threshold = COALESCE(?, score_threshold), \
             chaining_action = COALESCE(?, chaining_action), sort_order = COALESCE(?, sort_order) \
             WHERE id = ?"
        )
        .bind(&group.name)
        .bind(group.is_enabled.map(|v| if v { 1 } else { 0 }))
        .bind(&group.criteria_json)
        .bind(&group.actions_json)
        .bind(&group.group_operator)
        .bind(group.score_threshold)
        .bind(&group.chaining_action)
        .bind(group.sort_order)
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    } else {
        sqlx::query(
            "INSERT INTO filter_rules (id, account_id, name, is_enabled, criteria_json, actions_json, \
             group_operator, score_threshold, chaining_action, sort_order, created_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&group.account_id)
        .bind(&group.name)
        .bind(group.is_enabled.map(|v| if v { 1 } else { 0 }).unwrap_or(1))
        .bind(group.criteria_json.as_deref().unwrap_or("{}"))
        .bind(group.actions_json.as_deref().unwrap_or("[]"))
        .bind(group.group_operator.as_deref().unwrap_or("AND"))
        .bind(group.score_threshold)
        .bind(&group.chaining_action)
        .bind(group.sort_order.unwrap_or(0))
        .bind(now)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn db_delete_filter_group(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    let rows = sqlx::query("DELETE FROM filter_rules WHERE id = ?")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("FilterGroup {id}")).into());
    }
    Ok(())
}

// ── Signature Account Row ──

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SignatureAccountRow {
    pub account_id: String,
}

// ── Scheduled Emails — Create ──

#[tauri::command]
pub async fn db_create_scheduled_email(
    pool: State<'_, SqlitePool>,
    request: CreateScheduledEmailRequest,
) -> CmdResult<ScheduledEmail> {
    crate::db::tables::comms::scheduled_emails::create(
        &pool,
        &ScheduledEmail {
            id: String::new(), // will be overwritten by the database
            account_id: request.account_id,
            to_addresses: request.to_addresses,
            cc_addresses: request.cc_addresses,
            bcc_addresses: request.bcc_addresses,
            subject: request.subject,
            body_html: request.body_html,
            reply_to_message_id: request.reply_to_message_id,
            thread_id: request.thread_id,
            scheduled_at: request.scheduled_at,
            signature_id: request.signature_id,
            attachment_paths: request.attachment_paths,
            status: request.status,
            created_at: 0, // will be overwritten by the database
        },
    )
        .await
        .map_err(Into::into)
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEWLY WIRED COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Send-As Aliases — Extended ──

#[tauri::command]
pub async fn db_get_send_as_alias(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<SendAsAlias> {
    crate::db::tables::comms::aliases::get_by_id(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_primary_alias(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<SendAsAlias> {
    crate::db::tables::comms::aliases::get_primary(&pool, &account_id)
        .await
        .map_err(Into::into)
}

/// Create a send-as alias from a `SendAsAlias` record.
///
/// * `data` — alias fields (a new id/`created_at` are generated).
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_create_send_as_alias(
    pool: State<'_, SqlitePool>,
    data: SendAsAlias,
) -> CmdResult<SendAsAlias> {
    crate::db::tables::comms::aliases::create(&pool, &data)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_send_as_alias(
    pool: State<'_, SqlitePool>,
    data: SendAsAlias,
) -> CmdResult<SendAsAlias> {
    crate::db::tables::comms::aliases::update(&pool, &data)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_send_as_alias_full(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<()> {
    crate::db::tables::comms::aliases::delete(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

// ── Composer Presets ──

/// Fetch a composer preset by id and account (returns `None` if absent).
///
/// * `id` — preset primary key; `account_id` — owning account.
/// * Returns `Some(ComposerPreset)` when found, `None` when absent.
#[tauri::command]
pub async fn db_get_composer_preset(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<ComposerPreset> {
    crate::db::tables::comms::composer_presets::get_by_id(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

/// Fetch the default composer preset for an account (returns `None` if none).
///
/// * `account_id` — owning account.
/// * Returns `Some(ComposerPreset)` when a default exists, `None` otherwise.
#[tauri::command]
pub async fn db_get_default_composer_preset(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<ComposerPreset> {
    crate::db::tables::comms::composer_presets::get_default(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_composer_preset(
    pool: State<'_, SqlitePool>,
    data: ComposerPreset,
) -> CmdResult<ComposerPreset> {
    crate::db::tables::comms::composer_presets::create(&pool, &data)
        .await
        .map_err(Into::into)
}

/// Update a composer preset from a `ComposerPreset` record.
///
/// * `data` — preset fields; `data.id`/`data.account_id` scope the update.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_update_composer_preset(
    pool: State<'_, SqlitePool>,
    data: ComposerPreset,
) -> CmdResult<ComposerPreset> {
    crate::db::tables::comms::composer_presets::update(&pool, &data)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_composer_preset(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<()> {
    crate::db::tables::comms::composer_presets::delete(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

// ── Filter Rules — Extended ──

#[tauri::command]
pub async fn db_update_filter_rule_full(
    pool: State<'_, SqlitePool>,
    data: FilterRule,
) -> CmdResult<FilterRule> {
    crate::db::tables::comms::filter_rules::update(&pool, &data)
        .await
        .map_err(Into::into)
}

/// Delete a filter rule by id and account.
///
/// * `id` — rule primary key; `account_id` — owning account.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_delete_filter_full(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<()> {
    crate::db::tables::comms::filter_rules::delete(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

// ── Local Drafts — Extended ──

#[tauri::command]
pub async fn db_get_local_draft_full(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<LocalDraft> {
    crate::db::tables::comms::local_drafts::get_by_id(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

/// Fetch a local draft by its remote id and account (returns `None` if absent).
///
/// * `remote_draft_id` — server draft id; `account_id` — owning account.
/// * Returns `Some(LocalDraft)` when found, `None` when absent.
#[tauri::command]
pub async fn db_get_local_draft_by_remote(
    pool: State<'_, SqlitePool>,
    remote_draft_id: String,
    account_id: String,
) -> CmdResult<Option<LocalDraft>> {
    crate::db::tables::comms::local_drafts::get_by_remote_id(&pool, &remote_draft_id, &account_id)
        .await
        .map_err(Into::into)
}

// ── Quick Replies — Extended ──

#[tauri::command]
pub async fn db_get_quick_reply(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<QuickReply> {
    crate::db::tables::comms::quick_replies::get_by_id(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

/// Create a quick reply from a `QuickReply` record.
///
/// * `data` — reply fields (a new id/`created_at` are generated; usage starts 0).
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_create_quick_reply(
    pool: State<'_, SqlitePool>,
    data: QuickReply,
) -> CmdResult<QuickReply> {
    crate::db::tables::comms::quick_replies::create(&pool, &data)
        .await
        .map_err(Into::into)
}

/// Increment a quick reply's usage count by id within an account.
///
/// * `id` — reply primary key; `account_id` — owning account.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_increment_quick_reply_usage_for_account(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<QuickReply> {
    crate::db::tables::comms::quick_replies::increment_usage_for_account(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

// ── Quick Steps — Extended ──

#[tauri::command]
pub async fn db_get_quick_step(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<QuickStep> {
    crate::db::tables::comms::quick_steps::get_by_id(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

/// Create a quick step from a `QuickStep` record.
///
/// * `data` — step fields (a new id/`created_at` are generated).
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_create_quick_step(
    pool: State<'_, SqlitePool>,
    data: QuickStep,
) -> CmdResult<QuickStep> {
    crate::db::tables::comms::quick_steps::create(&pool, &data)
        .await
        .map_err(Into::into)
}

/// Update a quick step from a full `QuickStep` record.
///
/// * `data` — step fields; `data.id`/`data.account_id` scope the update.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_update_quick_step_full(
    pool: State<'_, SqlitePool>,
    data: QuickStep,
) -> CmdResult<QuickStep> {
    crate::db::tables::comms::quick_steps::update(&pool, &data)
        .await
        .map_err(Into::into)
}

// ── Scheduled Emails — Extended ──

#[tauri::command]
pub async fn db_list_pending_scheduled_emails(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<ScheduledEmail>> {
    crate::db::tables::comms::scheduled_emails::list_pending(&pool, &account_id)
        .await
        .map_err(Into::into)
}

/// Fetch a scheduled email by id and account (returns `None` if absent).
///
/// * `id` — email primary key; `account_id` — owning account.
/// * Returns `Some(ScheduledEmail)` when found, `None` when absent.
#[tauri::command]
pub async fn db_get_scheduled_email(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<ScheduledEmail> {
    crate::db::tables::comms::scheduled_emails::get_by_id(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

/// Update a scheduled email's status by id and account.
///
/// * `id` — email primary key; `account_id` — owning account; `status` — new
///   status string.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_update_scheduled_email_status_full(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    status: String,
) -> CmdResult<ScheduledEmail> {
    crate::db::tables::comms::scheduled_emails::update_status(&pool, &id, &account_id, &status)
        .await
        .map_err(Into::into)
}

/// Delete a scheduled email by id and account.
///
/// * `id` — email primary key; `account_id` — owning account.
/// * Returns `()`. Errors: `SerializedError` (`AppDbError::NotFound` if missing).
#[tauri::command]
pub async fn db_delete_scheduled_email_full(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<()> {
    crate::db::tables::comms::scheduled_emails::delete(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

// ── Signatures — Extended ──

/// Fetch a signature by id and account (returns `None` if absent).
///
/// * `id` — signature primary key; `account_id` — owning account.
/// * Returns `Some(Signature)` when found, `None` when absent.
#[tauri::command]
pub async fn db_get_signature_full(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
) -> CmdResult<Signature> {
    crate::db::tables::comms::signatures::get_by_id(&pool, &id, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_signature(
    pool: State<'_, SqlitePool>,
    data: Signature,
) -> CmdResult<Signature> {
    crate::db::tables::comms::signatures::create(&pool, &data)
        .await
        .map_err(Into::into)
}

// ── Smart Folders — Extended ──

/// Fetch a smart folder by id (returns `None` if absent).
///
/// * `id` — smart folder primary key.
/// * Returns `Some(SmartFolder)` when found, `None` when absent.
#[tauri::command]
pub async fn db_get_smart_folder(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<SmartFolder> {
    crate::db::tables::comms::smart_folders::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_smart_folder(
    pool: State<'_, SqlitePool>,
    data: SmartFolder,
) -> CmdResult<SmartFolder> {
    crate::db::tables::comms::smart_folders::create(&pool, &data)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_smart_folder_full(
    pool: State<'_, SqlitePool>,
    data: SmartFolder,
) -> CmdResult<SmartFolder> {
    crate::db::tables::comms::smart_folders::update(&pool, &data)
        .await
        .map_err(Into::into)
}

// ── Template Categories — Extended ──

#[tauri::command]
pub async fn db_get_template_category(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<crate::db::tables::comms::template_categories::TemplateCategory> {
    crate::db::tables::comms::template_categories::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

/// Create a template category from a `TemplateCategory` record.
///
/// * `data` — category fields (a new id/`created_at` are generated).
/// * Returns `()`. Errors: `SerializedError` on SQL failure.
#[tauri::command]
pub async fn db_create_template_category(
    pool: State<'_, SqlitePool>,
    data: crate::db::tables::comms::template_categories::TemplateCategory,
) -> CmdResult<crate::db::tables::comms::template_categories::TemplateCategory> {
    crate::db::tables::comms::template_categories::create(&pool, &data)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_template_category(
    pool: State<'_, SqlitePool>,
    data: crate::db::tables::comms::template_categories::TemplateCategory,
) -> CmdResult<crate::db::tables::comms::template_categories::TemplateCategory> {
    crate::db::tables::comms::template_categories::update(&pool, &data)
        .await
        .map_err(Into::into)
}

// ── Templates — Extended ──

/// Fetch a template by id (returns `None` if absent).
///
/// * `id` — template primary key.
/// * Returns `Some(Template)` when found, `None` when absent.
#[tauri::command]
pub async fn db_get_template_full(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Template> {
    crate::db::tables::comms::templates::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}
