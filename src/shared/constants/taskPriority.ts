import type { TaskPriority } from "@features/tasks/db/tasks";

/**
 * Single source of truth for task-priority visual tokens.
 *
 * Previously these three maps were defined in three different files
 * (`TasksPage.tsx`, `TaskItem.tsx`, `AiTaskExtractDialog.tsx`) with slightly
 * different shades. Consolidating them prevents drift.
 *
 * The `TaskPriority` enum itself is owned by the tasks feature. If a second
 * feature needs it, the enum should move to a shared location; for now the
 * import boundary is one-way (shared → features) and ESLint allows it.
 */

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

export const PRIORITY_BADGE: Record<TaskPriority, { label: string; bg: string; text: string }> = {
  urgent: { label: "Urgent", bg: "bg-red-500/15", text: "text-red-500" },
  high: { label: "High", bg: "bg-orange-500/15", text: "text-orange-500" },
  medium: { label: "Medium", bg: "bg-amber-500/15", text: "text-amber-500" },
  low: { label: "Low", bg: "bg-blue-500/15", text: "text-blue-400" },
  none: { label: "", bg: "", text: "" },
};

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-400",
  none: "bg-text-tertiary/30",
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: "text-text-tertiary",
  low: "text-blue-400",
  medium: "text-amber-400",
  high: "text-orange-500",
  urgent: "text-red-500",
};

export const PRIORITY_DOT_COLORS: Record<TaskPriority, string> = PRIORITY_DOT;

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

export const ALL_PRIORITIES: TaskPriority[] = ["urgent", "high", "medium", "low", "none"];
