import { useState, useEffect, useRef } from "react";
import { Sparkles, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { isAiAvailable } from "@shared/services/ai/providerManager";
import { summarizeThread } from "@shared/services/ai/aiService";
import type { DbMessage } from "@shared/services/db/messages";
import { CenteredLoader } from "@shared/components/ui/CenteredLoader";
import { useRefreshableAiCache } from "@features/mail/hooks/useRefreshableAiCache";

interface ThreadSummaryProps {
  threadId: string;
  accountId: string;
  messages: DbMessage[];
}

export function ThreadSummary({ threadId, accountId, messages }: ThreadSummaryProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [available, setAvailable] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    if (messages.length < 2) return;
    isAiAvailable().then(setAvailable);
  }, [messages.length]);

  const {
    data: summary,
    loading,
    loadingRef,
    error,
    load,
    refresh,
  } = useRefreshableAiCache<string>({
    accountId,
    threadId,
    cacheType: "summary",
    fetcher: (a, t) => summarizeThread(t, a, messages),
  });

  // Preserve the original console.error behavior for summary errors.
  useEffect(() => {
    if (error) console.error("Failed to summarize thread:", error);
  }, [error]);

  // Auto-load summary when available.
  useEffect(() => {
    if (!available || messages.length < 2 || summary !== null || loadingRef.current) return;
    load();
  }, [available, messages.length, summary, loadingRef, load]);

  if (!available || messages.length < 2) return null;

  return (
    <div className="mx-4 my-2 p-3 rounded-lg bg-accent/5 border border-accent/20">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Sparkles size={14} className="text-accent shrink-0" />
        <span className="text-xs font-medium text-accent flex-1">AI Summary</span>
        {summary && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); refresh(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); refresh(); } }}
            className="p-0.5 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
            title="Refresh summary"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </span>
        )}
        {collapsed ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronUp size={14} className="text-text-tertiary" />}
      </button>
      {!collapsed && (
        <div className="mt-2 text-sm text-text-secondary">
          {loading && !summary && (
            <CenteredLoader size="sm" inline label="Generating summary..." />
          )}
          {summary && <p className="text-xs leading-relaxed">{summary}</p>}
        </div>
      )}
    </div>
  );
}
