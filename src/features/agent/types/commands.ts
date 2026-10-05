/**
 * The wire contract, TypeScript side.
 *
 * Mirrors `src-tauri/src/agent/` Rust modules field for field.
 * The Rust code is the source of truth — when the two disagree,
 * the Rust wins and this file is the bug.
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
  role: 'STT' | 'TTS' | 'LLM' | 'EMBEDDING';
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

export interface AgentConfig {
  providerMix: Record<string, string>;
  consentVariant: ConsentVariant;
  bilingual: boolean;
  channel: string;
  channels: Record<string, { enabled: boolean; configured: boolean; reason?: string | null }>;
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
