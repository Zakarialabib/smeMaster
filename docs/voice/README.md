# Voice & Messaging Agent — Documentation Set

> **Status (audited 2026-09-30):** Gate 0 complete · **Phases A–B closed, Phase C in progress** —
> `agent-core` built, endpoints live, migrations 0001–0004 (living status:
> [`dev/BUILD-LOG.md`](dev/BUILD-LOG.md)). RAG fork **signed** 2026-09-28 — **Option A**.
> 4 client decisions + the agent knowledge-scope guardrail are still client-owned (2026-09-28) —
> **they block the pilot, not the build** ([`dev/BUILD-PLAN.md`](dev/BUILD-PLAN.md) §10).
> **Spec:** [`docs/specs/2026-09-28-voice-agent.md`](../specs/2026-09-28-voice-agent.md)
> **Decisions:** [`ADR-001`](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) ·
> **Glossary:** [`glossary-voice-agent.md`](../glossary/glossary-voice-agent.md) ·
> **OSS landscape:** [`docs/06-ROADMAP/15-voice-agent-oss-landscape.md`](../06-ROADMAP/15-voice-agent-oss-landscape.md) ·
> **WhatsApp channel landscape:** [`docs/06-ROADMAP/16-voice-agent-whatsapp-oss-landscape.md`](../06-ROADMAP/16-voice-agent-whatsapp-oss-landscape.md) ·
> **Topology decision:** [`docs/06-ROADMAP/17-voice-agent-topology-decision.md`](../06-ROADMAP/17-voice-agent-topology-decision.md)

An inbound AI receptionist for a French-speaking SME. Two channels, one agent: WhatsApp
(text) + inbound voice on a dedicated FR number. Delivered as a **managed service** run by
us — not as a desktop feature.

**The one hard constraint:** WhatsApp exposes live voice calls through **no** API. Voice runs
on a dedicated PSTN/SIP number. If the client expects in-WhatsApp voice, that is a different
conversation, not a different implementation.

---

## How this folder is organised

Three buckets, by **audience**, not by topic. If you cannot tell which bucket a new document
belongs in, ask: _who reads it, and does it leave the building?_

| Folder               | Audience                                | Rule                                                                                                     |
| -------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [`client/`](client/) | the client, and vendors we procure from | **Outbound.** Send-as-is documents. Nothing internal-only, no credentials, no infrastructure identifiers |
| [`dev/`](dev/)       | us — engineering + ops                  | **Internal.** Specs, call flows, retrieval decisions, performance, self-hosting                          |
| [`design/`](design/) | us — product + frontend + backend       | **Internal.** UX, frontend architecture, backend architecture, wireframes, HTML mockups                  |

### Start here

| If you are…                              | Read                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Phase A closed**                       | [`dev/PHASE-A-COMPLETE.md`](dev/PHASE-A-COMPLETE.md)                                                             |
| **Phase B (seams)**                      | [`dev/PHASE-B-COMPLETE.md`](dev/PHASE-B-COMPLETE.md) — CLOSED, gates measured, 3 defects caught                  |
| **Open-weight speech, licence-verified** | [`dev/OPEN-WEIGHT-SPEECH-VERIFIED.md`](dev/OPEN-WEIGHT-SPEECH-VERIFIED.md)                                       |
| **Running agent-core (dev mode)**        | [`dev/RUNNING-DEV.md`](dev/RUNNING-DEV.md)                                                                       |
| **⚠️ Build status & known issues**       | [`dev/BUILD-LOG.md`](dev/BUILD-LOG.md) — read FIRST; toolchain warning inside                                    |
| **implementing**                         | [`dev/BUILD-PLAN.md`](dev/BUILD-PLAN.md) — phases, skeletons, verification, delegation brief                     |
| **picking up where we stopped**          | [`dev/BUILD-LOG.md`](dev/BUILD-LOG.md) — living record of verified vs not-yet; read before writing code          |
| **porting the screens**                  | [`dev/PROTOTYPE-HANDOVER.md`](dev/PROTOTYPE-HANDOVER.md) — file-by-file map from the running prototype to `src/` |
| **reviewing**                            | [`design/WIREFRAMES.md`](design/WIREFRAMES.md) §13 gaps, §14 opportunities                                       |
| **answering a client question**          | [`client/`](client/) — but strip the internal footers first                                                      |

**The prototype is the visual source of truth.** `prototype/voice-console/` is a running React app
(~5,000 lines of TS/TSX, measured 2026-09-30 — it grew past the original 2,040) that implements
every surface. Where it and a doc disagree, the prototype is newer
and wins — it was written after the docs.

**Phase status, 2026-09-30.** Phase A closed. Phase B complete: the four provider seams, the
executed swap test, `/session` + `/ws/transcript` + `/ops/snapshot`, the licence gate, migrations
0002-0004, and live-server drift checks. **The `RAG-FORK` decision is signed — Option A
(2026-09-28)** — it is no longer an open item. Still open before Gate 1 sign-off: one real
provider per seam, real auth, and **persistence** (no Postgres yet — 5 migration tests skip).
Run it with [`dev/RUNNING-DEV.md`](dev/RUNNING-DEV.md).

**Never put an internal note in `client/`.** Two documents carry an internal footer today
(`client/VENDOR-QUOTE-REQUEST.md` — the "Internal: what we do with the answers" table — and
`client/Personas, Scopes & Innovations.md` §8 — the internal verify checklist at its tail).
Both sections must be stripped before the document is sent.

---

## `client/` — outbound documents

| Doc                                                                                   | What it is                                              | Status                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`CLIENT-QUESTIONNAIRE.md`](client/CLIENT-QUESTIONNAIRE.md)                           | FR email — the 4 blocking questions + 6 unblocking ones | **SEND-AS-IS** (French copy repaired 2026-09-28)                       |
| [`COST-MODEL.md`](client/COST-MODEL.md)                                               | Volume table, fixed vs variable, the 3 pricing shapes   | DRAFT — every vendor rate **UNVERIFIED**; §6 checklist gates signature |
| [`PILOT-CRITERIA.md`](client/PILOT-CRITERIA.md)                                       | The go/no-go bars, defined before anything is built     | PROPOSED — signed at Gate 0                                            |
| [`VENDOR-QUOTE-REQUEST.md`](client/VENDOR-QUOTE-REQUEST.md)                           | BSP + carrier RFQ → 4 vendors                           | **SEND-AS-IS** — strip the internal footer first                       |
| [`Personas, Scopes & Innovations.md`](client/Personas,%20Scopes%20&%20Innovations.md) | Personas, scopes, innovation backlog                    | **SEND-AS-IS** — strip the §8 internal verify checklist first          |
| [`VOICE-AGENT-DECK.pptx`](client/VOICE-AGENT-DECK.pptx)                               | 12-slide FR client deck                                 | Built by `scripts/build_voice_deck.py`                                 |

**What the client is being asked to decide, and why each one blocks work:**

1. **Vertical + the one killer outcome** — the agent is optimised for one call type.
2. **Cost model sign-off** — a volume table, not a number. Signing one figure is how a pilot becomes a loss.
3. **Two-channel split, in writing** — voice is a dedicated number, not WhatsApp.
4. **Consent model** — recommendation: no audio recorded, announce-first disclosure.
5. **Agent knowledge scope** — what content is allowed to reach our server.

---

## `dev/` — internal engineering and ops

| Doc                                                                    | What it covers                                                                                                                                                   | Status                                                  |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`BUILD-LOG.md`](dev/BUILD-LOG.md)                                     | Living record of what is verified, what broke, what is not done. **Read first when picking work up**                                                             | 🔄 living                                               |
| [`BUILD-PLAN.md`](dev/BUILD-PLAN.md)                                   | Phases, skeletons-first sequence, verification, delegation brief                                                                                                 | 🔄 Phase B+ (§12 status rows lag BUILD-LOG)             |
| [`PHASE-A-COMPLETE.md`](dev/PHASE-A-COMPLETE.md)                       | Phase A record — four steps that compile and do nothing, gates pasted                                                                                            | ✅ closed 2026-09-28                                    |
| [`PHASE-B-COMPLETE.md`](dev/PHASE-B-COMPLETE.md)                       | Phase B record — gates as measured, 3 defects caught, "still open" list                                                                                          | ✅ closed 2026-09-28                                    |
| [`PHASE-B-SEAMS.md`](dev/PHASE-B-SEAMS.md)                             | The provider-seams plan (undated; its gate counts superseded by PHASE-B-COMPLETE)                                                                                | 📎 superseded record                                    |
| [`RUNNING-DEV.md`](dev/RUNNING-DEV.md)                                 | Running agent-core in dev mode — every command actually executed                                                                                                 | ✅ verified 2026-09-28                                  |
| [`OPEN-WEIGHT-SPEECH-VERIFIED.md`](dev/OPEN-WEIGHT-SPEECH-VERIFIED.md) | FR/EN speech models licence-verified per row (Voxtral TTS is NC — cannot ship)                                                                                   | ✅ verified 2026-09-28                                  |
| [`CALL-FLOW.md`](dev/CALL-FLOW.md)                                     | Call states, the consent model, the transfer ladder, voicemail handling, and the three latency metrics with their per-turn stage marks                           | ⚠️ DRAFT — consent + emergency policy block Gate 4      |
| [`OPS-ASSISTANT.md`](dev/OPS-ASSISTANT.md)                             | The watcher/summariser design, the alert→action matrix, and the dev work matrix                                                                                  | 🔲 design proposal, not built                           |
| [`RAG-FORK.md`](dev/RAG-FORK.md)                                       | Desktop-local vs server-side retrieval. **DECIDED — Option A** (server pgvector + `bge-m3`)                                                                      | ✅ signed 2026-09-28                                    |
| [`PERFORMANCE.md`](dev/PERFORMANCE.md)                                 | Latency and cost optimisation. An **externally-drafted** report, adjudicated (editorial note at the top) + **Part 6: self-hosted speech**, the axis it missed    | ⚠️ adjudicated — see editorial note before citing       |
| [`SELF-HOSTING.md`](dev/SELF-HOSTING.md)                               | What self-hosting does and does not buy, and **what can actually be trained** — including the audio-retention conflict that rules out acoustic fine-tuning       | 🔲 design — Gate 5 candidate                            |
| [`PROTOTYPE-HANDOVER.md`](dev/PROTOTYPE-HANDOVER.md)                   | File-by-file port map prototype → `src/`, and the four invariants. Port map covers 5 pages; post-A+ surfaces (Live/Alert/Cost/Topology/Knowledge) not yet mapped | ⚠️ partial                                              |
| [`AGENT-PROMPTS.md`](dev/AGENT-PROMPTS.md)                             | Copy-paste handoff prompt per gate                                                                                                                               | ⚠️ Prompt B/F tasks partly executed — rebase before use |

---

## `design/` — product, frontend, backend

| Doc                                     | What it covers                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [`UX.md`](design/UX.md)                 | Personas, jobs, information architecture, surface inventory, states, notification design, accessibility                                     |
| [`FRONTEND.md`](design/FRONTEND.md)     | Where the console mounts, component tree, stores, the **speech abstraction** shared by desktop/mobile/server, i18n + RTL, performance rules |
| [`BACKEND.md`](design/BACKEND.md)       | Process topology, the four seams, `ChannelAdapter`, data model, endpoints, auth, observability, deployment                                  |
| [`WIREFRAMES.md`](design/WIREFRAMES.md) | Per-surface ASCII wireframes: layout, region→action, entry/exit, gating, gaps ⚠️, UX opportunities 💡                                       |
| [`mockups/`](design/mockups/)           | Self-contained HTML mockups built on the **real** design tokens (`src/styles/globals.css`, `src/shared/styles/ui-tokens.ts`)                |

### Mockups — open each file directly

A bare directory link is not clickable in most markdown renderers, so each file is linked
individually. All ten are self-contained (no CDN, no external font or JS), JS-free, responsive,
and use `<details>`/`<summary>` for disclosure. 06–09 are generated by
`scripts/build_voice_mockups.py` (10 is hand-built).

| #   | File                                                                            | Surface                                                                     | Degraded states rendered                                          |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | [`01-call-log.html`](design/mockups/01-call-log.html)                           | Call log (`/calls`)                                                         | —                                                                 |
| 2   | [`02-live-call.html`](design/mockups/02-live-call.html)                         | Live monitor (`/calls/live/:id`)                                            | —                                                                 |
| 3   | [`03-call-detail.html`](design/mockups/03-call-detail.html)                     | Call detail (`/calls/:id`)                                                  | —                                                                 |
| 4   | [`04-ops-digest.html`](design/mockups/04-ops-digest.html)                       | Digest + alert list (`/ops`)                                                | —                                                                 |
| 5   | [`05-alert-detail.html`](design/mockups/05-alert-detail.html)                   | Alert detail (`/ops/alerts/:id`)                                            | —                                                                 |
| 6   | [`06-agent-config.html`](design/mockups/06-agent-config.html)                   | Agent config (`/agent/config`)                                              | agent-core unreachable · capability unavailable                   |
| 7   | [`07-knowledge.html`](design/mockups/07-knowledge.html)                         | Knowledge scope (`/agent/knowledge`)                                        | nothing published · ingest incomplete                             |
| 8   | [`08-cost.html`](design/mockups/08-cost.html)                                   | Cost (`/agent/cost`)                                                        | carries the `UNVERIFIED` marker from `client/COST-MODEL.md`       |
| 9   | [`09-mobile-digest.html`](design/mockups/09-mobile-digest.html)                 | Mobile digest (390 px — **its own width is the viewport**)                  | agent-core unreachable, which must **never** render as "no calls" |
| 10  | [`10-topology-capabilities.html`](design/mockups/10-topology-capabilities.html) | Topology & capabilities — what runs where, and where the provider keys live | agent-core unreachable, and **what still works without it**       |

Mockups 01–05 pre-date the degraded-state requirement (`WIREFRAMES.md` G9) and render only the
happy path; 06–10 render the states `UX.md` §7 requires. Closing G9 fully means going back to
01–05 — tracked, not forgotten.

**A note on mockup 10's layout:** the two topology nodes are laid out with `flex: 1 1 320px`,
not a media query, so the desktop pairing does not depend on the viewport the file is rendered
at. Verified structurally (2 nodes, 1 connector, deterministic flex rule, tokens byte-identical
to 01) — **not** visually: the only headless renderer available on this host
(LibreOffice → PDF) forces a portrait page, so the side-by-side pairing must be confirmed by
opening the file in a browser at ≥ 900 px.

> **Static mockups vs the prototype.** 01–10 are the static HTML reference; the React
> prototype supersedes them wherever they differ, because it is interactive and is the thing you
> can actually click. Keep the static files for the degraded-state inventory — that is what they
> are still good for.

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

| Gate  | Work                                                      | Effort | State                                                                        |
| ----- | --------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| **0** | Spec + client packet                                      | 1–2d   | ✅ complete (4 client answers outstanding)                                   |
| **1** | `agent-core` skeleton + 4 provider seams + retrieval eval | 3–4d   | 🟡 skeleton + seams ✅ (swap test 15/15); retrieval eval 🔲 — not signed off |
| **2** | WhatsApp channel, Baileys sandbox + E.164 allowlist       | 3–4d   | 🔲                                                                           |
| **3** | Console + Rust IPC bridge                                 | 4–5d   | 🔲                                                                           |
| **4** | Telephony, inbound FR number (**one writer**)             | 5–7d   | 🔲 longest gate                                                              |
| **5** | Metering + provider tiers                                 | 1–2d   | 🔲                                                                           |
| **6** | Bilingual voice enforcement                               | 1–2d   | 🔲                                                                           |
| **7** | Production BSP swap + ops runbooks                        | 4–5d   | 🔲 partly waiting on Meta                                                    |

Two lead times are **outside our control and longer than the build**: Meta business
verification (gates the pilot, not just Gate 7) and French number porting (ARCEP). Both should
have started already — see `dev/AGENT-PROMPTS.md` Prompt A.
