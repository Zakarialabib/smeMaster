# Calendar

> Calendar views, calendar data workflows, and provider-backed event surfaces.

## Scope

The calendar feature covers:

- calendar pages and views
- event-oriented CRUD flows
- provider-backed calendar integrations
- calendar-specific settings touchpoints

This page should describe current calendar support without over-claiming unsupported providers or borrowing unrelated settings subsystems.

## Current Ownership

Primary frontend ownership lives in:

- `src/features/calendar/`

Representative files:

- `src/features/calendar/components/CalendarPage.tsx`
- `src/features/calendar/index.ts`
- `src/features/calendar/services/providerFactory.ts`
- `src/features/calendar/services/types.ts`

Calendar-related settings and account tie-ins also appear in:

- `src/features/settings/components/tabs/CalendarTab.tsx`
- `src/features/settings/components/tabs/AccountsTab.tsx`

Backend ownership includes:

- `src-tauri/src/commands/calendar.rs`
- `src-tauri/src/db/calendar/`

## Provider Status

Current provider reality should be documented as:

| Provider | Status | Notes |
| --- | --- | --- |
| Google API / Google-backed calendar flow | Supported | Current provider type uses `google_api`. |
| CalDAV | Supported | Dedicated calendar provider path exists. |
| Microsoft Graph calendar | Not documented here as active support unless code proves it | Avoid overstating provider support. |

## What It Does

### Calendar views

The calendar feature gives users event-oriented calendar views and navigation through the dedicated calendar page and related view components.

### Event workflows

Users can work with event data through the calendar feature and connected provider/data layers.

### Provider-backed sync

Calendar behavior depends on provider-backed integration logic and account-linked configuration, but provider lifecycle details should remain consistent with `04-accounts.md`.

## Boundaries

Keep these responsibilities separate:

- account/provider setup belongs to `04-accounts.md`
- snooze preset settings that belong to other product surfaces should not be described here unless they are truly calendar-owned
- tasks and task agenda behavior belong to `08-tasks.md`

## Key Files

| Area | Files |
| --- | --- |
| Main page | `src/features/calendar/components/CalendarPage.tsx` |
| Feature root | `src/features/calendar/index.ts` |
| Provider layer | `src/features/calendar/services/providerFactory.ts`, `types.ts` |
| Settings tie-ins | `src/features/settings/components/tabs/CalendarTab.tsx`, `AccountsTab.tsx` |
| Route | `src/router/routeTree.tsx` |
| Backend commands | `src-tauri/src/commands/calendar.rs` |
| Backend DB | `src-tauri/src/db/calendar/` |

## Update Rules

Update this page when:

- provider support changes materially
- event/view ownership changes
- calendar settings or account integration become significantly different
