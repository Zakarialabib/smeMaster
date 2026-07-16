# Backend / Types — Diagnostics & Technical Debt

> Auto-target of the `document-debt` postTask hook and the `/debt-doc backend` command.
> Append new entries (newest at bottom) using the format in [`.trae/commands/debt-doc.md`](../../.trae/commands/debt-doc.md).

## Format

### YYYY-MM-DD: [Brief Title]

- **File**: `src-tauri/src/...` (line N)
- **Severity**: WARNING / INFO
- **Issue**: What is wrong, broken, or deprecated
- **Plan**: How to fix it in the future
- **Found during**: Context of how this was discovered

---

## Entries

### 2026-07-16: Automation passes `activeAccountId` as `company_id` (FK 787)

- **File**: `src/features/automation/pages/AutomationPage.tsx` (loadRules / upsertWorkflowRule), `src/features/automation/stores/automationStore.ts`
- **Severity**: HIGH (functional — "workflow not working")
- **Issue**: The automation feature calls `loadRules(activeAccountId)` and `upsertWorkflowRule({ companyId: activeAccountId })`. `workflow_rules.company_id` is a FK → `companies(id)`, but `activeAccountId` is an **account** id, not a company id. This caused `db_upsert_workflow_rule` to fail with `FOREIGN KEY constraint failed (code: 787)` and `loadRules` to return nothing (wrong company scope).
- **Plan**: Use the canonical `ACTIVE_COMPANY_ID` (`"demo-company-1"`, from `@shared/constants/company`) — consistent with invoicing/CRM/deals which already use it. Fixed in AutomationPage.tsx.
- **Found during**: terminal.md IPC error log review.

### 2026-07-16: Stale dev DB → "no such column" on valid queries

- **File**: runtime SQLite (not a code bug); evidence in `src-tauri/src/db/migrations/*.sql` (028 adds `attachments.account_id`, 002 defines `messages.thread_id`)
- **Severity**: HIGH (functional — search categories + invoice/deals empty)
- **Issue**: IPC errors `db_execute_search_query: no such column: account_id` and `db_get_threads_for_category: no such column: t.thread_id` indicate the running app DB predates migrations (missing columns that DO exist in current migrations). Also `demo-company-1` (the company row every company-scoped feature depends on) was missing → invoice/deals returned empty and workflow FK failed.
- **Plan**: These are DB-state issues, not source bugs. Remediate by forcing a fresh migrate+seed: invoke the Rust command `db_reset_and_reseed` (drops all tables, re-runs migrations, re-seeds `demo-company-1`). Or delete the app's SQLite file to trigger a fresh `run_migrations` + `seed_all` on next launch.
- **Found during**: terminal.md IPC error log review.

### 2026-07-16: System Health dashboard wired to real `db_status_snapshot` (remaining gaps)

- **File**: `src/features/sync/components/HealthDashboard.tsx`, `src/features/sync/stores/healthStore.ts` (line 131), `src/shared/services/commands.ts` (line 766), `src/shared/services/ipc/CommandRegistry.ts` (line 161)
- **Severity**: INFO
- **Issue**: The System Health dashboard now reads live orchestrator subsystem statuses from the real `db_status_snapshot` IPC command (returns `DbStatusSnapshot`), replacing the previous mock data. Two gaps were identified: (1) no public `restart_subsystem` IPC command; (2) contacts tag/group/segment filtering needed a backend join command (`db_filter_contacts`).
- **Resolution (2026-07-16)**: Both gaps are now CLOSED. `db_restart_subsystem` was added (delegates to `SubsystemRegistry::restart_subsystem` — real force_shutdown + class-appropriate re-activation, returns the entry's `SubsystemStatusSnapshot`); the HealthDashboard restart control now calls it. `db_filter_contacts` was added in Rust with conditional INNER JOINs on `entity_pivots` / `contact_group_pivot` and segment SQL-query member intersection; `ContactsPage` now calls `filterContacts()` for real backend narrowing.
- **Found during**: audit of frontend/backend wiring against actual source (verified `db_status_snapshot` exists; `restart_subsystem` and `db_filter_contacts` had no Rust definitions at audit time).
