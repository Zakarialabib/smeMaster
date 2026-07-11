import { describe, it, expect, beforeEach, vi } from "vitest";
import { useVaultStore } from "./vaultStore";

vi.mock("@shared/services/vault/vaultService", () => ({
  getVaultRoot: vi.fn(),
  listVaultDir: vi.fn(),
  deleteFromVault: vi.fn(),
  copyToVault: vi.fn(),
  copyToVaultEncrypted: vi.fn(),
  createVaultDir: vi.fn(),
  getVaultSize: vi.fn(),
  searchVault: vi.fn(),
  authenticateBiometric: vi.fn(),
  setVaultPin: vi.fn(),
  verifyVaultPin: vi.fn(),
  hasVaultPin: vi.fn(),
}));

import { getVaultRoot, listVaultDir } from "@shared/services/vault/vaultService";

beforeEach(() => {
  useVaultStore.setState({
    entries: [],
    vaultRoot: "",
    currentPath: "",
    searchResults: null,
    vaultSize: 0,
    viewMode: "grid",
    sortField: "name",
    sortDirection: "asc",
    searchQuery: "",
    isLoading: false,
    error: null,
    bioAvailable: false,
    unlocked: false,
    pinMode: "none",
  });
  vi.clearAllMocks();
});

describe("vaultStore — withMutation wiring", () => {
  it("isLoading is true while loadDir is pending", async () => {
    let resolveFn: (v: string) => void = () => {};
    vi.mocked(getVaultRoot).mockReturnValue(
      new Promise<string>((resolve) => {
        resolveFn = resolve;
      }) as never,
    );
    vi.mocked(listVaultDir).mockResolvedValue([]);

    const p = useVaultStore.getState().loadDir("");
    expect(useVaultStore.getState().isLoading).toBe(true);

    resolveFn("/vault");
    await p;
    expect(useVaultStore.getState().isLoading).toBe(false);
  });

  it("isLoading is false and error is set after loadDir failure", async () => {
    vi.mocked(getVaultRoot).mockRejectedValue(new Error("Vault error"));

    await useVaultStore.getState().loadDir("");

    const s = useVaultStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe("Vault error");
  });
});
