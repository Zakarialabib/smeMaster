# Pilot Success Criteria — Voice & WhatsApp Agent (FR/EN)

> **Status:** PROPOSED — to be signed as part of Gate 0, before the pilot runs.
> **Spec:** [`docs/specs/2026-09-28-voice-agent.md`](../specs/2026-09-28-voice-agent.md)
> **Defined:** 2026-09-28

These are the numbers that decide whether phase 2 happens. They are proposed now,
while nothing is built, so neither side is negotiating them after the fact.

## Scope

- **Duration:** 2 weeks
- **Volume:** ≥ 100 real calls
- **Channels:** inbound voice (dedicated FR number) + inbound WhatsApp
- **Not included:** outbound calls, outbound WhatsApp templates, CRM/calendar
  writes, languages other than FR/EN

## Success criteria

| Axis | Bar | How it is measured |
|---|---|---|
| `answer_latency` — carrier connect → first greeting audio | **p95 < 2s** | `CALL-FLOW.md` §3 instrumentation |
| `turn_gap` — caller stops speaking → first agent audio | **p50 < 1.0s, p95 < 1.6s** | per-turn stage marks |
| FR/EN language pinning | **≥ 95% correct** | transcript review, sampled |
| FR/EN transcript quality | **≥ 90% intelligible without reading the audio** | sampled transcripts, human review |
| Voicemail detection | **≥ 95%** | labelled sample review |
| Warm transfer | **100% of attempts complete, 0 silent failures** | transfer outcome log, no exceptions |
| **Containment** — target call type resolved without a human | **≥ 60–70%** | the headline number; baseline recorded in week 1 |
| WhatsApp first reply latency | **< 5s**, inside the 24h service window | webhook + send timestamps |
| Voicemail → WhatsApp summary delivered | **≥ 95%** of voicemail calls | wrapup latency log |
| Uptime, business hours | **99.5%** | health check + monitoring |
| Realized cost per minute | **within ±20% of the signed cost model** | metered events vs `COST-MODEL.md` |
| Disclosure line spoken | **100% of calls** | **transcript** audit — no audio is retained (`CALL-FLOW.md` §2), so transcripts are the only evidence. Non-negotiable, not a percentage |
| Emergency policy honoured | **100%** | any incident is a pilot failure |

## Go / no-go

**Go to phase 2** if: containment ≥ 60%, warm transfer 100%, disclosure 100%,
and realized cost within ±20% of the signed model.

**Partial / iterate** if: latency misses but containment holds — latency is
optimisable in phase 2, behaviour is not.

**No-go** if: containment < 40% at 100+ calls, or the cost model is breached by
more than 20%. Both mean the economics, not the code, are the problem.

## Baseline capture (week 1)

Before the agent handles anything, record for one week:
- calls currently missed or returned to voicemail
- average handling time on the target call type
- how often the caller ends up transferred anyway

Without a baseline, "60% containment" has nothing to be measured against, and the
pilot cannot demonstrate value — only demonstrate activity.

## Explicitly not a success criterion

- **Call volume.** A working agent that handles few calls correctly is a success.
- **Novelty.** How impressive the demo sounds is not a metric.
- **Scope delivered.** Building phase 3 features early is not a win.
