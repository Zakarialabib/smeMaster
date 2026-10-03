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

### 2026-09-28: `bge-small-en-v1.5` hard-coded as the ml-sidecar default (4 Rust sites)

- **File**: `src-tauri/crates/ml-sidecar/src/main.rs` (lines 575, 747, 754), `src-tauri/src/ai/models.rs` (line 37, `get_bge_small`)
- **Severity**: WARNING
- **Issue**: The sidecar's default `repo_id` and the downloader's model are hard-coded to `BAAI/bge-small-en-v1.5` (384-dim, **English-only**). Two sidecar sites are fallbacks that report the model name to the caller, so a swapped model would be **misreported**, not merely unconfigurable — line 747 uses `resources.loaded_repo_id` while line 754 returns the constant, so the two status paths can disagree. Same defect class as the frontend entry of the same date.
- **Plan**: make the repo id a startup parameter/config with the current value as the default, and report the **loaded** `repo_id` in all three sidecar status sites (line 754 should read `loaded_repo_id`, not a constant).
- **Found during**: grill of `docs/voice/**` (`RAG-FORK.md` call-site inventory). Deferred by decision 2026-09-28 — pre-existing, not voice-agent scope. Frontend half: `docs/03-FRONTEND/13-deprecations.md`.

### 2026-09-30: CalDAV: incremental sync + discovery gaps

- **File**: `src-tauri/src/calendar/drivers/caldav.rs` (45–58 REPORT body, 62 `parse_ical_events`, 200 `etag: None`, 315 `list_calendars`, 355–360 `fetch_events` ignores `start`/`end`, 444/489/524 write URLs), `src-tauri/src/db/calendar/operations.rs` (182 fake `sync_token`), `src-tauri/src/background/caldav_sync.rs` (137 `start_caldav_background_sync`), `src-tauri/src/orchestrator/services.rs` (113 `SyncService::start`)
- **Severity**: WARNING
- **Issue**: The production `CalDavDriver` is registered (`calendar/drivers/mod.rs:40`) and its persistence blockers were fixed in this session (see "Found during"), but six gaps remain on the read/write path:
  1. **ETag never parsed/populated** — the calendar-query REPORT asks for `<D:getetag/>` (`caldav.rs:50`), but `parse_ical_events` (`caldav.rs:62`) only reads the embedded VEVENT text, so `CalendarEvent.etag` stays `None` (`caldav.rs:200`) and the `calendar_events.etag` column is never written → no change detection.
  2. **No incremental sync** — every tick does a full-collection REPORT; `sync_token` is a fake `caldav-{unix-ts}` value (`operations.rs:182`), not a server-issued token, and `<sync-collection>` (RFC 4791 §7.4) / ctag (`getctag`) are never used → O(collection) traffic each run.
  3. **No PROPFIND collection discovery** — `list_calendars` (`caldav.rs:315`) reads the local `calendars` table only; there is no remote `PROPFIND`/`principal`/`calendar-home-set` discovery, so new remote calendars never appear without manual creation.
  4. **iCalendar parsing gaps** — no RFC 5545 line unfolding (continuation lines beginning with SP/HTAB are dropped), property parameters are not stripped (`DTSTART;TZID=America/New_York:…` never matches the `DTSTART` arm → `start_time = 0`), `RRULE` is discarded (no recurrence expansion), and each event's `ical_data` stores the entire multistatus XML response rather than its own VEVENT.
  5. **Wrong write URL construction** — `create_event` builds `{base}/{calendar_id}.ics` (`caldav.rs:444`), `update_event` builds `{base}{calendar_id}{event_id}.ics` (`caldav.rs:489`, missing path separators), `delete_event` builds `{base}/{event_id}` (`caldav.rs:524`, drops the collection path). Correct CalDAV resource URL is `{collection_url}/{uid}.ics`.
  6. **Background loop never auto-started** — `start_caldav_background_sync` (`caldav_sync.rs:137`) has no TS caller (`src/` grep: zero matches) and the orchestrator's `SyncService::start` (`orchestrator/services.rs:113`) only schedules mail `BackgroundSync`, so CalDAV sync runs only if something explicitly invokes the command.
- **Plan**: (a) parse multistatus responses with `quick-xml` (or a hand-rolled `<response>` splitter): capture `href` + `getetag` per component, persist `etag`, and skip unchanged events; (b) implement `<sync-collection>` using `calendars.sync_token`/`ctag` as the token store, falling back to full REPORT on `403`/`410`; (c) add `PROPFIND Depth:1` discovery on `calendar-home-set` to insert missing `calendars` rows; (d) unfold lines + split property params on `;` before value extraction, persist per-VEVENT raw text, add `RRULE` passthrough (schema already has `calendar_events.rrule/timezone`, migration 024); (e) rewrite write URLs as `{collection}/{uid}.ics` (resolve `collection` from `calendars.remote_id` when the caller passes a local calendar id); (f) auto-start `CaldavSync` from `SyncService::start` when any `provider='caldav'` calendar exists (or add a frontend caller) — decision needed on default-on vs opt-in.
- **Found during**: CalDAV audit (2026-09-30). Session fixed the persistence blockers that prevented _any_ event from being stored: `operations.rs` used a non-existent `account_id` column on `calendars`/`calendar_events` (schema has `company_id`, 009_calendar.sql), resolved accounts by `accounts.id` using a company id (different id spaces — now resolved via `accounts.company_id`, 001_core.sql:34), inserted the remote collection path into `calendar_events.calendar_id` (FK → `calendars.id` violation), and left `google_event_id` empty (`UNIQUE(company_id, google_event_id)` collision on the 2nd event); `caldav.rs::list_calendars` had the same `account_id` column bug. Related: `docs/PRODUCTION_HARDENING_PLAN.md` §CalDAV. NOTE: the cfg(test) tests in `operations.rs` were rewritten to be hermetic (schema-correct inserts, no live HTTP) but **were not executed** — `cargo test` is a host hazard (STATUS_ENTRYPOINT_NOT_FOUND); verify with `cargo test --lib db::calendar::operations` on a working host.

### 2026-10-02: aws-sdk-* dead weight via lancedb 0.6.0 (transitive, not ours)

- **File**: `src-tauri/Cargo.toml` (line 91 `lancedb`), chain in `src-tauri/Cargo.lock` (`lancedb → lance → aws-sdk-dynamodb → aws-runtime`; `lance-io → aws-config`), consumers `src-tauri/src/ai/{vector_db,indexer,rag}.rs`, `src/commands/ai.rs`, `src/orchestrator/services.rs`
- **Severity**: INFO
- **Issue**: `Cargo.toml` declares **zero** aws crates, yet `aws-sdk-*`/`aws-smithy-*` compile because lancedb-0.6.0 hardcodes `lance = { version = "=0.13.0", features = ["dynamodb"] }` (our `default-features = false` cannot opt out; `lance-io` hardwires non-optional `aws-config`/`aws-credential-types`). No AWS code exists in `src/` — compile-time dead weight only (measured: `libaws_sdk_dynamodb.rlib` ≈ 150 MB, `liblance.rlib` ≈ 270 MB, plus build time). Same class: `moxcms` via `docx-rs → image`. Upstream lancedb fixed this in 0.40-beta (`dynamodb = ["lance/dynamodb", "aws"]` opt-in, `default = []`); newest published = 0.39.0.
- **Plan**: **A (accepted now)** carry the weight and note it. **B** upgrade lancedb to ≥0.37–0.39 — separate migration task (API churn), revisit opportunistically. **C (recommended direction)** migrate all local inference to the `ml-sidecar` process and drop candle/lancedb from the main crate — removes aws/lance/arrow in one move and matches the on-demand engine strategy (weights are already downloaded on demand; the engine itself is compiled in twice: in-process under `local-ai` and as the sidecar binary).
- **Found during**: full direct-dep audit — 78/80 direct deps used; `rust_decimal` was the only unused direct dep and was **removed** the same day (`cargo check` 0 errors/0 warnings).

---
