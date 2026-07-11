use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── AI ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AiCache {
    pub id: String,
    pub account_id: String,
    pub thread_id: String,
    #[serde(rename = "type")]
    #[sqlx(rename = "type")]
    pub cache_type: String,
    pub content: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AiConfig {
    pub id: String,
    pub account_id: String,
    pub config_type: String,
    pub config_json: String,
    pub is_enabled: i64,
    pub created_at: i64,
    pub updated_at: i64,
}
