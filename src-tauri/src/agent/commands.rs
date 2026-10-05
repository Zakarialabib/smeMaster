//! Tauri commands for the agent module.
//!
//! These commands expose the agent's config, automation, and ops
//! functionality to the frontend. They replace the Python agent-core
//! HTTP API with direct Rust commands.
//!
//! All commands use local SQLite — no HTTP, no auth token, no Python.
//! The desktop app IS the agent; there is no separate server.

use tauri::State;
use sqlx::SqlitePool;

use super::automation::{self, AutomationRule};
use super::config::{self, AgentConfig};
use super::ops::{self, Severity};
use super::types::{Health, OpsSnapshot, ProviderHealth};

// ── Health ──────────────────────────────────────────────────────────────────

/// Agent health check — local SQLite only, no external calls.
#[tauri::command]
pub async fn agent_health(pool: State<'_, SqlitePool>) -> Result<Health, String> {
    // Check DB connectivity
    let db_ok = sqlx::query_scalar::<_, i64>("SELECT 1")
        .fetch_one(pool.inner())
        .await
        .is_ok();

    // Check if any automation rules exist
    let rules_exist = automation::get_rules(pool.inner())
        .await
        .map(|r| !r.is_empty())
        .unwrap_or(false);

    Ok(Health {
        ok: db_ok,
        version: env!("CARGO_PKG_VERSION").to_string(),
        started_at: chrono::Utc::now().to_rfc3339(),
        db: if db_ok { "ok" } else { "down" }.to_string(),
        providers: if rules_exist { "ok" } else { "degraded" }.to_string(),
    })
}

// ── Ops ──────────────────────────────────────────────────────────────────────

/// Generate the ops snapshot from local SQLite state.
#[tauri::command]
pub async fn agent_ops_snapshot(pool: State<'_, SqlitePool>) -> Result<OpsSnapshot, String> {
    ops::generate_snapshot(pool.inner()).await
}

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
    ops::list_alerts(pool.inner(), sev).await
}

/// Acknowledge an alert.
#[tauri::command]
pub async fn agent_acknowledge_alert(
    pool: State<'_, SqlitePool>,
    alert_id: String,
    acknowledged_by: String,
) -> Result<(), String> {
    ops::acknowledge_alert(pool.inner(), &alert_id, &acknowledged_by).await
}

/// Get provider health — derived from local state.
#[tauri::command]
pub async fn agent_provider_health(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<ProviderHealth>, String> {
    // Derive provider health from local SQLite state
    // In a real implementation, this would track actual provider call metrics
    let rules = automation::get_rules(pool.inner()).await.unwrap_or_default();
    let enabled_count = rules.iter().filter(|r| r.enabled).count();

    let providers = vec![
        ProviderHealth {
            provider: "local".to_string(),
            role: "LLM".to_string(),
            error_rate: 0.0,
            latency_p95_ms: None,
            fallback_active: false,
            state: if enabled_count > 0 { "ok" } else { "degraded" }.to_string(),
        },
        ProviderHealth {
            provider: "local".to_string(),
            role: "EMBEDDING".to_string(),
            error_rate: 0.0,
            latency_p95_ms: None,
            fallback_active: false,
            state: "ok".to_string(),
        },
    ];

    Ok(providers)
}

// ── Config ───────────────────────────────────────────────────────────────────

/// Get the current agent configuration.
#[tauri::command]
pub async fn agent_get_config(
    pool: State<'_, SqlitePool>,
) -> Result<AgentConfig, String> {
    config::get_config(pool.inner()).await
}

/// Update the agent configuration.
#[tauri::command]
pub async fn agent_update_config(
    pool: State<'_, SqlitePool>,
    updates: serde_json::Value,
) -> Result<AgentConfig, String> {
    config::update_config(pool.inner(), updates).await
}

/// Set the provider tier.
#[tauri::command]
pub async fn agent_set_provider_tier(
    pool: State<'_, SqlitePool>,
    tier: String,
) -> Result<(), String> {
    config::set_tier(pool.inner(), &tier).await
}

// ── Automation ───────────────────────────────────────────────────────────────

/// Get all automation rules.
#[tauri::command]
pub async fn agent_get_automations(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<AutomationRule>, String> {
    automation::get_rules(pool.inner()).await
}

/// Save automation rules.
#[tauri::command]
pub async fn agent_save_automations(
    pool: State<'_, SqlitePool>,
    rules: Vec<AutomationRule>,
) -> Result<(), String> {
    automation::save_rules(pool.inner(), &rules).await
}

/// Toggle an automation rule.
#[tauri::command]
pub async fn agent_toggle_automation(
    pool: State<'_, SqlitePool>,
    rule_id: String,
) -> Result<bool, String> {
    automation::toggle_rule(pool.inner(), &rule_id).await
}

/// Run an automation rule.
#[tauri::command]
pub async fn agent_run_automation(
    pool: State<'_, SqlitePool>,
    rule_id: String,
) -> Result<String, String> {
    automation::run_rule(pool.inner(), &rule_id).await
}
