/**
 * Types mirror docs/voice/design/BACKEND.md §13 exactly.
 * DESIGN ARTIFACT — this is the contract an implementer would copy, not a mock
 * object. Note what is NOT here: tenantId. It comes from the token, server-side
 * (ADR-001 D4a), and must never be read from or sent by the client.
 *
 * EXTENDED 2026-09-28 from Personas, Scopes & Innovations.md:
 * - Knowledge tiers T0/T1/T2/T3 (§3.2)
 * - Consent options A/B/C (§3.3)
 * - Guardrail scenarios (§4)
 * - Innovation demo types (§5)
 * - Persona references (§1)
 *
 * EXTENDED AGAIN 2026-09-28 — second pass:
 * - Personas P1..P6 as first-class types (§1)
 * - Client decisions D1..D5 + guardrail (§4 + doc set)
 * - Lead times outside our control (doc set, gate map)
 * - Vertical metrics: killer outcome, anti-metric, recovered revenue (§2)
 * - Escalation ladder steps (§3.1)
 * - Bilingual / accent detection (§5 #9, #10)
 * - Graceful degradation modes (§5 #13)
 * - Shadow review sessions (§5 #2)
 * - Callback promises (§5 #12)
 * - Local-first node health (§5 #14)
 * - Voice persona A/B experiments (§5 #19)
 * - After-hours policy (§5 #17)
 * - Multilingual overflow (§5 #18)
 * - Knowledge scope wizard (§5 #6)
 * - CNIL / regulator state (§1 P6)
 * - Pilot criteria bars (from client/PILOT-CRITERIA.md)
 * - Scope matrix (§6)
 * - Call replay: "why did it say that?" (§5 #20)
 * - Spam filter (§5 #16)
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
  /** Personas, §5 #2: shadow mode — the agent listened but did not speak */
  shadowMode?: boolean;
  /** Personas, §5 #16: spam likelihood 0..1 */
  spamScore?: number | null;
  /** Personas, §5 #3: WhatsApp summary already sent? */
  summarySent?: boolean;
  /** Personas, §5 #20: scope version the call was answered under */
  scopeVersion?: number | null;
  /** Personas, §1 P4: warm-transfer context brief when transferred */
  transferBrief?: TransferBrief | null;
  /** Personas, §5 #11: caller emotion at end of call */
  callerEmotion?: CallerEmotion;

  /* ── second-pass extensions ────────────────────────────────────────── */

  /** EXT §5 #9: dominant detected language over the call */
  language?: DetectedLanguage;
  /** EXT §5 #10: classified French accent (if FR) */
  accent?: FrenchAccent | null;
  /** EXT §5 #13: degraded mode active at wrap-up, if any */
  degradedMode?: DegradedMode;
  /** EXT §3.1: full escalation history, oldest first */
  escalation?: EscalationState[];
  /** EXT §5 #12: outstanding callback promise, if one was made */
  callbackPromise?: CallbackPromise | null;
  /** EXT §5 #18: multilingual overflow handling, if the call overflowed */
  overflow?: MultilingualOverflow | null;
  /** EXT §5 #16: the reasons behind the spam score */
  spamReasons?: string[];
}

export interface Turn {
  idx: number;
  role: 'caller' | 'agent';
  text: string;
  final: boolean;
  stages?: StageMarks;
  /** Personas, §5 #20: retrieval hits + scope provenance for "why did it say that?" */
  provenance?: TurnProvenance | null;
  /** Personas, §5 #11: emotion snapshot after this turn */
  emotionTag?: CallerEmotion | null;
  /** Personas, §3.1: guardrail that fired on this turn (if any) */
  guardrailFired?: GuardrailId | null;

  /* ── second-pass extension ─────────────────────────────────────────── */

  /** EXT §5 #9/#10: language + accent for this specific caller turn */
  language?: LanguageTurn | null;
}

/** Personas, §5 #11: emotion-aware escalation */
export type CallerEmotion = 'neutral' | 'stressed' | 'angry' | 'confused' | 'happy';

/** Personas, §5 #20: why the agent said what it said */
export interface TurnProvenance {
  scopeVersion: number;
  chunks: { id: string; tier: KnowledgeTier; score: number; snippet: string }[];
  promptSnippet: string;
  guardrailsChecked: GuardrailId[];
}

/** Personas, §1 P4: the warm-transfer brief handed to Julie */
export interface TransferBrief {
  who: string;
  what: string;
  mood: CallerEmotion;
  alreadySaid: string[];
  nextAction: string;
  scopeVersion: number;
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
  /** Personas, §5 #8: pilot scorecard */
  pilotScorecard?: PilotScorecard;
  /** Personas, §5 #7: consent receipt count */
  consentReceiptsIssued?: number;

  /* ── second-pass extensions ────────────────────────────────────────── */

  /** EXT: local-node health summary (T2 reachability), if a node is enrolled */
  localNode?: LocalNodeHealth | null;
  /** EXT: count of open (unacknowledged) callbacks approaching breach */
  callbacksAtRiskCount?: number;
  /** EXT: count of open erasure requests inside their SLA */
  erasureOpenCount?: number;
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

/* ═══════════════════════════════════════════════════════════════════════════
   KNOWLEDGE — §3.2 four-tier guardrail + scope wizard
   ═══════════════════════════════════════════════════════════════════════════ */

/** Personas, §3.2: the four tiers the client decides on */
export type KnowledgeTier = 'T0' | 'T1' | 'T2' | 'T3';

export interface KnowledgeScopeItem {
  id: string;
  tier: KnowledgeTier;
  label: string;
  description: string;
  examples: string[];
  /** T0/T1: ✅ default on; T2: ⚙️ opt-in (needs local node); T3: ❌ never */
  defaultEnabled: boolean;
  requiresLocalNode: boolean;
  enabled: boolean;
  chunkCount?: number;
  /** Personas, §5 #6: the wizard question that toggles this */
  wizardQuestion?: string;
}

/** Personas, §5: every scope change is versioned with timestamp + approver */
export interface ScopeVersion {
  version: number;
  at: string;
  by: string;
  changeSummary: string;
  snapshot: Record<string, boolean>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSENT — §3.3 options A / B / C + receipt
   ═══════════════════════════════════════════════════════════════════════════ */

/** Personas, §3.3 */
export type ConsentOption = 'A' | 'B' | 'C';

export interface ConsentReceipt {
  id: string;
  at: string;
  callerMasked: string;
  option: ConsentOption;
  /** The exact disclosure text that was played */
  disclosureText: string;
  /** §4 innovation #7: automatic audit trail for CNIL */
  accepted: boolean;
  callId: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GUARDRAIL SCENARIOS — §4 + §3.1 capability matrix
   ═══════════════════════════════════════════════════════════════════════════ */

/** Personas, §3.1 & §4: every guardrail the agent must enforce */
export type GuardrailId =
  | 'DISCLOSURE_FIRST'        // must announce AI in sentence 0
  | 'NO_EXACT_PRICING'        // ranges only, never exact prices
  | 'NO_TECHNICAL_DIAGNOSIS'  // never diagnose a car/patient/etc
  | 'NO_T3_DATA'              // never read T3 confidential
  | 'T2_REQUIRES_NODE'        // T2 needs a local node to reach
  | 'ESCALATE_EMERGENCY'      // "help I'm bleeding" etc → transfer
  | 'ESCALATE_ANGRY'          // emotion → angry → faster ladder
  | 'ESCALATE_HUMAN_REQUEST'  // caller says "agent" / "humain"
  | 'NO_OUTBOUND'             // v1 never places a call
  | 'NO_PAYMENT'              // v1 never takes payment
  | 'ESCALATE_COMPLAINT';     // caller says they want to complain

export interface Guardrail {
  id: GuardrailId;
  tier: KnowledgeTier | 'consent' | 'capability' | 'escalation';
  summary: string;
  /** What the agent SAYS when it refuses */
  refusalCopy: string;
  /** How it escalates: transfer / message / ladder-step */
  escalatesTo: 'transfer' | 'message' | 'ladder' | 'refuse_only';
  personaRule: string;
}

export interface GuardrailScenario {
  id: string;
  title: string;
  /** P1..P6 — which persona's fear this tests */
  testsFearOf: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';
  setup: string;
  /** Scripted caller turns to feed the agent */
  callerTurns: string[];
  /** Guardrails that MUST fire during this scenario */
  mustFire: GuardrailId[];
  /** Guardrails that MUST NOT fire during this scenario */
  mustNotFire?: GuardrailId[];
  expectedOutcome: CallOutcome;
  /** Personas, §5 #20: explanation shown with the result */
  whyItMatters: string;
}

export interface ScenarioResult {
  scenarioId: string;
  passed: boolean;
  fired: GuardrailId[];
  outcome: CallOutcome;
  transcript: Turn[];
  explanation: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   VERTICAL TEMPLATES — §5 innovation #1
   ═══════════════════════════════════════════════════════════════════════════ */

export interface VerticalTemplate {
  id: 'garage' | 'btp' | 'immo' | 'restaurant' | 'medical' | 'avocats';
  name: string;
  totalScore: number;
  killerOutcome: string;
  antiMetric: string;
  /** Default scope preset for this vertical */
  defaultScope: Record<string, boolean>;
  /** Booking rules preset */
  bookingRules: string[];
  /** The one killer metric for the Patron */
  patronMetric: string;
  callTypes: string[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   VOICE PERSONA LIBRARY — §5 innovation #15
   ═══════════════════════════════════════════════════════════════════════════ */

export interface VoicePersona {
  id: string;
  lang: 'FR' | 'EN';
  providerVoiceId: string;
  name: string;
  brand: string;
  /** "warm, slightly informal" etc — P3 the agent's character */
  character: string;
  /** Speed 0.8 .. 1.2 */
  speed: number;
  pitch: number;
  /** Sample phrase — shown next to the Play button */
  sample: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PILOT SCORECARD — §5 innovation #8
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ScorecardBar {
  label: string;
  value: number;
  target: number;
  /** Personas, §1: who this bar is for */
  ownedByPersona: 'P1' | 'P2' | 'P4' | 'P5' | 'P6';
  provisional: boolean;
}

export interface PilotScorecard {
  week: number;
  bars: ScorecardBar[];
  goNoGo: 'GO' | 'NO-GO' | 'WATCH';
  narrative: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COST SIMULATOR — §5 innovation #5
   ═══════════════════════════════════════════════════════════════════════════ */

export type PricingShape = 'per_minute' | 'per_call' | 'monthly_cap';

export interface CostSimulationInput {
  callsPerDay: number;
  avgDurationMin: number;
  shape: PricingShape;
  tier: 'standard' | 'premium';
  containedPct: number;
  transferredPct: number;
  voicemailPct: number;
  whatsappTextPct: number;
}

export interface CostSimulationResult {
  monthlyMin: number;
  monthlyMax: number;
  monthlyMid: number;
  perCallMid: number;
  perMinMid: number;
  driverBreakdown: { label: string; eurPct: number }[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   WHATSAPP SUMMARY CARD — §5 innovation #3
   ═══════════════════════════════════════════════════════════════════════════ */

export interface WhatsAppSummary {
  callId: string;
  sentAt: string;
  to: string;
  who: string;
  what: string;
  outcome: CallOutcome;
  nextAction?: string;
  bookingRef?: string;
  /** The actual message copy as sent to WhatsApp */
  messageText: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ═══════════════════════════════════════════════════════════════════════════
   SECOND PASS — everything below is additive on the block above
   ═══════════════════════════════════════════════════════════════════════════
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   PERSONAS — §1
   ═══════════════════════════════════════════════════════════════════════════ */

export type PersonaId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';

export interface Persona {
  id: PersonaId;
  name: string;
  role: string;
  /** §1: "What they want" */
  wants: string[];
  /** §1: "What they fear" */
  fears: string[];
  /** §1: concrete sketch — name, age, one line of context */
  sketch?: string;
  /** §1: which decision this persona owns, if any */
  owns: string[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLIENT DECISIONS — §4 + doc set "What the client is being asked to decide"
   ═══════════════════════════════════════════════════════════════════════════ */

export type DecisionId = 'D1' | 'D2' | 'D3' | 'D4' | 'D5';
export type DecisionState = 'open' | 'answered' | 'waived' | 'signed';

export interface ClientDecision {
  id: DecisionId;
  question: string;
  /** What this decision blocks, from the doc set */
  blocks: string[];
  /** Our recommendation, if any — §4 makes D4 a default */
  recommendation: string | null;
  /** §4 turns D4 into a default-with-escape-hatch, not a question */
  isDefaulted: boolean;
  state: DecisionState;
  answeredAt: string | null;
  answeredBy: string | null;
  answer: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEAD TIMES — doc set: "Two lead times are outside our control"
   ═══════════════════════════════════════════════════════════════════════════ */

export type LeadTimeId = 'meta_verification' | 'arcep_porting';

export interface LeadTime {
  id: LeadTimeId;
  label: string;
  owner: 'client' | 'us' | 'external';
  startedAt: string | null;
  estimatedDays: number;
  /** Doc set: "longer than the build" is the flag that matters */
  longerThanBuild: boolean;
  atRisk: boolean;
  /** Which gates this lead time blocks */
  gates: number[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   VERTICAL METRICS — §2 killer outcome, made measurable
   ═══════════════════════════════════════════════════════════════════════════ */

export interface VerticalMetricPoint {
  at: string;
  metric: string;
  value: number;
}

export interface VerticalMetrics {
  verticalId: VerticalTemplate['id'];
  /** §2: "the one killer outcome" */
  killerOutcome: string;
  /** The metric that tracks it, e.g. "appointment booking rate" */
  killerMetric: string;
  /** §2: the anti-metric — gaming killerMetric must not spike this */
  antiMetric: string;
  /** §2 second-order: revenue recovered from previously-missed calls */
  recoveredRevenueEur: number;
  bookingRate: number;
  falseBookingRate: number;
  /** Time series, oldest first */
  series: VerticalMetricPoint[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESCALATION LADDER — §3.1 + §5 #11
   ═══════════════════════════════════════════════════════════════════════════ */

export type LadderStep =
  | 'contain' | 'clarify' | 'offer_callback'
  | 'warm_transfer' | 'cold_transfer' | 'voicemail';

export interface EscalationState {
  step: LadderStep;
  reason: string;
  triggerGuardrail: GuardrailId | null;
  at: string;
  /** §5 #11: emotion-aware — angry escalates faster */
  emotionAtTrigger: CallerEmotion;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BILINGUAL / ACCENT — §5 #9, #10
   ═══════════════════════════════════════════════════════════════════════════ */

export type DetectedLanguage = 'fr' | 'en' | 'other';

export type FrenchAccent =
  | 'parisian' | 'marseille' | 'alsatian' | 'breton'
  | 'north_african' | 'quebecois' | 'unknown';

export interface LanguageTurn {
  turnIdx: number;
  detected: DetectedLanguage;
  /** §5 #9: code-switching — "bah", "du coup", "en fait" mixed with English */
  codeSwitchScore: number;
  accent: FrenchAccent | null;
  confidence: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GRACEFUL DEGRADATION — §5 #13
   ═══════════════════════════════════════════════════════════════════════════ */

export type DegradedMode =
  | 'normal' | 'dtmf_only' | 'alt_voice' | 'repeating' | 'text_fallback';

export interface DegradedState {
  mode: DegradedMode;
  since: string;
  reason: string;
  /** Mockup 10: "what still works without agent-core" */
  stillWorks: string[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHADOW MODE — §5 #2
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ShadowAnnotation {
  callId: string;
  turnIdx: number;
  at: string;
  by: string;
  note: string;
  verdict: 'good' | 'wrong' | 'overpromise' | 'missed_escalation';
}

export interface ShadowSession {
  id: string;
  startedAt: string;
  endsAt: string | null;
  status: 'listening' | 'review' | 'promoted' | 'discarded';
  callCount: number;
  annotations: ShadowAnnotation[];
  /** Reviewed after the fact: would the agent's answer have been right? */
  wouldHaveContainedPct: number | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CALLBACK PROMISE — §5 #12
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CallbackPromise {
  id: string;
  callId: string;
  callerMasked: string;
  promisedAt: string;
  dueBy: string;
  reason: string;
  fulfilledAt: string | null;
  fulfilledBy: string | null;
  /** §5 #12: if the callback fails, the client hears about it */
  breached: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOCAL-FIRST NODE — §5 #14 (T2 reachability)
   ═══════════════════════════════════════════════════════════════════════════ */

export interface LocalNodeHealth {
  id: string;
  hostLabel: string;
  state: 'up' | 'degraded' | 'down';
  lastSyncAt: string | null;
  /** T2 data is unreachable when this is not 'up' */
  t2Reachable: boolean;
  latencyMs: number | null;
  /** Never carries T2 content — only counts */
  chunkCount: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   VOICE A/B EXPERIMENTS — §5 #19
   ═══════════════════════════════════════════════════════════════════════════ */

export interface VoiceExperimentArm {
  personaId: string;
  calls: number;
  satisfaction: number;
}

export interface VoiceExperiment {
  id: string;
  startedAt: string;
  endsAt: string | null;
  status: 'running' | 'complete' | 'abandoned';
  armA: VoiceExperimentArm;
  armB: VoiceExperimentArm;
  winner: 'A' | 'B' | 'tie' | null;
  notes: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   KNOWLEDGE SCOPE WIZARD — §5 #6
   ═══════════════════════════════════════════════════════════════════════════ */

export interface WizardAnswer {
  questionId: string;
  /** The plain-language question shown to the client */
  question: string;
  /** Which tier this toggles when answered */
  tier: KnowledgeTier;
  /** Which scope items this controls */
  controlsItemIds: string[];
  answer: boolean | null;
}

export interface WizardState {
  step: number;
  totalSteps: number;
  answers: WizardAnswer[];
  /** §5 #6: the wizard produces the guardrail; it does not negotiate it */
  completed: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CNIL / REGULATOR — §1 P6
   ═══════════════════════════════════════════════════════════════════════════ */

export interface RetentionPolicy {
  /** §3.3 option A means no audio retention. 0 is a contract, not a default. */
  audioDays: 0;
  transcriptDays: number;
  /** Days to satisfy an erasure request */
  erasureSlaDays: number;
}

export interface ErasureRequest {
  id: string;
  receivedAt: string;
  subjectMasked: string;
  dueBy: string;
  completedAt: string | null;
  scope: ('transcript' | 'receipt' | 'summary')[];
}

export interface BreachLogEntry {
  id: string;
  at: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  cnilNotifiedAt: string | null;
  subjectsNotifiedAt: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PILOT CRITERIA — client/PILOT-CRITERIA.md
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PilotCriterion {
  id: string;
  label: string;
  target: number;
  comparator: 'gte' | 'lte' | 'eq';
  /** §1: who this bar serves */
  ownedByPersona: PersonaId;
  /** §4: bars are defined before anything is built */
  definedAt: string;
  provisional: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCOPE MATRIX — §6
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ScopeMatrixCell {
  tier: KnowledgeTier;
  canRead: boolean;
  canSpeak: boolean;
  leavesPremises: boolean;
  clientApproves: boolean;
  example: string;
}

export type ScopeMatrix = Record<KnowledgeTier, ScopeMatrixCell>;

/* ═══════════════════════════════════════════════════════════════════════════
   AFTER-HOURS — §5 #17
   ═══════════════════════════════════════════════════════════════════════════ */

export type AfterHoursMode =
  | 'take_message' | 'transfer' | 'announce_only' | 'callback_promise';

export interface AfterHoursPolicy {
  mode: AfterHoursMode;
  /** Windows, e.g. ["18:00–09:00", "Sat–Sun"] */
  windows: string[];
  /** Overrides the day policy on French public holidays */
  holidaysFollowSunday: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MULTILINGUAL OVERFLOW — §5 #18
   ═══════════════════════════════════════════════════════════════════════════ */

export interface MultilingualOverflow {
  callId: string;
  detectedLang: string;
  handled: 'translated' | 'human_transfer' | 'callback_promise' | 'refused';
  targetHuman: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CALL REPLAY — §5 #20 "why did it say that?"
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ReplayFrame {
  turnIdx: number;
  at: string;
  provenance: TurnProvenance | null;
  guardrailsChecked: GuardrailId[];
  guardrailsFired: GuardrailId[];
}

export interface CallReplay {
  callId: string;
  scopeVersion: number;
  frames: ReplayFrame[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPAM FILTER — §5 #16
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SpamFilterSettings {
  enabled: boolean;
  /** 0..1 — calls at or above this are flagged */
  threshold: number;
  allowlist: string[];
  blocklist: string[];
}

export interface SpamHit {
  callId: string;
  score: number;
  reasons: string[];
}