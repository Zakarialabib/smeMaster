use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── Deliverability ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeliverabilityConfig {
    pub id: String,
    pub account_id: String,
    pub config_type: String,
    pub config_json: String,
    pub is_active: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeliverabilityEvent {
    pub id: String,
    pub account_id: String,
    pub event_type: String,
    pub event_data_json: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NewsletterBundle {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub rules_json: String,
    pub thread_ids_json: String,
    pub created_at: i64,
    pub updated_at: i64,
}
