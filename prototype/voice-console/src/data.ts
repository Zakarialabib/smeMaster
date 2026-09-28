import type { CallListItem, CostRow, OpsAlert, OpsSnapshot, Turn } from './types';

/** Fixtures shaped exactly like the BACKEND.md §13 payloads. */

export const CALLS: CallListItem[] = [
  { id: 'c_01', channel: 'voice', outcome: 'contained', state: 'speaking', startedAt: '2026-09-28T14:30:18Z', durationSec: 134, callerMasked: '+33 6 •• •• 41 22', flagged: null, costEur: 0.44, containment: true },
  { id: 'c_02', channel: 'voice', outcome: 'transferred', state: 'wrapup', startedAt: '2026-09-28T13:58:02Z', durationSec: 41, callerMasked: '+33 7 •• •• 09 88', flagged: null, costEur: 0.17, containment: false },
  { id: 'c_03', channel: 'whatsapp', outcome: 'contained', state: 'wrapup', startedAt: '2026-09-28T13:40:44Z', durationSec: 63, callerMasked: '+33 6 •• •• 77 01', flagged: null, costEur: 0, containment: true },
  { id: 'c_04', channel: 'voice', outcome: 'voicemail', state: 'wrapup', startedAt: '2026-09-28T12:11:30Z', durationSec: 202, callerMasked: '+33 6 •• •• 12 45', flagged: null, costEur: 0.62, containment: true },
  { id: 'c_05', channel: 'voice', outcome: 'contained', state: 'wrapup', startedAt: '2026-09-28T11:26:09Z', durationSec: 107, callerMasked: '+33 6 •• •• 33 90', flagged: 'pricing', costEur: 0.39, containment: true },
  { id: 'c_06', channel: 'voice', outcome: 'abandoned', state: 'wrapup', startedAt: '2026-09-28T10:47:55Z', durationSec: 12, callerMasked: '+33 6 •• •• 55 08', flagged: null, costEur: 0.05, containment: false },
  { id: 'c_07', channel: 'whatsapp', outcome: 'contained', state: 'wrapup', startedAt: '2026-09-28T09:15:22Z', durationSec: 176, callerMasked: '+33 6 •• •• 71 33', flagged: null, costEur: 0, containment: true },
  { id: 'c_08', channel: 'voice', outcome: 'transferred', state: 'wrapup', startedAt: '2026-09-28T08:52:11Z', durationSec: 88, callerMasked: '+33 6 •• •• 19 40', flagged: null, costEur: 0.31, containment: false },
];

export const LIVE_TURNS: Turn[] = [
  { idx: 0, role: 'agent', text: 'Cet appel est pris en charge par un assistant IA. Dites « agent » à tout moment pour être transféré à un humain.', final: true, stages: { vadMs: null, sttMs: null, llmMs: 214, ttsMs: 131, turnGapMs: 1402 } },
  { idx: 1, role: 'caller', text: 'Bonjour, je voudrais prendre un rendez-vous pour un contrôle technique.', final: true, stages: { vadMs: 187, sttMs: 344, llmMs: null, ttsMs: null, turnGapMs: null } },
  { idx: 2, role: 'agent', text: 'Bien sûr. Je vous propose jeudi à 14 h 30. Vous préférez le matin ?', final: true, stages: { vadMs: 176, sttMs: 331, llmMs: 268, ttsMs: 147, turnGapMs: 1562 } },
  { idx: 3, role: 'caller', text: 'Non non, plutôt le matin si possible.', final: true, stages: { vadMs: 190, sttMs: 356, llmMs: null, ttsMs: null, turnGapMs: null } },
  { idx: 4, role: 'agent', text: 'Parfait, je vous note vendredi matin à 9 h. Je vous envoie une confirmation ?', final: false, stages: { vadMs: 181, sttMs: 338, llmMs: 251, ttsMs: 142, turnGapMs: 1524 } },
];

export const P1_ALERT: OpsAlert = {
  id: 'a_01',
  severity: 'P1',
  rule: 'transfer_failed',
  oneLiner: 'Transfer failures — 6 in 20 min, target unreachable since 14:32 →',
  decision: 'Take 3 of these back yourself',
  evidence: { count: 6, firstAt: '14:32', lastAt: '14:51', blastRadius: 'this tenant' },
  acknowledgedAt: null,
  acknowledgedBy: null,
  thresholdIsProvisional: true,
};

export const P2_ALERTS: OpsAlert[] = [
  { id: 'a_11', severity: 'P2', rule: 'latency_turn_gap', oneLiner: 'turn_gap p95 1.8s over 15 min — STT is the regressing stage →', decision: 'Check Deepgram latency p95; the chain has not failed over', evidence: { count: 34, firstAt: '14:36', lastAt: '14:51', blastRadius: 'all voice calls' }, acknowledgedAt: null, acknowledgedBy: null, thresholdIsProvisional: true },
  { id: 'a_12', severity: 'P2', rule: 'knowledge_gap', oneLiner: '4 digest answers cited no chunk — refunds policy missing →', decision: 'Add the refunds section to the knowledge base', evidence: { count: 4, firstAt: '09:12', lastAt: '21:05', blastRadius: 'pricing questions' }, acknowledgedAt: null, acknowledgedBy: null, thresholdIsProvisional: true },
  { id: 'a_13', severity: 'P2', rule: 'cost_over_model', oneLiner: 'Realised €0.21/min vs €0.19 signed — +11%, inside the ±20% band →', decision: 'No action this week; re-check at 3,000 min/month', evidence: { count: 4, firstAt: '00:00', lastAt: '23:59', blastRadius: 'this tenant' }, acknowledgedAt: null, acknowledgedBy: null, thresholdIsProvisional: true },
];

export const SNAPSHOT: OpsSnapshot = {
  generatedAt: '2026-09-28T14:51:00Z',
  since: '2026-09-28T08:00:00Z',
  p1: [P1_ALERT],
  p2Grouped: { latency: [P2_ALERTS[0]], knowledge: [P2_ALERTS[1]], cost: [P2_ALERTS[2]] },
  p3Count: 2,
  callCount: 128,
  containedPct: 79,
  reachable: true,
  lastSeenAt: '2026-09-28T14:51:00Z',
  providerHealth: [
    { provider: 'Deepgram Nova', role: 'STT', errorRate: 0.004, latencyP95Ms: 410, fallbackActive: false, state: 'ok' },
    { provider: 'ElevenLabs', role: 'TTS', errorRate: 0.002, latencyP95Ms: 147, fallbackActive: false, state: 'ok' },
    { provider: 'Gemini 3.5 Flash', role: 'LLM', errorRate: 0.001, latencyP95Ms: 268, fallbackActive: false, state: 'ok' },
    { provider: 'Telnyx', role: 'telephony', errorRate: 0, latencyP95Ms: null, fallbackActive: false, state: 'degraded' },
    { provider: 'BSP (prod)', role: 'whatsapp', errorRate: 0, latencyP95Ms: null, fallbackActive: false, state: 'ok' },
  ],
};

export const COST_ROWS: CostRow[] = [
  { key: 'contained_pricing', label: 'Contained — pricing', calls: 38, minutes: 118.4, actualEur: 24.9, modelEur: 23.94, overModel: false },
  { key: 'contained_hours', label: 'Contained — hours', calls: 27, minutes: 61.2, actualEur: 11.4, modelEur: 11.74, overModel: false },
  { key: 'voicemail', label: 'Voicemail → WhatsApp', calls: 22, minutes: 66.0, actualEur: 18.9, modelEur: 14.42, overModel: true },
  { key: 'transferred', label: 'Transferred', calls: 29, minutes: 99.1, actualEur: 17.1, modelEur: 18.8, overModel: false },
  { key: 'abandoned', label: 'Abandoned', calls: 8, minutes: 12.3, actualEur: 3.8, modelEur: 2.57, overModel: true },
  { key: 'whatsapp_text', label: 'WhatsApp (text) ⓘ', calls: 12, minutes: null, actualEur: 0, modelEur: 0, overModel: false },
];

export const DAILY_MINUTES = [31, 42, 38, 55, 22, 19, 41, 47, 63, 58, 72, 66, 81, 77, 91, 24, 20, 44, 49, 68, 74, 85, 79, 96];
