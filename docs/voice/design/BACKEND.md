# Backend — Voice & Messaging Agent

> **Status:** Gate 0 design. Target: spec Gates 1–5, 7.
> **Decisions:** [`ADR-001`](../../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) —
> **read it first**; this document elaborates it and does not overrule it.
> **Companions:** [`FRONTEND.md`](FRONTEND.md) · [`../dev/CALL-FLOW.md`](../dev/CALL-FLOW.md) ·
> [`../dev/RAG-FORK.md`](../dev/RAG-FORK.md) · [`../dev/SELF-HOSTING.md`](../dev/SELF-HOSTING.md)
>
> **Re-baselined 2026-10-03 —** Phase C+D are one merged batch: config endpoints +
> config tables first → remaining endpoints → **real channels** (Baileys · Twilio ·
> official WA API, trial/free tiers) → full CALL-FLOW consent. **Two databases** (not a
> single server-side Postgres), **FreeSWITCH** for telephony (not Asterisk, not the
> panel box), **credentials in `.env` on the server**, **auth deferred to Gate 1**.
> Canonical record: [`../dev/DECISIONS-2026-10-03.md`](../dev/DECISIONS-2026-10-03.md) —
> where an older line here contradicts it, that file wins.

## 1. Boundaries (restated as build rules, not principles)

The repo's three-layer rule (AGENTS.md) meets the spec's invariants here. These are the rules
a reviewer should enforce on the diff:

1. **Rust owns Tauri commands, persistence and tenancy. Python owns realtime audio and the LLM
   turn loop.** No overlap. There is no Rust reimplementation of the turn loop, and no Python
   code that opens the app database.
2. **`agent-core` is a network sidecar on our VPS.** Not a Cargo workspace member, not launched
   by Tauri, no stdio JSON-RPC. (`ADR-001` D1.)
3. **The console never imports a provider SDK.** Only the service does.
4. **The agent never knows its channel.** Everything arrives through `ChannelAdapter`.
5. **New Tauri commands are additive.** Existing signatures never change.
6. **No secrets in the repo.** `.env.example` gets keys, never values. Runtime secrets
   (Baileys session credentials, Twilio SID/token, Meta app token) live in **`.env` on the
   server** — never in config endpoints, never in Settings, never committed.
7. **No backwards-compat shims, no "interim" state.**
8. **Auth ships last, on loopback first.** New endpoints are accepted open on loopback
   until Gate 1 closes the token hole (§6) — nothing leaves loopback before that.

> Updated 2026-10-03 (see `dev/DECISIONS-2026-10-03.md` §3.5, §3.9) — rules 6 and 8
> are the two additions from the re-baseline.

## 2. Process topology

```
                    ┌──────────────── OUR OWN EU VPS (not the SaaS box — see §12) ─────────────────┐
                    │                                                                              │
  PSTN caller ──────┼──▶ Twilio ──(media stream, μ-law 8k, WSS)──▶ ┌───────────────────────────┐  │
  (dedicated FR #)  │                                              │  agent-core (FastAPI)     │  │
                    │                                              │  ┌─────────────────────┐  │  │
  WhatsApp ─────────┼──▶ Baileys / official WA (test)   ──WSS────▶ │  │ ChannelAdapter      │  │  │
  caller            │                                              │  │  ├ telephony        │  │  │
                    │                                              │  │  └ whatsapp         │  │  │
  SMEMaster desktop │                                              │  └──────────┬──────────┘  │  │
  console ──────────┼──▶ HTTPS + WSS (bearer) ──────────────────▶  │             ▼             │  │
  (Tauri + React)   │                                              │  orchestrator (turn loop) │  │
                    │                                              │   ├ LLMProvider  ─────────┼──┼──▶ OpenRouter
                    │                                              │   ├ TTSProvider  ─────────┼──┼──▶ ElevenLabs
                    │                                              │   ├ STTProvider  ─────────┼──┼──▶ Deepgram
                    │                                              │   └ EmbeddingProvider ────┼──┼─┐
                    │                                              │  SQLite dev → PG+pgvector │  │ │
                    │                                              │  (metering, calls, KB)    │  │ │
                    │                                              └───────────────────────────┘  │ │
                    └───────────────────────────────────────────────────────────────────────────┘  │
                                                                                                     │
   self-hosted tier (optional, Gate 5): localhost WSS ──▶ sherpa-onnx (C++, CPU) ◀── the embedder lives here too
```

> **Updated 2026-10-03 (see `dev/DECISIONS-2026-10-03.md` §2, §3.3, §3.6, §3.7).**
>
> - **Two databases, deliberately:** the desktop keeps its own Rust migrations (console
>   data); **agent-core owns its own up/down SQL** applied at startup — SQLite for dev,
>   schema written PG-shaped so the Gate 1 Postgres swap is driver + runner. Config
>   tables first; calls/turns/metering/knowledge land with their endpoints.
> - **Three real channels**, all on trial/free tiers: **Baileys** (free, unofficial —
>   dedicated test number only), **Twilio** (voice, trial), **official WhatsApp Business
>   API** (Meta test app). Selection lives in config; capability flags show what is
>   actually configured. Zero spend this batch.
> - **FreeSWITCH** is the telephony engine — not Asterisk, and not the Contabo panel box.
>   Native on this Windows host for dev; a **new dedicated VPS with Docker** for prod.
>   Acceptance = **FreeSWITCH loopback** (two FS endpoints calling each other): no
>   softphone, no paid numbers.
> - The carrier/channel labels above are the ingress leg; the process model (agent-core
>   as a network sidecar, not in the desktop) is unchanged from `ADR-001` D1.

**Why the agent is not in the desktop process:** it is a 24/7 workload. A phone that rings only
while a window is open is not a product. (`ml-sidecar` proves the *lifecycle contract* in this
repo — watchdog, health, JSON-RPC — but not the process model; `ADR-001` D1.)

## 3. The four provider seams

Implemented in `providers/base.py` as async-streaming ABCs, **before anything else**. All four
are per-tenant config, never code.

| Seam | v1 default | Behind the seam | Config fields |
|---|---|---|---|
| `LLMProvider` | `google/gemini-3.x-flash` via OpenRouter | Groq Llama (lower TTFT), `gpt-4o-mini` | model id, base url, max tokens, temperature, context budget |
| `TTSProvider` | ElevenLabs (FR + EN) | Azure Neural (margin rescue), sherpa-onnx Piper (self-hosted tier) | voice id per locale, format, sample rate |
| `STTProvider` | Deepgram Nova streaming (live) / ElevenLabs Scribe (batch, voicemail) | sherpa-onnx streaming zipformer (self-hosted tier) | model, language, encoding, endpointing |
| `EmbeddingProvider` | self-hosted `bge-m3` (MIT) | `arctic-embed-l-v2.0` (Apache-2.0) | model id, **dims**, prefix/instruction, normalize, distance metric |

**The swap test is the Gate 1 exit criterion:** a second implementation of each seam swaps in by
a **config value alone**, with no code change.

⚠️ **Record the dimension in the config, not in code** (`ADR-001` D2). The desktop's index
dimension is config-dependent (`rust_bge` = 384 vs `provider` = N), and the server space is
1024. A hard-coded 384 anywhere in the ingestion path is a latent runtime failure.

## 4. `ChannelAdapter`

One interface, two implementations, zero branching in the agent:

```python
class ChannelAdapter(Protocol):
    def inbound_events(self) -> AsyncIterator[InboundEvent]: ...
    async def send_text(self, text: str) -> None: ...
    async def transfer(self, target: str) -> TransferResult: ...
```

| Implementation | Transport | Notes |
|---|---|---|
| `telephony.py` | FreeSWITCH (SIP/media) with Twilio trial ingress — μ-law 8 kHz ↔ 16 kHz resample | **One writer during Gate 4.** Turn detection, transfer ladder, voicemail detection |
| `whatsapp.py` | Baileys, MIT — **real, free**, unofficial → **dedicated test WhatsApp number only** (never a client's or our main number) | `normalize_e164()` runs **before** the allowlist check |
| `wa_official.py` | official WhatsApp Business API — **real**, Meta test app | Same signature. Test-mode caps apply (24 h tokens) |

Channel ↔ adapter map: **voice = Twilio (trial) into FreeSWITCH**, **WhatsApp = Baileys *or*
official API**, selected in config — one adapter interface, no branching in the agent.
Twilio's trial cap (no inbound from unverified numbers) and Meta's 24 h test tokens are
accepted limits for this batch.

**Channel selection lives in config** (baileys / twilio / official / none), and the
capability flags report what is genuinely configured — **never a fake success**. Under a
config that selects `official` (or `none`), a traffic run must show **zero** Baileys
connections.

**The security rule that must not be reordered:** normalise, *then* compare. `+336…`, `00336…`,
`336…` and `336…@c.us` are one number; a raw string comparison is bypassed by formatting alone —
which is exactly the failure the allowlist exists to prevent. Accept test: all four formats
resolve to one entry, and a non-sandbox number is rejected in every format.

> Updated 2026-10-03 (see `dev/DECISIONS-2026-10-03.md` §3.6, §3.7) — all three channels
> are real this batch (trial/free tiers, zero spend); "sandbox / NotConfigured until
> Gate 7" is superseded. Ban-risk containment is the dedicated-test-number rule above.

## 5. Data model

**Two databases, deliberately** — not a single server-side Postgres:

| Store | Owner | Migrations | Notes |
|---|---|---|---|
| Desktop SQLite | the Tauri app | existing Rust `src-tauri` migrations | Console data; never the agent's store |
| agent-core store | `agent-core` | **its own up/down SQL** in `services/agent-core/migrations/` (§15) | **SQLite for dev, PG-shaped schema** so Gate 1 Postgres is a driver + runner swap, not a redesign |

**Config-related tables first**; calls/turns/metering/knowledge migrations land *with their
endpoints*, incrementally — not one atomic batch. `agent-core` had no persistence precedent
before this (in-memory fixtures only); this module is the first, and it stays the single
storage home.

> Updated 2026-10-03 (see `dev/DECISIONS-2026-10-03.md` §3.3) — "Postgres on the agent host"
> as the *dev* store is superseded; Postgres + pgvector bring-up, and the five unskipped
> migration tests, are Gate 1 (§7 of that record).

Tables below are the **target (PG-shaped) schema**, with the reason each exists:

| Table | Key columns | Why |
|---|---|---|
| `tenants` | id, name, hours, tz, transfer_target, tier | Tenant identity comes from the token (`ADR-001` D4a), and this is where config lives |
| `calls` | id, tenant_id, channel, direction, from_e164, started_at, ended_at, state, outcome, containment | The call log. `outcome` and `containment` feed `PILOT-CRITERIA.md` |
| `turns` | call_id, idx, role, text, started_at, vad_at, stt_final_at, llm_first_token_at, tts_first_byte_at | The four **stage marks** per turn — the only way a latency miss is attributable to a stage |
| `call_metrics` | call_id, answer_latency_ms, turn_gap_p50_ms, turn_gap_p95_ms, wrapup_latency_ms | The three named metrics from `CALL-FLOW.md` §3 |
| `transfer_attempts` | call_id, trigger, target, requested_at, result, failure_reason | **No transfer succeeds silently.** Failure falls through to message-taking |
| `metering_events` | tenant_id, ts, kind, units, provider, unit_cost, model | Per-minute/per-message, tagged by tenant + tier. **Reuses the existing invoicing module** — no second billing system |
| `provider_health` | provider, window_start, error_rate, latency_p95, fallback_active | Feeds the ops snapshot and the fallback chain |
| `alerts` | tenant_id, rule_id, severity, opened_at, cleared_at, payload | One row per matrix rule firing (`OPS-ASSISTANT.md` §3) |
| `kb_documents` / `kb_chunks` | doc_id, source, published_at; chunk: doc_id, ordinal, text, embedding | The **curated** knowledge base (Option A). Scope is client-owned |
| `number_health` | number, window, block_rate, source | Reuses deliverability monitoring rather than rebuilding it |

Migrations follow the repo's existing convention. `turn_gap` percentiles are computed per call
at wrap-up, not per turn, so the pilot's p50/p95 bars are directly queryable.

## 6. HTTP / WS surface

Tenant identity still comes from the token (`ADR-001` D4a) — but **auth is deferred to
Gate 1**: the endpoints below ship **open on loopback**, the known "any non-empty bearer
token" hole is accepted for now, and **nothing may leave loopback before it is closed**
(gating item recorded in `dev/DECISIONS-2026-10-03.md` §3.9).

> Updated 2026-10-03 (see `dev/DECISIONS-2026-10-03.md` §2, §3.9) — config endpoints are the
> **first** group in the batch; every other group lands with its own migration.

| Endpoint | Method | Purpose |
|---|---|---|
| `/healthz` | GET | Liveness. Unauthenticated, returns no tenant data |
| `/config` | GET / PUT | **Agent behaviour config** (first in the batch): provider mix/routing, consent copy variant, bilingual toggle, **channel selection + per-channel enablement**, cost-sim inputs, hours/transfer/tier. **No credentials and no persona data — ever** (§17) |
| `/session` | POST | Start a session (used by the console for test calls and by the channel adapters) |
| `/ws/transcript` | WS | Streaming transcript deltas + state + current turn's stage marks. **Authenticated at the upgrade handshake** (deferred to Gate 1, like everything else) |
| `/ops/snapshot` | GET | Tier, provider health, fallback-chain state, block-rate trend — the §6 minimum field list in **one** round trip (`ADR-001` D4b) |
| `/kb/documents` | POST | Ingestion (curated scope only) |
| `/kb/search` | POST | Retrieval, for the eval harness and debugging |
| `/metering/rollup` | GET | Metered minutes by tenant/tier/call type |

**Forbidden, and enforced in review:** a tenant id in any request body, query string, or
argument. Tenant identity is derived **server-side** from the token. Tokens never travel in a
WS query string (they land in access logs).

## 7. Rust IPC surface (Gate 3)

Additive commands, appended to `generate_handler![]` — **existing entries are never reordered**.

| Command | Notes |
|---|---|
| `agent_start_session` | |
| `agent_end_session` | |
| `agent_list_calls` | |
| `agent_get_transcript` | |
| `agent_set_provider_tier` | Sets the **tenant's** tier. A live call is **never** hot-swapped (`ADR-001` D4c) |
| `agent_get_ops_snapshot` | The ops reads in one call (`ADR-001` D4b) |

`models.rs` mirrors the pydantic models with serde renaming; `client.rs` is one `reqwest` client
with a base URL from config. **`reqwest` is already a main-crate dependency**
(`src-tauri/Cargo.toml:54`, 0.13.4 with `rustls-no-provider`), so Gate 3 adds no dependency
weight.

> Updated 2026-10-03: the **config endpoint group** (§6, `GET/PUT /config`) will need
> matching additive commands for the Config tab (read + write config, channel selection).
> They are **appended**, never reordered, and the six commands above are unchanged — exact
> names land with the implementation (boundary rule 5; config is first in the batch).

## 8. Failure modes and the fallback chain

| Failure | Behaviour | Never |
|---|---|---|
| Primary STT/TTS/LLM errors | Chain to the next provider at the same tier; record `fallback_active` | Fail over silently |
| All providers down | P1 alert with blast radius (which tenants, since when); approve a degradation mode | Keep retrying invisibly |
| Transfer target unreachable | Apologise, take a message, voicemail path, close | Leave the caller waiting for a human who is not coming |
| `agent-core` unreachable from the console | Console states it explicitly with last-seen | Render as "no calls" (UX.md §7) |
| Carrier/number fault | P1: zero inbound in business hours is a fault, not quiet | Assume the phone is simply quiet |
| Webhook/ingestion failure | Retry, then surface in the digest | Fabricate a summary |

Per call, the chain is bounded and its state is **observable** — `CHAINS.md`-style runbooks are
Gate 7 deliverables, and the chain's state is what `provider_health` stores.

## 9. Observability

Two layers, both already specified upstream — this document only says where they are emitted:

- **Per call:** `answer_latency`, `turn_gap`, `wrapup_latency`.
- **Per turn:** `vad_at`, `stt_final_at`, `llm_first_token_at`, `tts_first_byte_at`.

Targets: `answer_latency` p95 < 2s · `turn_gap` p50 < 1.0s, p95 < 1.6s. **The stage marks are
what make a miss actionable** — without them every miss becomes an argument.

Structured logs keyed by session id → replayable debugging. Metered events carry the tier and
the provider so a cost regression is attributable like a latency one.

## 10. Metering and cost accounting

Per-minute and per-message events tagged by tenant + tier, written at wrap-up. **Billing reuses
the repo's existing invoicing module** (`docs/04-FEATURES/36-invoicing.md`) — a second billing
path is a defect, not a conservative choice.

`ProviderTier` (budget / standard / premium) is a **fallback chain across the four seams**, not
a separate code path. New at Gate 5: a **`selfhosted`** tier, gated on measurement
(`../dev/SELF-HOSTING.md`).

Two accounting corrections carried in from the performance review:
1. The per-minute **LLM** figure in `COST-MODEL.md` §1 is a **floor**, not an average —
   context grows every turn, so cost is superlinear within a call. Metering must record
   context growth, not just the per-turn rate.
2. **TTS is 88% of the variable cost.** Cache the greeting, the disclosure line and
   confirmations; the cache is what makes a tier switch worth doing.

> Updated 2026-10-03: whether the **metering endpoints** land in the merged batch or at
> Gate 5 is an **open question** (`dev/DECISIONS-2026-10-03.md` §9) — ask it at the start
> of endpoint work, not after. The cost **simulator** (inputs, `UNVERIFIED` flags) is in
> the batch regardless: it is Config, not metering (§17).

## 11. Knowledge ingestion (Option A, signed)

pgvector + a **self-hosted multilingual embedder** (default `bge-m3`, MIT; `arctic-embed-l-v2.0`
is a config swap — but note it means **re-embedding the corpus**, since it is a different vector
space).

| Step | Detail |
|---|---|
| Scope | **Curated KB only** — services, hours, pricing, booking rules. The mail/contact corpus is out of scope until the client says otherwise (`RAG-FORK.md` §Decision record) |
| Ingest | `POST /kb/documents` → chunk → embed → upsert; store `ordinal` + source for citation |
| Chunking | Curation and chunking move containment **more than the embedder**. 200–500 chunks, not 5,000 |
| Retrieve | dense + exact-term leg (`tsvector` + RRF, or bge-m3's native sparse) |
| Eval gate | `tests/rag/retrieval_eval.py` — 25–50 FR/EN question→chunk pairs, **hit@3 ≥ 0.9** |
| Cross-lingual | A French query retrieves English documents — the client authors the KB once |

**Do not merge spaces.** Three exist: desktop-candle 384, desktop-provider N, server 1024
(`ADR-001` D2). A dimension mismatch at query time is a hard failure, and "unify them" is the
tempting wrong move.

## 12. Deployment

> Updated 2026-10-03 (see `dev/DECISIONS-2026-10-03.md` §3.5, §3.7) — three rows below are
> re-baselined: host (FreeSWITCH split), secrets (`.env` on the server), migrations (two
> databases).

| Concern | Decision |
|---|---|
| Host | **Its own EU VPS.** Not the SaaS box — that runs nginx/php-fpm/Laravel/MariaDB/Redis/Stalwart and carries the 24/7 on-call commitment. A slow query must never cost a phone call |
| Telephony host | **FreeSWITCH**: native on this Windows dev host for testing (no Docker/WSL here today); production runs on a **new dedicated VPS with Docker**. **Never the Contabo panel box** (`86.48.1.182` = the production SaaS panel; no Docker daemon, not a telephony host). Acceptance test = FreeSWITCH loopback |
| Verified capacity reference | The existing SaaS box is **4 vCPU AMD EPYC, ~6.3 GB free, load 0.36, Python 3.12.3** — useful as a *capacity datum*, not as a deployment target |
| Transport | HTTPS + WSS only; loopback for the optional self-hosted inference engine |
| Secrets | `.env.example` keys, never values. **Runtime credentials live in `.env` on the server** — Baileys session credentials, Twilio SID/token, Meta app token — **not** in config endpoints, **not** in Settings. Settings' Keys tab is a read-only display in v1; the console's own bearer token stays in the desktop's Tauri store. **No rotation story yet** (open; Gate 1/Gate 5 runbook). Never commit `.env` |
| Migrations | **Two books:** desktop → existing Rust `src-tauri` convention; agent-core → its own up/down SQL applied at startup (§15). Config tables first; the rest land with their endpoints |
| Channels | Trial/free tiers only this batch — Twilio trial, Meta test app, Baileys free. **Zero spend.** Channel selection is config, and capability flags never report an unconfigured channel as working |
| Auth | **Deferred to Gate 1** (§6) — loopback-only until token validation exists |
| Region | EU, and the DPA must name the region. Residency is a **selling point**, so it is a build constraint, not a footnote |

## 13. Request/response schemas — one per endpoint

Field names match `FRONTEND.md` §12.2 exactly (the `/config` block is the exception: its
fields mirror the ConfigPage state per `dev/DECISIONS-2026-10-03.md` §3.4). `agent-core`
pydantic is the contract; Rust `models.rs` mirrors it with serde rename_all = "camelCase".
**No endpoint accepts a tenant id.**

### `GET /healthz`
```json
{ "ok": true, "version": "0.1.0", "startedAt": "2026-09-28T09:00:00Z",
  "db": "ok", "providers": "ok" }
```
Unauthenticated. Returns **no tenant data** and no provider names.

### `GET /config` · `PUT /config`

> Updated 2026-10-03 — first endpoint group in the merged batch. Field names mirror the
> ConfigPage state (`FRONTEND.md`); pydantic remains the contract.

```json
{ "providerMix": { "llm": "google/gemini-3.x-flash", "tts": "elevenlabs",
                   "stt": "deepgram", "embed": "bge-m3" },
  "consentVariant": "announce_first",
  "bilingual": true,
  "channel": "baileys",
  "channels": { "baileys":  { "enabled": true,  "configured": true  },
                "twilio":   { "enabled": false, "configured": false },
                "official": { "enabled": false, "configured": false } },
  "costSim": { "inputs": { }, "unverified": true },
  "hours": { "mon-fri": ["09:00","18:00"] }, "tz": "Europe/Paris",
  "transferTarget": "+336****5678", "tier": "standard",
  "knowledgeScope": ["services_pricing","hours","booking_rules"] }
```

**Never in this payload:** credentials of any kind (they live in `.env` on the server, §12)
and persona data (§17). `configured` is **derived** from what the server can actually see —
the client may enable a channel, but the flag never claims a channel that has no
credentials behind it.

### `POST /session`
Request:
```json
{ "channel": "voice", "purpose": "test_call",
  "locale": "fr", "callerOverride": "+33612345678" }
```
`purpose` is `"test_call" | "live"`. Response `201`:
```json
{ "sessionId": "01JB8…", "state": "greeting", "openedAt": "2026-09-28T14:32:00Z",
  "wsUrl": "wss://…/ws/transcript", "disclosure": "Cet appel est pris en charge…" }
```
`callerOverride` is accepted **only** when `purpose == "test_call"`; a live session gets the
number from the carrier. Rejected with `403` otherwise — this is the one field that could turn
a test endpoint into a call-placement primitive.

### `WS /ws/transcript`
Authenticated at the **upgrade handshake** (`Authorization` header or subprotocol). Never a query
string — query strings land in access logs.

Server → client frames:
```json
{ "type": "state",   "sessionId": "…", "state": "listening", "at": "…" }
{ "type": "delta",   "callId": "…", "turnId": 42, "seq": 17, "role": "caller",
  "text": "je voudrais prendre rendez-vous", "final": false, "at": "…" }
{ "type": "stages",  "callId": "…", "turnId": 42,
  "vadMs": 182, "sttMs": 341, "llmMs": 268, "ttsMs": 147, "turnGapMs": 1562, "at": "…" }
{ "type": "meta",    "callId": "…", "locale": "fr", "fallbackActive": false, "chainTier": "standard" }
{ "type": "closed",  "callId": "…", "reason": "normal", "at": "…" }
```
Client → server: only `{"type":"ping"}`. **There is no client frame that acts on a call** —
no transfer, no hangup, no barge-in. The absence is deliberate and reviewable.

`seq` is monotonic per `(callId, turnId)`; the client dedups on it (`FRONTEND.md` §12.5.7).

### `GET /ops/snapshot`
```json
{ "generatedAt": "…", "since": "2026-09-28T08:00:00Z", "reachable": true,
  "lastSeenAt": "2026-09-28T14:51:00Z",
  "callCount": 128, "containedPct": 79,
  "p1": [ { "id":"a_01", "severity":"P1", "rule":"transfer_failed",
            "oneLiner":"Transfer failures — 6 in 20 min, target unreachable since 14:32 →",
            "decision":"Take 3 of these back yourself",
            "evidence": { "count":6, "firstAt":"14:32", "lastAt":"14:51",
                          "blastRadius":"this tenant" },
            "acknowledgedAt": null, "acknowledgedBy": null,
            "thresholdIsProvisional": true } ],
  "p2Grouped": { "latency_turn_gap": [ … ] },
  "p3Count": 2,
  "providerHealth": [ { "provider":"deepgram", "errorRate":0.004,
                        "latencyP95Ms":410, "fallbackActive":false } ],
  "blockRateTrend": [ { "at":"2026-09-27", "rate":0.002 } ] }
```
`thresholdIsProvisional: true` is required while any threshold is unmeasured — the console
renders the provenance rather than presenting a guess as a measurement (`WIREFRAMES.md` G3).

### `POST /kb/documents`
```json
{ "source": "https://…/pricing", "scope": "pricing",
  "expectedChunks": 142 }
```
Response `202` (async): `{"jobId":"…","state":"queued"}`. Polled via `GET /kb/jobs/{jobId}`
→ `{"state":"running|done|failed","chunks":142,"error":null}`. **A failed or partial job
must be representable** — that is `WIREFRAMES.md` G12, and a schema that can only say "done"
is what makes that gap unfixable later.

### `POST /kb/search`
```json
{ "query": "remboursement sous 30 jours", "topK": 5 }
```
→ `{"chunks":[{"docId":"…","ordinal":12,"text":"…","score":0.87}],"embedder":"bge-m3","dims":1024}`
The eval harness (`tests/rag/retrieval_eval.py`) calls this; the hit@3 gate is computed from it.

### `GET /metering/rollup`
`?from=&to=&groupBy=call_type|day`
→ `{"from":"…","to":"…","groupBy":"call_type","rows":[{"key":"contained_pricing",
"calls":38,"minutes":118.4,"actualEur":24.90,"modelEur":23.94,"overModel":false}],
"totals":{"minutes":412,"actualEur":86.52,"modelEur":78.28}}`

### Error envelope (all endpoints)
```json
{ "error": { "code": "unreachable_provider", "message": "…",
             "retryable": true, "provider": "elevenlabs", "at": "…" } }
```
Stable `code` strings — the console branches on `code`, never on `message`.

## 14. DDL sketch

Postgres 16+, `pgvector`. Illustrative, not final — column types are the part that matters.

```sql
CREATE TABLE tenants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  tz               text NOT NULL DEFAULT 'Europe/Paris',
  business_hours   jsonb NOT NULL,           -- { "mon-fri": ["09:00","18:00"] }
  transfer_target  text,                     -- E.164; required when answering in-hours
  tier             text NOT NULL DEFAULT 'standard'
                     CHECK (tier IN ('budget','standard','premium','selfhosted')),
  after_hours_mode text NOT NULL DEFAULT 'take_message'
                     CHECK (after_hours_mode IN ('take_message','transfer','announce_only')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE calls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  channel       text NOT NULL CHECK (channel IN ('voice','whatsapp')),
  direction     text NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_e164     text NOT NULL,               -- stored normalised; masked at the edge
  state         text NOT NULL,               -- CALL-FLOW.md §1 states
  outcome       text,                        -- contained|transferred|voicemail|abandoned
  containment   boolean,                     -- the pilot's headline metric
  started_at    timestamptz NOT NULL,
  ended_at      timestamptz
);
CREATE INDEX ON calls (tenant_id, started_at DESC);
CREATE INDEX ON calls (tenant_id, outcome) WHERE outcome IS NOT NULL;

CREATE TABLE turns (
  call_id           uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  idx               int  NOT NULL,
  role              text NOT NULL CHECK (role IN ('caller','agent')),
  text              text NOT NULL,           -- transcript only. NO audio column, anywhere.
  vad_at            timestamptz,
  stt_final_at      timestamptz,
  llm_first_token_at timestamptz,
  tts_first_byte_at timestamptz,
  PRIMARY KEY (call_id, idx)
);

CREATE TABLE call_metrics (
  call_id             uuid PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  answer_latency_ms   int,   -- connect -> first greeting byte
  turn_gap_p50_ms     int,
  turn_gap_p95_ms     int,
  wrapup_latency_ms   int    -- hangup -> WhatsApp summary delivered
);

CREATE TABLE transfer_attempts (
  id            bigserial PRIMARY KEY,
  call_id       uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  trigger       text NOT NULL,              -- keyword|llm|anger|emergency
  target        text NOT NULL,
  requested_at  timestamptz NOT NULL,
  completed_at  timestamptz,
  result        text,                       -- completed|failed|no_answer
  failure_reason text
);
-- "no transfer succeeds silently" is enforced by the schema: an attempt is
-- never finished without a result, and result != completed is queryable.

CREATE TABLE metering_events (
  id          bigserial PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  call_id     uuid REFERENCES calls(id),
  ts          timestamptz NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('call_minute','whatsapp_message','tts_cache_hit')),
  units       numeric(10,3) NOT NULL,
  provider    text NOT NULL,
  tier        text NOT NULL,
  unit_cost   numeric(12,8) NOT NULL,        -- full precision: the invoice sums these
  model_id    text NOT NULL,
  context_tokens int                          -- see BACKEND.md §10: LLM cost is superlinear
);
CREATE INDEX ON metering_events (tenant_id, ts DESC);

CREATE TABLE alerts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  rule_id        text NOT NULL,              -- OPS-ASSISTANT.md §3
  severity       text NOT NULL CHECK (severity IN ('P1','P2','P3')),
  opened_at      timestamptz NOT NULL,
  cleared_at     timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by text,
  one_liner      text NOT NULL,              -- the decision, per §5
  payload        jsonb NOT NULL,
  threshold_is_provisional boolean NOT NULL DEFAULT true
);
CREATE INDEX ON alerts (tenant_id, opened_at DESC) WHERE cleared_at IS NULL;

CREATE TABLE kb_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  source       text NOT NULL,
  scope        text NOT NULL,
  published_at timestamptz,
  chunk_count  int NOT NULL DEFAULT 0
);

CREATE TABLE kb_chunks (
  doc_id     uuid NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  ordinal    int NOT NULL,
  text       text NOT NULL,
  embedding  vector(1024) NOT NULL,   -- dims in the config, NOT hardcoded (ADR-001 D2)
  tsvector   tsvector,                -- FR + EN dictionaries, for the lexical leg
  PRIMARY KEY (doc_id, ordinal)
);
```

**`vector(1024)` is written to make the ADR-001 D2 point concrete:** a hard-coded 384 here would
be a latent query-time failure, not a compile error. The DDL is generated from config.

## 15. Migration numbering convention

> Updated 2026-10-03 (see `dev/DECISIONS-2026-10-03.md` §3.3) — agent-core's sequence is
> **up/down SQL files** (not forward-only like the desktop's), applied at startup to the
> dev SQLite; the schema is written PG-shaped so Gate 1 is a driver + runner swap.

Two sequences, never shared: the repo's existing convention on the desktop side
(`docs/05-DEVELOPMENT/` migrations, `sqlx::migrate!`), and the agent's own directory:

```
services/agent-core/migrations/
  0001_tenants.sql
  0002_calls.sql
  0003_metering.sql
  0004_knowledge.sql
```

- **Config-related tables first**, then migrations land **with their endpoints** —
  incremental, not one atomic batch. Later tables (`call_metrics`, `transfer_attempts`,
  `alerts`, `provider_health`, …) are added to this sequence as their endpoint groups
  ship; the DDL sketch in §14 is the target, not today's directory listing.
- Filenames are `NNNN_snake_case_description.sql`, zero-padded to 4, never reused or renumbered.
- **Up/down pairs by decision** (`dev/DECISIONS-2026-10-03.md` §3.3): a dev schema can be
  torn down without a restore. ⚠️ The four files that exist today are **up-only** — the
  down half still has to land with the storage module. The **desktop** sequence stays
  forward-only (rolling back a metering schema there is a restore decision, not a
  `git revert`).
- The pgvector migration must run `CREATE EXTENSION IF NOT EXISTS vector;` explicitly, or it
  fails on a fresh host with a non-obvious error — **that migration is Gate 1**, with the
  Postgres bring-up.
- Destructive changes follow the **deprecate-fully** rule (spec invariant 6): a new column lands,
  a backfill runs, the old column is dropped in a **later** migration. No compat shims.

## 16. Verification (real commands, per gate)

> Updated 2026-10-03 (see `dev/DECISIONS-2026-10-03.md` §2) — **every endpoint group in the
> merged batch gets the full gate below** before commit, and **docs are updated first**
> (docs-first convention). Strict single writer until the batch lands.

```bash
# Every endpoint group (the standing §7 gate); Gate 3 = workspace, not -p <crate>
cmd /c "node node_modules/typescript/bin/tsc --noEmit"
cd src-tauri && cargo check --workspace
# + the four invariant greps + one Playwright pass
# + TS↔Python contract-drift check (B5 fixture pattern)
# + every new route covered by a `test_camel_acceptance`-style contract test

# Gate 1 — assert the SUMMARY LINE, not the exit code (pytest false-greens on this host)
cd services/agent-core && python -m pytest -q
cd services/agent-core && python -m pytest -q tests/rag/retrieval_eval.py   # hit@3 >= 0.9

# Gate 4 — a real inbound FR call, with the four numbers pasted
# answer_latency p95 < 2s, turn_gap p50 < 1.0s
# Telephony acceptance = FreeSWITCH loopback (no paid number needed)

# Gate 5 — a synthetic 10-minute call produces 10 metered minutes at correct provider costs,
# and the console total matches the DB row exactly.
```

**Always `git status --short` before touching shared files** — concurrent agents work in this
tree.

---

## 17. Config ownership, channels and credentials — re-baseline summary

> Updated 2026-10-03 (see `dev/DECISIONS-2026-10-03.md` §3.2–§3.6) — this section is the
> one-paragraph version of what the Config endpoint (§6) and the Config UI are allowed to
> contain. It exists so no one re-litigates the boundary mid-batch.

| | Config owns (server-side, `GET/PUT /config`) | Settings owns (desktop, local runtime) | Neither owns |
|---|---|---|---|
| Content | provider mix/routing, consent copy variant, bilingual toggle, **channel selection + per-channel enablement**, cost-sim inputs, business hours, transfer target, tier, knowledge scope | local model tier, RTF gate, model downloads/installs, Keys tab as **read-only display** | **credentials** (server `.env`), **persona data** (persona study informs workflow/business-type *conditions* in agent logic only — surfaces never render persona widgets) |
| Data rule | typed schema mirroring the ConfigPage state; **no data duplicated** with Settings | no duplication back into config | never committed, never exposed by an endpoint |

**Channels (all real this batch, trial/free tiers only):**

| Channel | Tier | Containment |
|---|---|---|
| Baileys | free, unofficial | **dedicated test WhatsApp number only** — never a client's or our main number (ban risk) |
| Twilio (voice) | trial | no inbound from unverified numbers until the account is upgraded |
| Official WhatsApp Business API | Meta test app | test-mode 24 h tokens; clients run their own Meta verification when they start |
| `none` | — | capability flags report "not configured"; the UI shows the mockup-06 *capability unavailable* pattern, never a fake success |

**Cost simulator:** port the structure from `prototype/voice-console/src/data/costPresets.ts`
with **every `UNVERIFIED` flag and `source` string preserved** — real numbers land when the
vendor RFQ returns (`client/COST-MODEL.md` §6).
