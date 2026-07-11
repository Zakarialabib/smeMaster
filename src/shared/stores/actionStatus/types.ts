/**
 * ActionStatus types — used across the ActionStatus system for tracking
 * async operation lifecycle (idle → loading → success | error).
 */
export type ActionStatusValue = "idle" | "loading" | "success" | "error";

export interface ActionStatus {
  /** Unique identifier for this action (e.g. "send-email-abc123") */
  id: string;
  /** Current lifecycle status */
  status: ActionStatusValue;
  /** Human-readable error message (only set when status === "error") */
  error?: string;
  /** Progress 0-100 for progress bars (optional) */
  progress?: number;
  /** Timestamp when the action started (ms since epoch) */
  startedAt?: number;
  /** Timestamp when the action completed or errored (ms since epoch) */
  completedAt?: number;
  /** Optional category for bulk operations (e.g. "sync", "send", "save") */
  category?: string;
}
