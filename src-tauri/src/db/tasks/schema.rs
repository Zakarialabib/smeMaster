use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── Tasks ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: String,
    pub company_id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: String,
    pub is_completed: i64,
    pub completed_at: Option<i64>,
    pub due_date: Option<i64>,
    pub parent_id: Option<String>,
    pub contact_id: Option<String>,
    pub thread_id: Option<String>,
    pub thread_account_id: Option<String>,
    pub sort_order: i64,
    pub recurrence_rule: Option<String>,
    pub next_recurrence_at: Option<i64>,
    pub tags_json: String,
    pub workflow_config_json: Option<String>,
    pub reminder_config_json: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TaskTag {
    pub tag: String,
    pub company_id: Option<String>,
    pub color: Option<String>,
    pub sort_order: i64,
    pub created_at: i64,
}
