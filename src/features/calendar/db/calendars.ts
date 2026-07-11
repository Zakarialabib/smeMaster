import {
  listCalendars,
  getCalendarById as dbGetCalendarById,
  createCalendar,
  updateCalendar,
  deleteCalendar,
} from "../../../shared/services/db/db-invoke";
import type { Calendar } from "../../../shared/services/db/db-invoke";

export type DbCalendar = Calendar;

export async function upsertCalendar(calendar: {
  companyId: string;
  provider: string;
  remoteId: string;
  displayName: string | null;
  color: string | null;
  isPrimary: boolean;
}): Promise<string> {
  const created = await createCalendar({
    companyId: calendar.companyId,
    provider: calendar.provider,
    remoteId: calendar.remoteId,
    displayName: calendar.displayName,
    color: calendar.color,
    isPrimary: calendar.isPrimary,
  });
  return created.id;
}

export async function getCalendarsForAccount(companyId: string): Promise<Calendar[]> {
  return listCalendars(companyId);
}

export async function getVisibleCalendars(companyId: string): Promise<Calendar[]> {
  const all = await listCalendars(companyId);
  return all.filter((c) => c.is_visible === 1);
}

export async function setCalendarVisibility(calendarId: string, visible: boolean): Promise<void> {
  await updateCalendar(calendarId, { isVisible: visible });
}

export async function updateCalendarSyncToken(
  calendarId: string,
  syncToken: string | null,
  ctag?: string | null,
): Promise<void> {
  await updateCalendar(calendarId, {
    syncToken: syncToken,
    ctag: ctag ?? null,
  });
}

export async function deleteCalendarsForAccount(companyId: string): Promise<void> {
  const calendars = await listCalendars(companyId);
  await Promise.all(
    calendars.map((cal) => deleteCalendar(cal.id)),
  );
}

export async function getCalendarById(calendarId: string): Promise<Calendar | null> {
  try {
    return await dbGetCalendarById(calendarId);
  } catch {
    return null;
  }
}
