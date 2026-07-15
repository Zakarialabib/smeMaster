# AGENTS.md — SMEMaster Agent Guide

> Canonical guide for AI agents working on **SMEMaster**. This file is auto-loaded by `.trae/hooks.json` (`preTask` → `context-loading`). Keep it in sync with [`docs/00-INDEX.md`](docs/00-INDEX.md) and the `.trae/rules/` files.

## What SMEMaster Is

SMEMaster is an **offline-first desktop + mobile personal/business assistant** built as a **Tauri v2 + React 19 + Rust + SQLite** application. It unifies email, CRM/contacts, tasks, calendar, campaigns, automation, PGP/security, a local AI RAG layer, and a Morocco DGI-compliant invoicing + POS/ERP module.

- **Platforms:** Desktop (Windows · Linux · macOS) ✅ · Mobile (Android) ✅ · iOS ⚠️ (requires a Mac to build)
- **Version:** 1.0.0-rc · **DB:** 32 migrations · **Tests:** 2,470 TS + 735 Rust
- **Locales:** en, fr, ar (RTL), ja, it · **IPC commands:** ≈800 (802 by attribute count) · **Zustand stores:** 46 (split across `src/shared/stores`, `src/features/*/stores`, and legacy `src/stores`)

## Current Project Goals (north star)

1. **Pre-Release Polish** — panic injection, WAL recovery, watchdog restart, `tauri dev` smoke test, code signing (Windows EV cert / macOS notarization). See `docs/05-DEVELOPMENT/03-manual-tests.md` and `docs/release/`.
2. **RTL & i18n** — fix 400+ physical-direction violations (`text-left`→`text-start`, `ml-*`→`ms-*`, `left/right`→`inset-inline-start/end`); clear `[TODO]`-prefixed auto-translated ja/it keys (`npm run translate:sync`). See `docs/03-FRONTEND/10-rtl-audit.md` and `docs/04-FEATURES/32-i18n-localization.md`.
3. **Production Launch** — Windows MSI/NSIS + Android APK/AAB via GitHub Actions. See `docs/06-ROADMAP/09-master-plan.md` and `.trae/documents/2026-07-05-production-launch-plan.md`.
4. **Backend Hardening** — CRDT multi-device sync (`src-tauri/src/sync_engine/`), cache layer (`src-tauri/src/data_cache/`), offline queue. See `.trae/documents/2026-07-05-data-layer-evolution-plan.md`.
5. **Accessibility** — WCAG AA: ARIA, live regions, full keyboard navigation. See `docs/03-FRONTEND/08-ui-ux-roadmap.md`.

> Single source of truth for status: [`docs/STATUS.md`](docs/STATUS.md). Single source of truth for gates: [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md).

## Architecture (three layers — never cross the boundaries)

```
React 19 UI (src/features, src/shared)          ← what the user sees
        │ calls plain async service functions
TypeScript Service Layer (src/shared/services)     ← how it works, no rendering
        │ invoke("db_get_account", {...})
Tauri v2 + Rust (src-tauri/src)                 ← the real work: DB, native, sync
        │ sqlx
SQLite (WAL mode)                                ← Rust owns the data
```

**Hard rules:**
- UI never touches the database. Services never render HTML. Rust never imports React.
- All DB access goes through Rust — **zero direct SQL in TypeScript**. Route via `src/shared/services/db/db-invoke.ts` (504 typed wrappers) or `src/shared/services/commands.ts`.
- Call commands through `invokeCommand`; **never** `import { invoke } from '@tauri-apps/api/core'` in application code.
- **Rust owns the schema**: migrations + queries live in `src-tauri/src/db/`. TypeScript only mirrors types.
- All email mutations go through `emailActions.ts` (optimistic + offline-aware).
- Frontend request DTOs use `camelCase`; column names / dynamic update maps stay `snake_case`; serde renaming on the Rust side. **Exact command names matter** — mismatches are runtime failures.

## Tech Stack & Conventions

| Concern | Rule |
|---|---|
| Language | TypeScript strict (`noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`); Rust 2021 edition |
| Imports | `@/*` → `src/*` (no relative `../../../`) |
| State | Zustand stores, split by domain; subscribe components to slices |
| Styling | Tailwind v4; use design tokens / CSS variables — **no hardcoded colors** (`#fff`); follow [`docs/05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md`](docs/05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md) |
| i18n | react-i18next; keys in `src/locales/{en,fr,ar,ja,it}/translation.json`; never hardcode UI strings — use `t()` |
| Tests (TS) | colocated `*.test.ts(x)`; run `npm run test` (vitest); integration excluded by default |
| Tests (Rust) | colocated; run `cargo test` in `src-tauri/` |
| Format | Prettier (`npm run format`) + ESLint (`npm run lint`) |
| RTL | Use logical properties (`ms-*`, `me-*`, `text-start/end`, `inset-inline-*`), never physical `left/right` |

## Step Phase Funnel (every task)

1. **READ** — ingest context; never assume. Read the target files and the relevant `docs/` entry first.
2. **ANALYZE** — map impact across React ↔ Service ↔ Rust ↔ DB; note side effects and offline behavior.
3. **THINK** — sequential plan; consider offline-first + multi-window constraints.
4. **RECHECK** — validate against existing patterns and the system loops (orchestrator, EventBus, DomainEventProcessor).
5. **EXECUTE** — chunked, verifiable steps, one component at a time.

## Quality Gates (must be green before declaring done)

```bash
npx tsc --noEmit                       # zero TS errors
npx eslint src --max-warnings=0        # zero lint errors/warnings
npx vitest run --exclude integration    # 2,470 TS tests
cd src-tauri && cargo check             # zero Rust errors
cd src-tauri && cargo test             # 735 Rust tests
npm run build                           # clean vite build
```

## Agent Tooling (MCP)

- **context7** — always use for crate/library docs and setup/config snippets before writing Rust or adding dependencies.
- **Sequential Thinking** — use for multi-step planning and to reduce reasoning tokens.
- **Persistent Knowledge Graph** — persist architecture decisions, entities, and session continuity (see `/memory-capture`).

## Tech Debt & Documentation Tracking

When you find confusing, poorly-typed, or deprecated code while working: **stop, document it — don't "fix and forget."**
- Backend / Types debt → [`docs/02-BACKEND/12-diagnostics.md`](docs/02-BACKEND/12-diagnostics.md)
- Frontend / Patterns debt → [`docs/03-FRONTEND/13-deprecations.md`](docs/03-FRONTEND/13-deprecations.md)

Record: title, file:line, severity, issue, future plan, how discovered.

## Agent Commands (`.trae/commands/`)

| Command | Purpose |
|---|---|
| `/audit-all` | Full-stack health (TS, lint, Rust, clippy, LSP) |
| `/review-frontend <pattern>` | React/TS review (typecheck, lint, a11y, RTL) |
| `/review-rust <module>` | Rust/Tauri review (check, clippy, safety) |
| `/sync-types` | Verify React ↔ Rust IPC type consistency |
| `/feature-plan <name>` | Multi-layer feature plan via Step Phase Funnel |
| `/debt-doc <type> [summary]` | Record technical debt (no auto-fix) |
| `/memory-capture` | Persist session to Knowledge Graph |

## Always-Applied Rules

`.trae/rules/project_rules.md` and `.trae/rules/rust.md` are auto-loaded as workspace rules each session. This `AGENTS.md` is the entry point; the rules files carry the enforceable specifics.
