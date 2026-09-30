> ## ⚠️ Editorial note — 2026-09-28 (Hermes). Read before using this document.
>
> This file is an **externally-drafted research report** (not written against this repo).
> It was adjudicated against primary sources and against the decisions already signed in
> this project. **Several of its load-bearing claims do not hold.** Verified findings:
>
> | Claim in this document | Verdict |
> |---|---|
> | Voxtral TTS is "an open-weight model licensed for commercial use" (Phase 3, and the TTS table) | ❌ **FALSE.** `mistralai/Voxtral-4B-TTS-2603` is **CC-BY-NC-4.0 — non-commercial** (HuggingFace registry, 2026-09-28). The same paragraph later admits it. Hard reject for a paid client product. |
> | "For the `smeMaster` application … leveraging WebRTC via LiveKit is the correct choice" | ❌ **Wrong for this architecture.** The caller is on the PSTN; media arrives as carrier μ-law ~8 kHz over a WebSocket media stream (spec Gate 4). There is no browser in the media path in v1. WebRTC describes an SFU topology we do not have. |
> | Cartesia as the Phase-1 primary TTS | ⚠️ **Contradicts a signed decision.** The spec fixes ElevenLabs as primary with the seam behind it. Cartesia is a legitimate *candidate behind the seam* — it does not un-settle the seam. |
> | Deepgram as primary STT | ⚠️ Already the signed choice; presented here as if new. |
> | Deepgram Flux "saves 200–600 ms" end-of-turn detection; Cartesia "40–90 ms" TTFA; the pricing rows | ⚠️ **Vendor and competitor-blog sourced** (deepgram.com, elevenlabs.io, coval.ai, gladia.io). Treat as unverified until measured on our audio — the same rule `COST-MODEL.md` §6 applies to every vendor number. |
> | Optimising for "high-volume" self-hosting economics | ⚠️ **Inverted for our problem.** Our constraint is *pilot* volume (200–600 min/mo) where **fixed cost dominates** (`COST-MODEL.md` §2) — adding a GPU VPS *raises* cost. See Part 6 for the option that does not. |
>
> **What holds and is worth adopting:** (1) **TTS audio caching** for greetings, confirmations
> and the disclosure line — the cheapest lever on the dominant cost line; (2) **context
> compounding** means the per-minute LLM figure in `COST-MODEL.md` §1 is a *floor*, not an
> average; (3) Cartesia and integrated turn-detection as **evaluation candidates** at Gate 4/5;
> (4) the residency/DPA checklist, which sharpens the questions in `VENDOR-QUOTE-REQUEST.md`.
> **HDS certification is out of scope** — this client is not a health-data processor.
>
> **The document's real gap:** it never considers **self-hosted / on-device speech** at all,
> which is the axis that actually moves our cost curve. That is **Part 6**, added 2026-09-28
> and inspired by [`k2-fsa/sherpa-onnx`](https://github.com/k2-fsa/sherpa-onnx) (Apache-2.0)
> and its React Native TurboModule binding
> ([`XDcobra/react-native-sherpa-onnx`](https://github.com/XDcobra/react-native-sherpa-onnx), MIT).
>
> Related: [`ADR-001`](../../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) ·
> [`OSS landscape`](../../06-ROADMAP/15-voice-agent-oss-landscape.md) ·
> [`COST-MODEL.md`](../client/COST-MODEL.md)

# Optimizing Voice Agent Performance: A Blueprint for Low-Cost, Low-Latency, and EU-Compliant French AI Assistants

## 0.1 Source-class column — added 2026-09-28

**Parts 1–5 are an externally-drafted report, not a measurement of this system.** Every
load-bearing claim in them is classified below. Nothing in Parts 1–5 may be quoted to a client,
used in a pricing decision, or treated as a design input without a class of PRIMARY or
MEASURED.

| Class | Meaning |
|---|---|
| **PRIMARY** | From a vendor's own first-party technical documentation, API, or model card — read at the source, dated |
| **VENDOR** | Vendor marketing or pricing page. Directionally useful, **not independently verified**, and a vendor's own number for their own product is the weakest form of vendor evidence |
| **COMPETITOR-BLOG** | A vendor *blogging about a competitor*. A marketing artefact on both counts. Zero weight |
| **UNVERIFIED** | Asserted in the draft with no source we could reach. Carries the same force as `COST-MODEL.md` §6's unchecked boxes |

### 0.2 Decision-relevant claims, with their class

The editorial note already adjudicated six claims. These are the remaining load-bearing ones,
classified claim by claim.

| # | Claim | Location | Class | Status 2026-09-28 |
|---|---|---|---|---|
| C1 | Deepgram has an **EU data-residency endpoint**, hostname unstated | Part 1 | **UNVERIFIED** | ⚠️ **Re-verification attempted and inconclusive.** `api.deepgram.com` and `api.eu.deepgram.com` both answer `404` to an unauthenticated probe and `api.deepgram.eu` fails TLS — so the `api.eu.` form *resolves and responds*, but an unauthenticated 404 cannot distinguish a real EU host from a wildcard, and the docs pages are JS-rendered and yielded no text. **The flag stays.** The exact hostname is a Gate 4 blocker, not a footnote: it decides whether we can claim EU residency for STT at all. |
| C2 | **Cartesia TTFA "40–90 ms"** | Part 2, TTS table | **VENDOR** | Flag kept. A vendor's own latency figure, unreplicated, on unspecified hardware, with a warm/cold cache unstated. |
| C3 | **Deepgram Flux saves 200–600 ms** on end-of-turn detection | Part 2 | **VENDOR** | Flag kept. Same shape as C2 — and it is the *integrated* turn-detection claim, which matters more because turn detection dominates perceived latency. |
| C4 | **Integrated end-of-turn detection is available and worth using** | Part 2 | **UNVERIFIED** | ⚠️ **Not re-verifiable from documentation alone.** This is a *capability* claim, and a capability claim is settled by integration, not by a benchmark. |
| C5 | STT per-hour and TTS per-character pricing rows | Parts 1–2 | **VENDOR** | Flag kept, and **decay fast**. `COST-MODEL.md` §6 remains the checklist; these rows are not a substitute for a dated screenshot. |
| C6 | **Voxtral TTS is open-weight and commercially licensed** | Part 3, TTS table | ❌ **FALSE** | Adjudicated in the editorial note: CC-BY-NC-4.0. Hard reject. |
| C7 | WebRTC/LiveKit is the correct media choice for this app | Part 2 | ❌ **FALSE** | Adjudicated: the caller is on the PSTN; no browser is in the media path. |
| C8 | Cartesia as Phase-1 primary TTS | Part 2 | ⚠️ **CONTRADICTS A SIGNED DECISION** | ElevenLabs is primary; Cartesia is a candidate *behind the seam*. |
| C9 | High-volume self-hosting economics | Part 4 | ⚠️ **INVERTED for our problem** | Our volume is pilot-scale, where fixed cost dominates. |

**C1, C4 are the two that could change an architecture decision. Both stay flagged.** The rest
are cost or marketing claims that the `COST-MODEL.md` §6 process already governs.

### 0.3 The Gate 4 tests that would settle C1–C4

Written now, so the pilot is not the first time anyone asks these questions. Each is a real
experiment with a pass criterion, not a literature review.

**C1 — Deepgram EU residency.** Settled in two steps, in order:
1. *Cheap, do first:* authenticated request to the candidate host with a single short FR audio
   clip, then read the **inbound Webhook/Request-URI region field** Deepgram returns, and
   confirm the host in the response matches the EU one. If Deepgram echoes a region, that is the
   answer; if not, the question is unanswerable from the API and must be answered by their
   DPA.
2. *Decisive:* written confirmation in the DPA or contract that STT audio for our traffic is
   processed in the EU. This is the only evidence that survives an audit, and it belongs in
   `VENDOR-QUOTE-REQUEST.md` question 6.
   **Pass:** DPA names an EU region for audio. **Fail:** US-only processing → the EU-residency
   pitch is no longer true for the voice channel, and the client must be told before signature.

**C4 / C3 — integrated end-of-turn detection.** A/B on **our own audio**, never a vendor demo:
take ≥ 30 FR calls' worth of recorded caller audio (transcripts only — the no-audio rule applies
to *product* retention, not to a test fixture, and the fixture is deleted after the test).
Measure, for each configuration, `turn_gap` p50 and p95:
- **A:** our current endpointing (VAD + silence threshold)
- **B:** Deepgram Flux end-of-turn, same audio, same TTS, same LLM
**Pass:** B reduces `turn_gap` p50 by ≥ 200 ms **without** raising barge-in (a cut-off caller).
**A latency win that raises barge-in is a regression** — a caller interrupted mid-sentence is
worse than a half-second of silence, and that is a UX judgement, not a number.

**C2 — Cartesia TTFA.** Only measured, only on the same fixture: p50/p95 TTFA for the actual FR
voice at 8 kHz μ-law, cold and warm cache, ≥ 100 requests. **Pass:** ≤ 150 ms p95 warm, and a
provider error rate under 0.5%. Cartesia stays *behind the seam* either way — the seam is what
makes this a 30-minute test rather than a re-architecture.

**A note on what no test here can settle:** whether Cartesia's *voice quality* is better for
French is a listening test with the client, not a metric. Add it to the Gate 4 walkthrough
rather than pretending a TTFA number answers it.


## Comparative Analysis of Speech-to-Text Providers for French Call Management

The selection of a Speech-to-Text (STT) provider is a foundational decision that directly impacts the accuracy, latency, and overall cost-effectiveness of the AI voice assistant integrated into `smeMaster`. For a system handling French calls under strict EU compliance, the evaluation criteria extend beyond simple word error rate (WER) to encompass data residency, feature pricing, and real-world performance on noisy or accented audio. This section provides a detailed comparative analysis of leading STT providers, focusing on ElevenLabs, Deepgram, and viable alternatives, benchmarked against the specific needs of this project. The primary contenders are evaluated based on their core technology, pricing structures, support for the French language, and adherence to EU data governance frameworks. Each provider presents a unique set of trade-offs between raw model performance, architectural convenience, and total cost of ownership.

Deepgram has established itself as a prominent player, particularly for applications requiring low-latency, real-time processing, such as conversational agents [[2](https://deepgram.com/learn/best-speech-to-text-apis)]. Its platform offers a suite of models tailored for different use cases, making it a flexible choice for the `smeMaster` project. The flagship model, Nova-3, demonstrates strong performance across various audio types, achieving a reported 5.26% Word Error Rate (WER) in batch mode and showcasing a 54% improvement over competitors in streaming scenarios [[2](https://deepgram.com/learn/best-speech-to-text-apis), [4](https://futureagi.substack.com/p/speech-to-text-apis-in-2026-benchmarks)]. For multilingual applications involving French, Deepgram provides a dedicated "Enhanced" French model, which developers can access via an API endpoint with specific parameters (`language=fr`, `tier=enhanced`) [[44](https://deepgram.com/learn/enhanced-french)]. This specialized tuning aims to achieve upwards of 90% accuracy in various French-speaking contexts, such as call center recordings [[44](https://deepgram.com/learn/enhanced-french)]. Furthermore, the updated Nova-3 Multilingual model shows significant improvements in code-switching scenarios, supporting languages including English, Spanish, German, Italian, Japanese, Dutch, Russian, Portuguese, and Hindi [[77](https://deepgram.com/learn/nova-3-multilingual-major-wer-improvements-across-languages)]. However, real-world performance can vary; one user report noted a high WER of 10-20% on mixed English/French audio, with specific examples of misrecognition like "je" being transcribed as "Dieu" [[78](https://github.com/orgs/deepgram/discussions/1571)]. Independent benchmarks from Artificial Analysis have also shown that while Deepgram excels in speed and efficiency when balancing accuracy and speed, its median WER on diverse real-world English audio can be higher than vendor claims suggest, a factor that may apply to other languages [[76](https://vexascribe.com/how-accurate-is-deepgram)]. From a deployment perspective, Deepgram offers a crucial advantage with its officially launched EU endpoint, `api.eu.deepgram.com` [[36](https://deepgram.com/learn/deepgram-eu-endpoint-now-generally-available)]. Migrating to this endpoint requires only changing the base URL, ensuring that all audio processing remains within the European Economic Area (EEA), thereby satisfying stringent data residency requirements [[36](https://deepgram.com/learn/deepgram-eu-endpoint-now-generally-available), [41](https://deepgram.com/learn/deepgram-goes-global)]. This is complemented by SOC 2 Type 2, GDPR, and HIPAA compliance [[40](https://deepgram.com/pricing)].

For real-time agent interactions, Deepgram’s Flux model is purpose-built to optimize turn-taking dynamics [[2](https://deepgram.com/learn/best-speech-to-text-apis)]. It integrates end-of-turn detection, eliminating the need for a separate Voice Activity Detection (VAD) layer and potentially saving 200-600ms in agent response time [[5](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)]. This feature is critical for maintaining a natural conversation flow, where delays exceeding 500ms can feel unnatural [[8](https://introl.com/blog/voice-ai-infrastructure-real-time-speech-agents-asr-tts-guide-2025)]. The Flux model supports fast speaker-end detection and is optimized for conversations in over 36 languages [[4](https://futureagi.substack.com/p/speech-to-text-apis-in-2026-benchmarks)]. Pricing for Deepgram's services is modular, which can offer flexibility but also complexity. The pay-as-you-go rate for Nova-3 multilingual streaming is approximately $0.0092 per minute ($0.55/hour), with diarization available as an add-on for an additional $0.0020/min [[17](https://www.gladia.io/blog/best-elevenlabs-alternatives-for-speech-to-text-gladia-deepgram-assemblyai-compared), [40](https://deepgram.com/pricing)]. This per-feature billing structure contrasts with bundled offerings from some competitors and requires careful calculation to understand the effective cost for a complex workload [[20](https://www.digitalapplied.com/blog/openai-gpt-transcribe-stt-model-comparison-2026)]. While Deepgram offers robust features, its primary strength lies in its specialized, low-latency models and clear path to EU data residency, making it a strong candidate for the `smeMaster` project's initial stack.

ElevenLabs, primarily renowned for its state-of-the-art Text-to-Speech (TTS) synthesis, also offers a competitive Scribe v2 Realtime model for speech-to-text transcription [[18](https://elevenlabs.io/speech-to-text)]. Its main appeal for a project using its own TTS services is the seamless integration within a single ecosystem [[16](https://deepgram.com/learn/deepgram-vs-elevenlabs)]. The Scribe v2 Realtime model is engineered for low latency, claiming to deliver sub-150ms first-partial latency, which is ideal for live applications [[1](https://www.gladia.io/blog/best-speech-to-text-apis), [18](https://elevenlabs.io/speech-to-text)]. In terms of French language proficiency, ElevenLabs positions Scribe v2 as having "Excellent Accuracy," defined as a WER at or below 5%, placing it among the highest-performing models for regulated industries [[18](https://elevenlabs.io/speech-to-text), [20](https://www.digitalapplied.com/blog/openai-gpt-transcribe-stt-model-comparison-2026)]. The model supports up to 32 speakers, keyterm prompting, automatic language detection, and mid-conversation language switching, which are valuable features for a general-purpose voice assistant [[4](https://futureagi.substack.com/p/speech-to-text-apis-in-2026-benchmarks)]. However, several production limitations must be considered. The platform splits audio files over 8 minutes into concurrent segments, which can introduce seam artifacts, and caps multi-channel audio at 5 channels and 1 hour of processing time [[17](https://www.gladia.io/blog/best-elevenlabs-alternatives-for-speech-to-text-gladia-deepgram-assemblyai-compared)]. Additionally, its language detection occurs only once at the start of a call, lacking robust mid-conversation code-switching capabilities, a potential weakness compared to models like Deepgram's Flux [[17](https://www.gladia.io/blog/best-elevenlabs-alternatives-for-speech-to-text-gladia-deepgram-assemblyai-compared)]. From a compliance standpoint, ElevenLabs' offerings are heavily gated behind enterprise contracts. Features critical for EU compliance, such as guaranteed data residency and Zero Retention Mode (which ensures content is not processed outside the EU), are exclusive to Enterprise customers and require enabling specific configurations and using distinct EU-based API endpoints [[33](https://elevenlabs.io/docs/overview/administration/data-residency), [35](https://elevenlabs.io/blog/introducing-european-data-residency), [58](https://innfactory.ai/en/ai-models/elevenlabs/)]. This adds a layer of administrative overhead and may not be suitable for smaller-scale deployments without an enterprise agreement. Pricing for Scribe v2 is tiered and can be confusing, with public-facing rates starting around $0.40/hour, but normalized leaderboard rates suggesting a much lower price of approximately $0.22/hour, a discrepancy of about 80% [[18](https://elevenlabs.io/speech-to-text), [20](https://www.digitalapplied.com/blog/openai-gpt-transcribe-stt-model-comparison-2026)]. This suggests that cost modeling requires direct engagement with sales or careful interpretation of promotional materials.

Beyond the primary candidates of Deepgram and ElevenLabs, several alternative providers present compelling value propositions, particularly for teams prioritizing specific aspects of compliance, cost, or multilingual support. Gladia stands out as a strong contender for European projects due to its Paris-based origin and focus on data privacy [[63](https://europeanstack.com/software/gladia)]. Its Solaria-3 model is ranked #1 for accuracy on noisy, real-world business audio across core European languages, including French, outperforming competitors on challenging datasets [[1](https://www.gladia.io/blog/best-speech-to-text-apis), [37](https://www.gladia.io/blog/enterprise-and-on-premise-speech-to-text-security-sla-and-data-residency)]. Gladia's asynchronous-first architecture is designed for call-center recordings and sales calls, aligning well with many agent use cases [[1](https://www.gladia.io/blog/best-speech-to-text-apis)]. A key differentiator is its pricing model, which bundles essential audio intelligence features like speaker diarization, sentiment analysis, and named entity recognition into a single per-hour rate on its Growth plan, avoiding the hidden costs associated with modular add-ons [[17](https://www.gladia.io/blog/best-elevenlabs-alternatives-for-speech-to-text-gladia-deepgram-assemblyai-compared), [37](https://www.gladia.io/blog/enterprise-and-on-premise-speech-to-text-security-sla-and-data-residency)]. On paid plans, Gladia defaults to not using customer audio for model training, a significant compliance advantage [[37](https://www.gladia.io/blog/enterprise-and-on-premise-speech-to-text-security-sla-and-data-residency)]. Like Deepgram, Gladia offers EU data residency as a standard configuration for its paid plans, simplifying compliance efforts [[37](https://www.gladia.io/blog/enterprise-and-on-premise-speech-to-text-security-sla-and-data-residency)]. AssemblyAI is another major player offering a Universal-3 Pro Streaming model that supports French among six other languages [[45](https://deepgram.com/learn/deepgram-vs-speechmatics-vs-assemblyai)]. Its pricing follows a modular model, where features like speaker diarization are billed separately, which can increase the total cost [[17](https://www.gladia.io/blog/best-elevenlabs-alternatives-for-speech-to-text-gladia-deepgram-assemblyai-compared)]. AssemblyAI provides self-serve options for US or EU regions, with its EU processing center located in Dublin [[45](https://deepgram.com/learn/deepgram-vs-speechmatics-vs-assemblyai)]. Soniox offers a "Sovereign Cloud" solution where audio and transcripts are processed and stored exclusively within the EU jurisdiction, preventing any cross-border data transfers [[3](https://soniox.com/europe)]. This makes it an excellent choice for projects with the strictest data sovereignty requirements, though its availability might be limited to enterprise tiers. Finally, open-source models like NVIDIA's Parakeet-TDT-0.6B-v3 provide the ultimate control and potential for long-term cost savings by eliminating per-minute API fees entirely, shifting the cost burden to GPU hardware [[5](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)]. However, this approach demands significant engineering resources for self-hosting, maintenance, and scaling [[6](https://comparevoiceai.com/blog/cost-optimisation-voice-agent/)].

| Provider | Core Model(s) | Key Latency Feature | French Language Support | EU Data Residency | Typical Pricing (per min/hr) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Deepgram** | Nova-3, Flux | Integrated end-of-turn detection saves 200-600ms [[5](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)] | Enhanced model available; supports multilingual code-switching [[44](https://deepgram.com/learn/enhanced-french), [77](https://deepgram.com/learn/nova-3-multilingual-major-wer-improvements-across-languages)] | Yes, via dedicated EU endpoint (`api.eu.deepgram.com`) [[36](https://deepgram.com/learn/deepgram-eu-endpoint-now-generally-available)] | ~$0.0092/min (~$0.55/hr) + add-ons [[40](https://deepgram.com/pricing)] |
| **ElevenLabs** | Scribe v2 Realtime | Sub-150ms first-partial latency [[18](https://elevenlabs.io/speech-to-text)] | Excellent accuracy (≤5% WER); supports mid-conversation switching [[17](https://www.gladia.io/blog/best-elevenlabs-alternatives-for-speech-to-text-gladia-deepgram-assemblyai-compared), [18](https://elevenlabs.io/speech-to-text)] | Enterprise-only; requires ZRM and EU API keys [[33](https://elevenlabs.io/docs/overview/administration/data-residency)] | Tiered subscription; $0.40/hr public vs. ~$0.22/hr leaderboard [[18](https://elevenlabs.io/speech-to-text), [20](https://www.digitalapplied.com/blog/openai-gpt-transcribe-stt-model-comparison-2026)] |
| **Gladia** | Solaria-3 (async), Solaria-1 (streaming) | Async model has lower WER; Realtime latency <103ms partial [[1](https://www.gladia.io/blog/best-speech-to-text-apis)] | Ranked #1 for business audio; supports >100 languages with code-switching [[1](https://www.gladia.io/blog/best-speech-to-text-apis), [63](https://europeanstack.com/software/gladia)] | Yes, default on paid plans [[37](https://www.gladia.io/blog/enterprise-and-on-premise-speech-to-text-security-sla-and-data-residency)] | Bundled pricing (~$0.20-$0.25/hr on Growth plan) [[37](https://www.gladia.io/blog/enterprise-and-on-premise-speech-to-text-security-sla-and-data-residency)] |
| **AssemblyAI** | Universal-3 Pro Streaming | ~150ms P50 latency [[28](https://www.cekura.ai/blogs/best-voice-ai-apis-real-time-audio-processing)] | Supports French and 5 other languages in its streaming model [[45](https://deepgram.com/learn/deepgram-vs-speechmatics-vs-assemblyai)] | Yes, self-serve EU region option [[45](https://deepgram.com/learn/deepgram-vs-speechmatics-vs-assemblyai)] | Base rate + add-ons (e.g., diarization at extra cost) [[17](https://www.gladia.io/blog/best-elevenlabs-alternatives-for-speech-to-text-gladia-deepgram-assemblyai-compared)] |
| **Soniox** | Proprietary Models | Processes audio in real-time memory, not stored [[3](https://soniox.com/europe)] | Native-speaker accuracy for French and many other European languages [[3](https://soniox.com/europe)] | Yes, via Sovereign Cloud solution [[3](https://soniox.com/europe)] | Information not available in provided sources |
| **Open Source** | NVIDIA Parakeet-TDT-0.6B-v3 | Latency depends on hardware; no per-minute fees [[5](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)] | Supports 25 EU languages [[5](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)] | Full control over infrastructure location [[5](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)] | Based on GPU hardware costs [[5](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)] |

In summary, the choice of an STT provider for `smeMaster` involves navigating a landscape of competing priorities. Deepgram emerges as a powerful and technically sophisticated option, especially with its Flux model, offering a direct path to low-latency, real-time interaction and clear EU data residency. Its modular pricing requires careful tracking but allows for granular control. ElevenLabs offers superior French language accuracy and a seamless experience if its entire stack is used, but this comes at the cost of enterprise-level commitments for full compliance and a potentially more complex pricing structure. Gladia presents a compelling alternative, particularly for its transparent, bundled pricing and strong focus on European data privacy, backed by impressive benchmark results on relevant audio types. For the `smeMaster` project, a pragmatic approach would be to conduct hands-on testing with Deepgram's Nova-3/Flux and Gladia's Solaria models using representative French call audio to validate real-world performance before committing to a final choice.

## Comparative Analysis of Text-to-Speech Providers for Natural Interaction

The Text-to-Speech (TTS) component is responsible for converting the AI assistant's textual responses into audible speech, directly shaping the user's perception of the interaction's quality and naturalness. For the `smeMaster` voice assistant, the selection of a TTS provider hinges on three critical factors: Time-to-First-Audio (TTFA), which dictates conversational latency; voice quality and emotional expressiveness; and, crucially, cost-effectiveness and EU compliance. The market offers a spectrum of solutions, from ultra-low-latency providers optimized for real-time responsiveness to premium services focused on audiobook-grade vocal fidelity. This section conducts a comparative analysis of leading TTS providers, including ElevenLabs and Deepgram, alongside key alternatives, to identify the optimal balance of performance, cost, and compliance for French-language voice agent interactions.

Cartesia has rapidly emerged as the leader in the low-latency TTS space, making it a prime candidate for real-time voice agents where minimizing perceived delay is paramount. Its Sonic model is engineered for speed, achieving a TTFA of just 40-90 milliseconds, significantly faster than most competitors [[69](https://www.codesota.com/speech/elevenlabs-vs-cartesia), [70](https://www.famulor.io/fr/blog/cartesia-sonic-elevenlabs-and-minimax-the-ultimate-comparison-for-ai-voice-agents-and-famulors-strategic-advantage)]. This performance is attributed to its underlying State Space Model (SSM) architecture, which scales linearly with sequence length, allowing for efficient streaming synthesis [[27](https://inworld.ai/resources/best-speech-to-speech-apis), [72](https://www.autointerviewai.com/blog/cartesia-vs-elevenlabs-tts-voice-agents-2026)]. This is a stark contrast to traditional Transformer models, whose computational cost grows quadratically, making them slower for generating long sequences in real-time [[72](https://www.autointerviewai.com/blog/cartesia-vs-elevenlabs-tts-voice-agents-2026)]. For the `smeMaster` project, Cartesia's ability to produce the first chunk of audio almost instantly after receiving text would dramatically enhance the conversational flow, keeping the interaction within the human-perceived 200-300ms response window [[7](https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it)]. The platform supports multiple languages, including French, and offers instant voice cloning from as little as three seconds of reference audio, providing a powerful tool for creating consistent brand voices [[14](https://huggingface.co/blog/azhan77168/voxtral-tts), [72](https://www.autointerviewai.com/blog/cartesia-vs-elevenlabs-tts-voice-agents-2026)]. Pricing is usage-based, typically calculated per 1,000 characters, with volume discounts available that can make it highly cost-effective at scale [[13](https://inworld.ai/resources/elevenlabs-alternatives), [69](https://www.codesota.com/speech/elevenlabs-vs-cartesia)]. While its prosody may be slightly less nuanced on very long narrative passages compared to diffusion-based models, its raw speed makes it an ideal choice for the dynamic, turn-taking nature of a phone call [[69](https://www.codesota.com/speech/elevenlabs-vs-cartesia)].

ElevenLabs remains the industry benchmark for voice quality and naturalness, particularly for applications where pre-recorded content and emotional depth are valued [[69](https://www.codesota.com/speech/elevenlabs-vs-cartesia), [71](https://www.reddit.com/r/artificial/comments/1ra81v9/real_production_comparison_elevenlabs_vs_playht/)]. Its Flash v2.5 model offers a compelling balance, delivering a TTFA of approximately 75ms while maintaining high voice quality, making it suitable for many real-time agent use cases [[8](https://introl.com/blog/voice-ai-infrastructure-real-time-speech-agents-asr-tts-guide-2025), [43](https://deepgram.com/learn/best-text-to-speech-apis-2026)]. The platform boasts a vast library of over 10,000 voices across 70+ languages, including multiple French variants like 'French Swiss' and 'Québécois', and offers advanced features like emotional steering and professional-grade voice cloning [[27](https://inworld.ai/resources/best-speech-to-speech-apis), [56](https://elevenlabs.io/text-to-speech), [60](https://elevenlabs.io/text-to-speech/french)]. However, there is a clear trade-off between latency and quality within its product line. The more advanced Turbo and v3 models, which offer superior naturalness and emotion, come with higher latency, sometimes exceeding 300ms, making them less suitable for low-latency agent loops [[51](https://hamming.ai/resources/best-voice-agent-stack), [70](https://www.famulor.io/fr/blog/cartesia-sonic-elevenlabs-and-minimax-the-ultimate-comparison-for-ai-voice-agents-and-famulors-strategic-advantage)]. This creates a strategic choice: use the faster Flash model for live interactions and switch to a premium model for non-real-time, high-fidelity content generation. From a cost perspective, ElevenLabs employs a tiered subscription model, which can become expensive at high volumes compared to usage-based APIs [[69](https://www.codesota.com/speech/elevenlabs-vs-cartesia), [72](https://www.autointerviewai.com/blog/cartesia-vs-elevenlabs-tts-voice-agents-2026)]. As with its STT services, achieving full EU data residency and compliance features like Zero Retention Mode requires an enterprise contract and specific configuration, adding a layer of complexity for non-enterprise users [[33](https://elevenlabs.io/docs/overview/administration/data-residency), [35](https://elevenlabs.io/blog/introducing-european-data-residency)].

Deepgram's Aura-2 TTS service represents a solid middle-ground option, offering a good balance of performance and features. It is optimized for real-time applications and delivers a baseline Time-to-First-Byte (TTFB) of under 200ms, with some reports indicating it can reach as low as 90ms [[16](https://deepgram.com/learn/deepgram-vs-elevenlabs), [43](https://deepgram.com/learn/best-text-to-speech-apis-2026)]. The Aura-2 model supports seven languages, including English, Spanish, Dutch, French, German, Italian, and Japanese [[43](https://deepgram.com/learn/best-text-to-speech-apis-2026)]. By choosing Deepgram for both STT and TTS, the `smeMaster` project could benefit from a unified provider ecosystem, simplifying integration and billing. Its pricing is competitive at $0.030 per 1,000 characters on its pay-as-you-go plan, with a discount on its Growth plan [[43](https://deepgram.com/learn/best-text-to-speech-apis-2026)]. This makes it a reliable and straightforward choice, especially if Deepgram is already selected for the STT component.

Beyond the major commercial APIs, the rise of open-weight and niche providers offers additional strategic options. Voxtral TTS, developed by Mistral, is an open-weight model licensed for commercial use that has demonstrated superior performance on French in blind listening tests, winning preference 54.4% of the time [[14](https://huggingface.co/blog/azhan77168/voxtral-tts)]. Self-hosting this model provides complete control over data privacy, ensuring full compliance with GDPR and other EU regulations by deploying it on private infrastructure [[14](https://huggingface.co/blog/azhan77168/voxtral-tts)]. While it requires a 16GB+ VRAM GPU and has a non-commercial license that may require a separate agreement for ordinary commercial use, the long-term cost savings for high-volume applications can be substantial, with infrastructure costs estimated at $200-500/month compared to $1,500-$3,000/month on ElevenLabs [[14](https://huggingface.co/blog/azhan77168/voxtral-tts), [15](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/)]. Another low-cost entry point is FreeTTS, a service priced at $19/month for its PRO plan. It offers native neural voices for four French regions (France, Quebec, Belgium, Switzerland) hosted on servers in Germany, making it a simple and affordable way to initiate an EU-compliant project without significant upfront investment [[61](https://freetts.org/best-french-text-to-speech-tools)]. Other notable providers include Google Cloud TTS, which offers broad language coverage and integrates well with its cloud ecosystem, and Microsoft Azure Cognitive Services, known for its containerized on-premise deployment options suitable for regulated industries [[43](https://deepgram.com/learn/best-text-to-speech-apis-2026), [45](https://deepgram.com/learn/deepgram-vs-speechmatics-vs-assemblyai)].

| Provider | Key Technology | Time-to-First-Audio (TTFA) | French Language Support | EU Compliance Path | Pricing Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cartesia** | State Space Model (SSM) [[72](https://www.autointerviewai.com/blog/cartesia-vs-elevenlabs-tts-voice-agents-2026)] | ~40-90 ms [[69](https://www.codesota.com/speech/elevenlabs-vs-cartesia), [70](https://www.famulor.io/fr/blog/cartesia-sonic-elevenlabs-and-minimax-the-ultimate-comparison-for-ai-voice-agents-and-famulors-strategic-advantage)] | Yes, supports French [[72](https://www.autointerviewai.com/blog/cartesia-vs-elevenlabs-tts-voice-agents-2026)] | Subscription-based; details on enterprise plans required | Usage-based (per 1,000 chars) [[13](https://inworld.ai/resources/elevenlabs-alternatives)] |
| **ElevenLabs** | Diffusion-based Model [[72](https://www.autointerviewai.com/blog/cartesia-vs-elevenlabs-tts-voice-agents-2026)] | ~75 ms (Flash v2.5); 250-300ms+ (Turbo/v3) [[8](https://introl.com/blog/voice-ai-infrastructure-real-time-speech-agents-asr-tts-guide-2025), [51](https://hamming.ai/resources/best-voice-agent-stack)] | Yes, extensive support for French variants [[60](https://elevenlabs.io/text-to-speech/french)] | Enterprise contract required for data residency/ZRM [[33](https://elevenlabs.io/docs/overview/administration/data-residency)] | Tiered subscription [[72](https://www.autointerviewai.com/blog/cartesia-vs-elevenlabs-tts-voice-agents-2026)] |
| **Deepgram** | Not specified | Sub-200ms baseline, down to 90ms [[16](https://deepgram.com/learn/deepgram-vs-elevenlabs), [43](https://deepgram.com/learn/best-text-to-speech-apis-2026)] | Yes, Aura-2 supports French [[43](https://deepgram.com/learn/best-text-to-speech-apis-2026)] | Available through EU endpoint and dedicated clusters [[16](https://deepgram.com/learn/deepgram-vs-elevenlabs)] | Pay-as-you-go ($0.030/1k chars) [[43](https://deepgram.com/learn/best-text-to-speech-apis-2026)] |
| **Voxtral TTS** | Open-weight model (4B parameters) [[14](https://huggingface.co/blog/azhan77168/voxtral-tts)] | ~70 ms (on H200 GPU) [[14](https://huggingface.co/blog/azhan77168/voxtral-tts)] | Yes, supports French [[14](https://huggingface.co/blog/azhan77168/voxtral-tts)] | Self-hosting on private EU infrastructure [[14](https://huggingface.co/blog/azhan77168/voxtral-tts)] | Infrastructure/GPU costs only [[14](https://huggingface.co/blog/azhan77168/voxtral-tts)] |
| **FreeTTS** | Commercial Neural TTS | Not specified | Yes, regional voices for France, Quebec, Belgium, Switzerland [[61](https://freetts.org/best-french-text-to-speech-tools)] | Hosted on Hetzner Cloud in Germany [[61](https://freetts.org/best-french-text-to-speech-tools)] | PRO plan at $19/month [[61](https://freetts.org/best-french-text-to-speech-tools)] |
| **Google Cloud** | Chirp 3 / Gemini TTS [[27](https://inworld.ai/resources/best-speech-to-speech-apis)] | Not specified | Yes, supports French [[61](https://freetts.org/best-french-text-to-speech-tools)] | Via GCP EU regions and DPA [[30](https://www.lumay.ai/blogs/best-ai-voice-agents-for-businesses-in-europe)] | Pay-as-you-go (per million characters) [[61](https://freetts.org/best-french-text-to-speech-tools)] |

Ultimately, the choice of a TTS provider for `smeMaster` should be guided by the project's primary constraint: latency versus quality. If the goal is to build the snappiest possible conversational loop to ensure a natural, uninterrupted dialogue, Cartesia is the unequivocal choice due to its industry-leading TTFA [[69](https://www.codesota.com/speech/elevenlabs-vs-cartesia)]. Its SSM architecture is purpose-built for the demands of a live voice agent. If, however, the priority is achieving the highest possible voice quality for a more expressive and engaging interaction, even at the cost of increased latency, ElevenLabs' Flash v2.5 model is the best option [[70](https://www.famulor.io/fr/blog/cartesia-sonic-elevenlabs-and-minimax-the-ultimate-comparison-for-ai-voice-agents-and-famulors-strategic-advantage)]. A hybrid strategy, using Cartesia for real-time turns and ElevenLabs for pre-rendered, high-quality confirmations or greetings, could offer the best of both worlds but adds complexity to the orchestration logic. For projects with strict budget constraints or a mandate for maximum data sovereignty, evaluating the feasibility of self-hosting the open-weight Voxtral model presents a powerful long-term strategy, despite the initial engineering investment [[14](https://huggingface.co/blog/azhan77168/voxtral-tts)].

## Architectural Strategies for Latency Reduction in LiveVoice Agents

Achieving a low-latency, natural-feeling conversation with an AI voice assistant is not solely dependent on selecting a fast API; it requires a holistic architectural approach that minimizes delays at every stage of the pipeline. The typical end-to-end latency in a voice AI system can range from 1 to 3 seconds, far exceeding the human conversational response window of 200-500ms [[7](https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it), [8](https://introl.com/blog/voice-ai-infrastructure-real-time-speech-agents-asr-tts-guide-2025)]. To bridge this gap, the `smeMaster` architecture must incorporate several key optimization strategies. These include implementing streaming at every layer of the pipeline, co-locating services geographically, leveraging advanced models with integrated functionality, and using efficient network transport protocols. These architectural choices are often more impactful than simply swapping one API for another and represent crucial "solution shortcuts" for building a responsive voice agent.

The single most effective strategy for reducing perceived latency is to implement a fully streaming architecture, where audio, text, and processing occur in overlapping stages rather than sequentially [[23](https://getbluejay.ai/blog/12-ways-to-reduce-voice-agent-latency), [27](https://inworld.ai/resources/best-speech-to-speech-apis)]. A traditional batch-processing pipeline waits for a user to finish speaking, then transcribes the entire utterance, processes the full transcript with an LLM, generates the full audio response, and finally plays it back. This introduces significant waiting periods at each step. In contrast, a streaming architecture begins processing as soon as data becomes available. The process starts with streaming audio from the client to the Speech-to-Text (STT) service via WebSockets [[27](https://inworld.ai/resources/best-speech-to-speech-apis)]. The STT service returns partial transcripts in real-time as the user speaks, allowing the downstream components to begin acting on the information before the utterance is complete [[23](https://getbluejay.ai/blog/12-ways-to-reduce-voice-agent-latency), [26](https://www.sigmamind.ai/blog/how-to-optimize-stt-tts-llm-layers-for-cost-and-quality)]. This technique, known as preemptive generation, can shave hundreds of milliseconds off the response time [[21](https://livekit.com/blog/understand-and-improve-agent-latency)]. The Large Language Model (LLM) should then stream its generated tokens back to the Text-to-Speech (TTS) engine. Instead of waiting for the entire response from the LLM, the TTS engine begins synthesizing audio chunks as soon as it receives the first few words or sentences [[23](https://getbluejay.ai/blog/12-ways-to-reduce-voice-agent-latency), [46](https://autognosi.medium.com/sub-second-voice-ai-agent-architecture-no-frameworks-75-lower-per-session-cost-a51e0605a181)]. This overlapping of the LLM inference and TTS synthesis stages is critical, as these two components typically account for over 90% of the total delay in a voice agent pipeline [[25](https://dev.to/cloudx/cracking-the-1-second-voice-loop-what-we-learned-after-30-stack-benchmarks-427)]. The result is a dramatic reduction in the Time-to-First-Audio (TTFA), the moment the user hears the agent's response, which is the most critical metric for perceived conversational quality [[23](https://getbluejay.ai/blog/12-ways-to-reduce-voice-agent-latency)]. The LiveKit Agents framework is designed to facilitate this kind of streaming pipeline, providing abstractions for feeding real-time media and data through an AI pipeline [[10](https://docs.livekit.io/agents/)].

Co-location of services is another hard limit on achievable latency. Network round-trip time (RTT) is a significant contributor to total delay, with RTTs between US and Europe averaging 80-150ms [[7](https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it)]. Deploying the FastAPI orchestration server and LiveKit agent workers in the same geographic region as the chosen AI API endpoints (e.g., Deepgram's EU cluster) can reduce this inter-service network latency from dozens of milliseconds to single-digit milliseconds [[21](https://livekit.com/blog/understand-and-improve-agent-latency), [22](https://cerebrium.ai/blog/deploying-a-global-scale-ai-voice-agent-with-500ms-latency)]. This physical proximity is critical because the agent's lifecycle is managed by an agent server that boots a job subprocess upon being dispatched to a room [[10](https://docs.livekit.io/agents/)]. Therefore, deploying this infrastructure close to the models it interacts with is paramount for low latency [[24](https://www.linkedin.com/posts/livekitco_how-can-i-improve-my-agents-latency-is-activity-7449551258589511680-NpsP)]. Some platforms, like Cerebrium, explicitly highlight their ability to reduce inter-service latency to ~2ms by deploying services within the same cluster, saving over 150ms compared to standard API calls [[22](https://cerebrium.ai/blog/deploying-a-global-scale-ai-voice-agent-with-500ms-latency)]. For `smeMaster`, this means provisioning the FastAPI and LiveKit worker instances in a cloud provider's EU region that hosts the Deepgram or Gladia endpoints.

The choice of models and their inherent features can also yield substantial latency savings. For example, using a model with integrated end-of-turn detection, such as Deepgram's Flux model, can save 200-600ms compared to a traditional setup that requires a separate Voice Activity Detection (VAD) layer to determine when a user has finished speaking [[5](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)]. Deepgram's Flux model handles this natively, allowing the LLM to begin generating a response sooner [[2](https://deepgram.com/learn/best-speech-to-text-apis)]. Similarly, the architectural pattern of the agent itself matters. A "half-cascade" architecture, which uses a real-time STT/LLM but a separate TTS node, will inherently be slower than a fully integrated real-time model because the total latency is determined by the slowest component [[21](https://livekit.com/blog/understand-and-improve-agent-latency), [24](https://www.linkedin.com/posts/livekitco_how-can-i-improve-my-agents-latency-is-activity-7449551258589511680-NpsP)]. Furthermore, optimizing the Voice Activity Detection (VAD) and endpointing logic is crucial. Parameters like 'hangover' time—the duration to wait after speech ends before declaring a turn complete—must be carefully tuned. A short hangover risks cutting off final words, while a long one creates awkward silences that break the flow [[26](https://www.sigmamind.ai/blog/how-to-optimize-stt-tts-llm-layers-for-cost-and-quality)]. Using a model with semantic VAD, like Deepgram Flux, can lead to more natural turn-taking by delivering complete thoughts in a single turn [[19](https://www.linkedin.com/posts/nicholaswleonard_okay-less-slop-post-today-lets-compare-activity-7429894962143637504-trum)].

Finally, the choice of network transport protocol is a subtle but important optimization. For browser and mobile clients, WebRTC is strongly recommended over traditional WebSocket for media transport [[26](https://www.sigmamind.ai/blog/how-to-optimize-stt-tts-llm-layers-for-cost-and-quality)]. WebRTC operates over UDP, which prioritizes speed over perfect reliability. In a lossy network, it is preferable to lose a few audio packets than to cause a long pause while waiting for a lost packet to be retransmitted, which can happen with TCP-based WebSocket [[26](https://www.sigmamind.ai/blog/how-to-optimize-stt-tts-llm-layers-for-cost-and-quality)]. WebRTC's use of protocols like Opus codec at a wideband sample rate of 16 kHz also captures more speech detail than the narrowband 8 kHz standard, which can improve STT accuracy [[26](https://www.sigmamind.ai/blog/how-to-optimize-stt-tts-llm-layers-for-cost-and-quality), [49](https://prodinit.com/blog/production-voice-ai-agents-latency-architecture)]. While SIP/PSTN transport is necessary for connecting to traditional phone numbers, it introduces its own overhead of 200-400ms before any processing can begin [[48](https://deepgram.com/learn/real-time-voice-ai-stack-agents-architecture-guide)]. For the `smeMaster` application, which appears to be built on a modern web architecture, leveraging WebRTC via the LiveKit infrastructure is the correct choice for maximizing responsiveness and audio quality [[10](https://docs.livekit.io/agents/)]. Implementing these architectural strategies—full streaming, service co-location, intelligent model selection, and efficient transport—collectively addresses the core challenge of latency and forms the foundation for a truly interactive and natural-sounding voice assistant.

## Comprehensive Cost Optimization Framework for Sustainable Operations

While selecting a low-cost API is a starting point, achieving sustainable operations for a voice AI assistant requires a multi-layered cost optimization framework that addresses token compounding, leverages caching, implements intelligent model routing, and considers the total cost of ownership beyond just API fees. The `smeMaster` project can significantly reduce its monthly expenditure by adopting these strategies, which shift the focus from merely picking the cheapest provider to designing a highly efficient system architecture. These optimizations are not "shortcuts" in the sense of cutting corners, but rather intelligent design patterns that yield substantial long-term financial benefits.

The most insidious source of escalating costs in a conversational AI is context compounding [[50](https://flexprice.io/blog/what-your-voice-ai-stack-actually-costs)]. On each turn, the full history of the conversation (user and agent messages) is sent as input tokens to the LLM. This means the input size grows with every exchange, causing costs to increase non-linearly [[50](https://flexprice.io/blog/what-your-voice-ai-stack-actually-costs)]. A 10-minute call can cost significantly more than 10 times a 1-minute call because the input context at later stages can be exponentially larger than at the beginning [[50](https://flexprice.io/blog/what-your-voice-ai-stack-actually-costs)]. The primary mitigation for this is effective context management. One approach is context windowing, which involves summarizing or truncating older parts of the conversation to keep the input token count manageable [[50](https://flexprice.io/blog/what-your-voice-ai-stack-actually-costs)]. This can be implemented by having a lightweight background LLM asynchronously generate dense summaries of past turns, which are then injected back into the context for the current turn, preserving semantic meaning without paying for the full token cost of the history [[55](https://metadesignsolutions.com/blog/livekit-voice-agent-latency-context-optimization)]. Another strategy is to use Retrieval-Augmented Generation (RAG) with vector embeddings, where only the most relevant information retrieved from a knowledge base is included in the prompt, rather than the entire conversation history [[6](https://comparevoiceai.com/blog/cost-optimisation-voice-agent/)]. This keeps prompts lean, reduces latency, and lowers costs at scale [[26](https://www.sigmamind.ai/blog/how-to-optimize-stt-tts-llm-layers-for-cost-and-quality)].

Caching is arguably the most powerful and direct method for cost reduction. There are two primary areas to target: LLM prompts and TTS audio. Caching LLM prompt prefixes can drastically cut down on redundant processing, though eligibility varies by provider [[6](https://comparevoiceai.com/blog/cost-optimisation-voice-agent/)]. More impactful is aggressive TTS audio caching. Many voice agent interactions involve repetitive phrases: greetings, confirmations ("OK"), transitions ("Let me check that for you"), and standard instructions [[9](https://www.cognigy.com/glossary/what-is-tts-caching), [23](https://getbluejay.ai/blog/12-ways-to-reduce-voice-agent-latency)]. By pre-synthesizing the audio for these common utterances and storing them locally, the system can serve them instantly from cache instead of making a real-time API call [[7](https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it)]. The latency introduced by a TTS API call can be 100-500 milliseconds, and the cost is incurred for every character generated [[9](https://www.cognigy.com/glossary/what-is-tts-caching)]. Caching eliminates both the latency and the cost for frequently used phrases, leading to faster interactions and significant savings, especially in high-volume deployments [[9](https://www.cognigy.com/glossary/what-is-tts-caching)]. An implementation can use a hash-based key derived from the text and voice ID to store and retrieve cached audio files [[6](https://comparevoiceai.com/blog/cost-optimisation-voice-agent/)]. One case study reported covering 9.8 billion tokens with a cache hit rate of 84%, resulting in a 59% to 70% reduction in total LLM spending, demonstrating the profound impact of request design and caching infrastructure [[47](https://www.linkedin.com/posts/yash-upadhyayy1_ai-voice-calling-tools-comparison-activity-7504500725339631616-Rawx)].

Intelligent model orchestration allows the system to dynamically route requests to the most appropriate and cost-effective model for the task at hand. Instead of using a single, expensive, and powerful LLM for every query, a cascading or waterfall approach can be implemented [[26](https://www.sigmamind.ai/blog/how-to-optimize-stt-tts-llm-layers-for-cost-and-quality)]. Simple, straightforward questions can be routed to a small, fast, and cheap model like GPT-4o-mini or Claude Haiku, which have low latency and input costs [[8](https://introl.com/blog/voice-ai-infrastructure-real-time-speech-agents-asr-tts-guide-2025), [49](https://prodinit.com/blog/production-voice-ai-agents-latency-architecture)]. If the simple model cannot handle the request confidently, the query can be escalated to a larger, more capable, and more expensive model like GPT-4o or Claude Sonnet [[26](https://www.sigmamind.ai/blog/how-to-optimize-stt-tts-llm-layers-for-cost-and-quality)]. Research has shown that smart cascades can match the performance of top-tier models while reducing costs by up to 98% [[26](https://www.sigmamind.ai/blog/how-to-optimize-stt-tts-llm-layers-for-cost-and-quality)]. Platforms like LiveKit Agents and Inworld AI's router are designed to facilitate this kind of dynamic model routing, treating models as interchangeable execution targets [[10](https://docs.livekit.io/agents/), [27](https://inworld.ai/resources/best-speech-to-speech-apis)]. This allows for continuous optimization of quality versus cost without rewriting application code [[47](https://www.linkedin.com/posts/yash-upadhyayy1_ai-voice-calling-tools-comparison-activity-7504500725339631616-Rawx)].

Finally, the total cost of ownership must be considered, including infrastructure, engineering overhead, and reliability measures [[47](https://www.linkedin.com/posts/yash-upadhyayy1_ai-voice-calling-tools-comparison-activity-7504500725339631616-Rawx)]. At high, predictable utilization, self-hosting open-source models like Whisper for STT or Kokoro for TTS can be more cost-effective than managed services, as it shifts the expense from per-minute API fees to amortized GPU hardware costs [[6](https://comparevoiceai.com/blog/cost-optimisation-voice-agent/), [13](https://inworld.ai/resources/elevenlabs-alternatives)]. However, this comes with the trade-off of increased engineering overhead for hosting, maintenance, and scaling [[22](https://cerebrium.ai/blog/deploying-a-global-scale-ai-voice-agent-with-500ms-latency)]. For `smeMaster`, a balanced approach is likely optimal. For instance, using a highly optimized, usage-based API like Cartesia for TTS ensures predictable costs without the burden of managing GPU instances. Similarly, while a custom-built system offers control, using a managed orchestration platform like Retell AI or Vapi can accelerate development, though it comes with a monthly fee that includes the orchestration service [[28](https://www.cekura.ai/blogs/best-voice-ai-apis-real-time-audio-processing), [51](https://hamming.ai/resources/best-voice-agent-stack)]. The key is to model the total cost per completed outcome (e.g., a resolved query) rather than just cost per token, as this metric connects inference costs directly to business value [[47](https://www.linkedin.com/posts/yash-upadhyayy1_ai-voice-calling-tools-comparison-activity-7504500725339631616-Rawx)]. By combining context management, aggressive caching, intelligent model routing, and a thoughtful assessment of total cost, the `smeMaster` project can build a voice assistant that is not only effective and compliant but also economically sustainable at scale.

## Ensuring EU Data Sovereignty and French Legal Compliance

Adhering to EU data protection regulations is a non-negotiable requirement for the `smeMaster` voice assistant, extending beyond standard GDPR compliance to encompass specific national laws and stringent certification standards. A superficial approach, such as merely using an "EU endpoint," is insufficient. A robust compliance posture demands a deep understanding of the distinctions between data residency and data sovereignty, rigorous due diligence on third-party vendors, and awareness of specialized certifications like France's HDS (Hébergeur de Données de Santé). Failure to navigate this complex legal landscape can result in severe penalties, including criminal sanctions for violations of French law [[39](https://ainora.lt/blog/ai-voice-agent-cnil-compliance-france-guide), [74](https://www.privacyworld.blog/2026/05/v2-0-certification-of-french-health-data-hosting-service-providers-hds-now-fully-effective/)].

The fundamental principle of data sovereignty dictates that personal data must be processed and stored within the geographical boundaries of the European Economic Area (EEA) [[52](https://www.gladia.io/blog/hds-and-french-healthcare-data-residency-for-voice-transcription), [74](https://www.privacyworld.blog/2026/05/v2-0-certification-of-french-health-data-hosting-service-providers-hds-now-fully-effective/)]. This goes beyond simply choosing a data center in Frankfurt; it requires contractual guarantees that prevent data from being transferred outside the EEA for processing, backup, or maintenance [[79](https://www.galeon.care/blog/title-health-data-hosting-how-to-choose-your-hds-provider-in-2026)]. When vetting an AI provider, it is imperative to verify that the signed Data Processing Agreement (DPA) explicitly names the processing region and includes clauses that anchor data residency to the EEA with no exceptions [[62](https://dev.to/jamesanderson121/choosing-a-gdpr-compliant-speech-to-text-api-with-eu-data-residency-2nh7), [79](https://www.galeon.care/blog/title-health-data-hosting-how-to-choose-your-hds-provider-in-2026)]. Furthermore, the practice of training AI models on customer-submitted data must be addressed. Many providers use this data by default to improve their models, which can create compliance risks [[17](https://www.gladia.io/blog/best-elevenlabs-alternatives-for-speech-to-text-gladia-deepgram-assemblyai-compared)]. Paid plans from reputable providers like Gladia and AssemblyAI typically opt-out of this practice, but it must be confirmed in writing, as opting out can sometimes affect pricing [[17](https://www.gladia.io/blog/best-elevenlabs-alternatives-for-speech-to-text-gladia-deepgram-assemblyai-compared), [37](https://www.gladia.io/blog/enterprise-and-on-premise-speech-to-text-security-sla-and-data-residency)]. Requesting the provider's current SOC 2 Type II report under NDA is also a critical step to assess their internal security controls and governance practices [[62](https://dev.to/jamesanderson121/choosing-a-gdpr-compliant-speech-to-text-api-with-eu-data-residency-2nh7)].

For applications that may handle special-category data, such as personal health information, the regulatory requirements become even more stringent. In France, hosting such data is governed by the HDS certification framework, mandated by Article L.1111-8 of the French Public Health Code [[52](https://www.gladia.io/blog/hds-and-french-healthcare-data-residency-for-voice-transcription), [73](https://docs.varsome.com/en/hebergeur-de-donnees-de-sante)]. This certification is separate from and complementary to GDPR, focusing specifically on the security and integrity of health data hosting [[68](https://scalingo.com/blog/health-data-hosting)]. To be HDS-certified, a provider must meet a framework of 31 requirements validated by an accredited body, covering ISMS, contractual relationships, and mandatory data residency within the EEA [[80](https://www.schellman.com/blog/healthcare-compliance/hds-certification-benefits-for-ai-providers)]. The latest version, HDS v2.0, further strengthens data sovereignty obligations, and a transition to a new v2.1 version is underway, which will mandate storage of personal health data exclusively within the EEA [[66](https://www.schellman.com/blog/healthcare-compliance/hds-v2.1-certification-explained), [74](https://www.privacyworld.blog/2026/05/v2-0-certification-of-french-health-data-hosting-service-providers-hds-now-fully-effective/)]. Major cloud providers like Microsoft Azure and Google Cloud have achieved HDS certification for certain services and regions, making them viable options for healthcare-related workloads [[65](https://learn.microsoft.com/en-us/compliance/regulatory/offering-hds-france), [67](https://security.googlecloudcommunity.com/ciso-blog-77/google-cloud-achieves-hds-v2-0-certification-raising-the-bar-for-secure-health-data-hosting-in-france-5906)]. If `smeMaster` ever expands to handle health data, it would be essential to select a provider with a named HDS scope that covers all activities, from data hosting to backup and restoration [[79](https://www.galeon.care/blog/title-health-data-hosting-how-to-choose-your-hds-provider-in-2026)].

In addition to technical and contractual safeguards, transparency and user consent are critical under both GDPR and the upcoming EU AI Act. The French data protection authority, CNIL, expects clear transparency, requiring systems to explicitly state they are AI-powered and explain what data they collect and how it is used [[39](https://ainora.lt/blog/ai-voice-agent-cnil-compliance-france-guide)]. For call recording, a specific consent announcement is legally required, informing participants that the call may be recorded for service improvement and providing a mechanism to refuse [[39](https://ainora.lt/blog/ai-voice-agent-cnil-compliance-france-guide)]. Under French law, recording private communications without consent is a criminal offense, punishable by imprisonment and fines [[39](https://ainora.lt/blog/ai-voice-agent-cnil-compliance-france-guide)]. The system must also be able to handle data subject rights requests, such as erasure. A Data Protection Impact Assessment (DPIA) is mandatory for certain AI voice processing operations under CNIL guidelines, particularly those involving innovative technologies or large-scale processing [[39](https://ainora.lt/blog/ai-voice-agent-cnil-compliance-france-guide)]. Given the distributed nature of agentic AI, which can create opaque "memory instances" across multiple agents, exercising these rights becomes technically challenging and requires robust traceability mechanisms to reconstruct data flows and manage deletions effectively [[38](https://www.insideprivacy.com/artificial-intelligence/french-cnil-publishes-note-on-agentic-ai-and-data-protection/)]. For `smeMaster`, this means the architecture must be designed with compliance in mind from the outset, incorporating features for audit logging, granular user controls, and mechanisms to partition and expire memory instances [[11](https://joshuafields.uk/blog/building-real-time-voice-ai-applications-livekit-fastapi), [38](https://www.insideprivacy.com/artificial-intelligence/french-cnil-publishes-note-on-agentic-ai-and-data-protection/)].

| Compliance Aspect | Requirement | Key Considerations for smeMaster |
| :--- | :--- | :--- |
| **Data Residency** | Personal data must be processed and stored within the EEA [[52](https://www.gladia.io/blog/hds-and-french-healthcare-data-residency-for-voice-transcription)]. | Verify provider contracts explicitly name an EEA region and prohibit cross-border transfers. Use providers with dedicated EU endpoints (e.g., Deepgram, Gladia) or self-hosting options. |
| **Model Training** | Customer data should not be used for model training without explicit opt-out [[37](https://www.gladia.io/blog/enterprise-and-on-premise-speech-to-text-security-sla-and-data-residency)]. | Confirm this policy is disabled by default on paid plans. Be aware that opting out may affect pricing (e.g., Deepgram) [[17](https://www.gladia.io/blog/best-elevenlabs-alternatives-for-speech-to-text-gladia-deepgram-assemblyai-compared)]. |
| **Certifications** | Look for GDPR, SOC 2 Type II, and ISO 27001 [[1](https://www.gladia.io/blog/best-speech-to-text-apis)]. | Request SOC 2 reports under NDA to verify internal controls. For healthcare, HDS certification is mandatory [[68](https://scalingo.com/blog/health-data-hosting)]. |
| **Health Data (HDS)** | Hosting PHI requires an HDS-certified provider in France [[52](https://www.gladia.io/blog/hds-and-french-healthcare-data-residency-for-voice-transcription)]. | If applicable, select a provider with a named HDS scope covering all necessary activities. Major clouds like Azure and Google Cloud are HDS certified [[65](https://learn.microsoft.com/en-us/compliance/regulatory/offering-hds-france), [67](https://security.googlecloudcommunity.com/ciso-blog-77/google-cloud-achieves-hds-v2-0-certification-raising-the-bar-for-secure-health-data-hosting-in-france-5906)]. |
| **Transparency & Consent** | Must inform users they are interacting with an AI and obtain consent for recording [[39](https://ainora.lt/blog/ai-voice-agent-cnil-compliance-france-guide)]. | Implement a pre-call announcement. Hardcode a disclosure message in the first TTS response to comply with the EU AI Act [[46](https://autognosi.medium.com/sub-second-voice-ai-agent-architecture-no-frameworks-75-lower-per-session-cost-a51e0605a181)]. Provide a clear opt-out to a human agent. |
| **User Rights** | Must support data subject rights, including access and erasure [[38](https://www.insideprivacy.com/artificial-intelligence/french-cnil-publishes-note-on-agentic-ai-and-data-protection/)]. | Design the architecture with traceability to manage deletion requests across all components of the agent stack. |

In conclusion, ensuring compliance for `smeMaster` is an ongoing process of due diligence, contractual negotiation, and architectural design. The project should prioritize working with providers that have a proven track record in the EU, offer clear data residency guarantees, and are transparent about their data usage policies. Engaging legal counsel to review DPAs and provider contracts is highly advisable. By embedding compliance principles into the core of the system design—from data handling and retention policies to user consent workflows—the project can build a trustworthy voice assistant that meets the highest standards of data protection in Europe.

## Implementation Roadmap and Strategic Recommendations

This section provides a concrete, phased implementation roadmap for integrating the AI voice assistant into `smeMaster`, grounded in the preceding analyses. The recommendations are designed to deliver a functional, low-latency, and compliant system while allowing for iterative optimization and cost management. The roadmap prioritizes a pragmatic approach, starting with a proven, low-latency stack and progressively introducing advanced optimizations and cost-saving mechanisms.

**Phase 1: Foundation and Initial Deployment (MVP)**

The initial phase focuses on establishing a working prototype that validates the core conversational flow with acceptable latency and French language support. The goal is to achieve a Minimum Viable Product (MVP) quickly to gather real-world feedback.

1.  **Core Architecture and API Selection:**
    *   **STT Provider:** Select **Deepgram** as the primary Speech-to-Text provider. Utilize the **Flux model** for its integrated end-of-turn detection, which is critical for reducing agent response time by 200-600ms [[5](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)]. Explicitly route all API calls to the official EU endpoint, `api.eu.deepgram.com`, to guarantee data residency within the EEA from day one [[36](https://deepgram.com/learn/deepgram-eu-endpoint-now-generally-available)].
    *   **TTS Provider:** Select **Cartesia** as the primary Text-to-Speech provider. Leverage its **Sonic model** for its industry-leading Time-to-First-Audio (TTFA) of ~40-90ms, which is essential for maintaining a natural conversational rhythm [[69](https://www.codesota.com/speech/elevenlabs-vs-cartesia), [70](https://www.famulor.io/fr/blog/cartesia-sonic-elevenlabs-and-minimax-the-ultimate-comparison-for-ai-voice-agents-and-famulors-strategic-advantage)].
    *   **Orchestration:** Build the pipeline using the existing FastAPI/LiveKit sidecar architecture. The architecture should follow a fully streaming model: Audio -> Deepgram STT (Streaming) -> FastAPI Orchestrator -> Groq-hosted Llama 3.1 or another fast LLM (Streaming) -> Cartesia TTS (Streaming) -> Audio [[27](https://inworld.ai/resources/best-speech-to-speech-apis), [46](https://autognosi.medium.com/sub-second-voice-ai-agent-architecture-no-frameworks-75-lower-per-session-cost-a51e0605a181)].

2.  **Initial Compliance Setup:**
    *   Draft a preliminary Data Processing Agreement (DPA) with Deepgram and Cartesia, focusing on data residency in the EU and the prohibition of data usage for model training on paid tiers [[62](https://dev.to/jamesanderson121/choosing-a-gdpr-compliant-speech-to-text-api-with-eu-data-residency-2nh7)].
    *   Implement a mandatory pre-call announcement, using a hardcoded TTS utterance, to inform callers that they are interacting with an AI, complying with CNIL transparency guidelines [[39](https://ainora.lt/blog/ai-voice-agent-cnil-compliance-france-guide), [46](https://autognosi.medium.com/sub-second-voice-ai-agent-architecture-no-frameworks-75-lower-per-session-cost-a51e0605a181)].

3.  **Immediate Optimization - TTS Caching:**
    *   Begin developing a local, in-memory or file-based TTS audio cache. Populate it with a small set of frequently used French phrases, such as greetings ("Bonjour", "Comment allez-vous ?"), confirmations ("OK", "Je confirme"), and common errors ("Je ne comprends pas"). This will immediately reduce latency and future API costs for these interactions [[7](https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it), [9](https://www.cognigy.com/glossary/what-is-tts-caching)].

**Phase 2: Optimization and Scaling**

Once the MVP is stable, this phase focuses on enhancing performance, managing costs at scale, and improving the quality of the interaction.

1.  **Advanced Context Management:**
    *   Implement a sliding-window or summarization strategy for the LLM context. To mitigate the "context compounding" problem, older conversation turns should be summarized and replaced with a concise representation before being passed to the LLM on subsequent turns. This will prevent exponential growth in input token counts and stabilize costs [[50](https://flexprice.io/blog/what-your-voice-ai-stack-actually-costs), [55](https://metadesignsolutions.com/blog/livekit-voice-agent-latency-context-optimization)].

2.  **Multi-Model Orchestration:**
    *   Introduce a model routing layer within the FastAPI orchestrator. Route simple, factual queries to a fast, low-cost LLM tier (e.g., GPT-4o-mini, Claude Haiku) [[8](https://introl.com/blog/voice-ai-infrastructure-real-time-speech-agents-asr-tts-guide-2025)]. Implement confidence scoring to escalate more complex or ambiguous queries to a more capable and expensive model (e.g., GPT-4o, Claude Sonnet) [[26](https://www.sigmamind.ai/blog/how-to-optimize-stt-tts-llm-layers-for-cost-and-quality)]. This balances performance and cost effectively.

3.  **Expanded Caching and Monitoring:**
    *   Expand the TTS cache to cover a wider range of common phrases based on call analytics.
    *   Implement comprehensive observability. Track key metrics like end-to-end turn latency percentiles, STT finalization time, LLM Time-to-First-Token (TTFT), and TTS Time-to-First-Byte (TTFB) [[11](https://joshuafields.uk/blog/building-real-time-voice-ai-applications-livekit-fastapi), [27](https://inworld.ai/resources/best-speech-to-speech-apis)]. Use structured logs keyed by session ID to enable replayable debugging.

4.  **Evaluation of Alternatives:**
    *   If budget permits and voice quality is a higher priority than absolute lowest latency, evaluate replacing Cartesia with **ElevenLabs Flash v2.5**. This would provide access to a larger voice library and potentially more natural-sounding prosody, albeit with a slightly higher latency [[8](https://introl.com/blog/voice-ai-infrastructure-real-time-speech-agents-asr-tts-guide-2025), [70](https://www.famulor.io/fr/blog/cartesia-sonic-elevenlabs-and-minimax-the-ultimate-comparison-for-ai-voice-agents-and-famulors-strategic-advantage)].
    *   If the project handles any form of personal health data, proactively investigate migrating the STT/TTS workloads to an HDS-certified provider like **Gladia**, which holds the necessary certifications and has demonstrated strong performance on French audio [[37](https://www.gladia.io/blog/enterprise-and-on-premise-speech-to-text-security-sla-and-data-residency), [52](https://www.gladia.io/blog/hds-and-french-healthcare-data-residency-for-voice-transcription)].

**Phase 3: Advanced Compliance and System Resilience**

This final phase focuses on enterprise-grade features, ensuring long-term reliability, and solidifying the compliance posture.

1.  **Formalize Compliance and Contracts:**
    *   Engage legal counsel to finalize and execute the DPAs with all AI service providers. Ensure all contractual terms explicitly reference the HDS framework if applicable and specify the exact scope of the provider's certifications [[62](https://dev.to/jamesanderson121/choosing-a-gdpr-compliant-speech-to-text-api-with-eu-data-residency-2nh7), [79](https://www.galeon.care/blog/title-health-data-hosting-how-to-choose-your-hds-provider-in-2026)].

2.  **Implement Multi-Provider Failover:**
    *   Build a resilient AI API layer that functions as an intelligent router [[47](https://www.linkedin.com/posts/yash-upadhyayy1_ai-voice-calling-tools-comparison-activity-7504500725339631616-Rawx)]. Implement a fallback chain where, if the primary STT provider fails or exceeds a latency threshold, the system automatically routes the request to a secondary provider (e.g., AssemblyAI or Soniox) [[5](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/), [46](https://autognosi.medium.com/sub-second-voice-ai-agent-architecture-no-frameworks-75-lower-per-session-cost-a51e0605a181)]. This enhances system reliability and prevents service outages.

3.  **Explore Advanced Architectural Options:**
    *   **Self-Hosting for Cost Control:** For very high-volume use cases, conduct a proof-of-concept on self-hosting an open-source TTS model like **Voxtral TTS**. This would eliminate API costs entirely and provide maximum data sovereignty, representing a significant long-term cost saving [[14](https://huggingface.co/blog/azhan77168/voxtral-tts)]. This requires an assessment of the team's infrastructure and DevOps capabilities.
    *   **Hybrid Architectures:** Experiment with a hybrid architecture, using the low-latency cascade (STT->LLM->TTS) for most of the conversation, but switching to a native speech-to-speech (S2S) model for simple, chit-chat turns to achieve even lower latency [[46](https://autognosi.medium.com/sub-second-voice-ai-agent-architecture-no-frameworks-75-lower-per-session-cost-a51e0605a181), [51](https://hamming.ai/resources/best-voice-agent-stack)].

By following this phased roadmap, the `smeMaster` project can systematically build a sophisticated, cost-effective, and compliant AI voice assistant. Starting with a high-performance, low-latency stack from Day 1 ensures a positive user experience, while the subsequent phases of optimization and resilience-building will ensure the system remains scalable and economically viable as it grows.

---

# Part 6 — Self-Hosted Speech with sherpa-onnx

> **Added 2026-09-28.** Inspired by [`k2-fsa/sherpa-onnx`](https://github.com/k2-fsa/sherpa-onnx)
> and its React Native TurboModule binding
> [`XDcobra/react-native-sherpa-onnx`](https://github.com/XDcobra/react-native-sherpa-onnx).
> Verified against repo metadata, the source tree, and the HuggingFace registry on 2026-09-28.
> **This part is not a replacement for the signed stack** — it is a candidate for the
> `ProviderTier` fallback chain in spec Gate 5. See §6.6.

## 6.1 Why this axis matters more than anything in Parts 1–5

Parts 1–5 optimise **within** a vendor stack: which vendor, which model, which caching
strategy. Every one of them keeps a per-minute meter running. Part 6 removes the dominant
one — and the arithmetic says that is the whole game at our volume.

`COST-MODEL.md` §1's variable line, recomputed from its own components (2026-09-28):

| Component (pilot volume) | $/min |
|---|---|
| Carrier (Telnyx inbound FR) | 0.004–0.009 |
| Transfer leg (~15% of calls) | 0.003–0.008 |
| STT (Deepgram Nova) | 0.004–0.007 |
| LLM (Gemini Flash via OpenRouter) | 0.002–0.005 |
| **Non-TTS floor** | **0.013–0.029** |
| TTS (ElevenLabs, Creator/Pro tier) | 0.100–0.210 |
| **All-in as signed** | **0.113–0.239** |
| **TTS share of the variable cost** | **88%** |

**TTS is 88% of the variable cost.** Every other optimisation in this document — caching,
routing, context windowing, co-location — competes for the remaining 12%. Replacing the TTS
line is not an incremental win; it is the only order-of-magnitude lever available.

At pilot volume the monthly effect:

| Monthly minutes | Current all-in (vendor TTS) | With self-hosted TTS | Recovered |
|---|---|---|---|
| 200 | $22.60 – 47.80 | $2.60 – 5.80 | **$20 – 42** |
| 400 | $45.20 – 95.60 | $5.20 – 11.60 | **$40 – 84** |
| 600 | $67.80 – 143.40 | $7.80 – 17.40 | **$60 – 126** |

**And it reopens a pricing shape we had to reject.** `COST-MODEL.md` §3 discarded Shape A
(€150/mo + €0.25/min) as "leaves no margin for 24/7 ops" — because at a $0.113–0.239/min
variable cost, a €0.25/min rate is nearly all cost. Against a **$0.013–0.029/min** floor, Shape
A's per-minute margin goes from **$0.011–0.137/min to $0.221–0.237/min**. The client-facing
pricing frontier is wider than the current document claims, and that is a commercial
conversation we can now have rather than one we have to avoid.

## 6.2 What sherpa-onnx is

| Property | Value (verified 2026-09-28) |
|---|---|
| Licence | **Apache-2.0** — permissive, direct dependency OK, no copyleft |
| Repo | `k2-fsa/sherpa-onnx` — C++, 15,012★, last push **2026-09-22** (active) |
| Scope | STT (offline **and streaming**), TTS (batch **and streaming**), **VAD**, speaker diarization, speech enhancement, source separation, keyword spotting |
| Runtime | onnxruntime, **no Internet connection required** |
| Targets | x86_64 servers, Android, iOS, HarmonyOS, embedded/Raspberry Pi, RISC-V, RK/Axera/Ascend NPU |
| Bindings | 12 languages — C API, **Python**, **Rust**, Java, Kotlin, Swift, Go, .NET, Node.js, Pascal |
| Distribution | pip wheel (`setup.py` at repo root), prebuilt shared libs, Rust crates, model files as ONNX on HF + GitHub Releases |

**Two properties make this a fit for `smeMaster` that the alternatives in Parts 1–5 lack:**
it is **CPU-capable** (no GPU line item — the reason the draft's "self-host at high volume"
argument does not transfer), and it ships **both a Python and a Rust binding**, so the same
engine can serve the server-side agent *and* the desktop.

## 6.3 French coverage — verified, not assumed

This is what makes it usable rather than merely interesting. French models already exist for
both directions:

**French ASR (speech → text):**

| Model (HF, `csukuangfj/`) | Kind | Note |
|---|---|---|
| `sherpa-onnx-streaming-zipformer-fr-kroko-2025-08-06` | **streaming** | The live-call model. Streaming is what the low-latency argument in Part 3 needs |
| `sherpa-onnx-nemo-canary-180m-flash-en-es-de-fr` (+ `-int8`) | offline, multilingual | 4 languages incl. FR; contains an int8 build |
| `sherpa-onnx-nemo-fast-conformer-ctc-en-de-es-fr-14288` (+ `-int8`) | offline | CTC variant |
| `sherpa-onnx-nemo-fast-conformer-transducer-en-de-es-fr-14288` (+ `-int8`) | offline | transducer variant |
| `sherpa-onnx-nemo-ctc-fr-conformer-large` | offline, FR-only | largest French-specific |
| 19 × `sherpa-onnx-whisper-*` | offline | Whisper converted to ONNX — the multilingual fallback |

**French TTS (text → speech):** 13 French VITS/Piper voices are published, including
`vits-piper-fr_FR-siwis-medium`, `vits-piper-fr_FR-upmc-medium`, `vits-piper-fr_FR-gilles-low`,
`vits-piper-fr_FR-mls_1840-low`, `vits-piper-fr_FR-tjiho-model1`. The runtime also carries
Kokoro / Kitten / Matcha / Melo TTS families (confirmed in the C++ source tree:
`offline-tts-kokoro-model.cc`, `offline-tts-kitten-model.cc`, `matcha-tts-lexicon.cc`,
`melo-tts-lexicon.cc`) — **which means the spec's existing Kokoro-82M fallback is already
served by this engine**, rather than needing its own integration.

⚠️ **Honest quality caveat.** Piper `-low`/`-medium` voices are **not** ElevenLabs quality.
They are clear and intelligible; they are not warm. That is why §6.6 treats this as a *tier*
rather than a replacement — a French caller noticing a robotic receptionist is a business
problem, not a latency problem.

## 6.4 Which binding — the Rust API, not the React Native wrapper

The React Native wrapper is a good project and **the wrong dependency for this repo**:

| | `XDcobra/react-native-sherpa-onnx` | `k2-fsa/sherpa-onnx` Rust API |
|---|---|---|
| Licence | MIT (ships `THIRD_PARTY_LICENSES`) | Apache-2.0 |
| Momentum | 40★, TypeScript, pushed 2026-09-22 | 15,012★, C++, pushed 2026-09-22 |
| Requires | a **React Native** app | any Rust or Python host |
| Fit here | ❌ `smeMaster` is **Tauri v2 + Rust**, not React Native | ✅ matches `ml-sidecar` |

The Rust binding is real and publishable (`sherpa-onnx/rust/` contains `Cargo.toml`,
`sherpa-onnx-sys` for the FFI layer and `sherpa-onnx` for the safe wrapper; runnable examples
live in `rust-api-examples/`). That matters because **`src-tauri/crates/ml-sidecar` already
proves the pattern** in this repo: a Rust binary, launched as a Tauri sidecar, JSON-RPC over
stdio. Offline French STT/TTS on the desktop is therefore an *addition to an existing
proven seam*, not a new subsystem.

**Port the patterns, not the code** (`SPEC` invariant 5). The wrapper's own docs directory is
the useful artifact — these are the shapes worth reimplementing in our types:

| Pattern in the wrapper (`docs/`) | Why it is worth porting |
|---|---|
| `execution-providers.md` — CPU / NNAPI / XNNPACK / QNN as **explicit config** | Same discipline as our provider seams: the compute backend is a config value, not a build decision |
| `download-manager.md` — resumable, background-capable model downloads with progress + a foreground service on Android | Exactly the problem `aiSidecar.ts` / `ragStore.ts` hit today with `aiDownloadModel` |
| `hotwords.md` | **Per-tenant bias lists** — boost the client's product names, staff names and place names. Direct containment win on a receptionist KB |
| `stt-streaming.md`, `tts-streaming.md`, `pcm-live-stream.md` | The streaming PCM contract our four seams already need |
| `vad.md`, `diarization.md`, `tts-alignment.md` | VAD is the `VAD` stage mark in `CALL-FLOW.md` §3; alignment supports word-level latency attribution |

Do **not** copy its field names, its module layout, or its transport. The shape migrates; the
names do not.

## 6.5 Where the runtime sits, relative to our boundaries

Two placements are legitimate, and they are not the same decision:

| Placement | Binding | Boundary | When |
|---|---|---|---|
| **Server-side** — `agent-core` calls a local sherpa-onnx engine | Python API, or a local **websocket server process** (the repo ships `streaming_server.py`, `http_server.py`, plus websocket clients: `online-websocket-client-microphone.py`, `two-pass-wss.py`) | Same host, loopback. Keeps the C++ runtime out of the FastAPI process — the same reasoning as `ADR-001` D1 | To make the **budget/off-hours tier** cheap |
| **Desktop-side** — offline STT/TTS in the app | **Rust API**, following the `ml-sidecar` pattern | Existing Tauri sidecar contract, stdio JSON-RPC | For the desktop's local RAG/knowledge workflows, and any future offline capture |

**The websocket server/client split is the architecturally interesting one**: it lets the
realtime audio path live in a C++ process while the orchestration stays in Python, with a
loopback IPC seam. That is the same shape the spec chose for telephony, applied to inference.

## 6.6 Recommended shape — a tier, not a replacement

**Recommendation: add a `selfhosted` tier to the Gate 5 `ProviderTier` chain; do not change the
primary seams.**

| Tier | STT | TTS | Sells as |
|---|---|---|---|
| budget / off-hours | sherpa-onnx streaming FR zipformer | sherpa-onnx Piper FR (`siwis-medium`) | matches `COST-MODEL.md` Shape C's **€0.12/min off-hours** rate |
| standard | Deepgram Nova | ElevenLabs Flash | the signed default |
| premium | Deepgram Nova | ElevenLabs Multilingual v2 | the signed premium |

This composes with, rather than confronts, three decisions already made: the 4-seam invariant
(`ADR-001` D3) is untouched; `COST-MODEL.md` Shape C's "night receptionist at a discount"
becomes *profitable* rather than a margin sacrifice; and the pilot's ±20% realized-cost
criterion (`PILOT-CRITERIA.md`) gets a lever that vendor pricing changes cannot take away.

**Sequencing: do not build this in v1.** It is Gate 5 work at the earliest, and only if the
pilot shows the off-hours volume to justify it. An untested self-hosted voice path shipped
before the first real call is a second system to debug while debugging the first.

## 6.7 Caveats — and the measurement gate that must come first

**1. Our box has 4 vCPU.** Verified 2026-09-28 against the EU VPS: **4 vCPU (AMD EPYC), 6.3 GB
available RAM, load average 0.36, Python 3.12.3 present.** There is headroom, but "no
per-minute fee" does not mean "no cost" — it converts a vendor bill into a **concurrency
ceiling**. Real-time ASR *and* TTS on 4 cores, alongside the agent's own orchestration, caps
simultaneous calls in a way a hosted API does not. **Before any of this is quoted to the
client, measure it:**

```bash
# on the target box, with the streaming FR zipformer + a Piper FR voice loaded
# measure: real-time factor (RTF) per stream, and the call count at which RTF > 1.0
```
The deliverable of that experiment is one number: **maximum concurrent calls at RTF < 1.0.**
If it is below the client's expected peak, the tier is not viable and this part is closed.

**2. Co-location is a bad idea.** That VPS already runs nginx, php-fpm, Laravel, MariaDB,
Redis, Stalwart mail and the deployer, and it is the box we accept a 24/7 on-call commitment
for. Adding a latency-sensitive realtime inference workload to the SaaS box means a slow
Laravel query can cost a phone call. If the tier is built, it belongs on its **own** EU VPS.

**3. CPU cost is not zero and not invisible.** Amortised CPU on a €25–60/mo VPS is what the
saving is *made of*. The saving is real, but it is a swap of vendor bill for instance
footprint — model it as such.

**4. The 12-language / NPU / embedded support is not evidence for our use case.** Support for
Raspberry Pi and RK NPU matters for a future on-device product; it says nothing about French
receptionist quality on a 4-vCPU shared host.

**5. Quality is a product decision, not an engineering one.** A `-low` French voice that
sounds synthetic is worse than a €0.15/min bill the client already agreed to. Demo both to the
client before choosing the tier.

## 6.8 What to do, and at which gate

| Gate | Action |
|---|---|
| **Gate 4** | Keep Deepgram as primary. Add the **turn-detection** evaluation (`CALL-FLOW.md` §3's `VAD` mark) — both the integrated-model option (Part 1/4) and self-hosted VAD are candidates; measure on our audio |
| **Gate 5** | Add `selfhosted` to the `ProviderTier` chain. Run the RTF/concurrency experiment (§6.7) **before** it is offered to the client. Reuse the existing `STTProvider`/`TTSProvider` seams — `ADR-001` D3 means no new architecture |
| **Gate 5** | Adopt **TTS caching** for the greeting, the AI-disclosure line and confirmations — self-hosted rendering makes populating the cache free. Combine with `hotwords` bias lists for containment |
| **Gate 1** | Add **`completion_tokens`/context growth** to the metering events: Part 5's context-compounding point means the per-minute LLM estimate in `COST-MODEL.md` §1 is a floor, and the model should say so |
| **Desktop (separate)** | If offline French speech is ever wanted locally, the **Rust binding** + the existing `ml-sidecar` contract is the path — not the React Native wrapper |

**Cross-references:** [`ADR-001`](../../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) ·
[`OSS landscape`](../../06-ROADMAP/15-voice-agent-oss-landscape.md) (sherpa-onnx added as a
candidate under P2/P6/P7) · [`COST-MODEL.md`](../client/COST-MODEL.md) · [`RAG-FORK.md`](RAG-FORK.md) ·
[`CALL-FLOW.md`](CALL-FLOW.md) §3 · [`AGENT-PROMPTS.md`](AGENT-PROMPTS.md)