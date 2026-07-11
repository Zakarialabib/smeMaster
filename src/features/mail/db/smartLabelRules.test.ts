import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-id"),
}));

import { v4 as uuidv4 } from "uuid";
import {
  getSmartLabelRulesForAccount,
  getEnabledSmartLabelRules,
  insertSmartLabelRule,
  updateSmartLabelRule,
  deleteSmartLabelRule,
} from "./smartLabelRules";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("smartLabelRules service (deprecated)", () => {
  describe("getSmartLabelRulesForAccount", () => {
    it("returns an empty array (feature has been removed)", async () => {
      const result = await getSmartLabelRulesForAccount("acc-1");
      expect(result).toEqual([]);
    });
  });

  describe("getEnabledSmartLabelRules", () => {
    it("returns an empty array (feature has been removed)", async () => {
      const result = await getEnabledSmartLabelRules("acc-1");
      expect(result).toEqual([]);
    });
  });

  describe("insertSmartLabelRule", () => {
    it("returns a generated UUID without persisting", async () => {
      const id = await insertSmartLabelRule({
        accountId: "acc-1",
        labelId: "label-1",
        aiDescription: "Job applications",
      });

      expect(id).toBe("mock-id");
      expect(uuidv4).toHaveBeenCalledOnce();
    });

    it("accepts optional criteria parameter", async () => {
      const id = await insertSmartLabelRule({
        accountId: "acc-1",
        labelId: "label-1",
        aiDescription: "Job apps",
        criteria: { from: "recruiter@", subject: "position" } as any,
      });

      expect(id).toBe("mock-id");
    });

    it("accepts isEnabled parameter", async () => {
      const id = await insertSmartLabelRule({
        accountId: "acc-1",
        labelId: "label-1",
        aiDescription: "Test",
        isEnabled: false,
      });

      expect(id).toBe("mock-id");
    });
  });

  describe("updateSmartLabelRule", () => {
    it("does not throw and logs a warning (feature has been removed)", async () => {
      await expect(
        updateSmartLabelRule("r1", { aiDescription: "Updated description" }),
      ).resolves.toBeUndefined();
    });

    it("handles empty updates gracefully", async () => {
      await expect(
        updateSmartLabelRule("r1", {}),
      ).resolves.toBeUndefined();
    });

    it("handles criteria parameter", async () => {
      await expect(
        updateSmartLabelRule("r1", { criteria: { from: "test@example.com" } as any }),
      ).resolves.toBeUndefined();
    });

    it("handles null criteria", async () => {
      await expect(
        updateSmartLabelRule("r1", { criteria: null }),
      ).resolves.toBeUndefined();
    });
  });

  describe("deleteSmartLabelRule", () => {
    it("does not throw (feature has been removed)", async () => {
      await expect(
        deleteSmartLabelRule("r1"),
      ).resolves.toBeUndefined();
    });
  });
});

