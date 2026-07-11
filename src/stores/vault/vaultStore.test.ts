import { describe, it, expect, beforeEach, vi } from "vitest";
import { useVaultStore, type VaultFileItem } from "@/stores/vault";

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
}));

import {
  getVaultRoot,
  listVaultDir,
  createVaultDir,
  getVaultSize,
  searchVault,
} from "@shared/services/vault/vaultService";

const mockEntries: VaultFileItem[] = [
  { name: "doc.pdf", path: "/vault/doc.pdf", isDir: false },
  { name: "photos", path: "/vault/photos", isDir: true },
  { name: "notes.txt", path: "/vault/notes.txt", isDir: false },
];

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

describe("vaultStore", () => {
  describe("default state", () => {
    it("should have correct defaults", () => {
      const state = useVaultStore.getState();
      expect(state.entries).toEqual([]);
      expect(state.vaultRoot).toBe("");
      expect(state.currentPath).toBe("");
      expect(state.searchResults).toBeNull();
      expect(state.vaultSize).toBe(0);
      expect(state.viewMode).toBe("grid");
      expect(state.sortField).toBe("name");
      expect(state.sortDirection).toBe("asc");
      expect(state.searchQuery).toBe("");
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.bioAvailable).toBe(false);
      expect(state.unlocked).toBe(false);
      expect(state.pinMode).toBe("none");
    });
  });

  describe("loadDir", () => {
    it("should load and sort entries", async () => {
      vi.mocked(getVaultRoot).mockResolvedValue("/vault");
      vi.mocked(listVaultDir).mockResolvedValue([
        { path: "/vault/doc.pdf", isDir: false },
        { path: "/vault/photos", isDir: true },
        { path: "/vault/notes.txt", isDir: false },
      ]);

      await useVaultStore.getState().loadDir("");

      const { entries, vaultRoot, currentPath, isLoading, error } =
        useVaultStore.getState();

      expect(getVaultRoot).toHaveBeenCalled();
      expect(listVaultDir).toHaveBeenCalledWith("/vault", "default");
      expect(vaultRoot).toBe("/vault");
      expect(currentPath).toBe("");
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
      // Directories first, then sorted by name
      expect(entries[0].name).toBe("photos");
      expect(entries[0].isDir).toBe(true);
      expect(entries[1].name).toBe("doc.pdf");
      expect(entries[2].name).toBe("notes.txt");
    });

    it("should set loading state during fetch", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(getVaultRoot).mockReturnValue(promise as never);

      const loadPromise = useVaultStore.getState().loadDir("");
      expect(useVaultStore.getState().isLoading).toBe(true);

      resolvePromise!("/vault");
      await loadPromise;
      expect(useVaultStore.getState().isLoading).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(getVaultRoot).mockRejectedValue(new Error("Vault error"));

      await useVaultStore.getState().loadDir("");

      const { error, isLoading } = useVaultStore.getState();
      expect(error).toBe("Vault error");
      expect(isLoading).toBe(false);
    });
  });

  describe("navigateTo", () => {
    it("should call loadDir with the given path", async () => {
      vi.mocked(getVaultRoot).mockResolvedValue("/vault");
      vi.mocked(listVaultDir).mockResolvedValue([]);

      useVaultStore.getState().navigateTo("subdir");
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(listVaultDir).toHaveBeenCalledWith("/vault/subdir", "default");
    });
  });

  describe("navigateUp", () => {
    it("should remove the last path segment", async () => {
      useVaultStore.setState({ currentPath: "a/b/c" });
      vi.mocked(getVaultRoot).mockResolvedValue("/vault");
      vi.mocked(listVaultDir).mockResolvedValue([]);

      await useVaultStore.getState().navigateUp();

      expect(listVaultDir).toHaveBeenCalledWith("/vault/a/b", "default");
    });

    it("should do nothing if currentPath is empty", () => {
      useVaultStore.setState({ currentPath: "" });
      useVaultStore.getState().navigateUp();
      expect(listVaultDir).not.toHaveBeenCalled();
    });
  });

  describe("navigateToBreadcrumb", () => {
    it("should navigate to the breadcrumb at the given index", async () => {
      useVaultStore.setState({ currentPath: "a/b/c" });
      vi.mocked(getVaultRoot).mockResolvedValue("/vault");
      vi.mocked(listVaultDir).mockResolvedValue([]);

      await useVaultStore.getState().navigateToBreadcrumb(1);

      expect(listVaultDir).toHaveBeenCalledWith("/vault/a/b", "default");
    });
  });

  describe("setSortField", () => {
    it("should set the sort field and re-sort entries", () => {
      useVaultStore.setState({
        entries: mockEntries,
        sortField: "name",
        sortDirection: "asc",
      });

      useVaultStore.getState().setSortField("size");

      expect(useVaultStore.getState().sortField).toBe("size");
    });
  });

  describe("toggleSortDirection", () => {
    it("should toggle from asc to desc", () => {
      useVaultStore.setState({
        entries: mockEntries,
        sortDirection: "asc",
      });

      useVaultStore.getState().toggleSortDirection();

      expect(useVaultStore.getState().sortDirection).toBe("desc");
    });

    it("should toggle from desc to asc", () => {
      useVaultStore.setState({
        entries: mockEntries,
        sortDirection: "desc",
      });

      useVaultStore.getState().toggleSortDirection();

      expect(useVaultStore.getState().sortDirection).toBe("asc");
    });
  });

  describe("setSearchQuery", () => {
    it("should set the search query", () => {
      useVaultStore.getState().setSearchQuery("test");
      expect(useVaultStore.getState().searchQuery).toBe("test");
    });
  });

  describe("executeSearch", () => {
    it("should perform a search and store results", async () => {
      useVaultStore.setState({ vaultRoot: "/vault", currentPath: "" });
      vi.mocked(searchVault).mockResolvedValue(["/vault/doc.pdf"]);

      await useVaultStore.getState().executeSearch("*.pdf");

      expect(searchVault).toHaveBeenCalledWith("/vault", "*.pdf", "default");
      expect(useVaultStore.getState().searchResults).toEqual(["/vault/doc.pdf"]);
      expect(useVaultStore.getState().searchQuery).toBe("*.pdf");
      expect(useVaultStore.getState().isLoading).toBe(false);
    });

    it("should clear search results when no vaultRoot", async () => {
      useVaultStore.setState({ vaultRoot: "" });

      await useVaultStore.getState().executeSearch("test");

      expect(useVaultStore.getState().searchResults).toBeNull();
      expect(useVaultStore.getState().searchQuery).toBe("");
    });

    it("should handle search errors gracefully", async () => {
      useVaultStore.setState({ vaultRoot: "/vault" });
      vi.mocked(searchVault).mockRejectedValue(new Error("Search failed"));

      await useVaultStore.getState().executeSearch("test");

      expect(useVaultStore.getState().error).toBe("Search failed");
      expect(useVaultStore.getState().isLoading).toBe(false);
    });
  });

  describe("clearSearch", () => {
    it("should clear search results and query", () => {
      useVaultStore.setState({
        searchResults: ["/vault/doc.pdf"],
        searchQuery: "doc",
      });

      useVaultStore.getState().clearSearch();

      expect(useVaultStore.getState().searchResults).toBeNull();
      expect(useVaultStore.getState().searchQuery).toBe("");
    });
  });

  describe("setViewMode", () => {
    it("should set view mode to list", () => {
      useVaultStore.getState().setViewMode("list");
      expect(useVaultStore.getState().viewMode).toBe("list");
    });

    it("should set view mode to grid", () => {
      useVaultStore.setState({ viewMode: "list" });
      useVaultStore.getState().setViewMode("grid");
      expect(useVaultStore.getState().viewMode).toBe("grid");
    });
  });

  describe("createFolder", () => {
    it("should create a folder and reload", async () => {
      useVaultStore.setState({ vaultRoot: "/vault", currentPath: "" });
      vi.mocked(createVaultDir).mockResolvedValue(undefined);
      vi.mocked(getVaultRoot).mockResolvedValue("/vault");
      vi.mocked(listVaultDir).mockResolvedValue([]);

      await useVaultStore.getState().createFolder("NewFolder");

      expect(createVaultDir).toHaveBeenCalledWith("/vault/NewFolder");
      expect(listVaultDir).toHaveBeenCalled();
    });

    it("should do nothing if folderName is empty", async () => {
      useVaultStore.setState({ vaultRoot: "/vault", currentPath: "" });

      await useVaultStore.getState().createFolder("");

      expect(createVaultDir).not.toHaveBeenCalled();
    });

    it("should create folder inside subdirectory", async () => {
      useVaultStore.setState({ vaultRoot: "/vault", currentPath: "subdir" });
      vi.mocked(createVaultDir).mockResolvedValue(undefined);
      vi.mocked(getVaultRoot).mockResolvedValue("/vault");
      vi.mocked(listVaultDir).mockResolvedValue([]);

      await useVaultStore.getState().createFolder("NewFolder");

      expect(createVaultDir).toHaveBeenCalledWith("/vault/subdir/NewFolder");
    });
  });

  describe("reset", () => {
    it("should reset state to initial values", () => {
      useVaultStore.setState({
        entries: mockEntries,
        vaultRoot: "/vault",
        currentPath: "subdir",
        viewMode: "list",
        vaultSize: 1024,
      });

      useVaultStore.getState().reset();

      const state = useVaultStore.getState();
      expect(state.entries).toEqual([]);
      expect(state.vaultRoot).toBe("");
      expect(state.currentPath).toBe("");
      expect(state.viewMode).toBe("grid");
      expect(state.vaultSize).toBe(0);
      expect(state.error).toBeNull();
    });
  });

  describe("refreshVaultSize", () => {
    it("should update vault size", async () => {
      vi.mocked(getVaultSize).mockResolvedValue(2048);

      await useVaultStore.getState().refreshVaultSize();

      expect(useVaultStore.getState().vaultSize).toBe(2048);
    });

    it("should silently ignore errors", async () => {
      vi.mocked(getVaultSize).mockRejectedValue(new Error("Fail"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useVaultStore.getState().refreshVaultSize();

      expect(useVaultStore.getState().vaultSize).toBe(0);
      consoleSpy.mockRestore();
    });
  });
});
