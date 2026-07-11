/**
 * AiTaskSuggestionBanner – Dismissible banner for AI-detected tasks from emails.
 *
 * Shows when AI finds tasks in recent emails after sync.
 * Dismissal stored with 24h expiry in durable storage
 * (tauri-plugin-store on Windows/Android, localStorage in browser dev).
 *
 * @spec §3.8
 */
import { useState, useEffect, useCallback } from "react";
import { Sparkles, X } from "lucide-react";
import { tauriStoreStorage } from "@shared/services/storage/tauriStoreStorage";

const DISMISS_KEY = "smemaster.ai.taskSuggestions.dismissedAt";
const DISMISS_HOURS = 24;

interface AiTaskSuggestionBannerProps {
  /** Number of AI-detected tasks */
  suggestionCount: number;
  /** Source emails for suggestions */
  sourceEmails?: { subject: string; sender: string; suggestedTasks: string[] }[];
  /** Handler for reviewing suggestions */
  onReview: () => void;
  /** Handler for dismissing banner */
  onDismiss?: () => void;
}

/**
 * AiTaskSuggestionBanner - Shows AI-detected tasks from emails.
 *
 * Features:
 * - Dismissible banner with count
 * - "Review Tasks" button
 * - Durable persistence with 24h expiry (tauri-plugin-store /
 *   localStorage fallback).
 *
 * @spec §3.8
 */
export function AiTaskSuggestionBanner({
  suggestionCount,
  sourceEmails,
  onReview,
  onDismiss,
}: AiTaskSuggestionBannerProps) {
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  // Read dismissal timestamp from durable storage.
  useEffect(() => {
    const isTauri =
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
    if (!isTauri) {
      try {
        const stored = window.localStorage.getItem(DISMISS_KEY);
        if (stored) {
          const ts = parseInt(stored, 10);
          if (!isNaN(ts)) setDismissedAt(ts);
        }
      } catch {
        /* ignore */
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const stored = await tauriStoreStorage.getItem(DISMISS_KEY);
        if (cancelled || !stored) return;
        const ts = parseInt(stored, 10);
        if (!isNaN(ts)) setDismissedAt(ts);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = useCallback(() => {
    const ts = Date.now();
    setDismissedAt(ts);
    if (
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    ) {
      void tauriStoreStorage.setItem(DISMISS_KEY, String(ts));
    } else {
      try {
        window.localStorage.setItem(DISMISS_KEY, String(ts));
      } catch {
        /* ignore */
      }
    }
    onDismiss?.();
  }, [onDismiss]);

  // Don't show if no suggestions
  if (suggestionCount === 0) return null;

  // Check if dismissed within the last 24h
  const now = Date.now();
  if (dismissedAt && now - dismissedAt < DISMISS_HOURS * 60 * 60 * 1000) {
    return null;
  }

  // Get preview text from first source email
  const previewText = sourceEmails?.[0]?.suggestedTasks?.[0] ?? "";
  const senderPreview = sourceEmails?.[0]?.sender ?? "";

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 bg-accent/5 border-b border-accent/20"
      role="banner"
      aria-live="polite"
    >
      <Sparkles size={14} className="text-accent shrink-0" />
      <span className="text-xs text-text-secondary flex-1">
        AI detected {suggestionCount} task{suggestionCount !== 1 ? "s" : ""} in recent emails
        {previewText && (
          <span className="block text-[0.6875rem] text-text-tertiary mt-0.5 truncate">
            "{previewText}" from {senderPreview}
          </span>
        )}
      </span>
      <button
        onClick={onReview}
        className="text-xs text-accent hover:text-accent-hover font-medium shrink-0"
        aria-label="Review AI suggestions"
      >
        Review
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
        aria-label="Dismiss AI suggestions banner"
      >
        <X size={12} />
      </button>
    </div>
  );
}
