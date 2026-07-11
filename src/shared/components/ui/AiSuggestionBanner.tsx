/**
 * AI Suggestion Banner - Displays AI-extracted items (tasks, emails) with approval flow.
 * Used for: "3 tasks detected in recent emails" with Review/Dismiss buttons.
 */
import { useState } from "react";
import { Sparkles, X, ChevronRight } from "lucide-react";
import { cn } from "@shared/utils/cn";

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
  /** Called when user clicks Review/Approve */
  onReview: () => void;
  /** Called when user dismisses the banner */
  onDismiss: () => void;
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
  default: "bg-accent/10 border-accent/30 text-text-primary",
  success: "bg-success/10 border-success/30 text-text-primary",
  info: "bg-blue-500/10 border-blue-500/30 text-text-primary",
  warning: "bg-warning/10 border-warning/30 text-text-primary",
};

const iconColorClasses = {
  default: "text-accent",
  success: "text-success",
  info: "text-blue-500",
  warning: "text-warning",
};

export function AiSuggestionBanner({
  suggestion,
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
    onDismiss();
  };

  // Auto-dismiss effect
  if (autoDismissMs > 0 && isVisible) {
    setTimeout(() => {
      handleDismiss();
    }, autoDismissMs);
  }

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border rounded-lg",
        "animate-in fade-in slide-in-from-top-2 duration-300",
        variantClasses[variant],
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={`${suggestion.title} suggestion from AI`}
    >
      {/* AI Icon */}
      <div className="shrink-0">
        <Sparkles
          size={18}
          className={cn(
            "transition-colors",
            iconColorClasses[variant],
            animatedIcon && "animate-pulse",
          )}
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="font-medium text-sm">{suggestion.title}</p>
          {suggestion.count && (
            <span
              className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                "bg-black/10 dark:bg-white/10",
              )}
            >
              {suggestion.count}
            </span>
          )}
        </div>
        {suggestion.description && (
          <p className="text-xs text-text-secondary mt-0.5">
            {suggestion.description}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onReview}
          className={cn(
            "inline-flex items-center gap-1.5",
            "px-3 py-1.5 text-xs font-medium rounded-md",
            "bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20",
            "transition-colors focus:outline-none focus:ring-2 focus:ring-accent",
          )}
          aria-label={`Review ${suggestion.title}`}
        >
          Review
          <ChevronRight size={14} className="opacity-70" />
        </button>
        <button
          onClick={handleDismiss}
          className={cn(
            "p-1 rounded-md",
            "hover:bg-black/10 dark:hover:bg-white/10",
            "text-text-secondary hover:text-text-primary",
            "transition-colors focus:outline-none focus:ring-2 focus:ring-accent",
          )}
          aria-label={`Dismiss ${suggestion.title}`}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

