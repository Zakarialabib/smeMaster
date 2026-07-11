import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Calendar } from "../../../shared/services/db/db-invoke";
import {
  upsertCalendar,
  getCalendarsForAccount,
  getVisibleCalendars,
  setCalendarVisibility,
  updateCalendarSyncToken,
  deleteCalendarsForAccount,
  getCalendarById,
} from "./calendars";

const mockListCalendars = vi.fn<[string], Promise<Calendar[]>>();
const mockGetCalendarById = vi.fn<[string], Promise<Calendar>>();
const mockCreateCalendar = vi.fn<[Record<string, unknown>], Promise<Calendar>>();
const mockUpdateCalendar = vi.fn<[string, Record<string, unknown>], Promise<void>>();
const mockDeleteCalendar = vi.fn<[string], Promise<void>>();

vi.mock("../../../shared/services/db/db-invoke", () => ({
  listCalendars: (...args: Parameters<typeof mockListCalendars>) => mockListCalendars(...args),
  getCalendarById: (...args: Parameters<typeof mockGetCalendarById>) => mockGetCalendarById(...args),
  createCalendar: (...args: Parameters<typeof mockCreateCalendar>) => mockCreateCalendar(...args),
  updateCalendar: (...args: Parameters<typeof mockUpdateCalendar>) => mockUpdateCalendar(...args),
  deleteCalendar: (...args: Parameters<typeof mockDeleteCalendar>) => mockDeleteCalendar(...args),
}));

function makeCal(overrides: Partial<Calendar> = {}): Calendar {
  return {
    id: "cal-default",
    account_id: "acc-1",
    provider: "google",
    remote_id: "remote-default",
    display_name: "Default Calendar",
    color: "#4285f4",
    is_primary: 0,
    is_visible: 1,
    sync_token: null,
    ctag: null,
    created_at: 1700000000,
    updated_at: 1700000000,
    ...overrides,
  };
}

describe("calendars service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("upsertCalendar", () => {
    it("creates a calendar and returns its id", async () => {
      mockCreateCalendar.mockResolvedValueOnce(makeCal({ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }));

      const id = await upsertCalendar({
        companyId: "acc-1",
        provider: "google",
        remoteId: "remote-cal-1",
        displayName: "My Calendar",
        color: "#4285f4",
        isPrimary: true,
      });

      expect(id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
      expect(mockCreateCalendar).toHaveBeenCalledWith({
        companyId: "acc-1",
        provider: "google",
        remoteId: "remote-cal-1",
        displayName: "My Calendar",
        color: "#4285f4",
        isPrimary: true,
      });
    });

    it("passes isPrimary false correctly", async () => {
      mockCreateCalendar.mockResolvedValueOnce(makeCal({ id: "existing-id-123", is_primary: 0 }));

      const id = await upsertCalendar({
        companyId: "acc-1",
        provider: "google",
        remoteId: "remote-cal-1",
        displayName: "Updated Name",
        color: "#0b8043",
        isPrimary: false,
      });

      expect(id).toBe("existing-id-123");
      expect(mockCreateCalendar).toHaveBeenCalledWith(
        expect.objectContaining({ isPrimary: false }),
      );
    });

    it("handles null displayName and color", async () => {
      mockCreateCalendar.mockResolvedValueOnce(makeCal({ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }));

      const id = await upsertCalendar({
        companyId: "acc-1",
        provider: "google",
        remoteId: "remote-cal-1",
        displayName: null,
        color: null,
        isPrimary: false,
      });

      expect(id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    });
  });

  describe("getCalendarsForAccount", () => {
    it("returns calendars for the given account", async () => {
      const calendars: Calendar[] = [
        makeCal({ id: "cal-1", account_id: "acc-1", is_primary: 1, display_name: "Primary" }),
        makeCal({ id: "cal-2", account_id: "acc-1", is_primary: 0, display_name: "Work" }),
      ];
      mockListCalendars.mockResolvedValueOnce(calendars);

      const result = await getCalendarsForAccount("acc-1");

      expect(result).toEqual(calendars);
      expect(mockListCalendars).toHaveBeenCalledWith("acc-1");
    });

    it("returns empty array when no calendars exist", async () => {
      mockListCalendars.mockResolvedValueOnce([]);

      const result = await getCalendarsForAccount("acc-none");

      expect(result).toEqual([]);
    });
  });

  describe("getVisibleCalendars", () => {
    it("only returns visible calendars", async () => {
      const visible = [makeCal({ id: "cal-1", is_visible: 1 })];
      const all = [
        ...visible,
        makeCal({ id: "cal-2", is_visible: 0 }),
      ];
      mockListCalendars.mockResolvedValueOnce(all);

      const result = await getVisibleCalendars("acc-1");

      expect(result).toEqual(visible);
      expect(mockListCalendars).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("setCalendarVisibility", () => {
    it("sets visibility to true", async () => {
      await setCalendarVisibility("cal-1", true);

      expect(mockUpdateCalendar).toHaveBeenCalledWith("cal-1", { isVisible: true });
    });

    it("sets visibility to false", async () => {
      await setCalendarVisibility("cal-1", false);

      expect(mockUpdateCalendar).toHaveBeenCalledWith("cal-1", { isVisible: false });
    });
  });

  describe("updateCalendarSyncToken", () => {
    it("updates sync_token and ctag", async () => {
      await updateCalendarSyncToken("cal-1", "sync-abc", "ctag-xyz");

      expect(mockUpdateCalendar).toHaveBeenCalledWith("cal-1", {
        syncToken: "sync-abc",
        ctag: "ctag-xyz",
      });
    });

    it("sets ctag to null when not provided", async () => {
      await updateCalendarSyncToken("cal-1", "sync-abc");

      expect(mockUpdateCalendar).toHaveBeenCalledWith("cal-1", {
        syncToken: "sync-abc",
        ctag: null,
      });
    });

    it("allows null sync_token", async () => {
      await updateCalendarSyncToken("cal-1", null, "ctag-xyz");

      expect(mockUpdateCalendar).toHaveBeenCalledWith("cal-1", {
        syncToken: null,
        ctag: "ctag-xyz",
      });
    });
  });

  describe("deleteCalendarsForAccount", () => {
    it("deletes all calendars for the given account", async () => {
      const calendars = [
        makeCal({ id: "cal-1" }),
        makeCal({ id: "cal-2" }),
      ];
      mockListCalendars.mockResolvedValueOnce(calendars);

      await deleteCalendarsForAccount("acc-1");

      expect(mockListCalendars).toHaveBeenCalledWith("acc-1");
      expect(mockDeleteCalendar).toHaveBeenCalledTimes(2);
      expect(mockDeleteCalendar).toHaveBeenCalledWith("cal-1");
      expect(mockDeleteCalendar).toHaveBeenCalledWith("cal-2");
    });
  });

  describe("getCalendarById", () => {
    it("returns the calendar when found", async () => {
      const cal = makeCal({ id: "cal-1" });
      mockGetCalendarById.mockResolvedValueOnce(cal);

      const result = await getCalendarById("cal-1");

      expect(result).toEqual(cal);
      expect(mockGetCalendarById).toHaveBeenCalledWith("cal-1");
    });

    it("returns null when calendar not found", async () => {
      mockGetCalendarById.mockRejectedValueOnce(new Error("not found"));

      const result = await getCalendarById("nonexistent");

      expect(result).toBeNull();
    });
  });
});
