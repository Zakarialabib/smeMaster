//! Tauri commands for the agent module.
//!
//! These commands expose the agent's config, automation, and ops
//! functionality to the frontend. They replace the Python agent-core
//! HTTP API with direct Rust commands.
//!
//! Note: `agent_health`, `agent_ops_snapshot`, `agent_provider_health`,
//! `agent_create_session`, and `agent_set_provider_tier` are defined in
//! `client.rs` (they need `AgentAuth` state). This file defines the
//! additional commands that only need `SqlitePool`.

use tauri::State;
use sqlx::SqlitePool;

use super::automation::{self, AutomationRule};
use super::config::{self, AgentConfig};
use super::ops::{self, Severity};

// ── Config ───────────────────────────────────────────────────────────────────

/// Get the current agent configuration.
#[tauri::command]
pub async fn agent_get_config(
    pool: State<'_, SqlitePool>,
) -> Result<AgentConfig, String> {
    config::get_config(&pool).await
}

/// Update the agent configuration.
#[tauri::command]
pub async fn agent_update_config(
    pool: State<'_, SqlitePool>,
    updates: serde_json::Value,
) -> Result<AgentConfig, String> {
    config::update_config(&pool, updates).await
}

// ── Ops ──────────────────────────────────────────────────────────────────────

/// List alerts.
#[tauri::command]
pub async fn agent_list_alerts(
    pool: State<'_, SqlitePool>,
    severity: Option<String>,
) -> Result<Vec<super::types::OpsAlert>, String> {
    let sev = severity.and_then(|s| match s.as_str() {
        "P1" => Some(Severity::P1),
        "P2" => Some(Severity::P2),
        "P3" => Some(Severity::P3),
        _ => None,
    });
    ops::list_alerts(&pool, sev).await
}

/// Acknowledge an alert.
#[tauri::command]
pub async fn agent_acknowledge_alert(
    pool: State<'_, SqlitePool>,
    alert_id: String,
    acknowledged_by: String,
) -> Result<(), String> {
    ops::acknowledge_alert(&pool, &alert_id, &acknowledged_by).await
}

// ── Automation ───────────────────────────────────────────────────────────────

/// Get all automation rules.
#[tauri::command]
pub async fn agent_get_automations(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<AutomationRule>, String> {
    automation::get_rules(&pool).await
}

/// Save automation rules.
#[tauri::command]
pub async fn agent_save_automations(
    pool: State<'_, SqlitePool>,
    rules: Vec<AutomationRule>,
) -> Result<(), String> {
    automation::save_rules(&pool, &rules).await
}

/// Toggle an automation rule.
#[tauri::command]
pub async fn agent_toggle_automation(
    pool: State<'_, SqlitePool>,
    rule_id: String,
) -> Result<bool, String> {
    automation::toggle_rule(&pool, &rule_id).await
}

/// Run an automation rule.
#[tauri::command]
pub async fn agent_run_automation(
    pool: State<'_, SqlitePool>,
    rule_id: String,
) -> Result<String, String> {
    automation::run_rule(&pool, &rule_id).await
}
