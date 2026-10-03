# AI Agents & Console — Brainstorm

> **Status:** 🧠 BRAINSTORM — nothing here is built. Decisions at §9 gate the work.
> **Branch:** `feat/voice-agents-console`
> **Grounded in:** the repo as it exists today (every number below was measured, not recalled).

---

## 0. The two problems, stated plainly

**Problem A — we have an agent, singular.** `services/agent-core/` is an inbound AI
receptionist for one French SME. Phases A–B are closed: four provider seams, `/session`,
`/ws/transcript`, `/ops/snapshot`, four migrations, a licence gate. It is a *good* design and it
is *one agent*. Everything about it — the console, the config, the knowledge scope — assumes
there is exactly one, and that it lives in a Python service we operate.

Meanwhile the desktop app has **7,193 lines** of AI service (plus 2,223 lines of tests) across
**11 providers**, **14 capability interfaces**, and **10 task routes**. That is a second,
completely separate AI stack that shares no vocabulary with the first.

**Problem B — the AI UI shows almost none of it.** `AiAssistantPage.tsx` is a semantic-search
box over RAG. That is it. The app can do vision, tool calling, structured output, context
caching, batch, realtime voice, embeddings, STT/TTS on-device across eleven providers — and the
user-visible surface is one search field. The AI service is far ahead of the AI UI.

**And a third thing, discovered while measuring:** `src/features/agent/` — **2,898 lines** ported
from the prototype in Phase A (types, stores, api client, WS socket, components) — is
**dead code**. Nothing imports it. It is not in the router. It compiles and does nothing.

```
$ grep -rn "features/agent" src/ | grep -v "^src/features/agent/"
(no output)

$ grep -c "features/agent" src/router/routeTree.tsx
0
```

That is the most concrete fact in this document: Phase A produced a correct, compiling,
unreachable console.

---

## 1. Verified inventory

Everything below was read out of the tree on this branch, not remembered.

### 1.1 Desktop AI service — `src/shared/services/ai/`

| Thing | Count | Detail |
| --- | --- | --- |
| Source LOC | **7,193** | excluding tests |
| Test LOC | **2,223** | |
| Providers | **11** | openai, claude, gemini, mistral, copilot, byteplus, openrouter, ollama, lmstudio, openai-compatible, custom |
| Capability interfaces | **14** | Text, Streaming, Embedding, STT, TTS, RealtimeVoice, ModelDiscovery, ConnectionTest, StructuredOutput, ToolCalling, Reasoning, Vision, ContextCaching, BatchProcessing |
| Task routes | **10** | `email.classify`, `email.summarize`, `email.compose`, `email.reply`, `email.improve`, `email.shorten`, `email.formalize`, `rag.query`, `voice.stt`, `voice.tts` |
| Prompt templates | **15+** | summarize, compose, reply, improve, shorten, formalize, smart-reply, ask-inbox, RAG answer, categorize, writing-style, polish, auto-draft, smart-label, content-quality, extract-task |
| Local model catalog | 4 kinds | LLM, STT, TTS, embedding — with real repos, byte sizes, licences |
| `local` provider | 1 | on-device speech (sherpa-onnx), deliberately excluded from chat routing |

The capability system is genuinely good: narrow composable interfaces with type guards, a task
router with fallback chains and cost-aware scoring, embedding-space pinning. **This is the
asset.** The problem is that nothing in the UI exposes it as a thing the user can see, choose,
or reason about.

### 1.2 Voice agent — `services/agent-core/` + `src/features/agent/`

| Thing | State |
| --- | --- |
| `agent-core` Python | ✅ Phases A–B closed — `api.py`, `api_v1.py`, `contracts.py`, `providers/{base,catalogue,chain,fixtures,licensing}.py` |
| Migrations | 4 applied-shaped — `0001_tenants`, `0002_calls`, `0003_metering`, `0004_knowledge` |
| Rust bridge | ✅ `src-tauri/src/agent/{mod,client,types}.rs` |
| Console (ported) | ⚠️ **2,898 LOC, unreachable** |
| Prototype | ✅ 9 surfaces, ~5,000 LOC, runs standalone |
| Phases C/D/E | 🟡 C in progress · 🔴 D blocked (client) · 🟡 E never started |
| Client blockers | 4 decisions + cost-model sign-off — block the **pilot**, not the build |

### 1.3 The design vocabulary that already exists

Worth keeping, because it is better than anything I would invent now:

- **Personas P1–P6** — Patron (owner), Caller, **Agent** (the AI itself), Staff, Operator (us), Regulator
- **Knowledge tiers T0–T3** — T0 public · T1 business · T2 local-node-only · T3 never-checked
- **11 guardrails** — with exact French refusal copy
- **Consent model A/B/C** — announce-first, no audio recorded
- **The four provider seams** — STT / LLM / TTS / retrieval, swappable by config value alone

The prototype also settled a **9-surface IA**: Calls · Live · Ops · Alert · Config · Knowledge ·
Cost · Topology · Scenarios.

---

## 2. The gap, precisely

Three gaps, in dependency order:

**Gap 1 — no Agent is a thing.** In `agent-core`, "the agent" is implicit — it is whatever the
service does. There is no `Agent` record, no id, no list, no way to have two. `useConfigStore`
holds *the* config. The moment you want a second behaviour (an ops watcher, an inbox assistant),
there is nowhere to put it.

**Gap 2 — the desktop AI and the voice agent share no vocabulary.** The desktop has
`AiProvider`, `AiTask`, `AiCapability`. The voice agent has `ProviderTier`, `SessionPurpose`,
`KnowledgeTier`. Both mean "which model, for what job, allowed to see what" — and neither knows
the other exists. Two routers, two provider lists, two cost stories.

**Gap 3 — the console is unreachable and the AI UI is a search box.** 2,898 lines of ported
console that nothing renders; and an AI surface that shows none of the 7,193-line service.

---

## 3. The core idea

> **An Agent is a named composition of five things that already exist separately.**

```
Agent =  role + knowledge scope + tools + model policy + channels
         ────   ───────────────   ─────   ────────────   ────────
         who    what it may see    what    which model    where it
                (T0–T3 tiers)      it can  for which      is reachable
                                   do      task
```

Every one of those five already exists in the tree — they are just not *bound together* or
*given a name*:

| Part | Already exists as | Missing piece |
| --- | --- | --- |
| **role** | P1–P6 personas (design), the 15 prompts (code) | a persisted `role` field + per-role instructions |
| **knowledge scope** | `KnowledgeTier` T0–T3, `KnowledgeScopeItem`, RAG collections | binding a scope to an agent (currently global) |
| **tools** | 14 capability interfaces, 10 task routes | declaring *which* an agent may call |
| **model policy** | `taskRouter` routes + fallbacks, `ProviderTier` T0–T3 (voice) | one router instead of two |
| **channels** | voice (agent-core), WhatsApp (planned), desktop chat | declaring which an agent is bound to |

**The receptionist becomes one instance of this, not the special case it is today.** An ops
watcher becomes another. An inbox assistant becomes a third. Same five parts, different values.

### Why this is the right shape

- **It reuses everything.** No new provider layer, no new router, no second cost story. The
  capability system, task router and model registry are already the hard parts, and they are done.
- **It makes the voice console reachable.** `useConfigStore` becomes "the config of *this*
  agent" — which is exactly what `ConfigPage` already draws, just parameterised by id.
- **It unifies two stacks without merging them.** `agent-core` keeps running the voice channel;
  the desktop keeps its providers. They agree on the *Agent* record and on the task-router
  contract. Nothing is rewritten.
- **It answers "each agent does something specific"** — a role is a thing with a job, not a
  temperature setting.

### The one rule that keeps it honest

> **An agent may only use tools and knowledge its scope grants. The grant is checked at call
> time, in one place, and a denial is an event — not a silent fallback.**

That mirrors the existing `KnowledgeTier` design (T3 = never-checked, enforced not advisory) and
the existing task-router guard that keeps `local` out of chat routing. Same principle, one more
layer up.

---

## 4. A concrete agent roster

Not a wishlist — each one is justified by something already in the tree.

| # | Agent | Role | Channels | Tools (from the 14) | Knowledge | Model policy |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Receptionist** (exists) | P3 Agent — answer, triage, transfer | voice, WhatsApp | STT, TTS, Text, ToolCalling | T0/T1 + T2 local-node | voice.stt → selfhosted, voice.tts → selfhosted, reply → claude |
| 2 | **Inbox Assistant** | triage + draft, never send | desktop chat | Text, Streaming, Embedding, ToolCalling | T1 email | email.classify → gpt-4.1-nano, reply → claude |
| 3 | **Ops Watcher** | watch, summarise, alert | desktop + cron | Text, StructuredOutput | ops snapshot only | cheap model, scheduled |
| 4 | **Bookkeeper** | invoice/expense extraction | desktop | Text, Vision, StructuredOutput | T1 + invoicing | vision → gemini, extract → structured |
| 5 | **Writer** | campaigns, replies, tone | desktop | Text, Streaming, Embedding | writing-style profile | compose → claude |

Agents 2–5 need **no new providers and no new prompts** — the 15 prompts and 11 providers already
cover them. What they need is a record, a scope, and a surface.

**Anti-roster (deliberately not agents):** a "summarise this thread" button is a *function*, not
an agent. It has no role, no scope, no channel. Keeping functions as functions is what stops this
from becoming a directory of one-button agents.

---

## 5. UI — what to build

The user-facing goal: *the AI service, made visible and controllable.* Today one page shows one
of its 7,193 lines.

### 5.1 Proposal — an **AI Console** with a concern-separated tab set

Extends the existing `AiTab` (currently `models · features · kb · ai-router`) and the
`AiAssistantPage` (currently RAG search). IA in the established style — grouped, tabs, not one
long scroll.

```
AI
├── Agents        ← NEW · the roster above. Each row → its own config surface.
│                    (role · knowledge scope · tools · model policy · channels · budget)
├── Chat          ← the existing RAG search, promoted: provider+model picker,
│                    streaming, tool-call trace, "which agent answered"
├── Models        ← EXISTS · registry + capability matrix (14 × 11), local catalog
├── Knowledge     ← EXISTS · collections, T0–T3 tiers, ingest state
├── Voice         ← EXISTS · sidecar, STT/TTS, voices, offline speech
└── Activity      ← NEW · every AI call: agent, task, model, tokens, cost, latency,
                     guardrail hits. This is the "everything we've got" surface.
```

### 5.2 What each new surface shows (and from where)

| Surface | Reads | Why it matters |
| --- | --- | --- |
| **Agents** | new `agents` store + `useConfigStore` (parameterised) | turns the unreachable 2,898-line console into a *reachable* one, one agent at a time |
| **Chat** | `aiService.ts`, `taskRouter`, `providerManager`, `ragContext` | makes provider/model choice visible instead of hidden behind "auto" |
| **Models** | `modelRegistry.ts` (30+ entries), `capabilities.ts`, `localModelCatalog.ts` | already built; needs the capability **matrix** view (which model does which of the 14) |
| **Activity** | new — needs a metering table | cost + guardrail visibility; reuses the invoicing module per BUILD-PLAN §6 |

### 5.3 The capability matrix is the highest-value single view

A 14-capability × 11-provider grid, each cell: ✅ implemented · ⚠️ partial · ➖ n/a, derived
**from the code** via the existing type guards (`isVisionCapable`, `isToolCallingCapable`, …),
not hand-maintained. It answers "why can't I attach an image?" in one screen. This is the single
most useful thing the 14 interfaces were built to enable and nothing currently shows.

### 5.4 Reuse, not invention

- The prototype's **9 surfaces** already draw Calls/Live/Ops/Alert/Config/Knowledge/Cost/Topology/Scenarios. Port them under the Agents tab, parameterised by agent id.
- `OpsDigest.tsx`, `States.tsx`, `useAgentResource.ts`, `transcriptSocket.ts` (all ported, all dead) get a home instead of being deleted.
- Follow the existing rules: no `tenantId` from the client, derived arrays in `useMemo`, tokens not inline styles, i18n every string, RTL logical properties only.

---

## 6. How it fits the three-layer architecture

Non-negotiable per `AGENTS.md`, and this design respects all of it:

```
React (Agents/Activity UI)
   │ invokeCommand
TS service layer  ← the Agent record lives here: scope checks, task routing
   │ invokeCommand
Rust + SQLite     ← agents table; agent-core stays the voice channel owner
```

- **One `agents` table**, Rust-owned, additive migration. Existing command signatures unchanged.
- **Scope enforcement in the service layer**, one function, tested — not scattered across UI.
- **`agent-core` is unchanged.** It is the voice channel implementation of Agent #1. The desktop
  does not call into it for non-voice agents; both agree on the Agent shape and the router contract.
- **No provider SDK in `src/`** — keys stay where they are (BYO-key in Settings, or agent-core).

---

## 7. Sequencing

Ordered so each step is verifiable and nothing is rework.

| Step | Work | Gate |
| --- | --- | --- |
| **S0** | Decide §9. Nothing else starts. | decisions |
| **S1** | `Agent` type + `agents` table + migration + CRUD commands. Seed Agent #1 (Receptionist) from today's `useConfigStore` defaults. | `cargo check`; a test proves the seed round-trips |
| **S2** | Scope enforcement — one function, called at tool/knowledge use, denial is an event. | unit tests: granted passes, denied is *logged*, never silently downgraded |
| **S3** | Unify the two routers — desktop `taskRouter` becomes the one policy source; `ProviderTier` maps onto it. | a test proves a route resolves identically for both stacks |
| **S4** | **Agents** surface — list + per-agent config. Ports the dead console. | `tsc` · one Playwright pass · the 4 invariants |
| **S5** | **Activity** surface + metering table (reuse invoicing per BUILD-PLAN §6). | a real AI call appears in the list with cost |
| **S6** | **Chat** upgrade + the **capability matrix**. | matrix derived from code, not a literal |
| **S7** | Seed agents #2–#5. | each answers once, in the UI |

S1–S3 are the architecture; S4–S6 are the UI the user asked for. **S1 is small** — one table, one
type, one seed — and everything else depends on it.

---

## 8. What this does *not* do

- **Does not build outbound calls or WhatsApp templates** — different consent and spam regime (BUILD-PLAN §9).
- **Does not add prompt editing to the voice console** — the assistant's "never" column.
- **Does not make a second billing path** — invoicing exists.
- **Does not add a third model-download path** — generalise the existing one.
- **Does not ship Arabic/Darija voice** — the `ar` UI locale is not a promise of Arabic speech.
- **Does not delete the 2,898 dead lines yet** — S4 gives them a home; delete only what S4 does not use.

---

## 9. Decisions needed

These gate S1. Everything else can proceed without them.

1. **Is `Agent` the right unifying noun?** (vs. "Assistant", "Bot", "Worker") — it collides
   slightly with the P3 *"The Agent"* persona, which is the AI itself. Keep `Agent` for the
   record and `Persona` for the human-role vocabulary? *(Recommend: yes — `Agent` = the thing,
   `persona` = a field on it.)*
2. **Do desktop agents and the voice receptionist share one `agents` table**, or does the voice
   agent stay config-in-`agent-core` with a read-only mirror in the desktop? *(Recommend: one
   table, Rust-owned; `agent-core` reads it.)*
3. **Scope enforcement — service layer or Rust?** *(Recommend: service layer — it is where the
   routing already lives, and Rust has no business knowing about knowledge tiers.)*
4. **Does Activity store per-call rows in SQLite from day one**, or aggregate? *(Recommend: rows
   — the invoicing module already expects line items, and aggregation is a view.)*
5. **Kill the prototype, or keep it as the click-test ground?** BUILD-PLAN calls it the visual
   source of truth; it is also ~5,000 lines of duplicate UI. *(Recommend: keep until S4 ports its
   last surface, then freeze — not delete.)*

---

## 10. The one-sentence version

**Give the AI a roster: make `Agent` a first-class record that composes the five things we
already built separately — then build the console that finally shows the 7,193-line AI service
instead of one search box.**
