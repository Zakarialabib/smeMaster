# Offline STT & Audio Summarization — Local Transcription and "Listen/Summarize" for Long Content

> **Status:** 📐 **Proposal / spike brief** (2026-10-01) — no code written yet.
> **Related:** [Voice settings](../04-FEATURES/38-voice-settings.md) · [AI RAG (feature)](../04-FEATURES/ai-rag.md) · [Voice agent OSS landscape](../06-ROADMAP/15-voice-agent-oss-landscape.md) · [Voice agent ADR-001](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md)
> **Companion doc:** [Document & email extraction](./19-document-and-email-extraction.md)

## 1. Goal

Two user-facing capabilities, one shared engine:

1. **Offline STT** — transcribe audio on-device, with no API key and no data leaving
   the machine. Today every STT path is either cloud (`openai` / `whisper-1`) or an
   external local server the user must run themselves (`lmstudio`).
2. **Listen / summarize long things** — take a long artifact (a long email thread, a
   call recording, a voice note, a meeting) and produce either a spoken rendition or
   a summary, so the user can absorb it without reading.

The second is the product value; the first is the enabler. They should share one
transcription engine, not grow two.

## 2. Verified current state (read from source, 2026-10-01)

| Component         | Path                                                 | Reality                                                                                               |
| ----------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Voice config      | `src/shared/services/ai/voiceService.ts`             | `sttModel: 'whisper-1'` default — a **cloud** model id                                                |
| Voice settings UI | `src/features/settings/components/VoiceSettings.tsx` | Provider selector + STT/TTS capability badges                                                         |
| Voice providers   | `voiceService.ts`                                    | `browser` (Web Speech, TTS-only), `openai`, `elevenlabs` (TTS), `lmstudio`, `custom`, `agent-core`    |
| Browser STT       | `getVoiceCapabilities()`                             | `case 'browser': return { stt: false, tts: ... }` — **STT is hard-disabled** for the zero-config path |
| Model registry    | `src/shared/services/ai/modelRegistry.ts`            | Lists `whisper-1`, `gpt-4o-transcribe` — both **cloud**                                               |
| Sidecar           | `src-tauri/crates/ml-sidecar/src/main.rs`            | 20 methods; **no audio/transcription method**                                                         |
| candle            | `candle-transformers 0.8.3`                          | **`whisper` module is vendored** — already available                                                  |
| Summarization     | —                                                    | No generic "summarize this" service; `categorizationManager` / `askInbox` are mail-scoped             |

**Key finding:** the only fully-offline, zero-config STT path is _disabled in code_
(`browser` returns `stt: false`), and every enabled path needs either a key or a
server the user must install. Meanwhile the `whisper` model implementation is
**already vendored** in an existing dependency.

## 3. Why candle `whisper` (and not something else)

| Option                          | Offline    | New dep            | Notes                                                                                                    |
| ------------------------------- | ---------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| **candle `whisper`** (sidecar)  | ✅         | ❌ none — vendored | Same runtime as the existing BGE embeddings; one sidecar, one lifecycle                                  |
| `whisper.cpp` via shell sidecar | ✅         | new binary + IPC   | Fast, but a second native process to package/sign per platform                                           |
| `ort` (ONNX Runtime)            | ✅         | new heavy dep      | Would also unlock PaddleOCR — but a big new surface                                                      |
| Web Speech API                  | ⚠️ partial | none               | Already wired for TTS; STT quality/support varies by webview, and it is not truly local on all platforms |
| Cloud (`whisper-1`)             | ❌         | none               | **Keep as an option, not the default** — it is what exists today                                         |

**Decision: implement STT in the existing `ml-sidecar` using the vendored candle
`whisper`.** Rationale: the sidecar already exists, already has a model-download
story (HF Hub + the resumable downloader), already has a lifecycle managed by the
orchestrator, and adds **no new dependency**. This mirrors the BGE embedding decision
(D1 in [ai-rag](../04-FEATURES/ai-rag.md)) — local model, lazy-loaded, same plumbing.

### Model choice

Use **multilingual** Whisper, not `.en`. Locales are `en, fr, ar, ja, it`; a `.en`
model would be a silent regression for four of five. `whisper-small` multilingual is
the sensible default (~240 MB, CPU-viable); `base` for low-end devices.

## 4. Architecture

```
                     ┌─────────────────────────────────────┐
  audio file ───────►│  ml-sidecar (existing process)       │
  (voice note,       │  + NEW: "transcribe" method          │
   call recording,   │    candle-transformers::whisper      │
   attachment)       │    lazy-load, multilingual           │
                     └──────────────┬──────────────────────┘
                                    │ transcript
                                    ▼
              ┌────────────────────────────────────────────┐
              │  Existing AI service layer                  │
              │  aiService / taskRouter / RAG               │
              │  → summarize (provider or local)            │
              │  → index transcript into LanceDB            │
              │  → speak via existing TTS (voiceService)    │
              └────────────────────────────────────────────┘
```

Three reuse points — **no new pipeline is invented**:

- **Transcription** extends the sidecar's method table (21st method).
- **Summarization** reuses `taskRouter` / `aiService` and the existing provider layer.
  Summaries are a _task_, not a new subsystem — this is exactly what
  [14-ai-task-router](../02-BACKEND/14-ai-task-router.md) exists for.
- **Listen** reuses `voiceService`'s existing TTS providers (browser / OpenAI /
  ElevenLabs).

## 5. The "listen or summarize long things" feature

**Scope it as one feature with two outputs, not two features.**

| Input                         | Summarize                          | Listen                   |
| ----------------------------- | ---------------------------------- | ------------------------ |
| Long email thread             | ✅ summary card in the thread view | ✅ TTS reads the summary |
| Call recording (voice agent)  | ✅ post-call digest                | ✅                       |
| Voice note / audio attachment | ✅ transcript + summary            | ✅                       |
| Any document already in RAG   | ✅ via existing retrieval          | ✅                       |

**Design rules:**

1. **Summarize first, then speak the summary** — not the raw transcript. Reading a
   3,000-word thread aloud is not a feature, it is a punishment. This is also where
   the token cost lives, so it should be one LLM pass.
2. **Transcript is stored and indexed**, so the content becomes RAG-searchable. This
   is the compounding win: a call recording becomes retrievable knowledge.
3. **Chunk long audio.** Whisper is trained on 30-second windows; candle's
   implementation handles longer input, but a multi-hour recording needs chunking +
   stitching with overlap to avoid boundary word loss. Budget for it.
4. **Never block the UI.** Transcription is slow on CPU — run it in the sidecar and
   emit progress events (the pattern already exists: `ai:indexing_started` /
   `ai:indexing_completed`).

## 6. Relationship to the voice-agent work

`docs/06-ROADMAP/15-voice-agent-oss-landscape.md` (verified 2026-09-28) classifies
**P6 STT** as _"⛔ live / ⚠️ OSS batch — Commercial Deepgram streaming; OSS
(faster-whisper) is the budget fallback"_.

That analysis is about **live, streaming, in-call** STT, where latency is
conversational. This proposal is **batch** STT, where latency is tolerated. They are
different requirements and should not be conflated:

|                | Live (P6, voice agent) | Batch (this doc)                 |
| -------------- | ---------------------- | -------------------------------- |
| Latency budget | < 300 ms               | seconds–minutes                  |
| Engine         | Deepgram (commercial)  | candle whisper (local)           |
| Trigger        | during a call          | after the fact                   |
| Output         | streaming transcript   | transcript + summary + RAG entry |

**Conclusion:** this work does **not** change the P6 decision. Batch STT is additive,
ships independently, and delivers the "listen/summarize" value without waiting on the
carrier/streaming work. Do not fold it into the voice-agent critical path.

## 7. Recommended sequence

| Phase | Work                                                                                      | Effort |
| ----- | ----------------------------------------------------------------------------------------- | ------ |
| **1** | Sidecar `transcribe` method via candle whisper (multilingual, lazy-load, progress events) | M      |
| **2** | Voice settings: add an `offline` STT provider; stop hard-disabling local STT              | S      |
| **3** | Summarize task in `taskRouter` + a `summarizeTranscript()` service                        | S      |
| **4** | UI: summarize/listen affordance on long threads + audio attachments                       | M      |
| **5** | Index transcripts into LanceDB so audio becomes RAG-searchable                            | S      |
| **6** | Chunked long-audio transcription with overlap stitching                                   | M      |

Phase 1+2 alone already deliver the headline: **offline STT with no key and no server.**

## 8. Risks

| Risk                                                  | Severity | Mitigation                                                                              |
| ----------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| CPU transcription is slow; UI feels hung              | **High** | Sidecar + progress events; never block the main thread                                  |
| Model download (~240 MB) on a constrained link        | Medium   | Existing resumable downloader; show size before download                                |
| Multilingual model mistaken for `.en`                 | Medium   | Explicit model id + a test asserting the multilingual variant                           |
| Long-audio boundary word loss                         | Medium   | Overlap stitching (Phase 6)                                                             |
| Transcripts silently leak into cloud LLM on summarize | **High** | Respect the existing local/cloud split; summarization must be able to run fully locally |
| Scope creep into live/streaming STT                   | Medium   | §6 — batch only, separate from P6                                                       |

## 9. Acceptance criteria (proposed)

- [ ] An audio attachment transcribes with **no API key and no external server**
- [ ] Model is multilingual; a French and an Arabic clip transcribe without switching models
- [ ] Transcription emits progress and never freezes the UI
- [ ] A long thread produces a summary that can be read aloud via existing TTS
- [ ] Transcripts are indexed and return in RAG search
- [ ] Summarization can run entirely locally (no mandatory cloud round-trip)
- [ ] The P6 live-STT decision in the voice-agent docs is untouched

## Appendix: HF Spaces survey (audio)

Surveyed `huggingface.co/spaces` (2026-10-01). Audio-relevant entries were mostly
**demos of models**, which is what informs model choice here:

| Space                                   | Relevance                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `openai/whisper`                        | Reference behaviour for transcribe/translate                                                               |
| `nvidia/nemotron-diarization`           | **Speaker diarization** — "who said what" in a call recording. Relevant to call digests, _after_ basic STT |
| Speech-synthesis / voice-cloning spaces | Excluded — TTS is already solved via `voiceService`                                                        |

**Sourcing rule:** Spaces inform _model selection_, not runtime dependencies. The app
runs models locally (candle in the sidecar); it must never call a Space over the network.

**Follow-on worth noting, not scoping now:** speaker diarization would materially
improve call-recording summaries ("Alice raised the pricing objection"), but it is a
second model and a second pipeline. Defer past Phase 6.
