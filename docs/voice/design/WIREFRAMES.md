# Wireframes — Voice & Messaging Agent Console

> **Status:** source-derived from the Gate 0 design set, **not screenshot-verified** — no console
> code exists yet (spec Gate 3 builds it). Every layout below traces to a requirement in
> [`UX.md`](UX.md), [`CALL-FLOW.md`](../dev/CALL-FLOW.md) or [`OPS-ASSISTANT.md`](../dev/OPS-ASSISTANT.md);
> nothing is invented.
> **Mockups:** [`mockups/`](mockups/) — HTML, on the real tokens. **Gaps:** §13. **UX opportunities:** §14.
> **Prototype:** [`prototype/voice-console/`](../../../prototype/voice-console/) — a **running** React
> implementation of every surface below. **Where it and this document disagree, the prototype wins:**
> it was written later and is interactive, so it settles layout and copy questions this document can
> only describe. Port map in [`../dev/PROTOTYPE-HANDOVER.md`](../dev/PROTOTYPE-HANDOVER.md).

## 0. Coverage matrix

| # | Surface | Route | Source of truth | Mockup |
|---|---|---|---|---|
| 1 | Console shell + nav | — | `UX.md` §4, `navConfig.ts` (`NAV_GROUPS`) | `01-call-log.html` |
| 2 | Call log | `/calls` | `UX.md` §5.1, `PILOT-CRITERIA.md` | `01-call-log.html` |
| 3 | Live monitor | `/calls/live/:id` | `CALL-FLOW.md` §1, §3, §8 | `02-live-call.html` |
| 4 | Call detail | `/calls/:id` | `CALL-FLOW.md` §3, §4, §5 | `03-call-detail.html` |
| 5 | Digest | `/ops` | `OPS-ASSISTANT.md` §2, §5 | `04-ops-digest.html` |
| 6 | Alert list | `/ops/alerts` | `OPS-ASSISTANT.md` §3 | `04-ops-digest.html` |
| 7 | Alert detail | `/ops/alerts/:id` | `OPS-ASSISTANT.md` §3, §5 | `05-alert-detail.html` |
| 8 | Agent config | `/agent/config` | `CALL-FLOW.md` §5–7 | `06-agent-config.html` |
| 9 | Knowledge scope | `/agent/knowledge` | `RAG-FORK.md` §Recommendation | `07-knowledge.html` |
| 10 | Cost | `/agent/cost` | `COST-MODEL.md` §1–3 | `08-cost.html` |
| 11 | Mobile variants | all | `UX.md` §11 | `09-mobile-digest.html` (width IS the viewport) |

### Cross-cutting invariants (constant across every surface)

- **Shell:** the console uses a **horizontal top nav of sections** (Calls · Live · Ops · Config ·
  Cost), not a second left rail — matching the app's unified-page convention. The rail below is
  the *app's* nav, and `Calls` is one group in it.
- **Page chrome:** `PageHeader` → toolbar/filters → body, the app's shared pattern.
- **AI content** (summaries, proposed decisions, judgements) is always visually separated:
  purple surface, `AiSuggestionBanner`. Facts are neutral.
- **No audio, anywhere.** No play button, no waveform, no "listen" — `CALL-FLOW.md` §2 retains
  no audio. This is a hard constraint on every surface below.

```
┌──────────────────────────────────────────────────────────────────┐
│  APP RAIL (existing, grouped)                                     │
│  [Mail] [Today] [CRM] [Calls•] [Tasks] [Calendar] [AI] [Biz] [⚙]  │
└──────────────────────────────────────────────────────────────────┘
         │ opens
         ▼
┌──────────────────────────────────────────────────────────────────┐
│  CONSOLE — top nav, not a second rail                             │
│  [ Calls ] [ Live ] [ Ops ] [ Config ] [ Cost ]      ⟨client⟩ ▾  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1–2. Console shell + Call log (`/calls`)

```
┌────────────────────────────────────────────────────────────────┐
│ [ Calls ] [ Live ] [ Ops ] [ Config ] [ Cost ]      ⟨client⟩ ▾ │
├────────────────────────────────────────────────────────────────┤
│ Calls   ● 1 live            [ 7d ▾ ] [ outcome ▾ ] [ ⚑ only ]  │
├────────────────────────────────────────────────────────────────┤
│ ⟡ AI  3 calls flagged: containment −40% on pricing questions  │
│      → review the 3 calls · dismiss                            │
├────────────────────────────────────────────────────────────────┤
│ ○  Caller            Dur.  Chan.  Outcome        ⚑  When       │
│ ●  +33 6 ** ** 41 22  2:14  Voice  contained      ⚑  14:32     │← live
│ ●  +33 7 ** ** 09 88  0:41  Voice  → transferred     13:58     │
│ ●  +33 6 ** ** 77 01  1:03  WA     contained         13:40     │
│ ○  +33 6 ** ** 12 45  3:22  Voice  voicemail → sent  12:11     │
│                    ▲/▼ scroll · page 1 of 12                   │
└────────────────────────────────────────────────────────────────┘
```

| Region | Action |
|---|---|
| `● N live` pill | filter to live calls only |
| Range / outcome / flagged filters | re-query (server-side, paged) |
| AI banner `review` / `dismiss` | open the 3 flagged calls / hide the insight |
| Row | → `/calls/:id`; the `●` live marker → `/calls/live/:id` |
| Caller cell | show masked E.164; full number on detail only |

**Entry:** nav. **Exit:** row → detail. **Gating:** none (tenant-scoped by token).

**Notes:** `Outcome` vocabulary is the `CALL-FLOW.md` §1 set — `contained`, `→ transferred`,
`voicemail → sent`, `abandoned`, `unknown_caller`. Reusing those words is what makes containment
countable.

---

## 3. Live monitor (`/calls/live/:id`)

```
┌────────────────────────────────────────────────────────────────┐
│ [ Calls ] [ Live ] [ Ops ] [ Config ] [ Cost ]      ⟨client⟩ ▾ │
├────────────────────────────────────────────────────────────────┤
│ ◀ Calls   ·   ● LIVE  SPEAKING   ⏱ 1:42   Voice   ⟨fr⟩         │
├───────────────────────────────────┬────────────────────────────┤
│ TRANSCRIPT                        │ THIS TURN — stage marks    │
│                                    │ VAD      0.00  ✔          │
│ ┌ Agent ────────────────────────┐ │ STT final 0.21  ✔          │
│ │ Cet appel est pris en charge  │ │ LLM 1st tk 0.48  ✔          │
│ │ par un assistant IA…          │ │ TTS 1st by 0.72  ✔          │
│ └───────────────────────────────┘ │ ──────────────────────────  │
│ ┌ Caller ───────────────────────┐ │ turn_gap   0.72  ✔ < 1.0   │
│ │ Bonjour, je voudrais un       │ │ answer_lat 1.84  ✔ < 2.0   │
│ │ rendez-vous pour…             │ │                            │
│ └───────────────────────────────┘ │ provider: ● deepgram ok    │
│ … streaming …                     │           ● 11labs  ok     │
├───────────────────────────────────┴────────────────────────────┤
│ ⓘ Read-only in v1. This console cannot interrupt a live call.   │
└────────────────────────────────────────────────────────────────┘
```

| Region | Action |
|---|---|
| State header | none (status only) — `SPEAKING`/`LISTENING`/`THINKING` from `CALL-FLOW.md` §1 |
| Transcript (live region) | scroll/select text; **no audio control exists** |
| Stage marks | per-turn; expand an earlier turn to compare |
| Metric readout | shows the bar and pass/fail vs the pilot target |
| Read-only note | static |

**Entry:** log row ● marker, or an alert. **Exit:** back to log.
**Gating:** available to owner + operator. **Barge-in is deliberately absent** — see `UX.md` §12.

---

## 4. Call detail (`/calls/:id`)

```
┌────────────────────────────────────────────────────────────────┐
│ ◀ Calls   ● contained   Voice   14:32–14:34  +33 6 ** ** 41 22 │
├────────────────────────────────────────────────────────────────┤
│ ⟡ AI SUMMARY                                                   │
│   Booked Tue 10:00. Wants the 45-min consultation, asked       │
│   twice about parking. No transfer. Containment: yes.          │
│   → re-send to owner · copy                            (purple) │
├────────────────────────────────────────────────────────────────┤
│ METRICS   answer_latency 1.84s ✔   turn_gap p50 0.71s ✔        │
│           turn_gap p95 1.44s ✔     wrapup 3.1s ✔               │
│ TRANSFERS attempted: 0                                          │
│ DISCLOSURE  spoken ✔  (audited from transcript — no audio kept) │
├────────────────────────────────────────────────────────────────┤
│ TRANSCRIPT  ▲ scroll                                           │
│  Agent   …                                                      │
│  Caller  …                                                      │
├────────────────────────────────────────────────────────────────┤
│ ⓘ Transcript retained; audio is not recorded. Retention: 90 d   │
└────────────────────────────────────────────────────────────────┘
```

| Region | Action |
|---|---|
| Summary `re-send to owner` | re-send the WhatsApp summary (a failure path from §5.1) |
| Metrics | pass/fail against `PILOT-CRITERIA.md` bars, per call |
| `DISCLOSURE spoken ✔` | transcript-derived, and it **says so** |
| Transcript | read-only |

**Entry:** any call row. **Exit:** back. **Gating:** the summary and transcript may be
owner-restricted — see Open question 3 in `UX.md`.

---

## 5–6. Digest + Alert list (`/ops`)

```
┌────────────────────────────────────────────────────────────────┐
│ [ Calls ] [ Live ] [ Ops ] [ Config ] [ Cost ]      ⟨client⟩ ▾ │
├────────────────────────────────────────────────────────────────┤
│ Since yesterday 18:00 · 14 calls · 11 contained (79%)          │
├────────────────────────────────────────────────────────────────┤
│ ⟡ WHAT NEEDS YOU                                               │
│   P1 · Transfer failures — 6 in 20 min, target unreachable     │
│        since 14:32  → take these 3 back yourself               │
│   P1 · Number reputation degrading — block rate 4.1% →  check  │
├────────────────────────────────────────────────────────────────┤
│ ⟡ OVERNIGHT (digest, newest first)                             │
│   23:10  Appointment request — booked 09:00 ✔                  │
│   22:41  Voicemail → WhatsApp sent ✔      (2 min summary)      │
│   21:05  Pricing question — no answer ⚑ → knowledge gap        │
│   … 11 more                                      [ show all ]  │
├────────────────────────────────────────────────────────────────┤
│ ▸ P2 (3)  latency back to normal 14:50 · cost +8%              │
└────────────────────────────────────────────────────────────────┘
```

| Region | Action |
|---|---|
| Header count | re-derive from `agent_get_ops_snapshot` (one fetch) |
| P1 card `→ decision` | straight to alert detail (no intermediate list) |
| Digest item | → call detail |
| `P2 (n)` disclosure | expand the non-urgent roll-up |

**Entry:** nav, or the **morning push**. **Exit:** alert detail / call detail.
**The rule this surface exists for:** one fetch, understandable without expanding — expanding is
for detail, never for meaning (`UX.md` §6.3).

---

## 7. Alert detail (`/ops/alerts/:id`)

```
┌────────────────────────────────────────────────────────────────┐
│ ◀ Ops   P1 · TRANSFER FAILED                          14:32    │
├────────────────────────────────────────────────────────────────┤
│ ⟡ DO THIS                                                      │
│   Take 3 of these back yourself. Target line unreachable       │
│   since 14:32 — the client's own line, not ours.               │
│   [ Open the 3 calls ]  [ Acknowledge ]                        │
├────────────────────────────────────────────────────────────────┤
│ EVIDENCE                                                       │
│  6 failures in 20 min · 3 callers still waiting for a human    │
│  First failure 14:32 · last 14:51 · blast radius: this tenant  │
│  ┌ Caller              Waited   Message captured               │
│  │ +33 6 ** ** 41 22    4:10   "je voudrais parler à…"  →     │
│  │ +33 6 ** ** 09 88    2:33   "rappelez-moi…"          →     │
│  └ … 1 more                                                     │
├────────────────────────────────────────────────────────────────┤
│ ⓘ The assistant never retries a transfer silently. Failures    │
│   always fall through to message-taking.                       │
└────────────────────────────────────────────────────────────────┘
```

| Region | Action |
|---|---|
| `Open the 3 calls` | filtered call log |
| `Acknowledge` | alert lifecycle (see `UX.md` Open Q1/Q2 — escalation undecided) |
| Evidence rows | call detail |

**The five-second test:** what broke · since when · how many · the one thing to do — all above
the fold, no scroll.

---

## 8. Agent config (`/agent/config`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [ Calls ] [ Live ] [ Ops ] [ Config ] [ Cost ]          ⟨client⟩ ▾   │
├──────────────────────────────────────────────────────────────────────┤
│ Config                       ⟨changes are per-tenant⟩              │
├──────────────────────────────────────────────────────────────────────┤
│ VOICE                                                                │
│  Language pair     [ FR ▾ ] [ EN ✓ ] [ AR ⃠ off ]                  │
│  TTS voice (FR)    ⟨siwis-medium⟩ ▾        ⟡ previews your voice    │
│  TTS voice (EN)    ⟨matilda⟩ ▾                                   │
│  ▸ Test greeting + disclosure  (plays FR + EN, 6s)                  │
│                                                                      │
│ AVAILABILITY                                                          │
│  Business hours    [ Mon–Fri ] 09:00 – 18:00   tz ⟨Europe/Paris⟩   │
│  Transfer target   +33 6 •• •• 41 22   ⟨required while in-hours⟩   │
│  After hours       ● take message  ○ transfer  ○ announce only      │
│                                                                      │
│ TIER                                                                  │
│  ● Standard (cloud)     €0.19/min   signed model                    │
│  ○ Budget (self-hosted) ⃠ unavailable — latency unmeasured, Gate 4  │
│  ○ Premium (ElevenLabs) €0.28/min                                    │
│                                                                      │
│ BEHAVIOUR  ⚠ read-only, not editable here                           │
│  ⓘ Prompts, tool set and the assistant's "never" list are not       │
│    editable in the console. See AGENT-PROMPTS.md.                   │
│                                                                      │
│                          [ Discard ]  [ Save changes ]              │
└──────────────────────────────────────────────────────────────────────┘
```

| Region | Action |
|---|---|
| Language pair checkboxes | `agent_set_voice_locales` — **FR/EN only**; AR is permanently disabled with a reason, never a hidden control |
| TTS voice select | per-locale voice id; changing it invalidates the TTS cache (below) |
| `Test greeting + disclosure` | previews the **real** voice through the real provider — the disclosure line is a 100%-of-calls legal requirement, so a broken voice id must be audible before saving (`WIREFRAMES.md` §14 U5) |
| Business-hours grid | `agent_set_hours`; changing tz re-evaluates after-hours routing on the next call |
| Transfer target | **required whenever the agent answers in-hours** — an in-hours agent with no transfer target fails the "no silent failure" principle (`UX.md` §3.6) |
| After-hours radio | selects the `AFTER_HOURS` path in `CALL-FLOW.md` §1 |
| Tier radio | `agent_set_provider_tier`; budget tier disabled **with a reason shown inline**, never silently |
| Behaviour block | read-only notice, not a disabled-looking form |

**Entry:** console nav. **Exit:** cost, knowledge.
**Gating:** no provider credentials in the desktop — tier selection sends an identifier, never a key
(`ADR-001` D1). A tenant id is never read from the client; it comes from the token.
**Save is a P1-shaped action with no undo:** confirm before writing, then show what changed.

**Gaps ⚠️**
- **G7** — the alert-matrix "never" column (never auto-change the greeting, never rewrite prompts)
  has **no UI representation**. An operator cannot see what the assistant is forbidden to do. The
  `BEHAVIOUR` notice is a partial fix and is not sufficient: it is static prose, not the list.
- **G10 (new)** — **there is no prompt editor, by decision** (`UX.md` §12). A config screen without
  one invites a support request of the form "where do I change what it says". The notice must
  answer that question, not just announce its absence.
- **G11 (new)** — a **discard-with-unsaved-changes** guard is unspecified. Losing a voice change
  silently on navigation is a small, common, avoidable annoyance.

**UX opportunities 💡**
- **U5** — dry-run the greeting + disclosure with the real voice before saving. Highest-value
  addition on this surface: it converts a 100%-of-calls legal requirement from a claim to a
  check the operator performs once.
- **U9 (new)** — show **which TTS phrases are cached** and the invalidation date. A stale cache
  after a voice change produces an inconsistency the operator will report as "it still sounds
  like the old voice".

---

## 9. Knowledge scope (`/agent/knowledge`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [ Calls ] [ Live ] [ Ops ] [ Config ] [ Cost ]          ⟨client⟩ ▾   │
├──────────────────────────────────────────────────────────────────────┤
│ Knowledge                          ⓘ what the agent is allowed to see│
├──────────────────────────────────────────────────────────────────────┤
│ SCOPE — what the agent may read                                     │
│  ☑ Services & pricing    142 chunks    last ingest 2 h ago          │
│  ☑ Opening hours          18 chunks                                  │
│  ☑ Booking rules          31 chunks                                  │
│  ☐ Email                   ⃠ off — never enabled in v1              │
│  ☐ Contacts                ⃠ off — needs an explicit decision       │
│                                                                      │
│ INDEX                                                                 │
│  chunks 287 / 500        embedding 1024-d · bge-m3 · ⓘ self-hosted  │
│  last ingest 2 h ago · next scheduled 22:00 · [ Re-index now ]      │
│                                                                      │
│ ⟡ AI  4 digest answers cited no chunk — the agent may not know     │
│      enough about refunds. Sample: "remboursement sous 30 jours"   │
│      [ See the 4 answers ]                                           │
│                                                                      │
│                                      [ Discard ]  [ Publish ]        │
├──────────────────────────────────────────────────────────────────────┤
│ ⓘ Publishing re-indexes the agent's knowledge. It takes ~90 s and  │
│   the agent keeps serving the previous index until it completes.    │
└──────────────────────────────────────────────────────────────────────┘
```

| Region | Action |
|---|---|
| Scope checkboxes | the privacy guardrail: mail/contacts are **off by default** and stay off in v1 |
| `Re-index now` | operator-triggered ingest; the agent keeps serving the old index until it finishes |
| AI knowledge-gap banner | purple, inferred — the digest answers that cited no retrieved chunk |
| `Publish` | applies the scope; **see G8, ownership is unresolved** |
| Footer note | states the duration and that service is not interrupted |

**Entry:** console nav. **Exit:** config, cost.
**Gating:** the scope is per-tenant and server-side. The desktop sends a **scope change**, never
content — ingestion is `agent-core`'s operation, not the desktop's.

**Gaps ⚠️**
- **G8** — `Publish` ownership is **unresolved** (`UX.md` Open Q4): ours or the client's. The button
  implies a capability we may not grant. Until it is decided the button should read as our
  operation ("request publish"), not theirs.
- **G12 (new)** — **no UI for a failed or partial ingest.** A re-index that half-completes leaves
  the tenant on a mixed index with no indication. This is a silent-consistency gap, and
  silent inconsistency is the class this console is otherwise careful about.
- **G13 (new)** — **the embedding model and dimension are shown but not explained.** The 1024-d
  server index is deliberately separate from the desktop's 384-d local index (`RAG-FORK.md`); an
  operator who "helpfully" tries to unify them needs the constraint stated on the screen.

**UX opportunities 💡**
- **U7** — show **which chunk each digest answer came from**. A "knowledge gap" flag is only
  actionable if the operator can see what was missing; the banner above shows the symptom, not
  the source.
- **U10 (new)** — a **"preview as the agent would answer it"** query box, read-only, which runs
  retrieval and shows the retrieved chunks. Turns a knowledge gap from a complaint into a
  five-second diagnosis.

---

## 10. Cost (`/agent/cost`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [ Calls ] [ Live ] [ Ops ] [ Config ] [ Cost ]          ⟨client⟩ ▾   │
├──────────────────────────────────────────────────────────────────────┤
│ Cost                  ⓘ all figures UNVERIFIED — vendor rates not   │
│                      confirmed. See client/COST-MODEL.md §6.       │
├──────────────────────────────────────────────────────────────────────┤
│  412 min · 128 calls          signed model  €0.19/min              │
│  actual       €0.21/min        ⚠ +11%   within the ±20% band        │
├──────────────────────────────────────────────────────────────────────┤
│  min ▁▂▃▅▂▁▃▇▅▃▂▁▃▂▄▃▁▂▃▅▃▂▁▂▃▄▅▃▂▁▃▂▄▃▂▁▂▃▅▃▂▁▂▃▄▅▃▂▁▃▂▄▃▂▁▂▃▅▃ │
│      (per day, 30 days)                                            │
├──────────────────────────────────────────────────────────────────────┤
│ BY CALL TYPE            [ by call type ▾ ]  [ by day ▾ ]            │
│  ┌──────────────────────┬────────┬────────┬────────┬────────────┐  │
│  │ Call type            │  Calls │   Min  │  Actual│  vs model  │  │
│  ├──────────────────────┼────────┼────────┼────────┼────────────┤  │
│  │ Contained — pricing  │    38  │  118.4 │ €24.90 │  +4%       │  │
│  │ Contained — hours    │    27  │   61.2 │ €11.40 │  −3%       │  │
│  │ Voicemail → WhatsApp │    22  │   66.0 │ €18.90 │ ⚑ +31%     │  │
│  │ Transferred          │    29  │   99.1 │ €17.10 │  −9%       │  │
│  │ Abandoned            │     8  │   12.3 │  €3.80 │ ⚑ +48%     │  │
│  │ WhatsApp (text)      │    12  │     —  │  €0.00 │   n/a      │  │
│  └──────────────────────┴────────┴────────┴────────┴────────────┘  │
│  ⚑ 4 calls over model — [ show which ]                              │
├──────────────────────────────────────────────────────────────────────┤
│  ⟡ AI  4 of the over-model calls are after-hours. At the current    │
│      tier that is expected: off-hours minutes are billed at the      │
│      lower rate. Re-check at 3,000 min/month.                        │
└──────────────────────────────────────────────────────────────────────┘
```

| Region | Action |
|---|---|
| Headline min/calls/actual | re-derive from metered events; the ±20% band is from `PILOT-CRITERIA.md` |
| Sparkline | daily minutes; no per-day tooltip without JS — the table is the detail |
| Group-by control | per call type (default) or per day; re-fetch, not a client-side regroup |
| Table rows | drill to the filtered call log |
| `show which` | the > +20% calls, per `OPS-ASSISTANT.md` §3 "cost per minute > +20%" |
| UNVERIFIED notice | **required** — mirrors the marker in `COST-MODEL.md` §0 |

**Entry:** console nav. **Exit:** call log, filtered.
**Gating:** metering is read-only in the console. Nothing here changes a tier or a rate — a
price change is a commercial act, not a UI toggle.

**Gaps ⚠️**
- **G6** — the `€0.19/min signed` figure is **unverified vendor pricing** and must carry the same
  `UNVERIFIED` marker `COST-MODEL.md` uses. Rendering it as a fact is the single most
  reputation-damaging thing this screen can do: the client will quote it back.
- **G14 (new)** — **the €0.00 for WhatsApp rows must be explained**, not just shown. "Text calls
  cost nothing" is a consequence of Meta's service-conversation policy, not a bug — but a client
  who does not know that will assume the row is missing data.
- **G15 (new)** — **the sparkline has no accessible detail without JS** (no tooltip, no
  `<details>`). It is decoration until the table below it can be grouped by day, which is the
  mitigation.

**UX opportunities 💡**
- **U4** — **cost per contained call**, not per minute. It connects inference cost to business
  value and it is the number the client will renegotiate against. At €0.21/min across 128 calls
  the difference between "expensive" and "profitable" is entirely in the contained count.
- **U11 (new)** — **a projection to next month at the current trend**, explicitly marked as a
  projection. Fixed costs dominate below ~2,000 min/month (`COST-MODEL.md` §2), so the client
  needs to see the fixed/variable split, not only the per-minute figure.

---

## 11. Mobile variants (≤ 480 px, one-handed)

**Not a narrower desktop.** The primary persona is on a phone, mid-task, often one-handed
(`UX.md` §1). Reach is the constraint: primary actions sit in the lower 40% of the viewport,
never the top-right, which is where a thumb does not go.

```
MOBILE — DIGEST (primary surface)      MOBILE — CONFIG
┌──────────────────────────┐            ┌──────────────────────────┐
│ ⟨client⟩ ▾        ⟨lang⟩ ▾│            │ ← Config                 │
├──────────────────────────┤            │                          │
│ Monday 14 calls · 79% ✔  │            │ TTS VOICE (FR)           │
├──────────────────────────┤           │ ⟨siwis-medium⟩ ▾         │
│ ⟡ P1 · Transfers         │            │                          │
│   6 failed, 3 waiting    │            │ ┌──────────────────────┐ │
│   [ Open the 3 ]         │            │ │ ▶ Test greeting (6s) │ │
├──────────────────────────┤            │ └──────────────────────┘ │
│ ⟡ 22:41 Voicemail sent ✔ │            │                          │
│ ⟡ 21:05 Pricing ⚑        │            │ BUSINESS HOURS           │
├──────────────────────────┤           │ Mon–Fri 09:00–18:00      │
│ ┌──────────────────────┐ │            │                          │
│ │ ⟡ 2 more (P3)        │ │            │ [ Discard ] [ Save ]    │
│ └──────────────────────┘ │            │  ↑ both in thumb reach   │
│ ⛔ agent-core offline    │            └──────────────────────────┘
│    last seen 14:51       │
└──────────────────────────┘
```

| Desktop | Phone | Consequence for the layout |
|---|---|---|
| `DataTable` call log | card list: caller · duration · outcome · flag | no horizontal scroll; a table is unusable at 390 px |
| transcript \| metrics side-by-side | transcript; metrics behind a `<details>` disclosure | one-handed vertical reading only |
| tabbed config | one section per screen, stacked | tab affordances are too small for a thumb |
| digest + right insight rail | digest only | the rail *is* the digest on mobile |
| `Save` top-right of a form | `Save` + `Discard` pinned to the bottom | primary actions move to the thumb zone, never the top-right |

| Region | Action |
|---|---|
| `⟨client⟩ ▾` / `⟨lang⟩ ▾` | header only; on mobile these are the first tap target, so they sit inline-start |
| `⟡ 2 more (P3)` | `<details>`/`<summary>` disclosure — the JS-free mechanism the mockups use |
| `⛔ agent-core offline` | **must never render as "no calls"** (`UX.md` §7) — a stale-looking empty state reads as a quiet day |
| `▶ Test greeting (6s)` | the §8 U5 dry-run, full-width, above the fold |
| Bottom `Save`/`Discard` | sticky footer; both reachable one-handed |

**Entry:** app rail → Calls. **Exit:** call detail, alert detail.
**Gating:** read-only by default. A live call on a phone is **watching, not acting** (`UX.md` §11) —
no control may imply a mid-call intervention.

**Gaps ⚠️**
- **G16 (new)** — **"agent-core unreachable" and "no calls yet" are visually similar at 390 px.**
  Both are a mostly-empty list. The offline state needs a colour, a last-seen timestamp and an
  icon — not just different words — or they will be misread on a phone in a hurry.
- **G2 (applies here most)** — the read-only notice for a live call must be visible on the phone
  variant, where the operator is most likely to hunt for a control that does not exist.
- **G17 (new)** — **thumb reach is asserted, not measured.** The 390 px screenshots in
  `docs/00-SCREENSHOTS/` cover other features; no voice surface has been checked against a real
  device or a reach study.

**UX opportunities 💡**
- **U12 (new)** — **a P1 count on the app badge**, so a P1 raised while the owner is in another
  feature is visible without opening the console. P1 pierces quiet hours; everything else waits
  for the digest (`UX.md` §8), so the badge must carry P1 **only** or it becomes noise.
- **U13 (new)** — **swipe-to-acknowledge on a P1**, single-gesture, with undo. Acknowledge on a
  phone should not require aiming at a 32 px button.

---

## 12. States that exist but have no "happy" layout

Rendered explicitly, per `UX.md` §7 — these are build items, not polish:

| State | Renders as |
|---|---|
| No calls yet | setup checklist (number provisioned? Meta verified?) — never a bare empty table |
| `agent-core` unreachable | "We cannot reach the agent · last seen 14:51" — **never** "no calls" |
| Zero inbound 6h, business hours | a **P1**, not silence |
| Provider degraded | names the provider + whether the chain took over |
| Chain exhausted | page + blast radius |
| Transcript partial | deltas append into the live region; no full re-render |
| Emergency policy triggered | surfaced to a human immediately, never routine |

---

## 13. Gaps (⚠️ — broken, missing, or would mislead)

| # | Surface | Gap |
|---|---|---|
| G1 | Whole console | **No console code exists** — everything here is source-derived design, not verified UI |
| G2 | Live monitor | `CALL-FLOW.md` §8 says the operator "can watch but cannot barge in". The UI must state this; without it, an operator will look for the control and assume it is broken |
| G3 | Digest | The **P2/P3 thresholds in the alert matrix are placeholders** (`OPS-ASSISTANT.md` §3). Rendering them as facts tells the operator a guess is a measurement |
| G4 | Alert detail | Escalation for an unacknowledged P1 is **undecided** (`UX.md` Open Q1) — `Acknowledge` currently has no defined consequence |
| G5 | Call detail | Retention window shown in the UI is **counsel-pending**; the placeholder must not ship |
| G6 | Cost | The `€0.19/min signed` figure is **unverified vendor pricing**; the screen must carry the same `UNVERIFIED` marker `COST-MODEL.md` uses |
| G7 | Config | The alert-matrix "never" column (e.g. never auto-change the greeting) has **no UI representation** — an operator cannot see what the assistant is forbidden to do |
| G8 | Knowledge | "Publish" ownership is unresolved (ours vs the client's) — the button implies a capability we may not grant |
| G9 | All | **No empty/degraded visual design exists** — §12 is a requirement, not a screenshot. Mockups 06–09 render them per surface; 01–05 do not yet |
| G10 | Config | **No prompt editor, by decision** — the screen must *answer* "where do I change what it says", not merely omit the control (§8) |
| G11 | Config | **No unsaved-changes guard** on a P1-shaped save with no undo (§8) |
| G12 | Knowledge | **No UI for a failed or partial ingest** — a half-completed re-index leaves a mixed index, silently (§9) |
| G13 | Knowledge | **The 1024-d server index vs the 384-d desktop index is shown but not explained** — an operator may try to "unify" them (§9) |
| G14 | Cost | **WhatsApp `€0.00` rows are unexplained** — a client will read them as missing data, not as Meta's service-conversation policy (§10) |
| G15 | Cost | **The sparkline has no accessible detail without JS** — decoration until the table can group by day (§10) |
| G16 | Mobile | **"agent-core unreachable" and "no calls yet" look alike at 390 px** — both are a mostly-empty list (§11) |
| G17 | Mobile | **Thumb reach is asserted, not measured** — no voice surface has been checked on a real device (§11) |

## 14. Potential UX improvements (💡 — not defects)

| # | Surface | Opportunity |
|---|---|---|
| U1 | Digest | **"What happened while I was away?" as a single query** — make it typeable, not just browsable. `OPS-ASSISTANT.md` §2 ranks this the most valuable query the assistant can answer |
| U2 | Call detail | **Containment explainer** — one line saying why this call counted as contained. Containment is the pilot's headline metric and is currently un-inspectable |
| U3 | Live monitor | **Turn diff on latency misses** — show the regressing stage against the previous 10 calls' median, not just the absolute number |
| U4 | Cost | **Cost per contained call**, not per minute. It connects inference cost to business value and is the number the client will renegotiate against |
| U5 | Config | **Dry-run the greeting + disclosure with the real voice** before saving — the disclosure line is a 100%-of-calls legal requirement; hearing it once would catch a broken voice id |
| U6 | Alert list | **Group by rule, not by time** — 6 transfer failures is one problem, and `OPS-ASSISTANT.md` §5's one-line rule already assumes it is |
| U7 | Knowledge | **Show which digest answers came from which chunk** — a "knowledge gap" flag is only actionable if the operator can see what was missing |
| U8 | All | **A "what the agent cannot do" panel**, exposed to the owner — the forbidden list is currently only in the docs, and the first support call will be about it |
| U9 | Config | **Show which TTS phrases are cached** and when the cache was invalidated — a stale cache after a voice change reads as "it still sounds like the old voice" (§8) |
| U10 | Knowledge | **A "preview as the agent would answer it" query box** — runs retrieval, shows the retrieved chunks. Turns a knowledge gap from a complaint into a five-second diagnosis (§9) |
| U11 | Cost | **A next-month projection at the current trend**, explicitly marked as a projection, with the fixed/variable split — fixed costs dominate below ~2,000 min/month (§10) |
| U12 | Mobile | **A P1 count on the app badge** so a P1 raised while the owner is elsewhere is visible without opening the console. P1 **only** — everything else waits for the digest, or the badge becomes noise (§11) |
| U13 | Mobile | **Swipe-to-acknowledge on a P1**, single gesture with undo — acknowledging on a phone should not require aiming at a 32 px button (§11) |
