import type {
  CallListItem,
  CallOutcome,
  OpsSnapshot,
  ProviderHealth,
  SessionRequest,
  SessionResponse,
} from '../types/commands';

/**
 * The HTTP client for agent-core.
 *
 * One place that knows the base URL, one place that turns a non-2xx into an
 * `AgentClientError`, and no other. The reason that matters: the console has
 * exactly one error parser, so a new endpoint cannot invent a new failure shape.
 *
 * **No tenant id, ever.** It is not a parameter on any function here, so there
 * is no call site that could pass one. Identity comes from the token, server
 * side (ADR-001 D4a).
 *
 * Note this is a plain fetch wrapper, not a Tauri invoke. The desktop calls
 * through Rust (`src-tauri/src/agent/client.rs`) so the token is read from the
 * auth store and never crosses the IPC boundary as an argument; this module is
 * the browser/dev path against the same contract, which is what lets the console
 * be developed against a running server before the Rust layer is wired.
 */

export class AgentClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, code: string, message: string, retryable = false) {
    super(message);
    this.name = 'AgentClientError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }

  /** "Cannot reach the agent" is a different screen from "no calls". */
  get isUnreachable(): boolean {
    return this.status === 0;
  }
}

/**
 * Base URL resolution.
 *
 * `import.meta.env.VITE_AGENT_CORE_URL` is INLINED by Vite at build time into a
 * string literal. Reading it that way means it cannot be changed at runtime, so
 * a test that tries to point the client at another port silently keeps hitting
 * the original — which is exactly the bug this comment was written after.
 *
 * So: read it through bracket access (not inlined), and allow an explicit
 * override for tests. The override is module state, not a global, so two
 * concurrent tests cannot fight over it.
 */
let overrideBaseUrl: string | null = null;

/** Point the client somewhere else. Test-only; pass `null` to restore. */
export function __setBaseUrlForTests(url: string | null): void {
  overrideBaseUrl = url;
}

function baseUrl(): string {
  if (overrideBaseUrl !== null) return overrideBaseUrl;
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  // Bracket access, deliberately: `env.VITE_X` is inlined, `env['VITE_X']` is not.
  return env?.['VITE_AGENT_CORE_URL'] ?? 'http://127.0.0.1:8788';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (e) {
    // Network failure, not an HTTP error. status 0 marks it, so the console can
    // show "cannot reach" instead of inventing an API error.
    throw new AgentClientError(0, 'unreachable', (e as Error).message, true);
  }

  if (!res.ok) {
    // The server always returns the same envelope, whether the error came from
    // a route or from an exception handler. One parser, one shape.
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string; retryable?: boolean };
    } | null;
    throw new AgentClientError(
      res.status,
      body?.error?.code ?? 'unknown',
      body?.error?.message ?? `HTTP ${res.status}`,
      body?.error?.retryable ?? false,
    );
  }
  return (await res.json()) as T;
}

export const agentApi = {
  health: () => request<{ ok: boolean; version: string }>('/healthz'),

  opsSnapshot: () => request<OpsSnapshot>('/ops/snapshot'),

  providerHealth: () =>
    request<OpsSnapshot & { providerHealth: ProviderHealth[] }>('/ops/snapshot/dev').then(
      (s) => s.providerHealth,
    ),

  /**
   * `callerOverride` is for `purpose: 'test_call'` only. The server refuses it
   * otherwise with 403 — and the client does not help you work around that,
   * which is the point.
   *
   * The parameter type is `SessionRequest` as-is. It was briefly written as
   * `Omit<SessionRequest, 'tenantId'>`, which is a no-op that implies a
   * tenantId field exists and is being removed. There is no such field, and
   * writing the Omit would suggest to a reader that one might be added.
   */
  createSession: (body: SessionRequest) =>
    request<SessionResponse>('/session', { method: 'POST', body: JSON.stringify(body) }),
};

/** The call list is not implemented server-side yet; this keeps the shape honest. */
export type { CallListItem, CallOutcome };
