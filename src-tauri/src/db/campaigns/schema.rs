use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── Campaigns ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Campaign {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub template_id: Option<String>,
    pub segment_id: Option<String>,
    pub status: String,
    pub sent_count: i64,
    pub sent_at: Option<i64>,
    pub ab_test_config: Option<String>,
    pub analytics_json: Option<String>,
    pub scheduled_at: Option<i64>,
    pub recurring_cron: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CampaignSchedule {
    pub id: String,
    pub campaign_id: String,
    pub scheduled_at: i64,
    pub status: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CampaignRecipient {
    pub campaign_id: String,
    pub contact_id: String,
    pub status: String,
    pub opened_at: Option<i64>,
    pub clicked_at: Option<i64>,
    pub variant: Option<String>,
    pub is_winner: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CampaignRecipientWithCampaign {
    pub campaign_id: String,
    pub campaign_name: String,
    pub campaign_status: String,
    pub sent_at: Option<i64>,
    pub campaign_created_at: i64,
    pub recipient_status: String,
    pub opened_at: Option<i64>,
    pub clicked_at: Option<i64>,
    pub variant: Option<String>,
    pub is_winner: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UtmLink {
    pub id: String,
    pub campaign_id: String,
    pub url: String,
    pub utm_source: Option<String>,
    pub utm_medium: Option<String>,
    pub utm_campaign: Option<String>,
    pub utm_content: Option<String>,
    pub click_count: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UtmClick {
    pub id: String,
    pub link_id: String,
    pub contact_id: String,
    pub clicked_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BackupSchedule {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub format: String,
    pub cron_expression: String,
    pub destination_path: Option<String>,
    pub encrypt: i64,
    pub is_enabled: i64,
    pub last_run_at: Option<i64>,
    pub next_run_at: Option<i64>,
    pub created_at: i64,
}
