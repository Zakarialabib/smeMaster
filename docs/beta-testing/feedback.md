# SMEMaster Beta Feedback Form

One form per scenario, per tester. Copy this template, fill it in, and submit
through the beta channel the lead set up (GitHub issue with label `beta`, or
shared form link).

If a scenario is **not** attempted, mark it `Skipped` and explain why in the
blocker section. Skipped scenarios still count in the report.

---

## Header

- **Tester name:**
- **Tester ID:** (e.g. `BETA-003`)
- **Date:**
- **SMEMaster version:** (e.g. `1.0.0-beta.4`)
- **Platform:** (Windows / macOS / Linux — version)
- **Scenario number and name:** (e.g. `3 — Contact management`)

---

## Scenarios completed (overall, end of week)

Tick every scenario the tester finished at least once during the week. You can
re-run scenarios — note re-runs in the per-scenario form.

- [ ] 1 — Onboard from scratch
- [ ] 2 — Daily email flow
- [ ] 3 — Contact management
- [ ] 4 — Task workflow
- [ ] 5 — Calendar event
- [ ] 6 — Backup and restore
- [ ] 7 — Offline mode
- [ ] 8 — Crash recovery

---

## Time to complete each scenario

Record the time from "I started reading the scenario" to "the expected
outcome is visible". Include re-run time separately.

| Scenario | First attempt | Re-run(s) | Notes |
| --- | --- | --- | --- |
| 1 — Onboard from scratch | _min | _min | |
| 2 — Daily email flow | _min | _min | |
| 3 — Contact management | _min | _min | |
| 4 — Task workflow | _min | _min | |
| 5 — Calendar event | _min | _min | |
| 6 — Backup and restore | _min | _min | |
| 7 — Offline mode | _min | _min | |
| 8 — Crash recovery | _min | _min | |

---

## Friction rating per scenario

`1 = totally smooth, no friction` ... `5 = blocked, would not use again`

| Scenario | Rating | One-sentence why |
| --- | --- | --- |
| 1 | /5 | |
| 2 | /5 | |
| 3 | /5 | |
| 4 | /5 | |
| 5 | /5 | |
| 6 | /5 | |
| 7 | /5 | |
| 8 | /5 | |

---

## Bugs encountered

One row per distinct bug. Do not combine two bugs in one row — the engineering
team triages per row.

| # | Scenario | Steps to reproduce | Expected | Actual | Severity | Log attached? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | | 1. ... 2. ... 3. ... | | | P0 / P1 / P2 / P3 | yes / no |
| 2 | | | | | | |
| 3 | | | | | | |

**Severity guide:**

- **P0** — crash, data loss, security issue, blocks a core scenario.
- **P1** — major feature broken but a workaround exists, or blocks a single
  scenario.
- **P2** — minor feature broken, easy workaround, low impact.
- **P3** — cosmetic, copy typo, animation glitch.

Attach a snippet of `smemaster.log` for every P0 and P1 bug.

---

## Feature requests

What did you wish the app did? Don't worry about whether it is in scope for
v1.0.0 — we want the full wishlist.

| # | Title | Why it matters to me | Effort guess (S/M/L/XL) |
| --- | --- | --- | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

## Overall NPS score

> "How likely are you to recommend SMEMaster to a friend who runs a small
> business?"
>
> **0 = not at all likely**, **10 = extremely likely**

**Score (0–10):**

**Why that score and not one point higher?**

---

## Optional — qualitative end-of-week questions

A few sentences each is plenty. These go straight into the public release
retro.

**What did you enjoy the most?**

**What was the single most painful moment?**

**What is the one thing you would change tomorrow if you were the PM?**

**Anything else?**

---

## Submission

Submit this form to the beta lead through the agreed channel. If the file is
large, attach it to a GitHub issue with label `beta` and link the issue in
`docs/beta-testing/responses/<tester-id>.md`.
