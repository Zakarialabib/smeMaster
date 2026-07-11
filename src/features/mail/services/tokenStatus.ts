import { invokeCommand } from "@shared/services/db/invoke/command";

export interface TokenHealthInfo {
  accountId: string;
  status: "healthy" | "refreshing" | "expired" | "error";
  expiresAt: number | null;
  email: string;
  provider: string;
}

/**
 * Get token health for a single account via Rust IPC.
 * No caching — always fetches fresh status from Rust.
 */
export async function getTokenHealth(accountId: string): Promise<TokenHealthInfo> {
  return invokeCommand<TokenHealthInfo>("oauth_get_token_health", { accountId });
}

/**
 * Get token health for all accounts.
 */
export async function getAllTokenHealth(accountIds: string[]): Promise<TokenHealthInfo[]> {
  if (accountIds.length === 0) return [];
  return invokeCommand<TokenHealthInfo[]>("oauth_get_all_token_health", { accountIds });
}
