-- 034: Agents — the roster.
--
-- An Agent is a named composition of five things that already existed
-- separately: role, knowledge scope, tools, model policy, channels. Before this
-- table there was exactly one agent (the voice receptionist), implicit in
-- agent-core's config. This makes it a record, so there can be several.
--
-- Design notes:
--   * `role` and `persona` are deliberately separate. `persona` is the P1-P6
--     vocabulary from the design docs (who the actor is); `role` is the agent's
--     own job instruction. They are not the same axis.
--   * `tools` and `channels` are JSON arrays of string enums rather than child
--     tables: they are small, ordered, and always read as a whole.
--   * `model_policy` is a JSON object of task -> {provider, model, fallbacks},
--     the same shape `taskRouter.ts` already resolves. One policy source.
--   * `knowledge_tiers` is a JSON array of T0..T3. Enforcement is in the service
--     layer, not here — this column is the grant, not the check.
--   * `budget_minor` is i64 minor units (centimes) to match invoicing.
--
-- Additive and safe to re-run.

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- P1..P6 from the design vocabulary; NULL for agents with no human analogue.
  persona TEXT,
  -- The agent's own job instruction, e.g. "answer, triage, transfer".
  role TEXT NOT NULL,
  description TEXT,
  -- Free-form system instruction appended to the role prompt.
  instructions TEXT,

  -- Knowledge scope: JSON array of 'T0'|'T1'|'T2'|'T3'.
  knowledge_tiers TEXT NOT NULL DEFAULT '["T0"]',
  -- Named RAG collections this agent may read. JSON array of strings.
  knowledge_collections TEXT NOT NULL DEFAULT '[]',

  -- Tools: JSON array of capability names it may call
  -- ('text','streaming','embedding','stt','tts','vision','tool_calling',...).
  tools TEXT NOT NULL DEFAULT '[]',
  -- Channels: JSON array of 'desktop'|'voice'|'whatsapp'|'cron'.
  channels TEXT NOT NULL DEFAULT '[]',

  -- Model policy: JSON object of task -> {provider, model, fallbacks[]}.
  model_policy TEXT NOT NULL DEFAULT '{}',

  enabled INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  -- i64 minor units; 0 = no cap.
  budget_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MAD',

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents(enabled);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_name ON agents(name);

-- Activity: one row per AI call, so the console can show what the service did.
-- `agent_id` is nullable because calls made outside an agent (direct RAG search,
-- a settings connection test) are still AI calls worth seeing.
CREATE TABLE IF NOT EXISTS ai_activity (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  -- The task-router task this call served, e.g. 'email.reply'.
  task TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  -- 'ok' | 'error' | 'denied' — a scope denial is an event, not a silent drop.
  outcome TEXT NOT NULL DEFAULT 'ok',
  -- Why a denial happened, or the error message.
  detail TEXT,

  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  -- i64 minor units, consistent with invoicing.
  cost_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MAD',
  latency_ms INTEGER NOT NULL DEFAULT 0,

  -- Guardrails that fired on this call. JSON array of strings.
  guardrails TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ai_activity_agent ON ai_activity(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_activity_created ON ai_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_activity_task ON ai_activity(task);
