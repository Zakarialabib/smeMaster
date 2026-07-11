/**
 * Date utilities for tasks and other features that bucket by due date.
 *
 * Timestamps are **Unix seconds** (matches the rest of the codebase; the tasks
 * DB column `due_date` is in seconds).
 *
 * All functions are pure and side-effect free; no React, no i18n.
 */

export type DueBucket = "overdue" | "today" | "tomorrow" | "this-week" | "later";

/**
 * Whole-day diff between today (local midnight) and the date (local midnight).
 * Negative = in the past (overdue). Zero = today. Positive = future.
 */
export function getDayDiff(timestamp: number): number {
  const due = new Date(timestamp * 1000);
  const now = new Date();
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((dueStart.getTime() - todayStart.getTime()) / 86_400_000);
}

/**
 * Human-readable due date: "Today", "Tomorrow", "3d", "5d overdue", "Mar 5".
 */
export function formatDueDate(timestamp: number): string {
  const diff = getDayDiff(timestamp);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return `${diff}d`;
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Tailwind classes for the due-date badge color.
 * - Overdue: red
 * - Today or tomorrow: amber
 * - Later: muted
 */
export function getDueDateColor(timestamp: number): string {
  const diff = getDayDiff(timestamp);
  if (diff < 0) return "text-red-500 bg-red-500/10";
  if (diff <= 1) return "text-amber-500 bg-amber-500/10";
  return "text-text-tertiary bg-bg-tertiary";
}

/**
 * Coarse bucket used to group tasks in lists.
 */
export function bucketDueDateLabel(timestamp: number): DueBucket {
  const diff = getDayDiff(timestamp);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "this-week";
  return "later";
}
