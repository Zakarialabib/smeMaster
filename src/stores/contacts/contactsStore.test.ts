import { describe, it, expect, beforeEach, vi } from "vitest";
import { useContactsStore, type ContactTag } from "@/stores/contacts";

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
  useContactsStore.setState({
    tags: [],
    groups: [],
    segments: [],
    isLoading: false,
  });
  vi.clearAllMocks();
});

describe("contactsStore", () => {
  describe("initial state", () => {
    it("should have correct defaults", () => {
      const state = useContactsStore.getState();
      expect(state.tags).toEqual([]);
      expect(state.groups).toEqual([]);
      expect(state.segments).toEqual([]);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("loadTags", () => {
    it("should load tags with contact counts", async () => {
      const dbTags = [
        { id: "t1", name: "VIP", color: "#ff0000", sort_order: 1, accountId: "a1" },
        { id: "t2", name: "Lead", color: null, sort_order: 2, accountId: "a1" },
      ];
      vi.mocked(getContactTags).mockResolvedValue(dbTags);
      vi.mocked(getContactCountForTag).mockResolvedValue(5);

      await useContactsStore.getState().loadTags("a1");

      expect(getContactTags).toHaveBeenCalledWith("a1");
      expect(useContactsStore.getState().tags).toHaveLength(2);
      expect(useContactsStore.getState().tags[0].name).toBe("VIP");
      expect(useContactsStore.getState().tags[0].contact_count).toBe(5);
      expect(useContactsStore.getState().isLoading).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(getContactTags).mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactsStore.getState().loadTags("a1");

      expect(useContactsStore.getState().tags).toEqual([]);
      expect(useContactsStore.getState().isLoading).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("loadGroups", () => {
    it("should load groups with contact counts", async () => {
      const dbGroups = [
        { id: "g1", name: "Team A", description: "First team", accountId: "a1" },
      ];
      vi.mocked(getContactGroups).mockResolvedValue(dbGroups);
      vi.mocked(getContactCountForGroup).mockResolvedValue(12);

      await useContactsStore.getState().loadGroups("a1");

      expect(getContactGroups).toHaveBeenCalledWith("a1");
      expect(useContactsStore.getState().groups).toHaveLength(1);
      expect(useContactsStore.getState().groups[0].name).toBe("Team A");
      expect(useContactsStore.getState().groups[0].contact_count).toBe(12);
      expect(useContactsStore.getState().isLoading).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(getContactGroups).mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactsStore.getState().loadGroups("a1");

      expect(useContactsStore.getState().groups).toEqual([]);
      expect(useContactsStore.getState().isLoading).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("loadSegments", () => {
    it("should load segments", async () => {
      const dbSegments = [
        { id: "s1", name: "Active Users", query: "status=active", accountId: "a1" },
      ];
      vi.mocked(getContactSegments).mockResolvedValue(dbSegments);

      await useContactsStore.getState().loadSegments("a1");

      expect(getContactSegments).toHaveBeenCalledWith("a1");
      expect(useContactsStore.getState().segments).toHaveLength(1);
      expect(useContactsStore.getState().segments[0].name).toBe("Active Users");
      expect(useContactsStore.getState().segments[0].query).toBe("status=active");
      expect(useContactsStore.getState().isLoading).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(getContactSegments).mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactsStore.getState().loadSegments("a1");

      expect(useContactsStore.getState().segments).toEqual([]);
      expect(useContactsStore.getState().isLoading).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("createTag", () => {
    it("should create and reload tags", async () => {
      vi.mocked(upsertContactTag).mockResolvedValue(undefined);
      const dbTags = [
        { id: "t1", name: "New Tag", color: "#00ff00", sort_order: 1, accountId: "a1" },
      ];
      vi.mocked(getContactTags).mockResolvedValue(dbTags);
      vi.mocked(getContactCountForTag).mockResolvedValue(0);

      await useContactsStore.getState().createTag("a1", "New Tag", "#00ff00");

      expect(upsertContactTag).toHaveBeenCalledWith(undefined, "a1", "New Tag", "#00ff00");
      expect(useContactsStore.getState().tags).toHaveLength(1);
      expect(useContactsStore.getState().tags[0].name).toBe("New Tag");
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(upsertContactTag).mockRejectedValue(new Error("Create failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactsStore.getState().createTag("a1", "New Tag");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("createGroup", () => {
    it("should create and reload groups", async () => {
      vi.mocked(upsertContactGroup).mockResolvedValue(undefined);
      const dbGroups = [
        { id: "g1", name: "New Group", description: "Desc", accountId: "a1" },
      ];
      vi.mocked(getContactGroups).mockResolvedValue(dbGroups);
      vi.mocked(getContactCountForGroup).mockResolvedValue(0);

      await useContactsStore.getState().createGroup("a1", "New Group", "Desc");

      expect(upsertContactGroup).toHaveBeenCalledWith(undefined, "a1", "New Group", "Desc");
      expect(useContactsStore.getState().groups).toHaveLength(1);
      expect(useContactsStore.getState().groups[0].name).toBe("New Group");
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(upsertContactGroup).mockRejectedValue(new Error("Create failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactsStore.getState().createGroup("a1", "New Group");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("createSegment", () => {
    it("should create and reload segments", async () => {
      vi.mocked(upsertContactSegment).mockResolvedValue(undefined);
      const dbSegments = [
        { id: "s1", name: "New Segment", query: "active=true", accountId: "a1" },
      ];
      vi.mocked(getContactSegments).mockResolvedValue(dbSegments);

      await useContactsStore.getState().createSegment("a1", "New Segment", "active=true");

      expect(upsertContactSegment).toHaveBeenCalledWith(undefined, "a1", "New Segment", "active=true");
      expect(useContactsStore.getState().segments).toHaveLength(1);
      expect(useContactsStore.getState().segments[0].name).toBe("New Segment");
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(upsertContactSegment).mockRejectedValue(new Error("Create failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactsStore.getState().createSegment("a1", "New Segment", "query");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("deleteTag", () => {
    it("should delete and reload tags", async () => {
      vi.mocked(deleteContactTag).mockResolvedValue(undefined);
      vi.mocked(getContactTags).mockResolvedValue([]);
      vi.mocked(getContactCountForTag).mockResolvedValue(0);

      await useContactsStore.getState().deleteTag("t1", "a1");

      expect(deleteContactTag).toHaveBeenCalledWith("t1", "a1");
      expect(useContactsStore.getState().tags).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(deleteContactTag).mockRejectedValue(new Error("Delete failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactsStore.getState().deleteTag("t1", "a1");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("deleteGroup", () => {
    it("should delete and reload groups", async () => {
      vi.mocked(deleteContactGroup).mockResolvedValue(undefined);
      vi.mocked(getContactGroups).mockResolvedValue([]);
      vi.mocked(getContactCountForGroup).mockResolvedValue(0);

      await useContactsStore.getState().deleteGroup("g1", "a1");

      expect(deleteContactGroup).toHaveBeenCalledWith("g1", "a1");
      expect(useContactsStore.getState().groups).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(deleteContactGroup).mockRejectedValue(new Error("Delete failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactsStore.getState().deleteGroup("g1", "a1");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("deleteSegment", () => {
    it("should delete and reload segments", async () => {
      vi.mocked(deleteContactSegment).mockResolvedValue(undefined);
      vi.mocked(getContactSegments).mockResolvedValue([]);

      await useContactsStore.getState().deleteSegment("s1", "a1");

      expect(deleteContactSegment).toHaveBeenCalledWith("s1", "a1");
      expect(useContactsStore.getState().segments).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(deleteContactSegment).mockRejectedValue(new Error("Delete failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useContactsStore.getState().deleteSegment("s1", "a1");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
