import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSegmentsStore } from "@/stores/contacts";

vi.mock("@features/contacts/db/contactTags", () => ({
  getContactTags: vi.fn(),
  upsertContactTag: vi.fn(),
  deleteContactTag: vi.fn(),
  getContactCountForTag: vi.fn(),
}));

vi.mock("@features/contacts/db/contactGroups", () => ({
  getContactGroups: vi.fn(),
  upsertContactGroup: vi.fn(),
  deleteContactGroup: vi.fn(),
  getContactCountForGroup: vi.fn(),
}));

vi.mock("@features/contacts/db/contactSegments", () => ({
  getContactSegments: vi.fn(),
  upsertContactSegment: vi.fn(),
  deleteContactSegment: vi.fn(),
}));

import {
  getContactSegments,
  upsertContactSegment,
  deleteContactSegment,
} from "@features/contacts/db/contactSegments";

beforeEach(() => {
  useSegmentsStore.setState({
    tags: [],
    groups: [],
    segments: [],
    isLoading: false,
  });
  vi.clearAllMocks();
});

describe("segmentsStore", () => {
  describe("initial state", () => {
    it("should have segments as empty array", () => {
      const state = useSegmentsStore.getState();
      expect(state.segments).toEqual([]);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("loadSegments", () => {
    it("should load segments", async () => {
      const dbSegments = [
        { id: "s1", name: "Active Users", query: "status=active", accountId: "a1" },
        { id: "s2", name: "Inactive", query: "status=inactive", accountId: "a1" },
      ];
      vi.mocked(getContactSegments).mockResolvedValue(dbSegments);

      await useSegmentsStore.getState().loadSegments("a1");

      expect(getContactSegments).toHaveBeenCalledWith("a1");
      const segments = useSegmentsStore.getState().segments;
      expect(segments).toHaveLength(2);
      expect(segments[0].name).toBe("Active Users");
      expect(segments[0].query).toBe("status=active");
      expect(useSegmentsStore.getState().isLoading).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(getContactSegments).mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useSegmentsStore.getState().loadSegments("a1");

      expect(useSegmentsStore.getState().segments).toEqual([]);
      expect(useSegmentsStore.getState().isLoading).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("createSegment", () => {
    it("should create a segment and reload", async () => {
      vi.mocked(upsertContactSegment).mockResolvedValue(undefined);
      const dbSegments = [
        { id: "s1", name: "New Segment", query: "active=true", accountId: "a1" },
      ];
      vi.mocked(getContactSegments).mockResolvedValue(dbSegments);

      await useSegmentsStore.getState().createSegment("a1", "New Segment", "active=true");

      expect(upsertContactSegment).toHaveBeenCalledWith(undefined, "a1", "New Segment", "active=true");
      expect(useSegmentsStore.getState().segments).toHaveLength(1);
      expect(useSegmentsStore.getState().segments[0].name).toBe("New Segment");
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(upsertContactSegment).mockRejectedValue(new Error("Create failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useSegmentsStore.getState().createSegment("a1", "New Segment", "query");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("deleteSegment", () => {
    it("should delete a segment and reload", async () => {
      vi.mocked(deleteContactSegment).mockResolvedValue(undefined);
      vi.mocked(getContactSegments).mockResolvedValue([]);

      await useSegmentsStore.getState().deleteSegment("s1", "a1");

      expect(deleteContactSegment).toHaveBeenCalledWith("s1", "a1");
      expect(useSegmentsStore.getState().segments).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(deleteContactSegment).mockRejectedValue(new Error("Delete failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useSegmentsStore.getState().deleteSegment("s1", "a1");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
