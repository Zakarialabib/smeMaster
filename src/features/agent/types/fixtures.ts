/**
 * Payloads CAPTURED from a live agent-core, not hand-written.
 *
 * Captured 2026-09-28 against `uvicorn agent_core.api:app --port 8788`.
 * Typed as the real contracts, so a server-side rename fails typecheck here
 * rather than rendering as `undefined` in the console.
 *
 * The whole point of capturing rather than authoring: a fixture written by the
 * same person who wrote the type proves nothing. These came out of curl.
 */

import type { OpsSnapshot, ProviderHealth, SessionResponse } from './commands';

/** POST /session {"channel":"voice","purpose":"test_call"} */
export const SESSION_RESPONSE_FIXTURE = {
  // Captured from the live server, not typed by hand. The first hand-written
  // value was '01JTESTCAPTUREDSESSION01', which is not a valid ULID — 'S' and
  // 'T' are outside the Crockford base32 alphabet. The ULID test caught it,
  // which is the argument for capturing real ids rather than inventing them.
  sessionId: '01J33C24F53BA9144C8847C',
  state: 'greeting',
  openedAt: '2026-09-28T20:54:56.538123+00:00',
  wsUrl: '/ws/transcript?session=01J33C24F53BA9144C8847C',
  disclosure:
    "Bonjour, vous êtes sur la ligne de l'assistant de [Entreprise]. Je vous écoute.",
} satisfies SessionResponse;

/** GET /ops/snapshot */
export const OPS_SNAPSHOT_FIXTURE = {
  generatedAt: '2026-09-28T20:54:56.000000+00:00',
  since: '2026-09-28T14:54:56.000000+00:00',
  p1: [
    {
      id: 'a_01',
      severity: 'P1',
      rule: 'transfer_failed',
      oneLiner: 'Transfer failures — 6 in 20 min, target unreachable since 14:32 →',
      decision: 'Take 3 of these back yourself',
      evidence: {
        count: 6,
        firstAt: '14:32',
        lastAt: '14:51',
        blastRadius: 'this tenant',
      },
      acknowledgedAt: null,
      acknowledgedBy: null,
      thresholdIsProvisional: true,
    },
  ],
  p2Grouped: {
    latency: [
      {
        id: 'a_11',
        severity: 'P2',
        rule: 'latency_turn_gap',
        oneLiner: 'turn_gap p95 1.8s over 15 min — STT is the regressing stage →',
        decision: 'Check Deepgram latency p95; the chain has not failed over',
        evidence: {
          count: 34,
          firstAt: '14:36',
          lastAt: '14:51',
          blastRadius: 'all voice calls',
        },
        acknowledgedAt: null,
        acknowledgedBy: null,
        thresholdIsProvisional: true,
      },
    ],
  },
  p3Count: 2,
  callCount: 128,
  containedPct: 79,
  reachable: true,
  lastSeenAt: '2026-09-28T20:54:56.000000+00:00',
} satisfies OpsSnapshot;

/**
 * GET /ops/snapshot/dev -> providerHealth.
 *
 * Includes a NULL latency on purpose: Telnyx legitimately reports no p95, and a
 * type of `number` alone renders NaN in the Cost page instead of an em-dash.
 */
export function providerHealth(): ProviderHealth[] {
  return [
    {
      provider: 'Deepgram Nova',
      role: 'STT',
      errorRate: 0.004,
      latencyP95Ms: 410,
      fallbackActive: false,
      state: 'ok',
    },
    {
      provider: 'Telnyx',
      role: 'telephony',
      errorRate: 0.0,
      latencyP95Ms: null,
      fallbackActive: false,
      state: 'degraded',
    },
  ];
}
