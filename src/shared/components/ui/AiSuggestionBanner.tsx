/**
 * AI Suggestion Banner — Displays AI-extracted items (tasks, emails) with an approval flow.
 * Used for: "AI Task Detection" — shows detected action items with their source, plus
 * Review (convert to tasks) and Dismiss actions. Follows the Frosted Glass design language.
 */
import { useState } from "react";
import { Sparkles, X, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@shared/utils/cn";

export interface AiSuggestionItem {
  id: string;
  /** The action item, e.g. "Send Q3 proposal draft". */
  title: string;
  /** Where it came from, e.g. "from John Davis". */
  source?: string;
}

export interface AiSuggestion {
  id: string;
  title: string;
  description?: string;
  count?: number;
  type: "task" | "email" | "contact" | "custom";
}

export interface AiSuggestionBannerProps {
  /** Suggestion data to display */
  suggestion: AiSuggestion;
  /** Individual detected items to list (AI Task Detection). */
  items?: AiSuggestionItem[];
  /** Called when user clicks Review/Approve (optional — omit for read-only summaries) */
  onReview?: () => void;
  /** Called when user dismisses the banner (optional) */
  onDismiss?: () => void;
  /** Optional className */
  className?: string;
  /** Auto-dismiss after N milliseconds (0 = no auto-dismiss) */
  autoDismissMs?: number;
  /** Show animated icon */
  animatedIcon?: boolean;
  /** Variant styling */
  variant?: "default" | "success" | "info" | "warning";
}

const variantClasses = {
  default: "border-ai/30",
  success: "border-success/30",
  info: "border-ai/30",
  warning: "border-warning/30",
};

export function AiSuggestionBanner({
  suggestion,
  items,
  onReview,
  onDismiss,
  className = "",
  autoDismissMs = 0,
  animatedIcon = true,
  variant = "info",
}: AiSuggestionBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  // Auto-dismiss effect
  if (autoDismissMs > 0 && isVisible) {
    setTimeout(() => {
      handleDismiss();
    }, autoDismissMs);
  }

  if (!isVisible) return null;

  const showItems = items && items.length > 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border backdrop-blur-[var(--glass-blur,14px)]",
        "bg-ai/[0.06] shadow-[0_1px_2px_rgba(16,24,40,0.06)]",
        "animate-in fade-in slide-in-from-top-2 duration-300",
        variantClasses[variant],
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={`${suggestion.title} suggestion from AI`}
    >
      {/* Soft accent glow (frosted) */}
      <div className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-ai/15 blur-2xl" />

      <div className="relative p-4">
        <div className="flex items-start gap-3">
          {/* AI Icon */}
          <div className="shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-ai/15 text-ai">
            <Sparkles
              size={18}
              className={cn("transition-colors", animatedIcon && "animate-pulse")}
              aria-hidden="true"
            />
          </div>

          {/* Title + description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-text-primary">{suggestion.title}</p>
              {suggestion.count ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-ai/15 text-ai">
                  {suggestion.count}
                </span>
              ) : null}
            </div>
            {suggestion.description && (
              <p className="text-xs text-text-secondary mt-0.5">{suggestion.description}</p>
            )}
          </div>

          {/* Dismiss */}
          {onDismiss && (
            <button
              onClick={handleDismiss}
              className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-accent shrink-0"
              aria-label={`Dismiss ${suggestion.title}`}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Detected items list */}
        {showItems && (
          <ul className="mt-3 space-y-1.5">
            {items!.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={15} className="text-ai shrink-0" aria-hidden="true" />
                <span className="text-text-primary truncate">{item.title}</span>
                {item.source && (
                  <span className="text-xs text-text-tertiary shrink-0 ml-auto truncate max-w-[40%]">
                    {item.source}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Primary action */}
        {onReview && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={onReview}
              className={cn(
                "inline-flex items-center gap-1.5",
                "px-3.5 py-1.5 text-xs font-semibold rounded-lg",
                "bg-ai text-white hover:bg-ai-hover",
                "transition-colors focus:outline-none focus:ring-2 focus:ring-ai focus:ring-offset-1",
              )}
              aria-label={`Review ${suggestion.title}`}
            >
              {showItems ? "Review & convert to tasks" : "Review"}
              <ChevronRight size={14} className="opacity-80" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
