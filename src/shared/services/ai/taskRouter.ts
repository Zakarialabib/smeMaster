/**
 * Task Router — per-task provider+model routing.
 *
 * Replaces "one active provider" with "provider for this task."
 * Each task can be routed to a different provider+model combination.
 * User overrides are stored in settings as JSON.
 *
 * Extended with:
 * - Fallback chains (array, not single) for production resilience
 * - Cost-aware routing with provider scoring
 * - Rate-limit retry semantics
 *
 * @module
 */

import { getSetting, setSetting } from '@features/settings/db/settings';
import type { AiProvider } from './types';
import { MODEL_REGISTRY, type ModelDefinition } from './modelRegistry';
import type { FallbackEntry, CostInfo } from './capabilities';

// ── Task Definitions ───────────────────────────────────────────────────────

export type AiTask =
  | 'email.classify'
  | 'email.summarize'
  | 'email.compose'
  | 'email.reply'
  | 'email.smart_reply'
  | 'email.improve'
  | 'email.shorten'
  | 'email.formalize'
  | 'email.ask_inbox'
  | 'email.extract_task'
  | 'email.smart_label'
  | 'email.quality_check'
  | 'rag.query'
  | 'voice.stt'
  | 'voice.tts';

export interface TaskRoute {
  task: AiTask;
  provider: AiProvider;
  model: string;
  fallbacks: FallbackEntry[];
  costInfo?: CostInfo;
}

// ── Default Routing Table ──────────────────────────────────────────────────

export const DEFAULT_TASK_ROUTES: Record<AiTask, TaskRoute> = {
  'email.classify': {
    task: 'email.classify',
    provider: 'openai',
    model: 'gpt-4.1-nano',
    fallbacks: [
      { provider: 'mistral', model: 'mistral-small' },
      { provider: 'gemini', model: 'gemini-2.5-flash' },
    ],
    costInfo: { inputPer1M: 0.1, outputPer1M: 0.4 },
  },
  'email.summarize': {
    task: 'email.summarize',
    provider: 'openai',
    model: 'gpt-4o-mini',
    fallbacks: [
      { provider: 'gemini', model: 'gemini-2.5-flash' },
      { provider: 'mistral', model: 'mistral-small' },
    ],
    costInfo: { inputPer1M: 0.15, outputPer1M: 0.6 },
  },
  'email.compose': {
    task: 'email.compose',
    provider: 'claude',
    model: 'claude-sonnet-4-20250514',
    fallbacks: [
      { provider: 'openai', model: 'gpt-4.1' },
      { provider: 'gemini', model: 'gemini-2.5-pro' },
    ],
    costInfo: { inputPer1M: 3.0, outputPer1M: 15.0 },
  },
  'email.reply': {
    task: 'email.reply',
    provider: 'claude',
    model: 'claude-sonnet-4-20250514',
    fallbacks: [
      { provider: 'openai', model: 'gpt-4.1' },
      { provider: 'gemini', model: 'gemini-2.5-pro' },
    ],
    costInfo: { inputPer1M: 3.0, outputPer1M: 15.0 },
  },
  'email.smart_reply': {
    task: 'email.smart_reply',
    provider: 'openai',
    model: 'gpt-4.1-nano',
    fallbacks: [
      { provider: 'gemini', model: 'gemini-2.5-flash' },
      { provider: 'mistral', model: 'mistral-small' },
    ],
    costInfo: { inputPer1M: 0.1, outputPer1M: 0.4 },
  },
  'email.improve': {
    task: 'email.improve',
    provider: 'openai',
    model: 'gpt-4o-mini',
    fallbacks: [
      { provider: 'gemini', model: 'gemini-2.5-flash' },
      { provider: 'mistral', model: 'mistral-small' },
    ],
    costInfo: { inputPer1M: 0.15, outputPer1M: 0.6 },
  },
  'email.shorten': {
    task: 'email.shorten',
    provider: 'openai',
    model: 'gpt-4.1-nano',
    fallbacks: [
      { provider: 'gemini', model: 'gemini-2.5-flash' },
      { provider: 'mistral', model: 'mistral-small' },
    ],
    costInfo: { inputPer1M: 0.1, outputPer1M: 0.4 },
  },
  'email.formalize': {
    task: 'email.formalize',
    provider: 'openai',
    model: 'gpt-4.1-nano',
    fallbacks: [
      { provider: 'gemini', model: 'gemini-2.5-flash' },
      { provider: 'mistral', model: 'mistral-small' },
    ],
    costInfo: { inputPer1M: 0.1, outputPer1M: 0.4 },
  },
  'email.ask_inbox': {
    task: 'email.ask_inbox',
    provider: 'openai',
    model: 'gpt-4o',
    fallbacks: [
      { provider: 'gemini', model: 'gemini-2.5-pro' },
      { provider: 'claude', model: 'claude-sonnet-4-20250514' },
    ],
    costInfo: { inputPer1M: 2.5, outputPer1M: 10.0 },
  },
  'email.extract_task': {
    task: 'email.extract_task',
    provider: 'openai',
    model: 'gpt-4.1-nano',
    fallbacks: [
      { provider: 'gemini', model: 'gemini-2.5-flash' },
      { provider: 'mistral', model: 'mistral-small' },
    ],
    costInfo: { inputPer1M: 0.1, outputPer1M: 0.4 },
  },
  'email.smart_label': {
    task: 'email.smart_label',
    provider: 'openai',
    model: 'gpt-4.1-nano',
    fallbacks: [
      { provider: 'gemini', model: 'gemini-2.5-flash' },
      { provider: 'mistral', model: 'mistral-small' },
    ],
    costInfo: { inputPer1M: 0.1, outputPer1M: 0.4 },
  },
  'email.quality_check': {
    task: 'email.quality_check',
    provider: 'openai',
    model: 'gpt-4o-mini',
    fallbacks: [
      { provider: 'gemini', model: 'gemini-2.5-flash' },
      { provider: 'mistral', model: 'mistral-small' },
    ],
    costInfo: { inputPer1M: 0.15, outputPer1M: 0.6 },
  },
  'rag.query': {
    task: 'rag.query',
    provider: 'openai',
    model: 'text-embedding-3-small',
    fallbacks: [
      { provider: 'gemini', model: 'gemini-embedding-2' },
      { provider: 'mistral', model: 'mistral-embed' },
    ],
    costInfo: { inputPer1M: 0.02, outputPer1M: 0 },
  },
  'voice.stt': {
    task: 'voice.stt',
    provider: 'openai',
    model: 'whisper-1',
    fallbacks: [{ provider: 'mistral', model: 'voxtral-realtime' }],
    costInfo: { inputPer1M: 0.006, outputPer1M: 0 },
  },
  'voice.tts': {
    task: 'voice.tts',
    provider: 'openai',
    model: 'tts-1',
    fallbacks: [{ provider: 'byteplus', model: 'seed-tts' }],
    costInfo: { inputPer1M: 0.015, outputPer1M: 0 },
  },
};

// ── Settings Persistence ───────────────────────────────────────────────────

const TASK_ROUTE_SETTINGS_KEY = 'ai_task_routes';

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
    return MODEL_REGISTRY.filter((m) => m.capabilities.embeddings && !m.deprecated).map(
      (m) => m.provider,
    );
  }
  if (cap.stt) {
    return MODEL_REGISTRY.filter((m) => m.capabilities.stt && !m.deprecated).map((m) => m.provider);
  }
  if (cap.tts) {
    return MODEL_REGISTRY.filter((m) => m.capabilities.tts && !m.deprecated).map((m) => m.provider);
  }
  // text capability
  return MODEL_REGISTRY.filter((m) => m.capabilities.text && !m.deprecated).map((m) => m.provider);
}

// ── Cost-Aware Routing ─────────────────────────────────────────────────────

/**
 * Score a provider for a task by (quality × capability_match) / cost.
 * Higher score = better choice.
 */
export function scoreProviderForTask(provider: AiProvider, task: AiTask): number {
  const route = DEFAULT_TASK_ROUTES[task];
  const model = MODEL_REGISTRY.find((m) => m.id === route.model && m.provider === provider);
  if (!model) return 0;

  // Quality score based on tier
  const qualityScores: Record<string, number> = {
    flagship: 1.0,
    balanced: 0.8,
    fast: 0.6,
    budget: 0.4,
  };
  const quality = qualityScores[model.tier] ?? 0.5;

  // Capability match
  const cap = model.capabilities;
  const taskModel = MODEL_REGISTRY.find((m) => m.id === route.model);
  const requiredCaps = taskModel?.capabilities;
  let capabilityMatch = 1.0;
  if (requiredCaps) {
    if (requiredCaps.embeddings && !cap.embeddings) capabilityMatch *= 0.5;
    if (requiredCaps.stt && !cap.stt) capabilityMatch *= 0.5;
    if (requiredCaps.tts && !cap.tts) capabilityMatch *= 0.5;
    if (requiredCaps.vision && !cap.vision) capabilityMatch *= 0.8;
  }

  // Cost score (lower cost = higher score)
  const cost = model.pricing?.inputPer1M ?? 1.0;
  const costScore = 1.0 / (1.0 + cost);

  return quality * capabilityMatch * costScore * 100;
}

/**
 * Get the best provider for a task based on cost-aware scoring.
 */
export function getBestProviderForTask(task: AiTask): AiProvider {
  const providers = getProvidersForTask(task);
  let bestProvider = DEFAULT_TASK_ROUTES[task].provider;
  let bestScore = 0;

  for (const provider of providers) {
    const score = scoreProviderForTask(provider, task);
    if (score > bestScore) {
      bestScore = score;
      bestProvider = provider;
    }
  }

  return bestProvider;
}

// ── Rate-Limit Retry Semantics ─────────────────────────────────────────────

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

/**
 * Execute a function with retry logic for rate-limit and transient errors.
 * Uses exponential backoff with jitter.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, retryableStatuses } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Check if error is retryable
      const status = (err as { status?: number })?.status;
      if (status && !retryableStatuses.includes(status)) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
          maxDelayMs,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
