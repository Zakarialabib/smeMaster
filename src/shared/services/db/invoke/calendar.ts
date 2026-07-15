import { invokeCommand } from './command';

import type { Calendar, CalendarEvent, SnoozePreset } from '../schema';

import type {
  CreateCalendarEventRequest,
  CreateCalendarRequest,
  CreateSnoozePresetRequest,
  UpdateCalendarEventRequest,
  UpdateCalendarRequest,
} from './core';

export async function listCalendars(companyId: string): Promise<Calendar[]> {
  return invokeCommand<Calendar[]>('db_list_calendars', { companyId });
}

export async function listCalendarEvents(
  companyId: string,
  calendarId?: string | null,
  startTime?: number | null,
  endTime?: number | null,
): Promise<CalendarEvent[]> {
  return invokeCommand<CalendarEvent[]>('db_list_calendar_events', {
    companyId,
    calendarId: calendarId ?? null,
    startTime: startTime ?? null,
    endTime: endTime ?? null,
  });
}

export async function getCalendarById(id: string): Promise<Calendar> {
  return invokeCommand<Calendar>('db_get_calendar_by_id', { id });
}

export async function createCalendar(calendar: CreateCalendarRequest): Promise<Calendar> {
  return invokeCommand<Calendar>('db_create_calendar', { calendar });
}

export async function updateCalendar(id: string, fields: UpdateCalendarRequest): Promise<void> {
  return invokeCommand<void>('db_update_calendar', { id, fields });
}

export async function deleteCalendar(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_calendar', { id });
}

export async function getCalendarEventById(id: string): Promise<CalendarEvent> {
  return invokeCommand<CalendarEvent>('db_get_calendar_event_by_id', { id });
}

export async function createCalendarEvent(
  event: CreateCalendarEventRequest,
): Promise<CalendarEvent> {
  return invokeCommand<CalendarEvent>('db_create_calendar_event', { event });
}

export async function updateCalendarEvent(
  id: string,
  fields: UpdateCalendarEventRequest,
): Promise<void> {
  return invokeCommand<void>('db_update_calendar_event', { id, fields });
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_calendar_event', { id });
}

export async function listSnoozePresets(companyId: string): Promise<SnoozePreset[]> {
  return invokeCommand<SnoozePreset[]>('db_list_snooze_presets', { companyId });
}

export async function createSnoozePreset(preset: CreateSnoozePresetRequest): Promise<SnoozePreset> {
  return invokeCommand<SnoozePreset>('db_create_snooze_preset', { preset });
}

export async function deleteSnoozePreset(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_snooze_preset', { id });
}

// ── CalendarDriver (provider-abstracted) wrappers ────────────────────────────
//
// These dispatch to the account's configured calendar driver (CalDAV today;
// Google Calendar / Microsoft Graph in Phase 2). They are used by the calendar
// settings UI to list remote calendars, test connectivity, and create/update/
// delete events on the remote provider.

// `provider_type` returns a short string (e.g. "caldav") identifying the
// driver's protocol.
export async function calendarProviderType(calendarId: string): Promise<string> {
  return invokeCommand<string>('db_calendar_provider_type', { calendarId });
}

// `list_calendars` returns the full set of calendars visible to the account,
// joined with the local `calendars` table to attach our local row id.
export async function listRemoteCalendars(accountId: string): Promise<Calendar[]> {
  return invokeCommand<Calendar[]>('db_calendar_list_calendars', { accountId });
}

// `test_connection` verifies auth + reachability with the provider.
export async function testCalendarConnection(accountId: string): Promise<void> {
  return invokeCommand<void>('db_calendar_test_connection', { accountId });
}

// `create_event` posts the event to the remote provider. The returned string
// is the provider's event id (we also persist a `CalendarEvent` locally).
export async function createRemoteCalendarEvent(
  accountId: string,
  calendarId: string,
  event: CalendarEvent,
): Promise<string> {
  return invokeCommand<string>('db_calendar_create_event', { accountId, calendarId, event });
}

// `update_event` mirrors `create_event` for an existing remote event.
export async function updateRemoteCalendarEvent(
  accountId: string,
  eventId: string,
  event: CalendarEvent,
): Promise<void> {
  return invokeCommand<void>('db_calendar_update_event', { accountId, eventId, event });
}

// `delete_event` removes the event from the remote provider. The local row
// should be deleted by the caller in the same flow.
export async function deleteRemoteCalendarEvent(
  accountId: string,
  eventId: string,
): Promise<void> {
  return invokeCommand<void>('db_calendar_delete_event', { accountId, eventId });
}
