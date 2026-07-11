/**
 * IPC Command Registry - Single Source of Truth
 *
 * Centralized registry of all Tauri commands with their parameter and result types.
 * Inspired by simple-signage's CommandRegistry pattern for type-safe IPC.
 *
 * Each entry has:
 *   - `params`: Sample parameters (TypeScript uses this for type inference)
 *   - `result`: Sample return value (used for type inference)
 *
 * Usage with the typed wrapper:
 *   import { invoke } from "@shared/services/ipc";
 *   const tasks = await invoke("db_list_tasks", { accountId: null, isCompleted: false });
 *   // ^-- compile error if command name is wrong
 *   // ^-- type inferred for both params and result
 */

import type { LogEntry } from "@shared/services/logger";

// Type for empty parameters to avoid ESLint "empty object" errors
type EmptyParams = Record<string, never>;

// ── Subsystem lifecycle types ──────────────────────────────────────
export interface SubsystemStatusResponse {
  name: string;
  class: "always_on" | "lazy" | "on_demand";
  status: "inactive" | "dormant" | "starting" | "active" | "shutting_down" | "failed";
  reason: string;
  uptime_secs?: number;
  error?: string;
  feature_flag?: string;
}

// ============================================================================
// LOGGING COMMANDS
// ============================================================================

export const TauriCommands = {
  // ── Logging (in-memory ring buffer) ──────────────────────────────────
  get_logs: { params: { limit: 100 as number }, result: [] as LogEntry[] },
  clear_logs: { params: {} as EmptyParams, result: undefined as void },
  log_event: {
    params: {
      level: 'info' as 'debug' | 'info' | 'warning' | 'error' | 'critical',
      message: '' as string,
      category: undefined as string | undefined,
      data: undefined as unknown,
    },
    result: undefined as void,
  },
  log_error_command: {
    params: {
      error: '' as string,
      stack: undefined as string | undefined,
      component: undefined as string | undefined,
      timestamp: undefined as string | undefined,
    },
    result: undefined as void,
  },

  // ── App lifecycle ─────────────────────────────────────────────────────
  reset_app: { params: {} as EmptyParams, result: undefined as void },
  open_devtools: { params: {} as EmptyParams, result: undefined as void },
  check_for_update_now: { params: {} as EmptyParams, result: null as unknown },
  get_app_version: { params: {} as EmptyParams, result: '' as string },
  get_rollback_version: { params: {} as EmptyParams, result: null as string | null },
  needs_rollback: { params: {} as EmptyParams, result: false as boolean },
  mark_successful_launch: { params: {} as EmptyParams, result: undefined as void },
  verify_update_checksum: {
    params: { expectedSha256: '' as string, filePath: '' as string },
    result: false as boolean,
  },

  // ── Database: Tasks ───────────────────────────────────────────────────
  db_list_tasks: {
    params: { accountId: null as string | null, isCompleted: null as boolean | null },
    result: [] as unknown[],
  },
  db_list_task_tags: { params: {} as EmptyParams, result: [] as unknown[] },
  db_get_task: { params: { id: '' as string }, result: null as unknown },
  db_get_task_by_id: { params: { id: '' as string }, result: null as unknown },
  db_create_task: {
    params: { request: {} as Record<string, unknown> },
    result: null as unknown,
  },
  db_update_task: {
    params: { id: '' as string, request: {} as Record<string, unknown> },
    result: undefined as void,
  },
  db_delete_task: { params: { id: '' as string }, result: undefined as void },
  db_complete_task: { params: { id: '' as string }, result: undefined as void },
  db_uncomplete_task: { params: { id: '' as string }, result: undefined as void },
  db_reorder_tasks: {
    params: { orderedIds: [] as string[] },
    result: undefined as void,
  },
  db_get_incomplete_task_count: {
    params: { accountId: undefined as string | undefined },
    result: 0 as number,
  },
  db_get_tasks_for_contact: {
    params: { contactId: '' as string },
    result: [] as unknown[],
  },
  db_get_tasks_due_for_reminder: {
    params: { withinSeconds: 0 as number },
    result: [] as unknown[],
  },
  db_get_tasks_with_workflow: { params: {} as EmptyParams, result: [] as unknown[] },
  db_get_task_tags: { params: {} as EmptyParams, result: [] as unknown[] },
  db_upsert_task_tag: {
    params: { tag: {} as Record<string, unknown> },
    result: undefined as void,
  },
  db_delete_task_tag: { params: { id: '' as string }, result: undefined as void },
  db_get_task_tag_by_tag: { params: { tag: '' as string }, result: null as unknown },
  db_get_tasks_for_account: {
    params: {
      accountId: null as string | null,
      includeCompleted: false as boolean,
    },
    result: [] as unknown[],
  },
  db_get_tasks_with_contacts: {
    params: {
      accountId: null as string | null,
      includeCompleted: false as boolean,
    },
    result: [] as unknown[],
  },
  db_get_tasks_for_thread: {
    params: { threadId: '' as string, accountId: '' as string },
    result: [] as unknown[],
  },
  db_get_subtasks: {
    params: { parentId: '' as string },
    result: [] as unknown[],
  },
  db_tasks_count_by_contact: { params: {} as EmptyParams, result: [] as unknown[] },
  db_dashboard_tasks_due_today: { params: {} as EmptyParams, result: 0 as number },
  db_dashboard_tasks_incomplete: { params: {} as EmptyParams, result: 0 as number },
  db_dashboard_tasks_overdue: { params: {} as EmptyParams, result: 0 as number },

  // ── Subsystem lifecycle ───────────────────────────────────────
  get_subsystem_status: {
    params: {} as EmptyParams,
    result: [] as SubsystemStatusResponse[],
  },
  db_health_stats: {
    params: {} as EmptyParams,
    result: {} as Record<string, unknown>,
  },
  db_sync_status: {
    params: {} as EmptyParams,
    result: [] as unknown[],
  },
  db_bootstrap_state: {
    params: {} as EmptyParams,
    result: {} as Record<string, unknown>,
  },
  db_status_snapshot: {
    params: {} as EmptyParams,
    result: {} as Record<string, unknown>,
  },
  db_set_offline_available: {
    params: {
      id: '' as string,
      accountId: '' as string,
      folderId: undefined as string | undefined,
      contactId: undefined as string | undefined,
      reason: '' as string,
      enabled: true as boolean,
    },
    result: undefined as void,
  },
  db_remove_offline_available: {
    params: { id: '' as string },
    result: undefined as void,
  },
  db_list_offline_available: {
    params: { accountId: undefined as string | undefined },
    result: [] as unknown[],
  },
  complete_onboarding: {
    params: {} as EmptyParams,
    result: undefined as void,
  },
  get_tool_state: {
    params: {} as EmptyParams,
    result: [] as [string, boolean][],
  },
  apply_tool_state: {
    params: { updates: [] as [string, boolean][] },
    result: undefined as void,
  },
} as const;

// ============================================================================
// TYPE HELPERS
// ============================================================================

export type CommandName = keyof typeof TauriCommands;

export type CommandParams<T extends CommandName> = T extends CommandName
  ? (typeof TauriCommands)[T] extends { params: infer P }
    ? P
    : never
  : never;

export type CommandResult<T extends CommandName> = T extends CommandName
  ? (typeof TauriCommands)[T] extends { result: infer R }
    ? R
    : never
  : never;
