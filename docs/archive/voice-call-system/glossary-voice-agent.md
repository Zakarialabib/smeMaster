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
| **Webview-shell client** | A "WhatsApp client" that loads `web.whatsapp.com` in an OS webview and wraps it in a desktop shell (`karem505/whatRust`, MIT). **Not an integration**: no protocol, no headless operation, no programmatic send. Distinct from `Baileys`, which reimplements the protocol. `../../06-ROADMAP/16-voice-agent-whatsapp-oss-landscape.md` |
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

## Console design vocabulary (added 2026-09-28)

Terms the design set (`design/**`) introduces. The vendor's definition of a
speech runtime is almost never ours — these are what the code and the screens mean.

| Term | Meaning here |
|---|---|
| **`SpeechEngine`** | The one interface over all three speech runtimes (desktop sidecar / mobile in-process / server). Selected by config, never by a build flag. Does not expose "call STT"/"call TTS" as loose functions — it exposes a streaming session. `FRONTEND.md` §3.2 |
| **`Capabilities`** | What *this host* can actually do — `stt`/`tts`/`vad` booleans, available `ExecutionProvider`s, installed models. The point is per-host, not per-project: it lets the console render "offline model not installed" instead of failing at capture time. `FRONTEND.md` §3.2 |
| **`ExecutionProvider`** | The compute backend a local speech runtime uses — `cpu`, `nnapi`, `xnnpack`, `qnn`, `cuda`, `metal`. Meaningful only for the `local` backend; a plain VPS reports `["cpu"]`. Explicit config, never a build flag |
| **`SpeechStream`** | One streaming speech session: `writePcm` in, `partial`/`final`/`vad`/`audio` events out, `close()`. Pairs with the `on()` unsubscribe return, so a component can detach without leaking a listener |
| **`ModelManager`** | Resumable model download with progress + integrity check, generalised from the repo's existing `aiDownloadModel` path. **Must not become a third download mechanism** — `FRONTEND.md` §3.3 |
| **RTF (real-time factor)** | Processing time ÷ audio duration. RTF < 1 means the runtime keeps up with live audio. A local tier that runs at RTF 1.4 cannot serve a live call, however good its WER — the self-hosted tier is gated on this |
| **Transcript delta** | One incremental append to the live transcript: `(callId, turnId, seq, role, text, final)`. Deltas are the *display* stream and are droppable; the recorded transcript is not. `FRONTEND.md` §12.2, §12.5 |
| **Delta coalescing** | Batching many deltas into one render per animation frame, merging consecutive deltas within a `turnId`. Without it, a streaming UI re-renders per token — the classic failure |
| **Digest** | The morning (or on-return) summary: P3/P2 rolled up, newest-first, grouped. `UX.md` §1 job 1 — "what happened while I was away", the product's most valuable single query |
| **Ops snapshot** | The single round trip carrying tier, provider health, fallback-chain state, block-rate trend, alert counts and reachability. Exists so the digest needs no second fetch to be *understood*. `ADR-001` D4b |
| **Stage mark** | One per-turn timestamp — VAD / STT final / LLM first token / TTS first byte. Not a metric: a *provenance* record that makes a latency miss attributable to a stage instead of an argument |
| **`thresholdIsProvisional`** | A flag on every alert while its threshold is unmeasured. Required by `WIREFRAMES.md` G3: the UI shows a guess's provenance rather than presenting it as a measurement |
| **Degraded state** | A specific rendered state for a specific failure — offline, provider down, chain exhausted, partial ingest. Never a bare empty list. The distinction that matters: **"cannot reach the agent" must not look like "no calls"** |
| **Self-hosted tier** | The budget `ProviderTier` running local/offline speech (sherpa-onnx), gated on RTF and measured `turn_gap`. **Disabled in the console with a stated reason** until measured — see `dev/SELF-HOSTING.md` |
| **Propose / dispose** | The console's core interaction law: the assistant surfaces a decision, a human takes it. It never acts on a caller and never acts on the owner's behalf. `OPS-ASSISTANT.md` §3 |
| **UI locale ≠ voice locale** | The app ships en/fr/ar/ja/it; the agent speaks **FR/EN only**. The voice selector lists what the agent speaks, in every locale — including `ar` |

## Deliberately out of v1

| Term | Why it is named, not built |
|---|---|
| **Darija / Arabic voice** | The repo ships an `ar` **UI** locale; that is interface text, not speech. Whisper-family STT is weak on Darija and MSA TTS is an audible tell to a Moroccan caller — a worse outcome than an honest FR/EN fallback. **UI locale ≠ embedding locale ≠ voice locale** |
| **Edge TTS** | Unofficial Microsoft endpoint, gray ToS. Excluded from every client tier |
| **Supervisor barge-in** | Letting an assistant interrupt a live call it may have misread. The one item on the ops page that can damage a real interaction |
