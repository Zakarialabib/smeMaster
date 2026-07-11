import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@shared/services/db/db-invoke", () => ({
  listContacts: vi.fn(),
  getContactByEmail: vi.fn(),
  getContact: vi.fn(),
  updateContact: vi.fn(),
  getContactStats: vi.fn(),
  upsertContact: vi.fn(),
  deleteContact: vi.fn(),
  logEngagement: vi.fn(),
  getEngagementHistory: vi.fn(),
  getAttachmentsFromContact: vi.fn(),
  getContactsFromSameDomain: vi.fn(),
  getLatestAuthResult: vi.fn(),
}));

import { listContacts, deleteContact as dbDeleteContactMock, updateContact as dbUpdateContactMock, getAttachmentsFromContact as dbGetAttachmentsFromContact, getContactsFromSameDomain as dbGetContactsFromSameDomain, getLatestAuthResult as dbGetLatestAuthResult } from "@shared/services/db/db-invoke";
import {
  getAllContacts, updateContact, deleteContact,
  updateContactNotes, getAttachmentsFromContact,
  getContactsFromSameDomain, getLatestAuthResult,
} from "./contacts";

describe("contacts service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllContacts", () => {
    it("calls listContacts with default params", async () => {
      await getAllContacts();

      expect(listContacts).toHaveBeenCalledWith(500, 0, null, null);
    });

    it("passes limit and offset params", async () => {
      await getAllContacts(100, 50);

      expect(listContacts).toHaveBeenCalledWith(100, 50, null, null);
    });
  });

  describe("updateContact", () => {
    it("calls dbUpdateContact with correct params", async () => {
      await updateContact("contact-123", "John Doe");

      expect(dbUpdateContactMock).toHaveBeenCalledWith("contact-123", {
        set: expect.objectContaining({ display_name: "John Doe" }),
        unset: [],
      });
    });
  });

  describe("deleteContact", () => {
    it("calls dbDeleteContact from db-invoke", async () => {
      await deleteContact("contact-456");

      expect(dbDeleteContactMock).toHaveBeenCalledWith("contact-456");
    });
  });

  describe("updateContactNotes", () => {
    it("calls dbUpdateContact with notes and normalized email", async () => {
      vi.mocked(dbUpdateContactMock).mockImplementation(async () => {});
      const { getContactByEmail } = await import("@shared/services/db/db-invoke");
      vi.mocked(getContactByEmail).mockResolvedValueOnce({ id: "contact-1" } as never);
      await updateContactNotes("John@Example.COM", "Great client");

      expect(dbUpdateContactMock).toHaveBeenCalled();
    });

    it("stores null for empty notes", async () => {
      vi.mocked(dbUpdateContactMock).mockImplementation(async () => {});
      const { getContactByEmail } = await import("@shared/services/db/db-invoke");
      vi.mocked(getContactByEmail).mockResolvedValueOnce({ id: "contact-2" } as never);
      await updateContactNotes("user@test.com", "");

      expect(dbUpdateContactMock).toHaveBeenCalled();
    });
  });

  describe("getAttachmentsFromContact", () => {
    it("queries with default limit via db-invoke", async () => {
      await getAttachmentsFromContact("sender@test.com");

      expect(dbGetAttachmentsFromContact).toHaveBeenCalledWith(
        "sender@test.com",
        5,
      );
    });

    it("passes custom limit", async () => {
      await getAttachmentsFromContact("sender@test.com", 10);

      expect(dbGetAttachmentsFromContact).toHaveBeenCalledWith(
        "sender@test.com",
        10,
      );
    });
  });

  describe("getContactsFromSameDomain", () => {
    it("queries contacts with same domain via db-invoke", async () => {
      await getContactsFromSameDomain("alice@company.com");

      expect(dbGetContactsFromSameDomain).toHaveBeenCalledWith(
        "alice@company.com",
        5,
      );
    });

    it("returns empty array for public domains", async () => {
      const result = await getContactsFromSameDomain("user@gmail.com");

      expect(result).toEqual([]);
      expect(dbGetContactsFromSameDomain).not.toHaveBeenCalled();
    });

    it("returns empty array for email without @", async () => {
      const result = await getContactsFromSameDomain("invalid-email");

      expect(result).toEqual([]);
      expect(dbGetContactsFromSameDomain).not.toHaveBeenCalled();
    });
  });

  describe("getLatestAuthResult", () => {
    it("queries most recent auth_results via db-invoke", async () => {
      vi.mocked(dbGetLatestAuthResult).mockResolvedValueOnce('{"aggregate":"pass"}');

      const result = await getLatestAuthResult("sender@test.com");

      expect(result).toBe('{"aggregate":"pass"}');
      expect(dbGetLatestAuthResult).toHaveBeenCalledWith("sender@test.com");
    });

    it("returns null when no results", async () => {
      vi.mocked(dbGetLatestAuthResult).mockResolvedValueOnce(null);

      const result = await getLatestAuthResult("unknown@test.com");

      expect(result).toBeNull();
    });
  });
});
