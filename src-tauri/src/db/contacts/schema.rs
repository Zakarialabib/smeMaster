use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── Contact Tags (separate table from contact_labels) ───────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DbContactTag {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub color: Option<String>,
    pub sort_order: i64,
    pub created_at: i64,
}

// ─── Extended contact types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContactWithStats {
    pub id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub frequency: i64,
    pub last_contacted_at: Option<i64>,
    pub first_contacted_at: Option<i64>,
    pub notes: Option<String>,
    pub engagement_score: f64,
    pub last_engaged_at: Option<i64>,
    pub health_status: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub task_count: i64,
    pub email_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct IdEmailPair {
    pub id: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct IdOnly {
    pub contact_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactEngagementData {
    pub last_contacted_at: Option<i64>,
    pub email_count: i64,
    pub recent_email_count: i64,
    pub reply_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EngagementTrendPoint {
    pub date: String,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DailyCount {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ActivityEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub date: i64,
    pub summary: String,
    pub id: String,
}

// ─── CRM ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Contact {
    pub id: String,
    pub company_id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub frequency: i64,
    pub last_contacted_at: Option<i64>,
    pub first_contacted_at: Option<i64>,
    pub notes: Option<String>,
    pub engagement_score: f64,
    pub last_engaged_at: Option<i64>,
    pub health_status: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContactLabel {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub color: Option<String>,
    pub sort_order: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContactGroup {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EntityPivot {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub pivot_type: String,
    pub pivot_id: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContactSegment {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub query: String,
    pub is_dynamic: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EngagementLog {
    pub id: String,
    pub contact_id: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub event_type: String,
    pub score_delta: f64,
    pub metadata_json: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContactFile {
    pub id: String,
    pub company_id: String,
    pub contact_id: Option<String>,
    pub filename: String,
    pub original_name: String,
    pub mime_type: Option<String>,
    pub size: Option<i64>,
    pub category: String,
    pub starred: i64,
    pub sender_email: Option<String>,
    pub message_id: Option<String>,
    pub local_path: Option<String>,
    pub created_at: i64,
}
