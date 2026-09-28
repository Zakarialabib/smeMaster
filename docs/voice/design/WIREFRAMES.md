# Wireframes — Voice & Messaging Agent Console

> **Status:** source-derived from the Gate 0 design set, **not screenshot-verified** — no console
> code exists yet (spec Gate 3 builds it). Every layout below traces to a requirement in
> [`UX.md`](UX.md), [`CALL-FLOW.md`](../dev/CALL-FLOW.md) or [`OPS-ASSISTANT.md`](../dev/OPS-ASSISTANT.md);
> nothing is invented.
> **Mockups:** [`mockups/`](mockups/) — HTML, on the real tokens. **Gaps:** §13. **UX opportunities:** §14.

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
| 8 | Agent config | `/agent/config` | `CALL-FLOW.md` §5–7 | — |
| 9 | Knowledge scope | `/agent/knowledge` | `RAG-FORK.md` §Recommendation | — |
| 10 | Cost | `/agent/cost` | `COST-MODEL.md` §1–3 | — |
| 11 | Mobile variants | all | `UX.md` §11 | — (folded into §11) |

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

## 8–10. Config · Knowledge · Cost (condensed)

```
/agent/config                          /agent/knowledge           /agent/cost
┌──────────────────────────────┐      ┌──────────────────────┐   ┌──────────────────────────┐
│ Voice      ⟨fr⟩ siwis-medium │      │ SCOPE (client-owned) │   │ 412 min · 128 calls      │
│ Language   ☑FR ☑EN  ○AR(off) │      │ ☑ services  ☑ hours  │   │ model: €0.19/min signed  │
│ Hours      Mon–Fri 09–18     │      │ ☑ pricing   ☑ rules  │   │ actual: €0.21/min  ⚠+11% │
│ Transfer   +33 6 ** ** 41 22 │      │ ☐ mail  ☐ contacts   │   │ ───────────────────────  │
│ Tier       ○budget ●std      │      │ chunks: 287 / 500    │   │ expensive calls ⚑ 4      │
│ TTS cache  ☑ on (12 phrases) │      │ last ingest: 2 h ago │   │ off-hours  38% of volume │
│ [ Save ]  [ Test call ]      │      │ [ Publish ]          │   │ [ by call type ▾ ]       │
└──────────────────────────────┘      └──────────────────────┘   └──────────────────────────┘
```

| Surface | Key actions | Notes |
|---|---|---|
| Config | save, test call | `Test call` starts a session via `agent_start_session`. **No prompt editor** (`OPS-ASSISTANT.md` §3) |
| Config | Tier selector | budget = the self-hosted tier (`../dev/SELF-HOSTING.md`), disabled with a reason until measured |
| Knowledge | publish | publish is **our** operation until the client owns it (`UX.md` Open Q4) |
| Knowledge | scope checkboxes | mail/contacts unchecked by default — the privacy guardrail |
| Cost | drill-down | flags calls > +20% over model, per `OPS-ASSISTANT.md` §3 |

---

## 11. Mobile variants

```
MOBILE — DIGEST (primary)              MOBILE — LIVE (read-only)
┌───────────────────────┐              ┌───────────────────────┐
│ ◀ Ops          ⟨fr⟩ ▾ │              │ ◀ ● LIVE   SPEAKING   │
├───────────────────────┤              ├───────────────────────┤
│ 14 calls · 79% ✔      │              │ ⏱ 1:42   Voice        │
├───────────────────────┤              ├───────────────────────┤
│ ⟡ P1 · Transfers      │              │ Agent ───────────────  │
│   6 failed, 3 waiting │              │  Cet appel est pris…  │
│   [ Open the 3 ]      │              │ Caller ──────────────  │
├───────────────────────┤              │  Bonjour, je voudr…   │
│ ⟡ 22:41 Voicemail →   │              │ …streaming…           │
│   WhatsApp sent ✔     │              ├───────────────────────┤
│ ⟡ 21:05 Pricing ⚑     │              │ ▸ metrics (0.72s ✔)   │
│   knowledge gap       │              ├───────────────────────┤
└───────────────────────┘              │ ⓘ Read-only in v1.    │
                                       └───────────────────────┘
```

| Desktop | Phone |
|---|---|
| `DataTable` call log | card list (caller · duration · outcome · flag) |
| transcript \| metrics side-by-side | transcript; metrics behind a disclosure |
| tabbed config | one section per screen, stacked |
| digest + right insight rail | digest only |

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
| G9 | All | **No empty/degraded visual design exists** — §12 is a requirement, not a screenshot |

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
