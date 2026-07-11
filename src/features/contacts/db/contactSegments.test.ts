import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/shared/services/db/db-invoke", () => ({
  listSegments: vi.fn(),
  upsertContactSegment: vi.fn(),
  deleteContactSegment: vi.fn(),
}));

import {
  listSegments,
  upsertContactSegment,
  deleteContactSegment,
} from "../../../shared/services/db/db-invoke";
import {
  getContactSegments,
  upsertContactSegment as upsertContactSegmentFn,
  deleteContactSegment as deleteContactSegmentFn,
} from "./contactSegments";

const mockListSegments = vi.mocked(listSegments);
const mockUpsertContactSegment = vi.mocked(upsertContactSegment);
const mockDeleteContactSegment = vi.mocked(deleteContactSegment);

describe("contactSegments service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getContactSegments", () => {
    it("delegates to listSegments with accountId", async () => {
      const segments = [{ id: "s1", name: "High Value" }];
      mockListSegments.mockResolvedValue(segments as never);

      const result = await getContactSegments("acc-1");

      expect(result).toEqual(segments);
      expect(mockListSegments).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("upsertContactSegment", () => {
    it("delegates to dbUpsertContactSegment with id", async () => {
      mockUpsertContactSegment.mockResolvedValue("s1");

      const result = await upsertContactSegmentFn("s1", "acc-1", "High Value", "frequency > 10");

      expect(result).toBe("s1");
      expect(mockUpsertContactSegment).toHaveBeenCalledWith("s1", "acc-1", "High Value", "frequency > 10");
    });

    it("passes null when id is undefined", async () => {
      mockUpsertContactSegment.mockResolvedValue("new-id");

      const result = await upsertContactSegmentFn(undefined, "acc-1", "High Value", "frequency > 10");

      expect(result).toBe("new-id");
      expect(mockUpsertContactSegment).toHaveBeenCalledWith(null, "acc-1", "High Value", "frequency > 10");
    });
  });

  describe("deleteContactSegment", () => {
    it("delegates to dbDeleteContactSegment with id and accountId", async () => {
      mockDeleteContactSegment.mockResolvedValue(undefined);

      await deleteContactSegmentFn("s1", "acc-1");

      expect(mockDeleteContactSegment).toHaveBeenCalledWith("s1", "acc-1");
    });
  });
});
