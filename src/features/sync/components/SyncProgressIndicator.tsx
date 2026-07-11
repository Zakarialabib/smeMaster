/**
 * SyncProgressIndicator
 *
 * Compact widget that shows active sync operations as small pills/badges
 * in the bottom status bar area. Each pill shows a label, animated progress
 * bar, and status indicator.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { useSyncProgressStore } from "../stores/syncProgressStore";
import type { SyncOperation } from "../stores/syncProgressStore";
import { cn } from "@shared/utils/cn";

// ── Auto-dismiss constants ──────────────────────────────────────────────

const COMPLETED_DISMISS_MS = 3000;
const FAILED_DISMISS_MS = 8000;

// ── Operation pill ───────────────────────────────────────────────────────

function OperationPill({
  operation,
  onDismiss,
}: {
  operation: SyncOperation;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss completed/failed operations
  useEffect(() => {
    if (operation.status === "completed") {
      const timer = setTimeout(() => setVisible(false), COMPLETED_DISMISS_MS);
      return () => clearTimeout(timer);
    }
    if (operation.status === "failed") {
      const timer = setTimeout(() => setVisible(false), FAILED_DISMISS_MS);
      return () => clearTimeout(timer);
    }
  }, [operation.status]);

  if (!visible) return null;

  const isInProgress = operation.status === "in_progress";
  const isPending = operation.status === "pending";
  const isCompleted = operation.status === "completed";
  const isFailed = operation.status === "failed";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${operation.label}: ${operation.status}`}
      className={cn(
        "group flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs min-w-0 transition-all duration-200",
        isInProgress &&
          "bg-accent/8 border-accent/20 text-text-primary animate-pulse",
        isPending && "bg-bg-tertiary border-border-primary text-text-tertiary",
        isCompleted &&
          "bg-success/8 border-success/20 text-text-primary",
        isFailed && "bg-danger/8 border-danger/20 text-danger",
      )}
    >
      {/* Status icon */}
      {isInProgress && (
        <Loader2 size={12} className="shrink-0 animate-spin text-accent" />
      )}
      {isPending && (
        <div className="w-2 h-2 rounded-full bg-text-tertiary/40 shrink-0" />
      )}
      {isCompleted && (
        <CheckCircle2 size={12} className="shrink-0 text-success" />
      )}
      {isFailed && (
        <AlertCircle size={12} className="shrink-0 text-danger" />
      )}

      {/* Label */}
      <span className="truncate max-w-[120px]">{operation.label}</span>

      {/* Progress bar (only for in_progress) */}
      {isInProgress && operation.progress > 0 && (
        <div className="w-16 h-1 bg-accent/15 rounded-full overflow-hidden shrink-0">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
            style={{ width: `${operation.progress}%` }}
          />
        </div>
      )}

      {/* Dismiss button (visible on hover for completed/failed) */}
      {(isCompleted || isFailed) && (
        <button
          onClick={onDismiss}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-current/50 hover:text-current transition-opacity shrink-0"
          aria-label={`Dismiss ${operation.label}`}
        >
          <X size={10} />
        </button>
      )}

      {/* Error tooltip */}
      {isFailed && operation.error && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-lg bg-danger text-white text-[10px] leading-relaxed shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
          role="tooltip"
        >
          {operation.error}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

interface SyncProgressIndicatorProps {
  /** Optional class name override */
  className?: string;
}

export function SyncProgressIndicator({
  className,
}: SyncProgressIndicatorProps) {
  const operations = useSyncProgressStore((s) => s.operations);
  const removeOperation = useSyncProgressStore((s) => s.removeOperation);

  if (operations.length === 0) return null;

  const hasActive = operations.some(
    (op) => op.status === "in_progress" || op.status === "pending",
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5",
        !hasActive && "animate-[fadeIn_200ms_ease-out]",
        className,
      )}
    >
      {operations.map((op) => (
        <OperationPill
          key={op.id}
          operation={op}
          onDismiss={() => removeOperation(op.id)}
        />
      ))}
    </div>
  );
}
