import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@shared/services/db/invoke/command", () => ({
  invokeCommand: vi.fn(),
}));

import { invokeCommand } from "@shared/services/db/invoke/command";
import {
  addRecipient,
  addRecipientsBulk,
  getRecipients,
  getRecipientStats,
  updateRecipientStatus,
  updateRecipientOpen,
  updateRecipientClick,
  getEngagementTimeSeries,
  removeRecipient,
} from "./campaignRecipients";

const mockInvoke = vi.mocked(invokeCommand);

describe("campaignRecipients service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addRecipient", () => {
    it("calls db_add_campaign_recipient with campaignId and contactId", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await addRecipient("camp-1", "contact-1");

      expect(mockInvoke).toHaveBeenCalledWith("db_add_campaign_recipient", {
        campaignId: "camp-1",
        contactId: "contact-1",
      });
    });
  });

  describe("addRecipientsBulk", () => {
    it("calls db_add_campaign_recipients_bulk with array of contactIds", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await addRecipientsBulk("camp-1", ["c1", "c2", "c3"]);

      expect(mockInvoke).toHaveBeenCalledWith("db_add_campaign_recipients_bulk", {
        campaignId: "camp-1",
        contactIds: ["c1", "c2", "c3"],
      });
    });

    it("handles empty array", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await addRecipientsBulk("camp-1", []);

      expect(mockInvoke).toHaveBeenCalledWith("db_add_campaign_recipients_bulk", {
        campaignId: "camp-1",
        contactIds: [],
      });
    });
  });

  describe("getRecipients", () => {
    it("calls db_list_campaign_recipients and returns result", async () => {
      const recipients = [{ id: "r1", campaign_id: "camp-1" }];
      mockInvoke.mockResolvedValue(recipients);

      const result = await getRecipients("camp-1");

      expect(result).toEqual(recipients);
      expect(mockInvoke).toHaveBeenCalledWith("db_list_campaign_recipients", {
        campaignId: "camp-1",
      });
    });
  });

  describe("getRecipientStats", () => {
    it("calls db_get_campaign_stats_by_status and maps grouped rows to RecipientStats", async () => {
      const rows = [
        { status: "sent", count: 90 },
        { status: "opened", count: 50 },
        { status: "clicked", count: 30 },
        { status: "bounced", count: 5 },
      ];
      mockInvoke.mockResolvedValue(rows);

      const result = await getRecipientStats("camp-1");

      expect(result).toEqual({ total: 175, sent: 90, opened: 50, clicked: 30, bounced: 5 });
      expect(mockInvoke).toHaveBeenCalledWith("db_get_campaign_stats_by_status", {
        campaignId: "camp-1",
      });
    });
  });

  describe("updateRecipientStatus", () => {
    it("calls db_update_campaign_recipient_status with all params", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await updateRecipientStatus("camp-1", "contact-1", "sent");

      expect(mockInvoke).toHaveBeenCalledWith("db_update_campaign_recipient_status", {
        campaignId: "camp-1",
        contactId: "contact-1",
        status: "sent",
      });
    });
  });

  describe("updateRecipientOpen", () => {
    it("calls db_update_campaign_recipient_open with openedAt timestamp", async () => {
      mockInvoke.mockResolvedValue(undefined);
      const before = Math.floor(Date.now() / 1000);

      await updateRecipientOpen("camp-1", "contact-1");

      const call = mockInvoke.mock.calls[0];
      expect(call[0]).toBe("db_update_campaign_recipient_open");
      expect(call[1]).toEqual({
        campaignId: "camp-1",
        contactId: "contact-1",
        openedAt: expect.any(Number),
      });
      expect((call[1] as Record<string, unknown>).openedAt).toBeGreaterThanOrEqual(before);
      expect((call[1] as Record<string, unknown>).openedAt).toBeLessThanOrEqual(before + 2);
    });
  });

  describe("updateRecipientClick", () => {
    it("calls db_update_campaign_recipient_click with clickedAt timestamp", async () => {
      mockInvoke.mockResolvedValue(undefined);
      const before = Math.floor(Date.now() / 1000);

      await updateRecipientClick("camp-1", "contact-1");

      const call = mockInvoke.mock.calls[0];
      expect(call[0]).toBe("db_update_campaign_recipient_click");
      expect(call[1]).toEqual({
        campaignId: "camp-1",
        contactId: "contact-1",
        clickedAt: expect.any(Number),
      });
      expect((call[1] as Record<string, unknown>).clickedAt).toBeGreaterThanOrEqual(before);
      expect((call[1] as Record<string, unknown>).clickedAt).toBeLessThanOrEqual(before + 2);
    });
  });

  describe("getEngagementTimeSeries", () => {
    it("calls db_get_campaign_engagement_time_series", async () => {
      const data = [{ date: "2024-01-01", opens: 10, clicks: 5 }];
      mockInvoke.mockResolvedValue(data);

      const result = await getEngagementTimeSeries("camp-1");

      expect(result).toEqual(data);
      expect(mockInvoke).toHaveBeenCalledWith("db_get_campaign_engagement_time_series", {
        campaignId: "camp-1",
      });
    });
  });

  describe("removeRecipient", () => {
    it("calls db_remove_campaign_recipient with campaignId and contactId", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await removeRecipient("camp-1", "contact-1");

      expect(mockInvoke).toHaveBeenCalledWith("db_remove_campaign_recipient", {
        campaignId: "camp-1",
        contactId: "contact-1",
      });
    });
  });
});
