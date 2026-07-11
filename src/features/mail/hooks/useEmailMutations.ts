import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  archiveThread,
  trashThread,
  permanentDeleteThread,
  markThreadRead,
  starThread,
} from "@features/mail/services/emailActions";
import { useThreadStore as useThreadsStore } from "@features/mail/stores/threadStore";

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
    onSuccess: (_data, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ["emailThreads"] });
      useThreadsStore.getState().removeThread(threadId);
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
    onSuccess: (_data, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ["emailThreads"] });
      useThreadsStore.getState().removeThread(threadId);
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
    onSuccess: (_data, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ["emailThreads"] });
      useThreadsStore.getState().updateThread(threadId, { isRead: true });
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
    onSuccess: (_data, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ["emailThreads"] });
      useThreadsStore.getState().updateThread(threadId, { isRead: false });
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
    onSuccess: (_data, { threadId, starred }) => {
      queryClient.invalidateQueries({ queryKey: ["emailThreads"] });
      useThreadsStore.getState().updateThread(threadId, { isStarred: starred });
    },
  });
}
