# Data Model

> Current source of truth for SMEMaster persistence: SQLite, Rust-owned schema, additive repairs, and domain-based tables.

## Scope

This page replaces the older split between "data model", "schema design", and "graph connections".

It covers:

- where schema ownership lives
- how schema updates and repairs run
- the active table domains
- the consolidation patterns that matter for contributors

## Ownership

The database is owned by the Rust backend.

Primary locations:

- `src-tauri/src/db/`
- `src-tauri/src/db/migrations/`
- `src-tauri/src/db/tables/`

Frontend code mirrors the data model through typed IPC and TypeScript interfaces, but it does not own schema evolution.

Related frontend locations:

- `src/shared/services/db/schema.ts`
- `src/shared/services/db/migrations.ts` as compatibility glue
- `src/shared/services/db/db-invoke.ts`

### Rust DB module layout

The Rust side is organized as:

- `src-tauri/src/db/tables/<domain>/<table>.rs` — one module per table owning its CRUD + query ops, each `pub fn`/`pub struct` carrying `///` docs (purpose, params, returns, `AppDbError::NotFound` cases, and `AssertSqlSafe` notes where dynamic SQL is built).
- `src-tauri/src/db/common.rs` — shared CRUD/query helpers reused across table modules: `fetch_or_not_found`, `delete_or_not_found`, `count_rows`, `build_sort_clause`, `apply_field_updates`, `like_pattern` (see `../05-DEVELOPMENT/05-reuse-patterns.md`).
- `src-tauri/src/db/error.rs` — `AppDbError` (incl. `NotFound`), converted to `SerializedError` at the command boundary (see `10-error-system.md`).
- `src-tauri/src/db/commands.rs` — shared DTOs such as `UpdateFields` (dynamic partial-update payload).
- `src-tauri/src/db/migrations/` — schema definition + idempotent repair.
- `src-tauri/src/commands/<domain>.rs` — `#[tauri::command]` handlers exposing DB ops to the frontend; all registered in the single `generate_handler!` in `src-tauri/src/commands/mod.rs`.

## Core Rules

The current data model follows a few practical rules:

1. Rust owns schema and migrations.
2. New installs get the current schema directly.
3. Existing installs receive additive fixes and targeted repair steps.
4. Destructive cleanup stays explicit and gated.
5. Frontend code consumes records through typed commands, not handwritten SQL.

## Migration Model

Schema upkeep is not a long linear chain of fragile frontend migrations.

The current model is:

1. apply current schema definitions
2. detect missing columns or required repair steps
3. run one-time fixups where needed
4. keep deprecated tables until explicit cleanup says they can be removed

That means the system prefers idempotent repair and compatibility over risky destructive migration-by-default behavior.

## Domain Layout

The active schema is organized by domain rather than one flat table list.

### Core

- accounts
- labels
- threads
- messages
- attachments
- folder sync state
- settings
- full-text search tables where applicable

### CRM

- contacts
- groups
- tags
- contact segments
- engagement log
- contact files
- `entity_pivots`
- legacy compatibility tables that still exist until cleanup

### Communications

- filter rules and conditions
- quick replies
- templates
- signatures
- aliases
- drafts
- scheduled email support tables

### Campaigns

- campaigns
- campaign recipients
- UTM-related tracking tables
- campaign-adjacent schedules or supporting data where still active

### Calendar

- calendars
- calendar events

### Tasks

- tasks
- task tags

### Automation And Operations

- workflow rules
- follow-up reminders
- pending operations
- cleanup-related tables where applicable

### Security And Compliance

- PGP keys
- allowlists
- compliance profiles
- compliance checks

### AI And Deliverability

- AI cache and AI config
- deliverability config and events
- remaining deliverability support tables, including compatibility tables not yet dropped

## Consolidation Patterns

A few schema patterns matter more than raw table counts.

### Generic pivots

`entity_pivots` is the important relationship pattern for cross-domain links. It replaces older one-off pivot behavior and supports connected records across contacts, mail, campaigns, tasks, and related entities.

### Typed config tables

Several areas use a discriminator-style table instead of many tiny tables. This keeps the schema flatter and easier to evolve while still allowing typed behavior in Rust and TypeScript.

### Explicit compatibility paths

Some older tables still exist because cleanup is opt-in or because compatibility remains useful during migration windows. Docs should describe those as compatibility paths, not as the preferred current model.

## Practical Guidance

When changing data behavior:

- start in `src-tauri/src/db/`
- update the relevant command layer
- update TypeScript mirrors only after Rust shape is settled
- avoid documenting deprecated tables as first-class features

## Related Docs

- `01-overview.md` for architecture
- `02-backend-structure.md` for Rust module layout
- `../02-BACKEND/06-commands-reference.md` for command-surface guidance
- feature docs under `../04-FEATURES/` for user-facing behavior
