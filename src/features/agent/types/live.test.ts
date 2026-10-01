import { describe, expect, it } from 'vitest';
import { OPS_SNAPSHOT_FIXTURE, SESSION_RESPONSE_FIXTURE, providerHealth } from './fixtures';

/**
 * The console is developed against a REAL agent-core, not against hand-written
 * fixtures. These tests assert that the TypeScript types accept what the server
 * ACTUALLY sends, using payloads captured from a live dev server
 * (2026-09-28, /ops/snapshot and POST /session).
 *
 * Why capture instead of hand-write: a fixture written by the same person who
 * wrote the type proves the type matches their belief. These came out of curl.
 * Every key below is a real response key, so a renamed or missing field on the
 * server fails here rather than rendering as `undefined` in the console.
 *
 * Regenerate after a contract change:
 *   curl -s localhost:8788/ops/snapshot > tests/fixtures/ops-snapshot.json
 *   curl -s -X POST localhost:8788/session -H 'Content-Type: application/json' \
 *        -d '{"channel":"voice","purpose":"test_call"}' > tests/fixtures/session.json
 */

describe('live agent-core payloads', () => {
  it('a real session response satisfies the TS type', () => {
    const s = SESSION_RESPONSE_FIXTURE;
    expect(typeof s.sessionId).toBe('string');
    expect(typeof s.openedAt).toBe('string');
    expect(typeof s.wsUrl).toBe('string');
    expect(typeof s.disclosure).toBe('string');
    // A ULID, and NOT a UUID: the id is minted in Python and its shape is load-
    // bearing for ordering the call log.
    expect(s.sessionId).toMatch(/^01J[0-9A-Z]{20}$/);
  });

  it('a real ops snapshot satisfies the TS type, key for key', () => {
    const snap = OPS_SNAPSHOT_FIXTURE;
    expect(Object.keys(snap).sort()).toEqual(
      [
        'callCount',
        'containedPct',
        'generatedAt',
        'lastSeenAt',
        'p1',
        'p2Grouped',
        'p3Count',
        'reachable',
        'since',
      ].sort(),
    );
  });

  it('every alert carries the fields the console renders', () => {
    const alerts = [
      ...OPS_SNAPSHOT_FIXTURE.p1,
      ...Object.values(OPS_SNAPSHOT_FIXTURE.p2Grouped).flat(),
    ];
    expect(alerts.length).toBeGreaterThan(0);
    for (const a of alerts) {
      expect(a.id).toBeTruthy();
      expect(['P1', 'P2', 'P3']).toContain(a.severity);
      expect(a.rule).toBeTruthy();
      expect(a.oneLiner).toBeTruthy();
      // The one that is easy to forget and impossible to render without.
      expect(a.decision).toBeTruthy();
      expect(a.evidence.count).toBeGreaterThan(0);
      expect(a.evidence.blastRadius).toBeTruthy();
      // Provisional thresholds must be explicit, or the console presents a guess
      // as an agreed limit.
      expect(typeof a.thresholdIsProvisional).toBe('boolean');
    }
  });

  it('p2 is grouped by rule, so N failures read as ONE problem', () => {
    const grouped = OPS_SNAPSHOT_FIXTURE.p2Grouped;
    const rules = Object.keys(grouped);
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(Array.isArray(grouped[r])).toBe(true);
  });

  it('reachable is a real boolean, never a missing field', () => {
    // "Cannot reach the agent" and "no calls" are different screens. A missing
    // field renders as the wrong one.
    expect(typeof OPS_SNAPSHOT_FIXTURE.reachable).toBe('boolean');
  });

  it('provider health deserialises with both null and numeric latency', () => {
    // Telnyx legitimately reports no p95. A type of `number` alone would render
    // NaN in the Cost page instead of an em-dash.
    const h = providerHealth();
    const numeric = h.find((x) => typeof x.latencyP95Ms === 'number');
    const nulled = h.find((x) => x.latencyP95Ms === null);
    expect(numeric).toBeDefined();
    expect(nulled).toBeDefined();
    for (const p of h) {
      expect(p.state).toMatch(/^(ok|degraded|down)$/);
      expect(typeof p.fallbackActive).toBe('boolean');
    }
  });

  it('no payload anywhere carries a tenant id', () => {
    // Identity is derived from the token server-side. If a tenantId ever appears
    // in a response, the server is echoing a value the client should not have.
    const blob = JSON.stringify({
      session: SESSION_RESPONSE_FIXTURE,
      snapshot: OPS_SNAPSHOT_FIXTURE,
      health: providerHealth(),
    }).toLowerCase();
    expect(blob).not.toContain('tenantid');
    expect(blob).not.toContain('tenant_id');
  });

  it('no payload anywhere carries audio', () => {
    // Retention of TEXT is an open client question. Audio is decided: no audio,
    // ever, so nothing that could hold a blob may appear in a response.
    const blob = JSON.stringify({
      session: SESSION_RESPONSE_FIXTURE,
      snapshot: OPS_SNAPSHOT_FIXTURE,
      health: providerHealth(),
    }).toLowerCase();
    for (const banned of ['audio', 'recording', 'pcm', 'wav', 'blob_url']) {
      expect(blob).not.toContain(banned);
    }
  });
});
