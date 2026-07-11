import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmailList } from "./EmailList";
import { useThreadStore } from "@features/mail/stores/threadStore";

// jsdom in this environment provides no localStorage global; provide an
// in-memory polyfill so components that persist to localStorage (SavedViews) work.
beforeAll(() => {
  if (typeof globalThis.localStorage === "undefined") {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      get length() {
        return store.size;
      },
    } as Storage;
  }
});

// Mock dependencies
vi.mock("@features/mail/stores/threadStore", () => ({
  useThreadStore: vi.fn(),
}));

vi.mock("@features/accounts/stores/accountStore", () => ({
  useAccountStore: vi.fn((selector) => selector({ activeAccountId: "acc_1" })),
}));

vi.mock("@shared/stores/layoutStore", () => ({
  useLayoutStore: vi.fn((selector) => selector({
    readFilter: "all",
    readingPanePosition: "right",
    inboxViewMode: "split",
    viewMode: "list",
    setReadFilter: vi.fn(),
    setViewMode: vi.fn(),
  })),
}));

vi.mock("@shared/hooks/useRouteNavigation", () => ({
  useActiveLabel: () => "inbox",
  useSelectedThreadId: () => null,
  useActiveCategory: () => "All",
}));

vi.mock("../../hooks/useEmailThreads", () => ({
  useEmailThreads: () => ({ isLoading: false, refetch: vi.fn() }),
}));

vi.mock("../../hooks/useEmailMutations", () => ({
  useArchiveThread: () => ({ mutateAsync: vi.fn() }),
  useDeleteThread: () => ({ mutateAsync: vi.fn() }),
  useMarkRead: () => ({ mutateAsync: vi.fn() }),
  useMarkUnread: () => ({ mutateAsync: vi.fn() }),
  useStarThread: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@shared/services/db/threads", () => ({
  getThreadsForAccount: vi.fn().mockResolvedValue([]),
  getThreadsForCategory: vi.fn().mockResolvedValue([]),
  getThreadLabelIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("@features/mail/db/threadCategories", () => ({
  getCategoriesForThreads: vi.fn().mockResolvedValue(new Map()),
  getCategoryUnreadCounts: vi.fn().mockResolvedValue(new Map()),
  getUserOverrides: vi.fn().mockResolvedValue([]),
  ALL_CATEGORIES: ["Primary", "Social", "Promotions", "Updates", "Forums"],
}));

vi.mock("@features/settings/db/followUpReminders", () => ({
  getActiveFollowUpThreadIds: vi.fn().mockResolvedValue(new Set()),
}));

vi.mock("@features/deliverability/db/bundleRules", () => ({
  getBundleRules: vi.fn().mockResolvedValue([]),
  getHeldThreadIds: vi.fn().mockResolvedValue(new Set()),
  getBundleSummaries: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn(() => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    scrollToIndex: vi.fn(),
  })),
}));

describe("EmailList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useThreadStore as any).mockImplementation((selector: any) => selector({
      threads: [],
      selectedThreadIds: new Set(),
      isLoading: false,
      searchThreadIds: null,
      searchQuery: "",
      setThreads: vi.fn(),
      setLoading: vi.fn(),
      clearSearch: vi.fn(),
      threadMap: new Map(),
    }));
  });

  it("renders empty state when no threads", async () => {
    render(<EmailList />);
    expect(screen.getByText(/All caught up/i)).toBeInTheDocument();
  });

  it("renders threads when provided", async () => {
    const mockThreads = [
      {
        id: "t1",
        subject: "Thread 1",
        fromName: "Sender 1",
        lastMessageAt: Date.now(),
        isRead: false,
        labelIds: [],
        messageCount: 1,
        snippet: "Snippet",
        accountId: "acc_1",
      },
    ];

    (useThreadStore as any).mockImplementation((selector: any) => selector({
      threads: mockThreads,
      selectedThreadIds: new Set(),
      isLoading: false,
      searchThreadIds: null,
      searchQuery: "",
      setThreads: vi.fn(),
      setLoading: vi.fn(),
      clearSearch: vi.fn(),
      threadMap: new Map(mockThreads.map(t => [t.id, t])),
    }));

    // We need to mock useVirtualizer to return the mock thread
    const virtualizer = await import("@tanstack/react-virtual");
    (virtualizer.useVirtualizer as any).mockReturnValue({
      getVirtualItems: () => [{ index: 0, key: "t1", size: 72, start: 0 }],
      getTotalSize: () => 72,
      scrollToIndex: vi.fn(),
    });

    render(<EmailList />);

    expect(screen.getByText("Sender 1")).toBeInTheDocument();
    expect(screen.getByText("Thread 1")).toBeInTheDocument();
  });
});
