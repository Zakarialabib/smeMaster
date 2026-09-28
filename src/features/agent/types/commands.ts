/**
 * The wire contract, TypeScript side.
 *
 * Mirrors `services/agent-core/agent_core/contracts.py` field for field, and is
 * described in prose in `docs/voice/design/BACKEND.md` §13. **The Python file is
 * the source of truth** — it is what both sides are tested against. When the two
 * disagree, the Python wins and this file is the bug.
 *
 * Two things deliberately absent, and their absence is the design:
 *
 * - **No `tenantId` anywhere.** Tenant identity is derived server-side from the
 *   bearer token (`ADR-001` D4a). A field here would be a field a client could
 *   *set*, which is a security regression rather than a schema tidy-up. A test
 *   walks this file's exports and fails if one appears.
 * - **No audio type.** No audio is retained anywhere (`CALL-FLOW.md` §2), so
 *   there is no `audioUrl`, no `recordingId`, and therefore no play control.
 *
 * Provenance: ported from `prototype/voice-console/src/types.ts` (BUILD-PLAN
 * Phase A3). The two additions over the prototype are marked below.
 */

/* ── Enums (string unions, matching the StrEnum values exactly) ───────────── */

export type CallChannel = 'voice' | 'whatsapp';

export type CallOutcome = 'contained' | 'transferred' | 'voicemail' | 'abandoned';

/** Lifecycle order — `CALL-FLOW.md` §1. The order here IS the call's order. */
export type CallState =
  | 'idle'
  | 'connecting'
  | 'greeting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'closing'
  | 'wrapup';

export type Severity = 'P1' | 'P2' | 'P3';

export type ProviderTier = 'budget' | 'standard' | 'premium' | 'selfhosted';

export type AfterHoursMode = 'take_message' | 'transfer' | 'announce_only';

/** Voice is FR/EN only. A `Locale[]` here would be how "Darija next sprint" becomes silent scope creep. */
export type VoiceLocale = 'fr' | 'en';

/* ── Primitives ───────────────────────────────────────────────────────────── */

/** E.164, validated server-side. The client never constructs a raw number. */
export type E164 = string;

/** Emergency numbers are COPY, not locale: a French tenant shows 15/17/112 in
 *  every UI locale, including `ar` (`UX.md` §16). */
export const EMERGENCY_NUMBERS_FR = '15 · 17 · 112';

/* ── Health ───────────────────────────────────────────────────────────────── */

export interface Health {
  ok: boolean;
  version: string;
  startedAt: string;
  db: 'ok' | 'degraded' | 'down';
  providers: 'ok' | 'degraded' | 'down';
}

/* ── Session ──────────────────────────────────────────────────────────────── */

export type SessionPurpose = 'test_call' | 'live';

export interface SessionRequest {
  channel: CallChannel;
  purpose: SessionPurpose;
  locale?: VoiceLocale;
  /** Accepted ONLY when purpose === 'test_call'. Without that server-side guard a
   *  test endpoint becomes a call-placement primitive. */
  callerOverride?: E164;
}

export interface SessionResponse {
  sessionId: string;
  state: CallState;
  openedAt: string;
  wsUrl: string;
  disclosure: string;
}

/* ── Transcript ───────────────────────────────────────────────────────────── */

export interface StageMarks {
  vadMs: number | null;
  sttMs: number | null;
  llmMs: number | null;
  ttsMs: number | null;
  turnGapMs: number | null;
}

export type ServerFrame =
  | { type: 'state'; sessionId: string; state: CallState; at: string }
  | {
      type: 'delta';
      callId: string;
      turnId: number;
      /** Monotonic per (callId, turnId). The client dedups on it, so a reconnect
       *  replay cannot double-append. */
      seq: number;
      role: 'caller' | 'agent';
      text: string;
      final: boolean;
      at: string;
    }
  | ({ type: 'stages'; callId: string; turnId: number; at: string } & StageMarks)
  | {
      type: 'meta';
      callId: string;
      locale: VoiceLocale;
      fallbackActive: boolean;
      chainTier: ProviderTier;
    }
  | { type: 'closed'; callId: string; reason: string; at: string };

/**
 * Client → server has exactly ONE variant.
 *
 * There is no frame that acts on a call — no transfer, no hangup, no barge-in.
 * The absence is deliberate and reviewable: v1 has no mid-call operator action,
 * and a frame that could do it is a barge-in control wearing a disguise.
 * If you add a variant here, you have added a v1 feature that is out of scope.
 */
export interface ClientFrame {
  type: 'ping';
}

/* ── Ops ──────────────────────────────────────────────────────────────────── */

export interface AlertEvidence {
  count: number;
  firstAt: string;
  lastAt: string;
  blastRadius: string;
}

export interface OpsAlert {
  id: string;
  severity: Severity;
  rule: string;
  /** The decision, not a log line (`OPS-ASSISTANT.md` §5). */
  oneLiner: string;
  decision: string;
  evidence: AlertEvidence;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  /** True while the rule's threshold is still a placeholder pending pilot data.
   *  The console renders this provenance rather than a guess as a measurement. */
  thresholdIsProvisional: boolean;
}

export interface ProviderHealth {
  provider: string;
  role: 'STT' | 'TTS' | 'LLM' | 'EMBEDDING' | 'telephony' | 'whatsapp';
  errorRate: number;
  latencyP95Ms: number | null;
  fallbackActive: boolean;
  state: 'ok' | 'degraded' | 'down';
}

export interface OpsSnapshot {
  generatedAt: string;
  since: string;
  p1: OpsAlert[];
  /** Grouped by RULE, not by time: 6 transfer failures is one problem. */
  p2Grouped: Record<string, OpsAlert[]>;
  p3Count: number;
  callCount: number;
  containedPct: number;
  /**
   * NOT optional. `false` ⇒ render "we cannot reach the agent · last seen HH:MM",
   * never an empty list. Omitting this is how offline starts looking like no-calls.
   */
  reachable: boolean;
  lastSeenAt: string | null;
}

/* ── Call list ────────────────────────────────────────────────────────────── */

/** One row in the call log. `callerMasked` is masked **by default** — the full
 *  number is a deliberate extra step, not a rendering accident. */
export interface CallListItem {
  id: string;
  channel: CallChannel;
  outcome: CallOutcome;
  state: CallState;
  /** ISO 8601 UTC. Format for display at the edge, never in the store. */
  startedAt: string;
  durationSec: number;
  callerMasked: string;
  /** e.g. "pricing", or null. A flag is a judgement ⇒ renders in the AI purple. */
  flagged: string | null;
  /** `null` for WhatsApp service conversations — they cost €0 by policy. */
  costEur: number | null;
  containment: boolean;
}

/* ── WebSocket ────────────────────────────────────────────────────────────── */

/**
 * WS lifecycle (`FRONTEND.md` §12.4).
 *
 * `stale` and `reconnecting` exist so a frozen transcript is always *labelled*.
 * A dead socket that renders as an empty or unchanged transcript is
 * indistinguishable from a caller who stopped talking — the single most
 * expensive confusion this console can have.
 *
 * Transitions: idle →connecting →connected; socket close →stale →
 * reconnecting →(backoff)→ connected | offline; 5 failed retries → offline.
 */
export type WsStatus = 'idle' | 'connecting' | 'connected' | 'stale' | 'reconnecting' | 'offline';

/* ── Knowledge ────────────────────────────────────────────────────────────── */

export interface IngestRequest {
  source: string;
  scope: string;
  expectedChunks?: number;
}

/** `failed` and a null `chunks` must be representable — that is what makes a
 *  partial ingest visible instead of silent (`WIREFRAMES.md` G12). */
export interface IngestAccepted {
  jobId: string;
  state: 'queued' | 'running' | 'done' | 'failed';
  chunks: number | null;
  error: string | null;
}

export interface SearchRequest {
  query: string;
  topK?: number;
}

export interface SearchHit {
  docId: string;
  ordinal: number;
  text: string;
  score: number;
}

export interface SearchResponse {
  chunks: SearchHit[];
  embedder: string;
  /** Reported so a client can detect a space mismatch. It is CONFIG, never a
   *  constant in code (`ADR-001` D2). */
  dims: number;
}

/* ── Metering ─────────────────────────────────────────────────────────────── */

export interface CostRow {
  key: string;
  label: string;
  calls: number;
  /** `null` for WhatsApp service conversations — they cost €0, which is a policy
   *  consequence and must be explained in the UI, not shown as missing data. */
  minutes: number | null;
  actualEur: number;
  modelEur: number;
  overModel: boolean;
}

export interface MeteringRollup {
  from: string;
  to: string;
  groupBy: 'call_type' | 'day';
  rows: CostRow[];
  totals: { minutes: number; actualEur: number; modelEur: number };
}

/* ── Errors ───────────────────────────────────────────────────────────────── */

export interface ErrorBody {
  /** Stable. Branch on this, never on `message`. */
  code: string;
  message: string;
  retryable: boolean;
  provider?: string | null;
  at: string;
}

export interface ErrorResponse {
  error: ErrorBody;
}

/* ── ADDED over the prototype (A3) ────────────────────────────────────────── */

/**
 * A transfer attempt. The prototype did not model these, which is why its
 * "Open the 4 calls" button had nothing to drill into — the alert carried a count
 * but the calls it referred to were not in the payload.
 *
 * Its existence IS the "no transfer fails silently" rule: every attempt has a
 * result, and `result !== 'completed'` is queryable, so the console can show a
 * caller who is still waiting for a human who is not coming.
 */
export interface TransferAttempt {
  id: string;
  callId: string;
  trigger: 'keyword' | 'llm' | 'anger' | 'emergency';
  target: E164;
  requestedAt: string;
  completedAt: string | null;
  result: 'completed' | 'failed' | 'no_answer' | null;
  failureReason: string | null;
}

/**
 * Why a call counted as contained. Containment is the pilot's headline metric
 * (`PILOT-CRITERIA.md`) and is otherwise un-inspectable: an operator cannot
 * audit a percentage they cannot decompose (`WIREFRAMES.md` U2).
 */
export type ContainmentReason =
  | 'answered_out_of_hours'
  | 'faq_hit'
  | 'transferred_by_request'
  | 'voicemail_captured'
  | 'not_contained';

export interface CallSummary {
  callId: string;
  outcome: CallOutcome;
  contained: boolean;
  containmentReason: ContainmentReason;
  /** FR/EN summary. An INFERENCE, not a fact — render it in the AI purple. */
  summary: string;
  costEur: number | null;
}
