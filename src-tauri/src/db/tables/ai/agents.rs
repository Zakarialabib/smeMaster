//! Agent query layer — the roster.
//!
//! An Agent is a named composition of five things that already existed
//! separately: **role, knowledge scope, tools, model policy, channels**. Before
//! this table there was exactly one agent (the voice receptionist), implicit in
//! agent-core's config. This makes it a record, so there can be several.
//!
//! Tables: `agents` (the roster), `ai_activity` (one row per AI call).
//!
//! ## The one rule
//!
//! An agent may only use the tools and knowledge its scope grants. `scope_grants`
//! is that check, in one place. A denial is returned as a value, never swallowed
//! — the caller records it as an `ai_activity` row with `outcome = 'denied'`, so
//! a denial is visible in the console instead of looking like an empty result.
//!
//! All functions are async and return `Result<_, AppDbError>`.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db::error::AppDbError;

// ── Vocabulary ───────────────────────────────────────────────────────────────

/// Knowledge tiers, from the design docs. T0 public · T1 business ·
/// T2 local-node-only · T3 never-checked.
pub const KNOWLEDGE_TIERS: [&str; 4] = ["T0", "T1", "T2", "T3"];

/// The 14 capability names from `capabilities.ts`, as tool grants.
pub const TOOLS: [&str; 14] = [
    "text",
    "streaming",
    "embedding",
    "stt",
    "tts",
    "realtime_voice",
    "model_discovery",
    "connection_test",
    "structured_output",
    "tool_calling",
    "reasoning",
    "vision",
    "context_caching",
    "batch_processing",
];

/// Where an agent can be reached.
pub const CHANNELS: [&str; 4] = ["desktop", "voice", "whatsapp", "cron"];

// ── Records ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub persona: Option<String>,
    pub role: String,
    pub description: Option<String>,
    pub instructions: Option<String>,
    /// JSON array of `T0..T3`.
    pub knowledge_tiers: String,
    /// JSON array of collection names.
    pub knowledge_collections: String,
    /// JSON array of capability names.
    pub tools: String,
    /// JSON array of `desktop|voice|whatsapp|cron`.
    pub channels: String,
    /// JSON object of task -> `{provider, model, fallbacks[]}`.
    pub model_policy: String,
    pub enabled: i64,
    pub is_builtin: i64,
    pub budget_minor: i64,
    pub currency: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AiActivity {
    pub id: String,
    pub agent_id: Option<String>,
    pub task: Option<String>,
    pub provider: String,
    pub model: String,
    pub outcome: String,
    pub detail: Option<String>,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub cost_minor: i64,
    pub currency: String,
    pub latency_ms: i64,
    pub guardrails: String,
    pub created_at: i64,
}

// ── Requests ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAgentRequest {
    pub name: String,
    pub persona: Option<String>,
    pub role: String,
    pub description: Option<String>,
    pub instructions: Option<String>,
    pub knowledge_tiers: Option<Vec<String>>,
    pub knowledge_collections: Option<Vec<String>>,
    pub tools: Option<Vec<String>>,
    pub channels: Option<Vec<String>>,
    /// Raw JSON object; stored verbatim so the router owns the shape.
    pub model_policy: Option<serde_json::Value>,
    pub budget_minor: Option<i64>,
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordActivityRequest {
    pub agent_id: Option<String>,
    pub task: Option<String>,
    pub provider: String,
    pub model: String,
    pub outcome: Option<String>,
    pub detail: Option<String>,
    pub prompt_tokens: Option<i64>,
    pub completion_tokens: Option<i64>,
    pub cost_minor: Option<i64>,
    pub currency: Option<String>,
    pub latency_ms: Option<i64>,
    pub guardrails: Option<Vec<String>>,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn to_json_array(items: &[String]) -> String {
    serde_json::to_string(items).unwrap_or_else(|_| "[]".to_string())
}

/// Parse a stored JSON array, tolerating a NULL or malformed value by returning
/// an empty vec. A malformed grant must fail *closed* (no tools, no knowledge),
/// never open.
fn from_json_array(raw: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(raw).unwrap_or_default()
}

// ── Validation ───────────────────────────────────────────────────────────────

/// Reject unknown tool / tier / channel names at write time.
///
/// Without this a typo (`"visison"`) is stored happily and the grant simply
/// never matches — the agent silently loses a capability with no error anywhere.
/// Failing loudly at the write is the only place the typo is still visible.
fn validate_scope(
    tiers: &[String],
    tools: &[String],
    channels: &[String],
) -> Result<(), AppDbError> {
    for t in tiers {
        if !KNOWLEDGE_TIERS.contains(&t.as_str()) {
            return Err(AppDbError::Validation(format!(
                "unknown knowledge tier '{t}' (expected one of {})",
                KNOWLEDGE_TIERS.join(", ")
            )));
        }
        // T3 is never-checked by consent decision. Accepting it here would
        // store a grant that `scope_grants_tier` then refuses — a config that
        // looks set and does nothing.
        if t == "T3" {
            return Err(AppDbError::Validation(
                "T3 is never-checked and cannot be granted".to_string(),
            ));
        }
    }
    for t in tools {
        if !TOOLS.contains(&t.as_str()) {
            return Err(AppDbError::Validation(format!(
                "unknown capability '{t}' (expected one of {})",
                TOOLS.join(", ")
            )));
        }
    }
    for c in channels {
        if !CHANNELS.contains(&c.as_str()) {
            return Err(AppDbError::Validation(format!(
                "unknown channel '{c}' (expected one of {})",
                CHANNELS.join(", ")
            )));
        }
    }
    Ok(())
}

// ── Reads ────────────────────────────────────────────────────────────────────

pub async fn list_agents(pool: &SqlitePool, enabled_only: bool) -> Result<Vec<Agent>, AppDbError> {
    let sql = if enabled_only {
        "SELECT * FROM agents WHERE enabled = 1 ORDER BY is_builtin DESC, name ASC"
    } else {
        "SELECT * FROM agents ORDER BY is_builtin DESC, name ASC"
    };
    sqlx::query_as::<_, Agent>(sql)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
}

pub async fn get_agent(pool: &SqlitePool, id: &str) -> Result<Option<Agent>, AppDbError> {
    sqlx::query_as::<_, Agent>("SELECT * FROM agents WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

// ── Writes ───────────────────────────────────────────────────────────────────

pub async fn create_agent(
    pool: &SqlitePool,
    req: CreateAgentRequest,
) -> Result<Agent, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = Uuid::new_v4().to_string();

    // Defaults are deliberately restrictive: an agent created with no explicit
    // scope gets T0 (public) knowledge and no tools. Widening is a deliberate act.
    let tiers = req
        .knowledge_tiers
        .unwrap_or_else(|| vec!["T0".to_string()]);
    let collections = req.knowledge_collections.unwrap_or_default();
    let tools = req.tools.unwrap_or_default();
    let channels = req.channels.unwrap_or_default();
    validate_scope(&tiers, &tools, &channels)?;
    let policy = req
        .model_policy
        .unwrap_or_else(|| serde_json::json!({}))
        .to_string();

    sqlx::query(
        "INSERT INTO agents
         (id, name, persona, role, description, instructions, knowledge_tiers,
          knowledge_collections, tools, channels, model_policy, enabled, is_builtin,
          budget_minor, currency, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&req.name)
    .bind(&req.persona)
    .bind(&req.role)
    .bind(&req.description)
    .bind(&req.instructions)
    .bind(to_json_array(&tiers))
    .bind(to_json_array(&collections))
    .bind(to_json_array(&tools))
    .bind(to_json_array(&channels))
    .bind(&policy)
    .bind(req.budget_minor.unwrap_or(0))
    .bind(req.currency.unwrap_or_else(|| "MAD".to_string()))
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    get_agent(pool, &id)
        .await?
        .ok_or_else(|| AppDbError::NotFound("agent just inserted".to_string()))
}

/// Update named fields. Dynamic map keys stay `snake_case` (column names), per
/// the project's DTO rule.
///
/// The column names are never interpolated from user input: `ALLOWED` is a
/// closed list and anything outside it is rejected before the SQL is built.
/// `AssertSqlSafe` records that reasoning for the injection audit.
pub async fn update_agent(
    pool: &SqlitePool,
    id: &str,
    fields: std::collections::HashMap<String, serde_json::Value>,
) -> Result<Agent, AppDbError> {
    const ALLOWED: [&str; 12] = [
        "name",
        "persona",
        "role",
        "description",
        "instructions",
        "knowledge_tiers",
        "knowledge_collections",
        "tools",
        "channels",
        "model_policy",
        "enabled",
        "budget_minor",
    ];

    let now = chrono::Utc::now().timestamp();

    // Reject unknown fields loudly rather than ignoring them: a silent drop
    // looks like a successful save in the UI.
    for key in fields.keys() {
        if !ALLOWED.contains(&key.as_str()) {
            return Err(AppDbError::Validation(format!(
                "field '{key}' is not updatable on agents"
            )));
        }
    }

    // Validate any scope field being changed, using the values as they will be
    // after the write. Reading them as arrays here means a bad grant is rejected
    // before the UPDATE, not discovered later by a check that never matches.
    let as_strings = |v: &serde_json::Value| -> Vec<String> {
        serde_json::from_value::<Vec<String>>(v.clone()).unwrap_or_default()
    };
    let tiers = fields.get("knowledge_tiers").map(as_strings).unwrap_or_default();
    let tools = fields.get("tools").map(as_strings).unwrap_or_default();
    let channels = fields.get("channels").map(as_strings).unwrap_or_default();
    validate_scope(&tiers, &tools, &channels)?;

    // Sort for a deterministic statement (and deterministic binds below).
    let mut keys: Vec<&String> = fields.keys().collect();
    keys.sort();

    if keys.is_empty() {
        return get_agent(pool, id)
            .await?
            .ok_or_else(|| AppDbError::NotFound(id.to_string()));
    }

    let setters: Vec<String> = keys.iter().map(|k| format!("{k} = ?")).collect();
    let sql = format!(
        "UPDATE agents SET {}, updated_at = ? WHERE id = ?",
        setters.join(", ")
    );

    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql));
    for key in &keys {
        q = bind_json(q, &fields[*key]);
    }
    q = q.bind(now).bind(id);
    q.execute(pool).await.map_err(AppDbError::Database)?;

    get_agent(pool, id)
        .await?
        .ok_or_else(|| AppDbError::NotFound(id.to_string()))
}

/// Bind a JSON value to a SQLite column.
///
/// Arrays and objects are stored as JSON **text** (the scope grants), unlike
/// the CRM variant which nulls them. NULL binds a real NULL.
fn bind_json<'q>(
    q: sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments>,
    v: &serde_json::Value,
) -> sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments> {
    match v {
        serde_json::Value::String(s) => q.bind(s.clone()),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                q.bind(i)
            } else {
                q.bind(n.as_f64().unwrap_or(0.0))
            }
        }
        serde_json::Value::Bool(b) => q.bind(*b),
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => q.bind(v.to_string()),
        serde_json::Value::Null => q.bind(None::<String>),
    }
}

/// Builtin agents are seeded, not user-created — deleting one would leave the
/// app without its receptionist. Refuse rather than silently re-seed.
pub async fn delete_agent(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let existing = get_agent(pool, id).await?;
    match existing {
        None => Err(AppDbError::NotFound(id.to_string())),
        Some(a) if a.is_builtin == 1 => Err(AppDbError::Validation(
            "builtin agents cannot be deleted; disable it instead".to_string(),
        )),
        Some(_) => {
            sqlx::query("DELETE FROM agents WHERE id = ?")
                .bind(id)
                .execute(pool)
                .await
                .map_err(AppDbError::Database)?;
            Ok(())
        }
    }
}

// ── Scope enforcement — the one rule ─────────────────────────────────────────

/// The outcome of a scope check. A denial carries the reason so the caller can
/// record it; it is never a silent empty result.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ScopeDecision {
    Granted,
    Denied { reason: String },
}

impl ScopeDecision {
    pub fn is_granted(&self) -> bool {
        matches!(self, ScopeDecision::Granted)
    }
}

/// The wire shape for a scope check.
///
/// `granted` is a plain boolean for the common `if (r.granted)` path in TS, while
/// `reason` stays available so a denial can be recorded in `ai_activity` without
/// the caller having to pattern-match a tagged union for the log line.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeCheckResult {
    pub granted: bool,
    pub reason: Option<String>,
}

impl From<ScopeDecision> for ScopeCheckResult {
    fn from(d: ScopeDecision) -> Self {
        // `granted` is derived through `is_granted()` rather than repeated per
        // arm, so there is exactly one definition of what "granted" means.
        let granted = d.is_granted();
        match d {
            ScopeDecision::Granted => ScopeCheckResult {
                granted,
                reason: None,
            },
            ScopeDecision::Denied { reason } => ScopeCheckResult {
                granted,
                reason: Some(reason),
            },
        }
    }
}

/// Does this agent's grant include `tool`?
pub fn scope_grants_tool(agent: &Agent, tool: &str) -> ScopeDecision {
    if !TOOLS.contains(&tool) {
        return ScopeDecision::Denied {
            reason: format!("'{tool}' is not a known capability"),
        };
    }
    if from_json_array(&agent.tools).iter().any(|t| t == tool) {
        ScopeDecision::Granted
    } else {
        ScopeDecision::Denied {
            reason: format!("agent '{}' is not granted the '{tool}' capability", agent.name),
        }
    }
}

/// May this agent read knowledge at `tier`?
///
/// T3 is `never-checked` by design — no agent may be granted it, so a request
/// for T3 is denied even if the grant column somehow contains it. That is the
/// schema enforcing the consent decision, not a comment asking nicely.
pub fn scope_grants_tier(agent: &Agent, tier: &str) -> ScopeDecision {
    if !KNOWLEDGE_TIERS.contains(&tier) {
        return ScopeDecision::Denied {
            reason: format!("'{tier}' is not a known knowledge tier"),
        };
    }
    if tier == "T3" {
        return ScopeDecision::Denied {
            reason: "T3 is never-checked and cannot be granted to any agent".to_string(),
        };
    }
    if from_json_array(&agent.knowledge_tiers).iter().any(|t| t == tier) {
        ScopeDecision::Granted
    } else {
        ScopeDecision::Denied {
            reason: format!("agent '{}' is not granted knowledge tier {tier}", agent.name),
        }
    }
}

// ── Activity ─────────────────────────────────────────────────────────────────

pub async fn record_activity(
    pool: &SqlitePool,
    req: RecordActivityRequest,
) -> Result<AiActivity, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = Uuid::new_v4().to_string();
    let guardrails = to_json_array(&req.guardrails.unwrap_or_default());

    sqlx::query(
        "INSERT INTO ai_activity
         (id, agent_id, task, provider, model, outcome, detail, prompt_tokens,
          completion_tokens, cost_minor, currency, latency_ms, guardrails, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&req.agent_id)
    .bind(&req.task)
    .bind(&req.provider)
    .bind(&req.model)
    .bind(req.outcome.unwrap_or_else(|| "ok".to_string()))
    .bind(&req.detail)
    .bind(req.prompt_tokens.unwrap_or(0))
    .bind(req.completion_tokens.unwrap_or(0))
    .bind(req.cost_minor.unwrap_or(0))
    .bind(req.currency.unwrap_or_else(|| "MAD".to_string()))
    .bind(req.latency_ms.unwrap_or(0))
    .bind(&guardrails)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    sqlx::query_as::<_, AiActivity>("SELECT * FROM ai_activity WHERE id = ?")
        .bind(&id)
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)
}

pub async fn list_activity(
    pool: &SqlitePool,
    agent_id: Option<&str>,
    limit: i64,
) -> Result<Vec<AiActivity>, AppDbError> {
    let capped = limit.clamp(1, 500);
    match agent_id {
        Some(a) => sqlx::query_as::<_, AiActivity>(
            "SELECT * FROM ai_activity WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?",
        )
        .bind(a)
        .bind(capped)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database),
        None => sqlx::query_as::<_, AiActivity>(
            "SELECT * FROM ai_activity ORDER BY created_at DESC LIMIT ?",
        )
        .bind(capped)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database),
    }
}

// ── Seed ─────────────────────────────────────────────────────────────────────

/// The receptionist, as it exists today in agent-core's config — now a record.
///
/// Idempotent: keyed on `is_builtin` + name, so a restart does not duplicate it
/// and a user's edits to the seeded row are not clobbered.
pub async fn seed_builtin_agents(pool: &SqlitePool) -> Result<usize, AppDbError> {
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT id FROM agents WHERE is_builtin = 1 AND name = ?")
            .bind("Receptionist")
            .fetch_optional(pool)
            .await
            .map_err(AppDbError::Database)?;
    if existing.is_some() {
        return Ok(0);
    }

    let now = chrono::Utc::now().timestamp();
    let id = Uuid::new_v4().to_string();

    // T0 + T1 by default. T2 (local-node) is opt-in because it requires a local
    // node to exist; granting it unconditionally would advertise a capability
    // the deployment may not have.
    let policy = serde_json::json!({
        "voice.stt": { "provider": "local", "model": "zipformer-small-en" },
        "voice.tts": { "provider": "local", "model": "vits-piper-fr-fr-siwis-medium" },
        "email.reply": { "provider": "claude", "model": "claude-sonnet-4-20250514" },
        "rag.query": { "provider": "local", "model": "bge-small-en-v1.5" }
    })
    .to_string();

    sqlx::query(
        "INSERT INTO agents
         (id, name, persona, role, description, instructions, knowledge_tiers,
          knowledge_collections, tools, channels, model_policy, enabled, is_builtin,
          budget_minor, currency, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 'MAD', ?, ?)",
    )
    .bind(&id)
    .bind("Receptionist")
    .bind("P3")
    .bind("Answer inbound calls, triage, and transfer to a human when needed")
    .bind("Inbound AI receptionist for a French-speaking SME. Voice and WhatsApp.")
    .bind("Announce that you are an AI assistant before anything else. Never claim to be human.")
    .bind(to_json_array(&["T0".to_string(), "T1".to_string()]))
    .bind(to_json_array(&[]))
    .bind(to_json_array(&[
        "text".to_string(),
        "stt".to_string(),
        "tts".to_string(),
        "tool_calling".to_string(),
    ]))
    .bind(to_json_array(&["voice".to_string(), "whatsapp".to_string()]))
    .bind(&policy)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn agent_with(tiers: &[&str], tools: &[&str]) -> Agent {
        Agent {
            id: "a1".into(),
            name: "Test".into(),
            persona: None,
            role: "test".into(),
            description: None,
            instructions: None,
            knowledge_tiers: to_json_array(&tiers.iter().map(|s| s.to_string()).collect::<Vec<_>>()),
            knowledge_collections: "[]".into(),
            tools: to_json_array(&tools.iter().map(|s| s.to_string()).collect::<Vec<_>>()),
            channels: "[]".into(),
            model_policy: "{}".into(),
            enabled: 1,
            is_builtin: 0,
            budget_minor: 0,
            currency: "MAD".into(),
            created_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn grants_a_tool_the_agent_has() {
        let a = agent_with(&["T0"], &["text", "vision"]);
        assert!(scope_grants_tool(&a, "vision").is_granted());
    }

    #[test]
    fn denies_a_tool_the_agent_lacks() {
        let a = agent_with(&["T0"], &["text"]);
        let d = scope_grants_tool(&a, "vision");
        assert!(!d.is_granted());
        match d {
            ScopeDecision::Denied { reason } => assert!(reason.contains("vision")),
            _ => panic!("expected a denial"),
        }
    }

    #[test]
    fn denies_an_unknown_tool_rather_than_allowing_it() {
        let a = agent_with(&["T0"], &["text"]);
        assert!(!scope_grants_tool(&a, "telepathy").is_granted());
    }

    #[test]
    fn t3_is_never_grantable_even_if_the_column_says_so() {
        // The point: a bad grant in the DB must not widen access. T3 is
        // "never-checked" by consent decision, enforced here not by convention.
        let a = agent_with(&["T0", "T3"], &[]);
        let d = scope_grants_tier(&a, "T3");
        assert!(!d.is_granted());
        match d {
            ScopeDecision::Denied { reason } => assert!(reason.contains("never-checked")),
            _ => panic!("expected a denial"),
        }
    }

    #[test]
    fn grants_a_tier_the_agent_has() {
        let a = agent_with(&["T0", "T1"], &[]);
        assert!(scope_grants_tier(&a, "T1").is_granted());
        assert!(!scope_grants_tier(&a, "T2").is_granted());
    }

    #[test]
    fn a_malformed_grant_fails_closed() {
        // Garbage in the column must mean "no access", not "all access".
        let mut a = agent_with(&["T0"], &["text"]);
        a.tools = "not json".into();
        a.knowledge_tiers = "{{{".into();
        assert!(!scope_grants_tool(&a, "text").is_granted());
        assert!(!scope_grants_tier(&a, "T0").is_granted());
    }

    #[test]
    fn validation_rejects_an_unknown_tool() {
        // A typo must fail at the write, not silently never match at read time.
        let r = validate_scope(&["T0".into()], &["visison".into()], &[]);
        assert!(r.is_err());
        let msg = format!("{}", r.unwrap_err());
        assert!(msg.contains("visison"), "message should name the bad value: {msg}");
    }

    #[test]
    fn validation_rejects_an_unknown_channel() {
        assert!(validate_scope(&["T0".into()], &[], &["telepathy".into()]).is_err());
    }

    #[test]
    fn validation_rejects_granting_t3() {
        // Storing a grant that the check then refuses would be a config that
        // looks set and does nothing. Reject it at the write instead.
        assert!(validate_scope(&["T3".into()], &[], &[]).is_err());
    }

    #[test]
    fn validation_accepts_a_well_formed_scope() {
        let r = validate_scope(
            &["T0".into(), "T1".into(), "T2".into()],
            &["text".into(), "vision".into()],
            &["desktop".into(), "voice".into()],
        );
        assert!(r.is_ok(), "should accept valid names: {:?}", r.err());
    }
}
