import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/shared/services/db/db-invoke", () => ({
  listContactGroups: vi.fn(),
  addContactToGroup: vi.fn(),
  removeContactFromGroup: vi.fn(),
  upsertContactGroup: vi.fn(),
  deleteContactGroup: vi.fn(),
  getContactCountForGroup: vi.fn(),
  getContactGroupMembers: vi.fn(),
}));

import {
  listContactGroups,
  addContactToGroup,
  removeContactFromGroup,
  upsertContactGroup,
  deleteContactGroup,
  getContactCountForGroup,
  getContactGroupMembers,
} from "../../../shared/services/db/db-invoke";
import {
  getContactGroups,
  upsertContactGroup as upsertContactGroupFn,
  deleteContactGroup as deleteContactGroupFn,
  getContactCountForGroup as getContactCountForGroupFn,
  addContactToGroup as addContactToGroupFn,
  removeContactFromGroup as removeContactFromGroupFn,
  getContactGroupIds,
} from "./contactGroups";

const mockListContactGroups = vi.mocked(listContactGroups);
const mockAddContactToGroup = vi.mocked(addContactToGroup);
const mockRemoveContactFromGroup = vi.mocked(removeContactFromGroup);
const mockUpsertContactGroup = vi.mocked(upsertContactGroup);
const mockDeleteContactGroup = vi.mocked(deleteContactGroup);
const mockGetContactCountForGroup = vi.mocked(getContactCountForGroup);
const mockGetContactGroupMembers = vi.mocked(getContactGroupMembers);

describe("contactGroups service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getContactGroups", () => {
    it("delegates to listContactGroups with accountId", async () => {
      const groups = [{ id: "g1", name: "VIP" }];
      mockListContactGroups.mockResolvedValue(groups as never);

      const result = await getContactGroups("acc-1");

      expect(result).toEqual(groups);
      expect(mockListContactGroups).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("upsertContactGroup", () => {
    it("delegates to dbUpsertContactGroup with id", async () => {
      mockUpsertContactGroup.mockResolvedValue("g1");

      const result = await upsertContactGroupFn("g1", "acc-1", "VIP", "Important clients");

      expect(result).toBe("g1");
      expect(mockUpsertContactGroup).toHaveBeenCalledWith("g1", "acc-1", "VIP", "Important clients");
    });

    it("passes null when id is undefined", async () => {
      mockUpsertContactGroup.mockResolvedValue("new-id");

      const result = await upsertContactGroupFn(undefined, "acc-1", "VIP");

      expect(result).toBe("new-id");
      expect(mockUpsertContactGroup).toHaveBeenCalledWith(null, "acc-1", "VIP", null);
    });

    it("passes null when description is undefined", async () => {
      mockUpsertContactGroup.mockResolvedValue("g1");

      await upsertContactGroupFn("g1", "acc-1", "VIP");

      expect(mockUpsertContactGroup).toHaveBeenCalledWith("g1", "acc-1", "VIP", null);
    });
  });

  describe("deleteContactGroup", () => {
    it("delegates to dbDeleteContactGroup with id and accountId", async () => {
      mockDeleteContactGroup.mockResolvedValue(undefined);

      await deleteContactGroupFn("g1", "acc-1");

      expect(mockDeleteContactGroup).toHaveBeenCalledWith("g1", "acc-1");
    });
  });

  describe("getContactCountForGroup", () => {
    it("delegates to dbGetContactCountForGroup", async () => {
      mockGetContactCountForGroup.mockResolvedValue(25);

      const result = await getContactCountForGroupFn("g1");

      expect(result).toBe(25);
      expect(mockGetContactCountForGroup).toHaveBeenCalledWith("g1");
    });
  });

  describe("addContactToGroup", () => {
    it("delegates to dbAddContactToGroup", async () => {
      mockAddContactToGroup.mockResolvedValue(undefined);

      await addContactToGroupFn("contact-1", "g1");

      expect(mockAddContactToGroup).toHaveBeenCalledWith("contact-1", "g1");
    });
  });

  describe("removeContactFromGroup", () => {
    it("delegates to dbRemoveContactFromGroup", async () => {
      mockRemoveContactFromGroup.mockResolvedValue(undefined);

      await removeContactFromGroupFn("contact-1", "g1");

      expect(mockRemoveContactFromGroup).toHaveBeenCalledWith("contact-1", "g1");
    });
  });

  describe("getContactGroupIds", () => {
    it("delegates to dbGetContactGroupMembers", async () => {
      const members = [{ contact_id: "c1" }, { contact_id: "c2" }];
      mockGetContactGroupMembers.mockResolvedValue(members);

      const result = await getContactGroupIds("g1");

      expect(result).toEqual(members);
      expect(mockGetContactGroupMembers).toHaveBeenCalledWith("g1");
    });
  });
});
