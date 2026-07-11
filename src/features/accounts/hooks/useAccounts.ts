import { useQuery } from "@tanstack/react-query";
import { listAccounts } from "../../../shared/services/db/db-invoke";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      return listAccounts();
    },
    staleTime: 120_000,
    placeholderData: (previousData) => previousData,
  });
}
