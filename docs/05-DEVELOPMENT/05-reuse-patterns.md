# Code Reuse Patterns & Refactoring Plan

> **Status:** Rust-first DB layer. Frontend reaches Rust through a per-domain typed `invoke/` wrapper layer (split out of the former single `db-invoke.ts`), and the Rust DB layer shares CRUD helpers from `src-tauri/src/db/common.rs`.

---

## What you need to know

The codebase went through a major architecture shift: **Rust now owns all database operations**. The old TypeScript service layer was removed. Frontend calls ~479 typed Rust `db_*` commands through the `invoke/` wrapper layer (plus interfaces and `schema` re-exports), and the Rust DB layer reuses shared helpers from `db/common.rs` instead of copy-pasting CRUD boilerplate.

---

## P1 — `invoke/` typed wrapper layer (was `db-invoke.ts`)

**The problem:** Frontend needed type-safe access to ~479 Rust `db_*` commands without manually writing `invoke()` calls.

**The fix:** `src/shared/services/db/db-invoke.ts` used to be a single 139 KB file exporting one typed function per command. It has been **split** into a per-domain module tree under `src/shared/services/db/invoke/`, with a thin re-export shim left at `db-invoke.ts` so existing importers keep working unchanged.

```ts
// src/shared/services/db/invoke/command.ts — shared typed caller
export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  /* wraps invoke() from '@shared/services/ipc', { log: false, silent: true } */
}

// src/shared/services/db/invoke/core.ts (and crm, comms, campaigns, calendar,
// tasks, workflows, deliverability, security, ai, compliance, mail, vault, rag)
export const dbGetAccount = (accountId: string) =>
  invokeCommand<Account>('db_get_account', { accountId });
```

**Layout:**

| Module                                                                | Responsibility                                                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `invoke/command.ts`                                                   | `invokeCommand<T>()` typed caller — one place for IPC options + error behavior                      |
| `invoke/core.ts`                                                      | core account / thread / message / label / attachment / scheduled-email commands + schema re-exports |
| `invoke/crm.ts`                                                       | contacts-domain commands (wraps Rust `contacts::*` commands)                                        |
| `invoke/comms.ts`                                                     | templates, signatures, aliases, filters, drafts, quick replies, etc.                                |
| `invoke/campaigns.ts`                                                 | campaign commands (wraps Rust `crm::*` campaign commands)                                           |
| `invoke/calendar.ts`, `tasks.ts`, `workflows.ts`, `deliverability.ts` | domain commands                                                                                     |
| `invoke/security.ts`, `ai.ts`, `compliance.ts`, `mail.ts`, `vault.ts` | domain commands                                                                                     |
| `invoke/rag.ts`                                                       | local RAG (LanceDB / Candle) commands                                                               |
| `db-invoke.ts`                                                        | `export *` shim — backwards-compatible re-export of all of the above                                |

**Impact:** Zero manual `invoke()` calls needed inside `invoke/`; one place (`invokeCommand<T>`) owns IPC behavior. Commands are grouped by domain for easier navigation than the former single mega-file.

---

## P1 — Zustand createAsyncStore (~50 lines saved)

**The problem:** 7+ Zustand stores all had the same `isLoading → try/fetch → catch → set` pattern.

**The fix:** Created `src/shared/stores/createAsyncStore.ts` — a reusable generic slice factory.

```ts
// Usage in any store
const useMyStore = createAsyncStore<MyState, { fetchItems: () => Promise<Item[]> }>((set, get) => ({
  items: [],
  fetchItems: async () => {
    set({ isLoading: true });
    try {
      const items = await api.getItems();
      set({ items, isLoading: false });
    } catch (e) {
      set({ error: e.message, isLoading: false });
    }
  },
}));
```

---

## P1 — Generic CRUD Slice Builders (~60 lines saved)

**The problem:** `ContactStore` had triplicate `loadTags`/`loadGroups`/`loadSegments` + create/delete patterns.

**The fix:** Generic CRUD slice builder for tags, groups, and segments in `src/features/contacts/stores/contactStore.ts`.

---

## P1 — Generic tauriCommands Wrapper for IMAP (~200 lines saved)

**The problem:** 19 one-liner `invoke()` wrappers in `src/features/mail/services/imap/tauriCommands.ts`.

**The fix:** One generic `imapCmd<T>(cmd, args?)` function + typed exports.

---

## P1 — safeInvoke for PGP (~24 lines saved)

**The problem:** 4 PGP functions each had the same try/catch error wrapper.

**The fix:** Shared `safeInvoke<T>(cmd, args)` in `src/shared/services/pgp/pgpService.ts`.

---

## P1 — AI Provider Shared Utils (~40 lines saved)

**The problem:** 5 provider files had identical `LANGUAGE_MAP` + `buildSystemPrompt()`.

**The fix:** Extracted to `src/shared/services/ai/utils.ts`.

---

## P1 — Rust `db/common.rs` shared DB helpers

**The problem:** Every `src-tauri/src/db/tables/**` module repeated the same CRUD boilerplate — `.ok_or_else(|| AppDbError::NotFound(...))` for `get_by_id`, `rows_affected == 0 → NotFound` for `delete`, inline `match sort_by { … }` sort maps, `format!("%{q}%")` LIKE patterns, and copy-pasted dynamic `update_fields` builders.

**The fix:** `src-tauri/src/db/common.rs` extracts these into reusable, behavior-preserving helpers (SQL strings and error messages are unchanged — pure refactor):

| Helper                                         | Replaces                                   | Notes                                      |
| ---------------------------------------------- | ------------------------------------------ | ------------------------------------------ | ---------------------------- | ------------------------------------------------- |
| `fetch_or_not_found(opt, id, entity)`          | `.ok_or_else(                              |                                            | NotFound(...))`on`get_by_id` | sync; emits `"{entity} with id '{id}' not found"` |
| `delete_or_not_found(pool, sql, id, entity)`   | `rows_affected == 0 → NotFound`            | async; SQL passed through `AssertSqlSafe`  |
| `count_rows(pool, sql, bind)`                  | `SELECT COUNT(*)` queries                  | `bind` closure adds positional binds       |
| `build_sort_clause(allowed, default, sort_by)` | inline `match sort_by { … }` blocks        | whitelists `ORDER BY` columns              |
| `apply_field_updates(pool, table, id, fields)` | per-table dynamic `update_fields` builders | generic `SET` / `NULL` / `updated_at` bump |
| `like_pattern(q)`                              | `format!("%{q}%")`                         | `LIKE` wildcard helper                     |

**Adoption rule:** helpers are adopted only where the existing code is an exact match (same SQL + same message). `DELETE`/`UPDATE`-not-found paths that use a `?`-bound id are left inline, because `delete_or_not_found` embeds the id in the SQL string and downgrading a parameterized statement to an interpolated one would change SQL form. Custom `NotFound` messages that don't match the `"{entity} with id '{id}' not found"` shape are also left inline. All six helpers have `#[cfg(test)]` coverage in `common.rs`.

---

## P2 — Rust `with_session()` Wrapper

**The problem:** 12+ Rust IMAP commands repeat the same `connect → operate → logout` pattern.

**The fix:** Planned `with_session(config, async_fn)` helper in `src-tauri/src/imap/connect.rs`.

---

## P2 — EmptyState Component Usage

**The problem:** A few components (`QueueInspector`, etc.) rolled their own empty states instead of using `<EmptyState>`.

**Status:** Low priority — works, just not DRY.

---

## Current Architecture: Rust-First DB Layer

```
Frontend (React)
    │
    ▼ invokeCommand("db_get_account", { accountId })
src/shared/services/db/invoke/<domain>.ts   ← per-domain typed wrappers
src/shared/services/db/invoke/command.ts     ← invokeCommand<T>() single caller
src/shared/services/db/db-invoke.ts          ← shim: export * from ./invoke/*
    │
    ▼ Tauri IPC
Rust Commands (commands/<domain>.rs)         ← #[tauri::command] handlers (registered in commands/mod.rs)
    │
    ▼ sqlx + shared helpers
src-tauri/src/db/tables/<domain>/<table>.rs  ← per-table CRUD/query ops
src-tauri/src/db/common.rs                   ← fetch_or_not_found, delete_or_not_found, count_rows, build_sort_clause, apply_field_updates, like_pattern
    │
    ▼ SQLite (WAL mode)
```

**Key files:**

- `src/shared/services/db/invoke/command.ts` — `invokeCommand<T>()` typed caller (IPC behavior lives here)
- `src/shared/services/db/invoke/<domain>.ts` — ~479 `db_*` typed wrappers, grouped by domain
- `src/shared/services/db/db-invoke.ts` — backwards-compatible re-export shim
- `src-tauri/src/commands/mod.rs` — single `generate_handler!` (all command registrations)
- `src-tauri/src/commands/<domain>.rs` — command handlers (~330 `db_*` / `ai_*` commands)
- `src-tauri/src/db/tables/` — per-table query modules
- `src-tauri/src/db/common.rs` — shared DB helpers

---

## Implementation Order (Updated)

1. ✅ Zustand `createAsyncStore`
2. ✅ Generic CRUD slice builders (ContactStore)
3. ✅ Generic `imapCmd` wrapper
4. ✅ `safeInvoke` for PGP
5. ✅ AI `buildSystemPrompt` → shared utils
6. ✅ **Rust DB layer** — per-table modules in `db/tables/**`, shared helpers in `db/common.rs`
7. ✅ **TS `invoke/` split** — 139 KB `db-invoke.ts` → per-domain `invoke/<domain>.ts` + `command.ts` + shim
8. ⬜ Rust `with_session()` wrapper (planned)
9. ⬜ EmptyState audit (low priority)
10. ⬜ Consolidate remaining raw `invoke()` calls in feature/service code into the `invoke/` wrappers

---

## Related

- [Architecture Overview](../01-ARCHITECTURE/01-overview.md) �?" Three-layer diagram
- [Backend Structure](../01-ARCHITECTURE/02-backend-structure.md) �?" Rust module layout
- [Shared Components API](../../03-FRONTEND/15-shared-components.md) �?" Component/hook library reference
- [STATUS.md](../STATUS.md) �?" Command counts, test status

---

## P1 — Shared Component & Hook Library (`src/shared/components`, `src/shared/hooks`, `src/shared/utils`)

**The problem:** Feature components repeatedly rolled their own loading spinners, confirmation dialogs, error boundaries, form wrappers, and ad-hoc `window` event listeners — leading to visual inconsistency and duplicated retry/persistence logic.

**The fix:** A small, typed, zero-dependency library under `src/shared/` that every feature should prefer over re-implementing the same primitive.

### UI primitives — `src/shared/components/`

| Component                 | Purpose                                                         | Key props                                                           |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `ErrorBoundary.tsx`       | Catches render-time errors in a subtree, shows fallback + reset | `fallback?`, `onError?`                                             |
| `ConfirmationDialog.tsx`  | Reusable confirm/cancel modal                                   | `open`, `title`, `message`, `confirmLabel`, `onConfirm`, `onCancel` |
| `FeedbackContainer.tsx`   | Unified success/error/info feedback region                      | `status`, `message`, `onDismiss?`                                   |
| `FormWrapper.tsx`         | Standard form shell: submit handling, busy + disabled states    | `onSubmit`, `isSubmitting?`, `children`                             |
| `LoadingSpinner.tsx`      | Standardized loading indicator (size/variant)                   | `size?`, `label?`                                                   |
| `EventHandlerWrapper.tsx` | Subscribes to a `uiBus` event and renders children reactively   | `event`, `children` / render-prop                                   |

### Stability hooks & utils — `src/shared/hooks`, `src/shared/utils/`

| Export                  | Purpose                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `useAsyncData.ts`       | Standardized async fetch with `data/isLoading/error/refetch`                       |
| `useAsyncError.ts`      | Normalizes thrown values into `{ message }` for display                            |
| `useLoading.ts`         | Boolean loading-state manager with `start/stop/toggle`                             |
| `usePersistentState.ts` | `useState` mirror persisted to `localStorage`/`sessionStorage` with cross-tab sync |
| `retryLogic.ts`         | `withRetry(fn, opts)` — exponential backoff, configurable retry conditions, jitter |

**Adoption rule:** Before adding a new spinner/dialog/retry block in a feature, check this library. If the primitive is missing, add it here (typed, strict, no `any`) rather than inlining it in the feature.

See [`15-shared-components.md`](../../03-FRONTEND/15-shared-components.md) for the full API reference.

## Source reconciliation (2026-07-19)

| Claim (before)                                                                                    | Verified reality                                                                                          | Evidence                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "~379 typed `db_*`/`ai_*` commands"; imap wrappers at `src/shared/services/imap/tauriCommands.ts` | **479** `db_*` wrappers in `invoke/`; imap wrappers at `src/features/mail/services/imap/tauriCommands.ts` | `grep -rhoE 'export (const`/`async function`/`function) ...' src/shared/services/db/invoke/ \| wc -l` = 479; `ls src/features/mail/services/imap/tauriCommands.ts` |
