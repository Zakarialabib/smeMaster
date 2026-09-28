# Voice & Messaging Agent — Documentation Set

> **Status:** Gate 0 complete. **No code written.** Blocked on 4 client decisions and one
> client-owned guardrail (agent knowledge scope). RAG fork **signed** 2026-09-28.
> **Spec:** [`docs/specs/2026-09-28-voice-agent.md`](../specs/2026-09-28-voice-agent.md)
> **Decisions:** [`ADR-001`](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) ·
> **Glossary:** [`glossary-voice-agent.md`](../glossary/glossary-voice-agent.md) ·
> **OSS landscape:** [`docs/06-ROADMAP/10-voice-agent-oss-landscape.md`](../06-ROADMAP/10-voice-agent-oss-landscape.md)

An inbound AI receptionist for a French-speaking SME. Two channels, one agent: WhatsApp
(text) + inbound voice on a dedicated FR number. Delivered as a **managed service** run by
us — not as a desktop feature.

**The one hard constraint:** WhatsApp exposes live voice calls through **no** API. Voice runs
on a dedicated PSTN/SIP number. If the client expects in-WhatsApp voice, that is a different
conversation, not a different implementation.

---

## How this folder is organised

Three buckets, by **audience**, not by topic. If you cannot tell which bucket a new document
belongs in, ask: *who reads it, and does it leave the building?*

| Folder | Audience | Rule |
|---|---|---|
| [`client/`](client/) | the client, and vendors we procure from | **Outbound.** Send-as-is documents. Nothing internal-only, no credentials, no infrastructure identifiers |
| [`dev/`](dev/) | us — engineering + ops | **Internal.** Specs, call flows, retrieval decisions, performance, self-hosting |
| [`design/`](design/) | us — product + frontend + backend | **Internal.** UX, frontend architecture, backend architecture, wireframes, HTML mockups |

**Never put an internal note in `client/`.** Two documents carry an internal footer today
(`client/VENDOR-QUOTE-REQUEST.md` has an "Internal: what we do with the answers" table) —
that section must be stripped before the document is sent.

---

## `client/` — outbound documents

| Doc | What it is | Status |
|---|---|---|
| [`CLIENT-QUESTIONNAIRE.md`](client/CLIENT-QUESTIONNAIRE.md) | FR email — the 4 blocking questions + 6 unblocking ones | **SEND-AS-IS** (French copy repaired 2026-09-28) |
| [`COST-MODEL.md`](client/COST-MODEL.md) | Volume table, fixed vs variable, the 3 pricing shapes | DRAFT — every vendor rate **UNVERIFIED**; §6 checklist gates signature |
| [`PILOT-CRITERIA.md`](client/PILOT-CRITERIA.md) | The go/no-go bars, defined before anything is built | PROPOSED — signed at Gate 0 |
| [`VENDOR-QUOTE-REQUEST.md`](client/VENDOR-QUOTE-REQUEST.md) | BSP + carrier RFQ → 4 vendors | **SEND-AS-IS** — strip the internal footer first |
| [`VOICE-AGENT-DECK.pptx`](client/VOICE-AGENT-DECK.pptx) | 12-slide FR client deck | Built by `scripts/build_voice_deck.py` |

**What the client is being asked to decide, and why each one blocks work:**

1. **Vertical + the one killer outcome** — the agent is optimised for one call type.
2. **Cost model sign-off** — a volume table, not a number. Signing one figure is how a pilot becomes a loss.
3. **Two-channel split, in writing** — voice is a dedicated number, not WhatsApp.
4. **Consent model** — recommendation: no audio recorded, announce-first disclosure.
5. **Agent knowledge scope** — what content is allowed to reach our server.

---

## `dev/` — internal engineering and ops

| Doc | What it covers |
|---|---|
| [`CALL-FLOW.md`](dev/CALL-FLOW.md) | Call states, the consent model, the transfer ladder, voicemail handling, and the three latency metrics with their per-turn stage marks |
| [`OPS-ASSISTANT.md`](dev/OPS-ASSISTANT.md) | The watcher/summariser design, the alert→action matrix, and the dev work matrix |
| [`RAG-FORK.md`](dev/RAG-FORK.md) | Desktop-local vs server-side retrieval. **DECIDED — Option A** (server pgvector + `bge-m3`) |
| [`PERFORMANCE.md`](dev/PERFORMANCE.md) | Latency and cost optimisation. An **externally-drafted** report, adjudicated (editorial note at the top) + **Part 6: self-hosted speech**, the axis it missed |
| [`SELF-HOSTING.md`](dev/SELF-HOSTING.md) | What self-hosting does and does not buy, and **what can actually be trained** — including the audio-retention conflict that rules out acoustic fine-tuning |
| [`AGENT-PROMPTS.md`](dev/AGENT-PROMPTS.md) | Copy-paste handoff prompt per gate. Start here when you pick work up |

---

## `design/` — product, frontend, backend

| Doc | What it covers |
|---|---|
| [`UX.md`](design/UX.md) | Personas, jobs, information architecture, surface inventory, states, notification design, accessibility |
| [`FRONTEND.md`](design/FRONTEND.md) | Where the console mounts, component tree, stores, the **speech abstraction** shared by desktop/mobile/server, i18n + RTL, performance rules |
| [`BACKEND.md`](design/BACKEND.md) | Process topology, the four seams, `ChannelAdapter`, data model, endpoints, auth, observability, deployment |
| [`WIREFRAMES.md`](design/WIREFRAMES.md) | Per-surface ASCII wireframes: layout, region→action, entry/exit, gating, gaps ⚠️, UX opportunities 💡 |
| [`mockups/`](design/mockups/) | Self-contained HTML mockups built on the **real** design tokens (`src/styles/globals.css`, `src/shared/styles/ui-tokens.ts`) |

### Mockups — open each file directly

A bare directory link is not clickable in most markdown renderers, so each file is linked
individually. All nine are self-contained (no CDN, no external font or JS), JS-free, responsive,
and use `<details>`/`<summary>` for disclosure. 06–09 are generated by
`scripts/build_voice_mockups.py`.

| # | File | Surface | Degraded states rendered |
|---|---|---|---|
| 1 | [`01-call-log.html`](design/mockups/01-call-log.html) | Call log (`/calls`) | — |
| 2 | [`02-live-call.html`](design/mockups/02-live-call.html) | Live monitor (`/calls/live/:id`) | — |
| 3 | [`03-call-detail.html`](design/mockups/03-call-detail.html) | Call detail (`/calls/:id`) | — |
| 4 | [`04-ops-digest.html`](design/mockups/04-ops-digest.html) | Digest + alert list (`/ops`) | — |
| 5 | [`05-alert-detail.html`](design/mockups/05-alert-detail.html) | Alert detail (`/ops/alerts/:id`) | — |
| 6 | [`06-agent-config.html`](design/mockups/06-agent-config.html) | Agent config (`/agent/config`) | agent-core unreachable · capability unavailable |
| 7 | [`07-knowledge.html`](design/mockups/07-knowledge.html) | Knowledge scope (`/agent/knowledge`) | nothing published · ingest incomplete |
| 8 | [`08-cost.html`](design/mockups/08-cost.html) | Cost (`/agent/cost`) | carries the `UNVERIFIED` marker from `client/COST-MODEL.md` |
| 9 | [`09-mobile-digest.html`](design/mockups/09-mobile-digest.html) | Mobile digest (390 px — **its own width is the viewport**) | agent-core unreachable, which must **never** render as "no calls" |

Mockups 01–05 pre-date the degraded-state requirement (`WIREFRAMES.md` G9) and render only the
happy path; 06–09 render the states `UX.md` §7 requires. Closing G9 fully means going back to
01–05 — tracked, not forgotten.

**Mockups are design artifacts, not the implementation.** They exist to settle layout and
copy before Gate 3 builds React. They use the locked Frosted-Glass + AI-purple language, the
app's real token values, and the shared component vocabulary (`DataTable`, `Avatar`,
`AiSuggestionBanner`) — see [`FRONTEND.md`](design/FRONTEND.md) §"Porting from the RN wrapper"
for why the console reuses those rather than inventing its own.

---

## Reading order

**New engineer, picking up implementation** → this file → `dev/AGENT-PROMPTS.md` (the gate
prompt) → `design/BACKEND.md` → `dev/CALL-FLOW.md` §3 → `ADR-001`.

**Reviewer, checking the plan** → `ADR-001` → `dev/PERFORMANCE.md`'s editorial note → the
"Open" table at the end of `ADR-001` → `client/PILOT-CRITERIA.md` (are the bars measurable?).

**Client or commercial** → `client/CLIENT-QUESTIONNAIRE.md` → `client/COST-MODEL.md` §0 first
(there is no single cost number).

## Gate map

Serial where gates touch shared files. Gate 0 is the only gate that can start today.

| Gate | Work | Effort | State |
|---|---|---|---|
| **0** | Spec + client packet | 1–2d | ✅ complete (4 client answers outstanding) |
| **1** | `agent-core` skeleton + 4 provider seams + retrieval eval | 3–4d | 🔲 **engineering-unblocked** |
| **2** | WhatsApp channel, Baileys sandbox + E.164 allowlist | 3–4d | 🔲 |
| **3** | Console + Rust IPC bridge | 4–5d | 🔲 |
| **4** | Telephony, inbound FR number (**one writer**) | 5–7d | 🔲 longest gate |
| **5** | Metering + provider tiers | 1–2d | 🔲 |
| **6** | Bilingual voice enforcement | 1–2d | 🔲 |
| **7** | Production BSP swap + ops runbooks | 4–5d | 🔲 partly waiting on Meta |

Two lead times are **outside our control and longer than the build**: Meta business
verification (gates the pilot, not just Gate 7) and French number porting (ARCEP). Both should
have started already — see `dev/AGENT-PROMPTS.md` Prompt A.
