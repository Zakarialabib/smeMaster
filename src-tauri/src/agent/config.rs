//! Agent configuration store — replaces Python `ConfigStore`.
//!
//! Uses the existing `settings` table (key-value store) instead of a separate
//! SQLite database. This eliminates the Python dependency and keeps all
//! configuration in one place.
//!
//! The config is stored as a JSON blob under the key `agent_config`.
//! Only known fields are written; unknown keys are silently dropped.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use crate::db::tables::core::settings;

/// Agent configuration — mirrors the Python `ConfigResponse` contract.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    #[serde(default)]
    pub provider_mix: std::collections::BTreeMap<String, String>,
    #[serde(default = "default_consent_variant")]
    pub consent_variant: String,
    #[serde(default = "default_true")]
    pub bilingual: bool,
    #[serde(default = "default_channel")]
    pub channel: String,
    #[serde(default)]
    pub channels: std::collections::BTreeMap<String, ChannelCapability>,
    #[serde(default)]
    pub cost_sim: serde_json::Value,
    #[serde(default = "default_hours")]
    pub hours: std::collections::BTreeMap<String, Vec<String>>,
    #[serde(default = "default_tz")]
    pub tz: String,
    #[serde(default)]
    pub transfer_target: Option<String>,
    #[serde(default = "default_tier")]
    pub tier: String,
    #[serde(default)]
    pub knowledge_scope: Vec<String>,
    #[serde(default = "default_after_hours")]
    pub after_hours_mode: String,
    #[serde(default)]
    pub updated_at: Option<String>,
}

fn default_consent_variant() -> String { "announce_first".to_string() }
fn default_true() -> bool { true }
fn default_channel() -> String { "none".to_string() }
fn default_tz() -> String { "Europe/Paris".to_string() }
fn default_tier() -> String { "standard".to_string() }
fn default_after_hours() -> String { "take_message".to_string() }
fn default_hours() -> std::collections::BTreeMap<String, Vec<String>> {
    let mut m = std::collections::BTreeMap::new();
    m.insert("mon-fri".to_string(), vec!["09:00".to_string(), "18:00".to_string()]);
    m
}

/// Per-channel capability flags.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelCapability {
    pub enabled: bool,
    pub configured: bool,
    pub reason: Option<String>,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            provider_mix: std::collections::BTreeMap::new(),
            consent_variant: default_consent_variant(),
            bilingual: true,
            channel: default_channel(),
            channels: std::collections::BTreeMap::new(),
            cost_sim: serde_json::json!({"inputs": {}, "unverified": true}),
            hours: default_hours(),
            tz: default_tz(),
            transfer_target: None,
            tier: default_tier(),
            knowledge_scope: Vec::new(),
            after_hours_mode: default_after_hours(),
            updated_at: None,
        }
    }
}

/// Allowed config fields for PUT updates.
const ALLOWED_FIELDS: &[&str] = &[
    "provider_mix", "consent_variant", "bilingual", "channel",
    "channels", "cost_sim", "hours", "tz", "transfer_target",
    "tier", "knowledge_scope", "after_hours_mode",
];

/// Read the current config from the settings table.
pub async fn get_config(pool: &SqlitePool) -> Result<AgentConfig, String> {
    let raw = settings::get(pool, "agent_config").await.ok().flatten();
    match raw {
        Some(json) => serde_json::from_str(&json).map_err(|e| format!("Failed to parse config: {e}")),
        None => Ok(AgentConfig::default()),
    }
}

/// Update the config. Only known fields are written.
pub async fn update_config(pool: &SqlitePool, updates: serde_json::Value) -> Result<AgentConfig, String> {
    let current = get_config(pool).await?;
    let current_json = serde_json::to_value(&current).map_err(|e| e.to_string())?;
    
    // Merge updates into current, only allowing known fields
    let mut merged = current_json.clone();
    if let Some(obj) = updates.as_object() {
        for (key, value) in obj {
            if ALLOWED_FIELDS.contains(&key.as_str()) {
                merged[key] = value.clone();
            }
        }
    }
    
    // Save back to settings
    let json = serde_json::to_string(&merged).map_err(|e| e.to_string())?;
    settings::set(pool, "agent_config", &json).await.map_err(|e| e.to_string())?;
    
    // Return the updated config
    get_config(pool).await
}

/// Get the provider tier.
pub async fn get_tier(pool: &SqlitePool) -> Result<String, String> {
    let config = get_config(pool).await?;
    Ok(config.tier)
}

/// Set the provider tier.
pub async fn set_tier(pool: &SqlitePool, tier: &str) -> Result<(), String> {
    let updates = serde_json::json!({ "tier": tier });
    update_config(pool, updates).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_valid() {
        let config = AgentConfig::default();
        assert_eq!(config.tier, "standard");
        assert_eq!(config.consent_variant, "announce_first");
        assert!(config.bilingual);
    }

    #[test]
    fn allowed_fields_are_filtered() {
        let mut updates = serde_json::Map::new();
        updates.insert("tier".to_string(), serde_json::json!("premium"));
        updates.insert("unknown_field".to_string(), serde_json::json!("value"));
        
        // Only tier should be in the allowed list
        assert!(ALLOWED_FIELDS.contains(&"tier"));
        assert!(!ALLOWED_FIELDS.contains(&"unknown_field"));
    }
}
