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

> **One-liner:** A desktop-first, local-first workspace for small and medium businesses — email, contacts, campaigns, tasks, calendar, automation, and security in one app, on your machine, under your control.
>
> **Why this exists:** Small business owners shouldn't have to duct-tape six SaaS tools together to handle one customer conversation. Your machine, your business.

---

## What it does

|     | Feature            | What it actually does                                                                    |
| --- | ------------------ | ---------------------------------------------------------------------------------------- |
| 📧  | **Email**          | Multi-account inbox, Gmail API + IMAP/SMTP, labels, search, drafts, offline-safe actions |
| 👥  | **CRM**            | Contacts, groups, tags, dynamic segments, activity context, scoring                      |
| 📣  | **Campaigns**      | Campaign builder, mail merge, A/B, analytics, outreach workflows                         |
| 📅  | **Calendar**       | Calendar views and sync-oriented event management                                        |
| ✅  | **Tasks**          | Priorities, due dates, recurrence, multiple views, linked workflow support               |
| ⚙️  | **Automation**     | Trigger/action rules and automation builder flows                                        |
| ✍️  | **Composer**       | Signatures, attachments, aliases, undo-send, scheduled send                              |
| 🔐  | **PGP**            | Sequoia OpenPGP integration for encrypted messages                                       |
| 🗄️  | **Vault**          | Attachment vault and file workflows                                                      |
| 📡  | **Deliverability** | DNS, blacklist, bounce, and sender-health tooling                                        |
| 🤖  | **AI**             | Provider-based assistants for categorization, writing, summaries, inbox queries          |
| 🌍  | **i18n**           | English, French, Arabic, Japanese, Italian — including RTL for Arabic                    |

<details>
<summary>Platforms & availability</summary>

| State                 | Platforms                                                            |
| --------------------- | -------------------------------------------------------------------- |
| ✅ **Available now**  | Windows 10/11 (MSI, NSIS) · Android (APK, sideload)                  |
| 🗺️ **On the roadmap** | Store releases (signed), broader multi-device sync, plugin ecosystem |

</details>

---

## Download

| Platform       | Package        | Link                                                                                                                                     |
| -------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 🪟 **Windows** | MSI Installer  | [SMEMaster-1.0.0-rc.1.msi](https://github.com/Zakarialabib/smeMaster/releases/download/v1.0.0-rc.1/SMEMaster-1.0.0-rc.1.msi)             |
| 🪟 **Windows** | NSIS Installer | [SMEMaster-1.0.0-rc.1-setup.exe](https://github.com/Zakarialabib/smeMaster/releases/download/v1.0.0-rc.1/SMEMaster-1.0.0-rc.1-setup.exe) |
| 🤖 **Android** | APK (sideload) | [SMEMaster-1.0.0-rc.1.apk](https://github.com/Zakarialabib/smeMaster/releases/download/v1.0.0-rc.1/SMEMaster-1.0.0-rc.1.apk)             |
| 🐧 **Linux**   | AppImage       | Coming soon                                                                                                                              |
| 🍎 **macOS**   | DMG            | Coming soon (requires notarization)                                                                                                      |

> All releases on [GitHub Releases](https://github.com/Zakarialabib/smeMaster/releases).

---

## Coming soon & future development

The canonical roadmap lives in [`docs/06-ROADMAP/09-master-plan.md`](docs/06-ROADMAP/09-master-plan.md). Highlights:

- 🔌 **Plugin architecture** — open, but not yet finalized
- 🔄 **Broader multi-device sync** — beyond the current local-first model
- 📱 **Android app** — APK available now (sideload); store release pending
- 🔏 **Code signing + auto-updater** — certificates and publisher pubkey
- 🛡️ **Final production hardening** — stability, release validation, dogfooding + beta
- 💳 **Monetization & entitlements** — explicitly **deferred to post-v1.0** (not implemented)

---

## Status

> **Last updated:** 2026-07-13 — [v1.0.0-rc.1 released](https://github.com/Zakarialabib/smeMaster/releases/tag/v1.0.0-rc.1). Everything compiles and all tests pass.

**Recently shipped**

- 🎨 **Settings UI overhaul** — all 24 settings tabs beautified with premium card layout, stats rows, step-by-step setup wizards (Composing, Templates, Developer, About, General, FeatureFlags, AccountCleaning, Hardware, License, DevicePairing)
- 🌐 **RTL + i18n cleanup** — 164 physical-direction CSS violations fixed across 48 files; 1,685 `[TODO]` translation prefixes cleared in fr/ar/ja/it locales
- 🚀 **Onboarding rework** — standalone page after splash; auto-skips if email accounts or demo data already exist; root redirect changed to `/dashboard`
- 🤖 **AI RAG UI** — local semantic search & RAG feature complete; docs reorganized into [`docs/04-FEATURES/ai-rag.md`](docs/04-FEATURES/ai-rag.md)
- 🏷️ **`account_id` → `company_id` rename** — 30+ files across the full stack, zero TS/Rust errors
- 📱 **Mobile UX Overhaul** — all 5 phases 100% implemented
- 🏗️ **Data layer evolution** — dead-code eliminated, offline-availability + optimistic email actions

**In progress**

- Manual stability tests (panic injection, WAL recovery, watchdog restart)
- Code signing certificates + auto-updater pubkey
- 7-day dogfooding + public beta run
- Plugin architecture & store releases

Full picture → [`docs/STATUS.md`](docs/STATUS.md).

---

## Project structure

```text
smeMaster/
├── docs/                 # Architecture, features, roadmap, release, user guides
│   ├── 00-INDEX.md       # Docs hub (start here)
│   ├── 01-ARCHITECTURE/  # System & data-model design
│   ├── 02-BACKEND/       # Rust & Tauri internals
│   ├── 03-FRONTEND/      # React/TS patterns & guides
│   ├── 04-FEATURES/      # Per-feature specs
│   ├── 05-DEVELOPMENT/   # Contributor setup
│   ├── 06-ROADMAP/       # Master plan
│   └── user-guide/       # End-user docs
├── src/                  # React 19 + TypeScript frontend
├── src-tauri/            # Rust + Tauri backend/runtime
├── scripts/              # Release & maintenance scripts
├── package.json
└── README.md
```

**Tech stack:** `React 19 + TypeScript` (UI) · `Rust + Tauri v2` (native runtime) · `SQLite + WAL` (persistence) · `Zustand` (state) · typed IPC contracts · event-driven cache.

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
| **Architecture** | [Overview](docs/01-ARCHITECTURE/01-overview.md) · [Backend structure](docs/01-ARCHITECTURE/02-backend-structure.md) · [Data model](docs/01-ARCHITECTURE/03-data-model.md) · [Mobile](docs/01-ARCHITECTURE/05-mobile-architecture.md)                          |
| **Backend**      | [IMAP engine](docs/02-BACKEND/01-imap-engine.md) · [SMTP](docs/02-BACKEND/02-smtp-client.md) · [PGP](docs/02-BACKEND/03-pgp-crypto.md) · [OAuth](docs/02-BACKEND/04-oauth-flow.md) · [Key management](docs/02-BACKEND/07-key-management.md)                   |
| **Frontend**     | [State](docs/03-FRONTEND/02-state-management.md) · [Service layer](docs/03-FRONTEND/03-service-layer.md) · [Reuse patterns](docs/03-FRONTEND/05-reuse-patterns.md) · [RTL audit](docs/03-FRONTEND/10-rtl-audit.md)                                            |
| **Features**     | [Email](docs/04-FEATURES/Core/01-email-management.md) · [CRM](docs/04-FEATURES/Core/03-crm-contacts.md) · [Campaigns](docs/04-FEATURES/Core/02-campaigns-mail-merge.md) · [AI RAG](docs/04-FEATURES/ai-rag.md) · [PGP](docs/04-FEATURES/26-pgp-encryption.md) |
| **Development**  | [Quickstart](docs/05-DEVELOPMENT/01-quickstart.md) · [Testing](docs/05-DEVELOPMENT/02-testing.md) · [Design system](docs/05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md)                                                                                               |
| **Roadmap**      | [Status](docs/STATUS.md) · [Master plan](docs/06-ROADMAP/09-master-plan.md)                                                                                                                                                                                   |
| **User guide**   | [Getting started](docs/user-guide/getting-started.md) · [Account setup](docs/user-guide/account-setup.md) · [PGP setup](docs/user-guide/pgp-setup.md) · [Backup & restore](docs/user-guide/backup-restore.md)                                                 |

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

[Apache 2.0](LICENSE) · [Privacy Policy](docs/privacy-policy.md)

---

<div align="center">

**SMEMaster — From lead to loyalty, all in one place.**

[Star](https://github.com/Zakarialabib/smeMaster) · [Bug](https://github.com/Zakarialabib/smeMaster/issues) · [Discuss](https://github.com/Zakarialabib/smeMaster/discussions)

</div>
