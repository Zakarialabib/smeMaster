/**
 * Task Router — per-task provider+model routing.
 *
 * Replaces "one active provider" with "provider for this task."
 * Each task can be routed to a different provider+model combination.
 * User overrides are stored in settings as JSON.
 *
 * @module
 */

import { getSetting, setSetting } from "@features/settings/db/settings";
import type { AiProvider } from "./types";
import { MODEL_REGISTRY, type ModelDefinition } from "./modelRegistry";

// ── Task Definitions ───────────────────────────────────────────────────────

export type AiTask =
  | "email.classify"
  | "email.summarize"
  | "email.compose"
  | "email.reply"
  | "email.smart_reply"
  | "email.improve"
  | "email.shorten"
  | "email.formalize"
  | "email.ask_inbox"
  | "email.extract_task"
  | "email.smart_label"
  | "email.quality_check"
  | "rag.query"
  | "voice.stt"
  | "voice.tts";

export interface TaskRoute {
  task: AiTask;
  provider: AiProvider;
  model: string;
  fallback?: { provider: AiProvider; model: string };
}

// ── Default Routing Table ──────────────────────────────────────────────────

export const DEFAULT_TASK_ROUTES: Record<AiTask, TaskRoute> = {
  "email.classify": { task: "email.classify", provider: "openai", model: "gpt-4.1-nano" },
  "email.summarize": { task: "email.summarize", provider: "openai", model: "gpt-4o-mini" },
  "email.compose": { task: "email.compose", provider: "claude", model: "claude-sonnet-4-20250514" },
  "email.reply": { task: "email.reply", provider: "claude", model: "claude-sonnet-4-20250514" },
  "email.smart_reply": { task: "email.smart_reply", provider: "openai", model: "gpt-4.1-nano" },
  "email.improve": { task: "email.improve", provider: "openai", model: "gpt-4o-mini" },
  "email.shorten": { task: "email.shorten", provider: "openai", model: "gpt-4.1-nano" },
  "email.formalize": { task: "email.formalize", provider: "openai", model: "gpt-4.1-nano" },
  "email.ask_inbox": { task: "email.ask_inbox", provider: "openai", model: "gpt-4o" },
  "email.extract_task": { task: "email.extract_task", provider: "openai", model: "gpt-4.1-nano" },
  "email.smart_label": { task: "email.smart_label", provider: "openai", model: "gpt-4.1-nano" },
  "email.quality_check": { task: "email.quality_check", provider: "openai", model: "gpt-4o-mini" },
  "rag.query": { task: "rag.query", provider: "openai", model: "text-embedding-3-small" },
  "voice.stt": { task: "voice.stt", provider: "openai", model: "whisper-1" },
  "voice.tts": { task: "voice.tts", provider: "openai", model: "tts-1" },
};

// ── Settings Persistence ───────────────────────────────────────────────────

const TASK_ROUTE_SETTINGS_KEY = "ai_task_routes";

interface TaskRouteOverrides {
  [task: string]: TaskRoute;
}

async function getTaskRouteOverrides(): Promise<TaskRouteOverrides> {
  try {
    const raw = await getSetting(TASK_ROUTE_SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as TaskRouteOverrides;
  } catch {
    return {};
  }
}

async function setTaskRouteOverrides(overrides: TaskRouteOverrides): Promise<void> {
  await setSetting(TASK_ROUTE_SETTINGS_KEY, JSON.stringify(overrides));
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get the routing configuration for a specific task.
 * Returns user override if set, otherwise the default route.
 */
export async function getTaskRoute(task: AiTask): Promise<TaskRoute> {
  const overrides = await getTaskRouteOverrides();
  return overrides[task] ?? DEFAULT_TASK_ROUTES[task];
}

/**
 * Set a user override for a specific task route.
 */
export async function setTaskRoute(task: AiTask, route: TaskRoute): Promise<void> {
  const overrides = await getTaskRouteOverrides();
  overrides[task] = route;
  await setTaskRouteOverrides(overrides);
}

/**
 * Reset a task route to its default.
 */
export async function resetTaskRoute(task: AiTask): Promise<void> {
  const overrides = await getTaskRouteOverrides();
  delete overrides[task];
  await setTaskRouteOverrides(overrides);
}

/**
 * Get all task routes (defaults + overrides).
 */
export async function getAllTaskRoutes(): Promise<Record<AiTask, TaskRoute>> {
  const overrides = await getTaskRouteOverrides();
  return { ...DEFAULT_TASK_ROUTES, ...overrides };
}

/**
 * Get the model definition for a task's routed model.
 */
export async function getTaskModel(task: AiTask): Promise<ModelDefinition | undefined> {
  const route = await getTaskRoute(task);
  return MODEL_REGISTRY.find((m) => m.id === route.model && m.provider === route.provider);
}

/**
 * Get all available tasks as a list (for UI).
 */
export function getAllTasks(): AiTask[] {
  return Object.keys(DEFAULT_TASK_ROUTES) as AiTask[];
}

/**
 * Get all providers that support a given task's required capability.
 */
export function getProvidersForTask(task: AiTask): AiProvider[] {
  const route = DEFAULT_TASK_ROUTES[task];
  const model = MODEL_REGISTRY.find((m) => m.id === route.model);
  if (!model) return [route.provider];

  const cap = model.capabilities;
  if (cap.embeddings) {
    return MODEL_REGISTRY
      .filter((m) => m.capabilities.embeddings && !m.deprecated)
      .map((m) => m.provider);
  }
  if (cap.stt) {
    return MODEL_REGISTRY
      .filter((m) => m.capabilities.stt && !m.deprecated)
      .map((m) => m.provider);
  }
  if (cap.tts) {
    return MODEL_REGISTRY
      .filter((m) => m.capabilities.tts && !m.deprecated)
      .map((m) => m.provider);
  }
  // text capability
  return MODEL_REGISTRY
    .filter((m) => m.capabilities.text && !m.deprecated)
    .map((m) => m.provider);
}
