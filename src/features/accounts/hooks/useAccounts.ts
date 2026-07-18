import { useQuery } from "@tanstack/react-query";
import { listAccounts } from "../../../shared/services/db/db-invoke";
import { queryKeys } from "@shared/query/keys";

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts.all,
    queryFn: async () => {
      return listAccounts();
    },
    staleTime: 120_000,
    placeholderData: (previousData) => previousData,
  });
}
