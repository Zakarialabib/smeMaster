# Self-Hosting & Training

> **Status:** Gate 0 design. Self-hosted inference is a **Gate 5** candidate gated on measurement.
> Training is **not v1** — this document defines it so it cannot be started by accident.
> **Scope note:** the "no AI" rule in our product roadmap covers the **SME Master SaaS product**.
> This is a separate client engagement where AI *is* the deliverable. More AI (training) is still
> this engagement, not the product.
> **Companions:** [`PERFORMANCE.md`](PERFORMANCE.md) §6 · [`CALL-FLOW.md`](CALL-FLOW.md) §2 ·
> [`RAG-FORK.md`](RAG-FORK.md) · [`../client/COST-MODEL.md`](../client/COST-MODEL.md)

## 1. "Self-host" means two different things. Do not conflate them.

| | **A. Self-hosted inference** | **B. Training / fine-tuning** |
|---|---|---|
| What it is | Running an existing model on our own hardware instead of a vendor API | Changing a model's weights, or adapting its decoding, with our own data |
| Effort | Days. A config tier + a measurement | Weeks to months per model, plus a GPU somewhere |
| Licence question | The **runtime and the weights** (both permissive — verified) | The **base model**, the **training data**, and the **speaker** (for voice) |
| In v1? | Gate 5 candidate, **not** v1 | **No.** Phase 2+, its own spec |
| Blocks on | A concurrency measurement | The consent model (see §4 — this is the hard part) |

**A is cheap and reversible. B is not.** A is a provider tier behind an existing seam
(`ADR-001` D3). B changes what the product *is* — a generic French receptionist becomes a voice
and an ear tuned to one client, which changes the onboarding story, the data protection
posture, and the per-client build cost.

## 2. Part A — self-hosted inference

The runtime is **`k2-fsa/sherpa-onnx`**: Apache-2.0, 15.0k★, active, C++ over onnxruntime, with
**Python and Rust** bindings, CPU-capable, and it bundles STT + TTS + VAD + diarization.

**Verified French coverage** (HuggingFace registry, 2026-09-28):

| Direction | Model | Kind |
|---|---|---|
| STT | `sherpa-onnx-streaming-zipformer-fr-kroko-2025-08-06` | **streaming** — the live-call model |
| STT | `sherpa-onnx-nemo-canary-180m-flash-en-es-de-fr` (+int8) | offline, 4 languages incl. FR |
| STT | `sherpa-onnx-nemo-ctc-fr-conformer-large` | offline, FR-only |
| TTS | `vits-piper-fr_FR-siwis-medium`, `-upmc-medium`, `-gilles-low`, `-mls_1840-low`, `-tjiho-model1` | 13 FR voices published |

**Why it is worth doing at all:** TTS is **88% of the variable cost** (`PERFORMANCE.md` §6.1).
Replacing it moves the pilot variable cost from ~$0.113–0.239/min to a **$0.013–0.029/min** floor,
recovers **$60–126/month at 600 minutes**, and revives pricing Shape A (which `COST-MODEL.md` §3
had to discard). For the full arithmetic see `PERFORMANCE.md` §6.

**Why it is a *tier* and not a replacement:** Piper `-medium` French is intelligible but not
warm. A caller noticing a robotic receptionist is a business problem, not a latency problem — so
the self-hosted engine serves the **budget / off-hours** tier (which is what makes Shape C's
€0.12/min night rate profitable), while the standard and premium tiers keep ElevenLabs.

### 2.1 The gate that must come first

**The VPS is 4 vCPU (AMD EPYC), ~6.3 GB free, load 0.36** (verified 2026-09-28). "No per-minute
fee" converts a vendor bill into a **concurrency ceiling**: realtime ASR *and* TTS on 4 cores,
alongside the agent's own orchestration, caps simultaneous calls.

The deliverable of the pre-Gate-5 experiment is one number:

> **Maximum concurrent calls at RTF (real-time factor) < 1.0**, with the streaming FR zipformer
> and a Piper FR voice loaded on the target box.

Below the client's expected peak → the tier is closed and nothing else in Gate 5 changes.

### 2.2 Placement rules

| Rule | Reason |
|---|---|
| **Not on the SaaS box** | It runs nginx, php-fpm, Laravel, MariaDB, Redis, Stalwart and the deployer, and it carries our 24/7 on-call commitment. A slow Laravel query must never cost a phone call |
| Keep the C++ runtime out of the FastAPI process | Use the localhost **WSS** server (`streaming_server.py` ships in the project) or the Python binding — same reasoning as `ADR-001` D1 |
| Desktop/mobile use the **Rust** binding | The Rust API (`sherpa-onnx/rust` → `sherpa-onnx-sys` + safe wrapper) matches the existing `ml-sidecar` contract |
| Model files are per-host artefacts | A capability is per-device — never assume a model is installed (`FRONTEND.md` §3.2, `Capabilities`) |

### 2.3 What self-hosting does **not** fix

- **The LLM stays a vendor.** It is the second-largest cost line and the hardest to self-host.
- **The carrier stays a vendor.** No OSS project substitutes a DID and termination.
- **Quality is not free.** It is traded, at the budget tier only.

## 3. Part B — training: what is actually trainable

The toolchains are **separate from the runtime**. sherpa-onnx is an inference engine; it does not
train. Verified toolchain licences (2026-09-28):

| Layer | Tool | Licence | Momentum | Output |
|---|---|---|---|---|
| ASR training | **`k2-fsa/icefall`** | **Apache-2.0** ✅ | 1.5k★, pushed 2026-07-16 | zipformer recipe → ONNX export → sherpa-onnx |
| TTS training | **`rhasspy/piper`** | **MIT** ✅ | 11.3k★, pushed 2025-08-26 (~13 months quiet) | VITS voice → ONNX → sherpa-onnx |
| Voice conversion / cloning | `myshell-ai/OpenVoice` (MIT), `coqui-ai/TTS` (MPL-2.0, ~2 years stale) | permissive | mixed | tone/voice transfer |
| Runtime | `k2-fsa/sherpa-onnx` | Apache-2.0 ✅ | 15.0k★, active | inference only |

**Licence note on toolchains:** training tools are build-time and off-product — they never ship,
so a weak-copyleft trainer (MPL-2.0) is acceptable *for training* even though we would never link
it. But **the output model's licence is governed by its base model and its training data, not by
the toolchain** — record the base model's licence per artefact, and get counsel on the data.

### 3.1 The candidate list, ranked by cost to get right

| # | What | Needs | Effort | Verdict |
|---|---|---|---|---|
| 1 | **Decoder adaptation — hotwords / bias lists** | A text list of the client's product, staff and place names | **Hours.** No GPU, no audio, no consent issue | ✅ **DO FIRST.** Biggest containment win per unit of effort (`PERFORMANCE.md` §6.4) |
| 2 | **Text-only LM / punctuation adaptation** | The retained **transcripts** (text) | Days. No GPU | ✅ Viable — transcripts *are* retained, so this does not touch the audio question |
| 3 | **TTS voice — a brand voice** | 2–20 h of clean single-speaker FR audio **plus the speaker's written consent** | Weeks + GPU rental | ⚠️ Only if the client wants it, as a **paid separate line item** |
| 4 | **ASR acoustic fine-tune** | Hundreds of hours of **labelled audio** + a GPU for days | Weeks + GPU | ⛔ **Blocked in v1** — see §4 |
| 5 | **Embedder fine-tune** (`bge-m3`) | Query→passage pairs | Weeks | ⛔ **Skip.** At 200–500 KB chunks, chunking and curation move containment far more than the embedder (`RAG-FORK.md`) |
| 6 | **Reranker fine-tune** | Relevance labels | Weeks | ⛔ Skip for v1; revisit only if the eval or pilot transcripts show retrieval misses |

### 3.2 What is worth paying for, and in what order

1. Hotwords + text adaptation — **now**, inside Gate 5, because it is hours of work.
2. A brand TTS voice — **only on request**, quoted separately.
3. ASR fine-tuning — **not until the consent model changes** (§4).

## 4. The blocker nobody mentions: v1 retains no audio

`CALL-FLOW.md` §2 recommends **no audio recording at all** — transcripts only, announce-first
disclosure. The client questionnaire asks them to sign that.

**An acoustic ASR fine-tune needs audio.** So:

> **Training an ASR model on the client's calls requires retaining call audio — which the signed
> consent model forbids.** These two decisions are not in conflict today only because nobody has
> tried to do both.

Three ways out, and the client owns the choice:

| Path | Requires | Cost |
|---|---|---|
| **Text-only adaptation** (hotwords, LM, punctuation) | Nothing new — transcripts are already retained | ✅ **Recommended.** No consent change |
| **Scripted in-house recordings** (we read a script, consenting speakers, our own studio conditions) | Speaker consent; no client call audio | Cheap audio, but realistic call audio is the hard case, so the gain is limited |
| **Change the consent model** (retain audio with disclosure + right to object — questionnaire option 2) | Client + counsel sign-off; audio retention pipeline, retention job, DPA update | Phase 2, and it re-opens the CNIL recording regime deliberately |

**Do not propose option 3 to a client purely to enable a fine-tune.** It trades a clean
compliance story for a model improvement that option 1 delivers most of, for hours instead of
weeks.

## 5. Consent and law for the parts that *are* trainable

- **A voice clone is a person's voice.** Use the client's own staff only with their **explicit
  written consent** covering the scope (internal receptionist use, the specific service, the
  duration). Someone leaving the company must be able to revoke it — design for deletion.
- **A cloned voice is also an AI-transparency question.** The disclosure line already says an AI
  answers; that covering line is unaffected by which voice it uses, but counsel should confirm
  the *voice likeness* angle separately.
- **Public FR corpora:** licence varies per corpus and per subset. Verify each one by its own
  terms before use — the rule applied to model weights applies to datasets, and a research-only
  corpus is a hard reject for a client product.
- **Retention:** if path 3 is ever taken, the audio retention job, its window, and the deletion
  path are Gate-level deliverables, not follow-ups.

## 6. Cost of doing Part B (the honest version)

| Item | Reality |
|---|---|
| GPU | **Our VPS has none.** Rent spot/on-demand for experiments; do not buy. This is a new cost line that appears the moment training starts |
| Engineer time | ASR fine-tune: weeks of iteration per realistic attempt, and the first attempt is rarely the one that ships |
| Evaluation | A held-out FR call set must exist **before** training, or there is no way to tell whether the fine-tune helped. Building that set is itself a task |
| Reversibility | A fine-tuned model is a **new artefact to version, host and serve** — it does not swap in by config alone (it is a different model file, and for ASR possibly a different architecture) |

**So training is not a config change — it is a second product surface.** That is the reason it
sits outside v1, not a lack of ambition.

## 7. Decision matrix

| Question | Answer |
|---|---|
| Do we self-host inference in v1? | **No.** Gate 5 candidate, tier only, gated on `RTF < 1.0` |
| Do we train anything in v1? | **Only decoder adaptation** (hotwords + text), which needs no audio and no GPU |
| Do we train a voice? | Only as a **quoted separate line item**, with written speaker consent |
| Do we fine-tune ASR on call audio? | **No** — it contradicts the consent model (§4) |
| Do we fine-tune the embedder? | **No** — chunking beats model choice at our KB scale |
| When does real training get its own plan? | After the pilot, if containment is limited by *recognition* rather than by *knowledge* |

## 8. Gates

| Gate | Action |
|---|---|
| **5 (entry)** | Measure max concurrent calls at RTF < 1.0. Below peak → close the tier, stop |
| **5** | Ship hotword/bias lists per tenant — cheap, no audio, immediate containment effect |
| **5** | Adopt **TTS caching** for the greeting, the disclosure line and confirmations. Self-hosted rendering makes populating the cache free |
| **post-pilot** | Decide whether the containment gap is knowledge (fix the KB, no training) or recognition (then, and only then, scope training) |
| **phase 2, own spec** | A brand voice / an acoustic fine-tune — with the consent-model decision resolved first, not after |
