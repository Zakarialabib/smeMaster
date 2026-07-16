import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReadingPane } from "./ReadingPane";
import { useThreadStore } from "@features/mail/stores/threadStore";
import { useSelectedThreadId } from "@shared/hooks/useRouteNavigation";

// Mock dependencies
vi.mock("@features/mail/stores/threadStore", () => ({
  useThreadStore: vi.fn(),
}));

vi.mock("@shared/hooks/useRouteNavigation", () => ({
  useSelectedThreadId: vi.fn(),
}));

vi.mock("@shared/stores/layoutStore", () => ({
  useLayoutStore: vi.fn((selector) => selector({
    readingPanePosition: "right",
    readingPaneExpanded: false,
    setReadingPanePosition: vi.fn(),
    setReadingPaneExpanded: vi.fn(),
  })),
}));

// ReadingPane guards rendering on an existing account (useAccountStore).
vi.mock("@features/accounts/stores/accountStore", () => ({
  useAccountStore: vi.fn((selector) => selector({
    accounts: [{ id: "acc-1" }],
  })),
}));

vi.mock("../ThreadView", () => ({
  ThreadView: ({ thread }: any) => <div data-testid="thread-view">{thread.subject}</div>,
}));

describe("ReadingPane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no thread is selected", () => {
    (useSelectedThreadId as any).mockReturnValue(null);
    (useThreadStore as any).mockImplementation((selector: any) => selector({
      threadMap: new Map(),
    }));

    render(<ReadingPane />);
    expect(screen.getByText(/Select an email to read/i)).toBeInTheDocument();
  });

  it("renders ThreadView when a thread is selected", () => {
    const mockThread = { id: "t1", subject: "Test Subject" };
    (useSelectedThreadId as any).mockReturnValue("t1");
    (useThreadStore as any).mockImplementation((selector: any) => selector({
      threadMap: new Map([["t1", mockThread]]),
    }));

    render(<ReadingPane />);
    expect(screen.getByTestId("thread-view")).toBeInTheDocument();
    expect(screen.getByText("Test Subject")).toBeInTheDocument();
  });
});
