import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useArchiveThread, useDeleteThread, useMarkRead, useMarkUnread, useStarThread } from "./useEmailMutations";
import { useThreadStore } from "@features/mail/stores/threadStore";
import { archiveThread, trashThread, starThread, markThreadRead } from "@features/mail/services/emailActions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@features/mail/services/gmail/tokenManager", () => ({
  getGmailClient: vi.fn(),
}));

vi.mock("@features/mail/services/emailActions", () => ({
  markThreadRead: vi.fn().mockResolvedValue({ success: true }),
  archiveThread: vi.fn().mockResolvedValue({ success: true }),
  trashThread: vi.fn().mockResolvedValue({ success: true }),
  permanentDeleteThread: vi.fn().mockResolvedValue({ success: true }),
  starThread: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@shared/services/db/threads", () => ({
  deleteThread: vi.fn().mockResolvedValue(undefined),
}));

const mockRemoveThread = vi.fn();
const mockUpdateThread = vi.fn();

vi.mock("@features/mail/stores/threadStore", () => ({
  useThreadStore: {
    getState: vi.fn(() => ({
      removeThread: mockRemoveThread,
      updateThread: mockUpdateThread,
    })),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("useEmailMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useArchiveThread calls archiveThread and removes thread from store", async () => {
    const { result } = renderHook(() => useArchiveThread(), { wrapper });
    await result.current.mutateAsync({ accountId: "acc1", threadId: "t1" });

    expect(archiveThread).toHaveBeenCalledWith("acc1", "t1", []);
    expect(mockRemoveThread).toHaveBeenCalledWith("t1");
  });

  it("useDeleteThread calls trashThread and removes thread from store", async () => {
    const { result } = renderHook(() => useDeleteThread(), { wrapper });
    await result.current.mutateAsync({ accountId: "acc1", threadId: "t1" });

    expect(trashThread).toHaveBeenCalledWith("acc1", "t1", []);
    expect(mockRemoveThread).toHaveBeenCalledWith("t1");
  });

  it("useStarThread calls starThread and updates thread in store", async () => {
    const { result } = renderHook(() => useStarThread(), { wrapper });
    await result.current.mutateAsync({ accountId: "acc1", threadId: "t1", starred: true });

    expect(starThread).toHaveBeenCalledWith("acc1", "t1", [], true);
    expect(mockUpdateThread).toHaveBeenCalledWith("t1", { isStarred: true });
  });
});
