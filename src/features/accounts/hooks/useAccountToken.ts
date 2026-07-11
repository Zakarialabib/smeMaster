import { useQuery } from "@tanstack/react-query";
import { getTokenHealth } from "@features/mail/services/tokenStatus";

export type TokenHealth = "healthy" | "refreshing" | "expired" | "unknown";

interface TokenHealthData {
  health: TokenHealth;
  expiresAt: number | null;
}

/**
 * Hook for IPC-only token access.
 * Fetches fresh token health status from Rust IPC via react-query.
 * Never caches tokens in renderer memory beyond a single call.
 */
export function useAccountToken(accountId: string) {
  return useQuery<TokenHealthData>({
    queryKey: ["account-token-health", accountId],
    queryFn: async () => {
      const result = await getTokenHealth(accountId);
      return {
        health: result.status === "error" ? "unknown" : (result.status as TokenHealth),
        expiresAt: result.expiresAt,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
