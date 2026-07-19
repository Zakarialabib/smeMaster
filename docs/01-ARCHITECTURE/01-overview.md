# Architecture Overview

> **What you need to know:** SMEMaster is a three-layer desktop app. React handles the UI, TypeScript services handle the logic, Rust handles everything that touches your data. They don't overlap. That's the whole trick.

---

## The Three Layers

```
┌─────────────────────────────────────────────────────────────┐
│  🎨 React 19 + TypeScript + Tailwind v4                     │  UI Layer
│  Feature modules · shared stores · typed UI/runtime layers   │  "What you see"
├─────────────────────────────────────────────────────────────┤
│  🧠 Service Layer (TypeScript)                               │  Logic Layer
│  Shared services + feature-local services + command wrappers │  "How it works"
├─────────────────────────────────────────────────────────────┤
│  🦀 Tauri v2 + Rust                                          │  Native Layer
│  Command surface · DB ownership · native/background services │  "The real work"
└─────────────────────────────────────────────────────────────┘
```

**The rule:** UI never touches the database. Services never render HTML. Rust never imports React. Each layer has one job.

---

## How They Talk

```
React Component
     │  calls service function directly (same process, no IPC)
     ▼
Service Layer
     │  invoke("db_get_account", { account_id: "..." })
     ▼
Rust Command (commands/core.rs)
     │  calls sqlx query function
     ▼
SQLite (WAL mode)
```

**Why this matters:**

- UI calls are synchronous — no loading spinners for local data
- Services are plain async functions (not classes), except `GmailClient`
- All database access goes through Rust — zero direct SQL in TypeScript
- Zustand stores subscribe components to reactive slices — no Redux boilerplate

---

## What Happens When You Start the App

1. Tauri's `setup` hook fires → creates SQLite pool → runs 32 migrations (verified 2026-07-15; the "56" figure is from the old migration scheme) → starts background services (snooze, follow-up, queue, pre-cache, scheduled send, bundle, update checker)

2. `main.tsx` renders `<WindowBootstrap>` which checks: "what window are we in?"

3. Based on the window label:
   - **"main"** → Full app with router + `useAppInit`:
     - Seeds built-in email + campaign presets/templates (see `seedAllPresets`)
     - Seeds default compliance profiles
     - Loads i18n → restores settings → loads accounts → initializes email clients
     - Seeds default signatures and quick replies per account
     - Starts background services (Rust owns the lifecycle, React just observes)
     - Initializes notifications, global shortcuts, deep link handler
     - Closes the splash screen → shows the main window
   - **"thread"** → Minimal thread view (no router, no event bus)
   - **"compose"** → Minimal compose view (just the composer)

**Multi-window is built in.** Pop out a compose window or a thread view — they're independent Tauri windows with their own lifecycle.

---

## Key Conventions (Read These or Regret It)

| Convention                                       | Why                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Services are plain async functions               | Easier to test, easier to reason about                                                           |
| Tests live next to source code                   | `file.test.ts` beside `file.ts` — you'll actually find them                                      |
| TypeScript strict mode on                        | `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` — the compiler is your friend |
| `@/*` maps to `src/*`                            | Import from `@/stores/threadStore`, not `../../../stores/threadStore`                            |
| Rust owns the database                           | Schema, migrations, queries — all in `src-tauri/src/db/`. TypeScript only mirrors types          |
| No direct SQL in TypeScript                      | Every database call goes through `db-invoke.ts` → Rust → sqlx                                    |
| All email mutations go through `emailActions.ts` | Optimistic UI, offline-aware, single source of truth                                             |

---

## IPC at a Glance

| Channel   | Wrapper                                            | What it does                                    |
| --------- | -------------------------------------------------- | ----------------------------------------------- |
| IMAP/SMTP | `src/shared/services/imap/tauriCommands.ts` (19 wrappers) | Send, receive, sync email                       |
| PGP       | `src/shared/services/pgp/pgpService.ts`            | Encrypt, decrypt, key management                |
| Export    | `src/shared/services/export/exportService.ts`      | Save data as mbox, PDF                          |
| Badge     | `src/shared/services/badgeManager.ts`              | Unread count on the dock icon                   |
| DB        | `src/shared/services/db/db-invoke.ts` (re-exports 15 domain modules; ~479 `db_*` wrappers) + `commands.ts` (1 generic typed `invoke<T>`) | 480 typed IPC wrappers total |

---

## The Short Version

Three layers. Clear boundaries. Rust owns your data. React owns your pixels. TypeScript services connect them.

That's it. That's the architecture.
