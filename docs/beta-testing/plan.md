# SMEMaster Beta Test Plan

This plan describes the **closed beta** run that immediately precedes the public
v1.0.0 launch. Its purpose is to validate SMEMaster with real small-business
owners in their own environment, on their own machines, doing their own work —
not a guided demo.

---

## 1. Goals

1. Confirm the install → onboard → first-use flow works on a clean machine.
2. Catch regressions we missed during internal dogfooding.
3. Get a Net Promoter Score (NPS) signal for the v1.0.0 release.
4. Surface the top 3 "would pay for this" and top 3 "would not" reasons.

## 2. Non-goals

- Performance benchmarking at scale (handled by Gate 8 / stress harness).
- Marketing copy or feature validation (handled by UX research separately).
- Multi-user / shared-inbox flows (not in v1.0.0).

---

## 3. Recruitment criteria

We want **5–10 participants**. The target profile is small and intentional.

| Criterion | Why |
| --- | --- |
| Owner / operator of an SME (1–25 employees) | The product is built for this persona. |
| Sends and receives at least 30 emails / day | We need real inbox pressure, not a sandbox. |
| Currently uses **at least one** of: Gmail web, Outlook web, Apple Mail, Thunderbird, a non-Apple desktop client | Baseline comparison. |
| Comfortable installing unsigned / beta software on their work machine | Tech-fluency floor so install issues aren't the noise. |
| **Not** a software developer, designer, or QA engineer | Avoid the "I would have built it differently" feedback loop. |
| Willing to do a 30 min intro call + 15 min mid-week check-in + 45 min final interview | Engagement is the whole point. |

### Outreach

- Post in 2–3 small-business owner communities (Indie Hackers, local chambers of
  commerce, Mastodon `#smallbiz`).
- Existing waitlist subscribers, filtered by self-reported role.
- Personal network with the explicit ask: "use this for a week, tell me the
  truth".

### Disqualifiers

- Anyone on the SMEMaster team or their immediate family.
- Anyone with a public profile in tech media (they will not behave like a
  representative user).
- Anyone running only IMAP-less webmail in a corporate-managed browser that
  blocks downloads (common in finance / healthcare).

---

## 4. Duration

**1 calendar week** (7 days), starting on a Monday.

Tester starts on a clean install. They keep their existing email client running
side by side for the first 2 days, then are asked to switch fully on day 3 if
they are comfortable.

---

## 5. Schedule

| When | Activity | Format | Owner |
| --- | --- | --- | --- |
| **Day -3** | Recruitment closes | — | Community lead |
| **Day 0 (Mon)** | Intro session (30 min) | Video call, screen-share | Beta lead |
| **Day 1 (Tue)** | Self-installation + onboarding | Async, recorded screen share optional | Tester |
| **Day 3 (Thu)** | Mid-week check-in (15 min) | Voice call | Beta lead |
| **Day 7 (next Mon)** | Final interview (45 min) | Video call, recorded | Product lead |
| **Day 8** | NPS aggregation + write-up | Internal | Beta lead |

### Intro session agenda (30 min)

1. (5 min) Walk through the scenarios in `scenarios.md`.
2. (5 min) Show the auto-updater so testers know they will receive fixes
   during the week.
3. (5 min) Explain how to file a bug, and the expectations on logs.
4. (5 min) Explain the data scope: SMEMaster is fully local, they can drop out
   at any time, all their data stays on their machine.
5. (10 min) Q&A.

### Mid-week check-in agenda (15 min)

1. Which scenarios have you finished?
2. Anything broken that blocked you?
3. Anything you discovered the product does that you didn't expect?
4. Any crash? Did auto-update work?

### Final interview agenda (45 min)

1. Walk through every completed scenario and the feedback form.
2. NPS question and follow-up "why".
3. "What is the one feature that, if added, would make you pay for it?"
4. "What is the one thing that, if broken, would make you stop?"
5. "Would you recommend SMEMaster to a friend who runs a small business? Why?"

---

## 6. Tasks and tracking

### Testers' tasks

Each tester receives:

- A signed NDA (template in `docs/legal/beta-nda.md`, if applicable — see §9).
- A unique tester ID (`BETA-001` ... `BETA-010`).
- The scenario pack: `scenarios.md`.
- A blank feedback form per scenario: `feedback.md`.
- A private bug-report channel (GitHub repo issues with the `beta` label, or a
  shared Discord channel).

### Tracking

- One GitHub Project board with columns: **Not started**, **In progress**,
  **Blocked**, **Done**, **Won't fix in v1**.
- Each scenario row is tagged with the tester ID(s) attempting it.
- Each bug filed is linked to the scenario row.
- Daily roll-up email at 18:00 from the beta lead to the engineering team.

### Reporting

- Day 3 — preliminary report: install success rate, top 3 crashes.
- Day 7 — full report: scenario completion matrix, NPS, top 10 bugs sorted by
  tester count, top 5 feature requests.
- Day 8 — go / no-go recommendation for the public release.

---

## 7. Compensation

| Item | Amount | Notes |
| --- | --- | --- |
| Gift card (per tester) | **$100 USD** equivalent in local currency | Sent on Day 0. |
| Bonus (per tester, optional) | **$50 USD** if all 8 scenarios completed + final interview done | Sent on Day 8. |
| Free 1-year Pro license (per tester) | Yes | Sent with the public v1.0.0 release. |

Total budget: 10 testers × ($100 + $50) + 10 × Pro license = **$1,500 cash +
licenses**, well within the gate budget.

If the tester is in a jurisdiction where a gift card is impractical (e.g.
Venezuela, Iran, North Korea — we will not run the test there), substitute with
a bank transfer or equivalent digital payment, subject to local law.

---

## 8. Data handling

- SMEMaster stores all tester data locally on their own machine.
- The auto-updater sends only the platform + app version + app channel
  (`beta`) to the update server. No message content, no contacts, no tasks.
- Testers are instructed **not** to import a real production account if the data
  is sensitive; they may use a test account for the week instead.
- Logs (`smemaster.log`) collected for bug triage are scrubbed of message
  bodies before being attached to a GitHub issue.

---

## 9. NDA

Use a mutual NDA only if any of the following are true:

- A tester is in a regulated industry (finance, healthcare, legal) and would
  otherwise be unable to participate.
- We are showing a feature that is not yet public (e.g. AI warmup generator).

The default is **no NDA** — the build is the same public v1.0.0 candidate, and
we want candid feedback, not gated feedback. A short, mutual, single-page NDA
template lives at `docs/legal/beta-nda.md` (out of scope for this gate).

---

## 10. Exit criteria for the gate

Gate 9 (FINAL VALIDATION) is considered PASS only when:

- [ ] At least **5 testers** completed the full week.
- [ ] **NPS ≥ 30** (Promoters − Detractors).
- [ ] **Zero P0 bugs** open (crash, data loss, security).
- [ ] **≤ 2 P1 bugs** open (major feature broken, workaround exists).
- [ ] Install success rate **≥ 90%** (1 failure out of 10 is acceptable).
- [ ] Final report is filed in `docs/beta-testing/REPORT.md`.

If any of the above fail, the gate owner calls a release delay and decides
between fix-forward or hotfix.
