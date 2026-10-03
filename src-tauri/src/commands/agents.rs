// ── Agent Commands ──────────────────────────────────────────────────────────
//
// The roster. An Agent is a named composition of role, knowledge scope, tools,
// model policy and channels — see `db::tables::ai::agents` for the model.
//
// Scope checks are exposed as commands rather than buried in Rust because the
// routing and capability decisions live in the TS service layer (the same layer
// that already owns `taskRouter`). Rust owns the *grant*; the service layer
// performs the *check* through `db_agent_scope_check`.

use serde::Deserialize;
use serde_json::Value;
use sqlx::SqlitePool;
use std::collections::HashMap;
use tauri::State;

use crate::db::tables::ai::agents::{self, Agent, AiActivity};
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAgentCmd {
    pub id: String,
    #[serde(default)]
    pub fields: HashMap<String, Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeCheckCmd {
    /// `tool` or `tier`.
    pub kind: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListActivityCmd {
    pub agent_id: Option<String>,
    pub limit: Option<i64>,
}

#[tauri::command]
pub async fn db_list_agents(
    pool: State<'_, SqlitePool>,
    enabled_only: Option<bool>,
) -> CmdResult<Vec<Agent>> {
    agents::list_agents(&pool, enabled_only.unwrap_or(false))
        .await
        .map_err(SerializedError::from)
}

#[tauri::command]
pub async fn db_get_agent(pool: State<'_, SqlitePool>, id: String) -> CmdResult<Option<Agent>> {
    agents::get_agent(&pool, &id)
        .await
        .map_err(SerializedError::from)
}

#[tauri::command]
pub async fn db_create_agent(
    pool: State<'_, SqlitePool>,
    cmd: agents::CreateAgentRequest,
) -> CmdResult<Agent> {
    agents::create_agent(&pool, cmd)
        .await
        .map_err(SerializedError::from)
}

#[tauri::command]
pub async fn db_update_agent(pool: State<'_, SqlitePool>, cmd: UpdateAgentCmd) -> CmdResult<Agent> {
    agents::update_agent(&pool, &cmd.id, cmd.fields)
        .await
        .map_err(SerializedError::from)
}

#[tauri::command]
pub async fn db_delete_agent(pool: State<'_, SqlitePool>, id: String) -> CmdResult<()> {
    agents::delete_agent(&pool, &id)
        .await
        .map_err(SerializedError::from)
}

/// Check an agent's grant. Returns `{granted, reason}` — never a bare boolean —
/// so the caller records the reason when it is a denial, making a refusal visible
/// in Activity instead of looking like an empty result.
#[tauri::command]
pub async fn db_agent_scope_check(
    pool: State<'_, SqlitePool>,
    id: String,
    cmd: ScopeCheckCmd,
) -> CmdResult<agents::ScopeCheckResult> {
    let agent = agents::get_agent(&pool, &id)
        .await
        .map_err(SerializedError::from)?
        .ok_or_else(|| SerializedError::new("agent_not_found", format!("no agent '{id}'")))?;

    let decision = match cmd.kind.as_str() {
        "tool" => agents::scope_grants_tool(&agent, &cmd.value),
        "tier" => agents::scope_grants_tier(&agent, &cmd.value),
        other => agents::ScopeDecision::Denied {
            reason: format!("unknown scope kind '{other}' (expected 'tool' or 'tier')"),
        },
    };
    Ok(decision.into())
}

#[tauri::command]
pub async fn db_record_ai_activity(
    pool: State<'_, SqlitePool>,
    cmd: agents::RecordActivityRequest,
) -> CmdResult<AiActivity> {
    agents::record_activity(&pool, cmd)
        .await
        .map_err(SerializedError::from)
}

#[tauri::command]
pub async fn db_list_ai_activity(
    pool: State<'_, SqlitePool>,
    cmd: ListActivityCmd,
) -> CmdResult<Vec<AiActivity>> {
    agents::list_activity(&pool, cmd.agent_id.as_deref(), cmd.limit.unwrap_or(100))
        .await
        .map_err(SerializedError::from)
}

/// Idempotent. Called on startup so a fresh install has the receptionist
/// without a migration that hardcodes a UUID.
#[tauri::command]
pub async fn db_seed_builtin_agents(pool: State<'_, SqlitePool>) -> CmdResult<usize> {
    agents::seed_builtin_agents(&pool)
        .await
        .map_err(SerializedError::from)
}
