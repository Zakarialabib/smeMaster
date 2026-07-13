# Production Hardening Plan — Editor/Templates+DnD, Shows/Schedule, Calendar

Scope: take three feature areas from "works in demo" to "production-correct" by
perfecting each across the three layers in order: **DB → Rust → React**.

Areas:
- A. Editor + Email Templates + Drag-and-Drop
- B. Shows / Schedule (scheduled emails, campaign scheduling, publishing)
- C. Calendar (events, calendars, CalDAV sync)

Ground-truth gaps found (verified against code, not guessed):

## A. TEMPLATES + EDITOR + DnD
DB (`002_mail.sql` `templates`, `template_categories`):
- `templates` has NO `updated_at` (only `created_at`) → can't show "modified".
- `category_id` has NO FK to `template_categories` and is not validated → orphan categories.
- No unique per-company slug/name → duplicate templates; no `version` column (no versioning/diff).
- No index on `(company_id, is_favorite)` / `sort_order`; reorder is single-row `update_fields`.
- `template_categories` lacks `UNIQUE(company_id, name)` → duplicate categories.
- Opaque JSON columns (`conditional_blocks_json`, `delivery_config_json`, `ai_config_json`,
  `voice_config_json`) have zero validation.

Rust (`src-tauri/src/db/tables/comms/templates.rs`, `template_categories.rs`):
- `create` does NOT validate `category_id` belongs to the same company.
- No `updated_at` maintained on update.
- No atomic bulk reorder; no soft-delete; no duplicate-name guard.
- `conditional_blocks_json` etc. accepted as-is (no schema check).

React (`src/shared/components/editor`, `src/features/mail/components/templates`,
`src/features/mail/services/templates`):
- Determine DnD library + whether reorder persists to backend, drop-outside handling,
  mobile/touch, a11y, empty-state. (Subagent React report pending.)

## B. SHOWS / SCHEDULE
DB (`002_mail.sql` `scheduled_emails`):
- No `sent_at`, `attempts`, `last_error` → can't audit/retry.
- No index on `(status, scheduled_at)` → dispatcher scan is full-table.
- No `cancelled` state, no idempotency key → double-send risk.
- `to_addresses` is a raw string (no parse/validation).
- `status` default `'pending'` but no state machine enforced.

Rust (`src-tauri/src/db/tables/comms/scheduled_emails.rs`, `commands/comms.rs`):
- **NO background dispatcher.** `list_pending_all` is only called from a command
  (`core.rs:926`); `background/mod.rs` runs only mail + CalDAV sync. => scheduled
  emails are NEVER auto-sent by the backend. This is the #1 "to prod" gap.

React (`src/features/mail`, schedule UI):
- Scheduling UI exists (send-later) but relies on frontend triggering; no
  server-side guarantee, no conflict/timezone display, no "failed" surfacing.

## C. CALENDAR
DB (`009_calendar.sql` `calendar_events`, `calendars`):
- `calendar_events.google_event_id` + `UNIQUE(company_id, google_event_id)` hard-couples
  to Google; `calendars.provider` defaults `'google'`. CalDAV/Outlook can't coexist cleanly.
- No `rrule` / recurrence column, no `recurrence_id` (exceptions), no `timezone`.
- Attendees stored as `attendees_json` blob (no `event_attendees` table, no per-attendee
  RSVP/status).
- No `event_reminders` table; no `is_recurring` flag; no index on
  `(calendar_id, start_time)`.

Rust (`src-tauri/src/db/calendar/operations.rs`, `commands/calendar.rs`,
`background/caldav_sync.rs`):
- Recurrence: confirm whether RRULE is expanded or stored raw (UI can't show
  "every Tue" if raw). Likely stored raw / not expanded.
- CalDAV sync correctness, etag/ctag handling, error recovery, pagination.
- No attendee/reminder CRUD; no timezone normalization.

React (`src/features/calendar`):
- Views: month/week/day/agenda? recurrence editor UI? drag-to-reschedule?
  timezone display? `CalendarReauthBanner` flow? (Subagent React report pending.)

---

# EXECUTION ORDER

## PHASE 1 — DB (migrations, safe additive)
New file `024_hardening.sql` (register in `migrations/mod.rs` MIGRATIONS array):
- templates: ADD `updated_at`; index `(company_id, is_favorite)`, `(company_id, sort_order)`;
  `template_categories`: ADD `UNIQUE(company_id, name)`.
- scheduled_emails: ADD `sent_at`, `attempts` (DEFAULT 0), `last_error`; index
  `(status, scheduled_at)`; consider `cancelled` state in status CHECK.
- calendar_events: ADD `rrule`, `timezone`, `is_recurring`, `recurrence_id`;
  index `(calendar_id, start_time)`; NEW `event_attendees` table; NEW `event_reminders` table.
- calendars: ADD `timezone`; relax `google_event_id` uniqueness to a generic
  `remote_event_id` + provider (backfill/migration note).
(FK for category_id can't be added via ALTER in SQLite → enforce in Rust Phase 2.)

## PHASE 2 — RUST
- Templates: validate category belongs to company; maintain `updated_at`; bulk reorder;
  unique-name guard; validate JSON config shapes.
- Scheduled emails: **add background dispatcher** (tokio interval in `background/mod.rs`)
  that picks `(status='pending' AND scheduled_at<=now)`, sends via mail path, sets
  `sent_at`/`attempts`/`last_error`, retries with backoff, marks failed. Emit `AppEvent`.
- Calendar: expand RRULE for queries (or store expansions); attendee/reminder CRUD;
  timezone normalization; CalDAV recurrence round-trip.
- Add `#[cfg(test)]` coverage for each.

## PHASE 3 — REACT
- Editor/DnD: confirm + harden drag-drop (persist reorder, drop-outside, touch, a11y,
  empty-state); template editor wires `updated_at`/category validation.
- Schedule UI: surface dispatcher state (queued/sent/failed), timezone picker, conflict
  warnings, cancel.
- Calendar: complete views (week/day), recurrence editor, drag-reschedule, attendee/
  reminder management, timezone display, reauth flow.

Phases are independent per area but always DB→Rust→React within each. Begin PHASE 1 now.

---

# Refined findings (subagent recon, 2026-07-13)

## A. TEMPLATES + EDITOR + DnD (more detail)
- `TemplateGallery` reorder is NOT persisted (no `reorder` fn in Rust) — DnD is
  cosmetic only. FIXED: added `reorder()` (024 schema has `sort_order`).
- `update_fields` built SET clause by `format!`-interpolating caller keys into the
  column position (only VALUES were bound) — column-identifier injection. Mitigated
  with `AssertSqlSafe` before, which does NOT validate identifiers. FIXED: allowlist
  `ALLOWED_TEMPLATE_FIELDS` + reject unknown keys with `AppDbError::Validation`.
- `DndProvider` (`components/dnd/DndProvider.tsx`) is threads-only — template gallery
  uses a different/simpler DnD path; unify in Phase 3.

## B. SHOWS / SCHEDULE (spans 4 domains, not one)
- `scheduled_emails`: still no backend dispatcher (orphaned). #1 gap.
- **`campaigns` has NO `scheduled_at` column** — schedule mode (immediate/scheduled/
  recurring) is captured in the UI but NEVER persisted (`crm.rs` ignores it). NEEDS
  DB column + Rust persist (add to a follow-up migration).
- `backup_schedules`: `next_run_at` set to `now` on update, never computed from
  `cron_expression` — cron never evaluated.
- `calendar_events` publish uses rrule/timezone cols added in 024.

## C. CALENDAR
- CalDAV sync "won't run" (hand-rolled iCal parser issues; RRULE dropped, TZID
  mis-parsed at `operations.rs:73,115-117`).
- `EventCreateModal` has no repeat field; `CalendarPage:276` placeholder `toAddresses`.
- Recurrence/reminders/attendees editing absent end-to-end (DB now has the tables).

# Progress
- Phase 1 DB: DONE (migration 024, committed `90129df`).
- Phase 2 Rust (in progress): templates `update_fields` allowlist + `updated_at`
  maintenance in `update`/`create`, category-ownership validation in `create`,
  `reorder()` fn + tests. Next: scheduled_emails dispatcher, campaigns.scheduled_at,
  calendar recurrence/attendees/reminders CRUD.
