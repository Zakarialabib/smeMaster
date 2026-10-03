# Calendar

> **Status:** Production (Google + CalDAV). ETag incremental sync and background-loop auto-start still open — see Phase 7.3.
> **Stack:** React 19 + Rust (`calendar/drivers/`) + SQLite

## Overview

Calendar handles events across Google Calendar and CalDAV providers. Multiple views (week, month, day, agenda), event CRUD, sync status, and re-auth banners.

## Architecture

```
CalendarPage.tsx → providerFactory.ts → googleCalendarProvider / caldavProvider
  → invokeCommand("db_*") → Rust (calendar/drivers/mod.rs)
  → SQLite (calendars, calendar_events tables)
```

The production `CalDavDriver` is registered (`calendar/drivers/mod.rs:40`) with REPORT/PUT/DELETE/PROPFIND. Sync persistence blockers were fixed 2026-09-30.

## Core Capabilities

| Area                | What it does                                  | Key files                                                                   |
| ------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| **Views**           | Week, month, day, agenda                      | `components/WeekView.tsx`, `MonthView.tsx`, `DayView.tsx`, `AgendaView.tsx` |
| **Event CRUD**      | Create modal, detail modal/sheet, event cards | `components/EventCreateModal.tsx`, `EventDetailModal.tsx`, `EventCard.tsx`  |
| **Calendar list**   | Multi-calendar toggle + toolbar               | `components/CalendarList.tsx`, `CalendarToolbar.tsx`                        |
| **Google provider** | Google Calendar API + auto-discovery          | `services/googleCalendarProvider.ts`, `services/autoDiscovery.ts`           |
| **CalDAV provider** | REPORT/PUT/DELETE/PROPFIND                    | `services/caldavProvider.ts` + Rust `calendar/drivers/`                     |
| **Sync status**     | Per-calendar sync state + re-auth banner      | `hooks/useSyncStatus.ts`, `components/CalendarReauthBanner.tsx`             |
| **Snooze presets**  | Snooze-to-calendar integration                | `db/snoozePresets.ts`                                                       |
| **iCal helpers**    | Import/export helpers                         | `services/icalHelper.ts`                                                    |

## Providers

| Provider            | Status        | Sync                                                                                          |
| ------------------- | ------------- | --------------------------------------------------------------------------------------------- |
| **Google Calendar** | ✅ Production | Incremental (ETag)                                                                            |
| **CalDAV**          | 🔶 Partial    | REPORT/PUT/DELETE/PROPFIND done; ETag incremental + PROPFIND discovery + loop auto-start open |

See `02-BACKEND/12-diagnostics.md` for the 7.3 gap detail.

## Key Files

| Layer       | Path                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| Components  | `src/features/calendar/components/` (views, modals, toolbar, list)      |
| Services    | `src/features/calendar/services/` (providers, factory, iCal, discovery) |
| DB wrappers | `src/features/calendar/db/` (calendars, calendarEvents, snoozePresets)  |
| Rust        | `src-tauri/src/calendar/drivers/` (CalDAV driver)                       |

## Related Docs

- [Tasks](08-tasks.md) — tasks surface in calendar views
- [Accounts](04-accounts.md) — CalDAV account setup
- [Backend diagnostics](../02-BACKEND/12-diagnostics.md) — 7.3 gaps
