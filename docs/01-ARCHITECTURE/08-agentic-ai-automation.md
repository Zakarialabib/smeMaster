# Agentic AI Automation Architecture

> **What you need to know:** The agent module provides AI-powered automation for email and social channels. It replaces the dropped voice call system (SIP, telephony) with agentic automation that is achievable and aligns with the product's core value.

---

## Overview

```
src-tauri/src/agent/
├── mod.rs          # Module declarations + Tauri registration
├── config.rs       # AgentConfig management (settings table)
├── providers.rs    # Provider chain with fallback
├── ops.rs          # Ops monitoring and alerts
├── automation.rs   # Email/social automation rules
├── types.rs        # Wire types (Health, OpsSnapshot, etc.)
└── commands.rs     # Tauri commands for config/ops/automation
```

**The rule:** The desktop holds no provider key and no tenant id. All AI operations go through Rust commands. The frontend never holds credentials.

---

## Module Details

### config.rs — Agent Configuration

Manages agent configuration stored in the `settings` table as a JSON blob under `agent_config`.

```rust
pub struct AgentConfig {
    pub provider_mix: BTreeMap<String, String>,
    pub consent_variant: String,
    pub bilingual: bool,
    pub channel: String,
    pub channels: BTreeMap<String, ChannelCapability>,
    pub cost_sim: serde_json::Value,
    pub hours: BTreeMap<String, Vec<String>>,
    pub tz: String,
    pub transfer_target: Option<String>,
    pub tier: String,
    pub knowledge_scope: Vec<String>,
    pub after_hours_mode: String,
    pub updated_at: Option<String>,
}
```

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

| Command                   | Description                            |
| ------------------------- | -------------------------------------- |
| `agent_get_config`        | Get current agent configuration        |
| `agent_update_config`     | Update agent configuration             |
| `agent_set_provider_tier` | Set provider tier                      |
| `agent_ops_snapshot`      | Get ops snapshot                       |
| `agent_list_alerts`       | List alerts (optional severity filter) |
| `agent_acknowledge_alert` | Acknowledge an alert                   |
| `agent_get_automations`   | Get all automation rules               |
| `agent_save_automations`  | Save automation rules                  |
| `agent_toggle_automation` | Toggle an automation rule              |
| `agent_run_automation`    | Run an automation rule                 |

---

## Frontend Integration

The frontend uses these commands through typed IPC wrappers:

```typescript
// Get automations
const rules = await invokeCommand<AutomationRule[]>('agent_get_automations', {});

// Toggle a rule
await invokeCommand('agent_toggle_automation', { ruleId: 'auto-triage' });

// Run a rule
const result = await invokeCommand<string>('agent_run_automation', { ruleId: 'auto-triage' });
```

---

## What Was Dropped

The voice call system (SIP, telephony, realtime audio) was dropped because:

- Too many hard dependencies (SIP, telephony, realtime audio)
- WhatsApp live voice calls are exposed by no API
- Voice runs on a dedicated PSTN number (ARCEP porting required)
- The agentic AI approach is more achievable and aligns with the product's core value

**Note:** Voice call system docs were removed (dropped 2026-10-04).

---

## Related

- [Backend structure →](02-backend-structure.md) — Full Rust backend layout
- [AI capability architecture →](../02-BACKEND/13-ai-capability-architecture.md) — Provider capability system
- [AI task router →](../02-BACKEND/14-ai-task-router.md) — Task routing logic
- [AI model registry →](../02-BACKEND/15-ai-model-registry.md) — Model definitions
- [AI RAG dimensions →](../02-BACKEND/16-ai-rag-dimensions.md) — RAG embedding dimensions
