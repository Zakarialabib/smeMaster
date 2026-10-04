import { describe, expect, it } from 'vitest';
import { agentApi, AgentClientError, __setBaseUrlForTests } from './client';

/**
 * The client against the REAL agent-core.
 *
 * There is no mock and no hand-rolled fake server here, and that is a deliberate
 * correction. The first version of this file spun up a node:http server that
 * re-implemented the four routes — which means it tested the fake, and would
 * have passed while the real client used a wrong path, wrong verb, or an error
 * shape the server never sends. A duplicated fake is worse than no test, because
 * it looks like coverage.
 *
 * So these tests hit a running agent-core. They are SKIPPED when one is not
 * reachable, which is the honest outcome: the CI job starts
 * `uvicorn agent_core.api:app --port 8788` and then they run for real.
 *
 *   uvicorn agent_core.api:app --port 8788
 *   npm test -- src/features/agent/api
 */

const BASE = 'http://127.0.0.1:8788';

async function reachable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/healthz`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

const live = await reachable();

describe.skipIf(!live)('agentApi against a live agent-core', () => {
  it('reads health', async () => {
    const h = await agentApi.health();
    expect(h.ok).toBe(true);
    expect(typeof h.version).toBe('string');
  });

  it('reads a snapshot whose shape the console expects', async () => {
    const snap = await agentApi.opsSnapshot();
    expect(Object.keys(snap).sort()).toEqual([
      'callCount',
      'containedPct',
      'generatedAt',
      'lastSeenAt',
      'p1',
      'p2Grouped',
      'p3Count',
      'reachable',
      'since',
    ]);
    expect(typeof snap.reachable).toBe('boolean');
  });

  it('unwraps providerHealth from the dev variant', async () => {
    const health = await agentApi.providerHealth();
    expect(health.length).toBeGreaterThan(0);
    for (const p of health) expect(p.state).toMatch(/^(ok|degraded|down)$/);
  });

  it('creates a test session and gets a real ULID back', async () => {
    const s = await agentApi.createSession({ channel: 'voice', purpose: 'test_call' });
    expect(s.sessionId).toMatch(/^01J[0-9A-Z]{20}$/);
    expect(s.disclosure.length).toBeGreaterThan(0);
  });

  it('turns a refused live caller override into a typed error', async () => {
    // The exact shape the console sends, against the guard that was silently
    // inert because SessionRequest inherited BaseModel. This is the test that
    // would have caught it.
    const err = await agentApi
      .createSession({ channel: 'voice', purpose: 'live', callerOverride: '+33612345678' })
      .catch((e: unknown) => e as AgentClientError);

    expect(err).toBeInstanceOf(AgentClientError);
    expect((err as AgentClientError).status).toBe(403);
    expect((err as AgentClientError).code).toBe('caller_override_not_allowed');
    expect((err as AgentClientError).isUnreachable).toBe(false);
  });

  it('reads the call log with the shape the Calls tab expects', async () => {
    const page = await agentApi.listCalls();
    expect(Object.keys(page).sort()).toEqual(['items', 'reachable', 'total']);
    expect(Array.isArray(page.items)).toBe(true);
    // Empty is a legitimate answer, but reachability must still be reported —
    // that is what stops "no calls" standing in for "agent is down".
    expect(typeof page.reachable).toBe('boolean');
  });

  it('never returns an unmasked number in the call log', async () => {
    const page = await agentApi.listCalls();
    for (const item of page.items) {
      expect(item.callerMasked).toMatch(/\*|x{2,}|•/i);
    }
  });

  it('404s a missing call as a typed error, not a crash', async () => {
    const err = (await agentApi.getCall('nope').catch((e: unknown) => e)) as AgentClientError;
    expect(err).toBeInstanceOf(AgentClientError);
    expect(err.status).toBe(404);
    expect(err.code).toBe('call_not_found');
  });

  it('reads the alert list', async () => {
    const page = await agentApi.listAlerts();
    expect(Object.keys(page).sort()).toEqual(['items', 'reachable', 'total']);
    expect(typeof page.reachable).toBe('boolean');
  });

  it('filters alerts by severity', async () => {
    const p1 = await agentApi.listAlerts('P1');
    for (const a of p1.items) expect(a.severity).toBe('P1');
  });

  it('reads and writes config', async () => {
    const before = await agentApi.getConfig();
    expect(typeof before.consentVariant).toBe('string');
    const after = await agentApi.updateConfig({ tier: 'premium' });
    expect(after.tier).toBe('premium');
    // Restore, so a repeated run is not order-dependent.
    await agentApi.updateConfig({ tier: before.tier });
  });
});

describe('agentApi error classification (no server needed)', () => {
  it('marks a network failure as unreachable, not as an API error', async () => {
    // Port 1 is reserved and refuses immediately — no server needed, so this
    // runs everywhere including CI without agent-core.
    __setBaseUrlForTests('http://127.0.0.1:1');
    try {
      const err = (await agentApi.health().catch((e: unknown) => e)) as AgentClientError;
      expect(err).toBeInstanceOf(AgentClientError);
      expect(err.isUnreachable).toBe(true);
      expect(err.status).toBe(0);
      expect(err.retryable).toBe(true);
    } finally {
      __setBaseUrlForTests(null);
    }
  });

  it('the base URL override actually takes effect', async () => {
    // A guard on the guard. The first version of this file set
    // import.meta.env.VITE_AGENT_CORE_URL at runtime, which Vite has already
    // inlined — so the override silently did nothing and the test above passed
    // for the wrong reason. This asserts the override is real.
    __setBaseUrlForTests('http://127.0.0.1:1');
    try {
      await expect(agentApi.health()).rejects.toBeInstanceOf(AgentClientError);
    } finally {
      __setBaseUrlForTests(null);
    }
  });

  it('an API error is NOT unreachable', () => {
    const e = new AgentClientError(403, 'caller_override_not_allowed', 'no', false);
    expect(e.isUnreachable).toBe(false);
    expect(e.retryable).toBe(false);
  });
});

if (!live) {
  describe('agent-core is not running', () => {
    it.skip(`live client tests skipped — start: uvicorn agent_core.api:app --port 8788 (${BASE})`, () => {});
  });
}
