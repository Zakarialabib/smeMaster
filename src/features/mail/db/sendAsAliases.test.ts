import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/shared/services/db/db-invoke", () => ({
  listSendAsAliases: vi.fn(),
  upsertSendAsAlias: vi.fn(),
  deleteSendAsAlias: vi.fn(),
  setDefaultAlias: vi.fn(),
}));

import {
  getAliasesForAccount,
  upsertAlias,
  getDefaultAlias,
  setDefaultAlias,
  deleteAlias,
  mapDbAlias,
  type DbSendAsAlias,
} from "./sendAsAliases";

describe("sendAsAliases service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAliasesForAccount", () => {
    it("queries aliases ordered by is_primary DESC, email", async () => {
      const { listSendAsAliases } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(listSendAsAliases);

      await getAliasesForAccount("acc-1");

      expect(fn).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("upsertAlias", () => {
    it("inserts an alias with correct parameters", async () => {
      const { upsertSendAsAlias } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(upsertSendAsAlias);
      fn.mockResolvedValueOnce({ id: "new-alias-id" } as never);

      const id = await upsertAlias({
        accountId: "acc-1",
        email: "user@example.com",
        displayName: "User Name",
        isPrimary: true,
        isDefault: false,
        treatAsAlias: true,
        verificationStatus: "accepted",
      });

      expect(id).toBe("new-alias-id");
      expect(fn).toHaveBeenCalledWith({
        accountId: "acc-1",
        email: "user@example.com",
        displayName: "User Name",
        replyToAddress: null,
        signatureId: null,
        isPrimary: true,
        isDefault: false,
        treatAsAlias: true,
        verificationStatus: "accepted",
      });
    });

    it("defaults treatAsAlias and verificationStatus when not specified", async () => {
      const { upsertSendAsAlias } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(upsertSendAsAlias);
      fn.mockResolvedValueOnce({ id: "new-alias-id" } as never);

      await upsertAlias({
        accountId: "acc-1",
        email: "user@example.com",
      });

      expect(fn).toHaveBeenCalledWith({
        accountId: "acc-1",
        email: "user@example.com",
        displayName: null,
        replyToAddress: null,
        signatureId: null,
        isPrimary: null,
        isDefault: null,
        treatAsAlias: null,
        verificationStatus: "accepted",
      });
    });
  });

  describe("getDefaultAlias", () => {
    it("returns the default alias when one exists", async () => {
      const { listSendAsAliases } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(listSendAsAliases);
      const defaultAlias: DbSendAsAlias = {
        id: "alias-1",
        account_id: "acc-1",
        email: "default@example.com",
        display_name: "Default",
        reply_to_address: null,
        signature_id: null,
        is_primary: 0,
        is_default: 1,
        treat_as_alias: 1,
        verification_status: "accepted",
        created_at: 1000,
      };
      fn.mockResolvedValueOnce([defaultAlias] as never);

      const result = await getDefaultAlias("acc-1");

      expect(result).toEqual(defaultAlias);
      expect(fn).toHaveBeenCalledWith("acc-1");
    });

    it("falls back to primary alias when no default exists", async () => {
      const { listSendAsAliases } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(listSendAsAliases);
      const primary: DbSendAsAlias = {
        id: "alias-2",
        account_id: "acc-1",
        email: "primary@example.com",
        display_name: "Primary",
        reply_to_address: null,
        signature_id: null,
        is_primary: 1,
        is_default: 0,
        treat_as_alias: 1,
        verification_status: "accepted",
        created_at: 1000,
      };
      fn.mockResolvedValueOnce([primary] as never);

      const result = await getDefaultAlias("acc-1");

      expect(result).toEqual(primary);
    });

    it("returns null when no aliases exist", async () => {
      const { listSendAsAliases } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(listSendAsAliases);
      fn.mockResolvedValueOnce([] as never);

      const result = await getDefaultAlias("acc-1");

      expect(result).toBeNull();
    });
  });

  describe("setDefaultAlias", () => {
    it("delegates to dbSetDefaultAlias with accountId and aliasId", async () => {
      const { setDefaultAlias: dbSetDefaultAlias } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(dbSetDefaultAlias);

      await setDefaultAlias("acc-1", "alias-3");

      expect(fn).toHaveBeenCalledWith("acc-1", "alias-3");
    });
  });

  describe("deleteAlias", () => {
    it("deletes the alias by id", async () => {
      const { deleteSendAsAlias } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(deleteSendAsAlias);

      await deleteAlias("alias-5");

      expect(fn).toHaveBeenCalledWith("alias-5");
    });
  });

  describe("mapDbAlias", () => {
    it("maps DB row to domain object", () => {
      const db: DbSendAsAlias = {
        id: "alias-1",
        account_id: "acc-1",
        email: "test@example.com",
        display_name: "Test User",
        reply_to_address: "reply@example.com",
        signature_id: "sig-1",
        is_primary: 1,
        is_default: 0,
        treat_as_alias: 1,
        verification_status: "accepted",
        created_at: 1700000000,
      };

      const result = mapDbAlias(db);

      expect(result).toEqual({
        id: "alias-1",
        accountId: "acc-1",
        email: "test@example.com",
        displayName: "Test User",
        replyToAddress: "reply@example.com",
        signatureId: "sig-1",
        isPrimary: true,
        isDefault: false,
        treatAsAlias: true,
        verificationStatus: "accepted",
      });
    });

    it("maps zero values to false booleans", () => {
      const db: DbSendAsAlias = {
        id: "alias-2",
        account_id: "acc-1",
        email: "test@example.com",
        display_name: null,
        reply_to_address: null,
        signature_id: null,
        is_primary: 0,
        is_default: 0,
        treat_as_alias: 0,
        verification_status: "pending",
        created_at: 1700000000,
      };

      const result = mapDbAlias(db);

      expect(result.isPrimary).toBe(false);
      expect(result.isDefault).toBe(false);
      expect(result.treatAsAlias).toBe(false);
      expect(result.displayName).toBeNull();
      expect(result.replyToAddress).toBeNull();
      expect(result.signatureId).toBeNull();
    });
  });
});
