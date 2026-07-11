import { describe, it, expect, beforeEach, vi } from "vitest";
import * as warmingDb from "@features/deliverability/db/warming";

vi.mock("@features/deliverability/db/warming", () => ({
  getWarmingPlan: vi.fn(),
  upsertWarmingPlan: vi.fn(),
  logWarmingVolume: vi.fn(),
}));

describe("warmingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDailyLimit", () => {
    it("returns Infinity when warming is disabled", async () => {
      vi.mocked(warmingDb.getWarmingPlan).mockResolvedValue(null);

      const { getDailyLimit } = await import("@features/deliverability/services/warmingService");
      const result = await getDailyLimit("acc-1");
      expect(result).toBe(Infinity);
    });

    it("returns current_volume when warming is enabled", async () => {
      vi.mocked(warmingDb.getWarmingPlan).mockResolvedValue({
        id: "w1",
        account_id: "acc-1",
        enabled: 1,
        start_volume: 10,
        current_volume: 25,
        target_volume: 100,
        ramp_days: 14,
        created_at: Math.floor(Date.now() / 1000) - 86400 * 5,
        updated_at: Math.floor(Date.now() / 1000),
      });

      const { getDailyLimit } = await import("@features/deliverability/services/warmingService");
      const result = await getDailyLimit("acc-1");
      expect(result).toBe(25);
    });
  });

  describe("getWarmingProgress", () => {
    it("returns null when no plan exists", async () => {
      vi.mocked(warmingDb.getWarmingPlan).mockResolvedValue(null);

      const { getWarmingProgress } = await import("@features/deliverability/services/warmingService");
      const result = await getWarmingProgress("acc-1");
      expect(result).toBeNull();
    });

    it("computes progress correctly", async () => {
      const createdAt = Math.floor(Date.now() / 1000) - 86400 * 7;
      vi.mocked(warmingDb.getWarmingPlan).mockResolvedValue({
        id: "w1",
        account_id: "acc-1",
        enabled: 1,
        start_volume: 10,
        current_volume: 55,
        target_volume: 100,
        ramp_days: 14,
        created_at: createdAt,
        updated_at: Math.floor(Date.now() / 1000),
      });

      const { getWarmingProgress } = await import("@features/deliverability/services/warmingService");
      const result = await getWarmingProgress("acc-1");
      expect(result).not.toBeNull();
      expect(result!.currentVolume).toBe(55);
      expect(result!.targetVolume).toBe(100);
      expect(result!.totalDays).toBe(14);
      expect(result!.percentageComplete).toBeCloseTo(50, 0);
    });
  });

  describe("enableWarming", () => {
    it("creates a new plan with defaults", async () => {
      vi.mocked(warmingDb.getWarmingPlan).mockResolvedValue(null);

      const { enableWarming } = await import("@features/deliverability/services/warmingService");
      await enableWarming("acc-1");

      expect(warmingDb.upsertWarmingPlan).toHaveBeenCalledWith("acc-1", {
        enabled: 1,
        start_volume: 10,
        current_volume: 10,
        target_volume: 100,
        ramp_days: 14,
      });
    });
  });
});
