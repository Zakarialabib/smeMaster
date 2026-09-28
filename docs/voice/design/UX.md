# UX — Voice & Messaging Agent

> **Status:** Gate 0 design. Feeds spec Gate 3 (console) and Gate 5 (metering views).
> **Sources:** [`CALL-FLOW.md`](../dev/CALL-FLOW.md) · [`OPS-ASSISTANT.md`](../dev/OPS-ASSISTANT.md) ·
> [`PILOT-CRITERIA.md`](../client/PILOT-CRITERIA.md) · [`ADR-001`](../../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md)
> **Wireframes:** [`WIREFRAMES.md`](WIREFRAMES.md) · **Mockups:** [`mockups/`](mockups/)

## 1. Who this is for

| Persona | Where they are | What they need | Design consequence |
|---|---|---|---|
| **The owner-operator** (client staff) | On a phone, mid-task, often away from a desk | To know *what happened* and *what needs them now* | The digest is the primary surface, not the live monitor. Everything must work one-handed at 390 px |
| **Us — service operator** | At a desk, during an incident | To attribute a fault to a stage and act | The live view must expose the four stage marks per turn, and every alert must carry a decision |
| **The caller** | On the phone | A human when they want one, and no surprises | Disclosure-first, a deterministic escape hatch, and never a silent transfer failure |

**The persona that is easy to forget is the second one.** The console exists equally for
incident response — which is why `OPS-ASSISTANT.md` §3's alert matrix, not the transcript, is
the densest requirement in this document.

## 2. Jobs to be done (ranked)

1. **"What happened while I was away?"** — one screen, scannable in five seconds. The single
   most valuable query the product can answer.
2. **"Something is wrong right now"** — know *which* thing, how bad, and what to do.
3. **"What did that call actually say?"** — the transcript + a two-line summary, not a dump.
4. **"Let me change how it answers"** — voice, hours, transfer target, knowledge scope, tier.
5. **"What is this costing me?"** — metered minutes vs the signed model, per call type.

Rank 1 outranks 3 deliberately: a transcript viewer is a debugging tool; the digest is the
product.

## 3. Design principles

1. **Propose / dispose.** The assistant never acts on a caller and never acts on the owner's
   behalf. Every surface shows a *decision*, not just a fact. (`OPS-ASSISTANT.md` §3.)
2. **One line, then the fact.** `P1 transfer failures — 6 in 20 min, target unreachable since
   14:32 →`. Not a paragraph. (`OPS-ASSISTANT.md` §5.)
3. **Digest, not stream.** One morning summary beats 200 pushes. P1 is the only exception.
4. **Never repeat what is on screen.** If it is in the dashboard, it does not belong in a
   notification.
5. **Instrument first, automate second.** Every threshold in the alert matrix is a
   placeholder until pilot data exists — the UI must show a threshold's provenance, not
   present a guess as a measurement.
6. **No silent failure, ever.** A dropped transfer is worse than a bad bot: the caller
   believes a human is coming. Every transfer shows its outcome.

## 4. Information architecture

The console is a **client of `agent-core`**, not a feature of the desktop's local data. It
mounts as a new feature (`src/features/agent/`, spec Gate 3) with one nav entry, reached from
the app's grouped rail (`NAV_GROUPS` in `src/shared/components/layout/shell/navConfig.ts`).

| Route | Surface | Primary persona |
|---|---|---|
| `/calls` | Call log (default) | owner |
| `/calls/live/:id` | Live call monitor | us (ops) |
| `/calls/:id` | Call detail — transcript, summary, metrics, transfer outcome | owner + us |
| `/ops` | Morning digest / "what happened" | owner |
| `/ops/alerts` | Alert list, filterable by severity | owner + us |
| `/ops/alerts/:id` | Alert detail — the decision, the evidence, the affected calls | us |
| `/agent/config` | Voice, language, business hours, transfer target, tier | owner |
| `/agent/knowledge` | Knowledge scope + ingestion status | owner (scope) + us (pipeline) |
| `/agent/cost` | Metered minutes vs the signed model, per call type | owner |

**Why one nav entry and not four.** Nine routes behind one destination keeps the rail at the
app's condensed target. `Calls` is the noun the owner uses; `Ops`, `Config` and `Cost` are its
sub-items, not siblings competing with Mail and CRM.

**Where it does *not* belong:** the live monitor is not the landing route. An owner opening
the app wants the digest; the live view is what an operator pins during an incident.

## 5. Surface inventory

| # | Surface | Answers | Entry | Primary action |
|---|---|---|---|---|
| 1 | Call log | "what calls came in?" | nav | open a call |
| 2 | Live monitor | "what is happening on this call right now?" | log row marked *live*, or an alert | watch (no intervention in v1) |
| 3 | Call detail | "what was said, and did it end well?" | log row | re-send the owner summary |
| 4 | Digest | "what happened while I was away?" | nav/ops, morning push | open the top item |
| 5 | Alert list | "what needs me?" | nav/ops, P1 push | open the alert |
| 6 | Alert detail | "what do I do about it?" | alert row | take the decision |
| 7 | Agent config | "how does it answer?" | nav/agent | save |
| 8 | Knowledge scope | "what is it allowed to know?" | nav/agent | publish to the server |
| 9 | Cost | "what is this costing?" | nav/agent | see the flagged calls |

**The five-second rule for surfaces 1, 4, 5.** If a doc could be answered by a log line the
operator already had, the surface is decoration.

## 6. Core flows

### 6.1 Watch a live call (ops, during an incident)
`alert (P1) → alert detail → affected calls → live monitor → read stage marks → act`

The monitor shows call state, elapsed time, the streaming transcript, and the **current
turn's** four stage marks. It cannot intervene — **barge-in is out of scope for v1** and the UI
must not offer a control that implies otherwise (`OPS-ASSISTANT.md` §1, option C).

### 6.2 Handle a P1
`push (P1 only) → alert detail → decision + evidence + caller's message → take action →
alert clears`

The detail view must answer, without scrolling: **what broke, since when, how many calls, and
what is the one thing to do.** `agent_get_ops_snapshot` (`ADR-001` D4b) exists to make this one
round trip.

### 6.3 Catch up after absence
`open app → digest (P3/P2 rolled up, newest-first, grouped by call type) → expand one → call
detail`

Nothing in the digest may require a second fetch to be *understood*. Expanding is for detail,
never for meaning.

## 7. States and edge cases

These are the states that decide whether the console feels trustworthy. Each is a required
build item, not a polish item.

| State | Trigger | Required UI |
|---|---|---|
| **No calls yet** | fresh tenant | explains what will appear, and the setup that must finish first (number, Meta verification) — never a bare empty table |
| **Agent offline / `agent-core` unreachable** | service down | explicit "we cannot reach the agent" with last-seen timestamp. **Must not render as "no calls"** — that is the dangerous confusion |
| **Zero inbound for 6h in business hours** | carrier/number fault | surfaced as a **P1**, not as quiet (`OPS-ASSISTANT.md` §3) |
| **Transfer failed** | target unreachable | the caller's message is foregrounded; the target line is flagged; the alert says *take the call back yourself* |
| **Provider degraded** | error rate > 2% | names the provider and whether the fallback chain took over; **never a silent failover** |
| **Fallback chain exhausted** | all providers down | page, with blast radius: which tenants, since when |
| **After-hours, voicemail captured** | §5 path | appears in the morning digest; **does not wake anyone** |
| **No audio to audit** | by design | the disclosure audit is **transcript-based** (`PILOT-CRITERIA.md`) — the call detail must say so rather than offering a play button that cannot exist |
| **Transcript partial** | mid-call | deltas append with a live region; never re-render the whole transcript per delta |
| **Emergency policy triggered** | distress/urgency signal | logged and surfaced to a human immediately; **never treated as routine** |
| **Cost over model** | > +20% | shows which calls/skills are expensive — not just the total |

## 8. Notification design

| Severity | Channel | Timing | Content rule |
|---|---|---|---|
| **P1** | push / WhatsApp to the operator | immediately | one line + the fact + the decision. Never batched |
| **P2** | in-app only | digest | grouped, with the stage breakdown where latency is the issue |
| **P3** | in-app only | morning digest | rolled up; "surface in the morning" literally means the morning |

**Quiet hours:** P1 pierces them; nothing else does. The escalation for an unacknowledged P1 is
a product decision that has **not been made** — see §13.

## 9. Accessibility (WCAG AA, non-negotiable)

- **The streaming transcript is a live region.** `aria-live="polite"` for appended deltas,
  `aria-atomic="false"`. A screen reader must not re-read the whole transcript on each delta —
  this is the single most common failure in a streaming UI.
- **Status is never colour alone.** Call state, alert severity and provider health each carry
  text or an icon in addition to hue. Severity has a text label (`P1`), not just `--color-danger`.
- **Keyboard:** every surface is reachable and operable without a pointer; alert rows are a
  single tab stop with a roving tabindex, not N stops.
- **Focus order** follows reading order: state → transcript → metrics → actions.
- **Reduced motion:** the live indicator's pulse respects `prefers-reduced-motion`; use the
  app's existing pattern rather than a new one.
- **Contrast:** `--color-text-tertiary` (#7a7680) on `--color-bg-secondary` (#f7f8fa) is the
  floor — do not go lighter for de-emphasised metadata.
- **RTL + locales:** logical properties only (`ms-*`/`me-*`, `text-start/end`,
  `inset-inline-*`). The console ships in the app's 5 locales (en/fr/ar/ja/it) — **but voice
  itself is FR/EN only**, and the UI must not imply Arabic voice support
  (`docs/glossary/glossary-voice-agent.md`: *UI locale ≠ voice locale*).
- **Timestamps** localise; **call durations and costs** use locale-aware number formatting.

## 10. Visual language

Reuse the app's locked system — do not invent a console theme
(`src/styles/globals.css` `@theme`, `src/shared/styles/ui-tokens.ts`).

| Element | Token | Why |
|---|---|---|
| AI-derived content (summaries, proposed decisions, insights) | `--color-ai` #9333ea, `bg-ai/[0.06]`, `border-ai` | Same purple that marks AI surfaces app-wide, via `AiSuggestionBanner` |
| Primary accent (live state, primary action) | `--color-accent` #0b57d0 | The app's single accent |
| P1 | `--color-danger` #e11d48 | plus the literal text `P1` |
| P2 / degradation | `--color-warning` #d97706 | |
| Healthy provider, resolved call | `--color-success` #059669 | |
| Surfaces | `frost-surface` + `--radius-lg` (16px), `--elevation-sm/md` | Border-based depth, no heavy shadows |
| Tables | shared `DataTable` (config-object columns) | Themeable without forking |
| Avatars (caller, operator) | shared `Avatar` (gradient) | Consistent identity cue |

**The AI purple means "the assistant inferred this".** A transcript is a fact (neutral
surface). A summary, a containment judgement, or a proposed decision is an inference (purple).
Conflating them is how an operator learns to distrust the assistant's output.

## 11. Mobile first

The owner's device is a phone. Verified against the repo's mobile surface
(`docs/00-SCREENSHOTS/05-home-mobile-crm_.png`, `09-tasks-mobile-crm_.png`): condensed single
column, top nav rather than a rail, card-per-item rather than dense tables.

| Desktop | Phone |
|---|---|
| Call log as a `DataTable` | card list: caller · duration · outcome · flagged |
| Live monitor side-by-side: transcript \| metrics | transcript only; metrics collapse into a disclosure row |
| Config as a tabbed panel | one section per screen, stacked |
| Digest with a right-hand context rail | digest only; the rail is the digest |

**A live call on a phone is read-only by design.** Watching is fine; acting mid-call is not a
v1 capability, and a thumb-sized button that appears to allow it is a support ticket.

## 12. Out of scope, and why it is written down

| Not in v1 | Reason |
|---|---|
| Supervisor barge-in / live intervention | The only item here that can damage a real customer interaction. Deferred with a reason, not quietly |
| Voice clips in the UI | No audio is retained (`CALL-FLOW.md` §2) — a play button cannot exist |
| Outbound calls or campaigns | Different consent and spam regime |
| CRM/calendar writes | Explicitly out of v1 scope; the agent talks, records, and summarises |
| Arabic/Darija voice UI | UI locale ≠ voice locale. Promising it in the interface would be a lie |
| Model/prompt editing in the console | Ops assistant "never rewrites prompts" (`OPS-ASSISTANT.md` §3). Config, not prompt authoring |

## 13. Open UX questions

| # | Question | Owner | Blocks |
|---|---|---|---|
| 1 | Does an unacknowledged P1 escalate, and to whom? | client + us | alert delivery (Gate 7) |
| 2 | Is the operator one person or a rota? (decides whether acknowledgement state exists at all) | client | alerts UI |
| 3 | Does the owner want the digest pushed to WhatsApp as well as in-app? (that is a template message — priced) | client + BSP | notification design, `COST-MODEL.md` Open #1 |
| 4 | Can the owner edit the knowledge scope themselves, or is that our operation? | client | `/agent/knowledge` |
| 5 | Call-detail retention window shown in the UI (transcripts are retained; audio is not) | counsel | call detail |
