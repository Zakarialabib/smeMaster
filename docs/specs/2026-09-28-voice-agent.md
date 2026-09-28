# Spec — Voice & Messaging Agent (FR/EN) for SMEMaster

> **Status:** Gate 0 — spec written, awaiting 4 client decisions. **No code written.**
> **Written:** 2026-09-28 · **Author:** Hermes (spec-gated-delegation-loop)
> **Repo:** `C:\laragon\www\smeMaster` @ `dev`
> **Companion docs:** [`COST-MODEL.md`](../voice/client/COST-MODEL.md) ·
> [`CALL-FLOW.md`](../voice/dev/CALL-FLOW.md) · [`RAG-FORK.md`](../voice/dev/RAG-FORK.md) ·
> [`PILOT-CRITERIA.md`](../voice/client/PILOT-CRITERIA.md) ·
> [`VENDOR-QUOTE-REQUEST.md`](../voice/client/VENDOR-QUOTE-REQUEST.md) ·
> [`CLIENT-QUESTIONNAIRE.md`](../voice/client/CLIENT-QUESTIONNAIRE.md) ·
> [`OPS-ASSISTANT.md`](../voice/dev/OPS-ASSISTANT.md) (ops-assistant design + dev work matrix)

---

## 1. What this is

An inbound AI receptionist for a French-speaking SME. Two channels, one agent:

- **WhatsApp** — text conversations, agent replies
- **Voice** — inbound calls on a dedicated FR number, agent answers

**v1 scope:** talk, warm-transfer to a human, detect voicemail, and summarise a
missed call to the owner on WhatsApp. It does **not** write to CRM/calendar, does
**not** call out, and does **not** record audio.

## 2. The one hard constraint

**WhatsApp live voice calls are not buildable.** No official API exposes them, and
no unofficial library does either. WhatsApp voice *notes* can be transcribed; live
calls cannot be answered by an agent.

*Corroborated from the opposite direction (2026-09-28):* the one open-source
client that places in-app WhatsApp calls — `karem505/whatRust`, MIT — does so by
loading `web.whatsapp.com` in an OS webview, and its own limitations note that
calling only works *"where the system webview ships WebRTC"*. That is a human
clicking "call" in a GUI: not an API, not server-side, not automatable. It
confirms the constraint rather than qualifying it. See
[`docs/06-ROADMAP/11-voice-agent-whatsapp-oss-landscape.md`](../06-ROADMAP/11-voice-agent-whatsapp-oss-landscape.md).

So the voice channel is a **dedicated PSTN/SIP number**, not WhatsApp. This is
stated in the client questionnaire and must be confirmed in writing before any
engineering begins. If the client's actual expectation is AI voice *inside*
WhatsApp, that conversation is the next email, not the next line of code.

## 3. Ground truth — what SMEMaster already has

Verified against the working tree 2026-09-28 (not from docs alone).

| Existing asset | Evidence | Impact on this plan |
|---|---|---|
| **ML sidecar — real, not a stub** | `src-tauri/crates/ml-sidecar/src/main.rs` — candle + lancedb + hf-hub, JSON-RPC 2.0 over stdin/stdout | **A sidecar pattern already exists and is proven in this repo.** The agent sidecar follows its shape. |
| Sidecar architecture doc | `docs/01-ARCHITECTURE/07-sidecar-architecture.md` (+ `08-sidecar-gap-analysis.md`) | Reuse the architecture, not a new invention. |
| **AI/RAG feature** | `docs/04-FEATURES/ai-rag.md` — candle embeddings, LanceDB, assistant chat UI in `src/features/assistant/` | **Do not build a new RAG from scratch.** But see the embedding constraint below. |
| **Embedder is English-only** | `BAAI/bge-small-en-v1.5` hard-coded in 6 files (see `RAG-FORK.md`) | **Blocking for FR.** A French query against `bge-small-en` retrieves nothing. Requires a multilingual embedder. |
| **Provider abstraction already exists** | `src/shared/services/ai/providerFactory.ts`, `providerManager.ts`; providers include Claude, OpenAI, Gemini, Ollama, Copilot, custom OpenAI-compatible | **The LLM provider seam already exists.** Map to it; do not build a parallel one. |
| **Tool registry** | Subsystem Orchestration — lifecycle, state machine, tool registry, gating (master plan Phase 0) | Map agent tools onto the existing registry. |
| **Invoicing** | `docs/04-FEATURES/36-invoicing.md` (Morocco DGI-compliant) | **Reuse for billing.** Do not build a second billing system. |
| **Deliverability monitoring** | `21-deliverability.md`; `src-tauri/src/deliverability/` — blacklist, reputation, alerts, bulk health | Reuse for **number** reputation alerting on the voice side. |
| **i18n: en, fr, ar, ja, it** (ar RTL) | `32-i18n-localization.md` | **FR UI already ships.** Gate 6 is about *voice* config, not strings. Note: UI locale ≠ embedding locale ≠ voice locale. |
| **Orchestrator** | `src-tauri/src/orchestrator/` — `init.rs`, `services.rs`, `subsystem_lifecycle.rs` | Match this shape for the agent's lifecycle. |
| Test harnesses | 2,470+ TS / 900+ Rust tests; vitest + playwright; `cmd /c "node node_modules/vitest/vitest.mjs ..."` | Gate verification uses existing harnesses. |
| Docs conventions | `docs/00-INDEX.md` index + `docs/06-ROADMAP/09-master-plan.md` canonical roadmap (phases, legend) | This spec and companions are registered in both. |

**Net effect:** v1 of a greenfield plan would have been ~30–35 days. Reuse-before-build
brings the new work down to roughly **the voice path**, with metering and billing
reduced to configuration on existing modules.

### 3.1 Invariants (non-negotiable, all gates)

1. **Reuse before build.** Any capability that exists in the repo is an **adapter**,
   never a parallel implementation. Check `docs/00-INDEX.md` before adding.
2. **The console never imports a provider SDK.** Only the agent service does.
3. **The agent never knows its channel.** Everything arrives through `ChannelAdapter`.
4. **Rust owns Tauri commands, persistence, tenancy.** Python owns realtime audio
   and the LLM turn loop. No overlap, no Rust reimplementation of the agent loop.
5. **Port patterns, not code.** Study LiveKit Agents / Pipecat for shape; implement
   our own types. No vendored field names or transport.
6. No backwards-compat shims, no "interim" state — deprecate fully or do not start.
7. New Tauri commands are **additive**; existing signatures never change.
8. No new files under `src/core` or `src/hooks` (existing convention).
9. No secrets in the repo. `.env.example` gets keys, never values.

## 4. Architecture

```
SMEMaster Tauri (Rust core + React 19 console)        OUR EU VPS
┌──────────────────────────────────────┐            ┌────────────────────────────────────┐
│ Agent Console (React, phone-ready)  │  HTTPS+WS  │ agent-core (Python, FastAPI)       │
│  live transcript · call log ·        │ ──────────▶│  LiveKit Agents (Apache-2.0)       │
│  agent config · cost meters         │            │  LLM → OpenRouter (Gemini 3.x)     │
│                                      │            │  TTS → ElevenLabs (FR/EN)         │
│ Reuses existing:                     │            │  STT → Deepgram streaming (live)   │
│  ✅ provider abstraction              │            │       ElevenLabs Scribe (voicemail)│
│  ✅ tool registry                     │            │  ChannelAdapter:                   │
│  ✅ invoicing (billing)               │            │   ├ telephony → Telnyx             │
│  ✅ deliverability (number health)    │            │   └ whatsapp  → BSP / sandbox     │
│  ✅ i18n fr · Zustand stores          │            │  RAG → pgvector + bge-m3 (decision)│
│  ✅ orchestrator lifecycle            │            │  Metering → existing billing       │
└──────────────────────────────────────┘            └────────────────────────────────────┘
```

### 4.1 Why a sidecar, and where it lives

The agent is a **24/7 server workload**. Inside the desktop process it would only
run while a window is open — fatal for a phone that rings when nobody is looking.
So the agent runs on the VPS; the desktop is a console that talks to it.

**This is not a new idea in this repo** — `ml-sidecar` already proves the
sidecar pattern here, with a watchdog and health checks. The agent sidecar differs
in transport (HTTP/WS, not stdin/stdout JSON-RPC) because it is a network service
and must serve both the desktop console and a phone browser.

Placement: `services/agent-core/` at the repo root, **outside** `src-tauri`, so the
Python runtime never enters the Tauri bundle or the Cargo build.

### 4.2 The provider seams

Four seams, implemented before anything else (the 4th, `EmbeddingProvider`, was added
2026-09-28 — see [`ADR-001`](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) D3).
Every one of them is a per-tenant config change, never a refactor:

| Seam | v1 default | Behind the seam | Why |
|---|---|---|---|
| `LLMProvider` | `google/gemini-3.x-flash` via OpenRouter | Groq Llama (lower TTFT), `gpt-4o-mini` fallback | Existing `providerFactory` is the model for this. |
| `TTSProvider` | ElevenLabs (FR + EN) | Kokoro-82M (budget), Azure Neural (margin rescue) | **Edge TTS is excluded from every client tier** — unofficial endpoint, gray ToS. |
| `STTProvider` | Deepgram Nova streaming (live) / ElevenLabs Scribe (batch, voicemail) | local faster-whisper (budget) | Scribe Realtime FR availability **unverified** — check before relying on it. |
| `EmbeddingProvider` | self-hosted `bge-m3` (MIT) | `arctic-embed-l-v2.0` (Apache-2.0, same arch → config swap) | **4th seam, added 2026-09-28.** The embedder is exactly as swappable as the other three; leaving it out made the trait rule inconsistent. Config = model id, dims, prefix/instruction, normalize, distance. See [`RAG-FORK.md`](../voice/dev/RAG-FORK.md). |

`ChannelAdapter`: `inbound_events()` async iterator + `send_text()`.
Telephony and WhatsApp implement it; the agent core never branches on channel.

**Why OpenRouter is the brain and not the voice:** verified 2026-09-28 against
`https://openrouter.ai/api/v1/models` — 458 models, ~41 accept audio *input*,
only **4 produce audio output**. Latency is dominated by STT/TTS streaming and turn
detection, not by which LLM answers. (Re-verify at Gate 1; these numbers drift.)

**Framework:** LiveKit Agents (Apache-2.0, 14.4k★, pushed 2026-09-28) primary;
Pipecat (BSD-2, 15.9k★, pushed 2026-09-28) fallback. Same architectural pattern, so
a swap is a port change. **Vocode is rejected** — abandoned, not missing: the repo
resolves (`vocodedev/vocode-core`, MIT, 3.8k★) but its last push is **2024-11-15**
(~22 months stale). See [`docs/06-ROADMAP/10-voice-agent-oss-landscape.md`](../06-ROADMAP/10-voice-agent-oss-landscape.md) §5.1.

## 5. Gates

Serial where gates touch shared files. G0 is the only gate that can start now.

### GATE 0 — Spec + client packet (1–2 days, no code) ✅ *this pass*
**Owns:** `docs/specs/2026-09-28-voice-agent.md`, `docs/voice/**`
**Delivered:** this spec; `COST-MODEL.md`; `CALL-FLOW.md`; `RAG-FORK.md`;
`PILOT-CRITERIA.md`; `VENDOR-QUOTE-REQUEST.md`; `CLIENT-QUESTIONNAIRE.md`.
**Remaining:** client answers (4 blockers), dated price verification, RAG fork decision.
Index + roadmap registration is **done** (`docs/00-INDEX.md`, master plan `10.1` ✅).
**Verify:** every `docs/voice/**` link resolves from this file; every price in
`COST-MODEL.md` carries an `UNVERIFIED` marker; `RAG-FORK.md` has an empty
`Decided by` field — that is the correct state today.

### GATE 1 — `agent-core` skeleton + four provider traits (3–4 days)
**Owns:** `services/agent-core/**` only. **Fence:** nothing under `src/` or `src-tauri/`.
`pyproject.toml`: `livekit-agents`, `fastapi`, `uvicorn`, `httpx`, `asyncpg`,
`pytest`, `pytest-asyncio`. `providers/base.py` with the four ABCs (async
streaming). Impls: `openrouter.py`, `elevenlabs.py`, `deepgram.py`, `scribe.py`,
`local_embed.py`.
`orchestrator.py` stub. API: `GET /healthz`, `POST /session`, `WS /ws/transcript`.
Re-verify the OpenRouter figures on day 1; re-verify the embedder table in
`RAG-FORK.md`.
**Add `EmbeddingProvider` + `tests/rag/retrieval_eval.py`** — 25–50 FR/EN questions
→ expected chunk, pytest gate at **hit@3 ≥ 0.9**. This settles bge-m3 vs
arctic-l-v2.0 empirically in an afternoon instead of by leaderboard.
**Verify:** `cd services/agent-core && python -m pytest -q` — **assert the summary
line, not the exit code.** Plus a test proving a second implementation swaps in by
config alone.

### GATE 2 — WhatsApp channel, sandbox via Baileys (3–4 days)
**Owns:** `channels/whatsapp.py`, `channels/bsp.py` (stub), `tests/`.
Baileys (`WhiskeySockets/Baileys`, MIT, 11.2k★, active) as the **dev sandbox**;
`bsp.py` stub with the identical signature raising `NotConfigured`. This is the
whole point: the dev path and the production path are the same code with a
different config value.
**Security rule (non-negotiable):** `normalize_e164()` runs **before** the sandbox
allowlist check, and the allowlist contains only numbers **we own**. Baileys JIDs,
`+33`, `0033`, and `0`-prefix forms are the same number; a check that does not
normalize is bypassable by formatting — which is precisely the failure the rule
exists to prevent.
**Verify:** tests asserting `+33612345678`, `0033612345678`, `33612345678`, and
`33612345678@c.us` all resolve to one entry, and a non-sandbox number is rejected
in every format. Then a live sandbox round-trip visible in the transcript.
**Production rule:** a traffic run under production config must show **zero**
Baileys connections.

### GATE 3 — Console + Rust IPC bridge (4–5 days)
**Owns:** `src/features/agent/` (mirroring the existing `src/features/assistant/`
convention), `src-tauri/src/commands/agent.rs`, `Cargo.toml`, router, `lib.rs`.
`models.rs` serde ↔ agent-core pydantic; `client.rs` (reqwest, one base URL from
config). Additive commands: `agent_start_session`, `agent_end_session`,
`agent_list_calls`, `agent_get_transcript`, `agent_set_provider_tier` — **added to
`generate_handler![]`, never reordering existing entries.** React console reusing
existing Zustand stores.
**Verify:** `cd src-tauri && cargo check --workspace` clean (**workspace**, not
`-p <crate>`); `cmd /c "node node_modules/typescript/bin/tsc --noEmit"` clean;
`cmd /c "node node_modules/vitest/vitest.mjs run src/features/agent --no-file-parallelism"`
— **gate on the `Tests` summary line, not `$?`; vitest false-greens on this host.**
Run `git status --short` first — do not touch another agent's uncommitted files.

### GATE 4 — Telephony, inbound FR number (5–7 days) ← longest gate
**Owns:** `channels/telephony.py`, `orchestrator.py`, `CALL-FLOW.md`.
Telnyx media-stream inbound (μ-law 8k ↔ 16k resample), LiveKit turn detection wired
into the orchestrator, warm transfer ladder, voicemail detection, and the
voicemail → STT → summary → **WhatsApp to owner** path (a service conversation, €0
on Meta's side — the highest perceived value per line of code in v1).
Latency instrumentation emitting the three named metrics and four stage marks
defined in `CALL-FLOW.md` §3.
**Fence:** Gate 2/3 files frozen once merged. **Strictly one writer** — telephony,
orchestrator, and consent all collide here. Slack in this gate is the most likely
cause of a slipped date.
**Verify:** a real inbound FR call, with the four latency numbers pasted and
`answer_latency` p95 < 2s, `turn_gap` p50 < 1.0s.

### GATE 5 — Metering + provider tiers (1–2 days)
**Owns:** `metering.py`, one SQLite migration, cost view.
Per-minute and per-message events tagged by tenant + tier, following the existing
migration convention. **Billing reuses the existing invoicing module** — no second
billing system. `ProviderTier` → a fallback chain across the three traits
(budget / standard / premium). **Number-reputation alerting reuses deliverability
monitoring.**
**Verify:** a synthetic 10-minute call produces 10 metered minutes at the correct
provider costs, and the console total matches the DB row exactly.

### GATE 6 — Bilingual voice enforcement (1–2 days)
**Owns:** `services/agent-core/agent_core/i18n/`, `docs/voice/LANGUAGE-MATRIX.md`.
FR **UI** already ships — this gate is *voice* config only: per-locale voice +
prompt, language detect on the first utterance pinned for the session, mid-call
FR↔EN switch, and cross-lingual retrieval (a French query retrieving English
documents) via the multilingual embedder chosen in `RAG-FORK.md`.
**Explicitly out:** Darija/Arabic. See `CALL-FLOW.md` §7 for why the repo's `ar`
UI locale does not imply Arabic *voice*.
**Verify:** a recorded FR call, an EN call, and a mid-call FR→EN switch, transcripts
showing correct pinning.

### GATE 7 — Production BSP swap + ops (4–5 days, partly waiting on Meta)
**Owns:** `channels/bsp.py` (replaces the stub), runbooks.
Real BSP behind the **identical** `ChannelAdapter` signature. 24-hour-window and
template enforcement. Runbooks: provider outage, number reputation, agent
degradation, transfer failure. 24/7 monitoring and alerting (the accepted
operational commitment).
**Verify:** Gate 2's suite passes **unchanged** against the BSP implementation, and
a sandbox traffic run shows zero Baileys connections under production config.

## 6. Blocking decisions — nothing past Gate 0 starts without these

| # | Decision | Owner | Status |
|---|---|---|---|
| 1 | Vertical + the one killer outcome | client | ☐ |
| 2 | Cost model signed (volume table, not a number) | client | ☐ |
| 3 | Two-channel split confirmed in writing | client | ☐ |
| 4 | Recording consent model (recommendation: no audio, announce-first) | client | ☐ |
| 5 | RAG fork (recommendation: server-side pgvector + `bge-m3`) | us | ☐ |
| 6 | BSP + carrier quotes back | vendors | ☐ |
| 7 | Regulatory dates verified with counsel (AI Act Art. 50; French 2025 law) | counsel | ☐ |

Items 5–7 are ours or the vendors'; **1–4 are the client's and gate everything.**

## 7. Out of scope for v1

Cold outbound calls · outbound WhatsApp templates · CRM/calendar writes · native
mobile app (Android already ships) · languages beyond FR/EN · self-hosted deployment
for the client · audio recording · Edge TTS in any client-facing tier · Darija/Arabic
voice · supervisor barge-in on a live call.

## 8. Honest risks

- **The local embedder is English-only *and its dimension is not fixed*** —
  `bge-small-en-v1.5` (6 call sites) is the `rust_bge` source; the assistant can also
  run on the active provider's embedding endpoint, which returns whatever the operator
  pointed it at. Any French retrieval silently fails under `rust_bge`, and any code
  assuming a fixed 384 dims is wrong under `provider`. Easy to ship and easy to miss,
  because an English test passes. See `ADR-001` D2.
- **The cost model's centre of gravity is the TTS tier**, which is volume-dependent.
  Signing one number is how a pilot becomes a 4× loss.
- **Fixed costs dominate below ~2,000 min/month**, so flat-fee pricing is
  arithmetic, not preference.
- **Meta onboarding is the schedule risk** and sits outside our control. Start
  Gate 7's approval work in parallel with Gate 1, not after it.
- **Telephony (Gate 4) is one writer for 5–7 days** with everything colliding there.
- **The regulatory items are unverified** and the client is FR-facing. This is the
  one risk on this list that cannot be fixed by engineering.
