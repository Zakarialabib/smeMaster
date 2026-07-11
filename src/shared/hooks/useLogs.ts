/**
 * useLogs - React Query hook for fetching and managing application logs
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeCommand } from "@shared/services/db/invoke/command";
import type { LogEntry, LogLevel } from "@shared/services/logger";

// ── API Functions ─────────────────────────────────────────────────────────

export async function getLogs(limit: number = 100): Promise<LogEntry[]> {
  return await invokeCommand("get_logs", { limit });
}

export async function clearLogs(): Promise<void> {
  await invokeCommand("clear_logs");
}

// ── Types ─────────────────────────────────────────────────────────────────

type FilterLevel = LogLevel;

// ── Hook ─────────────────────────────────────────────────────────────────

export function useLogs(opts: {
  limit: number;
  filters: FilterLevel[];
  searchQuery: string;
}) {
  return useQuery({
    queryKey: ["logs", opts.limit, opts.filters, opts.searchQuery],
    queryFn: async () => {
      const entries = await getLogs(opts.limit);

      const normalized: LogEntry[] = (entries || []).map((entry) => ({
        ...entry,
        level: entry.level as LogLevel,
      }));

      const query = opts.searchQuery.trim().toLowerCase();

      // Filter by level
      let filtered = normalized.filter((log) =>
        opts.filters.includes(log.level as FilterLevel)
      );

      // Filter by search query
      if (query) {
        filtered = filtered.filter((log) => {
          const message = String(log.message || "").toLowerCase();
          const category = String(log.category || "").toLowerCase();
          const data = log.data ? JSON.stringify(log.data).toLowerCase() : "";
          return (
            message.includes(query) ||
            category.includes(query) ||
            data.includes(query)
          );
        });
      }

      return filtered;
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });
}

// ── Clear Logs Mutation ─────────────────────────────────────────────────

export function useClearLogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await clearLogs();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
    },
  });
}
