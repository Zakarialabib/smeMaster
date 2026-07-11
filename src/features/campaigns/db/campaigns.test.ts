import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@shared/services/db/db-invoke", () => ({
  listCampaigns: vi.fn(),
  getCampaign: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaignStatus: vi.fn(),
  incrementCampaignSentCount: vi.fn(),
  deleteCampaign: vi.fn(),
}));

import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaignStatus,
  incrementCampaignSentCount,
  deleteCampaign,
} from "@shared/services/db/db-invoke";
import {
  getCampaigns,
  getCampaign as getCampaignFn,
  createCampaign as createCampaignFn,
  updateCampaignStatus as updateCampaignStatusFn,
  incrementSentCount,
  deleteCampaign as deleteCampaignFn,
} from "./campaigns";

const mockListCampaigns = vi.mocked(listCampaigns);
const mockGetCampaign = vi.mocked(getCampaign);
const mockCreateCampaign = vi.mocked(createCampaign);
const mockUpdateCampaignStatus = vi.mocked(updateCampaignStatus);
const mockIncrementCampaignSentCount = vi.mocked(incrementCampaignSentCount);
const mockDeleteCampaign = vi.mocked(deleteCampaign);

describe("campaigns service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCampaigns", () => {
    it("delegates to listCampaigns with accountId", async () => {
      const campaigns = [{ id: "c1", name: "Test" }];
      mockListCampaigns.mockResolvedValue(campaigns as never);

      const result = await getCampaigns("acc-1");

      expect(result).toEqual(campaigns);
      expect(mockListCampaigns).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("getCampaign", () => {
    it("delegates to getCampaign with id", async () => {
      const campaign = { id: "c1", name: "Test" };
      mockGetCampaign.mockResolvedValue(campaign as never);

      const result = await getCampaignFn("c1");

      expect(result).toEqual(campaign);
      expect(mockGetCampaign).toHaveBeenCalledWith("c1");
    });
  });

  describe("createCampaign", () => {
    it("delegates to createCampaign with all params", async () => {
      mockCreateCampaign.mockResolvedValue("new-id");

      const result = await createCampaignFn("acc-1", "New Campaign", "tmpl-1", "seg-1");

      expect(result).toBe("new-id");
      expect(mockCreateCampaign).toHaveBeenCalledWith("acc-1", "New Campaign", "tmpl-1", "seg-1");
    });

    it("delegates without optional params", async () => {
      mockCreateCampaign.mockResolvedValue("new-id");

      await createCampaignFn("acc-1", "New Campaign");

      expect(mockCreateCampaign).toHaveBeenCalledWith("acc-1", "New Campaign", undefined, undefined);
    });
  });

  describe("updateCampaignStatus", () => {
    it("passes sentAt when status is 'sent'", async () => {
      mockUpdateCampaignStatus.mockResolvedValue(undefined);
      const before = Math.floor(Date.now() / 1000);

      await updateCampaignStatusFn("c1", "sent");

      const call = mockUpdateCampaignStatus.mock.calls[0];
      expect(call[0]).toBe("c1");
      expect(call[1]).toBe("sent");
      expect(typeof call[2]).toBe("number");
      expect(call[2]).toBeGreaterThanOrEqual(before);
      expect(call[2]).toBeLessThanOrEqual(before + 2);
    });

    it("passes null sentAt when status is not 'sent'", async () => {
      mockUpdateCampaignStatus.mockResolvedValue(undefined);

      await updateCampaignStatusFn("c1", "draft");

      expect(mockUpdateCampaignStatus).toHaveBeenCalledWith("c1", "draft", null);
    });
  });

  describe("incrementSentCount", () => {
    it("delegates to incrementCampaignSentCount", async () => {
      mockIncrementCampaignSentCount.mockResolvedValue(undefined);

      await incrementSentCount("c1");

      expect(mockIncrementCampaignSentCount).toHaveBeenCalledWith("c1");
    });
  });

  describe("deleteCampaign", () => {
    it("delegates to deleteCampaign with id", async () => {
      mockDeleteCampaign.mockResolvedValue(undefined);

      await deleteCampaignFn("c1");

      expect(mockDeleteCampaign).toHaveBeenCalledWith("c1");
    });
  });
});
