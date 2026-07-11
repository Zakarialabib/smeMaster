import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/shared/services/db/db-invoke", () => ({
  getContactFiles: vi.fn(),
  searchContactFiles: vi.fn(),
  saveContactFile: vi.fn(),
  getContactFilesBySender: vi.fn(),
  getContactFilesByAccount: vi.fn(),
  getContactFilesByCategory: vi.fn(),
  getContactFileCategories: vi.fn(),
  updateContactFileCategory: vi.fn(),
  toggleContactFileStarred: vi.fn(),
  deleteContactFile: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import {
  getContactFiles,
  searchContactFiles,
  saveContactFile,
  getContactFilesBySender,
  getContactFilesByAccount,
  getContactFilesByCategory,
  getContactFileCategories,
  updateContactFileCategory,
  toggleContactFileStarred,
  deleteContactFile,
} from "../../../shared/services/db/db-invoke";
import { invoke } from "@tauri-apps/api/core";
import {
  saveContactFile as saveContactFileFn,
  getContactFilesByContact,
  getContactFilesBySender as getContactFilesBySenderFn,
  getContactFilesByAccount as getContactFilesByAccountFn,
  searchContactFiles as searchContactFilesFn,
  getContactFilesByCategory as getContactFilesByCategoryFn,
  getContactFileCategories as getContactFileCategoriesFn,
  updateFileCategory,
  toggleFileStarred,
  deleteContactFile as deleteContactFileFn,
} from "./contactFiles";

const mockGetContactFiles = vi.mocked(getContactFiles);
const mockSearchContactFiles = vi.mocked(searchContactFiles);
const mockSaveContactFile = vi.mocked(saveContactFile);
const mockGetContactFilesBySender = vi.mocked(getContactFilesBySender);
const mockGetContactFilesByAccount = vi.mocked(getContactFilesByAccount);
const mockGetContactFilesByCategory = vi.mocked(getContactFilesByCategory);
const mockGetContactFileCategories = vi.mocked(getContactFileCategories);
const mockUpdateContactFileCategory = vi.mocked(updateContactFileCategory);
const mockToggleContactFileStarred = vi.mocked(toggleContactFileStarred);
const mockDeleteContactFile = vi.mocked(deleteContactFile);
const mockInvoke = vi.mocked(invoke);

describe("contactFiles service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveContactFile", () => {
    it("delegates to dbSaveContactFile with file data", async () => {
      mockSaveContactFile.mockResolvedValue(undefined);

      await saveContactFileFn({
        companyId: "acc-1",
        contactId: "contact-1",
        filename: "doc.pdf",
        originalName: "document.pdf",
        mimeType: "application/pdf",
        size: 1024,
        category: "document",
        senderEmail: "sender@example.com",
        messageId: "msg-1",
        localPath: "/vault/doc.pdf",
      });

      expect(mockSaveContactFile).toHaveBeenCalledWith({
        companyId: "acc-1",
        contactId: "contact-1",
        filename: "doc.pdf",
        originalName: "document.pdf",
        mimeType: "application/pdf",
        size: 1024,
        category: "document",
        senderEmail: "sender@example.com",
        messageId: "msg-1",
        localPath: "/vault/doc.pdf",
      });
    });
  });

  describe("getContactFilesByContact", () => {
    it("delegates to getContactFiles with contactId", async () => {
      const files = [{ id: "f1", filename: "doc.pdf" }];
      mockGetContactFiles.mockResolvedValue(files as never);

      const result = await getContactFilesByContact("contact-1");

      expect(result).toEqual(files);
      expect(mockGetContactFiles).toHaveBeenCalledWith("contact-1");
    });
  });

  describe("getContactFilesBySender", () => {
    it("delegates to dbGetContactFilesBySender", async () => {
      const files = [{ id: "f1", sender_email: "a@b.com" }];
      mockGetContactFilesBySender.mockResolvedValue(files as never);

      const result = await getContactFilesBySenderFn("a@b.com");

      expect(result).toEqual(files);
      expect(mockGetContactFilesBySender).toHaveBeenCalledWith("a@b.com");
    });
  });

  describe("getContactFilesByAccount", () => {
    it("delegates to dbGetContactFilesByAccount", async () => {
      const files = [{ id: "f1" }];
      mockGetContactFilesByAccount.mockResolvedValue(files as never);

      const result = await getContactFilesByAccountFn("acc-1");

      expect(result).toEqual(files);
      expect(mockGetContactFilesByAccount).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("searchContactFiles", () => {
    it("delegates to dbSearchContactFiles with query", async () => {
      const files = [{ id: "f1", filename: "report.pdf" }];
      mockSearchContactFiles.mockResolvedValue(files as never);

      const result = await searchContactFilesFn("report");

      expect(result).toEqual(files);
      expect(mockSearchContactFiles).toHaveBeenCalledWith("report");
    });
  });

  describe("getContactFilesByCategory", () => {
    it("delegates to dbGetContactFilesByCategory", async () => {
      const files = [{ id: "f1", category: "invoice" }];
      mockGetContactFilesByCategory.mockResolvedValue(files as never);

      const result = await getContactFilesByCategoryFn("acc-1", "invoice");

      expect(result).toEqual(files);
      expect(mockGetContactFilesByCategory).toHaveBeenCalledWith("acc-1", "invoice");
    });
  });

  describe("getContactFileCategories", () => {
    it("delegates to dbGetContactFileCategories", async () => {
      const categories = ["invoice", "contract", "document"];
      mockGetContactFileCategories.mockResolvedValue(categories);

      const result = await getContactFileCategoriesFn("acc-1");

      expect(result).toEqual(categories);
      expect(mockGetContactFileCategories).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("updateFileCategory", () => {
    it("delegates to dbUpdateContactFileCategory", async () => {
      mockUpdateContactFileCategory.mockResolvedValue(undefined);

      await updateFileCategory("f1", "invoice");

      expect(mockUpdateContactFileCategory).toHaveBeenCalledWith("f1", "invoice");
    });
  });

  describe("toggleFileStarred", () => {
    it("delegates to dbToggleContactFileStarred", async () => {
      mockToggleContactFileStarred.mockResolvedValue(undefined);

      await toggleFileStarred("f1");

      expect(mockToggleContactFileStarred).toHaveBeenCalledWith("f1");
    });
  });

  describe("deleteContactFile", () => {
    it("delegates to dbDeleteContactFile", async () => {
      mockDeleteContactFile.mockResolvedValue(null);

      await deleteContactFileFn("f1");

      expect(mockDeleteContactFile).toHaveBeenCalledWith("f1");
    });

    it("invokes delete_from_vault when localPath is returned", async () => {
      mockDeleteContactFile.mockResolvedValue("/vault/doc.pdf");
      mockInvoke.mockResolvedValue(undefined);

      await deleteContactFileFn("f1");

      expect(mockDeleteContactFile).toHaveBeenCalledWith("f1");
      expect(mockInvoke).toHaveBeenCalledWith("delete_from_vault", {
        vaultPath: "/vault/doc.pdf",
      });
    });

    it("does not throw when delete_from_vault fails", async () => {
      mockDeleteContactFile.mockResolvedValue("/vault/doc.pdf");
      mockInvoke.mockRejectedValue(new Error("file not found"));

      await expect(deleteContactFileFn("f1")).resolves.toBeUndefined();
      expect(mockInvoke).toHaveBeenCalledWith("delete_from_vault", {
        vaultPath: "/vault/doc.pdf",
      });
    });
  });
});
