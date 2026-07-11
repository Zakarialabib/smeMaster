import { useQuery } from "@tanstack/react-query";
import { invokeCommand } from "@shared/services/db/invoke/command";

interface ContactSummary {
  id: string;
  email: string;
  display_name: string | null;
  engagement_score: number;
  health_status: string;
}

export function useContactSegments(accountId: string | null) {
  return useQuery({
    queryKey: ["contactSegments", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      return invokeCommand<ContactSummary[]>("db_list_segments", { accountId });
    },
    enabled: !!accountId,
    staleTime: 60_000,
  });
}
