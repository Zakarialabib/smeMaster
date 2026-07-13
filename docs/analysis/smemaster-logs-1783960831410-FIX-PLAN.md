# SMEMaster Log Fix Plan

> Based on 100 errors in `smemaster-logs-1783960831410.txt`
> Generated: 2026-07-13

## Overview

| Priority | Issue                                               | Occurrences | Category              |
| -------- | --------------------------------------------------- | ----------- | --------------------- |
| **P0**   | `no such column: account_id`                        | 46          | Schema/Query mismatch |
| **P0**   | `no such column: deleted_at`                        | 10          | Schema/Query mismatch |
| **P0**   | `FOREIGN KEY constraint failed` (tasks + workflows) | 6           | Data integrity        |
| **P1**   | `no such column: contact_type`                      | 2           | Schema/Query mismatch |
| **P1**   | `no such column: m.to_address`                      | 2           | Column name mismatch  |
| **P1**   | `Model not loaded` (ai_query_rag)                   | 5           | Startup init          |
| **P1**   | `Command not found: db_list_import_history`         | 1           | Registration          |
| **P1**   | `no such column: sent_count`                        | 2           | Wrong table queried   |
| **P2**   | `state not managed for field dataCache`             | 1           | State registration    |

---

## P0 — `no such column: account_id` (46 errors)

### Error A: `db_upsert_pending_operation` (6 of 46)

**Query** (workflows.rs:494):

```sql
INSERT INTO pending_operations (id, account_id, operation_type, ...)
```

**Schema** (008_workflows.sql:25-39): `pending_operations` table has `company_id`, NOT `account_id`.
**Fix**: Change `account_id` → `company_id` in the INSERT column list AND delete operations below that reference `account_id`.

**Files to modify:**

- `src/commands/workflows.rs` lines 438, 463, 494 — change `account_id` → `company_id`

### Error B: `db_execute_search_query` (40 of 46)

**Source**: The frontend sends dynamic SQL that references `account_id` on tables that don't have it (e.g. pending_operations, etc.).
**Fix**: The frontend search query builder needs to use `company_id` instead of `account_id` for tables that belong to companies vs accounts. This requires finding the frontend search dialog code.

**Files to investigate:**

- Search the frontend for `account_id` in SQL query strings

---

## P0 — `no such column: deleted_at` (10 errors)

**Error**: `db_list_clients` fails
**Query** (clients.rs:20,31):

```sql
SELECT * FROM contacts WHERE deleted_at IS NULL AND ...
```

**Schema** (003_contacts.sql:2-17): `contacts` table has NO `deleted_at` column.

**Fix (Option A — Add column)**: Create migration `027_contacts_add_deleted_at.sql`

```sql
ALTER TABLE contacts ADD COLUMN deleted_at INTEGER;
```

And update `clients.rs` to filter properly.

**Fix (Option B — Remove filter)**: Remove `deleted_at IS NULL` from the clients query since the contacts table doesn't support soft-delete yet.

**Recommended**: Option A (add column) for consistency with invoices.

---

## P0 — `FOREIGN KEY constraint failed` (6 errors)

### Error A: `db_create_task` (3 errors)

**Cause**: The `company_id` passed to task creation doesn't exist in the `companies` table. This happens when creating tasks through the automation workflow action handler — it uses an `account_id` (from the message's account context) instead of a `company_id`.

**Files to investigate:**

- `src/events/automation.rs` — the `create_task` action handler
- `src/commands/tasks.rs` line 214 — `company_id` is `Option<String>` but passes empty

**Fix**: In the automation `create_task` action handler, resolve the `account_id` to its `company_id` before inserting.

### Error B: `db_upsert_workflow_rule` (3 errors)

**Cause**: The `company_id` passed to workflow rule insert doesn't exist in the `companies` table. The frontend selects an accountId, not a companyId.

**Files to investigate:**

- Frontend `AutomationPage.tsx` — passes `activeAccountId` as `companyId`
- Backend `workflows.rs` — the UPDATE query at line 159 also references `account_id` instead of `company_id`

**Fix**: Ensure the frontend passes a valid `company_id` (not an `account_id`). Also fix the UPDATE query column name.

---

## P1 — `no such column: contact_type` (2 errors)

**Error**: `db_execute_search_query` referencing `contact_type`
**Query**: Dynamic SQL sent from frontend uses `contact_type` on the `contacts` table.
**Schema**: `contacts` table has no `contact_type` column.

**Fix**: Add `contact_type` column to contacts via migration, or fix the frontend search query.

---

## P1 — `no such column: m.to_address` (2 errors)

**Error**: `db_get_recent_threads_with_contact`
**Query** (contacts.rs:1154):

```sql
SELECT t.id, t.subject, MAX(m.internal_date) as last_msg
FROM threads t
JOIN messages m ON m.thread_id = t.id AND m.account_id = t.account_id
WHERE (m.from_address = ?1 OR m.to_address LIKE ?2)
```

**Schema (002_mail.sql)**: Need to verify `messages` table columns. The column is likely named `to_address` without the table alias prefix.

**Fix**: If `messages.to_address` exists, the issue might be that the table alias `m.to_address` doesn't work with some SQLite versions. Try without the prefix. If the column doesn't exist at all, check the messages migration for the correct column name.

---

## P1 — `Model not loaded` (5 errors)

**Error**: `ai_query_rag` fails
**Source**: The AI/RAG model isn't loaded at startup.

**Files to investigate:**

- `src/ai/` module initialization
- Orchestrator init or AI service setup

**Fix**: Ensure the model is downloaded/loaded before the AI query command can be invoked. This could be a missing model file or a configuration issue.

---

## P1 — `Command not found: db_list_import_history` (1 error)

**Source**: The Rust command `db_list_import_history` is not registered.
**Files to fix**:

- `src/commands/import_export.rs` or wherever the command is defined — add the function
- `src/commands/mod.rs` — register the command in the `invoke_handler` macro

---

## P1 — `no such column: sent_count` (2 errors)

**Error**: `db_dashboard_campaigns_open_rate`
**Query** (crm.rs:141):

```sql
SELECT COALESCE(SUM(sent_count), 0), COUNT(*) FROM campaign_recipients WHERE opened_at IS NOT NULL
```

**Schema**: `campaign_recipients` table does NOT have `sent_count`. The `campaigns` table does (migration 004:9).

**Fix**: Change the query to join with `campaigns` table or use `COALESCE(SUM(c.sent_count), 0)` from the campaigns table, counting recipients that opened.

---

## P2 — `state not managed for field dataCache` (1 error)

**Error**: `db_health_stats` fails
**Source**: The `DataCacheService` state isn't registered with Tauri's `.manage()`.

**Investigation**: It IS registered in `orchestrator/init.rs:282` via `handle.manage(data_cache_service)`. If the orchestrator doesn't initialize (e.g., headless mode), the state won't be available.

**Fix**: Move the `handle.manage(data_cache_service)` call to the main app setup in `lib.rs` so it's always registered, regardless of orchestrator state.

---

## Execution Order

```
Phase 1 — Rust column name fixes (P0):
  1. Fix `account_id` → `company_id` in workflows.rs (INSERT, UPDATE, DELETE, UPDATE)
  2. Create migration 027 for contacts: `deleted_at` + `contact_type`
  3. Fix `sent_count` query in crm.rs
  4. Fix `m.to_address` query in contacts.rs

Phase 2 — Registration fixes (P1):
  5. Register `db_list_import_history` in mod.rs
  6. Move `data_cache` state manage to lib.rs

Phase 3 — Data integrity fixes (P0):
  7. Fix automation create_task action handler — use company_id not account_id
  8. Fix frontend search queries to use correct column names

Phase 4 — Startup fixes (P1):
  9. Fix AI model loading at startup

Phase 5 — Verify:
  10. Run `cargo check` to verify Rust compilation
  11. Run `npx tsc --noEmit` to verify frontend
  12. Run `cargo test` to verify tests pass
```

## Current Progress

- [ ] Phase 1: 4 fixes
- [ ] Phase 2: 2 fixes
- [ ] Phase 3: 2 fixes
- [ ] Phase 4: 1 fix
- [ ] Phase 5: Verification
