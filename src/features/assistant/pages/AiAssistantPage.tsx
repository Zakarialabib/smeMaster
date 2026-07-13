/**
 * AiAssistantPage — Full-page AI Knowledge Assistant with semantic RAG search.
 *
 * Frosted Glass design with frosted-surface cards, glass buttons, and
 * backdrop blur. Integrates with the local RAG backend for offline-first
 * semantic search across emails, attachments, and vault items.
 *
 * @module
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, Settings, AlertCircle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useRagStore } from "@features/assistant/stores/ragStore";
import { RagSearchBar } from "@features/assistant/components/RagSearchBar";
import { RagResultBubble } from "@features/assistant/components/RagResultBubble";
import { RagEmptyState } from "@features/assistant/components/RagEmptyState";
import { RagSkeleton } from "@features/assistant/components/RagSkeleton";
import { GlassPanel } from "@shared/components/ui/glass-panel";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/utils/cn";
import { TEXT_HINT } from "@shared/styles/ui-tokens";

// ── Component ────────────────────────────────────────────────────────────────

export function AiAssistantPage() {
  const navigate = useNavigate();
  const {
    enabled,
    conversation,
    isSearching,
    searchError,
    modelStatus,
    search,
    clearHistory,
    hydrate,
  } = useRagStore();

  const [query, setQuery] = useState("");
  const resultsEndRef = useRef<HTMLDivElement>(null);

  // Hydrate store on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Auto-scroll to bottom on new results
  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.length, isSearching]);

  const handleSubmit = useCallback(
    (q: string) => {
      search(q);
      setQuery("");
    },
    [search],
  );

  // ── Disabled state (RAG turned off) ──
  if (!enabled) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <GlassPanel variant="elevated" className="max-w-md w-full p-8 text-center">
          <AlertCircle className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Local RAG is Disabled
          </h2>
          <p className="text-sm text-text-tertiary mb-4">
            Enable Local RAG in Settings → AI to use the AI Knowledge Assistant.
          </p>
          <Button
            variant="glass"
            size="md"
            onClick={() => navigate({ to: "/settings/$tab", params: { tab: "ai" } })}
            className="mx-auto"
          >
            <Settings className="w-4 h-4 mr-1.5" />
            Open AI Settings
          </Button>
        </GlassPanel>
      </div>
    );
  }

  // ── Model not loaded warning ──
  const showModelWarning = modelStatus !== "loaded" && modelStatus !== "loading";

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <header
        className={cn(
          "flex items-center justify-between",
          "px-4 sm:px-6 py-3",
          "border-b border-border-primary",
          "frost-surface",
          "rounded-none",
          "flex-shrink-0",
        )}
      >
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            AI Knowledge Assistant
          </h1>
          <p className={cn(TEXT_HINT, "mt-0.5")}>
            Semantic search over your local knowledge base
          </p>
        </div>

        {conversation.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-text-tertiary hover:text-text-secondary"
            onClick={clearHistory}
            aria-label="Clear conversation history"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </header>

      {/* ── Model not loaded banner ── */}
      {showModelWarning && (
        <div
          className={cn(
            "mx-4 sm:mx-6 mt-3 px-4 py-2.5",
            "rounded-[--frost-radius-sm]",
            "bg-warning/10 border border-warning/20",
            "flex items-center gap-2.5",
            "flex-shrink-0",
          )}
        >
          <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
          <p className="text-xs text-text-secondary flex-1">
            {modelStatus === "idle" &&
              "Embedding model not loaded. Download and load the model in Settings → AI → Local RAG."}
            {modelStatus === "error" &&
              "Model failed to load. Check Settings → AI → Local RAG for details."}
          </p>
          <Button
            variant="glass"
            size="sm"
            onClick={() =>
              navigate({ to: "/settings/$tab", params: { tab: "ai" } })
            }
          >
            <Settings className="w-3.5 h-3.5 mr-1" />
            Settings
          </Button>
        </div>
      )}

      {/* ── Results area ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {conversation.length === 0 && !isSearching && <RagEmptyState />}

        <div className="max-w-3xl mx-auto space-y-4">
          {conversation.map((entry) => (
            <RagResultBubble key={entry.id} entry={entry} />
          ))}

          {/* Loading skeleton */}
          {isSearching && <RagSkeleton count={1} />}

          {/* Error state */}
          {searchError && (
            <div
              className={cn(
                "p-4 rounded-[--frost-radius-sm]",
                "bg-danger/10 border border-danger/20",
                "flex items-start gap-2.5",
              )}
            >
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-danger mb-0.5">
                  Search Error
                </p>
                <p className="text-xs text-text-secondary">{searchError}</p>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={resultsEndRef} />
        </div>
      </div>

      {/* ── Search bar (sticky bottom) ── */}
      <div
        className={cn(
          "flex-shrink-0",
          "px-4 sm:px-6 py-3",
          "border-t border-border-primary",
          "frost-surface",
          "rounded-none",
        )}
      >
        <div className="max-w-3xl mx-auto">
          <RagSearchBar
            value={query}
            onChange={setQuery}
            onSubmit={handleSubmit}
            disabled={isSearching || showModelWarning}
          />
          <p className={cn(TEXT_HINT, "mt-1.5 text-center")}>
            Powered by on-device embeddings (LM Studio / BGE-small) + LanceDB semantic search
          </p>
        </div>
      </div>
    </div>
  );
}
