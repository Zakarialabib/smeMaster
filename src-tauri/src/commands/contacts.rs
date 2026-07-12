// ── Contacts / CRM Commands ────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use tauri::State;
use tauri::Manager;
use sqlx::SqlitePool;
use crate::commands::tasks::ContactCountRow;
use crate::db::commands::UpdateFields;
use crate::db::error::AppDbError;
use crate::db::contacts::schema::{
    DbContactTag, ContactLabel, ContactGroup, Contact, ContactSegment,
    ContactFile, IdOnly, IdEmailPair, EngagementTrendPoint, EngagementLog,
    EntityPivot, ActivityEvent, ContactWithStats, ContactEngagementData, DailyCount,
};
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

// ── Request types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertContactRequest {
    pub id: Option<String>,
    pub company_id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub notes: Option<String>,
    pub frequency: Option<i64>,
    pub last_contacted_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupRequest {
    pub company_id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLabelRequest {
    pub company_id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSegmentRequest {
    pub company_id: String,
    pub name: String,
    pub query: String,
    pub is_dynamic: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEngagementRequest {
    pub contact_id: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub event_type: String,
    pub score_delta: f64,
    pub metadata_json: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ContactStats {
    pub total_emails: i64,
    pub total_meetings: i64,
    pub total_calls: i64,
    pub last_interaction: Option<i64>,
    pub engagement_trend: String,
}

impl From<UpsertContactRequest> for Contact {
    fn from(r: UpsertContactRequest) -> Self {
        let now = chrono::Utc::now().timestamp();
        Contact {
            id: r.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            company_id: String::new(), // TODO: set from context
            email: r.email,
            display_name: r.display_name,
            avatar_url: r.avatar_url,
            frequency: r.frequency.unwrap_or(1),
            last_contacted_at: r.last_contacted_at,
            first_contacted_at: None,
            notes: r.notes,
            engagement_score: 0.0,
            last_engaged_at: None,
            health_status: "cold".to_string(),
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ContactAttachment {
    pub id: String,
    pub filename: String,
    pub mime_type: Option<String>,
    pub size: Option<i64>,
    pub created_at: i64,
}

#[derive(Debug, Serialize)]
pub struct SameDomainContact {
    pub id: String,
    pub name: Option<String>,
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct RecentThreadResult {
    pub thread_id: String,
    pub subject: Option<String>,
    pub last_message_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactEngagementInput {
    pub days_since_last_contact: i64,
    pub contacts_last_30d: i64,
    pub replies_sent: i64,
    pub emails_received: i64,
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn db_dashboard_contacts_total(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    crate::db::tables::crm::contacts::count_all(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_dashboard_contacts_active(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    crate::db::tables::crm::contacts::count_active(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_dashboard_contacts_new_week(
    pool: State<'_, SqlitePool>,
) -> CmdResult<i64> {
    crate::db::tables::crm::contacts::count_new_week(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_dashboard_recent_activity(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<EngagementLog>> {
    crate::db::tables::crm::engagement_log::list_recent(&pool, 20)
        .await
        .map_err(Into::into)
}

/// Daily email volume (sent + received) for the last 30 days — for dashboard chart.
#[tauri::command]
pub async fn db_dashboard_email_volume(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<EngagementTrendPoint>> {
    let cutoff = chrono::Utc::now().timestamp() - 30 * 86400;
    let rows = sqlx::query_as::<_, EngagementTrendPoint>(
        "SELECT date(created_at, 'unixepoch') as date, CAST(COUNT(*) AS REAL) as score \
         FROM engagement_log \
         WHERE event_type IN ('email_sent', 'email_received') AND created_at >= ? \
         GROUP BY date(created_at, 'unixepoch') \
         ORDER BY date ASC",
    )
    .bind(cutoff)
    .fetch_all(&*pool)
    .await
    .map_err(|e| SerializedError::from(AppDbError::Database(e)))?;
    Ok(rows)
}

/// Weekly contact signups for the last 12 weeks — for dashboard chart.
#[tauri::command]
pub async fn db_dashboard_contact_growth(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<EngagementTrendPoint>> {
    let cutoff = chrono::Utc::now().timestamp() - 84 * 86400;
    let rows = sqlx::query_as::<_, EngagementTrendPoint>(
        "SELECT strftime('%Y-W%W', created_at, 'unixepoch') as date, CAST(COUNT(*) AS REAL) as score \
         FROM contacts \
         WHERE created_at >= ? \
         GROUP BY strftime('%Y-W%W', created_at, 'unixepoch') \
         ORDER BY date ASC",
    )
    .bind(cutoff)
    .fetch_all(&*pool)
    .await
    .map_err(|e| SerializedError::from(AppDbError::Database(e)))?;
    Ok(rows)
}

/// Daily email volume aggregated by day for the past N days — for GitHub-style heatmap.
#[tauri::command]
pub async fn db_dashboard_email_heatmap(
    pool: State<'_, SqlitePool>,
    days: Option<i64>,
) -> CmdResult<Vec<DailyCount>> {
    let days = days.unwrap_or(365);
    crate::db::tables::crm::engagement_log::get_daily_counts(&pool, days)
        .await
        .map_err(Into::into)
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAMING MISMATCH ALIASES / CONTACT DETAIL QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn db_get_contact_count_for_group(
    pool: State<'_, SqlitePool>,
    group_id: String,
) -> CmdResult<i64> {
    crate::db::tables::crm::contact_groups::get_member_count(&pool, &group_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_contact_campaigns(
    pool: State<'_, SqlitePool>,
    contact_id: String,
) -> CmdResult<i64> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM campaign_recipients WHERE contact_id = ?"
    )
    .bind(&contact_id)
    .fetch_one(&*pool)
    .await
    .map_err(|e| crate::error::SerializedError::from(crate::db::error::AppDbError::Database(e)))?;
    Ok(row.0)
}

#[tauri::command]
pub async fn db_contact_email_count(
    pool: State<'_, SqlitePool>,
    _contact_id: String,
    email: Option<String>,
) -> CmdResult<i64> {
    if let Some(e) = email {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM messages WHERE from_address = ? OR to_addresses LIKE ?"
        )
        .bind(&e)
        .bind(format!("%{}%", &e))
        .fetch_one(&*pool)
        .await
        .map_err(|e2| crate::error::SerializedError::from(crate::db::error::AppDbError::Database(e2)))?;
        Ok(row.0)
    } else {
        Ok(0)
    }
}

#[tauri::command]
pub async fn db_contact_file_count(
    pool: State<'_, SqlitePool>,
    contact_id: String,
) -> CmdResult<i64> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM contact_files WHERE contact_id = ?"
    )
    .bind(&contact_id)
    .fetch_one(&*pool)
    .await
    .map_err(|e| crate::error::SerializedError::from(crate::db::error::AppDbError::Database(e)))?;
    Ok(row.0)
}

#[tauri::command]
pub async fn db_contact_groups(
    pool: State<'_, SqlitePool>,
    contact_id: String,
) -> CmdResult<Vec<ContactGroup>> {
    crate::db::tables::crm::contact_groups::get_by_contact_id(&pool, &contact_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_contact_tags(
    pool: State<'_, SqlitePool>,
    contact_id: String,
) -> CmdResult<Vec<DbContactTag>> {
    let tags = sqlx::query_as::<_, DbContactTag>(
        "SELECT ct.* FROM contact_tags ct INNER JOIN entity_pivots et ON ct.id = et.tag_id WHERE et.entity_id = ? AND et.entity_type = 'contact'"
    )
    .bind(&contact_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e| crate::error::SerializedError::from(crate::db::error::AppDbError::Database(e)))?;
    Ok(tags)
}

#[tauri::command]
pub async fn db_contact_workflow_rule_count(
    pool: State<'_, SqlitePool>,
    contact_id: String,
) -> CmdResult<i64> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM workflow_rules WHERE id IN (SELECT DISTINCT workflow_config_json ->> '$.rule_id' FROM tasks WHERE contact_id = ? AND workflow_config_json IS NOT NULL)"
    )
    .bind(&contact_id)
    .fetch_one(&*pool)
    .await
    .map_err(|e| crate::error::SerializedError::from(crate::db::error::AppDbError::Database(e)))?;
    Ok(row.0)
}

// ═══════════════════════════════════════════════════════════════════════════════

// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
//     builder
// }

// ═══════════════════════════════════════════════════════════════════════════════
// CRM DOMAIN
// ═══════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn db_list_contacts(
    pool: State<'_, SqlitePool>,
    limit: i64,
    offset: i64,
    sort_by: Option<String>,
    search_query: Option<String>,
) -> CmdResult<Vec<Contact>> {
    crate::db::tables::crm::contacts::list(&pool, limit, offset, sort_by.as_deref(), search_query.as_deref())
        .await
        .map_err(Into::into)
}

#[derive(Debug, Serialize)]
pub struct CountRow {
    pub count: i64,
}

#[tauri::command]
pub async fn db_count_contacts(
    pool: State<'_, SqlitePool>,
    search_query: Option<String>,
) -> CmdResult<Vec<CountRow>> {
    let count = crate::db::tables::crm::contacts::count_with_search(
        &pool, search_query.as_deref()
    ).await?;
    Ok(vec![CountRow { count }])
}

#[tauri::command]
pub async fn db_get_contact(
    app: tauri::AppHandle,
    pool: State<'_, SqlitePool>,
    contact_id: String,
    use_cache: Option<bool>,
) -> CmdResult<Contact> {
    if use_cache.unwrap_or(false) {
        if let Some(cache_service) = app.try_state::<std::sync::Arc<crate::data_cache::DataCacheService>>() {
            if let Some(contact) = cache_service.get_contacts_cache().get(&contact_id).await {
                return Ok(contact);
            }
        }
    }
    crate::db::tables::crm::contacts::get_by_id(&pool, &contact_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contact_by_email(
    pool: State<'_, SqlitePool>,
    email: String,
) -> CmdResult<Option<Contact>> {
    crate::db::tables::crm::contacts::get_by_email(&pool, &email)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_contact(
    pool: State<'_, SqlitePool>,
    contact: UpsertContactRequest,
) -> CmdResult<Contact> {
    crate::db::tables::crm::contacts::upsert(&pool, contact)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_contact(
    pool: State<'_, SqlitePool>,
    id: String,
    fields: UpdateFields,
) -> CmdResult<()> {
    crate::db::tables::crm::contacts::update_fields(&pool, &id, &fields)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_contact(pool: State<'_, SqlitePool>, id: String) -> CmdResult<()> {
    crate::db::tables::crm::contacts::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contact_stats(
    pool: State<'_, SqlitePool>,
    email: String,
) -> CmdResult<ContactStats> {
    crate::db::tables::crm::contacts::get_stats(&pool, &email)
        .await
        .map_err(Into::into)
}

// ── Contact Labels ──

#[tauri::command]
pub async fn db_get_contact_label_by_id(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<ContactLabel> {
    crate::db::tables::crm::contact_labels::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_contact_labels(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<ContactLabel>> {
    crate::db::tables::crm::contact_labels::list(&pool, &company_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_contact_label(
    pool: State<'_, SqlitePool>,
    label: CreateLabelRequest,
) -> CmdResult<ContactLabel> {
    crate::db::tables::crm::contact_labels::create(
        &pool,
        &label.name,
        &label.company_id,
        label.color.as_deref(),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_contact_label(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_labels::delete_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

// ── Contact Groups ──

#[tauri::command]
pub async fn db_list_contact_groups(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<ContactGroup>> {
    crate::db::tables::crm::contact_groups::list(&pool, &company_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_contact_group(
    pool: State<'_, SqlitePool>,
    group: CreateGroupRequest,
) -> CmdResult<ContactGroup> {
    crate::db::tables::crm::contact_groups::create(
        &pool,
        &group.company_id,
        &group.name,
        group.description.as_deref(),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_add_contact_to_group(
    pool: State<'_, SqlitePool>,
    contact_id: String,
    group_id: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_groups::add_member(&pool, &contact_id, &group_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_remove_contact_from_group(
    pool: State<'_, SqlitePool>,
    contact_id: String,
    group_id: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_groups::remove_member(&pool, &contact_id, &group_id)
        .await
        .map_err(Into::into)
}

// ── Entity Pivots ──

#[tauri::command]
pub async fn db_add_entity_link(
    pool: State<'_, SqlitePool>,
    entity_type: String,
    entity_id: String,
    pivot_type: String,
    pivot_id: String,
) -> CmdResult<()> {
    crate::db::tables::crm::entity_pivots::add(&pool, &entity_type, &entity_id, &pivot_type, &pivot_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_remove_entity_link(
    pool: State<'_, SqlitePool>,
    entity_type: String,
    entity_id: String,
    pivot_type: String,
    pivot_id: String,
) -> CmdResult<()> {
    crate::db::tables::crm::entity_pivots::remove(&pool, &entity_type, &entity_id, &pivot_type, &pivot_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_linked_entities(
    pool: State<'_, SqlitePool>,
    entity_type: String,
    entity_id: String,
) -> CmdResult<Vec<EntityPivot>> {
    crate::db::tables::crm::entity_pivots::get_for_entity(&pool, &entity_type, &entity_id)
        .await
        .map_err(Into::into)
}

// ── Contact Segments ──

#[tauri::command]
pub async fn db_list_segments(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<ContactSegment>> {
    crate::db::tables::crm::contact_segments::list(&pool, &company_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_segment(
    pool: State<'_, SqlitePool>,
    segment: CreateSegmentRequest,
) -> CmdResult<ContactSegment> {
    crate::db::tables::crm::contact_segments::create(
        &pool,
        &segment.company_id,
        &segment.name,
        &segment.query,
        segment.is_dynamic.unwrap_or(false),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_execute_segment_query(
    pool: State<'_, SqlitePool>,
    segment_id: String,
) -> CmdResult<Vec<Contact>> {
    crate::db::tables::crm::contact_segments::execute(&pool, &segment_id)
        .await
        .map_err(Into::into)
}

// ── Engagement Log ──

#[tauri::command]
pub async fn db_log_engagement(
    pool: State<'_, SqlitePool>,
    event: LogEngagementRequest,
) -> CmdResult<()> {
    crate::db::tables::crm::engagement_log::log(
        &pool,
        event.entity_type.as_deref(),
        event.entity_id.as_deref(),
        event.contact_id.as_deref(),
        &event.event_type,
        event.score_delta,
        event.metadata_json.as_deref(),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_engagement_history(
    pool: State<'_, SqlitePool>,
    contact_id: String,
    limit: i64,
) -> CmdResult<Vec<EngagementLog>> {
    crate::db::tables::crm::engagement_log::get_history(&pool, &contact_id, limit)
        .await
        .map_err(Into::into)
}

// ── Contact Files ──

#[tauri::command]
pub async fn db_get_contact_files(
    pool: State<'_, SqlitePool>,
    contact_id: String,
) -> CmdResult<Vec<ContactFile>> {
    crate::db::tables::crm::contact_files::get_by_contact(&pool, &contact_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_search_contact_files(
    pool: State<'_, SqlitePool>,
    query: String,
) -> CmdResult<Vec<ContactFile>> {
    crate::db::tables::crm::contact_files::search(&pool, &query)
        .await
        .map_err(Into::into)
}

// ── Contact Files (get by id) ──

#[tauri::command]
pub async fn db_get_contact_file_by_id(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Option<ContactFile>> {
    crate::db::tables::crm::contact_files::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_contact_file_struct(
    pool: State<'_, SqlitePool>,
    file: ContactFile,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_files::create(&pool, &file)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_contact_file_by_id(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_files::delete_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

// ── Contact Files (extended) ──

#[tauri::command]
pub async fn db_create_contact_file(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: String,
    contact_id: Option<String>,
    filename: String,
    original_name: String,
    mime_type: Option<String>,
    size: Option<i64>,
    category: String,
    sender_email: Option<String>,
    message_id: Option<String>,
    local_path: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_files::create_file(
        &pool, &id, &company_id, contact_id.as_deref(),
        &filename, &original_name, mime_type.as_deref(),
        size, &category, sender_email.as_deref(),
        message_id.as_deref(), &local_path,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contact_files_by_sender(
    pool: State<'_, SqlitePool>,
    sender_email: String,
) -> CmdResult<Vec<ContactFile>> {
    crate::db::tables::crm::contact_files::get_by_sender(&pool, &sender_email)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contact_files_by_account(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<ContactFile>> {
    crate::db::tables::crm::contact_files::get_by_account(&pool, &company_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contact_files_by_category(
    pool: State<'_, SqlitePool>,
    company_id: String,
    category: String,
) -> CmdResult<Vec<ContactFile>> {
    crate::db::tables::crm::contact_files::get_by_category(&pool, &company_id, &category)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contact_file_categories(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<String>> {
    crate::db::tables::crm::contact_files::get_categories(&pool, &company_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_contact_file_category(
    pool: State<'_, SqlitePool>,
    id: String,
    category: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_files::update_category(&pool, &id, &category)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_toggle_contact_file_starred(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_files::toggle_starred(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_contact_file(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Option<String>> {
    crate::db::tables::crm::contact_files::delete_file(&pool, &id)
        .await
        .map_err(Into::into)
}

// ── Contact Tags ──

#[tauri::command]
pub async fn db_get_contact_tag_by_id(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Option<DbContactTag>> {
    crate::db::tables::crm::contact_tags::get_tag_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_contact_tag(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: String,
    name: String,
    color: Option<String>,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_tags::upsert_tag(
        &pool, &id, &company_id, &name, color.as_deref(),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contact_count_for_tag(
    pool: State<'_, SqlitePool>,
    tag_id: String,
) -> CmdResult<i64> {
    crate::db::tables::crm::contact_tags::contact_count_for_tag(&pool, &tag_id)
        .await
        .map_err(Into::into)
}

// ── Contact Groups (get by id) ──

#[tauri::command]
pub async fn db_get_contact_group_by_id(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<ContactGroup> {
    crate::db::tables::crm::contact_groups::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_contact_group_by_id(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_groups::delete_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contact_group_full_members(
    pool: State<'_, SqlitePool>,
    group_id: String,
) -> CmdResult<Vec<Contact>> {
    crate::db::tables::crm::contact_groups::get_members(&pool, &group_id)
        .await
        .map_err(Into::into)
}

// ── Contact Groups (extended) ──

#[tauri::command]
pub async fn db_upsert_contact_group(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: String,
    name: String,
    description: Option<String>,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_groups::upsert_group(
        &pool, &id, &company_id, &name, description.as_deref(),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_contact_group(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_groups::delete_group(&pool, &id, &company_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contact_group_member_count(
    pool: State<'_, SqlitePool>,
    group_id: String,
) -> CmdResult<i64> {
    crate::db::tables::crm::contact_groups::get_member_count(&pool, &group_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contact_group_members(
    pool: State<'_, SqlitePool>,
    group_id: String,
) -> CmdResult<Vec<IdOnly>> {
    crate::db::tables::crm::contact_groups::get_group_members(&pool, &group_id)
        .await
        .map_err(Into::into)
}

// ── Contact Segments (delete by id) ──

#[tauri::command]
pub async fn db_delete_contact_segment_by_id(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_segments::delete_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

// ── Contact Segments (extended) ──

#[tauri::command]
pub async fn db_upsert_segment(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: String,
    name: String,
    query: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_segments::upsert_segment(
        &pool, &id, &company_id, &name, &query,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_segment(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contact_segments::delete_segment(&pool, &id, &company_id)
        .await
        .map_err(Into::into)
}

// ── Contacts (extended queries) ──

#[tauri::command]
pub async fn db_search_contacts(
    pool: State<'_, SqlitePool>,
    query: String,
    limit: i64,
) -> CmdResult<Vec<Contact>> {
    crate::db::tables::crm::contacts::search_contacts(&pool, &query, limit)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contact_with_stats(
    pool: State<'_, SqlitePool>,
    contact_id: String,
) -> CmdResult<Option<ContactWithStats>> {
    crate::db::tables::crm::contacts::get_with_stats(&pool, &contact_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_update_contact_score(
    pool: State<'_, SqlitePool>,
    contact_id: String,
    score: f64,
    last_engaged_at: i64,
    health_status: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contacts::update_score(
        &pool, &contact_id, score, last_engaged_at, &health_status,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contacts_needing_score_update(
    pool: State<'_, SqlitePool>,
    cutoff_hours: i64,
    limit: i64,
) -> CmdResult<Vec<IdEmailPair>> {
    crate::db::tables::crm::contacts::get_needing_score_update(&pool, cutoff_hours, limit)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_contact_engagement_data(
    pool: State<'_, SqlitePool>,
    email: String,
    thirty_days_ago: i64,
) -> CmdResult<ContactEngagementData> {
    crate::db::tables::crm::contacts::get_engagement_data(&pool, &email, thirty_days_ago)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_merge_contacts(
    pool: State<'_, SqlitePool>,
    keep_id: String,
    merge_id: String,
) -> CmdResult<()> {
    crate::db::tables::crm::contacts::merge_contacts(&pool, &keep_id, &merge_id)
        .await
        .map_err(Into::into)
}

// ── Engagement Log (get by entity) ──

#[tauri::command]
pub async fn db_get_engagement_by_entity(
    pool: State<'_, SqlitePool>,
    entity_type: String,
    entity_id: String,
    limit: i64,
) -> CmdResult<Vec<EngagementLog>> {
    crate::db::tables::crm::engagement_log::get_by_entity(&pool, &entity_type, &entity_id, limit)
        .await
        .map_err(Into::into)
}

// ── Engagement Log (extended) ──

#[tauri::command]
pub async fn db_get_engagement_trend(
    pool: State<'_, SqlitePool>,
    contact_id: String,
    cutoff: i64,
) -> CmdResult<Vec<EngagementTrendPoint>> {
    crate::db::tables::crm::engagement_log::get_engagement_trend(&pool, &contact_id, cutoff)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_engagement_for_entity(
    pool: State<'_, SqlitePool>,
    entity_type: String,
    entity_id: String,
    cutoff: Option<i64>,
) -> CmdResult<Vec<EngagementLog>> {
    crate::db::tables::crm::engagement_log::get_engagement_for_entity(
        &pool, &entity_type, &entity_id, cutoff,
    )
    .await
    .map_err(Into::into)
}

// ── Entity Graph ──

#[tauri::command]
pub async fn db_get_entity_graph(
    pool: State<'_, SqlitePool>,
    depth: Option<i64>,
) -> CmdResult<crate::db::tables::crm::entity_pivots::GraphData> {
    crate::db::tables::crm::entity_pivots::get_entity_graph(&pool, depth.unwrap_or(2))
        .await
        .map_err(Into::into)
}

// ── Entity Pivots (get by pivot) ──

#[tauri::command]
pub async fn db_get_entity_pivots_by_pivot(
    pool: State<'_, SqlitePool>,
    pivot_type: String,
    pivot_id: String,
) -> CmdResult<Vec<EntityPivot>> {
    crate::db::tables::crm::entity_pivots::get_by_pivot(&pool, &pivot_type, &pivot_id)
        .await
        .map_err(Into::into)
}

// ── Activity ──

#[tauri::command]
pub async fn db_get_contact_activity(
    pool: State<'_, SqlitePool>,
    company_id: String,
    email: String,
    limit: i64,
) -> CmdResult<Vec<ActivityEvent>> {
    crate::db::tables::crm::activity::get_contact_activity(&pool, &company_id, &email, limit)
        .await
        .map_err(Into::into)
}

// ── Contact Extended Queries ──

#[tauri::command]
pub async fn db_get_attachments_from_contact(
    pool: State<'_, SqlitePool>,
    email: String,
    limit: Option<i64>,
) -> CmdResult<Vec<ContactAttachment>> {
    let limit = limit.unwrap_or(20);
    let rows = sqlx::query_as::<_, (String, String, Option<String>, Option<i64>, i64)>(
        "SELECT a.id, a.filename, a.mime_type, a.size, a.created_at FROM attachments a JOIN messages m ON a.message_id = m.id WHERE m.from_address = ?1 ORDER BY a.created_at DESC LIMIT ?2"
    ).bind(&email).bind(limit).fetch_all(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    Ok(rows.into_iter().map(|(id, filename, mime, size, created)| ContactAttachment { id, filename, mime_type: mime, size, created_at: created }).collect())
}

#[tauri::command]
pub async fn db_get_contacts_from_same_domain(
    pool: State<'_, SqlitePool>,
    email: String,
    limit: Option<i64>,
) -> CmdResult<Vec<SameDomainContact>> {
    let limit = limit.unwrap_or(20);
    let domain = email.split('@').nth(1).unwrap_or("").to_string();
    let pattern = format!("%@{}", domain);
    let rows = sqlx::query_as::<_, (String, Option<String>, String)>(
        "SELECT id, name, primary_email FROM contacts WHERE primary_email LIKE ?1 AND primary_email != ?2 LIMIT ?3"
    ).bind(&pattern).bind(&email).bind(limit).fetch_all(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    Ok(rows.into_iter().map(|(id, name, email)| SameDomainContact { id, name, email }).collect())
}

#[tauri::command]
pub async fn db_get_latest_auth_result(
    pool: State<'_, SqlitePool>,
    email: String,
) -> CmdResult<Option<String>> {
    let result: Option<(String,)> = sqlx::query_as(
        "SELECT auth_result FROM messages WHERE from_address = ?1 AND auth_result IS NOT NULL ORDER BY internal_date DESC LIMIT 1"
    ).bind(&email).fetch_optional(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    Ok(result.map(|r| r.0))
}

#[tauri::command]
pub async fn db_get_recent_threads_with_contact(
    pool: State<'_, SqlitePool>,
    email: String,
    limit: Option<i64>,
) -> CmdResult<Vec<RecentThreadResult>> {
    let limit = limit.unwrap_or(10);
    let rows = sqlx::query_as::<_, (String, Option<String>, i64)>(
        "SELECT t.id, t.subject, MAX(m.internal_date) as last_msg FROM threads t JOIN messages m ON m.thread_id = t.id AND m.account_id = t.account_id WHERE (m.from_address = ?1 OR m.to_address LIKE ?2) GROUP BY t.id ORDER BY last_msg DESC LIMIT ?3"
    ).bind(&email).bind(format!("%{}%", email)).bind(limit)
    .fetch_all(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    Ok(rows.into_iter().map(|(tid, sub, ts)| RecentThreadResult { thread_id: tid, subject: sub, last_message_at: ts }).collect())
}

// ── Misc CRM Count Queries ──

#[tauri::command]
pub async fn db_campaign_recipients_count_by_contact(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<ContactCountRow>> {
    #[derive(sqlx::FromRow, Debug, Serialize)]
    struct Row { contact_id: String, cnt: i64 }
    let rows = sqlx::query_as::<_, Row>(
        "SELECT contact_id, COUNT(*) as cnt FROM campaign_recipients GROUP BY contact_id"
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;
    Ok(rows.into_iter().map(|r| ContactCountRow { contact_id: r.contact_id, cnt: r.cnt }).collect())
}

#[tauri::command]
pub async fn db_contact_files_count_by_contact(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<ContactCountRow>> {
    #[derive(sqlx::FromRow, Debug, Serialize)]
    struct Row { contact_id: String, cnt: i64 }
    let rows = sqlx::query_as::<_, Row>(
        "SELECT contact_id, COUNT(*) as cnt FROM contact_files WHERE contact_id IS NOT NULL GROUP BY contact_id"
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;
    Ok(rows.into_iter().map(|r| ContactCountRow { contact_id: r.contact_id, cnt: r.cnt }).collect())
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT SCORING & ENGAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn db_batch_update_contact_scores(
    pool: State<'_, SqlitePool>,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    let thirty_days_ago = now - 30 * 86400;
    let ninety_days_ago = now - 90 * 86400;

    sqlx::query(
        "UPDATE contacts SET
            engagement_score = ROUND(
                LEAST(100.0, GREATEST(0.0,
                    COALESCE((
                        SELECT SUM(score_delta)
                        FROM engagement_log
                        WHERE engagement_log.contact_id = contacts.id
                        AND created_at >= ?
                    ), 0.0)
                )), 1
            ),
            last_engaged_at = (
                SELECT MAX(created_at) FROM engagement_log WHERE engagement_log.contact_id = contacts.id
            ),
            health_status = CASE
                WHEN COALESCE((
                    SELECT MAX(created_at) FROM engagement_log WHERE engagement_log.contact_id = contacts.id
                ), 0) >= ? THEN 'hot'
                WHEN COALESCE((
                    SELECT MAX(created_at) FROM engagement_log WHERE engagement_log.contact_id = contacts.id
                ), 0) >= ? THEN 'warm'
                ELSE 'cold'
            END,
            updated_at = ?
        WHERE id IS NOT NULL",
    )
    .bind(ninety_days_ago)
    .bind(thirty_days_ago)
    .bind(ninety_days_ago)
    .bind(now)
    .execute(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;

    Ok(())
}

#[tauri::command]
pub async fn db_create_dynamic_segment(
    pool: State<'_, SqlitePool>,
    company_id: String,
    name: String,
    query: String,
) -> CmdResult<String> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO dynamic_segments (id, company_id, name, query, refreshed_at) VALUES (?, ?, ?, ?, NULL)",
    )
    .bind(&id)
    .bind(&company_id)
    .bind(&name)
    .bind(&query)
    .execute(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;
    Ok(id)
}

#[tauri::command]
pub async fn db_delete_dynamic_segment(
    pool: State<'_, SqlitePool>,
    id: String,
    company_id: String,
) -> CmdResult<()> {
    let rows = sqlx::query("DELETE FROM dynamic_segments WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .execute(&*pool)
        .await
        .map_err(|e| AppDbError::Database(e))?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("DynamicSegment {id}")).into());
    }
    Ok(())
}

#[tauri::command]
pub async fn db_update_dynamic_segment_refresh(
    pool: State<'_, SqlitePool>,
    segment_id: String,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query("UPDATE dynamic_segments SET refreshed_at = ? WHERE id = ?")
        .bind(now)
        .bind(&segment_id)
        .execute(&*pool)
        .await
        .map_err(|e| AppDbError::Database(e))?;
    Ok(())
}

#[tauri::command]
pub async fn db_get_engagement_data_for_contact(
    pool: State<'_, SqlitePool>,
    email: String,
) -> CmdResult<ContactEngagementInput> {
    let now = chrono::Utc::now().timestamp();
    let thirty_days_ago = now - 30 * 86400;

    let last_contact: Option<(Option<i64>,)> = sqlx::query_as(
        "SELECT last_contacted_at FROM contacts WHERE email = ?",
    )
    .bind(&email)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;

    let days_since = match last_contact.and_then(|r| r.0) {
        Some(ts) => (now - ts) / 86400,
        None => 999,
    };

    let emails_received: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM messages WHERE from_address = ? AND date >= ?",
    )
    .bind(&email)
    .bind(thirty_days_ago)
    .fetch_one(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;

    let replies_sent: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM messages WHERE to_addresses LIKE ? AND date >= ?",
    )
    .bind(format!("%{}%", &email))
    .bind(thirty_days_ago)
    .fetch_one(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;

    let contacts_last_30d: (i64,) = sqlx::query_as(
        "SELECT COUNT(DISTINCT from_address) FROM messages WHERE date >= ? AND from_address != ?",
    )
    .bind(thirty_days_ago)
    .bind(&email)
    .fetch_one(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;

    Ok(ContactEngagementInput {
        days_since_last_contact: days_since,
        contacts_last_30d: contacts_last_30d.0,
        replies_sent: replies_sent.0,
        emails_received: emails_received.0,
    })
}
