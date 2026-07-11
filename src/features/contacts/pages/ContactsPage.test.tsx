import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

// ── Mock external dependencies ──────────────────────────────────────────────

vi.mock("@tanstack/react-router", () => {
  function makeMockRoute(id: string) {
    return {
      id,
      addChildren: () => makeMockRoute(`${id}-with-children`),
    };
  }
  return {
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: "/" }),
    useParams: () => ({}),
    useMatches: () => [],
    Link: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Outlet: () => null,
    createRootRoute: () => makeMockRoute("root"),
    createRoute: () => makeMockRoute("test"),
    createRouter: () => ({ navigate: vi.fn() }),
    createHashHistory: () => ({}),
    RouterProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("@/router/navigate", () => ({
  navigateToLabel: () => {},
  navigateToThread: () => {},
  navigateBack: () => {},
  navigateToSettings: () => {},
  navigateToHelp: () => {},
  navigateToLicense: () => {},
  getActiveLabel: () => null,
  getSelectedThreadId: () => null,
}));

vi.mock("@features/accounts/stores/accountStore", () => ({
  useAccountStore: (selector: (s: { accounts: Array<{ id: string; isActive: boolean }> }) => unknown) =>
    selector({ accounts: [{ id: "acc1", isActive: true }] }),
}));

vi.mock("@features/contacts/stores/contactStore", () => ({
  useContactStore: (selector: (s: { tags: unknown[]; segments: unknown[]; loadTags: vi.fn; loadGroups: vi.fn; loadSegments: vi.fn }) => unknown) =>
    selector({
      tags: [],
      segments: [],
      loadTags: vi.fn(),
      loadGroups: vi.fn(),
      loadSegments: vi.fn(),
    }),
}));

vi.mock("@features/contacts/db/contacts.ts", () => ({
  getAllContacts: vi.fn().mockResolvedValue([]),
  countAllContacts: vi.fn().mockResolvedValue(0),
}));

const mockPaginationReturn = {
  items: [] as never[],
  total: 0,
  totalPages: 0,
  currentPage: 1,
  hasMore: false,
  loading: false,
  error: null,
  loadMore: () => {},
  goToPage: () => {},
  reset: () => {},
  setPageSize: () => {},
};

vi.mock("@shared/hooks/usePagination", () => ({
  usePagination: () => mockPaginationReturn,
}));

vi.mock("@shared/components/ui/PaginationControls", () => ({
  PaginationControls: () => null,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

vi.mock("@features/contacts/components/GroupManager", () => ({
  GroupManager: () => <div data-testid="group-manager" />,
}));

vi.mock("@features/contacts/components/CsvImportWizard", () => ({
  CsvImportWizard: () => <div data-testid="csv-import-wizard" />,
}));

vi.mock("@features/contacts/components/ContactMergeDialog", () => ({
  ContactMergeDialog: () => <div data-testid="contact-merge-dialog" />,
}));

vi.mock("@features/contacts/components/ContactSettingsModal", () => ({
  ContactSettingsModal: () => <div data-testid="contact-settings-modal" />,
}));

vi.mock("@features/contacts/services/merge", () => ({
  findMergeCandidates: vi.fn().mockResolvedValue([]),
  mergeContacts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@shared/components/ui/Modal", () => ({
  Modal: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="modal">
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

vi.mock("@shared/components/ui/Button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock("@shared/components/ui/EmptyState", () => ({
  EmptyState: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{subtitle}</p>
    </div>
  ),
}));

import { ContactsPage } from "./ContactsPage";

describe("ContactsPage", () => {
  it("renders the Contacts heading", () => {
    render(<ContactsPage />);
    expect(screen.getByRole("heading", { name: "Contacts" })).toBeInTheDocument();
  });

  it("renders the tab buttons", () => {
    render(<ContactsPage />);
    expect(screen.getByText("Contacts", { selector: "button" })).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Groups")).toBeInTheDocument();
    expect(screen.getByText("Segments")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    render(<ContactsPage />);
    expect(screen.getByPlaceholderText("Search contacts...")).toBeInTheDocument();
  });

  it("renders Import and Merge buttons", () => {
    render(<ContactsPage />);
    expect(screen.getByText("Import")).toBeInTheDocument();
    expect(screen.getByText("Merge")).toBeInTheDocument();
  });

  it("shows empty state when no contacts", async () => {
    render(<ContactsPage />);
    const emptyState = await screen.findByTestId("empty-state");
    expect(emptyState).toBeInTheDocument();
  });

  it("shows contacts tab as active by default", () => {
    render(<ContactsPage />);
    const contactsTab = screen.getByRole("button", { name: "Contacts" });
    expect(contactsTab.className).toContain("text-accent");
  });

  // ── a11y: aria-busy + aria-live on the list region ─────────────────────

  it("renders Contacts list region with correct aria attributes", () => {
    render(<ContactsPage />);
    const region = screen.getByLabelText("Contacts list");
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live", "polite");
    // With usePagination hook, loading state is managed internally
    // and resolves immediately when mocked
    expect(region).toHaveAttribute("aria-busy", "false");
  });
});
