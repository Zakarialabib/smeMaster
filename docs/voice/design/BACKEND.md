# Backend — Voice & Messaging Agent

> **Status:** Gate 0 design. Target: spec Gates 1–5, 7.
> **Decisions:** [`ADR-001`](../../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) —
> **read it first**; this document elaborates it and does not overrule it.
> **Companions:** [`FRONTEND.md`](FRONTEND.md) · [`../dev/CALL-FLOW.md`](../dev/CALL-FLOW.md) ·
> [`../dev/RAG-FORK.md`](../dev/RAG-FORK.md) · [`../dev/SELF-HOSTING.md`](../dev/SELF-HOSTING.md)

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
6. **No secrets in the repo.** `.env.example` gets keys, never values.
7. **No backwards-compat shims, no "interim" state.**

## 2. Process topology

```
                    ┌──────────────── OUR OWN EU VPS (not the SaaS box — see §12) ─────────────────┐
                    │                                                                              │
  PSTN caller ──────┼──▶ Telnyx ──(media stream, μ-law 8k, WSS)──▶ ┌───────────────────────────┐  │
  (dedicated FR #)  │                                              │  agent-core (FastAPI)     │  │
                    │                                              │  ┌─────────────────────┐  │  │
  WhatsApp ─────────┼──▶ BSP (prod) / Baileys (sandbox) ──WSS────▶ │  │ ChannelAdapter      │  │  │
  caller            │                                              │  │  ├ telephony        │  │  │
                    │                                              │  │  └ whatsapp         │  │  │
  SMEMaster desktop │                                              │  └──────────┬──────────┘  │  │
  console ──────────┼──▶ HTTPS + WSS (bearer) ──────────────────▶  │             ▼             │  │
  (Tauri + React)   │                                              │  orchestrator (turn loop) │  │
                    │                                              │   ├ LLMProvider  ─────────┼──┼──▶ OpenRouter
                    │                                              │   ├ TTSProvider  ─────────┼──┼──▶ ElevenLabs
                    │                                              │   ├ STTProvider  ─────────┼──┼──▶ Deepgram
                    │                                              │   └ EmbeddingProvider ────┼──┼─┐
                    │                                              │  Postgres + pgvector      │  │ │
                    │                                              │  (metering, calls, KB)    │  │ │
                    │                                              └───────────────────────────┘  │ │
                    └───────────────────────────────────────────────────────────────────────────┘  │
                                                                                                     │
   self-hosted tier (optional, Gate 5): localhost WSS ──▶ sherpa-onnx (C++, CPU) ◀── the embedder lives here too
```

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
| `telephony.py` | Telnyx media stream (WSS, μ-law 8 kHz ↔ 16 kHz resample) | **One writer during Gate 4.** Turn detection, transfer ladder, voicemail detection |
| `whatsapp.py` (sandbox) | Baileys, MIT — **dev only** | `normalize_e164()` runs **before** the allowlist check |
| `bsp.py` (prod) | BSP/provider API | Identical signature. `NotConfigured` until Gate 7 |

**The security rule that must not be reordered:** normalise, *then* compare. `+336…`, `00336…`,
`336…` and `336…@c.us` are one number; a raw string comparison is bypassed by formatting alone —
which is exactly the failure the allowlist exists to prevent. Accept test: all four formats
resolve to one entry, and a non-sandbox number is rejected in every format. Under production
config, a traffic run must show **zero** Baileys connections.

## 5. Data model

Postgres on the agent host (the app's SQLite is the **desktop's** store and is never the
agent's). Tables, with the reason each exists:

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

All of it behind the tenant bearer token (`ADR-001` D4a).

| Endpoint | Method | Purpose |
|---|---|---|
| `/healthz` | GET | Liveness. Unauthenticated, returns no tenant data |
| `/session` | POST | Start a session (used by the console for test calls and by the channel adapters) |
| `/ws/transcript` | WS | Streaming transcript deltas + state + current turn's stage marks. **Authenticated at the upgrade handshake** |
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

| Concern | Decision |
|---|---|
| Host | **Its own EU VPS.** Not the SaaS box — that runs nginx/php-fpm/Laravel/MariaDB/Redis/Stalwart and carries the 24/7 on-call commitment. A slow query must never cost a phone call |
| Verified capacity reference | The existing SaaS box is **4 vCPU AMD EPYC, ~6.3 GB free, load 0.36, Python 3.12.3** — useful as a *capacity datum*, not as a deployment target |
| Transport | HTTPS + WSS only; loopback for the optional self-hosted inference engine |
| Secrets | `.env.example` keys, never values; bearer tokens in the desktop's Tauri store |
| Migrations | Existing convention; one migration per gate that adds tables |
| Region | EU, and the DPA must name the region. Residency is a **selling point**, so it is a build constraint, not a footnote |

## 13. Verification (real commands, per gate)

```bash
# Gate 1 — assert the SUMMARY LINE, not the exit code (pytest false-greens on this host)
cd services/agent-core && python -m pytest -q
cd services/agent-core && python -m pytest -q tests/rag/retrieval_eval.py   # hit@3 >= 0.9

# Gate 3 — workspace, not -p <crate>
cd src-tauri && cargo check --workspace
cmd /c "node node_modules/typescript/bin/tsc --noEmit"

# Gate 4 — a real inbound FR call, with the four numbers pasted
# answer_latency p95 < 2s, turn_gap p50 < 1.0s

# Gate 5 — a synthetic 10-minute call produces 10 metered minutes at correct provider costs,
# and the console total matches the DB row exactly.
```

**Always `git status --short` before touching shared files** — concurrent agents work in this
tree.
