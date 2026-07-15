import { render, screen, waitFor, act } from "@testing-library/react";
import { vi } from "vitest";

// ── Shared promise control for deferred task loading ─────────────────────────
let resolveTasksPromise: ((tasks: any[]) => void) | null = null;

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

vi.mock("@features/tasks/hooks/useTaskViewPrefs", () => {
  const prefs = {
    viewMode: "list",
    density: "normal",
    sortField: "dueDate",
    sortDirection: "asc",
    dateFilter: "all",
    groupBy: "none",
    filterStatus: "incomplete",
    filterPriority: "all",
    setViewMode: vi.fn(),
    setDensity: vi.fn(),
    setSort: vi.fn(),
    setDateFilter: vi.fn(),
    setGroupBy: vi.fn(),
    setFilterStatus: vi.fn(),
    setFilterPriority: vi.fn(),
  };
  return {
    useTaskViewPrefs: (sel: (s: typeof prefs) => unknown) => sel(prefs),
    default: (sel: (s: typeof prefs) => unknown) => sel(prefs),
  };
});

vi.mock("@shared/hooks/useMobile", () => ({
  useMobile: () => false,
}));

vi.mock("@features/tasks/db/tasks", () => ({
  getTasksForAccountWithContactsPaginated: vi.fn(() => new Promise((resolve) => {
    resolveTasksPromise = resolve;
  })),
  countTasksForAccount: vi.fn().mockResolvedValue(0),
  insertTask: vi.fn().mockResolvedValue("new-id"),
  completeTask: vi.fn().mockResolvedValue(undefined),
  uncompleteTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  updateTask: vi.fn().mockResolvedValue(undefined),
  getSubtasks: vi.fn().mockResolvedValue([]),
  getIncompleteTaskCount: vi.fn().mockResolvedValue(0),
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

vi.mock("@features/tasks/services/taskManager", () => ({
  handleRecurringTaskCompletion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@features/tasks/components/TaskItem", () => ({
  TaskItem: ({ task }: { task: { title: string } }) => (
    <div data-testid="task-item">{task.title}</div>
  ),
}));

vi.mock("@features/tasks/components/TaskDetailPanel", () => ({
  TaskDetailPanel: () => <div data-testid="task-detail-panel" />,
}));

vi.mock("@features/tasks/components/TaskCreateModal", () => ({
  TaskCreateModal: ({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (id: string) => void }) =>
    isOpen ? (
      <div data-testid="task-create-modal">
        <button onClick={() => onCreated("new-id")}>Confirm create</button>
        <button onClick={onClose}>Close modal</button>
      </div>
    ) : null,
}));

vi.mock("@shared/components/ui/SwipeableRow", () => ({
  SwipeableRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@shared/components/ui/PullToRefresh", () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { TasksPage } from "./TasksPage";

describe("TasksPage", () => {
  beforeEach(() => {
    // Reset deferred promise for each test so a previous test's resolve
    // doesn't leak into the next test
    resolveTasksPromise = null;
  });

  it("renders the Tasks heading", () => {
    render(<TasksPage />);
    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    render(<TasksPage />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("renders filter dropdowns (desktop)", () => {
    render(<TasksPage />);
    // SmartFilterBar uses buttons, not <select> elements
    // Status filter shows "Active" radio button (filterStatus === "incomplete")
    expect(screen.getByRole("radio", { name: "Active" })).toBeInTheDocument();
    // Priority filter trigger shows "Priority" (filterPriority === "all")
    expect(screen.getByText("Priority")).toBeInTheDocument();
    // Group by trigger shows "Group" (groupBy === "none")
    expect(screen.getByText("Group")).toBeInTheDocument();
  });

  it("renders the task count badge", () => {
    // The mocked store returns no tasks, so the badge shows the current count (0).
    render(<TasksPage />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders the new-task action (desktop)", () => {
    render(<TasksPage />);
    // Desktop shows a header "New task" button (the mobile quick-add FAB is
    // gated on useMobile(), which is mocked to false in this suite).
    expect(screen.getByText("New task")).toBeInTheDocument();
  });

  it("shows empty state when no tasks and not loading", async () => {
    render(<TasksPage />);
    // Resolve the deferred tasks promise so loading completes
    await act(async () => {
      resolveTasksPromise?.([]);
    });
    // The empty state message should appear after loading completes
    const emptyMessage = await screen.findByText("No tasks yet");
    expect(emptyMessage).toBeInTheDocument();
  });

  // ── a11y: aria-busy + aria-live on the task list region ─────────────────

  it("renders Tasks list region with correct aria attributes", async () => {
    render(<TasksPage />);
    // With usePagination hook mocked, loading resolves immediately
    const region = screen.getByLabelText("Tasks list");
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-busy", "false");
  });
});
