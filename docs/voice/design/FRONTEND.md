# Frontend — Voice & Messaging Agent Console

> **Status:** Gate 0 design. Target: spec Gate 3.
> **Companions:** [`UX.md`](UX.md) (what to build) · [`BACKEND.md`](BACKEND.md) (what it talks to) ·
> [`WIREFRAMES.md`](WIREFRAMES.md) · [`mockups/`](mockups/)
> **Locked design system:** `src/styles/globals.css` (`@theme`) · `src/shared/styles/ui-tokens.ts`

## 1. Where it mounts

| Concern | Decision |
|---|---|
| Feature dir | `src/features/agent/` — mirrors the existing `src/features/assistant/` convention |
| Route | `/calls`, `/calls/live/:id`, `/calls/:id`, `/ops`, `/ops/alerts`, `/ops/alerts/:id`, `/agent/config`, `/agent/knowledge`, `/agent/cost` (via `createRoute` in `src/router/routeTree.tsx`) |
| Nav entry | one group in `NAV_GROUPS` (`src/shared/components/layout/shell/navConfig.ts`) + `getActiveNavFromPath` / `getActiveSubItem` wired for it, with the sub-items from `UX.md` §4 |
| Insight rail | register the section in `INSIGHT_WIDGETS` so the right rail shows its own context (containment, open P1s) |
| Entry point | In `src-tauri/tauri.conf.json` the desktop already declares `externalBin: ["binaries/ml-sidecar"]`; the agent console adds **no** new sidecar |

⚠️ **No new files under `src/core` or `src/hooks`** — existing convention (spec invariant 8).

## 2. Component tree

```
AgentCallsPage                       src/features/agent/pages/
├── PageHeader (title · live indicator · range filter)
├── AiSuggestionBanner               ← shared; --color-ai; the per-section AI callout
│     "3 calls flagged: containment down 40% on pricing questions"
├── CallFilters (outcome · flagged · channel · range)
└── CallTable                        ← shared DataTable, columns as config objects
      └── CallRow → CallDrawer | /calls/:id

AgentLiveCallPage
├── CallStateHeader (state · elapsed · caller · channel)
├── TranscriptStream                 ← virtualized; aria-live polite
│     └── TurnRow (speaker · text · per-turn stage marks on expand)
├── StageMarksPanel (vad · stt · llm · tts for the current turn)
└── LiveGuardNote                    ← "read-only in v1" — no fake control

AgentOpsPage (digest)
├── DigestHeader ("since 18:00 yesterday")
├── DigestGroup (by call type, newest first)
│     └── DigestItem ("what happened" + the decision)
└── DigestEmpty / DigestPartial states

AgentAlertDetailPage
├── AlertHeadline (severity · age · blast radius)
├── DecisionCard (the one thing to do)  ← AiSuggestionBanner variant
├── EvidencePanel (affected calls · stage breakdown · provider status)
└── AlertActions (acknowledge · open call · escalate)
```

**Shared primitives only.** `DataTable`, `Avatar`, `AiSuggestionBanner`, the `ui-tokens` class
constants, `frost-surface`. A console-specific table or card is a design-system bug.

## 3. The speech abstraction layer — porting the RN wrapper's shapes

This is the section that decides whether the console, the desktop and mobile share one
vocabulary or drift into three.

**What the wrapper gets right** (`XDcobra/react-native-sherpa-onnx`, MIT, 40★): it does not
expose "call STT" and "call TTS" as loose functions. It exposes a small, disciplined set of
abstractions — an **engine facade**, a **model manager**, a **streaming session**, a
**capability/execution-provider registry**, and an **event stream**. Those five shapes are worth
having regardless of the runtime underneath, and they are what we port.

**What we do not take: the dependency.** It is a React Native TurboModule and this app is Tauri
v2 + Rust (spec invariant 5: *port patterns, not code*). We take the shape and write our own
names and types. Ported shapes get **our** names (`executionProvider`, not their plural
`executionProviders`; `SpeechStream`, not their session class).

### 3.1 Three runtimes, one interface

| Runtime | Engine binding | Process model | Why |
|---|---|---|---|
| **Desktop** | `sherpa-onnx` **Rust** crate | Tauri **sidecar** (`externalBin`), JSON-RPC over stdio — the `ml-sidecar` contract | Offline FR speech without the network; proven pattern |
| **Mobile** (Android/iOS) | same Rust crate | **in-process** — the Rust core is compiled into the app; `externalBin` is a desktop mechanism | `docs/01-ARCHITECTURE/05-mobile-architecture.md`: ~80% shared Rust, `#[cfg(mobile)]` for native glue |
| **Server** | `sherpa-onnx` **Python** binding, or its own **localhost WSS** server process | separate service (`agent-core`, `ADR-001` D1) | The 24/7 tier; keeps the C++ runtime out of the FastAPI process |

**The payoff:** one `SpeechEngine` interface, three backends selected by config — the same
"swap is a config value" discipline the four backend seams already use. The console does not
care which one is live; it talks to the interface.

### 3.2 Our interface (names are ours)

```ts
// src/shared/services/speech/types.ts
export type SpeechBackend = "server" | "local";
export type ExecutionProvider = "cpu" | "nnapi" | "xnnpack" | "qnn" | "cuda" | "metal";

export interface SpeechEngineConfig {
  backend: SpeechBackend;
  executionProvider?: ExecutionProvider;   // "local" only; explicit config, never a build flag
  locale: "fr" | "en";
  models: { stt?: string; tts?: string; vad?: string };
  hotwords?: string[];                     // per-tenant bias list (containment lever)
  sampleRateHz: 8000 | 16000;
}

export interface Capabilities {            // what THIS host can actually do
  stt: boolean; tts: boolean; vad: boolean;
  providers: ExecutionProvider[];          // e.g. ["cpu"] on a plain VPS
  modelsInstalled: Record<string, string>;
}

export interface SpeechStream {
  writePcm(chunk: ArrayBuffer): void;
  on(event: "partial" | "final" | "vad" | "audio" | "error", cb: (e: SpeechEvent) => void): () => void;
  close(): Promise<void>;
  readonly closed: boolean;
}

export interface SpeechEngine {
  init(cfg: SpeechEngineConfig): Promise<Capabilities>;
  capabilities(): Capabilities;
  startStream(opts?: { direction?: "in" | "out" }): Promise<SpeechStream>;
}
```

**`Capabilities` is the important one.** The wrapper's platform-status and
`execution-providers.md` pages exist because "supported" is per-host, not per-project. The
console must be able to render "offline model not installed on this device" instead of failing
at capture time — that is the difference between a support ticket and a settings screen.

### 3.3 Model manager — one path, not a second one

Port the wrapper's `download-manager` shape: resumable, progress events, integrity check,
background-capable (a foreground service is required on Android — that is the wrapper's finding
and it applies to us unchanged).

```ts
export interface ModelManager {
  list(): Promise<ModelDescriptor[]>;
  ensure(id: string, onProgress?: (p: { received: number; total: number }) => void): Promise<void>;
  integrity(id: string): Promise<"ok" | "corrupt">;
  remove(id: string): Promise<void>;
}
```

**Reuse before build:** the repo already downloads models — `aiDownloadModel` in
`src/features/assistant/services/aiSidecar.ts` and `stores/ragStore.ts` — with exactly the
problems this abstraction fixes (no resume, no integrity, no per-device capability view). The
ModelManager **extracts and generalises that existing path**; it must not become a third
download mechanism. If it cannot be re-expressed over the existing store, stop and report —
adding a parallel downloader is the defect, not the fix.

### 3.4 What we explicitly do not copy

| Not copied | Why |
|---|---|
| The React Native dependency | Wrong host runtime; a 40★ wrapper would become our build blocker |
| Its field and method names | `behaviorHints`-class renaming rule from the plugin protocol: the shape migrates, the names do not |
| Its module layout / podspec / Gradle wiring | Tauri handles native deps differently |
| Its transport (its own IPC) | Desktop uses stdio JSON-RPC (`ml-sidecar`); server uses HTTP/WSS |

## 4. State

Zustand slices under `src/features/agent/stores/`, split by domain (repo convention — 46 stores
across `src/shared/stores`, `src/features/*/stores`):

| Store | Holds | Notes |
|---|---|---|
| `callListStore` | filter, page, rows, loading/error | Never holds transcript text |
| `liveCallStore` | state, elapsed, current turns, stage marks, WS status | **Ring buffer** for turns, not an unbounded array |
| `opsStore` | digest, alerts, snapshot, acknowledgement | Snapshot is one fetch (`agent_get_ops_snapshot`) |
| `agentConfigStore` | voice, hours, transfer target, tier, KB scope | Dirty-state tracking; save is explicit |
| `speechEngineStore` | engine config, capabilities, model install state | Wraps the `SpeechEngine`/`ModelManager` services |

Subscribe components to **slices**, not whole stores. Transcript deltas must not re-render the
page header.

## 5. Data access

All DB/IPC through the typed wrappers — **zero direct SQL in TypeScript** (AGENTS.md):

- Rust commands via `invokeCommand` / `src/shared/services/db/db-invoke.ts`. **Never**
  `import { invoke } from "@tauri-apps/api/core"` in application code.
- The six additive commands from `BACKEND.md` §7, consumed through one
  `src/shared/services/agent/client.ts`.
- **The console never imports a provider SDK** — not ElevenLabs, not Deepgram, not OpenRouter
  (spec invariant 2). No API key of a speech vendor exists on the desktop at all.

## 6. i18n and RTL

- All strings via `t()`; keys under `src/locales/{en,fr,ar,ja,it}/translation.json`. **Never
  hardcode** UI copy — the console ships in 5 locales.
- Logical properties only: `ms-*`/`me-*`, `text-start/end`, `inset-inline-*`. The existing
  physical-direction violations are tracked separately (`docs/03-FRONTEND/10-rtl-audit.md`).
- ⚠️ **The UI must not imply Arabic voice support.** The app has an `ar` locale; the agent speaks
  FR/EN only. Label the language selector by what the *agent* does, not by what the UI has
  (`docs/glossary/glossary-voice-agent.md`: UI locale ≠ voice locale).
- Locale-aware formatting for durations, costs and timestamps.

## 7. Reused design system

| Need | Use | Token |
|---|---|---|
| AI summaries, proposed decisions, insights | `AiSuggestionBanner` (`onReview`/`onDismiss` optional) | `--color-ai` #9333ea, `bg-ai/[0.06]` |
| Live call state, primary actions | `BTN_PRIMARY`, `ROW_GAP_*` | `--color-accent` #0b57d0 |
| Call log | `DataTable` | config-object columns |
| Caller/operator identity | `Avatar` | gradient |
| Panels | `CARD_BASE` / `CARD_SURFACE` (`frost-surface`, `--radius-lg`), `ELEVATION_SM/MD` | `--glass-blur: 14px` |
| P1 severity | text label `P1` **plus** `--color-danger` | never colour alone |

## 8. Performance rules (the console is a realtime UI)

1. **Virtualize the transcript.** A 10-minute call is hundreds of turns; render a window, not
   the list.
2. **Batch deltas.** Coalesce WS deltas on an animation frame. Re-rendering per token is the
   classic streaming-UI failure.
3. **Ring-buffer live turns** in the store — bounded memory on a long call.
4. **WS reconnect with backoff**, and surface the state (`connected` / `reconnecting` /
   `offline`) in the UI. A silently dead transcript looks like a caller who stopped talking.
5. **One round trip for the ops view** (`agent_get_ops_snapshot`), not four requests.
6. **Memoize** stage-mark and row components; they re-render on every delta otherwise.
7. **Backpressure:** if the socket cannot keep up, drop *display* deltas, never recorded ones.
   The DB is the record; the UI is a view.
8. **No polling** for call state — the WS is the source; poll only the digest.

## 9. Accessibility implementation

Per `UX.md` §9, with the concrete mechanism:

- Transcript container: `aria-live="polite"` + `aria-atomic="false"`; deltas appended as
  separate nodes. Test with a screen reader, not by inspection.
- Alert list: roving tabindex; `role="row"` semantics if the shared `DataTable` provides them —
  otherwise a list, not a fake grid.
- Live indicator: `prefers-reduced-motion` respected via the app's existing pattern.
- Every icon-only control has an accessible name.
- Focus ring: the shared `FOCUS_RING` (`focus:ring-1 focus:ring-accent`), never a bespoke one.

## 10. Testing

| Level | What | Where |
|---|---|---|
| Unit | stores (reducers/ring buffer), delta coalescing, capability gating | colocated `*.test.ts` |
| Component | transcript live-region behaviour, alert row keyboard flow, empty/degraded states | `@testing-library/react` |
| Contract | the six commands' payload shapes vs `BACKEND.md` §7 (serde ↔ TS types) | colocated, mocked `invokeCommand` |
| Manual | a real call against a sandbox `agent-core` | `AGENT-PROMPTS.md` |

**Assert the test summary line, not the exit code** — vitest false-greens on this host.

## 11. Forbidden (the list a reviewer enforces)

- A second table/card/AI-banner component instead of the shared primitives.
- A provider SDK import anywhere in `src/` (it belongs to `agent-core` only).
- A tenant id passed from the client (`ADR-001` D4a).
- A live-call control that implies barge-in (out of v1).
- A play/audio button — **no audio is retained**.
- A `text-left` / `ml-*` / physical `left`/`right`.
- Direct SQL, or `invoke` imported from `@tauri-apps/api/core`.
- A hardcoded model id or dimension (`ADR-001` D2 — the dimension is config, not a constant).
- A third model-download path (§3.3).

## 12. Implementer's working set — concrete, copyable

### 12.1 Structural claims, verified against the repo (2026-09-28)

| Claim | Verified | Cite |
|---|---|---|
| `NAV_GROUPS` is the nav source of truth | ✅ | `src/shared/components/layout/shell/navConfig.ts:101` |
| `INSIGHT_WIDGETS` is keyed by route id, value is `InsightWidget[]` | ✅ | `src/shared/components/layout/shell/navConfig.ts:204` — existing keys: `unified`, `mail`, `crm`, `tasks`, `calendar`, `automation`, `vault`, `ai-assistant` |
| `getActiveNavFromPath(pathname)` returns a nav id | ✅ | `navConfig.ts:242` |
| `getActiveSubItem(pathname)` returns `string \| null` | ✅ | `navConfig.ts:266` |
| Routes are built with `createRoute` from `@tanstack/react-router` | ✅ | `src/router/routeTree.tsx:2` (import), `:200` `mailRoute` as the shape to copy |
| Nested routes use `getParentRoute()` + a **relative** `path` | ✅ | `routeTree.tsx:208-212` — `mailThreadRoute` is `path: "thread/$threadId"` under `mailRoute` |
| The desktop already ships an `ml-sidecar` binary | ✅ | `src-tauri/tauri.conf.json:39` — **note: `externalBin` sits under `bundle`, not at the top level** |

**Correction to §1:** the route list in §1 is written as absolute paths (`/calls/...`). Under
`createRoute` the `path` field is **relative to the parent route**, as `mailThreadRoute` shows.
A nested agent route (`calls/$callId`) declares `path: "$callId"`, not `"/calls/$callId"`. The
spec's full paths remain the public contract; the `path` field does not repeat the prefix.

**Adding the nav group** — one entry in `NAV_GROUPS` (`navConfig.ts:101`), one key in
`INSIGHT_WIDGETS` (`:204`) if the right rail is wanted, and both `getActiveNavFromPath` and
`getActiveSubItem` (`:242`, `:266`) must recognise the new prefixes. Missing either is the
usual cause of "the page loads but nothing in the shell highlights it".

### 12.2 The six command payload types (TypeScript, mirroring `BACKEND.md` §7)

```ts
// src/features/agent/types/commands.ts
export type CallChannel = "voice" | "whatsapp";
export type CallOutcome = "contained" | "transferred" | "voicemail" | "abandoned";
export type CallState =
  | "idle" | "connecting" | "greeting" | "listening"
  | "thinking" | "speaking" | "closing" | "wrapup";

/** NOTE: no tenantId field anywhere. It comes from the token, server-side (ADR-001 D4a). */
export interface CallListItem {
  id: string;
  channel: CallChannel;
  outcome: CallOutcome;
  state: CallState;
  startedAt: string;            // ISO 8601, UTC — format for display at the edge
  durationSec: number;
  callerMasked: string;         // "+33 6 •• •• 41 22" — full number is a separate field
  flagged: string | null;       // e.g. "pricing" | null
  costEur: number | null;       // null for WhatsApp service conversations
}

export interface StageMarks {
  vadMs: number | null;         // speech end -> STT start
  sttMs: number | null;         // -> final transcript
  llmMs: number | null;         // -> first token
  ttsMs: number | null;         // -> first byte
  turnGapMs: number | null;     // VAD -> first agent audio byte
}

export interface OpsSnapshot {
  generatedAt: string;
  since: string;
  p1: OpsAlert[];
  p2Grouped: Record<string, OpsAlert[]>;
  p3Count: number;
  callCount: number;
  containedPct: number;
  reachable: boolean;           // false => render "cannot reach the agent", NEVER "no calls"
  lastSeenAt: string | null;
}

export interface OpsAlert {
  id: string;
  severity: "P1" | "P2" | "P3";
  rule: string;                 // e.g. "transfer_failed"
  oneLiner: string;             // the decision, per OPS-ASSISTANT.md §5
  decision: string;
  evidence: { count: number; firstAt: string; lastAt: string; blastRadius: string };
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  /** PLACEHOLDER until pilot data exists — the UI must not present these as measurements. */
  thresholdIsProvisional: true;
}
```

`reachable` and `lastSeenAt` are **not optional** — omitting them is exactly how the
"offline looks like no calls" failure returns.

### 12.3 Store selectors, per surface

Components subscribe to selectors, never to whole stores.

| Surface | Store | Selectors |
|---|---|---|
| Call log | `callListStore` | `useCallRows()`, `useCallFilters()`, `useCallListStatus()` (`loading \| error \| ready`) |
| Call detail | `callListStore` | `useCallById(id)` — derived, not a second store |
| Live monitor | `liveCallStore` | `useLiveState()`, `useTurnWindow()` (ring buffer slice), `useCurrentStageMarks()`, `useWsStatus()` |
| Digest | `opsStore` | `useDigestGroups()`, `useDigestPartial()`, `useReachable()` |
| Alert list / detail | `opsStore` | `useAlertsBySeverity(s)`, `useUnacknowledgedCount()`, `useAlert(id)` |
| Config | `agentConfigStore` | `useConfig()`, `useConfigDirty()`, `useTierAvailability()` |
| Knowledge | `agentConfigStore` | `useKnowledgeScope()`, `useIngestState()` (`idle \| running \| failed`) |
| Cost | `costStore` | `useCostSummary()`, `useCostByCallType()`, `useOverModelCalls()` |

**`useReachable()` is read by every surface, not just the digest.** One store, one source of
the offline state — a per-component "am I online" check is how two surfaces disagree.

### 12.4 WebSocket reconnect state machine

A silently dead transcript is indistinguishable from a caller who stopped talking. Every
state is visible; none of them renders as an empty or stale list.

```
        connect()
  ┌────────┴─────────┐
  ▼                  │
IDLE ──open──▶ CONNECTING ──open──▶ ● CONNECTED ──────────────┐
  ▲                  │ timeout/error                          │ socket close
  │                  ▼                                        │ (code 1000 also
  │              BACKOFF ────attempt fails──▶ (delay ×1.8)     │  drops here:
  │                  │            ▲                           │  the server
  │            delay elapsed        │                           │  closed a call
  │                  │            reset                        │  end)
  │                  └────────────┘                           │
  │                                                          ▼
  │        open             ┌──────────────┐           STALE
  └──────────────────────── │  RECONNECTING │ ◀─────────────┘
                            └──────────────┘
                                   │ retries exhausted (5)
                                   ▼
                              OFFLINE  ──manual retry──▶ CONNECTING
```

| State | What the UI shows | Never shows |
|---|---|---|
| `IDLE` | nothing yet | — |
| `CONNECTING` | header chip `connecting…`, transcript area as *loading* | an empty transcript |
| `CONNECTED` | live indicator, streaming deltas | — |
| `STALE` (closed, retrying, data still displayed) | **banner: "connection lost 14:51 — showing data from 14:32"** + dimmed transcript | the frozen transcript with no marker |
| `RECONNECTING` | banner: "reconnecting (3/5)", transcript still visible but dimmed | a blank panel |
| `OFFLINE` (retries exhausted) | **"we cannot reach the agent · last seen 14:51"**, and the transcript is labelled as of that time | "no calls" |
| Manual `Retry` | returns to `CONNECTING` | — |

- Backoff: `delay = min(1000 * 1.8^n, 30_000)`, jitter ±20%, max 5 attempts → `OFFLINE`.
- A **stale** stream must keep its last-arrived timestamp and show it. The data is real, just
  old — discarding it is worse than labelling it.
- On `OFFLINE`, poll the digest only (per §8.8), never call state.

### 12.5 Delta-coalescing rule

Concrete, not "batch on an animation frame" alone:

1. WS deltas land in a module-level `pendingDeltaBuffer` (a plain array), **outside** React state.
2. A `requestAnimationFrame` loop drains it. If a frame is already scheduled, do not schedule
   another.
3. Per drain, apply **one** store update appending a batch, even if the batch has 40 deltas.
4. Coalesce *within* a turn: consecutive deltas for the same `turnId` merge into one append so
   a half-spoken line re-renders once, not per token.
5. Flush synchronously on `beforeunload` and on route change, so no text is lost in the last 16 ms.
6. **Cap the buffer at 500 deltas.** On overflow, drop the oldest *display* deltas and set a
   visible `truncatedDisplay` flag. Never drop what is recorded server-side (§8.7).
7. Never apply deltas to the transcript when `wsStatus !== CONNECTED` — a reconnect replay and a
   live stream must not double-append. Dedup on `(callId, turnId, seq)`.

## 13. Open questions

| # | Question | Owner | Blocks |
|---|---|---|---|
| 1 | Does the desktop console need the **local** speech backend at all in v1, or only the server one? | us | `SpeechEngine` backend default |
| 2 | Mobile: is the console shipped inside the Tauri Android app, or as a phone-responsive web view of the server? | us | nav + auth model |
| 3 | Does the owner see transcripts at all, or only summaries? (privacy vs utility) | client | `/calls/:id` |
| 4 | Retention window surfaced in the UI | counsel | call detail |
