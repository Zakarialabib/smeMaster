/**
 * Types mirror docs/voice/design/BACKEND.md §13 exactly.
 * DESIGN ARTIFACT — this is the contract an implementer would copy, not a mock
 * object. Note what is NOT here: tenantId. It comes from the token, server-side
 * (ADR-001 D4a), and must never be read from or sent by the client.
 */

export type CallChannel = 'voice' | 'whatsapp';
export type CallOutcome = 'contained' | 'transferred' | 'voicemail' | 'abandoned';
export type CallState =
  | 'idle' | 'connecting' | 'greeting' | 'listening'
  | 'thinking' | 'speaking' | 'closing' | 'wrapup';

export interface StageMarks {
  vadMs: number | null;
  sttMs: number | null;
  llmMs: number | null;
  ttsMs: number | null;
  turnGapMs: number | null;
}

export interface CallListItem {
  id: string;
  channel: CallChannel;
  outcome: CallOutcome;
  state: CallState;
  startedAt: string;
  durationSec: number;
  callerMasked: string;
  flagged: string | null;
  costEur: number | null;
  containment: boolean;
}

export interface Turn {
  idx: number;
  role: 'caller' | 'agent';
  text: string;
  final: boolean;
  stages?: StageMarks;
}

export type WsStatus =
  | 'idle' | 'connecting' | 'connected'
  | 'stale' | 'reconnecting' | 'offline';

export interface OpsAlert {
  id: string;
  severity: 'P1' | 'P2' | 'P3';
  rule: string;
  oneLiner: string;
  decision: string;
  evidence: { count: number; firstAt: string; lastAt: string; blastRadius: string };
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  /** PLACEHOLDER until pilot data exists. The UI must show provenance, not a guess as fact. */
  thresholdIsProvisional: true;
}

export interface ProviderHealth {
  provider: string;
  role: 'STT' | 'TTS' | 'LLM' | 'telephony' | 'whatsapp';
  errorRate: number;
  latencyP95Ms: number | null;
  fallbackActive: boolean;
  state: 'ok' | 'degraded' | 'down';
}

export interface OpsSnapshot {
  generatedAt: string;
  since: string;
  p1: OpsAlert[];
  p2Grouped: Record<string, OpsAlert[]>;
  p3Count: number;
  callCount: number;
  containedPct: number;
  reachable: boolean;
  lastSeenAt: string | null;
  providerHealth: ProviderHealth[];
}

export interface CostRow {
  key: string;
  label: string;
  calls: number;
  minutes: number | null;
  actualEur: number;
  modelEur: number;
  overModel: boolean;
}
