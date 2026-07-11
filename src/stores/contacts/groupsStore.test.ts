import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGroupsStore } from "@/stores/contacts";

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
  getContactGroups,
  upsertContactGroup,
  deleteContactGroup,
  getContactCountForGroup,
} from "@features/contacts/db/contactGroups";

beforeEach(() => {
  useGroupsStore.setState({
    tags: [],
    groups: [],
    segments: [],
    isLoading: false,
  });
  vi.clearAllMocks();
});

describe("groupsStore", () => {
  describe("initial state", () => {
    it("should have groups as empty array", () => {
      const state = useGroupsStore.getState();
      expect(state.groups).toEqual([]);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("loadGroups", () => {
    it("should load groups with contact counts", async () => {
      const dbGroups = [
        { id: "g1", name: "Team A", description: "First team", accountId: "a1" },
        { id: "g2", name: "Team B", description: null, accountId: "a1" },
      ];
      vi.mocked(getContactGroups).mockResolvedValue(dbGroups);
      vi.mocked(getContactCountForGroup).mockResolvedValue(3);

      await useGroupsStore.getState().loadGroups("a1");

      expect(getContactGroups).toHaveBeenCalledWith("a1");
      const groups = useGroupsStore.getState().groups;
      expect(groups).toHaveLength(2);
      expect(groups[0].name).toBe("Team A");
      expect(groups[0].contact_count).toBe(3);
      expect(useGroupsStore.getState().isLoading).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(getContactGroups).mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useGroupsStore.getState().loadGroups("a1");

      expect(useGroupsStore.getState().groups).toEqual([]);
      expect(useGroupsStore.getState().isLoading).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("createGroup", () => {
    it("should create a group and reload", async () => {
      vi.mocked(upsertContactGroup).mockResolvedValue(undefined);
      const dbGroups = [
        { id: "g1", name: "New Group", description: "Desc", accountId: "a1" },
      ];
      vi.mocked(getContactGroups).mockResolvedValue(dbGroups);
      vi.mocked(getContactCountForGroup).mockResolvedValue(0);

      await useGroupsStore.getState().createGroup("a1", "New Group", "Desc");

      expect(upsertContactGroup).toHaveBeenCalledWith(undefined, "a1", "New Group", "Desc");
      expect(useGroupsStore.getState().groups).toHaveLength(1);
      expect(useGroupsStore.getState().groups[0].name).toBe("New Group");
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(upsertContactGroup).mockRejectedValue(new Error("Create failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useGroupsStore.getState().createGroup("a1", "New Group");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("deleteGroup", () => {
    it("should delete a group and reload", async () => {
      vi.mocked(deleteContactGroup).mockResolvedValue(undefined);
      vi.mocked(getContactGroups).mockResolvedValue([]);
      vi.mocked(getContactCountForGroup).mockResolvedValue(0);

      await useGroupsStore.getState().deleteGroup("g1", "a1");

      expect(deleteContactGroup).toHaveBeenCalledWith("g1", "a1");
      expect(useGroupsStore.getState().groups).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(deleteContactGroup).mockRejectedValue(new Error("Delete failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useGroupsStore.getState().deleteGroup("g1", "a1");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
