<div align="center">

# SMEMaster

### The local-first business workspace for email, CRM, campaigns, calendar, tasks & automation

**Built for people who are tired of renting their business data back from the cloud.**

[![CI](https://github.com/Zakarialabib/smeMaster/actions/workflows/ci.yml/badge.svg)](https://github.com/Zakarialabib/smeMaster/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-00--INDEX-blue?style=flat-square)](docs/00-INDEX.md)

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
| 📡  | **Deliverability** | DNS, blacklist, bounce, and sender-health tooling                                            |
| 🤖  | **AI**             | Provider-based assistants for categorization, writing, summaries, inbox queries          |
| 🎙️  | **Offline speech** | On-device STT + TTS via sherpa-onnx — no API key, no network, audio never leaves the machine |
| 🌍  | **i18n**           | English, French, Arabic, Japanese, Italian — including RTL for Arabic                    |

---

## Platforms & availability

SMEMaster targets desktop (Windows · Linux · macOS) and Android, built with Tauri v2 + React 19 + Rust.

| State                        | Platforms                                                          |
| ---------------------------- | ------------------------------------------------------------------ |
| 🚧 **In active development** | Windows, Linux, macOS (desktop) · Android (mobile)                 |
| 📦 **Buildable from source** | Windows installer (NSIS) · Linux · macOS · Android APK/AAB         |
| 🗺️ **On the roadmap**        | Signed store releases, broader multi-device sync, plugin ecosystem |

> Builds are produced from source today; signed public installers are part of the v1.0 hardening pass (code signing certificates are the remaining blocker). Watch [GitHub Releases](https://github.com/Zakarialabib/smeMaster/releases).

---

## Status

> **Stage:** v1.0.0-rc — feature-complete and compiling, pre-release hardening in progress.

**Recently shipped**

- 🎙️ **Offline speech (STT + TTS)** — on-device via sherpa-onnx; STT RTF **0.033** at **99.8%** match, TTS RTF **0.573**, both verified end-to-end against the shipped binary
- ⚙️ **AI settings reorganized** — Text Generation / Voice / Local Models, with a model catalog and resumable downloads
- 🔌 **Sidecar lifecycle control** — Start/Stop/Refresh in Settings → Voice, with honest engine-state reporting
- 🐛 **Startup panic fixed** — `EventBus` was read before it was managed, so the app could not start at all
- 🐛 **Sidecar Stop fixed** — the watchdog restarted the process ~2 s after Stop, so the UI said "stopped" while it kept running
- 🏗️ **Reproducible sidecar build** — `scripts/build-sidecar.sh` wired into every build; CI no longer ships a speech-less sidecar
- 🧰 **Tauri MCP bridge** — dev-only; lets an agent drive the running app (this is what found the two bugs above)
- 🎨 **Settings UI overhaul** — all 24 settings tabs beautified with premium card layout, stats rows, step-by-step setup wizards
- 🌐 **RTL + i18n cleanup** — 164 physical-direction CSS violations fixed across 48 files; 1,685 `[TODO]` translation prefixes cleared in fr/ar/ja/it locales
- 🚀 **Onboarding rework** — standalone page after splash; auto-skips if email accounts or demo data already exist
- 🤖 **AI RAG UI** — local semantic search & RAG feature complete
- 🏷️ **`account_id` → `company_id` rename** — 30+ files across the full stack, zero TS/Rust errors
- 📱 **Mobile UX Overhaul** — all 5 phases 100% implemented
- 🏗️ **Data layer evolution** — dead-code eliminated, offline-availability + optimistic email actions
- 🟢 **Shared component library** — 6 reusable UI primitives + 5 stability hooks/utils
- 🟢 **Typed UI event bus (`uiBus`)** — replaced stringly-typed `window.dispatchEvent("smemaster-*")` with a fully-typed emitter

**In progress**

- Manual stability tests (panic injection, WAL recovery, watchdog restart)
- Code signing certificates + auto-updater pubkey
- 7-day dogfooding + public beta run
- Plugin architecture & store releases

**Not yet verified** — stated plainly rather than implied by a green check:

- **TTS intelligibility** — machine-checked as non-silent audio of the correct rate/duration; whether it *sounds* right is a human judgement
- **Non-English STT** — only English (Zipformer Small) is measured; other locales are model availability, not quality
- **Live-call TTS** — RTF 0.573 + STT 0.033 approaches real time; marginal for a live call

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
└── package.json
```

**Tech stack:** `React 19 + TypeScript 7` (UI) · `Rust + Tauri v2` (native runtime) · `SQLite + WAL` (persistence) · `Zustand` (state) · `sherpa-onnx` (on-device speech) · typed IPC contracts · event-driven cache · built with `bun` and Vite 8 (Rolldown).

---

## Quick start for developers

### Requirements

- [Bun](https://bun.sh/) `1.4.2+` — the package manager and script runner (lockfile is `bun.lock`; there is no `package-lock.json`)
- [Rust](https://www.rust-lang.org/tools/install) `1.77.2+`
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

> **Windows note:** make sure `C:\msys64\ucrt64\bin` is on your `PATH`.
>
> ⚠️ **Building with offline speech needs ~10 GB free.** The sidecar links onnxruntime and lancedb; a full build plus the Tauri app can exceed 20 GB of `target/`.

### Run locally

```bash
git clone https://github.com/Zakarialabib/smeMaster.git
cd smeMaster
bun install
bun run tauri:dev
```

### Useful commands

| Command                       | Purpose                                              |
| ----------------------------- | ---------------------------------------------------- |
| `bun run dev`                 | Start the Vite frontend only                         |
| `bun run test`                | Unit tests (`vitest --project unit`, jsdom)          |
| `bun run typecheck`           | TypeScript 7 typecheck (`tsc --noEmit`)              |
| `bun run lint`                | ESLint, zero warnings tolerated                      |
| `bun run tauri:build`         | Build the desktop app (builds the sidecar first)     |
| `bun run windows:build`       | Windows NSIS installer                               |
| `bun run android`             | Android development flow                             |
| `bun run sidecar:build`       | Build `ml-sidecar` with offline speech               |
| `bun run tauri:dev:mcp`       | Dev build with the Tauri MCP bridge (port 9223)      |

> **`bun`, not `npm`.** `npm install` will not honour `bun.lock`. If you need a one-off binary, use `bunx` instead of `npx`.

### Offline speech (STT / TTS)

The speech engine is an optional `offline-speech` feature of the `ml-sidecar` crate,
built and installed by `scripts/build-sidecar.sh`:

```bash
bun run sidecar:build:release     # → src-tauri/binaries/ml-sidecar-<triple>.exe
```

`tauri:build`, `windows:build` and `windows:portable` all run this first, so the
bundled app can't ship without it.

⚠️ Use `--release`. A **debug** build of this crate fails to link with
`LNK1318: Unexpected PDB error` — a PDB/filesystem limit on a ~234-object link,
not a code error.

⚠️ Without `offline-speech` the sidecar compiles and runs but answers
`unknown method` to every speech call, which looks like a broken feature rather
than a wrong binary. See [`docs/02-BACKEND/20-offline-stt-and-audio-summarization.md`](docs/02-BACKEND/20-offline-stt-and-audio-summarization.md).

---

## Documentation

Start at [`docs/00-INDEX.md`](docs/00-INDEX.md). Key entry points:

| Area             | Start here                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | [Overview](docs/01-ARCHITECTURE/01-overview.md) · [Backend structure](docs/01-ARCHITECTURE/02-backend-structure.md) · [Data model](docs/01-ARCHITECTURE/03-data-model.md)                                                                                     |
| **Backend**      | [IMAP engine](docs/02-BACKEND/01-imap-engine.md) · [SMTP](docs/02-BACKEND/02-smtp-client.md) · [PGP](docs/02-BACKEND/03-pgp-crypto.md) · [OAuth](docs/02-BACKEND/04-oauth-flow.md) · [Key management](docs/02-BACKEND/07-key-management.md)                   |
| **Frontend**     | [State](docs/03-FRONTEND/02-state-management.md) · [Service layer](docs/03-FRONTEND/03-service-layer.md) · [Reuse patterns](docs/03-FRONTEND/05-reuse-patterns.md) · [Shared components](docs/03-FRONTEND/15-shared-components.md)                            |
| **Features**     | [Email](docs/04-FEATURES/Core/01-email-management.md) · [CRM](docs/04-FEATURES/Core/03-crm-contacts.md) · [Campaigns](docs/04-FEATURES/Core/02-campaigns-mail-merge.md) · [AI RAG](docs/04-FEATURES/ai-rag.md) · [PGP](docs/04-FEATURES/26-pgp-encryption.md) |
| **Development**  | [Quickstart](docs/05-DEVELOPMENT/01-quickstart.md) · [Testing](docs/05-DEVELOPMENT/02-testing.md) · [Design system](docs/05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md)                                                                                               |
| **Roadmap**      | [Status](docs/STATUS.md) · [Master plan](docs/06-ROADMAP/09-master-plan.md)                                                                                                                                                                                   |
| **User guide**   | [Getting started](docs/user-guide/getting-started.md) · [Account setup](docs/user-guide/account-setup.md) · [PGP setup](docs/user-guide/pgp-setup.md) · [Backup & restore](docs/user-guide/backup-restore.md)                                                 |
| **Changelog**    | [Release Notes](docs/user-guide/release-notes.md)                                                                                                                                                                                                             |

---

## Contributing

This is an indie, solo-founded project and contributions are genuinely welcome:

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
