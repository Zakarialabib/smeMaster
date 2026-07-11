import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/shared/services/db/db-invoke", () => ({
  listContactLabels: vi.fn(),
  deleteContactLabel: vi.fn(),
  addEntityLink: vi.fn(),
  removeEntityLink: vi.fn(),
  getLinkedEntities: vi.fn(),
  getContactTagById: vi.fn(),
  upsertContactTag: vi.fn(),
  getContactCountForTag: vi.fn(),
}));

import {
  listContactLabels,
  deleteContactLabel,
  addEntityLink,
  removeEntityLink,
  getLinkedEntities,
  getContactTagById,
  upsertContactTag,
  getContactCountForTag,
} from "../../../shared/services/db/db-invoke";
import {
  getContactTags,
  getContactTagById as getContactTagByIdFn,
  upsertContactTag as upsertContactTagFn,
  deleteContactTag,
  getContactCountForTag as getContactCountForTagFn,
  addTagToContact,
  removeTagFromContact,
  getTagIdsForContact,
} from "./contactTags";

const mockListContactLabels = vi.mocked(listContactLabels);
const mockDeleteContactLabel = vi.mocked(deleteContactLabel);
const mockAddTag = vi.mocked(addEntityLink);
const mockRemoveTag = vi.mocked(removeEntityLink);
const mockGetTagsForEntity = vi.mocked(getLinkedEntities);
const mockGetContactTagById = vi.mocked(getContactTagById);
const mockUpsertContactTag = vi.mocked(upsertContactTag);
const mockGetContactCountForTag = vi.mocked(getContactCountForTag);

describe("contactTags service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getContactTags", () => {
    it("delegates to listContactLabels with accountId", async () => {
      const tags = [{ id: "t1", name: "VIP" }];
      mockListContactLabels.mockResolvedValue(tags as never);

      const result = await getContactTags("acc-1");

      expect(result).toEqual(tags);
      expect(mockListContactLabels).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("getContactTagById", () => {
    it("delegates to dbGetContactTagById", async () => {
      const tag = { id: "t1", name: "VIP" };
      mockGetContactTagById.mockResolvedValue(tag as never);

      const result = await getContactTagByIdFn("t1");

      expect(result).toEqual(tag);
      expect(mockGetContactTagById).toHaveBeenCalledWith("t1");
    });
  });

  describe("upsertContactTag", () => {
    it("delegates to dbUpsertContactTag with id", async () => {
      mockUpsertContactTag.mockResolvedValue("t1");

      const result = await upsertContactTagFn("t1", "acc-1", "VIP", "#ff0000");

      expect(result).toBe("t1");
      expect(mockUpsertContactTag).toHaveBeenCalledWith("t1", "acc-1", "VIP", "#ff0000");
    });

    it("passes null when id is undefined", async () => {
      mockUpsertContactTag.mockResolvedValue("new-id");

      const result = await upsertContactTagFn(undefined, "acc-1", "VIP");

      expect(result).toBe("new-id");
      expect(mockUpsertContactTag).toHaveBeenCalledWith(null, "acc-1", "VIP", null);
    });

    it("passes null when color is undefined", async () => {
      mockUpsertContactTag.mockResolvedValue("t1");

      await upsertContactTagFn("t1", "acc-1", "VIP");

      expect(mockUpsertContactTag).toHaveBeenCalledWith("t1", "acc-1", "VIP", null);
    });
  });

  describe("deleteContactTag", () => {
    it("delegates to deleteContactLabel with id", async () => {
      mockDeleteContactLabel.mockResolvedValue(undefined);

      await deleteContactTag("t1", "acc-1");

      expect(mockDeleteContactLabel).toHaveBeenCalledWith("t1");
    });
  });

  describe("getContactCountForTag", () => {
    it("delegates to dbGetContactCountForTag", async () => {
      mockGetContactCountForTag.mockResolvedValue(42);

      const result = await getContactCountForTagFn("t1");

      expect(result).toBe(42);
      expect(mockGetContactCountForTag).toHaveBeenCalledWith("t1");
    });
  });

  describe("addTagToContact", () => {
    it("calls addTag with contact entity and label pivot type", async () => {
      mockAddTag.mockResolvedValue(undefined);

      await addTagToContact("contact-1", "tag-1");

      expect(mockAddTag).toHaveBeenCalledWith("contact", "contact-1", "label", "tag-1");
    });
  });

  describe("removeTagFromContact", () => {
    it("calls removeTag with contact entity and label pivot type", async () => {
      mockRemoveTag.mockResolvedValue(undefined);

      await removeTagFromContact("contact-1", "tag-1");

      expect(mockRemoveTag).toHaveBeenCalledWith("contact", "contact-1", "label", "tag-1");
    });
  });

  describe("getTagIdsForContact", () => {
    it("maps pivot results to pivot_id array", async () => {
      mockGetTagsForEntity.mockResolvedValue([
        { pivot_id: "tag-1" } as never,
        { pivot_id: "tag-2" } as never,
      ]);

      const result = await getTagIdsForContact("contact-1");

      expect(result).toEqual(["tag-1", "tag-2"]);
      expect(mockGetTagsForEntity).toHaveBeenCalledWith("contact", "contact-1");
    });

    it("returns empty array when no tags", async () => {
      mockGetTagsForEntity.mockResolvedValue([]);

      const result = await getTagIdsForContact("contact-1");

      expect(result).toEqual([]);
    });
  });
});
