import { create } from "zustand";
import { getAllLabelUnreadCounts } from "@shared/services/db/threads";
import { updateThreadCategory } from "@features/mail/db/threadCategories";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { createAsyncActions, initialAsyncState } from "@shared/stores/createAsyncStore";
import { getQueryClient } from "@shared/query/queryClient";
import { queryKeys } from "@shared/query/keys";
import { uiBus } from "@shared/services/events/uiBus";

export interface Thread {
  id: string;
  accountId: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: number;
  messageCount: number;
  isRead: boolean;
  isStarred: boolean;
  isImportant?: boolean;
  isPinned: boolean;
  isMuted: boolean;
  hasAttachments: boolean;
  labelIds: string[];
  fromName: string | null;
  fromAddress: string | null;
  pending?: boolean;
}

interface ThreadState {
  threads: Thread[];
  threadMap: Map<string, Thread>;
  stashedThreads: Map<string, Thread>;
  pendingThreadIds: Set<string>;
  selectedThreadId: string | null;
  selectedThreadIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  searchThreadIds: Set<string> | null;
  unreadCounts: Record<string, number>;
  setThreads: (threads: Thread[]) => void;
  loadUnreadCounts: (accountId: string) => Promise<void>;
  selectThread: (id: string | null) => void;
  toggleThreadSelection: (id: string) => void;
  selectThreadRange: (id: string) => void;
  clearMultiSelect: () => void;
  selectAll: () => void;
  selectAllFromHere: () => void;
  setLoading: (loading: boolean) => void;
  updateThread: (id: string, updates: Partial<Thread>) => void;
  removeThread: (id: string) => void;
  removeThreads: (ids: string[]) => void;
  stashThread: (id: string) => Thread | undefined;
  unstashThread: (id: string) => void;
  markThreadPending: (id: string) => void;
  unmarkThreadPending: (id: string) => void;
  setSearch: (query: string, threadIds: Set<string> | null) => void;
  clearSearch: () => void;
  setThreadCategory: (accountId: string, threadId: string, category: string) => Promise<void>;
  handleEvent: (eventType: string, payload: unknown) => void;
}

export const useThreadStore = create<ThreadState>((set, get) => {
  const { withLoading } = createAsyncActions(set);

  return {
  threads: [],
  threadMap: new Map(),
  stashedThreads: new Map(),
  pendingThreadIds: new Set(),
  selectedThreadId: null,
  selectedThreadIds: new Set(),
  ...initialAsyncState,
  searchQuery: "",
  searchThreadIds: null,
  unreadCounts: {},

  setThreads: (threads) =>
    set({ threads, threadMap: new Map(threads.map((t) => [t.id, t])) }),

  loadUnreadCounts: async (accountId) => {
    await withLoading(async () => {
      const counts = await getAllLabelUnreadCounts(accountId);
      set({ unreadCounts: counts });
    });
  },

  selectThread: (selectedThreadId) =>
    set({ selectedThreadId, selectedThreadIds: new Set() }),

  toggleThreadSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedThreadIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedThreadIds: next };
    }),

  selectThreadRange: (id) => {
    const state = get();
    const threads = state.threads;
    const anchor = state.selectedThreadId ?? [...state.selectedThreadIds].pop();
    if (!anchor) {
      set({ selectedThreadIds: new Set([id]) });
      return;
    }
    const anchorIdx = threads.findIndex((t) => t.id === anchor);
    const targetIdx = threads.findIndex((t) => t.id === id);
    if (anchorIdx === -1 || targetIdx === -1) return;
    const start = Math.min(anchorIdx, targetIdx);
    const end = Math.max(anchorIdx, targetIdx);
    const rangeIds = threads.slice(start, end + 1).map((t) => t.id);
    set((s) => ({
      selectedThreadIds: new Set([...s.selectedThreadIds, ...rangeIds]),
    }));
  },

  clearMultiSelect: () => set({ selectedThreadIds: new Set() }),

  selectAll: () => {
    const threads = get().threads;
    set({ selectedThreadIds: new Set(threads.map((t) => t.id)) });
  },

  selectAllFromHere: () => {
    const { threads, selectedThreadId } = get();
    const idx = threads.findIndex((t) => t.id === selectedThreadId);
    const startIdx = idx === -1 ? 0 : idx;
    const ids = threads.slice(startIdx).map((t) => t.id);
    set((s) => ({
      selectedThreadIds: new Set([...s.selectedThreadIds, ...ids]),
    }));
  },

  setLoading: (isLoading) => set({ isLoading }),

  updateThread: (id, updates) =>
    set((state) => {
      const threads = state.threads.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      );
      const threadMap = new Map(state.threadMap);
      const existing = threadMap.get(id);
      if (existing) threadMap.set(id, { ...existing, ...updates });
      return { threads, threadMap };
    }),

  removeThread: (id) =>
    set((state) => {
      const threadMap = new Map(state.threadMap);
      threadMap.delete(id);
      const next = new Set(state.selectedThreadIds);
      next.delete(id);
      return {
        threads: state.threads.filter((t) => t.id !== id),
        threadMap,
        selectedThreadId:
          state.selectedThreadId === id ? null : state.selectedThreadId,
        selectedThreadIds: next,
      };
    }),

  removeThreads: (ids) =>
    set((state) => {
      const idsSet = new Set(ids);
      const threadMap = new Map(state.threadMap);
      for (const id of ids) threadMap.delete(id);
      const next = new Set(state.selectedThreadIds);
      for (const id of ids) next.delete(id);
      return {
        threads: state.threads.filter((t) => !idsSet.has(t.id)),
        threadMap,
        selectedThreadId:
          state.selectedThreadId && idsSet.has(state.selectedThreadId)
            ? null
            : state.selectedThreadId,
        selectedThreadIds: next,
      };
    }),

  /**
   * Stash a thread before removing it so we can restore it if a queued
   * operation fails or is reverted. Returns the stashed thread or undefined
   * if it was not in the current list.
   */
  stashThread: (id) => {
    const state = get();
    const thread = state.threadMap.get(id);
    if (!thread) return undefined;
    const stashedThreads = new Map(state.stashedThreads);
    stashedThreads.set(id, thread);
    const threadMap = new Map(state.threadMap);
    threadMap.delete(id);
    const next = new Set(state.selectedThreadIds);
    next.delete(id);
    set({
      threads: state.threads.filter((t) => t.id !== id),
      threadMap,
      stashedThreads,
      selectedThreadId:
        state.selectedThreadId === id ? null : state.selectedThreadId,
      selectedThreadIds: next,
    });
    return thread;
  },

  /**
   * Restore a thread that was previously stashed (e.g., rollback of an
   * archive/trash action). If a new position is not specified, it goes back
   * to the top of the list.
   */
  unstashThread: (id) => {
    const state = get();
    const thread = state.stashedThreads.get(id);
    if (!thread) return;
    const stashedThreads = new Map(state.stashedThreads);
    stashedThreads.delete(id);
    const threadMap = new Map(state.threadMap);
    threadMap.set(id, { ...thread, pending: false });
    const threads = [{ ...thread, pending: false }, ...state.threads];
    set({
      threads,
      threadMap,
      stashedThreads,
      pendingThreadIds: new Set([...state.pendingThreadIds].filter((pid) => pid !== id)),
    });
  },

  markThreadPending: (id) =>
    set((state) => {
      const pendingThreadIds = new Set(state.pendingThreadIds);
      pendingThreadIds.add(id);
      const threads = state.threads.map((t) =>
        t.id === id ? { ...t, pending: true } : t,
      );
      const threadMap = new Map(state.threadMap);
      const existing = threadMap.get(id);
      if (existing) threadMap.set(id, { ...existing, pending: true });
      return { pendingThreadIds, threads, threadMap };
    }),

  unmarkThreadPending: (id) =>
    set((state) => {
      const pendingThreadIds = new Set(state.pendingThreadIds);
      pendingThreadIds.delete(id);
      const threads = state.threads.map((t) =>
        t.id === id ? { ...t, pending: false } : t,
      );
      const threadMap = new Map(state.threadMap);
      const existing = threadMap.get(id);
      if (existing) threadMap.set(id, { ...existing, pending: false });
      return { pendingThreadIds, threads, threadMap };
    }),

  setSearch: (query, threadIds) =>
    set({ searchQuery: query, searchThreadIds: threadIds }),

  clearSearch: () => set({ searchQuery: "", searchThreadIds: null }),

  setThreadCategory: async (accountId, threadId, category) => {
    await updateThreadCategory(accountId, threadId, category, true);
    uiBus.emit("data:changed");
  },

  /**
   * Unified event handler. No longer self-subscribes to the EventBus (sync
   * lifecycle events are owned by `syncStore`); it is retained because other
   * code paths call it directly. On sync completion it invalidates the
   * TanStack Query cache for threads/labels so query hooks refetch, and
   * emits a `data:changed` UI signal for non-query consumers.
   */
  handleEvent: (eventType, payload) => {
    const activeAccountId = useAccountStore.getState().activeAccountId;

    switch (eventType) {
      case "sync:complete":
        if (activeAccountId) {
          get().loadUnreadCounts(activeAccountId);
        }
        invalidateThreadCache(activeAccountId);
        uiBus.emit("data:changed");
        break;

      case "sync:account-complete": {
        const p = payload as { host: string; username: string; folders_synced?: number };
        console.debug(
          `[threadStore] Account sync complete for ${p.username}@${p.host} (${p.folders_synced ?? "?"} folders)`,
        );
        if (activeAccountId) {
          get().loadUnreadCounts(activeAccountId);
        }
        invalidateThreadCache(activeAccountId);
        uiBus.emit("data:changed");
        break;
      }

      case "sync:account-error": {
        const err = payload as { host: string; username: string; error: string };
        console.error(
          `[threadStore] Sync error for ${err.username}@${err.host}: ${err.error}`,
        );
        break;
      }
    }
  },
  };
});

/**
 * Invalidate the TanStack Query cache for threads and unread-label counts for
 * the active account. Safe no-op when no QueryClient is registered yet.
 */
function invalidateThreadCache(activeAccountId: string | null): void {
  const client = getQueryClient();
  if (!client) return;
  client.invalidateQueries({ queryKey: queryKeys.threads.all });
  if (activeAccountId) {
    client.invalidateQueries({
      queryKey: queryKeys.labels.unreadCounts(activeAccountId),
    });
  }
}
