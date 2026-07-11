use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── Calendar ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Calendar {
    pub id: String,
    pub company_id: String,
    pub provider: String,
    pub remote_id: String,
    pub display_name: Option<String>,
    pub color: Option<String>,
    pub is_primary: i64,
    pub is_visible: i64,
    pub sync_token: Option<String>,
    pub ctag: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CalendarEvent {
    pub id: String,
    pub company_id: String,
    pub calendar_id: Option<String>,
    pub google_event_id: String,
    pub remote_event_id: Option<String>,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: i64,
    pub end_time: i64,
    pub is_all_day: i64,
    pub status: String,
    pub organizer_email: Option<String>,
    pub attendees_json: Option<String>,
    pub html_link: Option<String>,
    pub etag: Option<String>,
    pub ical_data: Option<String>,
    pub uid: Option<String>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SnoozePreset {
    pub id: String,
    pub company_id: String,
    pub label: String,
    pub duration_minutes: i64,
    pub is_recurring: i64,
    pub sort_order: i64,
    pub created_at: i64,
}
