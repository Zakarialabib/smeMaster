import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  archiveThread,
  trashThread,
  permanentDeleteThread,
  markThreadRead,
  starThread,
} from "@features/mail/services/emailActions";
import { useThreadStore as useThreadsStore } from "@features/mail/stores/threadStore";
import { queryKeys } from "@shared/query/keys";

interface ThreadSummary {
  id: string;
  subject: string;
  snippet: string;
  last_message_at: string;
  message_count: number;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
}

type ThreadList = ThreadSummary[];

/**
 * Snapshot of every cached thread list so we can roll back on error.
 */
type ThreadSnapshot = [readonly unknown[], ThreadList][];

function snapshotThreadLists(queryClient: ReturnType<typeof useQueryClient>): ThreadSnapshot {
  return queryClient.getQueriesData<ThreadList>({
    queryKey: queryKeys.threads.all,
  }).filter(
    (entry): entry is [readonly unknown[], ThreadList] => entry[1] !== undefined,
  );
}

function restoreThreadLists(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: ThreadSnapshot,
): void {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data);
  }
}

export function useArchiveThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      accountId,
      threadId,
    }: {
      accountId: string;
      threadId: string;
    }) => {
      await archiveThread(accountId, threadId, []);
    },
    onMutate: async ({ threadId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.all });
      const snapshot = snapshotThreadLists(queryClient);
      queryClient.setQueriesData<ThreadList>(
        { queryKey: queryKeys.threads.all },
        (old) => (Array.isArray(old) ? old.filter((t) => t.id !== threadId) : old),
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      if (context?.snapshot) {
        restoreThreadLists(queryClient, context.snapshot);
      }
    },
    onSettled: (_data, _error, { threadId }) => {
      useThreadsStore.getState().removeThread(threadId);
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    },
  });
}

export function useDeleteThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      accountId,
      threadId,
      permanent,
    }: {
      accountId: string;
      threadId: string;
      permanent?: boolean;
    }) => {
      if (permanent) {
        await permanentDeleteThread(accountId, threadId, []);
      } else {
        await trashThread(accountId, threadId, []);
      }
    },
    onMutate: async ({ threadId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.all });
      const snapshot = snapshotThreadLists(queryClient);
      queryClient.setQueriesData<ThreadList>(
        { queryKey: queryKeys.threads.all },
        (old) => (Array.isArray(old) ? old.filter((t) => t.id !== threadId) : old),
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      if (context?.snapshot) {
        restoreThreadLists(queryClient, context.snapshot);
      }
    },
    onSettled: (_data, _error, { threadId }) => {
      useThreadsStore.getState().removeThread(threadId);
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      accountId,
      threadId,
    }: {
      accountId: string;
      threadId: string;
    }) => {
      await markThreadRead(accountId, threadId, [], true);
    },
    onMutate: async ({ threadId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.all });
      const snapshot = snapshotThreadLists(queryClient);
      queryClient.setQueriesData<ThreadList>(
        { queryKey: queryKeys.threads.all },
        (old) =>
          Array.isArray(old)
            ? old.map((t) => (t.id === threadId ? { ...t, is_read: true } : t))
            : old,
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      if (context?.snapshot) {
        restoreThreadLists(queryClient, context.snapshot);
      }
    },
    onSettled: (_data, _error, { threadId }) => {
      useThreadsStore.getState().updateThread(threadId, { isRead: true });
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    },
  });
}

export function useMarkUnread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      accountId,
      threadId,
    }: {
      accountId: string;
      threadId: string;
    }) => {
      await markThreadRead(accountId, threadId, [], false);
    },
    onMutate: async ({ threadId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.all });
      const snapshot = snapshotThreadLists(queryClient);
      queryClient.setQueriesData<ThreadList>(
        { queryKey: queryKeys.threads.all },
        (old) =>
          Array.isArray(old)
            ? old.map((t) => (t.id === threadId ? { ...t, is_read: false } : t))
            : old,
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      if (context?.snapshot) {
        restoreThreadLists(queryClient, context.snapshot);
      }
    },
    onSettled: (_data, _error, { threadId }) => {
      useThreadsStore.getState().updateThread(threadId, { isRead: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    },
  });
}

export function useStarThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      accountId,
      threadId,
      starred,
    }: {
      accountId: string;
      threadId: string;
      starred: boolean;
    }) => {
      await starThread(accountId, threadId, [], starred);
    },
    onMutate: async ({ threadId, starred }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.all });
      const snapshot = snapshotThreadLists(queryClient);
      queryClient.setQueriesData<ThreadList>(
        { queryKey: queryKeys.threads.all },
        (old) =>
          Array.isArray(old)
            ? old.map((t) =>
                t.id === threadId ? { ...t, is_starred: starred } : t,
              )
            : old,
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      if (context?.snapshot) {
        restoreThreadLists(queryClient, context.snapshot);
      }
    },
    onSettled: (_data, _error, { threadId, starred }) => {
      useThreadsStore.getState().updateThread(threadId, { isStarred: starred });
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    },
  });
}
