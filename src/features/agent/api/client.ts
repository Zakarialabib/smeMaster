import type { Health, OpsSnapshot, ProviderHealth, AgentConfig } from '../types/commands';

/**
 * The HTTP client for agent-core.
 *
 * One place that knows the base URL, one place that turns a non-2xx into
 * an `AgentClientError`, and no other. The console has exactly one error
 * parser, so a new endpoint cannot invent a new failure shape.
 *
 * **No tenant id, ever.** It is not a parameter on any function here, so
 * there is no call site that could pass one. Identity comes from the token,
 * server side (ADR-001 D4a).
 *
 * Note this is a plain fetch wrapper, not a Tauri invoke. The desktop calls
 * through Rust (`src-tauri/src/agent/client.rs`) so the token is read from the
 * auth store and never crosses the IPC boundary as an argument; this module is
 * the browser/dev path against the same contract.
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

  get isUnreachable(): boolean {
    return this.status === 0;
  }
}

let overrideBaseUrl: string | null = null;

export function __setBaseUrlForTests(url: string | null): void {
  overrideBaseUrl = url;
}

function baseUrl(): string {
  if (overrideBaseUrl !== null) return overrideBaseUrl;
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
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
    throw new AgentClientError(0, 'unreachable', (e as Error).message, true);
  }

  if (!res.ok) {
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
  health: () => request<Health>('/healthz'),
  opsSnapshot: () => request<OpsSnapshot>('/ops/snapshot'),
  providerHealth: () =>
    request<OpsSnapshot & { providerHealth: ProviderHealth[] }>('/ops/snapshot/dev').then(
      (s) => s.providerHealth,
    ),
  getConfig: () => request<AgentConfig>('/config'),
  updateConfig: (body: Partial<AgentConfig>) =>
    request<AgentConfig>('/config', { method: 'PUT', body: JSON.stringify(body) }),
};
