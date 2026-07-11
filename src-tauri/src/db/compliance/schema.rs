use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── Compliance ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ComplianceProfile {
    pub id: String,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub region_hint: String,
    pub rules_json: String,
    pub is_active: i64,
    pub is_default: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ComplianceCheck {
    pub id: String,
    pub company_id: String,
    pub email_draft_id: Option<String>,
    pub campaign_id: Option<String>,
    pub profile_ids: String,
    pub score: f64,
    pub violations_json: Option<String>,
    pub checked_at: i64,
}
