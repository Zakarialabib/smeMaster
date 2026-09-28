# Glossary — Voice & Messaging Agent (FR/EN)

> **Created:** 2026-09-28 · **Anchor spec:** [`docs/specs/2026-09-28-voice-agent.md`](../specs/2026-09-28-voice-agent.md)
> **Scope:** terms used in `docs/voice/**` and the spec. Definitions are stated in terms
> of **this repo**, not the vendor's marketing page — where the two differ, the repo wins.
> **Related:** [`ADR-001`](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md)

## Runtime & process model

| Term | Meaning here |
|---|---|
| **`agent-core`** | The Python FastAPI service that hosts the realtime audio + LLM turn loop. Lives at `services/agent-core/`, **outside** `src-tauri`, never a Cargo workspace member, never launched by Tauri. `ADR-001` D1 |
| **`ml-sidecar`** | The **existing** on-device Rust binary (`src-tauri/crates/ml-sidecar/`) — candle + lancedb + hf-hub, JSON-RPC 2.0 over stdin/stdout, launched and watchdogged by Tauri. Precedent for the *lifecycle contract*, **not** for the agent's process model |
| **Console** | The React 19 surface in `src/features/agent/` that watches live calls. A client of `agent-core`; it imports no provider SDK |
| **Sidecar** | A process boundary chosen because the work cannot run in the host's lifetime (24/7) or its runtime (Python). Not a synonym for "subprocess" |
| **Seam** | A provider trait that can be swapped by a **config value** with no code change. This project has four: LLM, TTS, STT, embedding |

## Embedding & retrieval

| Term | Meaning here |
|---|---|
| **Embedding space** | A (model, dimension, normalisation) triple. Vectors from two spaces are not comparable. This project has **three**: desktop-candle **384**, desktop-provider **N**, server **1024**. `ADR-001` D2 |
| **`embeddingSource`** | Desktop setting (`smemaster.rag.embeddingSource`) with values `rust_bge \| provider \| auto` — decides which of the two **desktop** spaces is active. Note `auto` can resolve either way |
| **`bge-small-en-v1.5`** | The repo's existing desktop embedder (`BAAI/`, MIT). **English-only** — the `-en` is the constraint, not a variant tag |
| **`bge-m3`** | `BAAI/bge-m3`, MIT, 1024-dim, multilingual, 8k context, native hybrid (dense + sparse + ColBERT). The recommended server default |
| **`arctic-embed-l-v2.0`** | `Snowflake/snowflake-arctic-embed-l-v2.0`, Apache-2.0, 1024-dim, same XLM-R architecture as bge-m3 → a **config swap**, not a migration |
| **Hybrid retrieval** | Dense vectors + an exact-term leg (bge-m3's native sparse, or Postgres `tsvector` + RRF). Matters for a KB full of product names, prices and opening hours |
| **RRF** | Reciprocal Rank Fusion — merging two ranked lists without score calibration. The `tsvector` pairing option |
| **`pgvector`** | The Postgres extension for vector columns. Server-side only. PostgreSQL licence |
| **Cross-lingual retrieval** | A French query retrieving English documents. A property of the multilingual embedder, and a sales point — the client authors the KB once |
| **hit@3** | The retrieval eval gate: the expected chunk must appear in the top 3. Bar is **≥ 0.9** over 25–50 FR/EN question→chunk pairs (`tests/rag/retrieval_eval.py`) |

## Telephony & channels

| Term | Meaning here |
|---|---|
| **`ChannelAdapter`** | The one interface both channels implement (`inbound_events()` async iterator + `send_text()`). The agent core never branches on channel |
| **BSP** | Business Solution Provider — a reseller with a Meta partnership. The production WhatsApp path |
| **`Baileys`** | `WhiskeySockets/Baileys`, MIT, active. A **WhatsApp Web protocol client**, not an official API. Dev sandbox only; the E.164-normalised allowlist is the guard |
| **E.164 normalisation** | Collapsing `+33…`, `0033…`, `0…`, and `…@c.us` to one canonical form. Runs **before** any allowlist comparison, otherwise formatting alone bypasses it |
| **JID** | WhatsApp's address form (`33612345678@c.us`). One of the alias formats normalisation must collapse |
| **DID** | Direct Inward Dialling — the phone number itself |
| **μ-law / PCMA** | The 8 kHz G.711 audio encodings carriers stream over WebSocket; resampling to 16 kHz is required for the model pipeline |
| **Warm transfer** | Handing a live caller to a human with context carried over (SIP REFER or equivalent). **No warm transfer ⇒ no v1** |
| **ARCEP** | The French telecoms regulator. Governs porting timelines for an existing number |
| **Voice note** | A WhatsApp *audio message*. Transcribable. **Not** a live call — live WhatsApp voice is exposed by no API |

## Messaging economics

| Term | Meaning here |
|---|---|
| **Service conversation** | A conversation the *user* initiates (or replies within) — free on Meta's side inside the 24-hour window. v1's WhatsApp costing rests on this |
| **Template message** | A pre-approved **business-initiated** message, priced by category. Out of v1 scope in `COST-MODEL.md` §4 — which is what makes the voicemail→owner path's €0 claim an open question (`ADR-001` Open #1) |
| **Message categories** | service / utility / marketing / authentication — priced differently. The category model changed effective 2025-07-01 |
| **24-hour window** | The service-conversation window. Outside it, a business-initiated message needs a template |

## Metrics & contract

| Term | Meaning here |
|---|---|
| **`answer_latency`** | Carrier connect → first byte of greeting audio. p95 target **< 2s** |
| **`turn_gap`** | Caller's speech ends (VAD fires) → first byte of agent audio. p50 **< 1.0s**, p95 **< 1.6s** |
| **`wrapup_latency`** | Carrier hangup → WhatsApp summary delivered (after-hours path) |
| **Stage marks** | Per-turn timestamps: VAD, STT final, LLM first token, TTS first byte. They attribute a miss to a stage, which is why the targets are actionable |
| **Containment** | Share of a target call type resolved **without** a human. The pilot's headline metric. Bar **≥ 60–70%** |
| **Gate 0–7** | The spec's serial implementation gates. Gate 0 = docs only; Gate 4 = telephony, the one-writer gate |
| **`ProviderTier`** | budget / standard / premium — a fallback chain across the four seams. **Scope undecided**: per-tenant or per-session (`ADR-001` D4) |
| **Ops assistant** | A *watcher/summariser* that talks to the operator, never to a caller. Distinguish from the **call-handling agent** (talks to callers) and the **supervisor** (barges into a live call — out of v1, and dangerous) |

## Deliberately out of v1

| Term | Why it is named, not built |
|---|---|
| **Darija / Arabic voice** | The repo ships an `ar` **UI** locale; that is interface text, not speech. Whisper-family STT is weak on Darija and MSA TTS is an audible tell to a Moroccan caller — a worse outcome than an honest FR/EN fallback. **UI locale ≠ embedding locale ≠ voice locale** |
| **Edge TTS** | Unofficial Microsoft endpoint, gray ToS. Excluded from every client tier |
| **Supervisor barge-in** | Letting an assistant interrupt a live call it may have misread. The one item on the ops page that can damage a real interaction |
