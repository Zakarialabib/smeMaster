import { useMemo } from 'react';
import { create } from 'zustand';
import type {
  CallListItem, OpsAlert, WsStatus, ConsentOption, VerticalTemplate,
  KnowledgeScopeItem, ScopeVersion, ScenarioResult,
  PricingShape, CostSimulationInput, CostSimulationResult,
  // second pass
  Persona, ClientDecision, LeadTime, VerticalMetrics, EscalationState,
  LanguageTurn, DegradedMode, DegradedState, ShadowSession, ShadowAnnotation,
  CallbackPromise, LocalNodeHealth, VoiceExperiment, WizardAnswer, WizardState,
  RetentionPolicy, ErasureRequest, BreachLogEntry, PilotCriterion,
  ScopeMatrix, AfterHoursPolicy, MultilingualOverflow, CallReplay,
  SpamFilterSettings, ConsentReceipt, DetectedLanguage,
  PersonaId, DecisionId, LeadTimeId,
} from './types';
import {
  CALLS, P1_ALERT, P2_ALERTS, SNAPSHOT, KNOWLEDGE_SCOPE, SCOPE_VERSIONS,
  VERTICAL_TEMPLATES, GUARDRAIL_SCENARIOS,
  PERSONAS, CLIENT_DECISIONS, LEAD_TIMES, VERTICAL_METRICS,
  SHADOW_SESSIONS, CALLBACK_PROMISES, LOCAL_NODES, VOICE_EXPERIMENTS,
  WIZARD_ANSWERS, CONSENT_RECEIPTS, RETENTION_POLICY, ERASURE_REQUESTS,
  BREACH_LOG, PILOT_CRITERIA, SCOPE_MATRIX, AFTER_HOURS_POLICY,
  SPAM_FILTER_DEFAULTS,
} from './data';

/**
 * One store per domain, per FRONTEND.md §12.3. Components subscribe to the
 * selectors below, never to a whole store.
 *
 * `reachable` is read by EVERY surface from opsStore, not just the digest —
 * a per-component online check is how two surfaces disagree about the truth.
 */
export type Route =
  | 'calls' | 'live' | 'ops' | 'alerts' | 'alert'
  | 'config' | 'knowledge' | 'cost' | 'topology' | 'settings'
  | 'scenarios'
  /* second pass */
  | 'personas' | 'decisions' | 'lead-times' | 'shadow' | 'callbacks'
  | 'node' | 'experiments' | 'wizard' | 'regulator' | 'criteria'
  | 'matrix' | 'replay';

/* ══════════════════════════════════════════════════════════════════════════
   ORIGINAL STORES — unchanged
   ══════════════════════════════════════════════════════════════════════════ */

interface CallListState {
  rows: CallListItem[];
  range: '7d' | '30d' | 'all';
  outcome: 'all' | CallListItem['outcome'];
  flaggedOnly: boolean;
  spamOnly: boolean;
  shadowOnly: boolean;
  selectedId: string | null;
  /** Alert drill-down, e.g. "show me the 6 transfer failures". Null = no filter. */
  drill: { label: string; ids: string[] } | null;
  setRange: (r: CallListState['range']) => void;
  setOutcome: (o: CallListState['outcome']) => void;
  toggleFlagged: () => void;
  toggleSpam: () => void;
  toggleShadow: () => void;
  select: (id: string | null) => void;
  setDrill: (d: CallListState['drill']) => void;
  clearDrill: () => void;
}

export const useCallListStore = create<CallListState>((set) => ({
  rows: CALLS,
  range: '30d',
  outcome: 'all',
  flaggedOnly: false,
  spamOnly: false,
  shadowOnly: false,
  selectedId: 'c_01',
  drill: null,
  setRange: (range) => set({ range }),
  setOutcome: (outcome) => set({ outcome }),
  toggleFlagged: () => set((s) => ({ flaggedOnly: !s.flaggedOnly })),
  toggleSpam: () => set((s) => ({ spamOnly: !s.spamOnly })),
  toggleShadow: () => set((s) => ({ shadowOnly: !s.shadowOnly })),
  select: (selectedId) => set({ selectedId }),
  setDrill: (drill) => set({ drill }),
  clearDrill: () => set({ drill: null }),
}));

/**
 * Filtered rows.
 *
 * The filter is done in a useMemo over primitive selector results rather than
 * inside the zustand selector: a selector that builds a new array on every call
 * re-renders forever under useSyncExternalStore (React error #185).
 */
export const useFilteredCalls = () => {
  const rows = useCallListStore((s) => s.rows);
  const outcome = useCallListStore((s) => s.outcome);
  const flaggedOnly = useCallListStore((s) => s.flaggedOnly);
  const spamOnly = useCallListStore((s) => s.spamOnly);
  const shadowOnly = useCallListStore((s) => s.shadowOnly);
  const drillIds = useCallListStore((s) => s.drill?.ids);

  return useMemo(
    () =>
      rows.filter(
        (r) =>
          (drillIds === undefined || drillIds.includes(r.id)) &&
          (outcome === 'all' || r.outcome === outcome) &&
          (!flaggedOnly || r.flagged !== null) &&
          (!spamOnly || (r.spamScore ?? 0) >= 0.7) &&
          (!shadowOnly || !!r.shadowMode),
      ),
    [rows, outcome, flaggedOnly, spamOnly, shadowOnly, drillIds],
  );
};

interface LiveState {
  callId: string | null;
  elapsedSec: number;
  wsStatus: WsStatus;
  lastDeltaAt: string | null;
  reconnectAttempt: number;
  /** §5 #13 graceful degradation state */
  degradedMode: DegradedMode;
  setWs: (status: WsStatus, attempt?: number) => void;
  tick: () => void;
  setDegraded: (m: LiveState['degradedMode']) => void;
}

export const useLiveCallStore = create<LiveState>((set) => ({
  callId: 'c_01',
  elapsedSec: 134,
  wsStatus: 'connected',
  lastDeltaAt: '2026-09-28T14:31:52Z',
  reconnectAttempt: 0,
  degradedMode: 'normal',
  setWs: (wsStatus, reconnectAttempt = 0) => set({ wsStatus, reconnectAttempt }),
  tick: () => set((s) => (s.callId ? { elapsedSec: s.elapsedSec + 1 } : {})),
  setDegraded: (degradedMode) => set({ degradedMode }),
}));

interface OpsState {
  p1: OpsAlert[];
  p2Grouped: Record<string, OpsAlert[]>;
  p3Count: number;
  callCount: number;
  containedPct: number;
  reachable: boolean;
  lastSeenAt: string | null;
  providerHealth: typeof SNAPSHOT.providerHealth;
  acknowledge: (id: string) => void;
  setReachable: (v: boolean) => void;
}

export const useOpsStore = create<OpsState>((set) => ({
  p1: [P1_ALERT],
  p2Grouped: SNAPSHOT.p2Grouped,
  p3Count: SNAPSHOT.p3Count,
  callCount: SNAPSHOT.callCount,
  containedPct: SNAPSHOT.containedPct,
  reachable: true,
  lastSeenAt: SNAPSHOT.lastSeenAt,
  providerHealth: SNAPSHOT.providerHealth,
  acknowledge: (id) =>
    set((s) => ({
      p1: s.p1.map((a) =>
        a.id === id ? { ...a, acknowledgedAt: '2026-09-28T14:52:00Z', acknowledgedBy: 'operator' } : a,
      ),
      p2Grouped: Object.fromEntries(
        Object.entries(s.p2Grouped).map(([k, list]) => [
          k,
          list.map((a) =>
            a.id === id ? { ...a, acknowledgedAt: '2026-09-28T14:52:00Z', acknowledgedBy: 'operator' } : a,
          ),
        ]),
      ),
    })),
  setReachable: (reachable) => set({ reachable }),
}));

/** Read by every surface. One source of the offline truth. */
export const useReachable = () => useOpsStore((s) => s.reachable);

/* ══════════════════════════════════════════════════════════════════════════
   CONFIG extended: vertical, consent, voice persona, shadow, after-hours, bilingual
   ══════════════════════════════════════════════════════════════════════════ */

interface ConfigState {
  voiceFr: string;
  voiceEn: string;
  hours: string;
  tz: string;
  transferTarget: string;
  afterHours: 'take_message' | 'transfer' | 'announce_only' | 'callback_promise';
  callbackHours: number;
  tier: 'standard' | 'selfhosted' | 'premium';
  disclosureEnabled: boolean;
  consent: ConsentOption;
  verticalId: VerticalTemplate['id'];
  shadowMode: boolean;
  bilingualCodeSwitching: boolean;
  accentAdaptive: boolean;
  emotionEscalation: boolean;
  spamFilter: boolean;
  dirty: boolean;
  set: <K extends keyof ConfigState>(k: K, v: ConfigState[K]) => void;
  save: () => void;
  discard: () => void;
}

const CONFIG_DEFAULTS: Omit<ConfigState, 'set' | 'save' | 'discard' | 'dirty'> = {
  voiceFr: 'siwis_medium_fr',
  voiceEn: 'matilda_en',
  hours: 'Mon–Fri 09:00–18:00',
  tz: 'Europe/Paris',
  transferTarget: '+33 6 •• •• 41 22',
  afterHours: 'take_message',
  callbackHours: 2,
  tier: 'standard',
  disclosureEnabled: true,
  consent: 'A',
  verticalId: 'garage',
  shadowMode: false,
  bilingualCodeSwitching: true,
  accentAdaptive: false,
  emotionEscalation: true,
  spamFilter: true,
};

export const useConfigStore = create<ConfigState>((set) => ({
  ...CONFIG_DEFAULTS,
  dirty: false,
  set: (k, v) => set({ [k]: v, dirty: true } as Partial<ConfigState>),
  save: () => set({ dirty: false }),
  discard: () => set({ ...CONFIG_DEFAULTS, dirty: false }),
}));

export const useVertical = () => {
  const id = useConfigStore((s) => s.verticalId);
  return VERTICAL_TEMPLATES.find((v) => v.id === id) ?? VERTICAL_TEMPLATES[0];
};

/* ══════════════════════════════════════════════════════════════════════════
   KNOWLEDGE: 4-tier scope + wizard + versions
   ══════════════════════════════════════════════════════════════════════════ */

interface KnowledgeState {
  scope: KnowledgeScopeItem[];
  versions: ScopeVersion[];
  publishing: boolean;
  ingest: 'idle' | 'running' | 'failed';
  wizardOpen: boolean;
  wizardStep: number;
  toggle: (id: string) => void;
  publish: () => void;
  fail: () => void;
  reset: () => void;
  setWizardOpen: (v: boolean) => void;
  setWizardStep: (n: number) => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  scope: KNOWLEDGE_SCOPE,
  versions: SCOPE_VERSIONS,
  publishing: false,
  ingest: 'idle',
  wizardOpen: false,
  wizardStep: 0,
  toggle: (id) =>
    set((s) => ({
      scope: s.scope.map((it) => {
        if (it.id !== id) return it;
        if (it.tier === 'T3') return it;
        if (it.requiresLocalNode && !it.enabled) {
          return { ...it, enabled: true };
        }
        return { ...it, enabled: !it.enabled };
      }),
    })),
  publish: () => set({ publishing: true }),
  fail: () => set({ publishing: false, ingest: 'failed' }),
  reset: () => set({ publishing: false, ingest: 'idle' }),
  setWizardOpen: (wizardOpen) => set({ wizardOpen }),
  setWizardStep: (wizardStep) => set({ wizardStep }),
}));

/* ══════════════════════════════════════════════════════════════════════════
   SCENARIO PLAYGROUND — test ground for guardrails
   ══════════════════════════════════════════════════════════════════════════ */

interface ScenarioState {
  selectedScenarioId: string | null;
  results: Record<string, ScenarioResult>;
  playing: boolean;
  playingTurn: number;
  select: (id: string | null) => void;
  run: (id: string, res: ScenarioResult) => void;
  setPlaying: (v: boolean, t?: number) => void;
}

export const useScenarioStore = create<ScenarioState>((set) => ({
  selectedScenarioId: null,
  results: {},
  playing: false,
  playingTurn: 0,
  select: (selectedScenarioId) => set({ selectedScenarioId }),
  run: (id, res) => set((s) => ({ results: { ...s.results, [id]: res } })),
  setPlaying: (playing, t = 0) => set({ playing, playingTurn: t }),
}));

export const GUARDRAIL_SCENARIO_LIST = GUARDRAIL_SCENARIOS;

/* ══════════════════════════════════════════════════════════════════════════
   COST SIMULATOR — §5 #5
   ══════════════════════════════════════════════════════════════════════════ */

interface CostSimState {
  input: CostSimulationInput;
  set: <K extends keyof CostSimulationInput>(k: K, v: CostSimulationInput[K]) => void;
}

export const useCostSimStore = create<CostSimState>((set) => ({
  input: {
    callsPerDay: 40,
    avgDurationMin: 2.2,
    shape: 'monthly_cap',
    tier: 'standard',
    containedPct: 78,
    transferredPct: 16,
    voicemailPct: 5,
    whatsappTextPct: 1,
  },
  set: (k, v) => set((s) => ({ input: { ...s.input, [k]: v } })),
}));

export function runCostSim(input: CostSimulationInput): CostSimulationResult {
  const days = 22;
  const totalCalls = input.callsPerDay * days;
  const totalMin = totalCalls * input.avgDurationMin;
  const tierRate = input.tier === 'standard' ? 0.19 : 0.28;
  const voicemailSurcharge = 1.4;
  const transferSurcharge = 0.9;

  const base = totalMin * tierRate;
  const vmExtra = totalMin * (input.voicemailPct / 100) * tierRate * (voicemailSurcharge - 1);
  const trExtra = totalMin * (input.transferredPct / 100) * tierRate * (transferSurcharge - 1);

  let mid = base + vmExtra + trExtra;
  if (input.shape === 'per_call') {
    mid = totalCalls * 0.65;
  } else if (input.shape === 'monthly_cap') {
    const cap = 750;
    const overRate = 0.14;
    const minAtCap = cap / tierRate;
    const over = Math.max(0, totalMin - minAtCap);
    mid = cap + over * overRate;
  }

  const driverBreakdown = [
    { label: 'TTS (ElevenLabs)', eurPct: 42 },
    { label: 'STT (Deepgram)', eurPct: 21 },
    { label: 'LLM turn (Gemini)', eurPct: 9 },
    { label: 'Carrier (Telnyx)', eurPct: 20 },
    { label: 'WhatsApp BSP', eurPct: 2 },
    { label: 'Infra (VPS + pgvector)', eurPct: 6 },
  ];
  const monthlyPct = 0.12;
  return {
    monthlyMin: Math.round(mid * (1 - monthlyPct)),
    monthlyMid: Math.round(mid),
    monthlyMax: Math.round(mid * (1 + monthlyPct)),
    perCallMid: +(mid / totalCalls).toFixed(2),
    perMinMid: +(mid / totalMin).toFixed(3),
    driverBreakdown,
  };
}

export type { PricingShape };

/* ══════════════════════════════════════════════════════════════════════════
   UI + counts
   ══════════════════════════════════════════════════════════════════════════ */

interface UiState {
  route: Route;
  alertId: string | null;
  toast: string | null;
  go: (r: Route) => void;
  openAlert: (id: string) => void;
  notify: (msg: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  route: 'ops',
  alertId: null,
  toast: null,
  go: (route) => set({ route }),
  openAlert: (alertId) => set({ alertId, route: 'alert' }),
  notify: (toast) => set({ toast }),
}));

export const useUnacknowledgedCount = () =>
  useOpsStore((s) => s.p1.filter((a) => !a.acknowledgedAt).length + P2_UNACK(s));

function P2_UNACK(s: OpsState): number {
  return Object.values(s.p2Grouped)
    .flat()
    .filter((a) => !a.acknowledgedAt).length;
}

export const ALL_ALERTS = () => [P1_ALERT, ...P2_ALERTS];

/* ══════════════════════════════════════════════════════════════════════════
   ══════════════════════════════════════════════════════════════════════════
   SECOND PASS — additive stores below this line
   ══════════════════════════════════════════════════════════════════════════
   ══════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════
   PERSONAS — §1
   ══════════════════════════════════════════════════════════════════════════ */

interface PersonaState {
  personas: Persona[];
  /** Which personas the reviewer is focused on right now */
  focus: PersonaId | null;
  filterByPersona: PersonaId | null;
  setFocus: (id: PersonaId | null) => void;
  filter: (id: PersonaId | null) => void;
}

export const usePersonaStore = create<PersonaState>((set) => ({
  personas: PERSONAS,
  focus: null,
  filterByPersona: null,
  setFocus: (focus) => set({ focus }),
  filter: (filterByPersona) => set({ filterByPersona }),
}));

/** Derive the persona whose fear a scenario is testing. */
export const usePersonasByFear = (scenario: { testsFearOf: PersonaId }) =>
  useMemo(
    () => PERSONAS.filter((p) => p.id === scenario.testsFearOf),
    [scenario.testsFearOf],
  );

/* ══════════════════════════════════════════════════════════════════════════
   CLIENT DECISIONS — §4 + doc set
   ══════════════════════════════════════════════════════════════════════════ */

interface DecisionState {
  decisions: ClientDecision[];
  answer: (id: DecisionId, answer: string, by: string) => void;
  waive: (id: DecisionId) => void;
  sign: (id: DecisionId, by: string) => void;
}

export const useDecisionStore = create<DecisionState>((set) => ({
  decisions: CLIENT_DECISIONS,
  answer: (id, answer, answeredBy) =>
    set((s) => ({
      decisions: s.decisions.map((d) =>
        d.id === id
          ? { ...d, state: 'answered', answeredAt: new Date().toISOString(), answeredBy, answer }
          : d,
      ),
    })),
  waive: (id) =>
    set((s) => ({
      decisions: s.decisions.map((d) =>
        d.id === id ? { ...d, state: 'waived', answeredAt: new Date().toISOString() } : d,
      ),
    })),
  sign: (id, answeredBy) =>
    set((s) => ({
      decisions: s.decisions.map((d) =>
        d.id === id
          ? { ...d, state: 'signed', answeredAt: new Date().toISOString(), answeredBy }
          : d,
      ),
    })),
}));

export const useOpenDecisionCount = () =>
  useDecisionStore((s) => s.decisions.filter((d) => d.state === 'open').length);

/* useDefaultedDecisions disabled — stub fixture lacks isDefaulted discriminator
/** The one defaulted decision (D4) — a default, not a question. *\/
export const useDefaultedDecisions = () =>
  useDecisionStore((s) => s.decisions.filter((d) => d.isDefaulted));
*/

/* ══════════════════════════════════════════════════════════════════════════
   LEAD TIMES — doc set
   ══════════════════════════════════════════════════════════════════════════ */

interface LeadTimeState {
  leadTimes: LeadTime[];
  start: (id: LeadTimeId, at?: string) => void;
  markAtRisk: (id: LeadTimeId, atRisk: boolean) => void;
}

export const useLeadTimeStore = create<LeadTimeState>((set) => ({
  leadTimes: LEAD_TIMES,
  start: (id, at = new Date().toISOString()) =>
    set((s) => ({
      leadTimes: s.leadTimes.map((l) => (l.id === id ? { ...l, startedAt: at } : l)),
    })),
  markAtRisk: (id, atRisk) =>
    set((s) => ({
      leadTimes: s.leadTimes.map((l) => (l.id === id ? { ...l, atRisk } : l)),
    })),
}));

/** Lead times that are longer than the build AND at risk. */
export const useCriticalLeadTimes = () =>
  useLeadTimeStore((s) =>
    s.leadTimes.filter((l) => l.longerThanBuild && l.atRisk),
  );

/* ══════════════════════════════════════════════════════════════════════════
   VERTICAL METRICS — §2
   ══════════════════════════════════════════════════════════════════════════ */

interface VerticalMetricState {
  metrics: VerticalMetrics[];
  /** The vertical currently being measured in the scorecard */
  activeId: VerticalTemplate['id'] | null;
  setActive: (id: VerticalTemplate['id'] | null) => void;
  /** Push a new observation; time series, oldest first */
  observe: (id: VerticalTemplate['id'], point: { at: string; metric: string; value: number }) => void;
}

export const useVerticalMetricStore = create<VerticalMetricState>((set) => ({
  metrics: VERTICAL_METRICS,
  activeId: null,
  setActive: (activeId) => set({ activeId }),
  observe: (id, point) =>
    set((s) => ({
      metrics: s.metrics.map((m) =>
        m.verticalId === id ? { ...m, series: [...m.series, point] } : m,
      ),
    })),
}));

/** The single active metric set for the configured vertical. */
export const useActiveVerticalMetrics = () => {
  const activeId = useVerticalMetricStore((s) => s.activeId);
  const metrics = useVerticalMetricStore((s) => s.metrics);
  const id = activeId ?? useConfigStore.getState().verticalId;
  return useMemo(() => metrics.find((m) => m.verticalId === id) ?? null, [metrics, id]);
};

/* ══════════════════════════════════════════════════════════════════════════
   ESCALATION LADDER — §3.1, per-call live state
   ══════════════════════════════════════════════════════════════════════════ */

interface EscalationStateStore {
  history: EscalationState[];
  push: (e: EscalationState) => void;
  clear: () => void;
}

export const useEscalationStore = create<EscalationStateStore>((set) => ({
  history: [],
  push: (e) => set((s) => ({ history: [...s.history, e] })),
  clear: () => set({ history: [] }),
}));

/** Current rung of the ladder — the last push, or null. */
export const useCurrentLadderStep = () =>
  useEscalationStore((s) => (s.history.length ? s.history[s.history.length - 1].step : null));

/* ══════════════════════════════════════════════════════════════════════════
   LANGUAGE + ACCENT — §5 #9, #10 (per-call)
   ══════════════════════════════════════════════════════════════════════════ */

interface LanguageState {
  turns: LanguageTurn[];
  dominant: DetectedLanguage | null;
  push: (t: LanguageTurn) => void;
  clear: () => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  turns: [],
  dominant: null,
  push: (t) =>
    set((s) => {
      const turns = [...s.turns, t];
      const counts = turns.reduce<Record<string, number>>((acc, x) => {
        acc[x.detected] = (acc[x.detected] ?? 0) + 1;
        return acc;
      }, {});
      const dominant = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as DetectedLanguage | null;
      return { turns, dominant };
    }),
  clear: () => set({ turns: [], dominant: null }),
}));

/** Count of code-switch moments detected in this call. */
export const useCodeSwitchCount = () =>
  useLanguageStore((s) => s.turns.filter((t) => t.codeSwitchScore >= 0.5).length);

/* ══════════════════════════════════════════════════════════════════════════
   GRACEFUL DEGRADATION — §5 #13 (exported so surfaces agree)
   ══════════════════════════════════════════════════════════════════════════ */

interface DegradedStateStore {
  current: DegradedState | null;
  set: (d: DegradedState | null) => void;
}

export const useDegradedStore = create<DegradedStateStore>((set) => ({
  current: null,
  set: (current) => set({ current }),
}));

/** Read by the live surface — one source of the degradation truth. */
export const useDegradedMode = (): DegradedMode =>
  useDegradedStore((s) => s.current?.mode ?? 'normal');

/* ══════════════════════════════════════════════════════════════════════════
   SHADOW MODE — §5 #2
   ══════════════════════════════════════════════════════════════════════════ */

interface ShadowState {
  sessions: ShadowSession[];
  activeId: string | null;
  annotate: (sessionId: string, a: ShadowAnnotation) => void;
  promote: (sessionId: string) => void;
  discard: (sessionId: string) => void;
  setActive: (id: string | null) => void;
}

export const useShadowStore = create<ShadowState>((set) => ({
  sessions: SHADOW_SESSIONS,
  activeId: null,
  annotate: (sessionId, a) =>
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === sessionId ? { ...x, annotations: [...x.annotations, a] } : x,
      ),
    })),
  promote: (sessionId) =>
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === sessionId ? { ...x, status: 'promoted', endsAt: new Date().toISOString() } : x,
      ),
    })),
  discard: (sessionId) =>
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === sessionId ? { ...x, status: 'discarded', endsAt: new Date().toISOString() } : x,
      ),
    })),
  setActive: (activeId) => set({ activeId }),
}));

/** Shadow session currently listening (there is at most one). */
export const useActiveShadowSession = () => {
  const sessions = useShadowStore((s) => s.sessions);
  return useMemo(() => sessions.find((x) => x.status === 'listening') ?? null, [sessions]);
};

/* ══════════════════════════════════════════════════════════════════════════
   CALLBACK PROMISES — §5 #12
   ══════════════════════════════════════════════════════════════════════════ */

interface CallbackState {
  promises: CallbackPromise[];
  make: (p: CallbackPromise) => void;
  fulfil: (id: string, by: string) => void;
  breach: (id: string) => void;
}

export const useCallbackStore = create<CallbackState>((set) => ({
  promises: CALLBACK_PROMISES,
  make: (p) => set((s) => ({ promises: [...s.promises, p] })),
  fulfil: (id, fulfilledBy) =>
    set((s) => ({
      promises: s.promises.map((p) =>
        p.id === id ? { ...p, fulfilledAt: new Date().toISOString(), fulfilledBy } : p,
      ),
    })),
  breach: (id) =>
    set((s) => ({
      promises: s.promises.map((p) => (p.id === id ? { ...p, breached: true } : p)),
    })),
}));

/** Open promises whose dueBy is within `minutes`. */
export const useCallbacksDueSoon = (minutes: number) => {
  const promises = useCallbackStore((s) => s.promises);
  return useMemo(() => {
    const cutoff = Date.now() + minutes * 60_000;
    return promises.filter(
      (p) => !p.fulfilledAt && !p.breached && new Date(p.dueBy).getTime() <= cutoff,
    );
  }, [promises, minutes]);
};

/* ══════════════════════════════════════════════════════════════════════════
   LOCAL-FIRST NODE — §5 #14
   ══════════════════════════════════════════════════════════════════════════ */

interface LocalNodeState {
  nodes: LocalNodeHealth[];
  upsert: (n: LocalNodeHealth) => void;
  remove: (id: string) => void;
}

export const useLocalNodeStore = create<LocalNodeState>((set) => ({
  nodes: LOCAL_NODES,
  upsert: (n) =>
    set((s) => ({
      nodes: s.nodes.some((x) => x.id === n.id)
        ? s.nodes.map((x) => (x.id === n.id ? n : x))
        : [...s.nodes, n],
    })),
  remove: (id) => set((s) => ({ nodes: s.nodes.filter((x) => x.id !== id) })),
}));

/** True when at least one node is up — the gate for T2 content. */
export const useT2Reachable = () =>
  useLocalNodeStore((s) => s.nodes.some((n) => n.t2Reachable));

/* ══════════════════════════════════════════════════════════════════════════
   VOICE A/B EXPERIMENTS — §5 #19
   ══════════════════════════════════════════════════════════════════════════ */

interface ExperimentState {
  experiments: VoiceExperiment[];
  start: (e: VoiceExperiment) => void;
  conclude: (id: string, winner: 'A' | 'B' | 'tie', notes: string) => void;
}

export const useVoiceExperimentStore = create<ExperimentState>((set) => ({
  experiments: VOICE_EXPERIMENTS,
  start: (e) => set((s) => ({ experiments: [...s.experiments, e] })),
  conclude: (id, winner, notes) =>
    set((s) => ({
      experiments: s.experiments.map((x) =>
        x.id === id
          ? { ...x, status: 'complete', winner, notes, endsAt: new Date().toISOString() }
          : x,
      ),
    })),
}));

/** The running experiment, if any. */
export const useRunningExperiment = () => {
  const experiments = useVoiceExperimentStore((s) => s.experiments);
  return useMemo(() => experiments.find((x) => x.status === 'running') ?? null, [experiments]);
};

/* ══════════════════════════════════════════════════════════════════════════
   CONSENT RECEIPTS — §5 #7
   ══════════════════════════════════════════════════════════════════════════ */

interface ConsentReceiptState {
  receipts: ConsentReceipt[];
  issue: (r: ConsentReceipt) => void;
  clear: () => void;
}

export const useConsentReceiptStore = create<ConsentReceiptState>((set) => ({
  receipts: CONSENT_RECEIPTS,
  issue: (r) => set((s) => ({ receipts: [...s.receipts, r] })),
  clear: () => set({ receipts: [] }),
}));

export const useConsentReceiptCount = () =>
  useConsentReceiptStore((s) => s.receipts.length);

/* ══════════════════════════════════════════════════════════════════════════
   KNOWLEDGE SCOPE WIZARD — §5 #6
   ══════════════════════════════════════════════════════════════════════════ */

interface WizardStateStore {
  state: WizardState;
  setAnswer: (questionId: string, answer: boolean) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
  complete: () => void;
}

const WIZARD_INIT: WizardState = {
  step: 0,
  totalSteps: WIZARD_ANSWERS.length,
  answers: WIZARD_ANSWERS,
  completed: false,
};

export const useWizardStore = create<WizardStateStore>((set) => ({
  state: WIZARD_INIT,
  setAnswer: (questionId, answer) =>
    set((s) => ({
      state: {
        ...s.state,
        answers: s.state.answers.map((a) =>
          a.questionId === questionId ? { ...a, answer } : a,
        ),
      },
    })),
  next: () =>
    set((s) => ({ state: { ...s.state, step: Math.min(s.state.step + 1, s.state.totalSteps - 1) } })),
  prev: () => set((s) => ({ state: { ...s.state, step: Math.max(s.state.step - 1, 0) } })),
  reset: () => set({ state: WIZARD_INIT }),
  complete: () =>
    set((s) => ({ state: { ...s.state, completed: true } })),
}));

/**
 * Turn the wizard answers into a scope toggle map.
 * Pure function so it can be unit-tested; the store holds state only.
 */
export function wizardAnswersToScope(
  answers: WizardAnswer[],
  items: KnowledgeScopeItem[],
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const item of items) {
    if (item.tier === 'T3') {
      next[item.id] = false;
      continue;
    }
    const controlling = answers.find((a) => a.controlsItemIds.includes(item.id));
    next[item.id] = controlling?.answer ?? item.defaultEnabled;
  }
  return next;
}

/* ══════════════════════════════════════════════════════════════════════════
   CNIL / REGULATOR — §1 P6
   ══════════════════════════════════════════════════════════════════════════ */

interface RegulatorState {
  policy: RetentionPolicy;
  erasures: ErasureRequest[];
  breaches: BreachLogEntry[];
  setPolicy: (p: RetentionPolicy) => void;
  completeErasure: (id: string) => void;
  logBreach: (b: BreachLogEntry) => void;
}

export const useRegulatorStore = create<RegulatorState>((set) => ({
  policy: RETENTION_POLICY,
  erasures: ERASURE_REQUESTS,
  breaches: BREACH_LOG,
  setPolicy: (policy) => set({ policy }),
  completeErasure: (id) =>
    set((s) => ({
      erasures: s.erasures.map((e) =>
        e.id === id ? { ...e, completedAt: new Date().toISOString() } : e,
      ),
    })),
  logBreach: (b) => set((s) => ({ breaches: [...s.breaches, b] })),
}));

/** Open erasure requests, sorted by due date. */
export const useOpenErasures = () => {
  const erasures = useRegulatorStore((s) => s.erasures);
  return useMemo(
    () =>
      erasures
        .filter((e) => !e.completedAt)
        .sort((a, b) => new Date(a.dueBy).getTime() - new Date(b.dueBy).getTime()),
    [erasures],
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   PILOT CRITERIA — client/PILOT-CRITERIA.md
   ══════════════════════════════════════════════════════════════════════════ */

interface PilotCriteriaState {
  criteria: PilotCriterion[];
  /** Observed values, keyed by criterion id */
  observed: Record<string, number>;
  observe: (id: string, value: number) => void;
}

export const usePilotCriteriaStore = create<PilotCriteriaState>((set) => ({
  criteria: PILOT_CRITERIA,
  observed: {},
  observe: (id, value) => set((s) => ({ observed: { ...s.observed, [id]: value } })),
}));

export interface CriterionVerdict {
  id: string;
  label: string;
  target: number;
  observed: number | null;
  pass: boolean | null;
}

export const usePilotVerdicts = (): CriterionVerdict[] => {
  const criteria = usePilotCriteriaStore((s) => s.criteria);
  const observed = usePilotCriteriaStore((s) => s.observed);
  return useMemo(
    () =>
      criteria.map((c) => {
        const o = observed[c.id] ?? null;
        const pass =
          o === null
            ? null
            : c.comparator === 'gte'
            ? o >= c.target
            : c.comparator === 'lte'
            ? o <= c.target
            : o === c.target;
        return { id: c.id, label: c.label, target: c.target, observed: o, pass };
      }),
    [criteria, observed],
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   SCOPE MATRIX — §6
   ══════════════════════════════════════════════════════════════════════════ */

interface ScopeMatrixState {
  matrix: ScopeMatrix;
  set: (m: ScopeMatrix) => void;
}

export const useScopeMatrixStore = create<ScopeMatrixState>((set) => ({
  matrix: SCOPE_MATRIX,
  set: (matrix) => set({ matrix }),
}));

/** Rows in tier order T0..T3 — the display order. */
export const useScopeMatrixRows = () => {
  const matrix = useScopeMatrixStore((s) => s.matrix);
  return useMemo(() => (['T0', 'T1', 'T2', 'T3'] as const).map((t) => matrix[t]), [matrix]);
};

/* ══════════════════════════════════════════════════════════════════════════
   AFTER-HOURS — §5 #17
   ══════════════════════════════════════════════════════════════════════════ */

interface AfterHoursState {
  policy: AfterHoursPolicy;
  setPolicy: (p: AfterHoursPolicy) => void;
}

export const useAfterHoursStore = create<AfterHoursState>((set) => ({
  policy: AFTER_HOURS_POLICY,
  setPolicy: (policy) => set({ policy }),
}));

/** Is the current local time inside an after-hours window? Pure, no store read. */
export function isAfterHours(now: Date, policy: AfterHoursPolicy): boolean {
  // Windows are strings; parsing is intentionally conservative.
  // A window like "18:00–09:00" wraps midnight and is handled as two ranges.
  const hhmm = now.getHours() * 60 + now.getMinutes();
  for (const w of policy.windows) {
    const m = w.match(/^(\d{2}):(\d{2})[–-](\d{2}):(\d{2})$/);
    if (!m) continue;
    const start = +m[1] * 60 + +m[2];
    const end = +m[3] * 60 + +m[4];
    if (start <= end) {
      if (hhmm >= start && hhmm < end) return true;
    } else {
      if (hhmm >= start || hhmm < end) return true;
    }
  }
  return false;
}

/* ══════════════════════════════════════════════════════════════════════════
   MULTILINGUAL OVERFLOW — §5 #18 (per-call, live)
   ══════════════════════════════════════════════════════════════════════════ */

interface OverflowState {
  current: MultilingualOverflow | null;
  set: (o: MultilingualOverflow | null) => void;
}

export const useOverflowStore = create<OverflowState>((set) => ({
  current: null,
  set: (current) => set({ current }),
}));

/* ══════════════════════════════════════════════════════════════════════════
   CALL REPLAY — §5 #20
   ══════════════════════════════════════════════════════════════════════════ */

interface ReplayState {
  replays: Record<string, CallReplay>;
  /** The frame the reviewer is looking at (by turnIdx) */
  frameIdx: number;
  load: (replay: CallReplay) => void;
  seek: (turnIdx: number) => void;
  clear: () => void;
}

export const useReplayStore = create<ReplayState>((set) => ({
  replays: {},
  frameIdx: 0,
  load: (replay) =>
    set((s) => ({ replays: { ...s.replays, [replay.callId]: replay } })),
  seek: (turnIdx) => set({ frameIdx: turnIdx }),
  clear: () => set({ frameIdx: 0 }),
}));

/** The frame the reviewer is looking at, or null. */
export const useCurrentReplayFrame = (callId: string | null) => {
  const replays = useReplayStore((s) => s.replays);
  const frameIdx = useReplayStore((s) => s.frameIdx);
  return useMemo(() => {
    if (!callId) return null;
    const replay = replays[callId];
    if (!replay) return null;
    return replay.frames.find((f) => f.turnIdx === frameIdx) ?? null;
  }, [replays, callId, frameIdx]);
};

/* ══════════════════════════════════════════════════════════════════════════
   SPAM FILTER — §5 #16
   ══════════════════════════════════════════════════════════════════════════ */

interface SpamState {
  settings: SpamFilterSettings;
  set: <K extends keyof SpamFilterSettings>(k: K, v: SpamFilterSettings[K]) => void;
  reset: () => void;
}

export const useSpamStore = create<SpamState>((set) => ({
  settings: SPAM_FILTER_DEFAULTS,
  set: (k, v) => set((s) => ({ settings: { ...s.settings, [k]: v } })),
  reset: () => set({ settings: SPAM_FILTER_DEFAULTS }),
}));

/** Calls above the configured threshold, in call order. Pure derivation. */
export const useSpamHits = () => {
  const rows = useCallListStore((s) => s.rows);
  const threshold = useSpamStore((s) => s.settings.threshold);
  return useMemo(
    () => rows.filter((r) => (r.spamScore ?? 0) >= threshold),
    [rows, threshold],
  );
};