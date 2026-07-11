import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/shared/services/db/db-invoke", () => ({
  listSnoozePresets: vi.fn(),
  createSnoozePreset: vi.fn(),
  deleteSnoozePreset: vi.fn(),
}));

import {
  listSnoozePresets,
  createSnoozePreset,
  deleteSnoozePreset,
} from "../../../shared/services/db/db-invoke";
import {
  getSnoozePresets,
  upsertSnoozePreset,
  deleteSnoozePreset as deleteSnoozePresetFn,
} from "./snoozePresets";

const mockListSnoozePresets = vi.mocked(listSnoozePresets);
const mockCreateSnoozePreset = vi.mocked(createSnoozePreset);
const mockDeleteSnoozePreset = vi.mocked(deleteSnoozePreset);

describe("snoozePresets service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSnoozePresets", () => {
    it("delegates to listSnoozePresets with accountId", async () => {
      const presets = [{ id: "sp1", label: "Tomorrow" }];
      mockListSnoozePresets.mockResolvedValue(presets as never);

      const result = await getSnoozePresets("acc-1");

      expect(result).toEqual(presets);
      expect(mockListSnoozePresets).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("upsertSnoozePreset", () => {
    it("creates preset and returns id", async () => {
      mockCreateSnoozePreset.mockResolvedValue({
        id: "sp1",
        account_id: "acc-1",
        label: "Tomorrow",
        duration_minutes: 1440,
        is_recurring: null,
        sort_order: null,
      } as never);

      const result = await upsertSnoozePreset({
        companyId: "acc-1",
        label: "Tomorrow",
        durationMinutes: 1440,
      });

      expect(result).toBe("sp1");
      expect(mockCreateSnoozePreset).toHaveBeenCalledWith({
        companyId: "acc-1",
        label: "Tomorrow",
        durationMinutes: 1440,
        isRecurring: null,
        sortOrder: null,
      });
    });

    it("passes through optional isRecurring and sortOrder", async () => {
      mockCreateSnoozePreset.mockResolvedValue({
        id: "sp2",
        account_id: "acc-1",
        label: "Weekly",
        duration_minutes: 10080,
        is_recurring: true,
        sort_order: 1,
      } as never);

      await upsertSnoozePreset({
        companyId: "acc-1",
        label: "Weekly",
        durationMinutes: 10080,
        isRecurring: true,
        sortOrder: 1,
      });

      expect(mockCreateSnoozePreset).toHaveBeenCalledWith({
        companyId: "acc-1",
        label: "Weekly",
        durationMinutes: 10080,
        isRecurring: true,
        sortOrder: 1,
      });
    });
  });

  describe("deleteSnoozePreset", () => {
    it("delegates to dbDeleteSnoozePreset with id", async () => {
      mockDeleteSnoozePreset.mockResolvedValue(undefined);

      await deleteSnoozePresetFn("sp1");

      expect(mockDeleteSnoozePreset).toHaveBeenCalledWith("sp1");
    });
  });
});
