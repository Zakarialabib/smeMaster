# Open-weight FR/EN speech models — verified 2026-09-28

> Source: DeepSeek research brief, **independently verified** against the Hugging
> Face API rather than taken on trust. Verification method is recorded per row so
> the next person can repeat it.
>
> **Why this doc exists:** the brief's headline recommendation was
> *"Voxtral 4B TTS + Whisper-Large-V3-French — the strongest open-weight
> pairing."* The brief then contradicts itself three paragraphs later, and **the
> brief is wrong on the headline**. Voxtral TTS is CC-BY-NC-4.0. This is a
> commercial client project, so the fastest model on the list is the one we
> cannot ship.

## The headline finding

**Voxtral 4B TTS is disqualified for this project, despite being the fastest and
the purpose-built choice.**

```
curl -s "https://huggingface.co/api/models/mistralai/Voxtral-4B-TTS-2603"
→ license: cc-by-nc-4.0
```

`CC-BY-NC-4.0` is **non-commercial**. This project bills a French client for
calls. Non-commercial is a hard stop, not a risk to weigh.

The brief reaches the same conclusion in §4 and its decision tree is correct. The
error is that §0, the summary, and the ASCII diagram all still recommend it. **If
only the summary is read, the wrong model ships.** That is why the summary is
wrong here rather than the detail.

> The 70 ms TTFB and the call-center use case are real and genuinely tempting.
> It is the licence, not the engineering judgement, that decides this.

## TTS — verified matrix

| Model | Licence | French | Verdict | Evidence |
|---|---|---|---|---|
| **Voxtral 4B TTS** (mistral) | **CC-BY-NC-4.0** | ✅ native | ❌ **DISQUALIFIED** | HF API: `license:cc-by-nc-4.0` |
| **Chatterbox** (ResembleAI) | **MIT** | ✅ (23 langs) | ✅ **v1 default** | HF API: `license: mit`, `fr` in language list |
| XTTS v2 (coqui) | `other` (CPML) | ✅ | ❌ non-commercial | HF API: `license: other` |
| Kokoro-82M (hexgrad) | Apache-2.0 | ⚠️ `en` only on the main card | 🟡 budget fallback | HF API: `language: ['en']` |
| Parler-TTS mini-v1 | ⚠️ **no licence declared** | ✅ | ❌ unverified | HF API: cardData has no `license` |
| Qwen3-TTS-Flash | ⚠️ **no licence declared** | ✅ | ❌ unverified | HF API: cardData has no `license` |

### Three corrections to the brief

1. **Kokoro-82M is listed as `fr` in the brief's "v1.x" phrasing, but the HF card
   declares `language: ['en']`.** The French voice lives in separate per-language
   model files. Usable for FR, but the claim as written ("fr in v1.x") does not
   match the metadata — treat French Kokoro as **needs its own verification pass**
   before it is offered to a client.

2. **Parler-TTS and Qwen3-TTS declare no licence at all.** The brief lists
   Parler as "Apache-2.0". The card says nothing. Unlicensed is not
   Apache-2.0 — it is *unknown*, and unknown is a no until read. Both are out
   until someone reads the actual licence text.

3. **`silero-vad` (the brief's recommended VAD) declares no licence either.** The
   HF API returns an empty licence list. Silero VAD is widely believed to be MIT
   and there is an MIT grant in the project's repo, but the **model card does not
   state it**. VAD sits in the real-time path, so this needs a real answer before
   a self-hosted deployment — not a "probably fine".

## STT — verified

| Model | Licence | Evidence | Verdict |
|---|---|---|---|
| **whisper-large-v3-french** (`bofenghuang`) | **MIT** | HF API: `license: mit` | ✅ usable, **with a caveat** |
| `openai/whisper-large-v3` (base) | Apache-2.0 | HF API: `license: apache-2.0` | ✅ solid base |
| `Whisper/whisper-large-v3` (mirror) | ⚠️ none | HF API: `license: None` | avoid; use `openai/` |

**The caveat that matters:** `bofenghuang/whisper-large-v3-french` is a
**third-party community fine-tune**, not an OpenAI or Mistral release. It shows
1.2k downloads against 1.5M+ for the base model. Its WER numbers in the brief are
its author's, not independently reproduced. Two consequences:

- For a **client SLA**, the base `openai/whisper-large-v3` is the defensible
  choice: Apache-2.0, official, widely deployed.
- The fine-tune is worth **benchmarked on our own French audio** before it is
  chosen. That benchmark does not exist yet and is a Phase B→C task.

## Decisions this forces

1. **v1 TTS = Chatterbox (MIT), not Voxtral.** The one-line change from the brief.
2. **Commercial API TTS stays the default for the pilot** (ElevenLabs /
   Cartesia), with Chatterbox as the self-hosted and offline-degraded tier. This
   is what `SELF-HOSTING.md` already assumed; the research confirms it and now
   has a licence citation behind it.
3. **STT default is cloud (Deepgram Nova), per the existing decision.** The
   open-weight path is the offline tier, and the French fine-tune is a
   *candidate for evaluation*, not a decision.
4. **v1 continues to use ElevenLabs for TTS quality** and is untouched. Nothing
   here changes a signed-off call.

## What was NOT verified

Deliberately left unverified, and **must not** reach a client document:

- Every Elo and WER number in the brief. Leaderboard figures drift weekly and
  several reference leaderboards whose snapshot date is not stated.
- The "1178 Elo" Kokoro figure and the TTS Arena ordering.
- `Qwen3-TTS 1.7B`'s French WER of 23.4% and RTF 1.300.
- "Gepard" and "CosyVoice2-EU" — not located under those names.
- All vendor pricing.

Per the house rule: **an unverified number stays marked unverified and dated.**
These carry no date in the brief and therefore carry none here.

## Reproducing this

```bash
curl -s "https://huggingface.co/api/models/mistralai/Voxtral-4B-TTS-2603" \
  | python -c "import sys,json; print((json.load(sys.stdin).get('cardData') or {}).get('license'))"
```

The HF API is authoritative for *declared* licence. A model can be more
permissive in practice (a separate commercial grant) or less (inherited weights)
— a declared licence is the floor to check, not the ceiling.
