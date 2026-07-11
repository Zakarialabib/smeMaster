use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── Core ───────────────────────────────────────────────────────────────────

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Company {
    pub id: String,
    pub name: String,
    pub legal_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub postal_code: Option<String>,
    pub country: Option<String>,
    pub website: Option<String>,
    pub industry: Option<String>,
    pub timezone: String,
    pub logo_url: Option<String>,
    pub settings_json: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Account {
    pub id: String,
    pub company_id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub access_token: Option<String>,  // encrypted
    pub refresh_token: Option<String>, // encrypted
    pub token_expires_at: Option<i64>,
    pub history_id: Option<String>,
    pub last_sync_at: Option<i64>,
    pub is_active: i64, // 0/1
    pub provider: String,
    pub provider_type: Option<String>,
    pub sync_state: String,
    pub imap_host: Option<String>,
    pub imap_port: Option<i64>,
    pub imap_security: Option<String>,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<i64>,
    pub smtp_security: Option<String>,
    pub auth_method: String,
    pub imap_password: Option<String>, // encrypted
    pub imap_username: Option<String>,
    pub oauth_provider: Option<String>,
    pub oauth_client_id: Option<String>,
    pub oauth_client_secret: Option<String>, // encrypted
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>, // encrypted
    pub metadata_json: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OAuthToken {
    pub id: String,
    pub account_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_at: i64,
    pub scope: String,
    pub created_at: i64,
    pub refreshed_at: Option<i64>,
}
