# Ops Assistant — AI That Manages Live Call Operations

> **Status:** Gate 0 design proposal. Not built. Feeds [`docs/specs/2026-09-28-voice-agent.md`](../specs/2026-09-28-voice-agent.md).
> **Written:** 2026-09-28
> **Scope note:** the "no AI" rule in our product roadmap applies to the **SME Master SaaS product**. This is a separate client engagement with AI as the deliverable. Different product, different rule.

---

## 1. What this assistant is — and what it is not

There are three different things people call "an assistant that manages calls".
They have wildly different risk profiles and must not be confused:

| | **A. Call-handling agent** | **B. Ops assistant (this doc)** | **C. Supervisor** |
|---|---|---|---|
| **Who it talks to** | the caller | **you** (the operator) | a live call, mid-conversation |
| **Runs when** | business hours | 24/7, always | during a live call |
| **Can it affect a caller?** | yes, that is the job | **no** | **yes** |
| **Failure mode** | bad conversation | bad advice | interrupting a call wrongly |
| **Risk if it breaks** | moderate | low | **high** |
| **v1** | ✅ in scope | ✅ in scope | ⛔ **out of scope** |

**B is the safe and useful one, and it is the subject here.** C is genuinely
dangerous: a supervisor that barges into a live call based on a misread transcript
damages a real customer interaction that a human was already handling correctly.
Defer it, and say why rather than shipping it quietly.

## 2. The assistant's actual job

The assistant is a **watcher and a summariser**, not an actor. Four duties:

1. **Triage the queue.** When something needs a human, decide *what kind* of human
   and *how urgent*, and put it at the top of the right list.
2. **Summarise calls.** Not a transcript dump — a two-line summary plus the facts
   that matter, so you can act in five seconds.
3. **Spot trouble early.** Latency drifting, transfers failing, containment
   collapsing, a number's reputation sliding, a provider degrading.
4. **Answer "what happened while I was away?"** — the single most valuable query
   an ops assistant can answer.

**What it must never do in v1:** talk to a caller, place a call, change a price,
change agent behaviour mid-shift, or silence an alert.

## 3. Ops assistant — decision matrix

Every alert routes through this. The right-hand column is why; the "never" column
is what stops a helpful assistant becoming a liability.

| Signal | Severity | Assistant action | Human action | Never |
|---|---|---|---|---|
| Transfer failed (target unreachable) | **P1** | Page immediately; surface the caller's message; flag the target | Take the call back yourself | Queue it |
| Agent answered but caller hung up < 5s, repeatedly | **P1** | Flag "agent may be breaking the call" | Listen to 3 recordings/transcripts | Auto-change the greeting |
| `turn_gap` p95 > 1.6s for 15 min | P2 | Show the stage breakdown (VAD/STT/LLM/TTS) | Identify the regressing stage | Restart the service unprompted |
| `answer_latency` p95 > 2s for 15 min | P2 | Same, plus provider status | Same | Same |
| Containment below target over 24h | P2 | Show the call types that are leaking | Decide whether it is a prompt or a knowledge gap | Rewrite prompts |
| TTS/STT/LLM provider error rate > 2% | P2 | Name the provider; state whether the fallback chain took over | Nothing unless the chain is exhausted | Fail over silently |
| Fallback chain exhausted (all providers down) | **P1** | Page; state blast radius (which tenants, since when) | Approve a degradation mode | Keep retrying invisibly |
| Voicemail → WhatsApp summary not delivered | P2 | Show which calls are affected | Re-send manually | Fabricate a summary |
| Per-minute cost > +20% of model | P2 | Show which calls/skills are expensive | Adjust the tier or the plan | Change pricing |
| Number reputation degrading (spam blocks) | **P1** | Show block-rate trend and source | Check the carrier, pause campaigns | Re-enable sending |
| No calls received for 6h in business hours | P1 | "Zero inbound — carrier or number issue?" | Check the number | Assume it's quiet |
| Transcript language misdetected | P3 | Show the sample | Re-pin if it recurs | Auto-repin live |
| After-hours call, no human, voicemail captured | P3 | Surface in the morning digest | Read the summaries | Wake anyone |
| Emergency policy triggered | **P1** | Log, and tell the human immediately | Verify the outcome | Treat as routine |

**Design rule:** the assistant proposes, the human disposes. Every row in the
"human action" column is a decision. The assistant's job is to make that decision
obvious in under five seconds, not to make it.

## 4. Dev work matrix

Grouped by who does it and what it blocks. Effort is engineer-days, solo, and
assumes reuse of what the repo already ships.

| # | Work item | Owner | Effort | Blocks | Reuse / note |
|---|---|---|---|---|---|
| **Client decisions** | | | | | |
| D1 | Vertical + killer outcome | client | — | everything | `CLIENT-QUESTIONNAIRE.md` §1 |
| D2 | Cost model signed | client | — | pricing | §3, volume table |
| D3 | Two-channel split confirmed | client | — | **all** | §2 — send first |
| D4 | Consent model approved | client | — | call path | `CALL-FLOW.md` §2 |
| D5 | RAG fork decided | us | 0.5d | Gate 1 | `RAG-FORK.md`, recommend A |
| D6 | Regulatory dates + counsel | counsel | — | prod launch | AI Act Art. 50, French 2025 law |
| **Vendors** | | | | | |
| V1 | BSP + carrier quotes | vendors | — | Gate 7 | `VENDOR-QUOTE-REQUEST.md` |
| V2 | Meta business verification | client | — | **Gate 7 — longest lead time** | start in parallel with Gate 1 |
| V3 | Number provisioning / porting (ARCEP) | vendors | — | Gate 4 | timeline depends on port vs new |
| **Build — agent core** | | | | | |
| A1 | `agent-core` skeleton + API surface | us | 1d | G2, G3 | `services/agent-core/`, outside Tauri build |
| A2 | `LLMProvider` + OpenRouter impl | us | 0.5d | A6 | map to `providerFactory` pattern |
| A3 | `TTSProvider` + ElevenLabs impl | us | 0.5d | A6 | FR + EN voices |
| A4 | `STTProvider` + Deepgram + Scribe | us | 0.5d | A6 | Scribe Realtime FR unverified |
| A5 | Provider-swap test (config-only) | us | 0.5d | Gate 1 exit | proves the seam is real |
| A6 | Orchestrator turn loop | us | 2d | A7 | port LiveKit's pattern, own types |
| A7 | Bilingual voice config + language pin | us | 1d | G6 | FR UI already ships |
| **Build — channels** | | | | | |
| C1 | `ChannelAdapter` interface | us | 0.5d | C2, C3 | one shape for both channels |
| C2 | WhatsApp: Baileys sandbox + E.164 allowlist | us | 2d | C4 | **sandbox numbers we own only** |
| C3 | WhatsApp: BSP impl (same signature) | us | 2d | pilot | swap, not rewrite |
| C4 | Telephony: Telnyx inbound, turn detection | us | 4d | C5 | **one writer** |
| C5 | Transfer ladder + voicemail + WhatsApp summary | us | 2d | pilot | `CALL-FLOW.md` §4, §5 |
| **Build — console** | | | | | |
| U1 | Rust client + additive Tauri commands | us | 1.5d | U2 | `src/features/agent/` |
| U2 | Console: live transcript, call log, config, cost | us | 3d | pilot | reuse Zustand stores |
| **Build — ops assistant** | | | | | |
| O1 | Alert bus + rules engine (matrix §3) | us | 2d | O2 | deterministic, **not** LLM-driven |
| O2 | Call summariser | us | 1d | O3 | LLM over the transcript |
| O3 | Morning digest + "what happened" | us | 1d | pilot | highest-value single query |
| O4 | Anomaly detection (latency, cost, block-rate) | us | 2d | — | reuses deliverability monitoring |
| **Reuse (do not build)** | | | | | |
| R1 | Billing / invoicing | — | 0.5d | metering | `36-invoicing.md` exists |
| R2 | Number reputation alerting | — | 0.5d | O4 | `21-deliverability.md` exists |
| R3 | Tool registry | — | 1d | agent tools | map, don't duplicate |
| R4 | FR UI strings | — | 0 | G6 | `32-i18n` already ships `fr` |
| R5 | Embeddings + vector store | — | 1d | retrieval | ⚠️ `bge-small-en` is **English-only** |

**Total new build ≈ 27 engineer-days**, against a 6–10 week calendar that is
mostly waiting on clients and vendors, not on us.

## 5. How the assistant should talk to you

Bad ops assistants are chatty. Three rules:

1. **One line per alert, then the fact.** `P1 transfer failures — 6 in 20 min,
   target line unreachable since 14:32. →` Not a paragraph.
2. **Lead with the decision.** "Take 3 of these back yourself" is useful;
   "6 transfer failures occurred" is a log line you already had.
3. **Never repeat what you can read.** If it is in the dashboard, it does not
   belong in a notification.

**Digest, not stream.** One morning summary beats 200 pushes overnight. The
exception is P1: those page immediately, and only those.

## 6. What the assistant needs to see

Minimum data for triage to work at all:

- per-call: state transitions, timestamps, outcome, transfer attempts and their results
- per-turn: the four stage marks (`CALL-FLOW.md` §3)
- per-call: final transcript + summary
- service: provider health, fallback-chain state, current tier per tenant
- business: containment rate, cost per minute, transfer success rate, number health

If a field is missing, the assistant guesses, and a guessing ops assistant is worse
than none. **Instrument first, automate second.**

## 7. Sequencing — the part that actually matters

```
NOW      → send client questionnaire + RFQ (D1-D4, V1). Long lead times start.
NOW      → decide D5 (RAG fork). 30 minutes, unblocks Gate 1.
PARALLEL → V2 Meta verification starts NOW; it is the longest lead time we do
           not control, and it gates the pilot, not just Gate 7.
THEN     → Gate 1 (traits) — the whole plan's reversibility lives here.
GATE 1-3 → build and prove the seams. Cheap, fast, no vendor dependency.
GATE 4   → telephony. Only after D4 (consent) and V3 (number) are settled.
OPS      → O1-O3 once real calls exist. An ops assistant over a demo is theatre.
PILOT    → 2 weeks, ≥100 calls, against `PILOT-CRITERIA.md`.
```

**Do not build the ops assistant before there are real calls.** Every threshold in
matrix §3 needs a distribution to be a threshold. Guessed thresholds produce alerts
that are always wrong in both directions: missed real problems, and noise the
operator learns to ignore. Noise is worse than no alerting.

## 8. Honest risks in this design

- **The assistant can be wrong about a live call.** Mitigated by the propose/dispose
  split: it never acts on a caller.
- **Alert fatigue is the failure mode, not missed alerts.** An ops assistant
  nobody trusts is a liability. Start with P1 only, and add rows as distributions
  are actually observed.
- **"What happened while I was away" needs good summaries.** Bad summaries make
  the digest actively misleading — worse than no digest.
- **The thresholds in matrix §3 are placeholders.** They become real only from
  pilot data. Do not hard-code them as if they were measured.
- **C (supervisor) is out of scope and should stay there** for v1. It is the one
  item on this page that can damage a real customer interaction, and it is the one
  most likely to be requested.
