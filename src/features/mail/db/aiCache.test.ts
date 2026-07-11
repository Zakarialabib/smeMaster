import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/shared/services/db/db-invoke", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/db/db-invoke")>();
  return {
    ...actual,
  };
});

import { invoke } from "@tauri-apps/api/core";
import { getAiCache, setAiCache, deleteAiCache } from "./aiCache";

const mockInvoke = vi.mocked(invoke);

describe("aiCache service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAiCache", () => {
    it("returns content when cache entry exists", async () => {
      mockInvoke.mockResolvedValue({ content: "cached summary" });
      const result = await getAiCache("acc-1", "thread-1", "summary");
      expect(result).toBe("cached summary");
      expect(mockInvoke).toHaveBeenCalledWith("db_get_ai_cache", {
        accountId: "acc-1",
        threadId: "thread-1",
        cacheType: "summary",
      });
    });

    it("returns null when no cache entry exists", async () => {
      mockInvoke.mockResolvedValue(null);
      const result = await getAiCache("acc-1", "thread-1", "summary");
      expect(result).toBeNull();
    });

    it("returns null when result has no content", async () => {
      mockInvoke.mockResolvedValue({});
      const result = await getAiCache("acc-1", "thread-1", "summary");
      expect(result).toBeNull();
    });
  });

  describe("setAiCache", () => {
    it("calls db_set_ai_cache with all parameters", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await setAiCache("acc-1", "thread-1", "summary", "AI generated content");
      expect(mockInvoke).toHaveBeenCalledWith("db_set_ai_cache", {
        accountId: "acc-1",
        threadId: "thread-1",
        cacheType: "summary",
        content: "AI generated content",
      });
    });
  });

  describe("deleteAiCache", () => {
    it("calls db_delete_ai_cache with composite id", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await deleteAiCache("acc-1", "thread-1", "summary");
      expect(mockInvoke).toHaveBeenCalledWith("db_delete_ai_cache", {
        id: "acc-1:thread-1:summary",
      });
    });
  });
});
