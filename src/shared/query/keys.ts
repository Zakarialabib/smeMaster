/**
 * Centralized TanStack Query key factory.
 *
 * All server-state query keys live here so that:
 *   - Keys are consistent across the app (no ad-hoc string arrays).
 *   - Mutations can invalidate precisely (by prefix) without guessing.
 *   - Refactors touch one file, not 40 call sites.
 *
 * Convention: every domain exposes `all`, `list`/`detail` builders, and a
 * `byAccount` helper where relevant. Invalidation uses the array prefix form,
 * e.g. `queryClient.invalidateQueries({ queryKey: queryKeys.threads.all })`.
 */

export const queryKeys = {
  accounts: {
    all: ["accounts"] as const,
    list: () => ["accounts", "list"] as const,
    detail: (id: string) => ["accounts", "detail", id] as const,
  },

  threads: {
    all: ["threads"] as const,
    list: (accountId: string | null, folder?: string) =>
      folder
        ? (["threads", "list", accountId, folder] as const)
        : (["threads", "list", accountId] as const),
    detail: (accountId: string, threadId: string) =>
      ["threads", "detail", accountId, threadId] as const,
    forCategory: (accountId: string, category: string) =>
      ["threads", "category", accountId, category] as const,
  },

  labels: {
    all: ["labels"] as const,
    byAccount: (accountId: string) => ["labels", accountId] as const,
    unreadCounts: (accountId: string) => ["labels", "unread", accountId] as const,
  },

  contacts: {
    all: ["contacts"] as const,
    list: (accountId: string | null) => ["contacts", "list", accountId] as const,
    detail: (id: string) => ["contacts", "detail", id] as const,
    segments: (accountId: string | null) => ["contacts", "segments", accountId] as const,
    groups: (accountId: string) => ["contacts", "groups", accountId] as const,
  },

  tasks: {
    all: ["tasks"] as const,
    list: (accountId: string | null) => ["tasks", "list", accountId] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },

  calendars: {
    all: ["calendars"] as const,
    list: (accountId: string) => ["calendars", "list", accountId] as const,
    events: (accountId: string) => ["calendars", "events", accountId] as const,
  },

  campaigns: {
    all: ["campaigns"] as const,
    list: (accountId: string) => ["campaigns", "list", accountId] as const,
  },

  vault: {
    all: ["vault"] as const,
    list: (accountId: string) => ["vault", "list", accountId] as const,
  },

  deliverability: {
    all: ["deliverability"] as const,
    health: (accountId: string) => ["deliverability", "health", accountId] as const,
    monitors: (accountId: string) => ["deliverability", "monitors", accountId] as const,
  },

  logs: {
    all: ["logs"] as const,
    list: (limit: number, filters: string[], search: string) =>
      ["logs", limit, filters, search] as const,
  },

  settings: {
    all: ["settings"] as const,
    byKey: (key: string) => ["settings", key] as const,
  },

  ai: {
    all: ["ai"] as const,
    configs: (accountId: string) => ["ai", "configs", accountId] as const,
    cache: (accountId: string, threadId: string, type: string) =>
      ["ai", "cache", accountId, threadId, type] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
