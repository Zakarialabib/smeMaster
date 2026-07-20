import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setQueryClient } from "@shared/query/queryClient";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";
import { useWindowLabel } from "@shared/hooks/useWindowLabel";
import ThreadWindowRoot from "./features/threadWindow/ThreadWindowRoot";
import ComposerWindowRoot from "./features/composerWindow/ComposerWindowRoot";
import "./styles/globals.css";
import "./locales/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tauri apps are single-window desktop/mobile; window focus refetch is
      // noise. Reactivity comes from the EventBus → invalidation instead.
      refetchOnWindowFocus: false,
      // Keep cached server state fresh for 5 min by default; per-query
      // overrides (e.g. threads 30s) take precedence.
      staleTime: 1000 * 60 * 5,
      // Retry transient failures at the React Query layer too (the IPC layer
      // already retries idempotent reads; this covers mutation-triggered
      // refetches). Only retry once here to avoid compounding with IPC retries.
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      // Garbage-collect unused cache entries after 10 min to bound memory.
      gcTime: 1000 * 60 * 10,
      // Avoid abrupt loading flashes for cached data on param change.
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      // Mutations are user-intent; let the optimistic-update layer own retries.
      retry: false,
    },
  },
});

/**
 * Switches between main, thread, and compose window roots based on
 * the Tauri webview window label.
 *
 * **Loading state (`null`):** Returns `null` (renders nothing) on the
 * initial render while the window label is being resolved. The synchronous
 * URL-param fallback in `useWindowLabel` ensures this is a single tick for
 * thread/compose windows — no flash of the main app content ever occurs.
 */
function WindowBootstrap() {
  const label = useWindowLabel();

  // Loading — render nothing while label resolves
  if (label === null) return null;

  switch (label) {
    case "thread":
      return <ThreadWindowRoot />;
    case "compose":
      return <ComposerWindowRoot />;
    default:
      return <RouterProvider router={router} />;
  }
}

// Expose the QueryClient to non-component modules (e.g. Zustand stores that
// invalidate queries from EventBus handlers via getQueryClient()).
setQueryClient(queryClient);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary name="Global">
      <QueryClientProvider client={queryClient}>
        <WindowBootstrap />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
