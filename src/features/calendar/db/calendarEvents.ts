import {
  listCalendarEvents,
  getCalendarEventById as dbGetCalendarEventById,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent as dbDeleteCalendarEvent,
} from "../../../shared/services/db/db-invoke";
import type { CalendarEvent } from "../../../shared/services/db/db-invoke";

export type DbCalendarEvent = CalendarEvent;

export async function upsertCalendarEvent(event: {
  companyId: string;
  googleEventId: string;
  summary: string | null;
  description: string | null;
  location: string | null;
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  status: string;
  organizerEmail: string | null;
  attendeesJson: string | null;
  htmlLink: string | null;
  calendarId?: string | null;
  remoteEventId?: string | null;
  etag?: string | null;
  icalData?: string | null;
  uid?: string | null;
}): Promise<void> {
  await createCalendarEvent({
    companyId: event.companyId ?? null,
    calendarId: event.calendarId ?? null,
    googleEventId: event.googleEventId,
    remoteEventId: event.remoteEventId ?? null,
    summary: event.summary,
    description: event.description,
    location: event.location,
    startTime: event.startTime,
    endTime: event.endTime,
    isAllDay: event.isAllDay,
    status: event.status,
    organizerEmail: event.organizerEmail,
    attendeesJson: event.attendeesJson,
    htmlLink: event.htmlLink,
    etag: event.etag ?? null,
    icalData: event.icalData ?? null,
    uid: event.uid ?? null,
  });
}

export async function getCalendarEventsInRange(
  companyId: string,
  startTime: number,
  endTime: number,
): Promise<CalendarEvent[]> {
  return listCalendarEvents(companyId, null, startTime, endTime);
}

export async function getCalendarEventsInRangeMulti(
  companyId: string,
  calendarIds: string[],
  startTime: number,
  endTime: number,
): Promise<CalendarEvent[]> {
  if (calendarIds.length === 0) {
    return getCalendarEventsInRange(companyId, startTime, endTime);
  }
  const all = await listCalendarEvents(companyId, null, startTime, endTime);
  return all.filter(
    (evt) => evt.calendar_id === null || calendarIds.includes(evt.calendar_id),
  );
}

export async function deleteEventsForCalendar(
  companyId: string,
  calendarId: string,
): Promise<void> {
  const events = await listCalendarEvents(companyId, calendarId);
  await Promise.all(events.map((evt) => dbDeleteCalendarEvent(evt.id)));
}

export async function getEventByRemoteId(
  companyId: string,
  calendarId: string,
  remoteEventId: string,
): Promise<CalendarEvent | null> {
  const events = await listCalendarEvents(companyId, calendarId);
  const found = events.find((evt) => evt.remote_event_id === remoteEventId);
  return found ?? null;
}

export async function deleteEventByRemoteId(
  companyId: string,
  calendarId: string,
  remoteEventId: string,
): Promise<void> {
  const events = await listCalendarEvents(companyId, calendarId);
  const target = events.find((evt) => evt.remote_event_id === remoteEventId);
  if (target) {
    await dbDeleteCalendarEvent(target.id);
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  await dbDeleteCalendarEvent(eventId);
}

export async function getCalendarEventById(eventId: string): Promise<CalendarEvent | null> {
  try {
    return await dbGetCalendarEventById(eventId);
  } catch {
    return null;
  }
}

export async function updateCalendarEventFields(
  eventId: string,
  fields: Parameters<typeof updateCalendarEvent>[1],
): Promise<void> {
  await updateCalendarEvent(eventId, fields);
}
