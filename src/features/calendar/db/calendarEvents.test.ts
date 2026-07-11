import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CalendarEvent } from "../../../shared/services/db/db-invoke";
import {
  upsertCalendarEvent,
  getCalendarEventsInRange,
  getCalendarEventsInRangeMulti,
  deleteEventsForCalendar,
  getEventByRemoteId,
  deleteEventByRemoteId,
  deleteCalendarEvent,
} from "./calendarEvents";

const mockListCalendarEvents = vi.fn<[string, string | null, number | null, number | null], Promise<CalendarEvent[]>>();
const mockCreateCalendarEvent = vi.fn<[Record<string, unknown>], Promise<CalendarEvent>>();
const mockUpdateCalendarEvent = vi.fn<[string, Record<string, unknown>], Promise<void>>();
const mockDeleteCalendarEvent = vi.fn<[string], Promise<void>>();

vi.mock("../../../shared/services/db/db-invoke", () => ({
  listCalendarEvents: (...args: Parameters<typeof mockListCalendarEvents>) => mockListCalendarEvents(...args),
  createCalendarEvent: (...args: Parameters<typeof mockCreateCalendarEvent>) => mockCreateCalendarEvent(...args),
  updateCalendarEvent: (...args: Parameters<typeof mockUpdateCalendarEvent>) => mockUpdateCalendarEvent(...args),
  deleteCalendarEvent: (...args: Parameters<typeof mockDeleteCalendarEvent>) => mockDeleteCalendarEvent(...args),
}));

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "evt-1",
  account_id: "acc-1",
  calendar_id: null,
  google_event_id: "gev-1",
  remote_event_id: null,
  summary: "Team standup",
  description: "Daily sync",
  location: "Room A",
  start_time: 1000,
  end_time: 2000,
  is_all_day: 0,
  status: "confirmed",
  organizer_email: "org@example.com",
  attendees_json: null,
  html_link: "https://calendar.google.com/event/1",
  etag: null,
  ical_data: null,
  uid: null,
  updated_at: 999,
  ...overrides,
});

describe("calendarEvents service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("upsertCalendarEvent", () => {
    it("creates event with all fields including CalDAV fields", async () => {
      mockCreateCalendarEvent.mockResolvedValueOnce(makeEvent({ id: "generated-id" }));

      await upsertCalendarEvent({
        companyId: "acc-1",
        googleEventId: "gev-1",
        summary: "Team standup",
        description: "Daily sync",
        location: "Room A",
        startTime: 1000,
        endTime: 2000,
        isAllDay: false,
        status: "confirmed",
        organizerEmail: "org@example.com",
        attendeesJson: '[{"email":"a@b.com"}]',
        htmlLink: "https://calendar.google.com/event/1",
        calendarId: "cal-1",
        remoteEventId: "remote-1",
        etag: '"etag-abc"',
        icalData: "BEGIN:VEVENT\nEND:VEVENT",
        uid: "uid-123@example.com",
      });

      expect(mockCreateCalendarEvent).toHaveBeenCalledTimes(1);
      expect(mockCreateCalendarEvent).toHaveBeenCalledWith({
        companyId: "acc-1",
        calendarId: "cal-1",
        googleEventId: "gev-1",
        remoteEventId: "remote-1",
        summary: "Team standup",
        description: "Daily sync",
        location: "Room A",
        startTime: 1000,
        endTime: 2000,
        isAllDay: false,
        status: "confirmed",
        organizerEmail: "org@example.com",
        attendeesJson: '[{"email":"a@b.com"}]',
        htmlLink: "https://calendar.google.com/event/1",
        etag: '"etag-abc"',
        icalData: "BEGIN:VEVENT\nEND:VEVENT",
        uid: "uid-123@example.com",
      });
    });

    it("converts isAllDay true", async () => {
      mockCreateCalendarEvent.mockResolvedValueOnce(makeEvent());

      await upsertCalendarEvent({
        companyId: "acc-1",
        googleEventId: "gev-2",
        summary: null,
        description: null,
        location: null,
        startTime: 1000,
        endTime: 2000,
        isAllDay: true,
        status: "confirmed",
        organizerEmail: null,
        attendeesJson: null,
        htmlLink: null,
      });

      expect(mockCreateCalendarEvent).toHaveBeenCalledWith(
        expect.objectContaining({ isAllDay: true }),
      );
    });

    it("defaults optional CalDAV fields to null", async () => {
      mockCreateCalendarEvent.mockResolvedValueOnce(makeEvent());

      await upsertCalendarEvent({
        companyId: "acc-1",
        googleEventId: "gev-3",
        summary: null,
        description: null,
        location: null,
        startTime: 1000,
        endTime: 2000,
        isAllDay: false,
        status: "confirmed",
        organizerEmail: null,
        attendeesJson: null,
        htmlLink: null,
      });

      expect(mockCreateCalendarEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: null,
          remoteEventId: null,
          etag: null,
          icalData: null,
          uid: null,
        }),
      );
    });
  });

  describe("getCalendarEventsInRange", () => {
    it("returns events within the given time range", async () => {
      const events = [makeEvent(), makeEvent({ id: "evt-2", start_time: 1500 })];
      mockListCalendarEvents.mockResolvedValueOnce(events);

      const result = await getCalendarEventsInRange("acc-1", 500, 2500);

      expect(result).toEqual(events);
      expect(mockListCalendarEvents).toHaveBeenCalledWith("acc-1", null, 500, 2500);
    });

    it("returns empty array when no events match", async () => {
      mockListCalendarEvents.mockResolvedValueOnce([]);

      const result = await getCalendarEventsInRange("acc-1", 5000, 6000);

      expect(result).toEqual([]);
    });
  });

  describe("getCalendarEventsInRangeMulti", () => {
    it("filters by calendar IDs and includes null calendar_id events", async () => {
      const allEvents = [
        makeEvent({ calendar_id: "cal-1" }),
        makeEvent({ id: "evt-2", calendar_id: null }),
        makeEvent({ id: "evt-3", calendar_id: "cal-3" }),
      ];
      mockListCalendarEvents.mockResolvedValueOnce(allEvents);

      const result = await getCalendarEventsInRangeMulti("acc-1", ["cal-1", "cal-2"], 500, 2500);

      expect(result).toHaveLength(2);
      expect(result[0].calendar_id).toBe("cal-1");
      expect(result[1].calendar_id).toBeNull();
      expect(mockListCalendarEvents).toHaveBeenCalledWith("acc-1", null, 500, 2500);
    });

    it("falls back to simple range query when calendarIds is empty", async () => {
      const events = [makeEvent()];
      mockListCalendarEvents.mockResolvedValueOnce(events);

      const result = await getCalendarEventsInRangeMulti("acc-1", [], 500, 2500);

      expect(result).toEqual(events);
      expect(mockListCalendarEvents).toHaveBeenCalledWith("acc-1", null, 500, 2500);
    });
  });

  describe("deleteEventsForCalendar", () => {
    it("removes all events for a given calendar_id", async () => {
      const events = [
        makeEvent({ id: "evt-1", calendar_id: "cal-1" }),
        makeEvent({ id: "evt-2", calendar_id: "cal-1" }),
      ];
      mockListCalendarEvents.mockResolvedValueOnce(events);

      await deleteEventsForCalendar("acc-1", "cal-1");

      expect(mockListCalendarEvents).toHaveBeenCalledWith("acc-1", "cal-1");
      expect(mockDeleteCalendarEvent).toHaveBeenCalledTimes(2);
      expect(mockDeleteCalendarEvent).toHaveBeenCalledWith("evt-1");
      expect(mockDeleteCalendarEvent).toHaveBeenCalledWith("evt-2");
    });
  });

  describe("getEventByRemoteId", () => {
    it("returns event matching calendar_id and remote_event_id", async () => {
      const events = [
        makeEvent({ calendar_id: "cal-1", remote_event_id: "remote-1" }),
        makeEvent({ id: "evt-2", calendar_id: "cal-1", remote_event_id: "remote-2" }),
      ];
      mockListCalendarEvents.mockResolvedValueOnce(events);

      const result = await getEventByRemoteId("acc-1", "cal-1", "remote-1");

      expect(result).toEqual(events[0]);
      expect(mockListCalendarEvents).toHaveBeenCalledWith("acc-1", "cal-1");
    });

    it("returns null when no event matches", async () => {
      mockListCalendarEvents.mockResolvedValueOnce([]);

      const result = await getEventByRemoteId("acc-1", "cal-1", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("deleteEventByRemoteId", () => {
    it("removes event matching calendar_id and remote_event_id", async () => {
      const events = [
        makeEvent({ id: "evt-1", calendar_id: "cal-1", remote_event_id: "remote-1" }),
      ];
      mockListCalendarEvents.mockResolvedValueOnce(events);

      await deleteEventByRemoteId("acc-1", "cal-1", "remote-1");

      expect(mockListCalendarEvents).toHaveBeenCalledWith("acc-1", "cal-1");
      expect(mockDeleteCalendarEvent).toHaveBeenCalledWith("evt-1");
    });
  });

  describe("deleteCalendarEvent", () => {
    it("removes event by id", async () => {
      await deleteCalendarEvent("evt-1");

      expect(mockDeleteCalendarEvent).toHaveBeenCalledWith("evt-1");
    });
  });
});
