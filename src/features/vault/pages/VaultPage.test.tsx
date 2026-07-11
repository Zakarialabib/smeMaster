import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const unlockedStore = {
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
  unlocked: true,
  pinMode: "none",
  loadDir: vi.fn(),
  navigateTo: vi.fn(),
  navigateUp: vi.fn(),
  deleteEntry: vi.fn(),
  uploadFile: vi.fn(),
  createFolder: vi.fn(),
  refreshVaultSize: vi.fn(),
  unlock: vi.fn(),
  unlockWithPin: vi.fn(),
  setupPin: vi.fn(),
  setPinMode: vi.fn(),
  checkPinExists: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("../stores/vaultStore", () => ({
  useVaultStore: () => ({ ...unlockedStore, isLoading: true }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@shared/services/db/pgpKeys", () => ({ getPgpKeys: vi.fn().mockResolvedValue([]) }));
vi.mock("../components/VaultFilePreview", () => ({
  VaultFilePreview: () => <div data-testid="vault-preview" />,
}));
vi.mock("../components/VaultBreadcrumb", () => ({
  VaultBreadcrumb: () => <div data-testid="vault-breadcrumb" />,
}));
vi.mock("../components/VaultSearchBar", () => ({
  VaultSearchBar: () => <div data-testid="vault-search" />,
}));
vi.mock("../components/VaultFileList", () => ({
  VaultFileList: () => <div data-testid="vault-list" />,
}));
vi.mock("../components/VaultUploadZone", () => ({
  VaultUploadZone: () => <div data-testid="vault-upload" />,
}));
vi.mock("../components/VaultEmptyState", () => ({
  VaultEmptyState: () => <div data-testid="vault-empty" />,
}));
vi.mock("../components/VaultStorageIndicator", () => ({
  VaultStorageIndicator: () => <div data-testid="vault-storage" />,
}));
vi.mock("../components/VaultToolbar", () => ({
  VaultToolbar: () => <div data-testid="vault-toolbar" />,
}));

import { VaultPage } from "./VaultPage";

describe("VaultPage — a11y: aria-busy + aria-live", () => {
  it("marks the file list region as busy while loading with no entries", () => {
    render(<VaultPage />);
    const region = screen.getByLabelText("Vault file list");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveAttribute("aria-live", "polite");
  });
});
