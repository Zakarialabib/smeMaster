import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export interface ErrorStateProps {
  /** Human-readable title. Default: "Something went wrong" */
  title?: string;
  /** Error detail shown below the title */
  message?: string;
  /** Optional Error object or string — auto-extracts message */
  error?: Error | string;
  /** Retry callback. If omitted, retry button is hidden */
  onRetry?: () => void;
  /** Custom label for retry button. Default: "Try again" */
  retryLabel?: string;
  /** Additional container classes */
  className?: string;
  /** Compact variant for inline use (smaller padding/font) */
  compact?: boolean;
}

/**
 * ErrorState — consistent error display with optional retry button.
 *
 * Variants:
 * - Default: Full-width centered block with icon, title, message, retry
 * - Compact: Smaller padding, smaller text, suitable for inline/widget use
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  error,
  onRetry,
  retryLabel = "Try again",
  className = "",
  compact = false,
}: ErrorStateProps) {
  const errorMessage = message
    ?? (typeof error === "string" ? error : error instanceof Error ? error.message : undefined);

  if (compact) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-danger/5 border border-danger/15 ${className}`}
      >
        <AlertCircle size={14} className="text-danger shrink-0" />
        <p className="text-xs text-text-secondary flex-1 min-w-0 truncate">
          {errorMessage || title}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 rounded-md transition-colors shrink-0"
          >
            <RefreshCw size={11} />
            {retryLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex flex-col items-center justify-center h-full text-center px-4 ${className}`}
    >
      <AlertCircle size={48} strokeWidth={1} className="text-danger/40 mb-3" />
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {errorMessage && (
        <p className="text-xs text-text-tertiary mt-1.5 max-w-sm">{errorMessage}</p>
      )}
      {onRetry && (
        <Button
          variant="primary"
          size="sm"
          icon={<RefreshCw size={14} />}
          onClick={onRetry}
          className="mt-4"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
