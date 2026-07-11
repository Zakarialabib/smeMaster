import { useQuery } from "@tanstack/react-query";
import { checkDomainHealth } from "@features/deliverability/services/domainHealthService";

export function useHealthScore(domain: string | null) {
  return useQuery({
    queryKey: ["healthScore", domain],
    queryFn: async () => {
      if (!domain) return null;
      return checkDomainHealth(domain);
    },
    enabled: !!domain,
    staleTime: 120_000, // 2 minutes — DNS checks don't change often
  });
}
