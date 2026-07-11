import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCampaignsStore } from "@/stores/campaigns";

vi.mock("@shared/services/db/invoke/command", () => ({
  invokeCommand: vi.fn(),
}));

vi.mock("@shared/services/db/db-invoke", () => ({
  listCampaigns: vi.fn(),
}));

import { invokeCommand } from "@shared/services/db/invoke/command";
import { listCampaigns } from "@shared/services/db/db-invoke";

beforeEach(() => {
  useCampaignsStore.setState({
    campaigns: [],
    stats: {},
    isLoading: false,
    error: null,
  });
  vi.clearAllMocks();
});

describe("campaignStore", () => {
  describe("initial state", () => {
    it("should have correct defaults", () => {
      const state = useCampaignsStore.getState();
      expect(state.campaigns).toEqual([]);
      expect(state.stats).toEqual({});
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("loadCampaigns", () => {
    it("should load campaigns for an account", async () => {
      const mockCampaigns = [
        { id: "c1", name: "Campaign 1", accountId: "a1" },
        { id: "c2", name: "Campaign 2", accountId: "a1" },
      ];
      vi.mocked(listCampaigns).mockResolvedValue(mockCampaigns);

      await useCampaignsStore.getState().loadCampaigns("a1");

      expect(listCampaigns).toHaveBeenCalledWith("a1");
      expect(useCampaignsStore.getState().campaigns).toEqual(mockCampaigns);
      expect(useCampaignsStore.getState().isLoading).toBe(false);
    });

    it("should set loading state during fetch", async () => {
      let resolvePromise: (value: unknown[]) => void;
      const promise = new Promise<unknown[]>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(listCampaigns).mockReturnValue(promise as never);

      const loadPromise = useCampaignsStore.getState().loadCampaigns("a1");
      expect(useCampaignsStore.getState().isLoading).toBe(true);

      resolvePromise!([]);
      await loadPromise;
      expect(useCampaignsStore.getState().isLoading).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(listCampaigns).mockRejectedValue(new Error("Network error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useCampaignsStore.getState().loadCampaigns("a1");

      expect(useCampaignsStore.getState().isLoading).toBe(false);
      expect(useCampaignsStore.getState().error).toBe("Network error");
      consoleSpy.mockRestore();
    });
  });

  describe("loadStats", () => {
    it("should load stats for a campaign", async () => {
      const mockRows = [
        { status: "sent", count: 10 },
        { status: "opened", count: 5 },
        { status: "clicked", count: 2 },
        { status: "bounced", count: 1 },
      ];
      vi.mocked(invokeCommand).mockResolvedValue(mockRows);

      await useCampaignsStore.getState().loadStats("c1");

      expect(invokeCommand).toHaveBeenCalledWith("db_get_campaign_stats_by_status", { campaignId: "c1" });
      const stats = useCampaignsStore.getState().stats["c1"];
      expect(stats).toEqual({
        total: 18,
        sent: 10,
        opened: 5,
        clicked: 2,
        bounced: 1,
      });
    });

    it("should handle missing statuses", async () => {
      vi.mocked(invokeCommand).mockResolvedValue([{ status: "sent", count: 5 }]);

      await useCampaignsStore.getState().loadStats("c1");

      const stats = useCampaignsStore.getState().stats["c1"];
      expect(stats.total).toBe(5);
      expect(stats.sent).toBe(5);
      expect(stats.opened).toBe(0);
      expect(stats.clicked).toBe(0);
      expect(stats.bounced).toBe(0);
    });

    it("should handle empty results", async () => {
      vi.mocked(invokeCommand).mockResolvedValue([]);

      await useCampaignsStore.getState().loadStats("c1");

      const stats = useCampaignsStore.getState().stats["c1"];
      expect(stats.total).toBe(0);
      expect(stats.sent).toBe(0);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(invokeCommand).mockRejectedValue(new Error("Invoke error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useCampaignsStore.getState().loadStats("c1");

      expect(useCampaignsStore.getState().stats["c1"]).toBeUndefined();
      consoleSpy.mockRestore();
    });

    it("should store stats for multiple campaigns independently", async () => {
      vi.mocked(invokeCommand)
        .mockResolvedValueOnce([{ status: "sent", count: 10 }])
        .mockResolvedValueOnce([{ status: "sent", count: 20 }]);

      await useCampaignsStore.getState().loadStats("c1");
      await useCampaignsStore.getState().loadStats("c2");

      expect(useCampaignsStore.getState().stats["c1"].total).toBe(10);
      expect(useCampaignsStore.getState().stats["c2"].total).toBe(20);
    });
  });

  describe("createCampaign", () => {
    it("should create a campaign and prepend to list", async () => {
      const mockCreated = { id: "c-new", name: "New Campaign", company_id: "a1" };
      vi.mocked(invokeCommand).mockResolvedValue(mockCreated);

      const id = await useCampaignsStore.getState().createCampaign({
        companyId: "a1",
        name: "New Campaign",
      });

      expect(id).toBe("c-new");
      expect(useCampaignsStore.getState().campaigns).toHaveLength(1);
      expect(useCampaignsStore.getState().campaigns[0]).toEqual(mockCreated);
      expect(invokeCommand).toHaveBeenCalledWith("db_create_campaign", {
        companyId: "a1",
        name: "New Campaign",
        templateId: null,
        segmentId: null,
      });
    });

    it("should pass templateId and segmentId when provided", async () => {
      vi.mocked(invokeCommand).mockResolvedValue({ id: "c-new", name: "Test" });

      await useCampaignsStore.getState().createCampaign({
        companyId: "a1",
        name: "Test",
        templateId: "t-1",
        segmentId: "s-1",
      });

      expect(invokeCommand).toHaveBeenCalledWith("db_create_campaign", {
        companyId: "a1",
        name: "Test",
        templateId: "t-1",
        segmentId: "s-1",
      });
    });

    it("should prepend new campaign to existing campaigns", async () => {
      useCampaignsStore.setState({
        campaigns: [{ id: "c1", name: "Existing" }],
      });
      vi.mocked(invokeCommand).mockResolvedValue({ id: "c-new", name: "New" });

      await useCampaignsStore.getState().createCampaign({
        companyId: "a1",
        name: "New",
      });

      const campaigns = useCampaignsStore.getState().campaigns;
      expect(campaigns).toHaveLength(2);
      expect(campaigns[0].id).toBe("c-new");
      expect(campaigns[1].id).toBe("c1");
    });

    it("should return empty string on error", async () => {
      vi.mocked(invokeCommand).mockRejectedValue(new Error("Create failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const id = await useCampaignsStore.getState().createCampaign({
        companyId: "a1",
        name: "Test",
      });

      expect(id).toBe("");
      consoleSpy.mockRestore();
    });
  });

  describe("deleteCampaign", () => {
    it("should remove a campaign from the list", async () => {
      useCampaignsStore.setState({
        campaigns: [
          { id: "c1", name: "Campaign 1" },
          { id: "c2", name: "Campaign 2" },
        ],
        stats: { c1: { total: 10, sent: 10, opened: 0, clicked: 0, bounced: 0 } },
      });
      vi.mocked(invokeCommand).mockResolvedValue(undefined);

      await useCampaignsStore.getState().deleteCampaign("c1");

      expect(useCampaignsStore.getState().campaigns).toHaveLength(1);
      expect(useCampaignsStore.getState().campaigns[0].id).toBe("c2");
      expect(useCampaignsStore.getState().stats["c1"]).toBeUndefined();
    });

    it("should remove stats for deleted campaign", async () => {
      useCampaignsStore.setState({
        campaigns: [{ id: "c1", name: "C1" }],
        stats: {
          c1: { total: 10, sent: 10, opened: 0, clicked: 0, bounced: 0 },
          c2: { total: 5, sent: 5, opened: 0, clicked: 0, bounced: 0 },
        },
      });
      vi.mocked(invokeCommand).mockResolvedValue(undefined);

      await useCampaignsStore.getState().deleteCampaign("c1");

      expect(useCampaignsStore.getState().stats["c1"]).toBeUndefined();
      expect(useCampaignsStore.getState().stats["c2"]).toBeDefined();
    });

    it("should handle deleting a non-existent campaign gracefully", async () => {
      vi.mocked(invokeCommand).mockResolvedValue(undefined);

      await useCampaignsStore.getState().deleteCampaign("non-existent");

      expect(useCampaignsStore.getState().campaigns).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      useCampaignsStore.setState({
        campaigns: [{ id: "c1", name: "C1" }],
      });
      vi.mocked(invokeCommand).mockRejectedValue(new Error("Delete failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useCampaignsStore.getState().deleteCampaign("c1");

      // Campaign should still be in the list since delete failed
      expect(useCampaignsStore.getState().campaigns).toHaveLength(1);
      consoleSpy.mockRestore();
    });
  });
});
