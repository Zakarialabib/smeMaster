import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid"),
}));

vi.mock("@/shared/services/db/db-invoke", () => ({
  listSignatures: vi.fn(),
  upsertSignature: vi.fn(),
  deleteSignature: vi.fn(),
  updateSignature: vi.fn(),
  clearDefaultSignature: vi.fn(),
  getDefaultSignature: vi.fn(),
  getSignatureAccount: vi.fn(),
}));

import {
  listSignatures,
  upsertSignature,
  deleteSignature,
  updateSignature,
  clearDefaultSignature,
  getDefaultSignature,
  getSignatureAccount,
} from "@/shared/services/db/db-invoke";
import { v4 as uuidv4 } from "uuid";
import {
  getSignaturesForAccount,
  getDefaultSignature as getDefaultSignatureFn,
  insertSignature,
  updateSignature as updateSignatureFn,
  deleteSignature as deleteSignatureFn,
} from "./signatures";

const mockListSignatures = vi.mocked(listSignatures);
const mockUpsertSignature = vi.mocked(upsertSignature);
const mockDeleteSignature = vi.mocked(deleteSignature);
const mockUpdateSignature = vi.mocked(updateSignature);
const mockClearDefaultSignature = vi.mocked(clearDefaultSignature);
const mockGetDefaultSignature = vi.mocked(getDefaultSignature);
const mockGetSignatureAccount = vi.mocked(getSignatureAccount);
const mockUuidv4 = vi.mocked(uuidv4);

describe("signatures service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSignaturesForAccount", () => {
    it("delegates to listSignatures with accountId", async () => {
      const sigs = [{ id: "s1", name: "Work" }];
      mockListSignatures.mockResolvedValue(sigs as never);

      const result = await getSignaturesForAccount("acc-1");

      expect(result).toEqual(sigs);
      expect(mockListSignatures).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("getDefaultSignature", () => {
    it("re-exports getDefaultSignature from db-invoke", async () => {
      const sig = { id: "s1", name: "Default" };
      mockGetDefaultSignature.mockResolvedValue(sig as never);

      const result = await getDefaultSignatureFn("acc-1");

      expect(result).toEqual(sig);
      expect(mockGetDefaultSignature).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("insertSignature", () => {
    it("generates uuid, clears default if isDefault, then upserts", async () => {
      mockClearDefaultSignature.mockResolvedValue(undefined);
      mockUpsertSignature.mockResolvedValue(undefined);

      const result = await insertSignature({
        accountId: "acc-1",
        name: "Work",
        bodyHtml: "<p>Best regards</p>",
        isDefault: true,
      });

      expect(result).toBe("mock-uuid");
      expect(mockUuidv4).toHaveBeenCalledOnce();
      expect(mockClearDefaultSignature).toHaveBeenCalledWith("acc-1");
      expect(mockUpsertSignature).toHaveBeenCalledWith({
        id: "mock-uuid",
        accountId: "acc-1",
        name: "Work",
        bodyHtml: "<p>Best regards</p>",
        isDefault: true,
      });
    });

    it("skips clearDefaultSignature when isDefault is false", async () => {
      mockUpsertSignature.mockResolvedValue(undefined);

      await insertSignature({
        accountId: "acc-1",
        name: "Personal",
        bodyHtml: "<p>Cheers</p>",
        isDefault: false,
      });

      expect(mockClearDefaultSignature).not.toHaveBeenCalled();
      expect(mockUpsertSignature).toHaveBeenCalledWith({
        id: "mock-uuid",
        accountId: "acc-1",
        name: "Personal",
        bodyHtml: "<p>Cheers</p>",
        isDefault: false,
      });
    });
  });

  describe("updateSignature", () => {
    it("updates name and bodyHtml fields", async () => {
      mockUpdateSignature.mockResolvedValue(undefined);

      await updateSignatureFn("s1", {
        name: "New Name",
        bodyHtml: "<p>New body</p>",
      });

      expect(mockUpdateSignature).toHaveBeenCalledWith("s1", {
        set: {
          name: "New Name",
          body_html: "<p>New body</p>",
        },
        unset: [],
      });
    });

    it("clears default and sets is_default when isDefault is true", async () => {
      mockGetSignatureAccount.mockResolvedValue([{ account_id: "acc-1" }]);
      mockClearDefaultSignature.mockResolvedValue(undefined);
      mockUpdateSignature.mockResolvedValue(undefined);

      await updateSignatureFn("s1", { isDefault: true });

      expect(mockGetSignatureAccount).toHaveBeenCalledWith("s1");
      expect(mockClearDefaultSignature).toHaveBeenCalledWith("acc-1");
      expect(mockUpdateSignature).toHaveBeenCalledWith("s1", {
        set: { is_default: 1 },
        unset: [],
      });
    });

    it("does not call updateSignature when no fields provided", async () => {
      await updateSignatureFn("s1", {});

      expect(mockUpdateSignature).not.toHaveBeenCalled();
    });

    it("does not call updateSignature when isDefault is explicitly false (no set key)", async () => {
      await updateSignatureFn("s1", { isDefault: false });

      expect(mockUpdateSignature).toHaveBeenCalledWith("s1", {
        set: { is_default: 0 },
        unset: [],
      });
    });
  });

  describe("deleteSignature", () => {
    it("re-exports deleteSignature from db-invoke", async () => {
      mockDeleteSignature.mockResolvedValue(undefined);

      await deleteSignatureFn("s1");

      expect(mockDeleteSignature).toHaveBeenCalledWith("s1");
    });
  });
});
