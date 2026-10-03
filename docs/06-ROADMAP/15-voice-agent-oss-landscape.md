# Voice Agent — Open-Source Landscape & Adaptation Brief

> **Status:** Verified 2026-09-28 against live repo/registry APIs. Companion to the spec.
> **Anchor spec:** [`docs/specs/2026-09-28-voice-agent.md`](../specs/2026-09-28-voice-agent.md) §4 (architecture)
> **Decisions:** [`ADR-001`](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) ·
> **Terms:** [`glossary-voice-agent.md`](../glossary/glossary-voice-agent.md)
> **Rule:** port **patterns**, not code. Study the shape, implement our own types.

## 1. What this document is, and what it is not

This is an **intake brief**, not a greenfield integration plan. The spec already exists
and already names the reuse surface (`src/shared/services/ai/providerFactory.ts`,
`providerManager.ts`, tool registry, invoicing, deliverability, orchestrator,
`ml-sidecar`'s lifecycle shape) — so nothing here re-decides those. It answers one
question: **for each layer the spec needs, is an open-source project the answer, a
vendor-gated cost, or already in the repo?**

Layers that are vendor-gated are named as **costs and lead times**, not researched as
libraries. Three of the eight layers are gated, and that is the headline finding: this
project is a **services-integration** build, not an OSS-assembly build.

## 2. Layer decomposition and availability

| # | Layer | OSS answer? | Verdict |
|---|---|---|---|
| P1 | Agent framework + turn loop | ✅ mature, permissive | **OSS** — LiveKit Agents (primary), Pipecat (fallback) |
| P2 | Media transport / SFU / turn detection | ✅ | **OSS** — LiveKit server (Apache-2.0) if self-hosting media; silero-vad (MIT) for local VAD |
| P3 | Carrier + FR number (termination, DID) | ⛔ **GATED** | **Commercial** — Telnyx. No OSS substitutes a carrier. OSS can replace only the *media server* |
| P4 | WhatsApp channel | ⛔ **GATED** | **Commercial** — BSP. Baileys (MIT) is sandbox-only |
| P5 | Retrieval / RAG | ✅ | **OSS** — pgvector + FlagEmbedding; weights bge-m3 (MIT) / arctic-l-v2.0 (Apache-2.0) |
| P6 | STT | ⛔ live / ⚠️ OSS batch | **Commercial** — Deepgram streaming. OSS (faster-whisper, MIT) is the budget fallback, momentum slowing |
| P7 | TTS | ⛔ | **Commercial** — ElevenLabs. OSS (Kokoro-82M, Apache-2.0) is the budget fallback, momentum stalled |
| P8 | Console | — | **Reuse** — existing React 19 + Zustand. No OSS |

## 3. Licence gate

**Repo's own licence:** Apache-2.0 (`LICENSE`, verified in tree) — permissive.

**The rule that applies here is not the linking rule.** The repo's Rust gate table
("permissive = linkable, copyleft = sidecar only") selects nothing on the Python side,
because `agent-core` is never linked into the Tauri binary. The rule that *does* select
is the **network clause**: a copyleft dependency inside a SaaS-facing service reaches
users over the network, so AGPL/SSPL obligations trigger without any linking. Every
dependency below is therefore permissive, and the goal is that **no** copyleft reaches
`agent-core` at all (`ADR-001` D5).

| Project | Licence (source) | Direct dep? |
|---|---|---|
| `livekit/agents` | Apache-2.0 (GitHub API) | ✅ |
| `livekit/livekit` | Apache-2.0 | ✅ if media self-hosted |
| `pipecat-ai/pipecat` | BSD-2-Clause | ✅ |
| `WhiskeySockets/Baileys` | MIT | ✅ **sandbox only** (protocol/ToS, not licence) |
| `pgvector/pgvector` | PostgreSQL licence (GitHub reports "Other"; LICENSE file) | ✅ |
| `FlagOpen/FlagEmbedding` | MIT | ✅ |
| `snakers4/silero-vad` | MIT | ✅ |
| `SYSTRAN/faster-whisper` | MIT | ✅ |
| `hexgrad/kokoro` | Apache-2.0 | ✅ |
| `fonoster/fonoster` | MIT | ⚠️ evaluates only (§5.3) |
| `jambonz/jambonz-api-server` | MIT | ⚠️ evaluates only |
| `signalwire/freeswitch` | MPL-1.1-family (reports "Other"; LICENSE file) | ⛔ not planned — see §6 |
| `asterisk/asterisk` | GPLv2-family (reports "Other"; LICENSE file) | ⛔ **never linked/forked into the service** |
| `open-wa/wa-automate-nodejs` | "Other" (LICENSE.md) — commercial session-key model | ⛔ reject |
| `vocodedev/vocode-core` | MIT | ⛔ reject on momentum |

**Attribution obligation.** Apache-2.0 and BSD-2 in a distributed/network service require
NOTICE and licence-text preservation. `docs/voice/` has a vendor-cost inventory
(`COST-MODEL.md`) and a model-weight inventory (`RAG-FORK.md`) but **no OSS attribution
inventory**. Add one before the pilot ships to the client.

## 4. Scoring axes — adapted for a Python network service

The standard 4-axis table assumes a Rust host. For a Python service the first axis is
degenerate, so it is translated honestly rather than left to mislead:

| Standard axis | Translated axis for `agent-core` |
|---|---|
| in-process Rust crate vs sidecar binary | **drop-in as a pip dependency vs needs its own process/gateway** |
| offline / local-first | unchanged — can it run on our own VPS with no third-party call? |
| IPC seam simplicity | unchanged — one ABC / one HTTP or WSS endpoint vs bespoke protocol |
| maintenance momentum | unchanged — release cadence, last push |

Reject below 6 on the integration axes. Momentum is read from `pushed_at`, not from star
count.

## 5. Pillar pre-evaluations

### 5.1 P1 — Agent framework (the spec's core choice)

| Candidate | Licence | ★ | Last push | Drop-in | Self-host | Seam | Momentum | Verdict |
|---|---|---|---|---|---|---|---|---|
| **`livekit/agents`** | Apache-2.0 | 14.4k | 2026-09-28 | 10 | 9 | 9 | 10 | **PRIMARY** |
| `pipecat-ai/pipecat` | BSD-2-Clause | 15.9k | 2026-09-28 | 10 | 9 | 9 | 10 | **FALLBACK** |
| `vocodedev/vocode-core` | MIT | 3.8k | **2024-11-15** | 8 | 9 | 8 | **2** | **REJECT — abandoned** |

Both live candidates score identically, which is why the spec's "swap is a port change"
claim holds. LiveKit is primary for one concrete reason: it brings the **SFU + media
server + turn detection** in the same project, which is the P2 layer we would otherwise
assemble separately. Pipecat is the fallback because its pipeline is more explicit —
better when the orchestration diverges from the framework's opinion.

**Correction to the spec:** Vocode is rejected for being **abandoned** (last push
2024-11-15, ~22 months stale), not for a 404. The repository resolves, is MIT, and has
3.8k stars. `ADR-001` D6.

### 5.2 P2 — Media transport and turn detection

`livekit/livekit` (Apache-2.0, 21.2k★, pushed 2026-09-28) if media is self-hosted.
`snakers4/silero-vad` (MIT, 10.3k★, pushed 2026-09-23) as the local VAD.

**`k2-fsa/sherpa-onnx` (Apache-2.0, 15.0k★, pushed 2026-09-22) also ships VAD**, bundled
with its STT/TTS — so choosing it for P6/P7 gets P2's VAD without a second dependency. Added
2026-09-28 (see §5.6).

**Reuse note:** the spec lists **LiveKit turn detection** for Gate 4. If the carrier's
media-stream path is used directly instead of a LiveKit session, turn detection must be
built on silero-vad, which is the pattern Pipecat ships. Decide at Gate 4, not Gate 1 —
but note that the choice changes Gate 4's effort, so it is a Gate 4 *entry* decision.

⚠️ **Silero-VAD is MIT for the code; its model weights carry their own terms.** Check the
weight licence before shipping, the same way `RAG-FORK.md` checks embedder weights.

### 5.3 P3 — Carrier (gated) and the OSS media-server alternative

**No OSS project substitutes a carrier.** A DID, termination to the PSTN, and number
reputation are regulated services. Telnyx is the spec's pick and is a **cost + lead
time**, not a candidate (§6 of the RFQ, `VENDOR-QUOTE-REQUEST.md`).

The OSS question is narrower: if the hosted media-stream price per minute makes the
margin unworkable, can the **media server** be self-hosted?

| Candidate | Licence | ★ | Last push | Drop-in | Self-host | Seam | Momentum | Score |
|---|---|---|---|---|---|---|---|---|
| `fonoster/fonoster` | MIT | 8.1k | 2026-09-18 | 6 | 9 | 7 | 7 | **7 — viable if forced** |
| `jambonz/jambonz-api-server` | MIT | 25 | 2026-08-26 | 5 | 10 | 6 | 6 | 6 |
| `signalwire/freeswitch` | MPL-family | 5.2k | 2026-09-28 | 4 | 10 | 5 | 8 | 5 — reject |
| `asterisk/asterisk` | GPLv2-family | 3.6k | 2026-09-23 | 3 | 10 | 4 | 8 | **REJECT — copyleft** |

**Assessment: do not self-host media in v1.** It converts a per-minute vendor cost into a
**24/7 operational commitment** that we already sell as the fixed-cost line
(`COST-MODEL.md` §2) — so it removes margin *and* adds blast radius, on a pilot that has
not yet proven demand. Keep Fonoster as the documented escape hatch if Telnyx's stream
pricing breaks the model at scale. `jambonz`'s low star count on `api-server` is an
org-structure artefact, not a dead project — but that is a claim to re-verify if it is
ever promoted.

### 5.4 P4 — WhatsApp channel (gated) with a sandbox-only OSS path

| Candidate | Licence | ★ | Last push | Verdict |
|---|---|---|---|---|
| `WhiskeySockets/Baileys` | MIT | 11.2k | 2026-09-27 | **sandbox/dev only** |
| `open-wa/wa-automate-nodejs` | "Other" (commercial session-key) | 3.7k | 2026-09-28 | **REJECT** |

**Baileys is licence-clean and technically capable — and still forbidden in production.**
It is a WhatsApp Web protocol client: using it against real customer traffic is a
platform-ToS violation with no SLA and ban exposure we would be selling. It earns its
place because the **dev path and the production path are the same code with a different
config value**, guarded by the E.164-normalised allowlist of numbers we own
(`ADR-001`, Gate 2). The accept test the spec already sets is the right one: a traffic run
under production config must show **zero** Baileys connections.

`open-wa` is rejected on two counts: licence is not a standard permissive identifier (a
commercial session-key model), and the same ToS exposure as Baileys with none of the
mitigation story.

### 5.5 P5 — Retrieval

| Candidate | Licence | Verdict |
|---|---|---|
| `pgvector/pgvector` | PostgreSQL licence | **PRIMARY** — Postgres is already in the stack for metering |
| `FlagOpen/FlagEmbedding` | MIT | **PRIMARY** — the reference implementation for bge-m3 / reranker |
| `BAAI/bge-m3` weights | **MIT** ✅ (HF API) | **v1 default** — 1024-dim, multilingual, native hybrid, 8k ctx |
| `Snowflake/snowflake-arctic-embed-l-v2.0` | **Apache-2.0** ✅ | **the drop-in upgrade** — same arch, same dims |
| `BAAI/bge-reranker-v2-m3` | **Apache-2.0** ✅ | v2 — over-engineering below 1,000 chunks |
| `jinaai/jina-embeddings-v3` | **CC-BY-NC-4.0** ⛔ | **REJECT — non-commercial** |

**Every licence claim in `RAG-FORK.md`'s model table was re-verified against the
HuggingFace registry API and all of them hold** (`bge-m3` MIT, arctic Apache-2.0,
Qwen3 Apache-2.0, e5 MIT, gte Apache-2.0, jina CC-BY-NC correctly rejected, reranker
Apache-2.0). No corrections needed there — that table is clean.

**Caveat on the "drop-in upgrade" claim:** bge-m3 and arctic-embed-l-v2.0 deploy
identically *as models*, but they are **different vector spaces**. Swapping one for the
other requires re-embedding the whole corpus. "Config swap" is true for deployment and
false for data — phrase it that way or the first swap will be a half-migrated index.

### 5.6 P6 / P7 — STT and TTS (gated, with slowing OSS fallbacks)

| Candidate | Licence | ★ | Last push | Note |
|---|---|---|---|---|
| Deepgram Nova streaming | commercial | — | — | **PRIMARY (live)** — FR language availability to confirm |
| ElevenLabs Scribe | commercial | — | — | **PRIMARY (batch)** — Realtime FR unverified |
| `SYSTRAN/faster-whisper` | MIT | 25.6k | **2025-11-19** | budget fallback; **~10 months since last push** |
| `openai/whisper-large-v3` weights | Apache-2.0 (HF API) | — | — | the weights behind the fallback |
| ElevenLabs Flash / Multilingual v2 | commercial | — | — | **PRIMARY** — the dominant cost line |
| `hexgrad/kokoro` | Apache-2.0 | 9.1k | **2025-08-06** | budget fallback; **~13 months since last push** |
| Azure Neural | commercial | — | — | margin-rescue tier |

#### ⚠️ Added 2026-09-28 — this pillar's framing was wrong. `sherpa-onnx` reframes it.

The table above treats "self-hosted" as a *budget fallback* whose projects are going stale.
That framing missed the engine that makes self-hosting viable on **CPU at pilot volume**:

| Candidate | Licence | ★ | Last push | FR STT | FR TTS | VAD | Score |
|---|---|---|---|---|---|---|---|
| **`k2-fsa/sherpa-onnx`** | **Apache-2.0** | 15.0k | 2026-09-22 | ✅ streaming `zipformer-fr-kroko` + NeMo/Canary FR | ✅ 13 FR Piper/VITS voices (`siwis-medium`, `upmc-medium`) | ✅ bundled | **9 — new primary for the self-hosted tier** |
| `SYSTRAN/faster-whisper` | MIT | 25.6k | 2025-11-19 | ✅ (multilingual) | — | — | 6 — kept, but superseded |
| `hexgrad/kokoro` | Apache-2.0 | 9.1k | 2025-08-06 | — | ✅ | — | 6 — **already servable *through* sherpa-onnx** |

Why the score is 9 rather than 6: it is **CPU-capable** (no GPU line item, which is what makes
self-hosting work at 200–600 min/month instead of only at scale), it covers STT **and** TTS
**and** VAD in one dependency, it has **both a Python and a Rust binding** (`sherpa-onnx/rust/`
→ `sherpa-onnx-sys` + safe wrapper; `rust-api-examples/`), and it is actively pushed. Both
projects it supersedes are permissive but quiet.

**Not a v1 change.** It is a `ProviderTier` candidate for Gate 5, gated on a real measurement —
see [`Optimizing Voice Agent Performance.md`](../voice/dev/PERFORMANCE.md)
§6.7: max concurrent calls at RTF < 1.0 on our 4-vCPU box.

**Momentum caveats the spec should carry.** Both OSS fallbacks are licence-clean and both
have gone quiet (`faster-whisper` ~10 months, `Kokoro-82M` ~13 months). They remain
correct fallbacks for a *budget tier*, but they are not projects to build a roadmap on,
and the plan should not assume upstream will absorb new language work. This does not
change the spec's choice — it changes the expectation attached to it.

## 6. Reject list (do not integrate)

| Candidate | Reason |
|---|---|
| `vocodedev/vocode-core` | Abandoned — last push 2024-11-15. *Not* a 404, contrary to the spec |
| `open-wa/wa-automate-nodejs` | Non-standard/commercial licence + production ToS exposure |
| `asterisk/asterisk` | GPLv2-family — cannot reach `agent-core` or any shipped artifact |
| `signalwire/freeswitch` | MPL-family, and self-hosting media is rejected for v1 on margin grounds (§5.3) |
| `jinaai/jina-embeddings-v3` | CC-BY-NC-4.0 — non-commercial; unacceptable for a paid client product |
| `ResembleAI/chatterbox` | **MIT** (HF API, re-verified 2026-09-28); 23 languages including `fr`, emotion control, ONNX-optimised. **The v1 self-hosted TTS default** — it is the fastest *commercially usable* open-weight French option once Voxtral TTS is disqualified. See [`OPEN-WEIGHT-SPEECH-VERIFIED.md`](../voice/dev/OPEN-WEIGHT-SPEECH-VERIFIED.md) |
| `hexgrad/Kokoro-82M` | Apache-2.0, but the HF card declares `language: ['en']` — the French voice is a separate per-language file. Budget/offline tier only until French is verified on our own audio |
| `mistralai/Voxtral-4B-TTS-2603` | **CC-BY-NC-4.0** (HF registry, 2026-09-28) — non-commercial. A third-party draft recommended self-hosting it as a cost measure while calling it commercially licensed; both the recommendation and the label are wrong (`Voxtral-Mini-3B-2507` / `-Small-24B-2507` **are** Apache-2.0, but those are ASR models, not TTS) |
| Edge TTS | Unofficial endpoint, gray ToS — already excluded in the spec; restated here |
| Self-hosted media server (any) | Not a licence reject — a **margin/ops** reject for v1 (§5.3) |

## 7. Adaptation blueprint — what Gate 1 acts on

1. **`services/agent-core/`** (new, outside `src-tauri`, not a Cargo member). `pyproject.toml`
   deps: `livekit-agents`, `fastapi`, `uvicorn`, `httpx`, `asyncpg`, `pytest`,
   `pytest-asyncio`. Pin the framework version explicitly — this is the one dependency
   whose API churn can invalidate the turn loop.
2. **Four seams** in `providers/base.py` (`LLMProvider`, `TTSProvider`, `STTProvider`,
   `EmbeddingProvider`) — async streaming ABCs. Impls: `openrouter.py`, `elevenlabs.py`,
   `deepgram.py`, `scribe.py`, `local_embed.py` (`ADR-001` D3).
3. **Port the pattern, not the code.** Read LiveKit's agent/session/turn shape, then write
   our own `orchestrator.py` types. No vendored LiveKit field names in our models; the
   `ChannelAdapter` boundary is ours.
4. **`tests/rag/retrieval_eval.py`** — 25–50 FR/EN question→expected-chunk pairs, pytest
   gate at **hit@3 ≥ 0.9**. This is what settles `bge-m3` vs `arctic-l-v2.0` empirically.
   Ship it in the same gate as the seam; a deferred eval becomes a deferred decision.
5. **Provider-swap test** — a second implementation of each seam swapping in by config
   value alone, with no code change. This is the proof the seam is real, and the Gate 1
   exit criterion.
6. **Attribution inventory** — `THIRD-PARTY-NOTICES` for the Apache-2.0 / BSD-2 / MIT deps
   that ship in the service (§3).

**Verification commands for the gate:**
```bash
cd services/agent-core && python -m pytest -q      # assert the SUMMARY LINE, not the exit code
cd services/agent-core && python -m pytest -q tests/rag/retrieval_eval.py
```
Gate 3 additionally: `cd src-tauri && cargo check --workspace` (workspace, not `-p`).

## 8. Unknowns — confirm, do not assume

| # | Unknown | Who settles it | Blocks |
|---|---|---|---|
| 1 | Deepgram Nova **FR** in the live streaming language list | vendor | Gate 4 |
| 2 | ElevenLabs Scribe **Realtime FR** availability | vendor | Gate 4 (voicemail path) |
| 3 | Telnyx media-stream **warm transfer** via SIP REFER or equivalent | vendor | **Gate 4 — no warm transfer ⇒ no v1** |
| 4 | Silero-VAD **weight** licence (code is MIT) | us | P2, if VAD is self-hosted |
| 5 | Meta: voicemail→owner message trigger direction and its €0 claim | vendor (BSP) | `COST-MODEL.md` sign-off |
| 6 | LiveKit Agents version to pin, and its telephony-media path stability | us, Gate 1 day 1 | Gate 1 |
| 7 | bge-m3 vs arctic — by eval, not leaderboard | us, Gate 1 | Gate 1 exit |
| 8 | **Max concurrent calls at RTF < 1.0** for sherpa-onnx ASR+TTS on our 4-vCPU VPS | us, Gate 5 entry | the `selfhosted` tier (§5.6) |