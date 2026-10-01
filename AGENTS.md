# AGENTS.md — SMEMaster Agent Guide

> Canonical guide for AI agents working on **SMEMaster**. Auto-loaded by `.trae/hooks.json` (`preTask` → `context-loading`). Keep it in sync with [`docs/00-INDEX.md`](docs/00-INDEX.md) and the `.trae/rules/` files.

## What SMEMaster Is

SMEMaster is an **offline-first desktop + mobile personal/business assistant** built as a **Tauri v2 + React 19 + Rust + SQLite** application. It unifies email, CRM/contacts, tasks, calendar, campaigns, automation, PGP/security, a local AI RAG layer, and a Morocco DGI-compliant invoicing + POS/ERP module.

| Fact | Value |
|---|---|
| Platforms | Desktop (Windows · Linux · macOS) ✅ · Android ✅ · iOS ⚠️ (needs a Mac) |
| Version | 1.0.0-rc |
| Migrations | **33** (`src-tauri/src/db/migrations/`) |
| IPC commands | **784** `#[tauri::command]` attributes |
| Zustand stores | **41** (`src/shared/stores`, `src/features/*/stores`, legacy `src/stores`) |
| TS tests | **3,417** unit (302 files) + 145 integration |
| Rust tests | **989** `#[test]` / `#[tokio::test]` |
| Locales | en, fr, ar (RTL), ja, it |

## Toolchain — bun, not npm

**bun is the package manager and script runner.** It is faster and the lockfile is `bun.lock` (committed; `package-lock.json` was removed). Do not add npm-only commands to docs, scripts, or CI.

```bash
bun install            # install / sync deps from bun.lock
bun run <script>       # run any package.json script
bunx <bin>             # one-off binary (replaces npx)
bun add -d <pkg>       # add a dev dependency
```

Bun must be **1.4.2+** (`bun --version`). If it reports an older release, a stale npm-installed shim is shadowing the real binary — see *Troubleshooting*.

### TypeScript 7 with a TS 6 side-by-side API

The repo runs **two TypeScript installs**, deliberately, per the [official TS 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0):

```jsonc
// package.json devDependencies
"typescript": "npm:@typescript/typescript6@^6.0.2",  // TS 6 API — typescript-eslint needs it
"@typescript/native": "npm:typescript@^7.0.2"        // TS 7 Go-native `tsc` — the fast one
```

**Why:** TS 7 is the Go rewrite and ships **no programmatic API**, so `typescript-eslint` throws `typescript-eslint does not support TS 7.0` and the whole lint gate dies. The alias gives `typescript-eslint` the TS 6 API it expects while `tsc` stays on 7.

- `tsc` / `bunx tsc` → **TypeScript 7.0.2** (native, ~10x faster)
- Do **not** "simplify" this to a single `typescript` entry. You will silently lose linting.

TS 7 also **removed `baseUrl`**: `tsconfig.json` must use `"paths"` with explicit `./` prefixes and no `baseUrl`.

## Current Project Goals (north star)

1. **Pre-Release Polish** — panic injection, WAL recovery, watchdog restart, `tauri dev` smoke test, code signing (Windows EV cert / macOS notarization). See `docs/05-DEVELOPMENT/03-manual-tests.md` and `docs/release/`.
2. **RTL & i18n** — fix remaining physical-direction violations (`text-left`→`text-start`, `ml-*`→`ms-*`, `left/right`→`inset-inline-start/end`); clear `[TODO]`-prefixed auto-translated ja/it keys (`bun run translate:sync`). See `docs/03-FRONTEND/10-rtl-audit.md` and `docs/04-FEATURES/32-i18n-localization.md`.
3. **Production Launch** — Windows MSI/NSIS + Android APK/AAB via GitHub Actions. See `docs/06-ROADMAP/09-master-plan.md`.
4. **Backend Hardening** — CRDT multi-device sync (`src-tauri/src/sync_engine/`), cache layer (`src-tauri/src/data_cache/`), offline queue.
5. **Accessibility** — WCAG AA: ARIA, live regions, full keyboard navigation. See `docs/03-FRONTEND/08-ui-ux-roadmap.md`.

> Single source of truth for status: [`docs/STATUS.md`](docs/STATUS.md). Single source of truth for gates: [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md).

## Architecture (three layers — never cross the boundaries)

```
React 19 UI (src/features, src/shared)          ← what the user sees
        │ calls plain async service functions
TypeScript Service Layer (src/shared/services)     ← how it works, no rendering
        │ invokeCommand("db_get_account", {...})
Tauri v2 + Rust (src-tauri/src)                 ← the real work: DB, native, sync
        │ sqlx
SQLite (WAL mode)                                ← Rust owns the data
```

**Hard rules:**
- UI never touches the database. Services never render HTML. Rust never imports React.
- All DB access goes through Rust — **zero direct SQL in TypeScript**. Route via `src/shared/services/db/db-invoke.ts` (typed wrappers) or `src/shared/services/commands.ts`.
- Call commands through `invokeCommand`; **never** `import { invoke } from '@tauri-apps/api/core'` in application code.
- **Rust owns the schema**: migrations + queries live in `src-tauri/src/db/`. TypeScript only mirrors types.
- All email mutations go through `emailActions.ts` (optimistic + offline-aware).
- Frontend request DTOs use `camelCase`; column names / dynamic update maps stay `snake_case`; serde renaming on the Rust side. **Exact command names matter** — mismatches are runtime failures.
- **Cross-feature imports are forbidden** — enforced by `import/no-restricted-paths` in `eslint.config.js`. Go through `shared/` or a service.

## Tech Stack & Conventions

| Concern | Rule |
|---|---|
| Package manager | **bun** (`bun install`, `bun run`, `bunx`); lockfile is `bun.lock` |
| Language | TypeScript 7 strict (`noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`); Rust 2021 edition |
| Imports | `@/*` → `src/*` (no relative `../../../`) |
| State | Zustand stores, split by domain; subscribe components to slices |
| Styling | Tailwind v4; design tokens / CSS variables — **no hardcoded colors** (`#fff`); follow [`docs/05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md`](docs/05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md) |
| i18n | react-i18next; keys in `src/locales/{en,fr,ar,ja,it}/translation.json`; never hardcode UI strings — use `t()` |
| Build | **Vite 8 / Rolldown** — `manualChunks` must be a **function**, never an object (Rolldown rejects the object form) |
| Schemas | **Zod 4** — use `z.toJSONSchema()`; `schema._def.typeName` is gone (Zod 3 internal) |
| Icons | **lucide-react 1.x** — some 0.x names were renamed/removed (`Github` is gone); verify the export exists before importing |
| Tests (TS) | colocated `*.test.ts(x)`; two vitest projects (`unit`, `integration`) |
| Tests (Rust) | colocated; `cd src-tauri && cargo test` |
| Format | Prettier (`bun run format`) + ESLint (`bun run lint`) |
| RTL | Logical properties only (`ms-*`, `me-*`, `text-start/end`, `inset-inline-*`), never physical `left/right` |

## Step Phase Funnel (every task)

1. **READ** — ingest context; never assume. Read the target files and the relevant `docs/` entry first.
2. **ANALYZE** — map impact across React ↔ Service ↔ Rust ↔ DB; note side effects and offline behavior.
3. **THINK** — sequential plan; consider offline-first + multi-window constraints.
4. **RECHECK** — validate against existing patterns and the system loops (orchestrator, EventBus, DomainEventProcessor).
5. **EXECUTE** — chunked, verifiable steps, one component at a time.

## Quality Gates (must be green before declaring done)

```bash
bun run typecheck                      # tsc 7 (native) — zero TS errors
bun run lint                           # eslint (all of src) — zero errors/warnings
bun run test                           # vitest --project unit — 3,417 tests
cd src-tauri && cargo check            # zero Rust errors
cd src-tauri && cargo test             # 989 Rust tests
bun run build                          # tsc + vite build (Rolldown)
```

**Two vitest projects.** `bun run test` runs the `unit` project only (jsdom, Tauri mocked). The `integration` project (`bun run test:integration`) drives the real Rust backend over `node:sqlite` and **fails without a running Tauri app** — that is expected outside `tauri dev`, not a regression.

**Pre-commit hook.** `.husky/pre-commit` runs `bunx lint-staged` (eslint + prettier on staged files). If a commit silently skips it, the hook is missing or not executable.

## Troubleshooting (environment)

| Symptom | Cause | Fix |
|---|---|---|
| `bun --version` shows an old release | stale npm-installed `bun` shim earlier in `PATH` | delete `%APPDATA%\npm\bun*` and `%APPDATA%\npm\node_modules\bun`; the real binary lives in `~/.bun/bin` |
| `ConnectionClosed` / `SEC_E_DECRYPT_FAILURE` on large downloads | path MTU / TLS resets on big transfers | download via a multi-connection tool (Gopeed) and install manually, or lower the adapter MTU |
| `typescript-eslint does not support TS 7.0` | `typescript` alias removed | restore the TS 6 alias shown above |
| `manualChunks is not a function` | Rolldown got an object | make `manualChunks` a function |
| Lint runs but reports nothing | typescript-eslint threw before parsing | check for the TS 7 message above |
| Port 1420 already in use | stale vite from a previous session | kill the PID from `netstat -ano \| grep :1420` |

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
