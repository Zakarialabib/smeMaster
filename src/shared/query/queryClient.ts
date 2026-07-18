/**
 * Shared TanStack QueryClient accessor.
 *
 * `main.tsx` owns the single `QueryClient` instance (created alongside the
 * `QueryClientProvider`). Plain (non-component) modules — e.g. Zustand stores
 * like `threadStore` — cannot use the `useQueryClient()` hook, so they reach
 * the client through this module-level getter instead.
 *
 * `main.tsx` calls `setQueryClient(queryClient)` once at startup. Stores then
 * call `getQueryClient()?.invalidateQueries(...)` to drive cache invalidation
 * from EventBus-driven handlers.
 */
import type { QueryClient } from "@tanstack/react-query";

let _client: QueryClient | null = null;

/** Register the application-wide QueryClient. Call once from main.tsx. */
export function setQueryClient(client: QueryClient): void {
  _client = client;
}

/** Returns the registered QueryClient, or `null` before `setQueryClient`. */
export function getQueryClient(): QueryClient | null {
  return _client;
}
