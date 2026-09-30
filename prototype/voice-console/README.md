
# Voice Console — high-fidelity prototype

**Design artifact, not product code.** It exists to settle layout, copy and
behaviour before Gate 3 builds the real console in `src/features/agent/`.

```bash
cd prototype/voice-console
npm install
npm run dev          # http://localhost:5199
```

---

## What it is

A React 19 + Zustand + Vite prototype of the Voice & Messaging Agent console.
It covers the nine surfaces from `docs/voice/design/WIREFRAMES.md`, and it
extends each of them with the **multi-provider AI layer** the agent runs on:
which provider handles which stage, what happens when one fails over, and
what each configuration costs.

| Key | Surface | File |
|---|---|---|
| `1` | Calls | `src/pages/CallsPage.tsx` |
| `2` | Live monitor | `src/pages/LivePage.tsx` |
| `3` | Ops digest | `src/pages/OpsPage.tsx` |
| `4` | Config | `src/pages/ConfigPage.tsx` |
| `5` | Knowledge | `src/pages/KnowledgePage.tsx` |
| `6` | Cost | `src/pages/CostPage.tsx` |
| `7` | Topology & capabilities | `src/pages/TopologyPage.tsx` |
| `8` | Settings | `src/pages/SettingsPage.tsx` |
| `9` | Scenarios | `src/pages/ScenariosPage.tsx` |
| `?` | Shortcut help | — |
| `f` | Flagged-only filter | — |
| `Esc` | Back to Ops | — |

---

## What is new in this revision

This revision adds a second layer to every surface: **the AI provider layer
the voice agent runs on.** The layer is not a page of its own. It shows up as
context on the surfaces where the decision is actually made.

| Concern | Where it lives | What it looks like |
|---|---|---|
| Provider catalog | Settings → Providers | 10 providers, capabilities, test state |
| BYOK credentials | Settings → Keys | one row per provider, key lives on a machine, not in the console |
| Task routing | Settings → Providers, Config → AI routing | 9 slots, primary + ordered fallback chain |
| Provider mix presets | Config → AI routing, Cost → preset picker | OpenAI-primary / Gemini-primary / Mistral-lean / Self-hosted |
| Per-stage attribution | Live → sidebar, Calls → detail panel | one badge per stage, tinted when a fallback fires |
| Provider health | Ops → provider health | 10 rows, degraded + fallback flags |
| Provider-scoped alerts | Ops → P2 alerts | `provider_stt_fallback` deep-links to Settings |
| Embedding-space pinning | Knowledge → Index & spaces | one card per space, swap cost spelled out |
| Rate cards | Cost → rate cards | every number sourced, verified flag per row |

The four invariants of the AI layer:

1. **Every provider is a first-class citizen.** Colour, label, model id, and
   licence come from `providers/providerMeta.ts`. A page never hardcodes
   "OpenAI" as a string — it uses `<ProviderBadge>`.
2. **Every routing decision is visible somewhere.** A route is a `TaskRoute`
   in the store. It is shown on the page where it matters.
3. **Every rate is sourced.** A rate card has a `source` string and a
   `verified: boolean`. Nothing is a naked number.
4. **The AI layer is not a separate destination.** There is no `/providers`
   route. The provider layer is context on Ops, Live, Calls, Config, Cost,
   Knowledge, Topology, and Settings.

### What the AI layer demonstrates, not just describes

- **Failover is per-stage, not per-call.** If Deepgram STT returns 5xx, the
  STT stage falls back to Voxtral while the LLM and TTS stages keep running
  on their own primaries. `CallListItem.providerMix` shows the split.
- **Presets are cross-cutting.** Applying "Mistral-lean" on Config changes
  routing *and* the cost simulator *and* the topology page — because all
  three read from the same store slice.
- **Embedding spaces are pinned.** `Knowledge → Index & spaces` names each
  vector space, its model, its dimensions, and its swap cost. bge-m3 and
  arctic-embed-l are the same shape (1024-d) and different spaces — the page
  says so, and the swap warning is on the same card.
- **BYOK is enforced by placement.** The console stores a *reference* to a
  key, never the value. The Keys tab says which machine holds the credential
  and why. A key on the wrong machine shows `auth_failed`, and that is the
  correct behaviour — the seam is doing its job.
- **Credentials are per-tier.** Cloud tier puts every key on the agent-core
  VPS; the self-hosted tier keeps local-provider keys on the desktop. The
  Topology page derives the per-node provider list from the current routing,
  not a hard-coded list.

---

## Grounding — nothing here is invented

| Concern | Source |
|---|---|
| Colour, radius, elevation, blur | `src/styles/globals.css` (`@theme`), copied verbatim into `index.html` |
| Token class vocabulary (`BTN_PRIMARY`, `CARD_BASE`, `FOCUS_RING`) | `src/shared/styles/ui-tokens.ts` |
| App rail + console nav | `src/shared/components/layout/shell/navConfig.ts` |
| Types and payload shapes | `docs/voice/design/BACKEND.md` §13 |
| Stores, selectors, WS states | `docs/voice/design/FRONTEND.md` §12.2–12.5 |
| Alerts, matrix, digest rules | `docs/voice/dev/OPS-ASSISTANT.md` §3, §5 |
| Call states, stage marks, metrics | `docs/voice/dev/CALL-FLOW.md` §1, §3 |
| Keyboard map, focus order, RTL matrix | `docs/voice/design/UX.md` §14–16 |
| Provider per seam, licences, key placement | `docs/voice/design/BACKEND.md` §3, §6 |
| Local engine + RTF gate | `docs/voice/dev/SELF-HOSTING.md` |
| Topology and the key-placement question | `docs/06-ROADMAP/17-voice-agent-topology-decision.md` |
| Model IDs, provider capabilities | vendor docs, verified 2026-09-30 (see `types.ts` header) |
| Rate cards, cost drivers | `data/costPresets.ts` — every row carries `source` and `verified` |

---

## The invariants it demonstrates, not just describes

### Behavioural

- **No audio, anywhere.** No play button, no waveform. The transcript is the
  record.
- **No barge-in control.** The live view says so in as many words.
- **"Cannot reach the agent" never renders as "no calls."** Break the socket
  on Live, or simulate an offline agent-core on Topology.
- **Purple = inferred, neutral = fact.** Summaries and judgements use the AI
  purple; transcripts and tables stay neutral.
- **Thresholds carry provenance.** Provisional thresholds are tagged, and the
  digest will show you why on demand.
- **Provider keys are per-tier and the screen says which machine holds them.**

### AI-layer

- **A provider always shows its colour.** Anything that names a provider uses
  `<ProviderBadge>`, never a plain string.
- **A rate always shows its source.** Any number labelled € has a `source`
  and a `verified` flag on the `RateCard` it came from.
- **A swap always shows its cost.** When a UI offers to change a provider,
  the consequence (re-embed, re-key, refactor) is visible on the same screen.
- **A preset is one decision, seen two ways.** Applying a preset on Config
  updates Cost and Topology without a second edit.

---

## The nine surfaces

### Calls — `CallsPage.tsx`

The call list. Columns: caller, duration, channel, mood, outcome, LLM,
flag, cost, when. Row click opens a detail panel with the WhatsApp follow-up,
the warm-transfer brief, and the per-call provider mix.

The LLM column shows the primary LLM for the call and a `+N` for the rest of
the mix. A `⚠` appears when any stage fell back mid-call. This is the cheapest
way to surface the AI layer inside a table operators already read.

### Live — `LivePage.tsx`

A running transcript. Each turn shows role, emotion, any guardrail that fired,
and — on agent turns — a `providerUsed` badge. The sidebar has five blocks:

- **Stage marks** — VAD, STT, LLM, TTS, with the provider that owns each slot.
- **Voice routing** — primary + ordered fallback chain, read live from the
  task router.
- **Emotion ladder** — the §5 #11 view; two angry turns skips the ladder.
- **Warm-transfer brief** — the §5 #4 brief the receiving human gets.
- **Degradation mode** — the §5 #13 test surface for graceful fallback.

### Ops — `OpsPage.tsx`

The digest. P1 alerts first, then P2 grouped by rule (not by time), then a
collapsed P3 list. Below the digest: the pilot scorecard, provider health
(10 rows), and the consent receipt audit.

A provider-scoped P2 alert — `provider_stt_fallback` — shows a
`ProviderBadge` next to the one-liner and links to Settings → Providers. The
alert detail's evidence table swaps shape based on alert type: provider
alerts show `caller / stage / fell back to / latency`; quality alerts keep
`caller / waited / message`.

### Config — `ConfigPage.tsx`

Tabs: Vertical, Consent, Voice personas, Language + voice, Availability,
Tier, AI routing, Guardrails & innovations.

The **AI routing** tab is new. It has the provider-mix preset picker (one
click, N routes change) and the effective routing table below it — the same
table that Settings shows, filtered to what this tenant currently uses.

### Knowledge — `KnowledgePage.tsx`

Tabs: Scope matrix, Scope wizard, Version history, **Index & spaces** (new).

The **Index & spaces** tab names every embedding space: id, tiers, model,
dimensions, host, doc count, licence, and a swap-cost warning. This is the
vector-space trap made visible — bge-m3 and arctic-embed-l are the same
shape and different spaces, and the card says so.

### Cost — `CostPage.tsx`

The live cost simulator. Preset picker first (because it drives the rest),
then volume, then pricing shape and tier, then outcome mix. The results
column has the monthly estimate, a **sensitivity card** (toggle "+20% on
carrier / TTS / STT / LLM" and watch the number move), and the driver
breakdown.

Below the simulator: the **preset comparison** (all four presets at the
current volume, with their absolute € and dominant cost driver), the **rate
cards** (every rate sourced), and the historical cost table.

### Topology — `TopologyPage.tsx`

Two nodes side by side: the desktop and the agent-core VPS. Below them, the
provider connections **derived from the current routing** — applying a
preset on Config updates this page without a second edit.

The tier table says which machine holds which keys, and the page never
implies that both tiers are local at once.

### Settings — `SettingsPage.tsx`

Tabs: Providers, Keys (BYOK), Local hardware, About.

**Providers** — a 10-row catalog with capabilities, credential state, and a
test button. Below: the full task-routing table (9 slots).

**Keys** — one row per provider. The client enters their own key; the
console stores a reference, not the value. A key on the wrong machine
shows `auth_failed`, which is the correct behaviour.

### Scenarios — `ScenariosPage.tsx`

The guardrail testing ground. Eight scenarios, each encoding one persona
fear. Filters by status (All / Passed / Failed / Not run) and by persona
(P1–P6). A failure banner appears when anything is red. "Run all" runs
everything, then jumps to the first failure.

Below the simulator: the **guardrail catalog** — 11 guardrails with their
tier, escalation target, and persona rule.

---

## File map

```
src/
├── App.tsx                    # Route switch + key map + unbuilt-route fallback
├── main.tsx                   # Vite entry
├── components/
│   ├── Shell.tsx              # App rail + nav (grounded in navConfig.ts)
│   ├── ProviderBadge.tsx      # Coloured pill for every provider
│   └── ui.tsx                 # 25 primitives, no domain knowledge
├── data/
│   └── costPresets.ts         # Rate tables, driver breakdowns, rate cards
├── data.ts                    # Fixtures shaped like BACKEND.md §13 payloads
├── providers/
│   └── providerMeta.ts        # Brand colours, labels, capabilities per provider
├── scenarios/
│   └── runner.ts              # Pure simulation, no React
├── pages/
│   ├── CallsPage.tsx
│   ├── LivePage.tsx
│   ├── OpsPage.tsx
│   ├── ConfigPage.tsx
│   ├── CostPage.tsx
│   ├── TopologyPage.tsx
│   ├── KnowledgePage.tsx
│   ├── ScenariosPage.tsx
│   └── SettingsPage.tsx
├── store.ts                   # 24 Zustand slices
└── types.ts                   # Domain contract (~900 lines, section headers)
```

---

## Screenshots

Captured from the running app at 1440×1000 (see `shot.cjs`):

- `ops` — digest, provider health, consent audit
- `calls` — the list with the LLM column, and the detail panel
- `live` — transcript, per-stage provider badges, voice routing block
- `config` — the AI routing tab with the preset picker
- `cost` — preset comparison + sensitivity panel + rate cards
- `topology` — the two nodes side by side, provider connections derived from routing
- `knowledge` — the Index & spaces tab
- `settings` — the provider catalog and BYOK panel

---

## Known limits of this artifact

- **Routing is a `switch`, not `@tanstack/react-router`.** The real console
  uses `createRoute` (`src/router/routeTree.tsx`). Adding a router to a
  prototype buys nothing and would add a dependency.
- **No i18n.** The real console ships 5 locales with logical properties
  only; here the copy is hardcoded English so the screens stay readable.
- **State is fixture data** shaped like the real payloads (`src/data.ts`).
- **The AI provider layer is a UI mockup.** No real SDK calls, no real keys.
  Credentials are stored as `configured: boolean`. The prototype never
  persists a secret value.
- **The rate cards are placeholders.** Every row carries a `source` string
  and a `verified` flag. Only three structural facts are verified (self-hosted
  engines have no per-minute API cost; Meta's inbound 24h window is free by
  policy). The rest await `COST-MODEL.md` §6.
- **Second-pass pages are placeholders.** Eleven routes exist in the `Route`
  union (`personas`, `shadow`, `wizard`, `callbacks`, `regulator`, etc.) and
  render an `<UnbuiltRoute>` panel. They are declared so that adding them
  later is a build, not a refactor.
- **This is not the product.** Do not promote any file in here into `src/`.

---

## How to work in here

### The three-layer rule

```
  ┌─ Pages ─────────────────────────────────────────────┐
  │  One file per surface. Domain content only.         │
  │  Never holds shared state. Never re-implements a    │
  │  widget.                                            │
  └─────────────────────────────────────────────────────┘
              ↓ imports
  ┌─ Components (ui.tsx, ProviderBadge, Shell) ─────────┐
  │  Reusable shapes. No domain knowledge.              │
  │  Nothing here imports from pages or store.          │
  └─────────────────────────────────────────────────────┘
              ↓ reads
  ┌─ Store + Data + Types ──────────────────────────────┐
  │  The contract. Every page reads from here.          │
  │  Nothing here knows about React or a page.          │
  └─────────────────────────────────────────────────────┘
```

The single rule that keeps the artifact coherent: **each layer only imports
from the layer below it.** A page can import from `ui.tsx`; `ui.tsx` cannot
import from a page. A store can import from `data.ts`; `data.ts` cannot
import from the store.

When you feel the urge to break this rule, the correct move is almost always
to add a primitive to `ui.tsx` or a slice to `store.ts`.

### Adding a page

1. Check the `Route` union in `store.ts`. If the surface is already there
   (`personas`, `shadow`, etc.), you are extending a placeholder.
2. Read the fixture in `data.ts`. Populate it if it is a stub.
3. Read a reference page: **Settings** (tabs + cross-cutting state),
   **Calls** (table + detail panel), **Knowledge** (wizard flow),
   **Scenarios** (pure simulator behind a UI).
4. Read the relevant primitives in `ui.tsx`. There are 25. Do not hand-roll
   a `<button>` or an `<input>`.
5. Write the page. If a shape is missing from `ui.tsx`, add the primitive
   first, then use it.
6. Add an AI-layer block if the surface has a provider implication.

### Adding a provider

1. `types.ts` — add the id to the `AiProvider` union.
2. `providers/providerMeta.ts` — add display meta (colour, label, host,
   capabilities).
3. `data.ts → PROVIDER_CREDENTIALS` — add a row with `configured: false`.
4. `data.ts → TASK_ROUTES` — add as a fallback in the relevant slots.
5. `data/costPresets.ts → RATE_CARDS` — add a rate card if it has a
   per-minute cost.
6. `data/costPresets.ts → PRESET_PROVIDER_MAP` — update the presets that
   should use it.

Every page that renders a provider reads from these six places. No page
needs a code change.

### Adding a capability slot

1. `types.ts` — extend `AiCapabilitySlot`.
2. `data.ts` — add a `TaskRoute` to `TASK_ROUTES`.
3. `providers/providerMeta.ts` — update the `capabilities` array for every
   provider that can serve it.
4. `SettingsPage.tsx` and `ConfigPage.tsx` — extend `CAPABILITY_LABELS`
   (this duplication should be extracted next session).

### What belongs where — a cheat sheet

| If it is… | It goes in… |
|---|---|
| A colour, radius, or shadow | `index.html` (tokens) |
| A pill, button, card, table | `ui.tsx` |
| A provider name + model + colour | `ProviderBadge` |
| A shape every page agrees on | `types.ts` |
| A fixture every page reads | `data.ts` |
| A rate or rate-derived number | `data/costPresets.ts` |
| A number only one page needs | the page itself |
| A shape only one page needs | the page itself |
| State that survives route change | `store.ts` |
| State that dies on unmount | the page's `useState` |

The last two rows are the boundary that gets violated most often. Everything
in `store.ts` is a *shared* fact; everything in `useState` is a *local*
detail.

### The meta-question to ask before adding anything

Every addition should answer yes to at least one of:

- **Does it make a decision visible?** (provider mix, routing table,
  embedding spaces, rate cards)
- **Does it make a failure visible?** (degraded mode, fallback flags,
  provider health, alert detail)
- **Does it make a cost visible?** (preset picker, sensitivity, driver
  breakdown)
- **Does it make a boundary visible?** (T0–T3 tiers, keys per tier, per-node
  providers)

If it does none of those, it is probably content, not structure — and content
belongs in a fixture, not a new component.

### The invariants — what to never violate

Six behavioural, four AI-layer. Every one is stated above, and every one has
a corresponding piece of code that enforces it. If you find yourself writing
code that violates one, that is a signal that the invariant is wrong, not the
code — in which case, update this README first, then the code.

---

## Reading order for a new contributor

If you have **five minutes:**

1. This README.
2. `types.ts` — skim the section headers.
3. `store.ts` — skim the export names.

If you have **thirty minutes:**

1. `SettingsPage.tsx` — the reference page.
2. `providers/providerMeta.ts` — how provider display works.
3. `data/costPresets.ts` — how rates flow through the prototype.
4. `ui.tsx` — what is available as a primitive.

If you have **two hours:**

1. `CallsPage.tsx` and `LivePage.tsx` — the pair that shares
   `<ProviderBadge>` most.
2. `KnowledgePage.tsx` — the wizard pattern, the embedding-space view.
3. `ScenariosPage.tsx` and `scenarios/runner.ts` — the pure-logic pattern.
4. The original voice agent brief, if it is on disk.

---

## What is next

Three menus, ordered by how much thinking they require.

### Menu A — Cleanup (small, no new thinking)

- `ConfigPage.tsx` imports `PRESET_RATE_FACTOR` from `costPresets.ts` instead
  of declaring it locally.
- `ScenariosPage.tsx` drops the `void Zap` at the bottom.
- A shared `CAPABILITY_LABELS` constant, imported by Config, Cost, and
  Settings.
- `data.ts` gets a header note about the empty stub fixtures so nobody
  wonders if they are broken.

### Menu B — Depth (medium, requires deciding what the artifact says)

Pick one surface that currently tells a partial story, and deepen it:

- **Scenarios** — add a *provider-failure* family: STT times out mid-guardrail,
  LLM 429s, TTS falls back to an alt voice. The runner already supports
  arbitrary transcripts; the guardrails just need a `providerRef` field.
- **Ops** — add a **provider timeline**: which provider was primary at each
  hour of the day. Makes failover legible as a sequence.
- **Cost** — add a **break-even chart**: at what call volume does each preset
  win? Currently the comparison is a table; a chart would say "selfhosted
  overtakes at 800 min/mo."

### Menu C — Build a second-pass page (large, new content)

The `Route` union has 11 unbuilt pages. In order of value:

1. **Personas** — the spine of every other page's copy. Static content, no
   new state. It would let every "P1/P2/P4" pill in the prototype link
   somewhere meaningful.
2. **Shadow** — the "one week of silent listening" flow. Currently a toggle
   on Config with a banner. It deserves its own surface with the review
   queue, the annotation tool, and the promote/discard decision.
3. **Regulator** — the CNIL audit trail: consent receipts, retention policy,
   erasure requests, breach log. All the data exists in fixtures.

**Recommended order:** Menu A (one session, ten minutes), then Menu B
specifically Scenarios with provider-failure, then Menu C starting with
Personas.

The reasoning: Menu A removes the drift risk. Menu B closes a gap that the
current prototype *implies* but does not show. Menu C adds a surface only
when the artifact has enough shape that a new page slots in cleanly.
```