# SMEMaster Docs

> **Stack:** Tauri v2 + React 19 + Rust + SQLite (offline-first)
> **Version:** 1.0.0-rc · **DB:** 34 migrations (verified) · **Tests:** 2,470+ TS + 900+ Rust (verified via `npm run test` / `cargo test`)
> **Locales:** en, fr, ar, ja, it (RTL for ar) · **Commands:** 831 `#[tauri::command]` (verified) · **Stores:** 43 Zustand (verified)
> **Features Added:** Invoicing (Morocco DGI-compliant) ✅ · POS Hardware Integration ✅
> **Platforms:** Desktop (Windows · Linux · macOS) ✅ · Mobile (Android) ✅ · iOS (requires Mac) ⚠️
> **Master Plan:** `docs/06-ROADMAP/09-master-plan.md` — remaining work phases
>
> ⚠️ **Ground-truth note (2026-07-15):** Several historical docs quote stale metrics (773/652/704 commands, 60/56/22 migrations, 38/21 stores). The numbers above are grepped directly from source and are canonical. See `docs/STATUS.md → Verified Ground Truth` for the single reconciled table.

---

## How to use these docs

**New here?** Start with [01-overview](01-ARCHITECTURE/01-overview.md) to understand the architecture, then [01-quickstart](05-DEVELOPMENT/01-quickstart.md) to get it running.

**Adding a feature?** Read [05-reuse-patterns](05-DEVELOPMENT/05-reuse-patterns.md) first — it has the gotchas that'll save you hours.

**Working on UI?** The [DESIGN_SYSTEM_GUIDE](05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md) is the source of truth for tokens, components, and visual patterns.

**Composing email?** See the [Composer Architecture](superpowers/composer-architecture.md) doc.

**Working on AI prompts or RAG?** Start with the [Prompt Engineering](03-FRONTEND/ai-prompt-engineering.md) guide, then [AI RAG](04-FEATURES/ai-rag.md) for the big picture.

**Just browsing?** The [STATUS.md](STATUS.md) gives you the full picture of where things stand.

**Shipping a release?** See [PRODUCTION-READINESS.md](PRODUCTION-READINESS.md) for all 9 gate status, then [release/checklist.md](release/checklist.md) for the pre-release checklist. The automated pipeline is documented in [06-release-pipeline.md](05-DEVELOPMENT/06-release-pipeline.md).

---

## Architecture

How the system is built.

| Doc                                                                   | Covers                                            |
| --------------------------------------------------------------------- | ------------------------------------------------- |
| [01-overview](01-ARCHITECTURE/01-overview.md)                         | Three-layer architecture: React → Service → Rust  |
| [02-backend-structure](01-ARCHITECTURE/02-backend-structure.md)       | Rust module layout, DB commands, plugins          |
| [03-data-model](01-ARCHITECTURE/03-data-model.md)                     | Schema ownership, domains, consolidation patterns |
| [05-mobile-architecture](01-ARCHITECTURE/05-mobile-architecture.md)   | 80/20 code reuse, platform detection              |
| [06-schema-relationships](01-ARCHITECTURE/06-schema-relationships.md) | 60+ foreign keys, full FK map                     |

## Backend

Rust & Tauri — the native layer.

| Doc                                                          | Covers                                        |
| ------------------------------------------------------------ | --------------------------------------------- |
| [01-imap-engine](02-BACKEND/01-imap-engine.md)               | async-imap, MIME parsing, delta sync          |
| [02-smtp-client](02-BACKEND/02-smtp-client.md)               | lettre transport, OAuth2                      |
| [03-pgp-crypto](02-BACKEND/03-pgp-crypto.md)                 | PGP key gen, encrypt/decrypt                  |
| [04-oauth-flow](02-BACKEND/04-oauth-flow.md)                 | PKCE OAuth, localhost server, token refresh   |
| [05-plugins-inventory](02-BACKEND/05-plugins-inventory.md)   | 14 Tauri plugins + mobile                     |
| [06-commands-reference](02-BACKEND/06-commands-reference.md) | 831 IPC commands (35 invoicing + 12 POS)      |
| [07-key-management](02-BACKEND/07-key-management.md)         | AES-256-GCM, PGP, security model              |
| [08-mobile-build](02-BACKEND/08-mobile-build.md)             | APK generation, platform targets              |
| [10-error-system](02-BACKEND/10-error-system.md)             | SerializedError type system                   |
| [11-event-system](02-BACKEND/11-event-system.md)             | EventBus, AppEvent enum, DomainEventProcessor |
| [12-diagnostics](02-BACKEND/12-diagnostics.md)               | Backend tech-debt & diagnostics tracking      |
| [ai-rag](02-BACKEND/ai-rag.md)                               | Rust: candle, LanceDB, parser, indexer        |

## Frontend

React 19, TypeScript, Tailwind, Zustand.

| Doc                                                             | Covers                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| [02-state-management](03-FRONTEND/02-state-management.md)       | Store boundaries and ownership                             |
| [03-service-layer](03-FRONTEND/03-service-layer.md)             | Frontend service and runtime flow                          |
| [04-dependencies](03-FRONTEND/04-dependencies.md)               | Current package and crate choices                          |
| [06-mobile-ui-strategy](03-FRONTEND/06-mobile-ui-strategy.md)   | Layout modes, touch                                        |
| [07-event-bus](03-FRONTEND/07-event-bus.md)                     | App events and frontend bus (uiBus) usage                  |
| [08-ui-ux-roadmap](03-FRONTEND/08-ui-ux-roadmap.md)             | Desktop + Mobile UI/UX plan                                |
| [09-state-split](03-FRONTEND/09-state-split.md)                 | UI store split                                             |
| [10-rtl-audit](03-FRONTEND/10-rtl-audit.md)                     | RTL layout readiness audit (physical-direction violations) |
| [11-typed-ipc](03-FRONTEND/11-typed-ipc.md)                     | Frontend ↔ Rust command boundary                           |
| [12-ui-super-app-spec](03-FRONTEND/12-ui-super-app-spec.md)     | UI reorganization & design spec                            |
| [13-deprecations](03-FRONTEND/13-deprecations.md)               | Frontend tech-debt & deprecation tracking                  |
| [14-navigation-ia-spec](03-FRONTEND/14-navigation-ia-spec.md)   | Email-first rail order, orphaned feature wiring            |
| [15-shared-components](03-FRONTEND/15-shared-components.md)     | Reusable UI primitives + stability hooks/utils             |
| [ai-prompt-engineering](03-FRONTEND/ai-prompt-engineering.md)   | All AI prompts — email, inbox, CRM, RAG, task extraction   |
| [ai-context-engineering](03-FRONTEND/ai-context-engineering.md) | Context construction — data sourcing, truncation, quality  |
| [ai-rag](03-FRONTEND/ai-rag.md)                                 | TS wrappers, store, components, routing                    |

## Features

What the app does, grouped by functional area.

### Core Workflows

| Doc                                                                        | Covers                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------- |
| [Email](04-FEATURES/Core/01-email-management.md) ⚠️ **MISSING**            | Inbox, threads, sync, triage — not yet written        |
| [Accounts](04-FEATURES/Core/04-accounts.md) ⚠️ **MISSING**                 | Account setup, auth, providers — not yet written      |
| [CRM](04-FEATURES/Core/03-crm-contacts.md) ⚠️ **MISSING**                  | Contacts, groups, segments — not yet written          |
| [Campaigns](04-FEATURES/02-campaigns-mail-merge.md)                        | Campaign builder, block editor, mail merge            |
| [Calendar](04-FEATURES/Core/07-calendar.md) ⚠️ **MISSING**                 | Calendars, events, views — not yet written            |
| [Tasks](04-FEATURES/Core/08-tasks.md) ⚠️ **MISSING**                       | Priorities, recurrence, linked work — not yet written |
| [Automation](04-FEATURES/Core/05-automation.md)                            | Trigger/action rules                                  |
| [Account Cleaning](04-FEATURES/Core/06-account-cleaning.md) ⚠️ **MISSING** | Retention and cleanup workflows — not yet written     |
| [Dashboard](04-FEATURES/Core/09-dashboard.md) ⚠️ **MISSING**               | Cross-feature overview widgets — not yet written      |

### Messaging Layer

| Doc                                                | Covers                            |
| -------------------------------------------------- | --------------------------------- |
| [Composer](04-FEATURES/34-mail-composer.md)        | Drafting, send, schedule, aliases |
| [Templates](04-FEATURES/24-templates.md)           | Reusable template content         |
| [Quick Replies](04-FEATURES/29-quick-replies.md)   | Fast reply snippets               |
| [Filters](04-FEATURES/28-filters.md)               | Rule-based filtering and testing  |
| [Deliverability](04-FEATURES/21-deliverability.md) | DNS, blacklist, bounce health     |

### Security And Data

| Doc                                               | Covers                              |
| ------------------------------------------------- | ----------------------------------- |
| [PGP](04-FEATURES/26-pgp-encryption.md)           | OpenPGP keys and encrypted messages |
| [Vault](04-FEATURES/25-attachment-vault.md)       | Attachment and file workflows       |
| [Compliance](04-FEATURES/23-compliance-engine.md) | Policy-aware sending checks         |

### Intelligence And UX

| Doc                                                            | Covers                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| [AI](04-FEATURES/22-ai-integration.md)                         | Providers and AI-powered helpers                          |
| [AI RAG — Overview](04-FEATURES/ai-rag.md)                     | Local semantic search & RAG architecture                  |
| [AI RAG — Backend](02-BACKEND/ai-rag.md)                       | Rust: candle, LanceDB, parser, indexer                    |
| [AI RAG — Frontend](03-FRONTEND/ai-rag.md)                     | TS wrappers, store, components, routing                   |
| [Prompt Engineering](03-FRONTEND/ai-prompt-engineering.md)     | All AI prompts — email, inbox, CRM, RAG, task extraction  |
| [Context Engineering](03-FRONTEND/ai-context-engineering.md)   | Context construction — data sourcing, truncation, quality |
| [Contact Intelligence](04-FEATURES/30-contact-intelligence.md) | Scoring and insight layer for contacts                    |
| [Shortcuts](04-FEATURES/31-keyboard-shortcuts.md)              | Keyboard workflow                                         |
| [i18n](04-FEATURES/32-i18n-localization.md)                    | Locales and RTL                                           |

### Device And Mobile

| Doc                                                       | Covers                                        |
| --------------------------------------------------------- | --------------------------------------------- |
| [Pairing](04-FEATURES/33-device-pairing.md)               | Device pairing flow                           |
| [Mobile Native](04-FEATURES/35-mobile-native-features.md) | Native bridge and mobile-only surface         |
| [Workflows](04-FEATURES/27-workflow-engine.md)            | Legacy note; current rules live in Automation |

### Invoicing & ERP

| Doc                                                             | Covers                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| [Invoicing](04-FEATURES/36-invoicing.md)                        | Calc engine, 35 IPC commands, PDF/PEPPOL, SMTP             |
| [Company & ERP](04-FEATURES/Invoicing-ERP/01-company-tenant.md) | Tenant model, company switcher, where `company_id` is used |

### Feature Specs & Plans

| Doc                                                                                 | Covers                                                                                               |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [Onboarding Reboot](04-FEATURES/36-onboarding-reboot-plan.md) ⚠️ **MISSING**        | Full-screen setup wizard replacing modal tour — spec not written yet (see gaps)                      |
| [Settings Redesign](04-FEATURES/37-settings-redesign-spec.md) ✅ written 2026-07-15 | Settings IA regroup (9 groups), Appearance promotion, navConfig drift fix, global/per-account matrix |
| [Navigation & IA Spec](03-FRONTEND/14-navigation-ia-spec.md) ✅ written 2026-07-15  | Email-first rail order, orphaned Tasks/Calendar/Campaigns fix, Customer-360 cross-wiring             |

## Superpowers

Deep-dive guides for complex subsystems.

| Doc                                                                                                 | Covers                                           |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [Composer Architecture](superpowers/composer-architecture.md)                                       | Full-stack composer: Rust plugin → React UI → AI |
| [Ops Commands Tables Refactor](superpowers/specs/2026-07-09-ops-commands-tables-refactor-design.md) | Design spec for ops command/table refactor       |
| [AI RAG LM Studio](superpowers/specs/2026-07-12-ai-rag-lmstudio-design.md)                          | Design spec for LM Studio RAG integration        |
| [AI Settings Refactor](superpowers/specs/2026-07-13-ai-settings-refactor-design.md)                 | Design spec for AI settings refactor             |

## Development

For contributors and AI agents.

| Doc                                                          | Covers                              |
| ------------------------------------------------------------ | ----------------------------------- |
| [Quickstart](05-DEVELOPMENT/01-quickstart.md)                | Setup, commands, Mailtrap           |
| [Testing](05-DEVELOPMENT/02-testing.md)                      | Vitest patterns, Rust tests         |
| [Reuse Patterns](05-DEVELOPMENT/05-reuse-patterns.md)        | Component/hook/service reuse        |
| [Release Pipeline](05-DEVELOPMENT/06-release-pipeline.md)    | Daily PR → Release Please → Build   |
| [Manual Tests](05-DEVELOPMENT/03-manual-tests.md)            | Panic, WAL, watchdog, dev verify    |
| [WAL Deletion](05-DEVELOPMENT/04-wal-deletion.md)            | WAL file handling and safe deletion |
| [Mobile Dev](05-DEVELOPMENT/07-mobile-development.md)        | Logcat, WebView, Kotlin             |
| [Design System Guide](05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md) | Tokens, components, patterns        |

## Roadmap

| Doc                                                                                   | Covers                                               |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [STATUS.md](STATUS.md)                                                                | What's shipped, what's next                          |
| [Master Plan — v1.0](06-ROADMAP/09-master-plan.md)                                    | Single canonical roadmap — all remaining work merged |
| [Monetization — Entitlement Engine](06-ROADMAP/10-monetization-entitlement-engine.md) | Entitlement/license engine design                    |
| [Monetization — Frontend Paywall](06-ROADMAP/11-monetization-frontend-paywall.md)     | Frontend paywall UI design                           |
| [Monetization — Asset Delivery](06-ROADMAP/12-monetization-asset-delivery.md)         | Asset delivery design                                |
| [Monetization — Mobile Strategy](06-ROADMAP/13-monetization-mobile-strategy.md)       | Mobile monetization strategy                         |
| [Simplified Core Spec](06-ROADMAP/smeMaster_Simplified_Core_Spec.md)                  | Simplified core product spec                         |
| [Monetization Style](monetization-style.md)                                           | Monetization visual/voice style guide                |
| [Navigation Redesign Recommendation](navigation-redesign/IA-RECOMMENDATION.md)        | IA recommendation for navigation redesign            |
| [Plans — Deals Pipeline & Lead Scoring](plans/DEALS-PIPELINE-LEAD-SCORING-PLAN.md)    | Plan for deals pipeline + lead scoring               |
| [Plans — Design UI/UX Spec](plans/DESIGN_UI_UX_SPEC.md)                               | Design UI/UX specification                           |
| [Plans — MVP Launch](plans/MVP_LAUNCH_PLAN.md)                                        | MVP launch plan                                      |
| [Plans — Production Hardening](plans/PRODUCTION_HARDENING_PLAN.md)                    | Production hardening plan                            |
| [Plans — Settings IA Proposal](plans/SETTINGS-IA-PROPOSAL.md)                         | Settings IA proposal                                 |
| [Analysis](analysis.md)                                                               | Misc analysis notes                                  |

## Production Readiness

For shipping v1.0.0.

| Doc                                                | Covers                                                      |
| -------------------------------------------------- | ----------------------------------------------------------- |
| [PRODUCTION-READINESS.md](PRODUCTION-READINESS.md) | Single source of truth for all 9 production gates           |
| [Privacy Policy](privacy-policy.md)                | Legal — all data is local, no telemetry                     |
| [Beta Test Plan](beta-testing/plan.md)             | Recruitment, schedule, exit criteria (NPS, install success) |
| [Beta Test Scenarios](beta-testing/scenarios.md)   | 8 test scenarios for beta testers                           |
| [Beta Test Feedback](beta-testing/feedback.md)     | Feedback form template                                      |
| [Dogfooding Log](dogfooding/log.md)                | 7-day log template                                          |
| [Dogfooding Checklist](dogfooding/checklist.md)    | Daily task checklist                                        |
| [Pre-Release Checklist](release/checklist.md)      | 10-section pre-release verification                         |
| [Code Signing Guide](release/signing.md)           | macOS/Windows/Linux signing                                 |
| [Release Automation](release/automation.md)        | Script-based release process documentation                  |

## User Documentation

End-user guides.

| Doc                                              | Covers                                      |
| ------------------------------------------------ | ------------------------------------------- |
| [Getting Started](user-guide/getting-started.md) | Install + first email in 5 minutes          |
| [Account Setup](user-guide/account-setup.md)     | Gmail, Outlook, manual IMAP/SMTP            |
| [PGP Setup](user-guide/pgp-setup.md)             | Generate, import, export, encrypt           |
| [Backup & Restore](user-guide/backup-restore.md) | Auto + manual backup, integrity check       |
| [Wallet](user-guide/wallet.md)                   | Local wallet / credential storage guide     |
| [FAQ](user-guide/faq.md)                         | Common issues and solutions                 |
| [Release Notes](user-guide/release-notes.md)     | v1.0.0 changelog                            |
| [Automation (User)](user-guide/automation.md)    | Create rules, visual builder, AI generation |
| [Company & ERP (User)](user-guide/company.md)    | Switch companies, ERP overview              |
