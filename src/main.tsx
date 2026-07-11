import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";
import { useWindowLabel } from "@shared/hooks/useWindowLabel";
import ThreadWindowRoot from "./features/threadWindow/ThreadWindowRoot";
import ComposerWindowRoot from "./features/composerWindow/ComposerWindowRoot";
import "./styles/globals.css";
import "./locales/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary name="Global">
      <QueryClientProvider client={queryClient}>
        <WindowBootstrap />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
