/**
 * EmptyStateTask - Contextual empty state illustrations for task views.
 *
 * Provides consistent empty states for different scenarios:
 * - No tasks at all (welcome state with CTA)
 * - No tasks matching filters (with clear filters action)
 * - No tasks in a specific view (Kanban/Calendar/Agenda)
 * - Search returned no results
 *
 * @spec Phase 5
 */
import { Circle, LayoutGrid, Calendar, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@shared/components/ui/EmptyState";
import type { TaskViewMode } from "@features/tasks/stores/taskStore";

/**
 * Empty state variants
 */
export type EmptyStateVariant =
  | "no-tasks"
  | "no-results"
  | "filtered"
  | "view-empty"
  | "search-empty";

/**
 * Props for EmptyStateTask component.
 */
export interface EmptyStateTaskProps {
  /** The current view mode for context-aware messaging */
  viewMode?: TaskViewMode;
  /** The empty state variant */
  variant?: EmptyStateVariant;
  /** Handler for primary CTA (e.g., "Add task") */
  onAction?: () => void;
  /** Handler for secondary action (e.g., "Clear filters") */
  onSecondaryAction?: () => void;
  /** Custom title override */
  title?: string;
  /** Custom subtitle override */
  subtitle?: string;
  /** Custom action label override */
  actionLabel?: string;
  /** Custom secondary action label override */
  secondaryActionLabel?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get default content for each variant + view mode combination.
 */
function getDefaultContent(
  variant: EmptyStateVariant,
  viewMode: TaskViewMode | undefined,
  t: (key: string) => string,
): { title: string; subtitle: string; actionLabel: string; secondaryActionLabel?: string } {
  switch (variant) {
    case "no-tasks":
      return {
        title: t("tasks.empty.noTasksTitle"),
        subtitle:
          viewMode === "kanban"
            ? t("tasks.empty.noTasksSubtitleKanban")
            : viewMode === "calendar"
              ? t("tasks.empty.noTasksSubtitleCalendar")
              : viewMode === "agenda"
                ? t("tasks.empty.noTasksSubtitleAgenda")
                : t("tasks.empty.noTasksSubtitleList"),
        actionLabel: t("tasks.empty.addFirstTask"),
      };

    case "filtered":
      return {
        title: t("tasks.empty.filteredTitle"),
        subtitle: t("tasks.empty.filteredSubtitle"),
        actionLabel: t("tasks.empty.addTaskInstead"),
        secondaryActionLabel: t("tasks.empty.clearFilters"),
      };

    case "no-results":
      return {
        title: t("tasks.empty.noResultsTitle"),
        subtitle: t("tasks.empty.noResultsSubtitle"),
        actionLabel: t("tasks.empty.clearFilters"),
      };

    case "view-empty":
      return {
        title:
          viewMode === "kanban"
            ? t("tasks.empty.viewEmptyTitleKanban")
            : viewMode === "calendar"
              ? t("tasks.empty.viewEmptyTitleCalendar")
              : viewMode === "agenda"
                ? t("tasks.empty.viewEmptyTitleAgenda")
                : t("tasks.empty.viewEmptyTitleList"),
        subtitle: t("tasks.empty.viewEmptySubtitle"),
        actionLabel: t("tasks.empty.addTask"),
        secondaryActionLabel:
          viewMode !== "list" ? t("tasks.empty.switchToList") : undefined,
      };

    case "search-empty":
      return {
        title: t("tasks.empty.searchEmptyTitle"),
        subtitle: t("tasks.empty.searchEmptySubtitle"),
        actionLabel: t("tasks.empty.clearSearch"),
      };

    default:
      return {
        title: t("tasks.empty.defaultTitle"),
        subtitle: t("tasks.empty.defaultSubtitle"),
        actionLabel: t("tasks.empty.defaultAction"),
      };
  }
}

/**
 * Get the appropriate icon for each view mode.
 */
function getViewIcon(viewMode?: TaskViewMode) {
  switch (viewMode) {
    case "kanban":
      return LayoutGrid;
    case "calendar":
      return Calendar;
    case "agenda":
      return ClipboardList;
    default:
      return Circle;
  }
}

/**
 * EmptyStateTask - Contextual empty state for task views.
 *
 * Provides tailored messaging based on the current view mode and variant.
 * Supports primary and secondary actions (CTA buttons).
 *
 * @spec Phase 5
 */
export function EmptyStateTask({
  viewMode = "list",
  variant = "no-tasks",
  onAction,
  onSecondaryAction,
  title: customTitle,
  subtitle: customSubtitle,
  actionLabel: customActionLabel,
  secondaryActionLabel: customSecondaryActionLabel,
  className = "",
}: EmptyStateTaskProps) {
  const { t } = useTranslation();
  const content = getDefaultContent(variant, viewMode, t);

  const title = customTitle ?? content.title;
  const subtitle = customSubtitle ?? content.subtitle;
  const actionLabel = customActionLabel ?? content.actionLabel;
  const secondaryLabel = customSecondaryActionLabel ?? content.secondaryActionLabel;

  const Icon = getViewIcon(viewMode);

  return (
    <div className={`${className} h-full flex flex-col items-center justify-center`}>
      <EmptyState
        icon={Icon}
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex flex-col items-center gap-2">
            {onAction && (
              <button
                onClick={onAction}
                className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
              >
                {actionLabel}
              </button>
            )}
            {onSecondaryAction && secondaryLabel && (
              <button
                onClick={onSecondaryAction}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-hover transition-colors"
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        }
        size="md"
      />
    </div>
  );
}
