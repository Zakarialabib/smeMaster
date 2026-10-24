# Agentic AI Automation Architecture

> **What you need to know:** The agent module provides AI-powered automation for email and social channels. It replaces the dropped voice call system (SIP, telephony) with agentic automation that is achievable and aligns with the product's core value.
>
> **Two layers, don't conflate them:**
> - **Roster** (`agents` table, migration 034) — *who* the agents are: name, persona, role, knowledge tiers, tools, channels, model policy, voice config.
> - **Runtime** (`src-tauri/src/agent/`) — *what the console does*: ops snapshots, provider chain, automation rules.

---

## Overview

```
src-tauri/src/agent/                  ← runtime (console)
├── mod.rs          # Module declarations + Tauri registration
├── config.rs       # AgentConfig management (settings table)
├── providers.rs    # Provider chain with fallback
├── ops.rs          # Ops monitoring and alerts
├── automation.rs   # Email/social automation rules
├── types.rs        # Wire types (Health, OpsSnapshot, etc.)
└── commands.rs     # Tauri commands for config/ops/automation

src-tauri/src/db/tables/ai/agents.rs  ← roster (data)
└── agents.rs       # Agent + AiActivity records, CRUD, scope checks, seeding
```

**The rule:** The desktop holds no provider key and no tenant id. All AI operations go through Rust commands. The frontend never holds credentials.

---

## The Roster — `agents` table

Migration `034_agents.sql` made the agent a **record** rather than implicit config. Before it there was exactly one agent (the voice receptionist), hardcoded in `agent-core`'s config. Now there can be several.

```rust
pub struct Agent {
    pub id: String,
    pub name: String,
    /// P1..P6 from the design vocabulary; NULL for agents with no human analogue.
    pub persona: Option<String>,
    /// The agent's own job instruction, e.g. "answer, triage, transfer".
    pub role: String,
    pub description: Option<String>,
    /// Free-form system instruction appended to the role prompt.
    pub instructions: Option<String>,
    /// JSON array of 'T0'|'T1'|'T2'|'T3'.
    pub knowledge_tiers: String,
    /// Named RAG collections this agent may read. JSON array.
    pub knowledge_collections: String,
    /// JSON array of capability names ('text','streaming','embedding','stt','tts','vision','tool_calling').
    pub tools: String,
    /// JSON array of 'desktop'|'voice'|'whatsapp'|'cron'.
    pub channels: String,
    /// JSON object of task -> {provider, model, fallbacks[]}.
    pub model_policy: String,
    pub enabled: i64,
    pub is_builtin: i64,
    pub budget_minor: i64,
    pub currency: String,
    // Voice config (migration 039). NULL = fall back to global settings.
    pub voice_provider: Option<String>,
    pub voice_base_url: Option<String>,
    pub voice_tts_voice: Option<String>,
    pub voice_stt_model: Option<String>,
    pub voice_tts_enabled: Option<i64>,
    pub voice_stt_enabled: Option<i64>,
    pub voice_tts_speed: Option<f64>,
    pub voice_offline_tts_dir: Option<String>,
    pub voice_offline_stt_dir: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}
```

**Design notes:**

- `role` and `persona` are deliberately separate. `persona` is the P1–P6 vocabulary from the design docs (who the actor is); `role` is the agent's own job instruction. Different axes.
- `tools` and `channels` are JSON arrays rather than child tables: small, ordered, always read as a whole.
- `model_policy` is a JSON object of `task -> {provider, model, fallbacks}`, the same shape `taskRouter.ts` already resolves. One policy source.
- `knowledge_tiers` is the **grant**, not the check. Enforcement lives in the service layer.

### Built-in agents (seeded)

`seed_builtin_agents()` is idempotent, keyed on `is_builtin + name`, so a restart neither duplicates a row nor clobbers user edits. Five agents seed:

| Agent | Persona | Tiers | Tools | Channels |
| --- | --- | --- | --- | --- |
| Receptionist | P3 | T0,T1 | text, stt, tts, tool_calling | voice, whatsapp |
| Inbox Assistant | P1 | T1 | text, streaming, embedding | chat, email |
| Ops Watcher | P2 | T1 | text, streaming | desktop, cron |
| Bookkeeper | P4 | T1,T2 | text, vision, structured_output | desktop |
| Writer | P5 | T1 | text, streaming | chat, email |

Built-in agents cannot be deleted (`delete_agent` refuses with a validation error) — disable them instead.

### Scope validation

`validate_scope()` rejects unknown tool / tier / channel names **at write time**. Without it a typo (`"visison"`) is stored happily and the grant simply never matches — the agent silently loses a capability with no error anywhere. T3 is accepted at the type level but `scope_grants_tier` refuses it, so it is rejected here rather than stored as a config that looks set and does nothing.

---

## Activity & metering — `ai_activity` table

One row per AI call, so the console can show what the service did and the cost meter has a source of truth.

```rust
pub struct AiActivity {
    pub id: String,
    /// Nullable: calls made outside an agent (direct RAG search, a settings
    /// connection test) are still AI calls worth seeing.
    pub agent_id: Option<String>,
    pub task: Option<String>,
    pub provider: String,
    pub model: String,
    /// 'ok' | 'error' | 'denied' — a scope denial is an event, not a silent drop.
    pub outcome: String,
    pub detail: Option<String>,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    /// i64 minor units (centimes), consistent with the invoicing module.
    pub cost_minor: i64,
    pub currency: String,
    pub latency_ms: i64,
    /// Guardrails that fired on this call. JSON array of strings.
    pub guardrails: String,
    pub created_at: i64,
}
```

### The writer

`src/shared/services/ai/activityRecorder.ts` is the single funnel. `callAi()` and `streamAi()` — the two entry points every AI call passes through — record on both success and failure, with the **effective** provider/model (resolved via `resolveCallTarget`, not the requested one) and wall-clock latency.

Recording is deliberately non-blocking and non-throwing: a failed INSERT must not fail the user's AI call, and observability must never break the operation it observes. Only metadata is recorded — never prompt or response text.

`withActivityRecording(meta, fn)` is available for call sites that want timing captured without hand-rolling the clock.

---

## Module Details (runtime)

### config.rs — Agent Configuration

Manages console configuration stored in the `settings` table as a JSON blob under `agent_config`. This is **console** config (provider tier, cost simulation), not per-agent roster config — see the `agents` table above for that.

**Key functions:**

- `get_config(pool)` — Read current config
- `update_config(pool, updates)` — Partial update (only known fields)
- `set_tier(pool, tier)` — Set provider tier

### providers.rs — Provider Chain

Fallback chain for LLM/TTS/STT/embedding providers. When the primary provider errors, chain to the next and **record** that it happened.

```rust
pub enum Seam { Llm, Tts, Stt, Embedding }

pub struct ChainResult<T> {
    pub value: T,
    pub provider: String,
    pub attempted: Vec<String>,
    pub fallback_active: bool,
    pub degraded: Vec<String>,
}
```

**Key functions:**

- `ProviderChain::run(seam, call)` — Run call against each provider in order
- `ChainExhausted` — Every provider failed (P1, not a retry loop)

> **Lifetime note:** `run` takes `F: Fn(&str) -> Fut`. A closure returning `async move { … }` that borrows its `&str` parameter fails to compile — own the string first (`let name = name.to_string();`) so the future doesn't tie `Fut`'s lifetime to the closure input.

### ops.rs — Ops Monitoring

Monitors agent health and generates alerts when things go wrong.

```rust
pub enum Severity { P1, P2, P3 }

pub async fn generate_snapshot(pool) -> Result<OpsSnapshot, String>
pub async fn list_alerts(pool, severity) -> Result<Vec<OpsAlert>, String>
pub async fn acknowledge_alert(pool, alert_id, acknowledged_by) -> Result<(), String>
```

**Alert storage:** Alerts are stored in the settings table under `agent_alert_{id}` keys.

### automation.rs — Email/Social Automation

Agentic automation rules for email and social channels.

```rust
pub enum AutomationChannel { Email, Social }

pub struct AutomationRule {
    pub id: String,
    pub name: String,
    pub channel: AutomationChannel,
    pub trigger: String,
    pub action: String,
    pub enabled: bool,
    pub last_run: Option<String>,
    pub run_count: u32,
}
```

**Default rules:**

1. **Email Triage** — Categorize + summarize + flag urgent
2. **Smart Draft Replies** — Generate draft reply with context
3. **Follow-up Reminders** — No reply after 48h → task
4. **Social Media Monitor** — Brand mention → summarize + suggest response

**Key functions:**

- `get_rules(pool)` — Get all automation rules
- `save_rules(pool, rules)` — Save automation rules
- `toggle_rule(pool, rule_id)` — Toggle a rule on/off
- `run_rule(pool, rule_id)` — Run an automation rule

---

## Tauri Commands

### Roster (`commands/agents.rs`)

| Command | Params | Description |
| --- | --- | --- |
| `db_list_agents` | `{ enabledOnly?: boolean }` | List agents |
| `db_get_agent` | `{ id: string }` | Get one agent |
| `db_create_agent` | `{ cmd: CreateAgentRequest }` | Create (camelCase fields) |
| `db_update_agent` | `{ cmd: { id, fields } }` | Patch (snake_case column keys) |
| `db_delete_agent` | `{ id: string }` | Delete (refuses built-ins) |
| `db_agent_scope_check` | `{ id, cmd: { kind, value } }` | Check a tool/tier grant |
| `db_record_ai_activity` | `{ cmd: RecordActivityRequest }` | Record one AI call |
| `db_list_ai_activity` | `{ cmd: { agentId?, limit? } }` | List activity |
| `db_seed_builtin_agents` | — | Seed the 5 built-ins → `number` |

> **Shape contract:** the typed map in `commands.ts` is hand-maintained, so a mismatch between these params and the Rust signatures is a **silent runtime failure, not a compile error**. Keep them in lockstep. `db_update_agent` takes a patch map with snake_case SQL column names; the Rust side validates keys against a closed `ALLOWED` list and rejects unknown ones loudly (a silent drop would look like a successful save in the UI).

### Console (`agent/commands.rs`)

| Command | Description |
| --- | --- |
| `agent_health` | Agent subsystem health |
| `agent_ops_snapshot` | Get ops snapshot |
| `agent_provider_health` | Provider chain health |
| `agent_get_config` / `agent_update_config` | Console configuration |
| `agent_set_provider_tier` | Set provider tier |
| `agent_list_alerts` / `agent_acknowledge_alert` | Ops alerts |
| `agent_get_automations` / `agent_save_automations` | Automation rules |
| `agent_toggle_automation` / `agent_run_automation` | Toggle / run a rule |
| `agent_run_automation_with_ai` | Run a rule through the AI provider |

---

## Frontend Integration

The frontend uses these commands through typed IPC wrappers.

```typescript
// Roster — see src/shared/services/db/invoke/agents.ts
import { listAgents, createAgent, updateAgent, checkAgentScope } from '@shared/services/db/invoke/agents';

const agents = await listAgents();
const created = await createAgent({ name: 'Inbox Assistant', role: 'Answer emails', tools: ['text'] });
await updateAgent(created.id, { voice_provider: 'openai', voice_tts_enabled: 1 });
const { granted, reason } = await checkAgentScope(created.id, 'tool', 'text');

// Console — see src/features/agent/stores
const rules = await invokeCommand<AutomationRule[]>('agent_get_automations', {});
await invokeCommand('agent_toggle_automation', { ruleId: 'auto-triage' });
```

**Surfaces:**

- `AgentConsolePage` (`/agent-console`) — Ops · Automations · Config tabs
- Settings → AI & Automation → **Agent Roster** sub-tab (`AgentsTab`)
- Settings → AI & Automation → **Voice & Speech** (`VoiceSettings`) — binds to the selected agent record

---

## What Was Dropped

The voice call system (SIP, telephony, realtime audio) was dropped because:

- Too many hard dependencies (SIP, telephony, realtime audio)
- WhatsApp live voice calls are exposed by no API
- Voice runs on a dedicated PSTN number (ARCEP porting required)
- The agentic AI approach is more achievable and aligns with the product's core value

**Removed 2026-10-05 (git history preserves it):** `services/agent-core/` (the entire Python system — channels, providers, calls tests/migrations), `prototype/voice-console/`, `scripts/build_voice_mockups.py`, `scripts/build_voice_deck.py`, and all call-era contract fields (`callCount`, `consentVariant`, `transferTarget`, `SessionRequest`, …).

STT/TTS themselves are **not** dropped — on-device speech (sherpa-onnx via the ml-sidecar) and cloud voice providers remain, configured per agent.

---

## Related

- [Backend structure →](02-backend-structure.md) — Full Rust backend layout
- [AI capability architecture →](../02-BACKEND/13-ai-capability-architecture.md) — Provider capability system
- [AI task router →](../02-BACKEND/14-ai-task-router.md) — Task routing logic
- [AI model registry →](../02-BACKEND/15-ai-model-registry.md) — Model definitions
- [AI RAG dimensions →](../02-BACKEND/16-ai-rag-dimensions.md) — RAG embedding dimensions
