# Call Flow — Inbound Voice Agent (FR/EN, v1)

> **Status:** DRAFT — the consent model and emergency policy below are BLOCKING for Gate 4.
> **Spec:** [`docs/specs/2026-09-28-voice-agent.md`](../specs/2026-09-28-voice-agent.md)
> **Written:** 2026-09-28

## 0. Blocking items in this document

Two decisions here change the architecture and must be made **before** the call path
is built, not after:

1. **Recording consent** (§2) — a client decision, and the recommended option removes
   the audio-retention problem entirely.
2. **Emergency policy** (§6) — a product decision with a safety dimension.

Everything else here is engineering and can proceed once those two are settled.

## 1. Call states

```
IDLE
 └─ inbound call arrives (Telnyx media stream)
     ↓
CONNECTING        ← carrier handshake, number → tenant lookup
     ↓ if unknown number:      UNKNOWN_CALLER → polite message → hangup (log it)
     ↓ if outside business hours:  AFTER_HOURS → §5
     ↓
GREETING          ← plays the disclosure line + greeting (measure `answer_latency` here)
     ↓
LISTENING         ← VAD detects speech → RECORDING (transient buffer, not stored)
     ↓
THINKING          ← STT final → LLM → first TTS byte (measure `turn_gap` here)
     ↓
SPEAKING          ← TTS playback; barge-in possible at any point → LISTENING
     ↓
     ├─ caller asks for human / intent matches → TRANSFER (§4)
     ├─ intent = voicemail detection positive → VOICEMAIL (§5)
     ├─ urgent intent → EMERGENCY (§6)
     └─ intent complete / silence > N s → CLOSING
     ↓
CLOSING           ← summary spoken, goodbye, carrier hangup
     ↓
WRAPUP            ← transcript stored, metering event written, transcript streamed
                    to console; if AFTER_HOURS_VM → WhatsApp summary to owner
     ↓ IDLE
```

## 2. Recording and consent — DECISION REQUIRED

**Recommendation: v1 records no audio at all.** Transcripts only, announce-first
AI disclosure.

| Option | Legal surface | Architecture impact | Verdict |
|---|---|---|---|
| **No audio recording; transcripts only + announce-first disclosure** | RGPD applies to transcripts (legitimate interest, bounded retention, registre de traitement). CNIL call-recording regime **not triggered**. | None. No audio storage path at all. | **RECOMMENDED** |
| Announce-first + recording + opt-out | CNIL call-recording regime: information notice + right to object. | Audio retention pipeline, storage, DPA update, retention job. | Phase 2 if client insists |
| Silent recording | Near-certain non-compliance for AI-processed consumer calls | — | **REJECT** |

### The disclosure script (FR, one line, spoken at greeting)

> « Cet appel est pris en charge par un assistant IA. Dites "agent" à tout moment
> pour être transféré à un humain. »

This single line does three jobs: satisfies AI-transparency disclosure, delivers the
access-to-a-human right, and gives the caller a deterministic escape hatch that does
not depend on the LLM deciding to transfer.

### Regulatory items to verify with counsel at Gate 0

⚠️ **Both are unverified as of 2026-09-28.** The client is FR-facing; do not rely on
this document as legal advice.

- **EU AI Act Art. 50** — transparency obligations for AI interacting with people.
  Verify the application date and the exact disclosure requirement.
- **French law (2025) on AI in consumer relations** — AI disclosure on calls plus
  access to a human. Verify entry-into-force date, sanctions, and whether the
  receptionist use case is in scope.

## 3. Latency metrics — defined, not just targeted

Targets alone are unactionable. These three are logged per call and per turn:

| Metric | Definition |
|---|---|
| `answer_latency` | carrier connect → first byte of greeting audio |
| `turn_gap` | end of caller speech (VAD fires) → first byte of agent audio |
| `wrapup_latency` | carrier hangup → WhatsApp summary delivered (after-hours path) |

Per-turn stage marks, logged so a regression can be attributed to a stage:

| Stage | Mark |
|---|---|
| VAD | speech end detected |
| STT | final transcript available |
| LLM | time to first token |
| TTS | time to first byte |

**Targets:** `answer_latency` p95 < 2s · `turn_gap` p50 < 1.0s, p95 < 1.6s.

If a target is missed, the stage marks say which of the four to look at. Without
them, every miss becomes an argument.

## 4. Transfer ladder

| Trigger | Action |
|---|---|
| Caller says "agent" / "humain" / "un humain" | Immediate transfer, no confirmation prompt |
| LLM classifies intent as human-required | Confirm once: « Je vous mets en relation, restez en ligne » → transfer |
| Caller asks to repeat twice | Offer transfer proactively |
| `CALLER_ANGER` / distress signals | Immediate transfer, skip confirmation |
| Transfer target unreachable | Apologise, take a message, §5 voicemail-summary path, close |

**No transfer succeeds silently.** A dropped transfer is worse than a bad bot: the
caller believes a human is coming and waits. Every transfer attempt is logged with
its outcome, and failure always falls through to message-taking.

Business hours only — outside them, the ladder is replaced by §5.

## 5. After-hours and voicemail

```
AFTER_HOURS  ─┬─ voicemail detected → §5.1 summary → WhatsApp to owner → hangup
              ├─ human asks (rare)  → announce out-of-hours, take message → WhatsApp
              └─ silence             → brief message, hang up, log as abandoned
```

### 5.1 Voicemail → WhatsApp (highest perceived value per line of code in v1)

A missed call that produces a WhatsApp message the owner reads on their phone is the
single feature a client notices most, and it may be nearly free.

⚠️ **UNVERIFIED — and internally contradictory as written (2026-09-28).** The €0 claim
above rests on the conversation being *user-initiated*. Here **we** message the owner,
so on a cold first contact it is a **business-initiated** message and needs an approved
template, which is **priced** — the opposite of €0. `COST-MODEL.md` §4 explicitly puts
outbound templates out of v1 scope, which contradicts this path. Two ways out, and the
client must pick: the owner sends one message to the agent's number once (opening the
24-hour service window, keeping it €0), or we accept a utility-template cost per missed
call and price it. **Ask the BSP and confirm before signing** —
[`VENDOR-QUOTE-REQUEST.md`](VENDOR-QUOTE-REQUEST.md) §1.3, and `ADR-001` Open #1.

```
voicemail audio → STT (ElevenLabs Scribe, batch) → FR/EN summary via LLM
                → WhatsApp text to owner (service conversation, 24h window, €0)
                → console: transcript + summary, flagged unread
```

Content of the message: caller name/number if spoken, reason for calling, callback
urgency, best callback window, one-line summary. No audio is retained (§2).

## 6. Emergency policy — DECISION REQUIRED

> « Cet assistant ne traite pas les urgences. En cas d'urgence, composez le 15, le
> 17 ou le 112. Je vous mets en relation. »

Non-negotiable: **the agent never triages a medical or safety emergency, and never
reassures one.** On detecting distress, urgency keywords, or a self-harm signal it
stops the scripted flow and transfers or advises the emergency number. This is a
product decision the client signs off on, and it is a line in the system prompt, not
a runtime toggle.

## 7. Language handling

Language is detected on the caller's first utterance and **pinned for the session**.
Mid-call switching is supported and re-pins.

| | FR | EN |
|---|---|---|
| TTS voice | ElevenLabs FR voice | ElevenLabs EN voice |
| STT | Deepgram Nova (FR) | Deepgram Nova (EN) |
| Disclosure | FR line above | English equivalent |
| Emergency | 15 / 17 / 112 | 999 / 112 |

**Explicitly out of v1:** Darija and Arabic voice. The repo ships an `ar` UI locale
with RTL, but that is interface text, not speech. Whisper-family STT is weak on
Moroccan Darija, and MSA TTS output is audibly wrong to a Moroccan caller — a worse
outcome than an honest English/French fallback. If the client needs it, it is a
separately scoped change with its own model evaluation.

## 8. Console behaviour during a call

The console is a phone-responsive web surface. It streams transcript deltas over
WebSocket, shows call state, elapsed time, and the current turn's stage marks. The
operator can watch but **cannot barge into a live call** in v1 — a supervisor
interrupting a live call is a separate feature with its own failure modes.
