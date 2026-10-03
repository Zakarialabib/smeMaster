# Personas, Scopes & Innovations — Brainstorm for the Voice Agent

> **Status:** Brainstorm. Nothing here is decided. The four client decisions and the knowledge-scope guardrail are **client-owned** — this document is the menu we put in front of them, not the order we place.

---

## 0. The organising insight

The four blocking decisions are not independent. They cascade:

```
VERTICAL ──▶ determines ──▶ CALL TYPES ──▶ determines ──▶ KNOWLEDGE SCOPE
   │                                                          │
   │                                                          ▼
   └──▶ determines ──▶ CONSENT RISK ──▶ determines ──▶ COST MODEL
                                              │
                                              ▼
                                      CHANNEL SPLIT
```

Pick the vertical wrong and every downstream decision is wrong. So the brainstorm starts there.

---

## 1. Persona map — every actor in the system

| # | Persona | Role | What they want | What they fear |
|---|---------|------|----------------|----------------|
| P1 | **The Patron** | SME owner/manager | Not miss calls, not lose revenue | The AI embarrassing them |
| P2 | **The Caller** | Inbound human | Fast, competent answer | Talking to a dumb bot |
| P3 | **The Agent** | The AI receptionist | To be useful and honest | Overpromising |
| P4 | **The Staff** | Human who takes transfers | Context, no surprises | Being blindsided |
| P5 | **The Operator** | Us, the managed service | Uptime, margin, retention | Silent failures |
| P6 | **The Regulator** | CNIL / DPO | Consent, minimisation, erasure | Unlogged data flows |

### P1 — The Patron (concrete sketch)

**Marc, 52, garage owner in Lyon.**
- 6 employees, 40–60 calls/day, misses ~30% when under a car.
- Loses an estimated €2,000/month in missed work.
- Not technical. Uses WhatsApp for everything. Bank app on his phone.
- **Success looks like:** the phone stops ringing in his head.
- **Failure looks like:** the AI quoted a price he can't honour, or promised a slot that doesn't exist.

### P2 — The Caller (concrete sketch)

**Sophie, 38, calls her garage.**
- Existing client. Warning light on the dashboard. Stressed.
- Calling during her lunch break, 12:40.
- Hates phone menus. Will accept a bot **if it's fast and competent**.
- **Success looks like:** "Yes, we can take it Thursday 9am, bring the carte grise."
- **Failure looks like:** being asked to repeat herself, or being transferred to voicemail.

### P3 — The Agent (concrete sketch)

**"Camille" — the designed character.**
- Voice: warm, female, French European. Slightly informal.
- Knows: hours, services, pricing ranges, booking rules.
- Does **not** know: client records, technical diagnoses, promises outside policy.
- Escalates when: emergency, complaint, ambiguity, caller asks for a human.
- **The one rule:** she announces she is an AI in the first sentence. Every time. No exceptions.

### P4 — The Staff (concrete sketch)

**Julie, 29, garage office manager.**
- Handles the calls Marc can't. Overwhelmed 8:30–10:30 and 14:00–16:00.
- **Needs:** a pre-call brief on transfer — who, what, mood, what was already said.
- **Fears:** picking up an angry caller with zero context.

### P5 — The Operator (us)

- Runs the agent, monitors, tunes, bills.
- Needs: visibility, alerting, cost control, a clean escalation path.
- Cares about: uptime, margin, client retention, **not being the one who broke it at 3am**.

### P6 — The Regulator

- CNIL in France. GDPR in the EU.
- Cares about: consent, data minimisation, retention limits, right to erasure, breach response.
- **The one thing that gets us fined:** recording without disclosure.

---

## 2. Vertical shortlist — scored

Scored 1–5 on the six criteria that matter for a **first managed-service vertical**.

| Vertical | Call volume | Missed-call pain | Call-type clarity | Regulatory risk (5=low) | Willingness to pay | Sales access | **Total** |
|----------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Garage automobile** | 5 | 5 | 4 | 5 | 4 | 5 | **28** |
| **Artisan / BTP** | 4 | 5 | 4 | 5 | 4 | 5 | **27** |
| **Agence immobilière** | 4 | 4 | 4 | 4 | 5 | 4 | **25** |
| **Restaurant** | 5 | 3 | 5 | 5 | 2 | 5 | **25** |
| **Cabinet médical** | 4 | 3 | 3 | 1 | 5 | 2 | **18** |
| **Cabinet d'avocats** | 3 | 3 | 3 | 2 | 5 | 2 | **18** |

### Recommendation: **Garage automobile** as the first vertical

**Why:**
- Highest missed-call pain (mechanics are literally under cars).
- Clear, repeatable call types (appointment, quote, status, breakdown).
- Low regulatory exposure (no medical secrecy, no legal privilege).
- Direct access to the decision-maker (the owner answers the phone).
- Obvious ROI story: each missed call is a lost job.

**The one killer outcome:**

> **Every appointment request becomes a booked appointment.**

**Metric:** appointment booking rate (calls → confirmed bookings).
**Anti-metric:** false bookings (bookings that don't show).
**Second-order metric:** revenue recovered from previously-missed calls.

### Backup: **Artisan / BTP**

Same shape, slightly messier call types (emergency triage, service-area qualification, quote scoping). Good second vertical once the garage template works.

---

## 3. Scope matrix — what each persona can do, see, know

### 3.1 Capability scope (what the agent may do)

| Capability | Garage v1 | Rationale |
|------------|:---------:|-----------|
| Answer inbound calls | ✅ | Core |
| Announce it is an AI | ✅ | Non-negotiable |
| Book appointments | ✅ | The killer outcome |
| Reschedule / cancel | ✅ | Same flow |
| Quote price **ranges** | ✅ | If client publishes them |
| Quote exact prices | ❌ | Overpromise risk |
| Give technical diagnoses | ❌ | Liability |
| Take payment | ❌ | Out of v1 |
| Send WhatsApp follow-up | ✅ | Channel bridge |
| Transfer to human | ✅ | The ladder |
| Take a message | ✅ | Fallback |
| Outbound calls | ❌ | Different consent regime |
| Record audio | ❌ (default) | See §4 |

### 3.2 Knowledge scope — the client-owned guardrail

**The framework: four tiers.** The client decides which tiers the agent may reach.

| Tier | Name | Lives where | Examples | Default |
|:----:|------|-------------|----------|:-------:|
| **T0** | Public | Our server | Hours, address, services, brands | ✅ On |
| **T1** | Semi-public | Our server, encrypted | Price ranges, staff first names, booking rules | ✅ On |
| **T2** | Internal | **Client premises only** | Client list, job history, vehicle records | ⚙️ Opt-in |
| **T3** | Confidential | **Never touches our server** | Payment data, HR, legal, medical | ❌ Never |

**The guardrail in one sentence:**

> The agent may only answer from T0 and T1 by default. T2 requires a local retrieval node on the client's premises. T3 is never accessible — the agent escalates.

**The wizard that produces the guardrail** — a plain-language interview the client completes:

1. "Should the agent be able to tell a caller your opening hours?" → T0
2. "Should it be able to give a price range for a standard service?" → T1
3. "Should it be able to look up whether someone is already a client?" → T2 (triggers local node)
4. "Should it ever discuss payment details, staff matters, or legal issues?" → T3 (always no)

**This is what unblocks decision #5.** It converts an abstract "what content is allowed to reach our server" into ten yes/no questions.

### 3.3 Consent scope — three options

| Option | Disclosure | Recording | GDPR load | Recommended |
|--------|-----------|-----------|-----------|:-----------:|
| **A** | Announce-first | None | Minimal | ✅ **v1** |
| **B** | Announce + opt-out | Yes, unless "stop" | Medium | ⚙️ v2 |
| **C** | Announce + opt-in | Only with "oui" | Highest | ⚙️ Enterprise |

**Option A — the exact French copy:**

> « Bonjour, vous êtes en ligne avec l'assistant vocal de [Entreprise]. Cet appel n'est pas enregistré. Comment puis-je vous aider ? »

**Why A for v1:**
- Minimal GDPR exposure (no audio retention, no retention limits to enforce, no erasure workflow).
- Builds trust with callers who hate bots.
- Simple to explain to the client and to CNIL.
- **The transcripts are still stored** — text, not audio. That's the analytics surface.

**The escape hatch:** a client who wants quality analytics upgrades to Option C later. The architecture supports it because `turns` has no audio column — adding one is a deliberate migration, not a default.

---

## 4. Solutions to each blocking decision

### Decision 1 — Vertical + killer outcome

**Solution:** Present the scored matrix (§2). Recommend garage. Give the client a one-page "a day in the life" for each shortlisted vertical, written from the Patron's point of view. **The client picks one. The pilot optimises for it.**

### Decision 2 — Cost model sign-off

**Solution:** The cost model is a **volume table**, not a number. Three pricing shapes:

| Shape | Who it suits | Risk |
|-------|--------------|------|
| **Per-minute** | Low volume, variable | Client fears bill shock |
| **Per-call** | Predictable call types | Us: long calls hurt |
| **Monthly cap + overage** | Most SMEs | Shared risk |

**Innovation: a live cost simulator.** The client enters their estimated calls/day and average duration; the simulator shows the monthly range under each shape. It uses the same engine as the metering rollup, so the number they see is the number they get. **This is what makes the volume table signable.**

### Decision 3 — Two-channel split, in writing

**Solution:** The hard constraint is WhatsApp exposes no live voice API. Voice runs on a dedicated PSTN/SIP number. **The one-page explainer** for the client:

> Your WhatsApp keeps working exactly as it does today. The agent answers WhatsApp messages as text. Voice calls go to a new French number we provide. Your existing number can be ported to it (ARCEP, ~2–4 weeks) or forwarded. **WhatsApp voice calls are not possible** — no API exists.

**Innovation: WhatsApp as the follow-up channel.** After a voice call, the agent can send a WhatsApp confirmation ("Votre rendez-vous est confirmé jeudi 9h"). The two channels become one experience without needing in-WhatsApp voice.

### Decision 4 — Consent model

**Solution:** Recommend Option A (§3.3). Provide the exact French disclosure copy. **Innovation: the consent receipt** — the agent logs a timestamped record of the exact disclosure text and the caller's number. This is the audit trail CNIL asks for, generated automatically.

### Decision 5 — Agent knowledge scope

**Solution:** The four-tier framework (§3.2) plus the plain-language wizard. **Innovation: the scope is versioned.** Every change to the knowledge scope is a new version with a timestamp and an approver. If the agent says something wrong, we know exactly which scope version it was answering from.

---

## 5. Innovations — 20 ideas, ranked by impact/effort

| # | Innovation | Impact | Effort | Why it matters |
|---|-----------|:------:|:------:|----------------|
| 1 | **Vertical-in-a-box templates** | 🔥🔥🔥 | M | Onboarding becomes config, not build. Pick "Garage", get the call flows, knowledge structure, escalation rules. |
| 2 | **Shadow mode** | 🔥🔥🔥 | S | Agent listens to real calls for a week without speaking. Client reviews transcripts, tunes, then goes live. Builds trust, catches errors before they matter. |
| 3 | **Call summary card → WhatsApp** | 🔥🔥🔥 | S | After every call: who, what, outcome, next action. Sent to the Patron's WhatsApp. This is the killer outcome made visible. |
| 4 | **Warm transfer with context** | 🔥🔥🔥 | M | Julie gets a pre-call brief: "Marie Dupont, existing client, leak in bathroom, stressed, already said X." No more cold transfers. |
| 5 | **Live cost simulator** | 🔥🔥 | M | Makes the volume table signable. Uses the real metering engine. |
| 6 | **Knowledge scope wizard** | 🔥🔥 | S | Ten yes/no questions that produce the guardrail. Unblocks decision #5. |
| 7 | **Consent receipt** | 🔥🔥 | S | Automatic audit trail for CNIL. Timestamp + disclosure text + caller number. |
| 8 | **Pilot scorecard** | 🔥🔥 | S | Weekly report on the PILOT-CRITERIA bars. Go/no-go made legible. |
| 9 | **Bilingual code-switching** | 🔥🔥 | M | French callers say "ouais", "bah", "du coup", "en fait", and occasional English. The agent should handle all of it. |
| 10 | **Accent-adaptive STT** | 🔥🔥 | M | European French includes Parisian, Marseille, Alsatian, Breton, North African accents. Evaluate per accent, not just aggregate WER. |
| 11 | **Emotion-aware escalation** | 🔥🔥 | M | If the caller sounds distressed or angry, escalate faster. Reduces the worst calls. |
| 12 | **Callback promise** | 🔥🔥 | S | If the agent can't resolve, it promises a callback within X hours and logs it. Often more valuable than a transfer. |
| 13 | **Graceful degradation** | 🔥🔥 | M | LLM down → DTMF menu. TTS down → alternate voice. STT down → ask to repeat. Never a dead line. |
| 14 | **Local-first knowledge node** | 🔥🔥 | L | For T2 data. On the client's premises, queried via secure tunnel. Data never leaves. Extends RAG-FORK Option A. |
| 15 | **Voice persona library** | 🔥 | S | Pre-designed French voices — warm, professional, efficient, friendly. Client picks one that matches their brand. |
| 16 | **Spam / robocall filtering** | 🔥 | S | French SMEs get flooded. Detect and filter, save the Patron time. |
| 17 | **After-hours mode** | 🔥 | S | Different behaviour outside hours: take a message, book for next day, or emergency escalation. |
| 18 | **Multilingual overflow** | 🔥 | M | If the caller speaks a language the agent doesn't support, graceful handoff to a human or translation service. |
| 19 | **Voice persona A/B testing** | 🔥 | M | Run two voices against each other for a week, measure caller satisfaction. Data-driven persona choice. |
| 20 | **"Why did the agent say that?" replay** | 🔥 | M | For any call, show the exact retrieval hits, the scope version, and the prompt that produced the response. Debugging and trust. |

### The three I'd build first

**#2 Shadow mode** — cheapest trust-builder in the entire plan. One week of listening before speaking.
**#3 Call summary card → WhatsApp** — the visible proof of value. The Patron sees it on their phone.
**#6 Knowledge scope wizard** — unblocks the client-owned guardrail with ten questions instead of an abstract negotiation.

---

## 6. The scope matrix as a single table

| Scope | T0 Public | T1 Semi-public | T2 Internal | T3 Confidential |
|-------|:---------:|:--------------:|:-----------:|:---------------:|
| **Agent can read** | ✅ | ✅ | ⚙️ Local node only | ❌ |
| **Agent can speak** | ✅ | ✅ | ⚙️ If node present | ❌ |
| **Leaves client premises** | No (public) | Encrypted to us | **No** | Never |
| **Client approves** | Implicit | Explicit | Explicit + node | N/A |
| **Example** | Hours, address | Price ranges | Client list | Payments, HR |
| **Change frequency** | Rare | Monthly | Continuous | Never |

---

## 7. What to put in front of the client next

A single one-pager, in French, with four sections:

1. **The vertical choice** — the scored matrix, with our recommendation (garage) and the one killer outcome per vertical.
2. **The cost shapes** — three pricing shapes, plus a link to the simulator.
3. **The channel truth** — WhatsApp stays text; voice is a dedicated number; here's the ARCEP timeline.
4. **The knowledge scope wizard** — ten yes/no questions, and the four-tier framework behind them.

**The consent model is a recommendation, not a question.** We propose Option A with the exact French copy. If the client wants B or C, they say so; otherwise we proceed with A. This turns a blocking decision into a default with an escape hatch.

---

## 8. What I'd want to verify before any of this is committed

- **The `smeMaster` repository's actual state** — I can only see what the search surfaced, not the code. The Phase A commits (`88c44e8`, `c2e1e15`, `fb852a2`, `4837177`, `63b5c3c`) should be locatable in the tree.
- **`cargo check --workspace`** — the final arbiter, not `-p`.
- **The four invariant greps** — all must be empty.
- **The RAG retrieval eval** — `hit@3 >= 0.9` on the French eval set. The docs warn the desktop embedder is English-only, so this is the silent-failure risk.
- **The unmeasured RTF** on this host — the local tier stays disabled until it's measured, with the reason shown.

None of the persona/scope/innovation work above depends on those verifications. But the pilot does, and so does the client conversation.