# Ops Commands & Tables: Full-Stack Inspection, Refactor & Docs

- **Date:** 2026-07-09
- **Status:** Approved (design)
- **Owner:** smeMaster engineering
- **Stack:** Tauri (Rust backend) + React/TypeScript frontend

## 1. Goal

Inspect **every ops command and database table** across both layers of the data
stack, then:

1. **Refactor** for separation of concerns and reuse — eliminate copy-pasted
   CRUD/query boilerplate by extracting shared utilities, and split the oversized
   files so no single file is a "long file."
2. **Annotate** every public method, interface, struct, and module with
   documentation comments (purpose, params, returns, error cases, SQL-safety).
3. **Find redundancy** and document better approaches.
4. **Update `docs/`** so the command reference, data model, reuse patterns, and
   error system reflect the inspected, refactored reality.

This is a **pure refactor**: SQL semantics, command signatures, and runtime
behavior are unchanged. Only structure + comments change.

## 2. Decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Scope | **Both layers** — Rust backend (`src-tauri/src/`) + TS frontend (`src/`) |
| Deliverable | **Full refactor + annotate + docs** |
| Sequencing | **Layer-by-layer** — finish all Rust, then all TS |

## 3. Inventory

### 3.1 Rust backend (`src-tauri/src/`)

| Group | Location | Size | Notes |
| --- | --- | --- | --- |
| Per-table ops | `db/tables/**` | 46 modules | Source of 328 repetitions of `NotFound` / `rows_affected` / `AssertSqlSafe` |
| Command handlers | `commands/*.rs` | 25 files / 582 fns | Heaviest: `comms.rs` (113), `contacts.rs` (87), `core.rs` (59), `crm.rs` (51), `deliverability.rs` (47) |
| Operation shims | `db/<domain>/operations.rs` | re-export stubs | Annotate for completeness |

**Excluded:** `db/migrations/`, `sync_engine/`, `imap/`, `smtp/`, `pgp/` — these are
not "ops commands / tables."

### 3.2 TS frontend (`src/`)

| Group | Location | Size | Notes |
| --- | --- | --- | --- |
| Invoke wrapper mega-file | `shared/services/db/db-invoke.ts` | 379 fns / 139 KB | The primary "long file" to split |
| Feature DB modules | `features/*/db/*.ts` | one per feature | Thin wrappers; annotate + light dedup |
| Shared DB modules | `shared/services/db/*.ts` | threads, messages, labels, … | Annotate |

## 4. Rust Layer Refactor Strategy

### 4.1 New shared utilities — `src-tauri/src/db/common.rs`

Collapse the 328 boilerplate repetitions into reusable, unit-tested helpers:

```rust
/// Fetch an optional row, mapping `None` -> `AppDbError::NotFound`.
pub fn fetch_or_not_found<T>(opt: Option<T>, id: &str, entity: &str) -> Result<T, AppDbError>;

/// Execute a DELETE and map 0 affected rows -> `AppDbError::NotFound`.
pub async fn delete_or_not_found(pool: &SqlitePool, sql: impl Into<String>, id: &str, entity: &str) -> Result<(), AppDbError>;

/// Run a `SELECT COUNT(*)` query and return the scalar `i64`.
pub async fn count_rows(pool: &SqlitePool, sql: &str, binds: &[&dyn Bind]) -> Result<i64, AppDbError>;

/// Whitelist a `sort_by` value into a safe `ORDER BY` clause.
/// `allowed` = [(value, "col ASC"), …]; returns `default` when unmatched.
pub fn build_sort_clause(allowed: &[(&str, &str)], default: &str, sort_by: Option<&str>) -> &str;

/// Apply a partial `UpdateFields` patch to any table generically.
pub async fn apply_field_updates(pool: &SqlitePool, table: &str, id: &str, fields: &UpdateFields) -> Result<(), AppDbError>;

/// Build a `LIKE` pattern: `format!("%{q}%")`.
pub fn like_pattern(q: &str) -> String;
```

Final generic bind signatures are finalized during implementation; the contract
above is stable. Every helper preserves existing SQL (including `AssertSqlSafe`),
so behavior is unchanged.

### 4.2 Table modules

- Adopt the `common.rs` helpers in place of inline repetition.
- Modules whose **operational** (non-test) code exceeds **~400 LOC** get
  cross-cutting query groups extracted to a submodule — e.g. `contacts/dashboard.rs`
  (aggregate queries) and `contacts/merge.rs` (transactional merge). Inline
  `#[cfg(test)]` blocks stay with their module (Rust idiom).
- `db/<domain>/operations.rs` shims get a one-line `//!` doc stating they re-export
  per-table modules.

## 5. TS Layer Refactor Strategy

### 5.1 Generic invoke wrapper — `shared/services/db/invoke/command.ts`

```ts
/** Typed Tauri command caller. Replaces per-function `invoke('x', args) as T`. */
export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T>;
```

### 5.2 Per-domain invoke modules — `shared/services/db/invoke/<domain>.ts`

One module per domain: `core`, `mail`, `crm`, `comms`, `campaigns`, `calendar`,
`tasks`, `workflows`, `deliverability`, `security`, `ai`, `compliance`, `vault`.
Each holds that domain's `invoke('cmd', args)` wrappers, now routed through
`invokeCommand<T>`.

### 5.3 `db-invoke.ts` becomes a re-export shim

```ts
export * from './invoke/core';
export * from './invoke/mail';
// … one line per domain
```

This eliminates the 139 KB file **and** keeps the ~100 existing importers of
`@shared/services/db/db-invoke` working with zero changes. Safe.

### 5.4 Feature DB modules

- Add JSDoc to every exported fn + interface in `features/*/db/*.ts` and
  `shared/services/db/*.ts`.
- Extract a helper only where a pattern repeats **≥ 3×** (YAGNI otherwise).

## 6. Annotation / Comment Convention

- **Rust:** `///` on every `pub fn`, `pub struct`/`enum`, and `//!` module header.
  Each must state: purpose, param semantics, return, **error cases (especially
  `AppDbError::NotFound`)**, and a SQL-safety note where `AssertSqlSafe` is used.
- **TS:** JSDoc `/** */` on every exported fn + interface. State: purpose,
  `@param`, `@returns`, thrown errors, and which Rust command it maps to.

## 7. Redundancy Findings & Docs Update

### 7.1 Findings artifact

A **findings inventory** (long-file list + boilerplate repetition map + proposed
utilities) is produced and saved alongside this spec
(`docs/superpowers/specs/2026-07-09-ops-commands-tables-findings.md`). It is the
evidence base for the docs update and for later cleanup.

### 7.2 Docs to update (all confirmed present)

| Doc | Update |
| --- | --- |
| `docs/02-BACKEND/06-commands-reference.md` | Regenerate command surface from `commands/*.rs`, grouped by domain, with signature + purpose |
| `docs/01-ARCHITECTURE/03-data-model.md` | Table inventory from `schema.sql` + note `db/common.rs` helpers and `db/tables/**` layout |
| `docs/05-DEVELOPMENT/05-reuse-patterns.md` | Document the new shared DB utilities (canonical "reusable patterns" home) |
| `docs/02-BACKEND/10-error-system.md` | Document standardized `NotFound` handling via `fetch_or_not_found` |

## 8. Verification & Safety

- **Pure refactor** — SQL semantics and command signatures unchanged; comments +
  restructure only. No behavior change.
- **Rust:** `cargo test` (including inline table tests) green after each domain.
- **TS:** project typecheck + `*.test.ts` suites green. The re-export shim
  guarantees importers are unaffected.

## 9. Rollout (Layer-by-Layer)

### Phase R — Rust
- **R0:** Build + unit-test `db/common.rs` helpers.
- **R1..Rn:** Migrate + annotate table modules and `commands/*.rs` per domain, in
  order: `core → crm → comms → campaigns → calendar → tasks → workflows →
  deliverability → security → ai → compliance → vault`.
- **R-verify:** `cargo test` green.

### Phase T — TS
- **T0:** Build `invoke/command.ts` + per-domain modules; turn `db-invoke.ts` into
  the re-export shim.
- **T1..Tn:** Annotate `features/*/db/*.ts` + `shared/services/db/*.ts`.
- **T-verify:** typecheck + test suites green.

### Phase D — Docs
- Update the 4 docs (§7.2) + write the findings inventory (§7.1). Run at the end of
  each layer.

## 10. Out of Scope

- Changing SQL semantics, schemas, or command signatures.
- Migrating existing importers from `@shared/services/db/db-invoke` to the new
  per-domain modules (the shim makes this unnecessary; optional future cleanup).
- Refactoring `imap/`, `smtp/`, `pgp/`, `sync_engine/`, `migrations/`.
- New features or performance work beyond removing redundancy.
