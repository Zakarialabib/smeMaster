use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── Security ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PgpKey {
    pub id: String,
    pub account_id: String,
    pub key_id: String,
    pub user_id: String,
    pub public_key: String,
    pub private_key_encrypted: Option<String>,
    pub passphrase_hint: Option<String>,
    pub fingerprint: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Allowlist {
    pub id: String,
    pub account_id: String,
    pub list_type: String,
    pub target: String,
    pub display_name: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LinkScanResult {
    pub message_id: String,
    pub account_id: String,
    pub result_json: String,
    pub scanned_at: i64,
}
