# SMEMaster — Master Plan v1.0

> **Last updated:** 2026-10-04 — voice call system dropped, pivoted to agentic AI automation.
> **Status:** Living document — **single canonical roadmap** for all remaining work.
> **Supersedes:** All other roadmap docs. Feature specs live in `docs/04-FEATURES/`; frontend plans in `docs/03-FRONTEND/`.

---

## Status matrix — the whole roadmap on one screen

| Phase  | Title                 | State                  | Remaining / evidence                                                                 |
| ------ | --------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| **0**  | Foundation            | ✅ DONE                | 868 commands · 36 migrations · 47 store modules · 314 TS test files + 999 Rust tests |
| **1**  | Pre-Release Polish    | 🔶 IN PROGRESS         | Manual tests (panic/WAL/watchdog/dev-verify) + code signing + dogfood/beta left      |
| **2**  | Desktop Power User    | ✅ DONE (15/15)        | Column config closed 2026-09-30                                                      |
| **3**  | Accessibility & i18n  | ✅ DONE                | RTL: 0 violations. i18n: 0 TODO tags                                                 |
| **4**  | Visual & UX           | ✅ DONE (8/8)          | Onboarding is OnboardingScreen.tsx                                                   |
| **5**  | Data Viz & Dashboard  | ✅ DONE                | 10 widget components                                                                 |
| **6**  | Mobile Extended       | 💤 NOT STARTED (0/5)   | Kotlin: zero widget/SmartLock/Contacts/Calendar impl                                 |
| **7**  | Feature Depth         | 🔶 2/7 done, 2 partial | 7.1 ✅ · 7.2 ✅ · 7.3 🔶 · 7.4 🔲 · 7.6 🔶 · 7.7 🔲                                  |
| **8**  | Vault & Storage       | ✅ DONE (5/5)          | All verified                                                                         |
| **9**  | Backend Hardening     | ✅ DONE (6/6)          | All verified                                                                         |
| **10** | Agentic AI Automation | 🔶 ROSTER + CONSOLE BUILT | 5 seeded agents, per-agent voice config, activity recording wired. Voice call system dropped. |
| **11** | Monetization          | 🔲 DESIGN ONLY         | 0 entitlement/paywall code files                                                     |

---

## Legend

| Icon | Meaning                     |
| ---- | --------------------------- |
| ✅   | Complete (evidence in tree) |
| 🔶   | In progress / partial       |
| 🔲   | Not started                 |
| 💤   | Deferred                    |
| ⛔   | Blocked (external)          |

---

## Ground truth (re-grepped 2026-10-04)

| Metric                 | Verified value              |
| ---------------------- | --------------------------- |
| Rust IPC commands      | **868** (804 + 64)          |
| SQL migrations         | **36** .sql files (001–036) |
| Zustand stores         | **47** modules              |
| Rust tests             | **999** attributes          |
| TS test files          | **314** *.test.ts(x) files  |
| RTL violations         | **0**                       |
| ja/it translation debt | **0**                       |

---

## Phase 10 — Agentic AI Automation (🔶 Rust module built)

AI-powered automation for email and social channels. Voice call system (SIP, telephony) dropped — too many hard dependencies.

**Entry point:** `docs/01-ARCHITECTURE/08-agentic-ai-automation.md`

**Rust modules:**

- `config.rs` — AgentConfig management (settings table)
- `providers.rs` — Provider chain with fallback
- `ops.rs` — Ops monitoring and alerts
- `automation.rs` — Email/social automation rules
- `commands.rs` — Tauri commands

**Frontend:**

- `AgentConsolePage` — Ops · Automations · Config tabs
- `useAutomationStore` — Automation rules state
- `useOpsStore` — Ops alerts state
- `useConfigStore` — Config state

**Dropped (voice/WhatsApp) — deleted 2026-10-05, no archive (git history preserves it):**

- `services/agent-core/` (entire Python system: channels, providers, calls tests/migrations)
- `prototype/voice-console/` + `scripts/build_voice_mockups.py` + `scripts/build_voice_deck.py`
- All voice/SIP/telephony code and call-era contract fields (`callCount`, `consentVariant`, `transferTarget`, `SessionRequest`, …)

| #    | Task              | Status     | Evidence                                                    |
| ---- | ----------------- | ---------- | ----------------------------------------------------------- |
| 10.1 | Rust agent module | ✅         | config.rs, providers.rs, ops.rs, automation.rs, commands.rs |
| 10.2 | Tauri commands    | ✅         | 13 console + 9 roster commands registered                   |
| 10.3 | Frontend console  | ✅         | AgentConsolePage with Ops/Automations/Config tabs           |
| 10.4 | Automation rules  | ✅         | 4 default rules (triage, drafts, follow-up, social)         |
| 10.5 | Voice call system | ⛔ DROPPED | SIP/telephony too many dependencies                         |
| 10.6 | Agent roster      | ✅         | `agents` table (mig 034) + 5 seeded built-ins (S7)          |
| 10.7 | Per-agent voice   | ✅         | `voice_*` columns (mig 039); VoiceSettings binds to agent   |
| 10.8 | Activity + metering | ✅       | `ai_activity` table; writer wired into callAi/streamAi      |
| 10.9 | Activity surface  | 🔲         | Table is populated; no UI reads it yet (next sprint)        |

---

## Immediate Next Sprint

| Priority | Task                                                     | Effort      |
| -------- | -------------------------------------------------------- | ----------- |
| P0       | Activity surface — read `ai_activity` into the console    | 2h          |
| P0       | Manual tests (panic, WAL, watchdog, dev-verify) — Gate 1  | 1.5h        |
| P1       | Code signing certs + public key — Gate 3                  | varies      |
| P2       | Dogfooding + beta — Gate 9                                | 1–2w        |
| P3       | Mobile Extended (Phase 6)                                 | ~30h        |
| P4       | Monetization (Phase 11)                                   | design only |

---

## Related Documents

- [Production Readiness](../PRODUCTION-READINESS.md) — 10 gates with evidence
- [STATUS.md](../STATUS.md) — project status
- [Agentic AI Architecture](../01-ARCHITECTURE/08-agentic-ai-automation.md) — agent module docs
- [Backend Structure](../01-ARCHITECTURE/02-backend-structure.md) — Rust backend layout
