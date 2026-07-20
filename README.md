<div align="center">

# SMEMaster

### A local-first business workspace for email, CRM, campaigns, calendar, tasks, and automation

**Built for people who are tired of renting their business data back from the cloud.**

[![CI](https://github.com/Zakarialabib/smeMaster/actions/workflows/ci.yml/badge.svg)](https://github.com/Zakarialabib/smeMaster/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Zakarialabib/smeMaster?style=flat-square)](https://github.com/Zakarialabib/smeMaster/releases)
[![Version](https://img.shields.io/github/v/release/Zakarialabib/smeMaster?display_name=tag&style=flat-square)](https://github.com/Zakarialabib/smeMaster/releases/latest)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square)](LICENSE)

</div>

---

> **One-liner:** A desktop-first, local-first workspace for small and medium businesses â€” email, contacts, campaigns, tasks, calendar, automation, and security in one app, on your machine, under your control.
>
> **Why this exists:** Small business owners shouldn't have to duct-tape six SaaS tools together to handle one customer conversation. Your machine, your business.

---

## What it does

|     | Feature            | What it actually does                                                                    |
| --- | ------------------ | ---------------------------------------------------------------------------------------- |
| ðŸ“§  | **Email**          | Multi-account inbox, Gmail API + IMAP/SMTP, labels, search, drafts, offline-safe actions |
| ðŸ‘¥  | **CRM**            | Contacts, groups, tags, dynamic segments, activity context, scoring                      |
| ðŸ“£  | **Campaigns**      | Campaign builder, mail merge, A/B, analytics, outreach workflows                         |
| ðŸ“…  | **Calendar**       | Calendar views and sync-oriented event management                                        |
| âœ…  | **Tasks**          | Priorities, due dates, recurrence, multiple views, linked workflow support               |
| âš™ï¸  | **Automation**     | Trigger/action rules and automation builder flows                                        |
| âœï¸  | **Composer**       | Signatures, attachments, aliases, undo-send, scheduled send                              |
| ðŸ”  | **PGP**            | Sequoia OpenPGP integration for encrypted messages                                       |
| ðŸ—„ï¸  | **Vault**          | Attachment vault and file workflows                                                      |
| ðŸ“¡  | **Deliverability** | DNS, blacklist, bounce, and sender-health tooling                                        |
| ðŸ¤–  | **AI**             | Provider-based assistants for categorization, writing, summaries, inbox queries          |
| ðŸŒ  | **i18n**           | English, French, Arabic, Japanese, Italian â€” including RTL for Arabic                    |

<details>
<summary>Platforms & availability</summary>

| State                 | Platforms                                                            |
| --------------------- | -------------------------------------------------------------------- |
| âœ… **Available now**  | Windows 10/11 (MSI, NSIS) Â· Android (APK, sideload)                  |
| ðŸ—ºï¸ **On the roadmap** | Store releases (signed), broader multi-device sync, plugin ecosystem |

</details>

---

## Download

| Platform       | Package        | Link                                                                                                                                     |
| -------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| ðŸªŸ **Windows** | MSI Installer  | [SMEMaster-1.0.0-rc.1.msi](https://github.com/Zakarialabib/smeMaster/releases/download/v1.0.0-rc.1/SMEMaster-1.0.0-rc.1.msi)             |
| ðŸªŸ **Windows** | NSIS Installer | [SMEMaster-1.0.0-rc.1-setup.exe](https://github.com/Zakarialabib/smeMaster/releases/download/v1.0.0-rc.1/SMEMaster-1.0.0-rc.1-setup.exe) |
| ðŸ¤– **Android** | APK (sideload) | [SMEMaster-1.0.0-rc.1.apk](https://github.com/Zakarialabib/smeMaster/releases/download/v1.0.0-rc.1/SMEMaster-1.0.0-rc.1.apk)             |
| ðŸ§ **Linux**   | AppImage       | Coming soon                                                                                                                              |
| ðŸŽ **macOS**   | DMG            | Coming soon (requires notarization)                                                                                                      |

> All releases on [GitHub Releases](https://github.com/Zakarialabib/smeMaster/releases).

---

## Coming soon & future development

The canonical roadmap lives in [`docs/06-ROADMAP/09-master-plan.md`](docs/06-ROADMAP/09-master-plan.md). Highlights:

- ðŸ”Œ **Plugin architecture** â€” open, but not yet finalized
- ðŸ”„ **Broader multi-device sync** â€” beyond the current local-first model
- ðŸ“± **Android app** â€” APK available now (sideload); store release pending
- ðŸ” **Code signing + auto-updater** â€” certificates and publisher pubkey
- ðŸ›¡ï¸ **Final production hardening** â€” stability, release validation, dogfooding + beta
- ðŸ’³ **Monetization & entitlements** â€” explicitly **deferred to post-v1.0** (not implemented)

---

## Status

> **Last updated:** 2026-07-13 â€” [v1.0.0-rc.1 released](https://github.com/Zakarialabib/smeMaster/releases/tag/v1.0.0-rc.1). Everything compiles and all tests pass.

**Recently shipped**

- ðŸŽ¨ **Settings UI overhaul** â€” all 24 settings tabs beautified with premium card layout, stats rows, step-by-step setup wizards (Composing, Templates, Developer, About, General, FeatureFlags, AccountCleaning, Hardware, License, DevicePairing)
- ðŸŒ **RTL + i18n cleanup** â€” 164 physical-direction CSS violations fixed across 48 files; 1,685 `[TODO]` translation prefixes cleared in fr/ar/ja/it locales
- ðŸš€ **Onboarding rework** â€” standalone page after splash; auto-skips if email accounts or demo data already exist; root redirect changed to `/dashboard`
- ðŸ¤– **AI RAG UI** â€” local semantic search & RAG feature complete; docs reorganized into [`docs/04-FEATURES/ai-rag.md`](docs/04-FEATURES/ai-rag.md)
- ðŸ·ï¸ **`account_id` â†’ `company_id` rename** â€” 30+ files across the full stack, zero TS/Rust errors
- ðŸ“± **Mobile UX Overhaul** â€” all 5 phases 100% implemented
- ðŸ—ï¸ **Data layer evolution** â€” dead-code eliminated, offline-availability + optimistic email actions
- ðŸŸ¢ **Shared component library** â€” 6 reusable UI primitives (ErrorBoundary, ConfirmationDialog, FeedbackContainer, FormWrapper, LoadingSpinner, EventHandlerWrapper) + 5 stability hooks/utils (useAsyncData, useAsyncError, useLoading, usePersistentState, retryLogic)
- ðŸŸ¢ **Typed UI event bus (uiBus)** â€” replaced stringly-typed window.dispatchEvent("smemaster-*") anti-pattern with a fully-typed emitter; all cross-component UI signals now route through uiBus
- ðŸŸ¢ **AI sidecar test coverage** â€” comprehensive aiSidecar.test.ts (lazy-load, activation, download/load flow, error handling, idempotency)

**In progress**

- Manual stability tests (panic injection, WAL recovery, watchdog restart)
- Code signing certificates + auto-updater pubkey
- 7-day dogfooding + public beta run
- Plugin architecture & store releases

Full picture â†’ [`docs/STATUS.md`](docs/STATUS.md).

---

## Project structure

```text
smeMaster/
â”œâ”€â”€ docs/                 # Architecture, features, roadmap, release, user guides
â”‚   â”œâ”€â”€ 00-INDEX.md       # Docs hub (start here)
â”‚   â”œâ”€â”€ 01-ARCHITECTURE/  # System & data-model design
â”‚   â”œâ”€â”€ 02-BACKEND/       # Rust & Tauri internals
â”‚   â”œâ”€â”€ 03-FRONTEND/      # React/TS patterns & guides
â”‚   â”œâ”€â”€ 04-FEATURES/      # Per-feature specs
â”‚   â”œâ”€â”€ 05-DEVELOPMENT/   # Contributor setup
â”‚   â”œâ”€â”€ 06-ROADMAP/       # Master plan
â”‚   â””â”€â”€ user-guide/       # End-user docs
â”œâ”€â”€ src/                  # React 19 + TypeScript frontend
â”œâ”€â”€ src-tauri/            # Rust + Tauri backend/runtime
â”œâ”€â”€ scripts/              # Release & maintenance scripts
â”œâ”€â”€ package.json
â””â”€â”€ README.md
```

**Tech stack:** `React 19 + TypeScript` (UI) Â· `Rust + Tauri v2` (native runtime) Â· `SQLite + WAL` (persistence) Â· `Zustand` (state) Â· typed IPC contracts Â· event-driven cache.

---

## Quick start for developers

### Requirements

- [Node.js](https://nodejs.org/) `v20+`
- [Rust](https://www.rust-lang.org/tools/install) `1.77.2+`
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

> **Windows note:** make sure `C:\msys64\ucrt64\bin` is on your `PATH`.

### Run locally

```bash
git clone https://github.com/Zakarialabib/smeMaster.git
cd smeMaster
npm install
npm run tauri dev
```

### Useful commands

| Command               | Purpose                        |
| --------------------- | ------------------------------ |
| `npm run dev`         | Start the Vite frontend only   |
| `npm run test`        | Run frontend tests             |
| `npx tsc --noEmit`    | TypeScript typecheck           |
| `npm run tauri build` | Build the desktop app          |
| `npm run android`     | Start Android development flow |

---

## Documentation hub

Start at [`docs/00-INDEX.md`](docs/00-INDEX.md). Key entry points:

| Area             | Start here                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | [Overview](docs/01-ARCHITECTURE/01-overview.md) Â· [Backend structure](docs/01-ARCHITECTURE/02-backend-structure.md) Â· [Data model](docs/01-ARCHITECTURE/03-data-model.md) Â· [Mobile](docs/01-ARCHITECTURE/05-mobile-architecture.md)                          |
| **Backend**      | [IMAP engine](docs/02-BACKEND/01-imap-engine.md) Â· [SMTP](docs/02-BACKEND/02-smtp-client.md) Â· [PGP](docs/02-BACKEND/03-pgp-crypto.md) Â· [OAuth](docs/02-BACKEND/04-oauth-flow.md) Â· [Key management](docs/02-BACKEND/07-key-management.md)                   |
| **Frontend**     | [State](docs/03-FRONTEND/02-state-management.md) Â· [Service layer](docs/03-FRONTEND/03-service-layer.md) Â· [Reuse patterns](docs/03-FRONTEND/05-reuse-patterns.md) Â· [RTL audit](docs/03-FRONTEND/10-rtl-audit.md)                                            |
| **Features**     | [Email](docs/04-FEATURES/Core/01-email-management.md) Â· [CRM](docs/04-FEATURES/Core/03-crm-contacts.md) Â· [Campaigns](docs/04-FEATURES/Core/02-campaigns-mail-merge.md) Â· [AI RAG](docs/04-FEATURES/ai-rag.md) Â· [PGP](docs/04-FEATURES/26-pgp-encryption.md) |
| **Development**  | [Quickstart](docs/05-DEVELOPMENT/01-quickstart.md) Â· [Testing](docs/05-DEVELOPMENT/02-testing.md) Â· [Design system](docs/05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md)                                                                                               |
| **Roadmap**      | [Status](docs/STATUS.md) Â· [Master plan](docs/06-ROADMAP/09-master-plan.md)                                                                                                                                                                                   |
| **User guide**   | [Getting started](docs/user-guide/getting-started.md) Â· [Account setup](docs/user-guide/account-setup.md) Â· [PGP setup](docs/user-guide/pgp-setup.md) Â· [Backup & restore](docs/user-guide/backup-restore.md)                                                 |

---

## Contributing

Contributions are welcome:

1. Report bugs through [Issues](https://github.com/Zakarialabib/smeMaster/issues)
2. Propose ideas in [Discussions](https://github.com/Zakarialabib/smeMaster/discussions)
3. Open PRs with tests where appropriate
4. Improve docs when you spot drift or ambiguity

Preferred conventions: [Conventional Commits](https://www.conventionalcommits.org/), TypeScript strict mode, targeted tests for meaningful behavior changes.

---

## License & Privacy

[Apache 2.0](LICENSE) Â· [Privacy Policy](docs/privacy-policy.md)

---

<div align="center">

**SMEMaster â€” From lead to loyalty, all in one place.**

[Star](https://github.com/Zakarialabib/smeMaster) Â· [Bug](https://github.com/Zakarialabib/smeMaster/issues) Â· [Discuss](https://github.com/Zakarialabib/smeMaster/discussions)

</div>
