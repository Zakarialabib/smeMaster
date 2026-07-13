use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── Workflows ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct WorkflowRule {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub trigger_event: String,
    pub trigger_conditions: Option<String>,
    pub actions: String,
    pub is_active: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FollowUpReminder {
    pub id: String,
    pub company_id: String,
    pub thread_id: String,
    pub message_id: String,
    pub remind_at: i64,
    pub status: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PendingOperation {
    pub id: String,
    pub company_id: String,
    pub operation_type: String,
    pub resource_id: String,
    pub params: String,
    pub status: String,
    pub retry_count: i64,
    pub max_retries: i64,
    pub next_retry_at: Option<i64>,
    pub error_message: Option<String>,
    pub campaign_id: Option<String>,
    pub hold_until: Option<i64>,
    pub created_at: i64,
}

// ─── Cleanup Rules ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CleanupRule {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub rule_type: String,
    pub condition_json: String,
    pub action: String,
    pub target_folder: Option<String>,
    pub retention_days: Option<i64>,
    pub is_scheduled: i64,
    pub schedule_cron: Option<String>,
    pub last_run_at: Option<i64>,
    pub next_run_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CleanupHistory {
    pub id: String,
    pub company_id: String,
    pub rule_id: Option<String>,
    pub action: String,
    pub thread_count: i64,
    pub message_count: i64,
    pub status: String,
    pub error_message: Option<String>,
    pub executed_at: i64,
}

// ─── Workflow Execution Logs ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct WorkflowExecutionLog {
    pub id: String,
    pub company_id: String,
    pub rule_id: String,
    pub rule_name: Option<String>,
    pub trigger_event: String,
    pub actions_executed: Option<String>,
    pub status: String,
    pub error_message: Option<String>,
    pub executed_at: i64,
}
