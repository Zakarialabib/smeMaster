import { useQuery } from "@tanstack/react-query";
import { getTasksForAccount } from "@features/tasks/db/tasks";

export function useTasks(accountId: string | null, includeCompleted = false) {
  return useQuery({
    queryKey: ["tasks", accountId, includeCompleted],
    queryFn: async () => {
      if (!accountId) return [];
      return getTasksForAccount(accountId, includeCompleted);
    },
    enabled: !!accountId,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });
}
