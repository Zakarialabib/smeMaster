import { describe, it, expect, beforeEach, vi } from "vitest";
import { useContactStore } from "./contactStore";

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
  getContactTags,
  upsertContactTag,
  deleteContactTag,
  getContactCountForTag,
} from "@features/contacts/db/contactTags";
import {
  getContactGroups,
  upsertContactGroup,
  deleteContactGroup,
  getContactCountForGroup,
} from "@features/contacts/db/contactGroups";
import {
  getContactSegments,
  upsertContactSegment,
  deleteContactSegment,
} from "@features/contacts/db/contactSegments";

beforeEach(() => {
  useContactStore.setState({
    tags: [],
    groups: [],
    segments: [],
    isLoading: false,
  });
  vi.clearAllMocks();
});

describe("contactStore", () => {
  describe("initial state", () => {
    it("should have correct defaults", () => {
      const state = useContactStore.getState();
      expect(state.tags).toEqual([]);
      expect(state.groups).toEqual([]);
      expect(state.segments).toEqual([]);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("loadTags", () => {
    it("should load tags for an account", async () => {
      const dbTags = [
        { id: "t1", name: "VIP", color: "#ff0000", sort_order: 1, accountId: "a1" },
        { id: "t2", name: "Lead", color: null, sort_order: 2, accountId: "a1" },
      ];
      vi.mocked(getContactTags).mockResolvedValue(dbTags);
      vi.mocked(getContactCountForTag).mockResolvedValue(5);

      await useContactStore.getState().loadTags("a1");

      expect(getContactTags).toHaveBeenCalledWith("a1");
      expect(useContactStore.getState().tags).toHaveLength(2);
      expect(useContactStore.getState().tags[0].name).toBe("VIP");
      expect(useContactStore.getState().tags[0].contact_count).toBe(5);
      expect(useContactStore.getState().isLoading).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(getContactTags).mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactStore.getState().loadTags("a1");

      expect(useContactStore.getState().tags).toEqual([]);
      expect(useContactStore.getState().isLoading).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("loadGroups", () => {
    it("should load groups for an account", async () => {
      const dbGroups = [
        { id: "g1", name: "Team A", description: "First team", accountId: "a1" },
      ];
      vi.mocked(getContactGroups).mockResolvedValue(dbGroups);
      vi.mocked(getContactCountForGroup).mockResolvedValue(12);

      await useContactStore.getState().loadGroups("a1");

      expect(getContactGroups).toHaveBeenCalledWith("a1");
      expect(useContactStore.getState().groups).toHaveLength(1);
      expect(useContactStore.getState().groups[0].name).toBe("Team A");
      expect(useContactStore.getState().groups[0].contact_count).toBe(12);
      expect(useContactStore.getState().isLoading).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(getContactGroups).mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactStore.getState().loadGroups("a1");

      expect(useContactStore.getState().groups).toEqual([]);
      expect(useContactStore.getState().isLoading).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("loadSegments", () => {
    it("should load segments for an account", async () => {
      const dbSegments = [
        { id: "s1", name: "Active Users", query: "status=active", accountId: "a1" },
      ];
      vi.mocked(getContactSegments).mockResolvedValue(dbSegments);

      await useContactStore.getState().loadSegments("a1");

      expect(getContactSegments).toHaveBeenCalledWith("a1");
      expect(useContactStore.getState().segments).toHaveLength(1);
      expect(useContactStore.getState().segments[0].name).toBe("Active Users");
      expect(useContactStore.getState().segments[0].query).toBe("status=active");
      expect(useContactStore.getState().isLoading).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(getContactSegments).mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactStore.getState().loadSegments("a1");

      expect(useContactStore.getState().segments).toEqual([]);
      expect(useContactStore.getState().isLoading).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("createTag", () => {
    it("should create a tag and reload tags", async () => {
      vi.mocked(upsertContactTag).mockResolvedValue(undefined);
      const dbTags = [{ id: "t1", name: "New Tag", color: "#00ff00", sort_order: 1, accountId: "a1" }];
      vi.mocked(getContactTags).mockResolvedValue(dbTags);
      vi.mocked(getContactCountForTag).mockResolvedValue(0);

      await useContactStore.getState().createTag("a1", "New Tag", "#00ff00");

      expect(upsertContactTag).toHaveBeenCalledWith(undefined, "a1", "New Tag", "#00ff00");
      expect(useContactStore.getState().tags).toHaveLength(1);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(upsertContactTag).mockRejectedValue(new Error("Create failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactStore.getState().createTag("a1", "New Tag");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("createGroup", () => {
    it("should create a group and reload groups", async () => {
      vi.mocked(upsertContactGroup).mockResolvedValue(undefined);
      const dbGroups = [{ id: "g1", name: "New Group", description: "Desc", accountId: "a1" }];
      vi.mocked(getContactGroups).mockResolvedValue(dbGroups);
      vi.mocked(getContactCountForGroup).mockResolvedValue(0);

      await useContactStore.getState().createGroup("a1", "New Group", "Desc");

      expect(upsertContactGroup).toHaveBeenCalledWith(undefined, "a1", "New Group", "Desc");
      expect(useContactStore.getState().groups).toHaveLength(1);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(upsertContactGroup).mockRejectedValue(new Error("Create failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactStore.getState().createGroup("a1", "New Group");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("createSegment", () => {
    it("should create a segment and reload segments", async () => {
      vi.mocked(upsertContactSegment).mockResolvedValue(undefined);
      const dbSegments = [{ id: "s1", name: "New Segment", query: "active=true", accountId: "a1" }];
      vi.mocked(getContactSegments).mockResolvedValue(dbSegments);

      await useContactStore.getState().createSegment("a1", "New Segment", "active=true");

      expect(upsertContactSegment).toHaveBeenCalledWith(undefined, "a1", "New Segment", "active=true");
      expect(useContactStore.getState().segments).toHaveLength(1);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(upsertContactSegment).mockRejectedValue(new Error("Create failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactStore.getState().createSegment("a1", "New Segment", "query");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("deleteTag", () => {
    it("should delete a tag and reload tags", async () => {
      vi.mocked(deleteContactTag).mockResolvedValue(undefined);
      vi.mocked(getContactTags).mockResolvedValue([]);
      vi.mocked(getContactCountForTag).mockResolvedValue(0);

      await useContactStore.getState().deleteTag("t1", "a1");

      expect(deleteContactTag).toHaveBeenCalledWith("t1", "a1");
      expect(useContactStore.getState().tags).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(deleteContactTag).mockRejectedValue(new Error("Delete failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactStore.getState().deleteTag("t1", "a1");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("deleteGroup", () => {
    it("should delete a group and reload groups", async () => {
      vi.mocked(deleteContactGroup).mockResolvedValue(undefined);
      vi.mocked(getContactGroups).mockResolvedValue([]);
      vi.mocked(getContactCountForGroup).mockResolvedValue(0);

      await useContactStore.getState().deleteGroup("g1", "a1");

      expect(deleteContactGroup).toHaveBeenCalledWith("g1", "a1");
      expect(useContactStore.getState().groups).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(deleteContactGroup).mockRejectedValue(new Error("Delete failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactStore.getState().deleteGroup("g1", "a1");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("deleteSegment", () => {
    it("should delete a segment and reload segments", async () => {
      vi.mocked(deleteContactSegment).mockResolvedValue(undefined);
      vi.mocked(getContactSegments).mockResolvedValue([]);

      await useContactStore.getState().deleteSegment("s1", "a1");

      expect(deleteContactSegment).toHaveBeenCalledWith("s1", "a1");
      expect(useContactStore.getState().segments).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(deleteContactSegment).mockRejectedValue(new Error("Delete failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactStore.getState().deleteSegment("s1", "a1");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("withMutation wiring (isLoading + error)", () => {
    it("isLoading is true while createTag is pending", async () => {
      let resolveFn: () => void = () => {};
      vi.mocked(upsertContactTag).mockReturnValue(
        new Promise<void>((resolve) => {
          resolveFn = resolve;
        }) as never,
      );
      vi.mocked(getContactTags).mockResolvedValue([]);
      vi.mocked(getContactCountForTag).mockResolvedValue(0);

      const p = useContactStore.getState().createTag("a1", "Taggy");
      expect(useContactStore.getState().isLoading).toBe(true);

      resolveFn();
      await p;
      expect(useContactStore.getState().isLoading).toBe(false);
    });

    it("isLoading is false and error is set after createTag failure", async () => {
      vi.mocked(upsertContactTag).mockRejectedValue(new Error("Create failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactStore.getState().createTag("a1", "Taggy");

      const s = useContactStore.getState();
      expect(s.isLoading).toBe(false);
      expect(s.error).toBe("Create failed");
      consoleSpy.mockRestore();
    });

    it("deleteTag sets error on failure", async () => {
      vi.mocked(deleteContactTag).mockRejectedValue(new Error("Delete failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactStore.getState().deleteTag("t1", "a1");

      const s = useContactStore.getState();
      expect(s.isLoading).toBe(false);
      expect(s.error).toBe("Delete failed");
      consoleSpy.mockRestore();
    });
  });
});
