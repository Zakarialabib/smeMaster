import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueueStatusIndicator } from "./QueueStatusIndicator";
import { useSyncStore } from "@shared/stores/syncStore";
import { getQueuePaused } from "@features/settings/db/settings";
import { getPendingOpsCount } from "@features/settings/db/pendingOperations";

vi.mock("@features/settings/db/settings", () => ({
  getQueuePaused: vi.fn(),
}));

vi.mock("@features/settings/db/pendingOperations", () => ({
  getPendingOpsCount: vi.fn(),
}));

describe("QueueStatusIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSyncStore.setState({ pendingOpsCount: 0 });
    vi.mocked(getQueuePaused).mockResolvedValue(false);
    vi.mocked(getPendingOpsCount).mockResolvedValue(0);
  });

  it("renders nothing when count is 0 and queue is not paused", () => {
    const { container } = render(<QueueStatusIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it("renders pending count badge when there are pending operations", () => {
    useSyncStore.setState({ pendingOpsCount: 5 });
    render(<QueueStatusIndicator />);

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("shows paused indicator when queue is paused", async () => {
    vi.mocked(getQueuePaused).mockResolvedValue(true);
    useSyncStore.setState({ pendingOpsCount: 3 });

    render(<QueueStatusIndicator />);

    await waitFor(() => {
      expect(screen.getByText("Queue paused")).toBeInTheDocument();
    });
  });

  it("shows running indicator when there are pending ops and not paused", () => {
    useSyncStore.setState({ pendingOpsCount: 2 });
    render(<QueueStatusIndicator />);

    expect(screen.getByText("running")).toBeInTheDocument();
  });
});
