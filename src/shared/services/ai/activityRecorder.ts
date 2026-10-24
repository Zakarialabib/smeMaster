/**
 * AI activity recorder — writes one row per AI call to the `ai_activity` table.
 *
 * The Activity surface (and cost metering) reads from this table. Without a
 * writer the table stays empty and the surface has nothing to show, so this
 * module is the single funnel every AI call must pass through.
 *
 * Design constraints:
 *   - Never throw. Recording is observability, not the operation: a failed
 *     INSERT must not fail the user's AI call. Failures are logged and dropped.
 *   - Never block. The call is fire-and-forget so it adds no latency to the
 *     critical path.
 *   - Never leak secrets. Only metadata (provider, model, token counts) is
 *     recorded — never prompt or response text.
 *
 * @module
 */

import { recordActivity, type RecordActivityInput } from '@shared/services/db/invoke/agents';

/** Outcome of an AI call, matching the Rust `outcome` column vocabulary. */
export type ActivityOutcome = 'ok' | 'error' | 'denied';

export interface AiCallRecord {
  /** Which agent made the call, when known. */
  agentId?: string;
  /** The task-router task this call served, e.g. 'email.reply'. */
  task?: string;
  provider: string;
  model: string;
  outcome?: ActivityOutcome;
  /** Error message or denial reason. Never prompt/response content. */
  detail?: string;
  promptTokens?: number;
  completionTokens?: number;
  /** Cost in minor units (centimes), matching the invoicing module. */
  costMinor?: number;
  currency?: string;
  latencyMs?: number;
  /** Names of guardrails that fired on this call. */
  guardrails?: string[];
}

/**
 * Record one AI call.
 *
 * Fire-and-forget: returns immediately, never rejects. Callers do not await
 * this on the critical path.
 */
export function recordAiCall(record: AiCallRecord): void {
  const payload: RecordActivityInput = {
    agentId: record.agentId,
    task: record.task,
    provider: record.provider,
    model: record.model,
    outcome: record.outcome ?? 'ok',
    detail: record.detail,
    promptTokens: record.promptTokens,
    completionTokens: record.completionTokens,
    costMinor: record.costMinor,
    currency: record.currency,
    latencyMs: record.latencyMs,
    guardrails: record.guardrails,
  };

  void recordActivity(payload).catch((err) => {
    // Observability must never break the operation it observes. A missing
    // Tauri backend (plain browser / dev server) is expected and silent.
    if (typeof err === 'object' && err !== null && 'isTauriUnavailable' in err) return;
    console.warn('[activity] failed to record AI call:', err);
  });
}

/**
 * Wrap an async AI call, recording its outcome and latency.
 *
 * Use this at call sites that want timing captured without hand-rolling the
 * clock. The wrapped promise's result/error is passed through unchanged.
 */
export async function withActivityRecording<T>(
  meta: Omit<AiCallRecord, 'outcome' | 'latencyMs' | 'detail'>,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    recordAiCall({ ...meta, outcome: 'ok', latencyMs: Date.now() - started });
    return result;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    recordAiCall({
      ...meta,
      outcome: 'error',
      detail,
      latencyMs: Date.now() - started,
    });
    throw err;
  }
}
