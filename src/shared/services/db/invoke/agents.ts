/**
 * Agent command wrappers — bridge from the frontend to the Rust `agents` module.
 *
 * These mirror the 9 commands registered in `src-tauri/src/commands/agents.rs`:
 *   db_list_agents, db_get_agent, db_create_agent, db_update_agent,
 *   db_delete_agent, db_agent_scope_check, db_record_ai_activity,
 *   db_list_ai_activity, db_seed_builtin_agents
 *
 * SHAPE CONTRACT (must match the Rust command signatures exactly — a mismatch
 * is a silent runtime failure, not a compile error, because the typed map in
 * `commands.ts` is hand-maintained):
 *
 *   db_list_agents          { enabledOnly?: boolean }
 *   db_get_agent            { id: string }
 *   db_create_agent         { cmd: CreateAgentRequest }        <- camelCase fields
 *   db_update_agent         { cmd: { id, fields } }            <- snake_case keys
 *   db_delete_agent         { id: string }
 *   db_agent_scope_check    { id: string, cmd: { kind, value } }
 *   db_record_ai_activity   { cmd: RecordActivityRequest }
 *   db_list_ai_activity     { cmd: { agentId?, limit? } }
 *   db_seed_builtin_agents  {}  -> number
 *
 * `updateAgent` takes a PATCH MAP with snake_case column names: the Rust side
 * validates keys against a closed ALLOWED list and rejects unknown ones loudly
 * (a silent drop would look like a successful save in the UI).
 */

import { invoke } from '@/shared/services/commands';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Body for `db_create_agent`. Camel-case, matching `CreateAgentRequest`. */
export interface CreateAgentInput {
  name: string;
  role: string;
  persona?: string;
  description?: string;
  instructions?: string;
  knowledgeTiers?: string[];
  knowledgeCollections?: string[];
  tools?: string[];
  channels?: string[];
  modelPolicy?: Record<string, unknown>;
  budgetMinor?: number;
  currency?: string;
  // Voice config (migration 039) — optional; NULL falls back to global settings.
  voiceProvider?: string;
  voiceBaseUrl?: string;
  voiceTtsVoice?: string;
  voiceSttModel?: string;
  voiceTtsEnabled?: number;
  voiceSttEnabled?: number;
  voiceTtsSpeed?: number;
  voiceOfflineTtsDir?: string;
  voiceOfflineSttDir?: string;
}

/**
 * Patch map for `db_update_agent`.
 *
 * Keys are SQL column names (snake_case), per the project's DTO rule. Only the
 * keys in the Rust `ALLOWED` list are accepted; anything else is rejected.
 */
export interface AgentPatch {
  [key: string]: unknown;
  name?: string;
  persona?: string;
  role?: string;
  description?: string;
  instructions?: string;
  knowledge_tiers?: string[];
  knowledge_collections?: string[];
  tools?: string[];
  channels?: string[];
  model_policy?: Record<string, unknown>;
  enabled?: number;
  budget_minor?: number;
  // Voice config (migration 039)
  voice_provider?: string;
  voice_base_url?: string;
  voice_tts_voice?: string;
  voice_stt_model?: string;
  voice_tts_enabled?: number;
  voice_stt_enabled?: number;
  voice_tts_speed?: number;
  voice_offline_tts_dir?: string;
  voice_offline_stt_dir?: string;
}

/** Body for `db_record_ai_activity`, matching `RecordActivityRequest`. */
export interface RecordActivityInput {
  agentId?: string;
  task?: string;
  provider: string;
  model: string;
  outcome?: string;
  detail?: string;
  promptTokens?: number;
  completionTokens?: number;
  costMinor?: number;
  currency?: string;
  latencyMs?: number;
  guardrails?: string[];
}

/** Result of `db_agent_scope_check` — `granted`, not `ok`. */
export interface ScopeCheckResult {
  granted: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Public API — typed wrappers
// ---------------------------------------------------------------------------

export async function listAgents(enabledOnly = false): Promise<any[]> {
  return invoke('db_list_agents', { enabledOnly });
}

export async function getAgent(id: string): Promise<any | null> {
  return invoke('db_get_agent', { id });
}

export async function createAgent(agent: CreateAgentInput): Promise<any> {
  return invoke('db_create_agent', { cmd: agent });
}

export async function updateAgent(id: string, fields: AgentPatch): Promise<any> {
  return invoke('db_update_agent', { cmd: { id, fields } });
}

export async function deleteAgent(id: string): Promise<void> {
  return invoke('db_delete_agent', { id });
}

export async function checkAgentScope(
  id: string,
  kind: 'tool' | 'tier',
  value: string,
): Promise<ScopeCheckResult> {
  return invoke('db_agent_scope_check', { id, cmd: { kind, value } });
}

export async function seedBuiltinAgents(): Promise<number> {
  return invoke('db_seed_builtin_agents');
}

export async function recordActivity(activity: RecordActivityInput): Promise<any> {
  return invoke('db_record_ai_activity', { cmd: activity });
}

export async function listActivity(agentId?: string, limit = 100): Promise<any[]> {
  return invoke('db_list_ai_activity', { cmd: { agentId, limit } });
}
