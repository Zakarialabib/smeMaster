/**
 * The wire contract, TypeScript side.
 *
 * Mirrors `src-tauri/src/agent/` Rust modules field for field.
 * The Rust code is the source of truth — when the two disagree,
 * the Rust wins and this file is the bug.
 *
 * Two things deliberately absent, and their absence is the design:
 *
 * - **No `tenantId` anywhere.** Tenant identity is derived server-side from the
 *   bearer token (`ADR-001` D4a). A field here would be a field a client could
 *   *set*, which is a security regression rather than a schema tidy-up.
 * - **No audio type.** No audio is retained anywhere, so there is no `audioUrl`,
 *   no `recordingId`, and therefore no play control.
 *
 * Focus: agentic AI for email and social channel automation.
 * Voice/WhatsApp call system is dropped.
 */

/* ── Enums (string unions) ────────────────────────────────────────────────── */

export type Severity = 'P1' | 'P2' | 'P3';
export type ProviderTier = 'budget' | 'standard' | 'premium' | 'selfhosted';
export type AfterHoursMode = 'take_message' | 'transfer' | 'announce_only';

/* ── Health ───────────────────────────────────────────────────────────────── */

export interface Health {
  ok: boolean;
  version: string;
  startedAt: string;
  db: 'ok' | 'degraded' | 'down';
  providers: 'ok' | 'degraded' | 'down';
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
  oneLiner: string;
  decision: string;
  evidence: AlertEvidence;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
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
  p2Grouped: Record<string, OpsAlert[]>;
  p3Count: number;
  callCount: number;
  containedPct: number;
  reachable: boolean;
  lastSeenAt: string | null;
}

/* ── Config ───────────────────────────────────────────────────────────────── */

export type ConsentVariant = 'announce_first' | 'record_with_consent' | 'no_recording';

export type Channel = 'baileys' | 'twilio' | 'official' | 'none';

export interface ChannelCapability {
  enabled: boolean;
  configured: boolean;
  reason?: string | null;
}

export interface AgentConfig {
  providerMix: Record<string, string>;
  consentVariant: ConsentVariant;
  bilingual: boolean;
  channel: Channel;
  channels: Record<string, ChannelCapability>;
  costSim: Record<string, unknown>;
  hours: Record<string, string[]>;
  tz: string;
  transferTarget: string | null;
  tier: ProviderTier;
  knowledgeScope: string[];
  afterHoursMode: AfterHoursMode;
  updatedAt: string | null;
}

/* ── Automation ───────────────────────────────────────────────────────────── */

export type AutomationChannel = 'email' | 'social';

export interface AutomationRule {
  id: string;
  name: string;
  channel: AutomationChannel;
  trigger: string;
  action: string;
  enabled: boolean;
  lastRun: string | null;
  runCount: number;
}

/* ── Errors ───────────────────────────────────────────────────────────────── */

export interface ErrorBody {
  code: string;
  message: string;
  retryable: boolean;
  provider?: string | null;
  at: string;
}

export interface ErrorResponse {
  error: ErrorBody;
}
