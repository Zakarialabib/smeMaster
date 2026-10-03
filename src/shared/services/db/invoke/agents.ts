/**
 * Agent command wrappers — bridge from the frontend to the Rust `agents` module.
 *
 * These mirror the 9 commands registered in `src-tauri/src/commands/agents.rs`:
 *   db_list_agents, db_get_agent, db_create_agent, db_update_agent,
 *   db_delete_agent, db_agent_scope_check, db_record_ai_activity,
 *   db_list_ai_activity, db_seed_builtin_agents
 *
 * Usage:
 *   import { agentCmd } from '@/shared/services/db/invoke/agents'
 *   const agents = await agentCmd('db_list_agents', {})
 */

import { invoke } from '@/shared/services/commands';

// ---------------------------------------------------------------------------
// Public API — typed wrappers
// ---------------------------------------------------------------------------

export async function listAgents(): Promise<any[]> {
  return invoke('db_list_agents');
}

export async function getAgent(agentId: string): Promise<any | null> {
  return invoke('db_get_agent', { agentId });
}

export async function createAgent(agent: {
  name: string;
  description?: string;
  provider: string;
  model: string;
  scope: Record<string, any>;
  tools: string[];
  channels: string[];
  budget: {
    hourlyTokens?: number;
    monthlyTokens?: number;
    maxConcurrent?: number;
    cooldownMs?: number;
  };
}): Promise<any> {
  return invoke('db_create_agent', { agent });
}

export async function updateAgent(agentId: string, patch: Record<string, any>): Promise<any> {
  return invoke('db_update_agent', { agentId, patch });
}

export async function deleteAgent(agentId: string): Promise<void> {
  return invoke('db_delete_agent', { agentId });
}

export async function checkAgentScope(
  agentId: string,
  request: Record<string, any>,
): Promise<{ ok: boolean; reason?: string }> {
  return invoke('db_agent_scope_check', { agentId, request });
}

export async function seedBuiltinAgents(): Promise<any[]> {
  return invoke('db_seed_builtin_agents');
}

export async function recordActivity(
  agentId: string,
  activity: {
    type: string;
    channel: string;
    detail: string;
    durationMs?: number;
    costTokens?: number;
    costUsd?: number;
    success: boolean;
    error?: string;
  },
): Promise<any> {
  return invoke('db_record_ai_activity', { agentId, activity });
}

export async function listActivity(agentId: string, limit = 50): Promise<any[]> {
  return invoke('db_list_ai_activity', { agentId, limit });
}
