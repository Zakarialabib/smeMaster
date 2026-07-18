import { useQuery } from "@tanstack/react-query";
import { getThreads } from "@shared/services/db/db-invoke";
import { queryKeys } from "@shared/query/keys";

export function useEmailThreads(accountId: string | null, folder: string, limit = 50) {
  return useQuery({
    queryKey: queryKeys.threads.list(accountId, folder),
    queryFn: async () => {
      if (!accountId) return [];
      const threads = await getThreads(accountId, limit, 0, {
        folder,
        labelId: null,
        isRead: null,
        isStarred: null,
        isImportant: null,
        isSnoozed: null,
        isPinned: null,
        searchQuery: null,
      });
      // Map to the expected ThreadSummary shape
      return threads.map((t) => ({
        id: t.id,
        subject: t.subject,
        snippet: t.snippet,
        last_message_at: t.last_message_at,
        message_count: t.message_count,
        is_read: t.is_read,
        is_starred: t.is_starred,
        has_attachments: t.has_attachments,
      }));
    },
    enabled: !!accountId,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });
}
