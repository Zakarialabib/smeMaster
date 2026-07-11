use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── Vault Items ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct VaultItem {
    pub id: String,
    pub company_id: String,
    pub relative_path: String,
    pub file_name: String,
    pub extension: Option<String>,
    pub category: String,
    pub file_size: i64,
    pub is_dir: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub checksum: Option<String>,
}
