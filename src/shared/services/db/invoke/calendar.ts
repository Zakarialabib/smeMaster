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
