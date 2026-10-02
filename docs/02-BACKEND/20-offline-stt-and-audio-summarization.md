# Offline Voice — STT & TTS Engine Options, Architecture, and Open Stubs

> **Status:** 📐 **Options + architecture + decision** (2026-10-01). Consolidates the
> former `06-ROADMAP/18-offline-speech-engine-decision.md` brief — one doc, not two.
> **Related:** [Voice settings](../04-FEATURES/38-voice-settings.md) · [AI RAG](../04-FEATURES/ai-rag.md) · [Voice agent OSS landscape](../06-ROADMAP/15-voice-agent-oss-landscape.md) · [Topology decision](../06-ROADMAP/17-voice-agent-topology-decision.md) · [Self-hosting](../voice/dev/SELF-HOSTING.md) · [ADR-001](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md)
> **Companion:** [Document & email extraction](./19-document-and-email-extraction.md)

## 1. Why this doc exists

Three pieces of prior work each assumed a different offline speech engine, and nobody
reconciled them:

| Doc                                                                          | Assumed engine                               | Scope it covered                            |
| ---------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| [SELF-HOSTING](../voice/dev/SELF-HOSTING.md) §2                              | **sherpa-onnx**                              | VPS-side budget tier for live calls         |
| [17-topology-decision](../06-ROADMAP/17-voice-agent-topology-decision.md) §3 | **sherpa-onnx** (Rust binding, in a sidecar) | Desktop local tier for the voice agent      |
| an earlier draft of this doc                                                 | **candle whisper**                           | Desktop batch STT for the mail/AI assistant |

The topology doc and SELF-HOSTING agree on sherpa-onnx; this doc was the outlier. §3
resolves it. This doc also carries the **product framing**, the **stub inventory** and
the **verified locale matrix** — and, since 2026-10-01, the **capability decomposition**
that previously lived in a duplicate brief.

It covers **TTS**, not just STT: per [SELF-HOSTING](../voice/dev/SELF-HOSTING.md) §2,
**TTS is 88% of variable voice cost**, so an offline STT-only plan optimises the cheap half.

## 1.1 What "offline speech" must cover

Do not treat these as one requirement — they have different latency budgets and therefore
potentially different engines:

| #   | Capability                                        | Latency budget  | Used by                                                            |
| --- | ------------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| C1  | **Batch STT** — transcribe a recorded file        | seconds–minutes | Mail/AI assistant: voice notes, audio attachments, call recordings |
| C2  | **Batch TTS** — speak text aloud                  | seconds         | "Listen to this summary"                                           |
| C3  | **Live streaming STT** — transcribe during a call | < 300 ms        | Voice agent (VPS side, P6)                                         |
| C4  | **VAD** — detect speech boundaries                | ms              | Both batch (chunking) and live (turn detection)                    |
| C5  | **Diarization** — who spoke when                  | batch           | Call digests                                                       |
| C6  | **Realtime bidirectional voice**                  | < 300 ms        | `RealtimeVoiceCapable` (implemented by nobody)                     |

**C1 + C2 + C5 are the desktop/offline scope of this doc.** C3/C6 stay with the
voice-agent work — see §7.

## 2. Verified current state (read from source, 2026-10-01)

### 2.1 What works, what throws

| Provider     | STT       | TTS       | Reality                                                       |
| ------------ | --------- | --------- | ------------------------------------------------------------- |
| `browser`    | ❌ throws | ✅ real   | TTS via `window.speechSynthesis`; STT is a `TODO` that throws |
| `openai`     | ✅ real   | ✅ real   | `fetch` → `/audio/transcriptions`, `/audio/speech`            |
| `custom`     | ✅ real   | ✅ real   | Same OpenAI-compatible `fetch` path                           |
| `lmstudio`   | ✅ real   | ✅ real   | Same path against a local server                              |
| `elevenlabs` | ❌ throws | ❌ throws | **No implementation at all**                                  |
| `agent-core` | ❌ throws | ❌ throws | **No implementation at all**                                  |

**Working STT today = 3 providers, all requiring either an API key (`openai`) or a
user-installed local server (`lmstudio`/`custom`).** There is **no** zero-config
offline STT. The one zero-config provider (`browser`) has STT explicitly disabled.

### 2.2 The five stubs (exact locations)

| File:line                 | Stub                                 | Impact                                   |
| ------------------------- | ------------------------------------ | ---------------------------------------- |
| `voiceService.ts:156-157` | `ElevenLabs TTS not yet implemented` | Provider selectable in UI, throws on use |
| `voiceService.ts:159-160` | `Agent-core TTS not yet implemented` | Same                                     |
| `voiceService.ts:175-176` | `Browser STT not yet implemented`    | The only zero-config STT path is dead    |
| `voiceService.ts:182-183` | `ElevenLabs STT not yet implemented` | Same                                     |
| `voiceService.ts:185-186` | `Agent-core STT not yet implemented` | Same                                     |

### 2.3 The capability-detection bug

`getVoiceCapabilities()` **reports capabilities that do not exist**:

| Provider     | `getVoiceCapabilities` says | Truth          | Verdict                                     |
| ------------ | --------------------------- | -------------- | ------------------------------------------- |
| `elevenlabs` | `{ stt: false, tts: true }` | TTS **throws** | ⚠️ UI shows a green ✓ TTS badge for a stub  |
| `agent-core` | `{ stt: true, tts: true }`  | Both **throw** | ⚠️ Reports full capability, implements none |
| `browser`    | `{ stt: false, tts: ... }`  | Honest         | ✅                                          |

Doc [38-voice-settings](../04-FEATURES/38-voice-settings.md) §"Desktop Voice vs Python
Agent-Core" already admits agent-core is a stub — but the **UI badge still lies**,
because the badge is driven by this function. A user selects ElevenLabs, sees
"✓ TTS", and gets a thrown error.

### 2.4 Provider-level STT/TTS (separate from voiceService)

All 10 AI providers declare `transcribe`/`synthesize`. Nine of them implement them as
**honest refusals** — `throw new Error('STT not supported by this provider')` (claude,
ollama, copilot, openrouter, …). That is correct behaviour, not a stub: the capability
interface is satisfied, and the refusal is truthful. Only `openai`/`lmstudio`/`custom`/
`gemini`/`mistral`/`byteplus` route to real transports.

### 2.5 Model registry

`modelRegistry.ts` lists `whisper-1`, `gpt-4o-transcribe`, `tts-1`, `gpt-4o-mini-tts`
with `stt: true` / `tts: true`. **All four are cloud (OpenAI).** No local speech model
is registered. `ModelCapabilities` already has `stt?`, `tts?`, `realtime?` fields, so
registering local models needs **no type change**.

## 3. Engine options — and the reconciliation

### 3.1 The contradiction

| Source                                                                       | Says                                                                                                                                 | Scope                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| [17-topology-decision](../06-ROADMAP/17-voice-agent-topology-decision.md) §3 | **sherpa-onnx** in a Tauri sidecar; "the repo already runs `ml-sidecar` over JSON-RPC — the pattern is proven here. RTF < 1 offline" | the **voice-agent** local tier       |
| [SELF-HOSTING](../voice/dev/SELF-HOSTING.md) §2                              | **sherpa-onnx**; Apache-2.0, Rust bindings, bundles STT + TTS + VAD + diarization                                                    | the **voice-agent** self-hosted tier |
| earlier draft of this doc                                                    | candle `whisper`                                                                                                                     | the **desktop assistant** STT        |

**These are not actually in conflict once scope is separated** — but the earlier draft
was wrong to propose a _second_ engine without acknowledging the first. Resolution:

> **One engine, two scopes.** `sherpa-onnx` is the engine for speech in both the
> desktop assistant and the voice-agent local tier. Do not introduce candle whisper as
> a parallel speech stack.

### 3.2 Why sherpa-onnx wins

| Criterion               | sherpa-onnx                | candle `whisper`           | `whisper-rs` | `ort` (ONNX RT) |
| ----------------------- | -------------------------- | -------------------------- | ------------ | --------------- |
| STT                     | ✅ streaming + offline     | ⚠️ offline only            | ✅ offline   | ✅              |
| **TTS**                 | ✅ **VITS/Piper voices**   | ❌ none                    | ❌ none      | ✅              |
| **VAD**                 | ✅ built in                | ❌                         | ❌           | ⚠️ manual       |
| **Diarization**         | ✅ built in                | ❌                         | ❌           | ❌              |
| Rust bindings           | ✅ `sherpa-onnx-sys`       | ✅ (in-tree)               | ✅           | ✅              |
| Crate downloads         | 481k                       | 3.9M (candle-transformers) | 1.38M        | 20.3M           |
| Licence                 | Apache-2.0                 | Apache-2.0                 | MIT          | MIT             |
| Already documented here | ✅ topology + SELF-HOSTING | ❌                         | ❌           | ❌              |

**The decisive column is TTS.** Candle's whisper gives STT only — and TTS is 88% of the
voice cost. Choosing candle would mean adding a _second_ engine later for TTS. sherpa-onnx
covers STT + TTS + VAD + diarization behind one Rust binding, which is exactly the shape
`ml-sidecar` already exposes over JSON-RPC.

**Verified French coverage** (from SELF-HOSTING §2, HF registry 2026-09-28):

| Direction | Model                                                             | Kind                      |
| --------- | ----------------------------------------------------------------- | ------------------------- |
| STT       | `sherpa-onnx-streaming-zipformer-fr-kroko-2025-08-06`             | streaming (live calls)    |
| STT       | `sherpa-onnx-nemo-canary-180m-flash-en-es-de-fr` (+int8)          | offline, 4 langs incl. FR |
| STT       | `sherpa-onnx-nemo-ctc-fr-conformer-large`                         | offline, FR-only          |
| TTS       | `vits-piper-fr_FR-siwis-medium`, `-upmc-medium`, `-gilles-low`, … | 13 FR voices              |

### 3.2.1 Locale coverage — verified 2026-10-01 (HF API)

The app ships `en, fr, ar, ja, it`. French was verified in SELF-HOSTING; the other four
were checked directly against the HF model registry on 2026-10-01:

| Locale | STT | TTS              | Evidence                                                                                                                                                                                                                                      |
| ------ | --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **en** | ✅  | ✅               | Many (`whisper`, `nemo-canary`, `sense-voice`)                                                                                                                                                                                                |
| **fr** | ✅  | ✅               | 13 Piper voices (SELF-HOSTING §2)                                                                                                                                                                                                             |
| **ar** | ✅  | ✅               | STT: `streaming-zipformer-ar_en_id_ja_ru_th_vi_zh`, `stt_ar_fastconformer_hybrid_large_pc`, `whisper-large-v3-turbo-arabic-dialectal-v2` · TTS: **6+ Piper voices** (`vits-piper-ar_JO-kareem-low/medium`, `ar_JO-SA_miro-high`, `-dii-high`) |
| **it** | ✅  | ✅               | STT: `streaming-zipformer-it-kroko-2025-08-06`, `nemo-fast-conformer-…-it-…`, `whisper-distil-large-v3-it` · TTS: `vits-piper-it_IT-paolina-medium`, `-riccardo-x_low`, `-miro-high`, `-dii-high`                                             |
| **ja** | ✅  | ⚠️ **not found** | STT: `sense-voice-zh-en-ja-ko-yue`, `nemo-parakeet-tdt_ctc-0.6b-ja` · TTS: **no `vits-piper-ja_JP` found**                                                                                                                                    |

**Good news vs. the earlier draft:** Arabic — the hardest and most business-critical
locale for DGI — has **both** STT and multiple TTS voices. The earlier "Arabic
unverified" flag is withdrawn.

**One real gap:** **Japanese TTS has no Piper/VITS voice** in the sherpa-onnx ecosystem.
Japanese TTS would need a different engine (e.g. MeloTTS or a cloud provider) or must be
marked unavailable. Japanese STT is fine.

⚠️ Model availability is a **per-device capability** — never assume a model is installed
(`FRONTEND.md` §3.2, `Capabilities`).

### 3.3 What about the browser?

`browser` STT is a `TODO`, but the Web Speech API _does_ expose `SpeechRecognition` on
Chromium. Two reasons it is still the wrong default: support is inconsistent across
webviews/platforms, and it is **not verifiably offline** on every platform. Keep it as
a convenience fallback, not the offline answer.

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ React 19 — VoiceSettings / assistant / attachments               │
│   voiceService.ts  ← the single seam (extended, not replaced)    │
└───────────┬──────────────────────────────┬───────────────────────┘
            │ cloud providers               │ offline engine
            ▼                               ▼
  openai / custom / lmstudio        ml-sidecar (EXISTING process)
  (fetch, already working)           + NEW methods:
                                       • transcribe  (sherpa-onnx STT)
                                       • synthesize  (sherpa-onnx TTS)
                                       • vad / diarize (later)
                                     JSON-RPC over stdin/stdout
                                     model files via hf-hub + resumable
                                     downloader (already built)
```

**Three deliberate reuse points — no new pipeline is invented:**

| Concern        | Reuse                                       | Why not new                                                                         |
| -------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Transport      | `ml-sidecar` JSON-RPC (20 methods today)    | Proven; same lifecycle the orchestrator already manages                             |
| Model delivery | `hf-hub` + the resumable chunked downloader | Already handles multi-hundred-MB model files                                        |
| Frontend seam  | `voiceService.ts`                           | Already the single STT/TTS entry point; extend the switch, don't add a parallel API |

**New voice provider value:** `offline` (alongside `browser`/`openai`/…), so
`VoiceProviderType` gains one member and `getVoiceCapabilities` gains one honest case.

### 4.1 The self-hosted tier boundary

Per [topology §6](../06-ROADMAP/17-voice-agent-topology-decision.md), keys live on the
desktop for the self-hosted tier. Offline speech is a **desktop capability** — nothing
crosses the network, no key exists. That is the cleanest possible position and it is
worth stating in the UI.

## 5. Recommended sequence

| Phase  | Work                                                                                                                      | Effort | Deliverable                              | Status                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------- | ----------------------------- |
| **0**  | **Fix the lying badges.** `getVoiceCapabilities` must reflect reality (or the stubs must be marked unavailable in the UI) | S      | No more "✓ TTS" on a throwing provider   | ✅ **Done**                   |
| **0b** | Fix `ai/parser.rs::parse_docx` stub + stop silently skipping empty extractions                                            | S      | DOCX indexes real text; skips are logged | ✅ **Done**                   |
| **1**  | Add `sherpa-onnx` + `sherpa-onnx-sys` to `ml-sidecar`; `transcribe` method                                                | M      | **Offline STT, no key, no server**       | ✅ **Verified end-to-end** (RTF 0.033, 99.8%) |
| **2**  | `synthesize` method (Piper/VITS voice)                                                                                    | M      | **Offline TTS** — the 88%-cost half      | ✅ **Verified end-to-end** (FR, RTF 0.573) |
| **3**  | `offline` provider in `voiceService` + VoiceSettings UI                                                                   | S      | User-selectable, zero-config             | ⬜                            |
| **4**  | Register local speech models in `modelRegistry` (`stt`/`tts` flags already exist)                                         | S      | Models appear in the existing UI         | ⬜                            |
| **5**  | Implement the `elevenlabs` TTS stub (cloud, but currently dead)                                                           | S      | Provider stops throwing                  | ⬜                            |
| **6**  | VAD/diarization for call recordings                                                                                       | L      | "Who said what" in digests               | ⬜                            |

**Phase 0 is not optional.** Shipping an offline engine behind a UI that already
misreports capabilities makes the confusion worse, not better.

### Phase 1 — what was written, and what is still unproven (2026-10-01)

**Written** (`src-tauri/crates/ml-sidecar/`, behind the new optional `offline-speech` feature):

| Piece                                                                 | File          | Notes                                                                                                                    |
| --------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `SttEngine` over `sherpa_onnx::OfflineRecognizer`                     | `src/stt.rs`  | Validates all four model files up front and names the missing one; empty transcript is a legitimate result, not an error |
| `load_stt_model` / `transcribe` / `unload_stt_model` JSON-RPC methods | `src/main.rs` | `transcribe` takes 16 kHz mono f32 samples — audio-container decoding stays app-side                                     |
| STT in `list_models`                                                  | `src/main.rs` | Lets a caller distinguish "feature not built" from "built, no model loaded"                                              |

The API was written against the **real docs.rs signatures**, not guessed:
`OfflineRecognizer::create(&config) -> Option<Self>`, `decode(&self, &OfflineStream)`,
`OfflineStream::accept_waveform(&self, i32, &[f32])`, `get_result() -> Option<OfflineRecognizerResult>`.

**Verified:** the default build (`cargo check -p ml-sidecar`, feature **off**) is `EXIT=0` — the
default `local-ai` build is unaffected.

**NOT verified — and this is a new, concrete finding:**

`sherpa-onnx-sys` does **not** build onnxruntime from source. Its `build.rs` **downloads a
prebuilt archive** from GitHub releases. That download failed on this host with the same TLS
fault seen throughout the session:

```
Downloading sherpa-onnx libs from .../v1.13.8/sherpa-onnx-v1.13.8-win-x64-static-MT-Release-lib.tar.bz2
thread 'main' panicked at sherpa-onnx-sys-1.13.8/build.rs:42:9: cannot decrypt peer's message
```

This is **the network, not the code** — the same `SEC_E_DECRYPT_FAILURE` class of failure.
It also **corrects §10's earlier assumption**: the concern was "builds onnxruntime from source
(needs cmake + C++ toolchain)"; the reality is a ~100 MB download, which is _easier_ to build
but _harder_ on a flaky link.

**Workaround (documented, not yet executed):** `build.rs` honours two env vars that bypass the
download entirely —

| Env var                   | Effect                                                            |
| ------------------------- | ----------------------------------------------------------------- |
| `SHERPA_ONNX_ARCHIVE_DIR` | Directory containing the expected archive; skips the download     |
| `SHERPA_ONNX_LIB_DIR`     | Point directly at extracted libs; skips both download and extract |

**Also a real constraint:** disk was at **99% (3.3 GB free)** during the attempt. This build
needs several GB, and the same condition already corrupted the cargo cache once this session.

**Conclusion:** Phase 1 is _written_ and **now proven to compile on this host** — see the
resolution below.

#### Resolution (2026-10-01, same session)

The blocker was cleared and the feature **compiles**:

| Step                                                  | Result                                                                                                                                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Download the archive                                  | ✅ via **parallel range requests** (8 chunks) — the single-connection download died at 10 MB and again at 63 MB (`EXIT=56`, connection closed); 8 parallel ranges completed it to the exact byte count (123,206,268) |
| Verify integrity                                      | ✅ `bzip2 -t` passes; contains `onnxruntime.lib`                                                                                                                                                                     |
| Point `SHERPA_ONNX_ARCHIVE_DIR` at it                 | ✅ build.rs used it and **skipped the download entirely**                                                                                                                                                            |
| `cargo check -p ml-sidecar --features offline-speech` | ✅ **EXIT=0**                                                                                                                                                                                                        |
| `cargo check -p ml-sidecar` (feature off)             | ✅ **EXIT=0** — default build unaffected                                                                                                                                                                             |

One real compile error was found and fixed in the process: `OfflineModelConfig.model_type`
is `Option<String>`, not `String` (the compiler named it exactly).

**So the engine is reachable.** What is *still* not done: no ONNX model has been downloaded
or run, so there is **no RTF measurement and no transcription has actually happened**. The
scaffolding compiles; the capability is unproven.

#### End-to-end verification — MEASURED (2026-10-01)

That gap is now closed. A real model was downloaded and a real transcription was run:

| Item | Value |
| --- | --- |
| Model | `csukuangfj/sherpa-onnx-zipformer-small-en-2023-06-26` (int8 transducer) |
| Model size | ~29 MB total (encoder 26.0 MB, decoder 1.3 MB, joiner 0.26 MB, tokens 5 KB) |
| Harness | `crates/ml-sidecar/examples/stt_smoke.rs` (run manually; needs a model on disk) |
| Audio | the model's own `test_wavs/1.wav` (16.7 s, 16 kHz) |
| **Load time** | measured and printed by the harness |
| **Decode time** | **0.482 s** |
| **RTF** | **0.029** — ~34× faster than real time |
| **Accuracy** | **0.998 similarity** vs the repo's published `trans.txt` |

The single difference from ground truth was `FOR EVER` → `FOREVER` — a whitespace
normalisation artefact, not a recognition error.

**Interpretation, carefully:** RTF 0.029 is comfortably below the `< 1.0` gate in
SELF-HOSTING §2.1, on this host, for a *small English* model at batch latency. It does **not**
transfer to: the streaming French model, the larger multilingual models, a loaded VPS, or
concurrent calls. It is one real data point, not a general claim.

**Still unverified:** any non-English locale end-to-end (the locale matrix in §3.2.1 is model
*existence*, not measured quality), and TTS entirely.

#### Phase 2 verification — offline TTS MEASURED (2026-10-01)

| Item | Value |
| --- | --- |
| Voice | `csukuangfj/vits-piper-fr_FR-siwis-medium` (VITS/Piper, French) |
| Voice size | ~81 MB (model 63.2 MB + `espeak-ng-data/` 18 MB) |
| Harness | `crates/ml-sidecar/examples/tts_smoke.rs` |
| Text | *"Bonjour, ceci est un test de synthèse vocale hors ligne pour la facturation."* (76 chars) |
| **Load time** | 3049 ms (2 threads) |
| **Synth time** | **2.489 s** for 4.35 s of audio |
| **RTF** | **0.573** — ~1.7× faster than real time |
| Output | 95,813 samples @ 22050 Hz, mono 16-bit WAV, peak 0.52, RMS 0.0996 |
| **Throughput** | 17 chars/sec of audio; 31 chars/sec of compute |

**Interpretation, carefully:** RTF 0.573 clears the `< 1.0` gate, but with far less headroom
than STT's 0.033. Local TTS is viable for *batch* generation (reading an invoice aloud,
summarising a thread) and marginal for live conversational use, where 0.573 plus STT plus
network would approach real time. The `medium` voice is also the slow end — `low` voices
exist for exactly this trade-off. **Measure a `low` voice before committing to live calls.**

**A real integration pitfall, found by running it:** the first attempt failed with
`Failed to phonemize ... Failed to set eSpeak-ng voice`. The cause was downloading a
hand-picked subset of `espeak-ng-data/`. That directory is **355 files** (18 MB) and includes
`lang/roa/fr` — the voice *definition*. Without it Piper cannot phonemise at all. **Vendors
must ship the complete `espeak-ng-data/` directory, not a subset.** This is the single most
likely thing to break a naive packaging attempt.

**Still not machine-verified:** intelligibility. The harness confirms non-silent audio of the
right rate and duration; whether the French *sounds* correct is a human judgement. The WAV is
written to disk (`fr_siwis_smoke.wav`) for listening.

**Practical note for CI/other machines:** `sherpa-onnx-sys` will try to download 117 MB at
build time. On a flaky link, pre-fetch the archive (parallel ranges work) and set
`SHERPA_ONNX_ARCHIVE_DIR`. The archive for this host is cached at
`~/AppData/Local/hermes/cache/sherpa/archive/`.

### Phase 0 + 0b — what shipped (2026-10-01)

| Change                                                                                                                         | File                                     | Verified                                |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | --------------------------------------- |
| `getVoiceCapabilities` reports `{stt:false,tts:false}` for `elevenlabs` and `agent-core` instead of advertising throwing stubs | `src/shared/services/ai/voiceService.ts` | ✅ 6/6 tests; reverting the fix fails 2 |
| `parse_docx` returns real DOCX text instead of `"DOCX content extraction placeholder"`                                         | `src-tauri/src/ai/parser.rs`             | ✅ compiles                             |
| Empty extractions and parse errors are **logged** instead of silently skipped (attachments + vault)                            | `src-tauri/src/ai/indexer.rs`            | ✅ compiles                             |

⚠️ The previous test suite **asserted the bug** (`expect(caps.stt).toBe(true)` for
`agent-core`), so it was corrected alongside the fix. The replacement tests fail if the
over-reporting is reintroduced.

## 6. Risks

| Risk                                         | Severity | Mitigation                                                                             |
| -------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| **Japanese TTS: no Piper/VITS voice exists** | Medium   | §3.2.1 — Japanese STT is fine; TTS needs another engine or is marked unavailable       |
| Model size vs. offline-first promise         | Medium   | Reuse the resumable downloader; show size before download; per-device capability check |
| CPU RTF on low-end hardware                  | Medium   | SELF-HOSTING §2.1 gate: measure RTF < 1.0 before promising it                          |
| Two engines drift (sherpa + candle)          | Medium   | §3.1: one engine for speech; candle stays for embeddings only                          |
| UI claims capability the build lacks         | **High** | Phase 0                                                                                |
| Scope creep into live/streaming calls        | Medium   | §7 — batch desktop STT is separate from voice-agent P6                                 |

## 7. Relationship to the voice-agent work (do not conflate)

|                | Voice-agent **P6** (live)                                                                   | **This doc** (batch) |
| -------------- | ------------------------------------------------------------------------------------------- | -------------------- |
| Latency budget | < 300 ms                                                                                    | seconds–minutes      |
| Engine         | Deepgram (commercial, per [15-landscape](../06-ROADMAP/15-voice-agent-oss-landscape.md) §2) | sherpa-onnx (local)  |
| Runs on        | VPS                                                                                         | desktop              |
| Trigger        | during a call                                                                               | after the fact       |

The landscape doc classifies P6 as _"⛔ live / ⚠️ OSS batch"_ and [SELF-HOSTING](../voice/dev/SELF-HOSTING.md)
§7 keeps self-hosted inference as a **Gate 5 candidate gated on an RTF measurement**.
This doc **does not change those decisions.** Batch desktop STT ships independently and
delivers "listen/summarize" value without waiting on the carrier or the streaming work.

## 8. Acceptance criteria (proposed)

- [x] No provider shows a capability badge for a code path that throws ✅ _(Phase 0)_
- [ ] An audio file transcribes with **no API key and no external server**
- [ ] Model is multilingual for the shipped locales; **Japanese TTS** gap decided and documented
- [ ] TTS renders locally (Piper/VITS), not only via a cloud API
- [ ] Local speech models are registered in `modelRegistry` and selectable in the UI
- [ ] Transcription emits progress and never freezes the UI
- [ ] The voice-agent P6 / Gate 5 decisions are untouched
- [ ] `browser` STT is either implemented or explicitly marked unavailable

## 9. "Listen / summarize long things" (the user-facing goal)

The product value behind offline STT. Scope it as **one** feature with two outputs:

| Input                         | Summarize                      | Listen                   |
| ----------------------------- | ------------------------------ | ------------------------ |
| Long email thread             | ✅ summary card in thread view | ✅ TTS reads the summary |
| Call recording                | ✅ post-call digest            | ✅                       |
| Voice note / audio attachment | ✅ transcript + summary        | ✅                       |
| Any RAG document              | ✅ via existing retrieval      | ✅                       |

**Design rules:**

1. **Summarize first, then speak the summary** — never read a raw 3,000-word thread aloud.
   Also where the token cost lives, so it should be one LLM pass.
2. **Store and index the transcript** → audio becomes RAG-searchable. That is the
   compounding win, and it reuses `index_all_attachments`.
3. **Chunk long audio** with overlap to avoid boundary word loss.
4. **Never block the UI** — emit progress events (the `ai:indexing_started` pattern
   already exists).
5. **Summarization must be able to run fully locally** — respect the local/cloud split.

## Appendix: HF Spaces survey (audio)

Surveyed 2026-10-01. Audio entries were mostly **model demos**, which is what informs
model choice:

| Space                         | Relevance                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `openai/whisper`              | Reference transcribe/translate behaviour                                               |
| `nvidia/nemotron-diarization` | **Speaker diarization** — "who said what" in a call digest. Relevant _after_ basic STT |

**Sourcing rule:** Spaces inform _model selection_, never runtime dependencies. The app
runs models locally (sherpa-onnx in the sidecar); it must not call a Space over the network.

## 10. What is NOT verified

Kept deliberately, so nobody reads the plan above as measured fact:

- **sherpa-onnx was not built or benchmarked on this host.** The crate exists with Rust
  bindings (checked on crates.io 2026-10-01: `sherpa-onnx` 1.13.8, ~481k downloads);
  **no RTF figure here is ours.**
- **No ONNX model has been downloaded or run.** Model _existence_ was verified via the HF
  API; model _behaviour_ was not.
- **Whisper multilingual quality per locale was not measured.**
- **The `ort` crate's version could not be read** from the crates.io API (returned null),
  so any dependency-footprint claim is directional, not a pinned size.
- **onnxruntime footprint on the smallest supported desktop** is unmeasured — it is a real
  new dependency (the repo has none today).
- **SELF-HOSTING §2.1's RTF gate is still open** for the voice-agent tier, and it is the
  same measurement this doc needs before promising offline speech on low-end hardware.

## 11. Decision log

| Question                                                | Answer                                                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Engine for offline speech?                              | **sherpa-onnx**, Rust binding, inside the existing `ml-sidecar` (§3)                                                          |
| One engine or two?                                      | **One.** Candle stays for embeddings only; do not add a second speech stack                                                   |
| Is the engine implemented yet?                          | **No.** Phase 1 is the first real step; §10 lists what is unmeasured                                                          |
| Does this change the voice-agent P6 / Gate 5 decisions? | **No** (§7)                                                                                                                   |
| Is a candle-whisper spike still wanted?                 | Optional as a _throwaway_ proof that batch STT works on this host — **not** a destination, and never shipped alongside sherpa |
