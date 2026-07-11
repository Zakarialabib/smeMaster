export type {
  Calendar as DbCalendar,
} from "../../shared/services/db/db-invoke";

export type {
  CalendarEvent as DbCalendarEvent,
} from "../../shared/services/db/db-invoke";

export { useSyncStatus } from "./hooks/useSyncStatus";

export {
  upsertCalendar,
  getVisibleCalendars,
  updateCalendarSyncToken,
  getCalendarById,
} from "./db/calendars";

export {
  upsertCalendarEvent,
  deleteEventByRemoteId,
  deleteCalendarEvent,
} from "./db/calendarEvents";
