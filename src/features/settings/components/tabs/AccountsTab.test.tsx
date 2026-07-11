import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AccountsTab from "./AccountsTab";
import { useAccountStore } from "@features/accounts/stores/accountStore";

// Mock dependencies
vi.mock("@features/accounts/stores/accountStore", () => ({
  useAccountStore: vi.fn(),
}));

vi.mock("@features/settings/db/settings", () => ({
  getSetting: vi.fn().mockResolvedValue(""),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getSecureSetting: vi.fn().mockResolvedValue(""),
  setSecureSetting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@shared/services/notifications/toastHelper", () => ({
  notify: vi.fn(),
}));

vi.mock("@features/accounts/db/accounts", () => ({
  deleteAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@features/mail/services/gmail/tokenManager", () => ({
  removeClient: vi.fn(),
  reauthorizeAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@features/mail/services/gmail/syncManager", () => ({
  triggerSync: vi.fn().mockResolvedValue(undefined),
  forceFullSync: vi.fn().mockResolvedValue(undefined),
  resyncAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../SendAsAliasesSection", () => ({
  default: () => <div data-testid="send-as-aliases">Send As Aliases</div>,
}));

vi.mock("../SyncOfflineSection", () => ({
  default: () => <div data-testid="sync-offline">Sync Offline</div>,
}));

vi.mock("@features/calendar/components/settings/ImapCalDavSection", () => ({
  default: () => <div data-testid="imap-caldav">Imap CalDav</div>,
}));

vi.mock("@features/accounts/components/AddAccount", () => ({
  AddAccount: ({ onClose }: any) => (
    <div data-testid="add-account-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

describe("AccountsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAccountStore as any).mockImplementation((selector: any) => selector({
      accounts: [],
      removeAccount: vi.fn(),
    }));
  });

  it("renders 'No accounts connected' when accounts list is empty", () => {
    render(<AccountsTab />);
    expect(screen.getByText(/No mail accounts connected/i)).toBeInTheDocument();
  });

  it("renders connected accounts", () => {
    const mockAccounts = [
      { id: "acc_1", email: "test@example.com", provider: "gmail", isActive: true },
    ];
    (useAccountStore as any).mockImplementation((selector: any) => selector({
      accounts: mockAccounts,
      removeAccount: vi.fn(),
    }));

    render(<AccountsTab />);
    expect(screen.getAllByText("test@example.com").length).toBeGreaterThan(0);
  });

  it("opens AddAccount modal when 'Add Account' button is clicked", () => {
    render(<AccountsTab />);
    const addButton = screen.getByText(/Add Mail Account/i);
    fireEvent.click(addButton);
    expect(screen.getByTestId("add-account-modal")).toBeInTheDocument();
  });
});
