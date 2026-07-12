# Commands Reference

> Current guide to the Tauri command surface, where commands are registered, and how frontend code should consume them.

## Scope

This page is intentionally not a frozen dump of hundreds of commands.

It covers:

- where command registration lives
- how the command surface is organized by domain
- how frontend code should call commands today
- what to update when adding or changing commands

For detailed user-facing behavior, use the feature docs. For exact signatures, use the code.

## Current Registration Model

The backend command surface has a **single source of truth**: one `generate_handler!` macro inside `commands::register()` in `src-tauri/src/commands/mod.rs`. Because Tauri v2 only keeps the **last** `invoke_handler(...)` call, every `#[tauri::command]` must be listed there — subsystem modules' own `register()` calls are now no-op pass-throughs (they do not independently register handlers). To add a command: add the `#[tauri::command]` fn in its domain module, then add `module_name::fn_name` to that macro.

You should think about the command surface in layers:

1. domain commands under `src-tauri/src/commands/<domain>.rs`
2. DB-operation commands whose logic lives in `src-tauri/src/db/tables/<domain>/<table>.rs` and is exposed by the command layer
3. plugin-provided capabilities from Tauri plugins

## Domain Ownership

The active domain split is roughly:

- `core` for shared account and foundational data operations
- `contacts` for CRM/contact behavior
- `crm` for campaign-related backend flows
- `tasks` for task operations
- `calendar` for calendar operations
- `workflows` for automation and related workflow operations
- `invoicing` for billing/ERP (invoices, clients, catalog, categories, company settings, document generation, send)
- `pos` for point-of-sale (sales, thermal printing, cash drawer, barcode scanning)
- `db` for generic database/admin helpers
- other specialized modules for IMAP, SMTP, compliance, deliverability, security, and supporting services

The exact command count changes over time, so this doc should describe ownership and patterns rather than trying to stay a hand-maintained registry of every command.

### Backend module layout

- `src-tauri/src/commands/<domain>.rs` — `#[tauri::command]` handlers (the IPC boundary), all registered in the single `generate_handler!` in `commands/mod.rs`. Main DB-domain modules: `core`, `crm`, `comms`, `campaigns`, `calendar`, `tasks`, `workflows`, `deliverability`, `security`, `ai`, `compliance`, `mail`, `vault`, `invoicing` (33 commands), `pos` (36 commands) (plus `db` for admin helpers).
- `src-tauri/src/db/tables/<domain>/<table>.rs` — per-table CRUD/query ops; every `pub fn`/`pub struct` carries `///` docs.
- `src-tauri/src/db/common.rs` — shared CRUD helpers (`fetch_or_not_found`, `delete_or_not_found`, `count_rows`, `build_sort_clause`, `apply_field_updates`, `like_pattern`).
- `src-tauri/src/db/error.rs` — `AppDbError` (incl. `NotFound`); converted to `SerializedError` at the boundary.

## Frontend Consumption

Frontend code uses a layered, typed command access model:

- **Generic app commands** — `src/shared/services/commands.ts` for non-DB app commands.
- **Database commands** — `src/shared/services/db/invoke/` is the source of truth. It holds one module per domain (`core.ts`, `crm.ts`, `comms.ts`, `campaigns.ts`, `calendar.ts`, `tasks.ts`, `workflows.ts`, `deliverability.ts`, `security.ts`, `ai.ts`, `compliance.ts`, `mail.ts`, `vault.ts`, `rag.ts`), each exporting typed `async` wrappers built on the shared `invokeCommand<T>()` helper in `invoke/command.ts`.
- **Backwards-compatible shim** — `src/shared/services/db/db-invoke.ts` is now a thin `export *` re-export of the `invoke/` modules. All ~379 `db_*` / `ai_*` wrappers (plus interfaces and `schema` re-exports) remain importable from `@shared/services/db/db-invoke`, so existing importers are unchanged.
- **Direct `invoke()`** — a few specialized service modules still call `invoke()` from `@shared/services/ipc` directly (e.g. `liveQueries.ts`, `emailActions.ts`, `campaignRecipients.ts`). These duplicate commands that already have typed wrappers and are being consolidated back into the `invoke/` layer (see `../05-DEVELOPMENT/05-reuse-patterns.md`).

The important rule is consistency inside a subsystem:

- prefer the typed `invoke/` wrapper when one exists for the command
- add or extend a domain wrapper in `invoke/<domain>.ts` (using `invokeCommand<T>()`) rather than writing a raw `invoke()` call
- keep request/response naming aligned with the Rust boundary contract (`camelCase` args in, snake_case / serde-mapped structs out)

## Naming And Data Rules

Important conventions:

- command names are exact string boundaries
- frontend request objects prefer `camelCase`
- Rust DTOs use serde mapping where needed to keep frontend ergonomics without losing Rust naming clarity
- dynamic update maps and DB-column names often remain `snake_case`

This is especially important for command-heavy DB and mail flows.

## Where To Look First

When debugging a command:

1. find the frontend caller
2. check whether it goes through `commands.ts`, `db-invoke.ts`, or direct `invoke()`
3. find the matching Rust registration in `src-tauri/src/commands/mod.rs`
4. trace into the owning command module
5. trace further into the DB/service layer if needed

## When Adding A Command

Use this checklist:

1. add the Rust command in the owning backend module
2. register it in the correct command registration path
3. add or update the frontend wrapper in the established subsystem
4. keep request/response naming consistent across the boundary
5. update relevant feature docs if behavior changes user-facing workflows

## Invoicing Domain (33 Commands)

The invoicing module (`src-tauri/src/commands/invoicing.rs`) exposes 33 Tauri IPC commands across 7 entity groups:

| Group                | Commands                                                                                                                                                                                                                                                                                  | Description                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Invoices**         | `db_list_invoices`, `db_get_invoice`, `db_get_invoice_with_items`, `db_create_invoice`, `db_update_invoice`, `db_delete_invoice`, `db_add_invoice_item`, `db_remove_invoice_item`, `db_update_invoice_status`, `db_calculate_invoice`, `db_generate_invoice_documents`, `db_send_invoice` | Full lifecycle: create with items in a transaction, update with optional item replacement, soft-delete, status workflow, PDF/PEPPOL generation, SMTP+PGP dispatch |
| **Clients**          | `db_list_clients`, `db_get_client`, `db_create_client`, `db_update_client`, `db_delete_client`                                                                                                                                                                                            | CRUD with soft/hard delete support                                                                                                                                |
| **Catalog Items**    | `db_list_items`, `db_get_item`, `db_create_item`, `db_update_item`, `db_delete_item`, `db_list_low_stock`                                                                                                                                                                                 | Product/service catalog with stock alerts                                                                                                                         |
| **Company Settings** | `db_get_company_settings`, `db_upsert_company_settings`, `db_delete_company_settings`                                                                                                                                                                                                     | Per-company defaults (currency, tax, numbering, template, logo, bank, terms)                                                                                      |
| **Categories**       | `db_list_categories`, `db_get_category`, `db_create_category`, `db_update_category`, `db_delete_category`                                                                                                                                                                                 | Invoice category grouping                                                                                                                                         |
| **Company**          | `db_get_company`, `db_update_company`                                                                                                                                                                                                                                                     | Company profile incl. ICE/IF/RC/CNSS legal identifiers                                                                                                            |

## POS Domain (36 Commands)

The POS module (`src-tauri/src/commands/pos.rs`) covers point-of-sale operations: sale CRUD, ESC/POS thermal printing, system printer fallback, cash drawer control (`pos_open_cash_drawer`), and barcode scanning.

## Related Docs

- `../01-ARCHITECTURE/02-backend-structure.md`
- `../03-FRONTEND/11-typed-ipc.md`
- `../01-ARCHITECTURE/03-data-model.md`
- `../05-DEVELOPMENT/05-reuse-patterns.md`
- `10-error-system.md`
