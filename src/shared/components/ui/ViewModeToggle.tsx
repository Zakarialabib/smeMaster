/**
 * View Mode Toggle - Switch between List, Kanban, Calendar, and Agenda views.
 * Supports view persistence in layout store and visual feedback for active mode.
 */
import { LayoutList, LayoutGrid, Calendar, Clock } from "lucide-react";
import { cn } from "@shared/utils/cn";

export type ViewMode = "list" | "kanban" | "calendar" | "agenda";

export interface ViewModeToggleProps {
  /** Currently active view mode */
  activeMode: ViewMode;
  /** Called when user selects a different view */
  onChange: (mode: ViewMode) => void;
  /** Optional className for the container */
  className?: string;
  /** Show mode labels or just icons */
  showLabels?: boolean;
  /** Compact size for inline placement */
  compact?: boolean;
}

const VIEW_MODES: Array<{
  value: ViewMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    value: "list",
    label: "List",
    icon: <LayoutList size={16} />,
    description: "Quick scan view",
  },
  {
    value: "kanban",
    label: "Kanban",
    icon: <LayoutGrid size={16} />,
    description: "Status workflow",
  },
  {
    value: "calendar",
    label: "Calendar",
    icon: <Calendar size={16} />,
    description: "Time-based view",
  },
  {
    value: "agenda",
    label: "Agenda",
    icon: <Clock size={16} />,
    description: "Focused list",
  },
];

export function ViewModeToggle({
  activeMode,
  onChange,
  className = "",
  showLabels = false,
  compact = true,
}: ViewModeToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg p-1 bg-bg-tertiary/50 border border-border-primary",
        compact ? "gap-0" : "gap-1",
        className,
      )}
      role="group"
      aria-label="View mode selector"
    >
      {VIEW_MODES.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onChange(mode.value)}
          title={mode.description}
          aria-label={`${mode.label} view`}
          aria-pressed={activeMode === mode.value}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all duration-150",
            "text-text-tertiary hover:text-text-primary",
            activeMode === mode.value
              ? "bg-accent text-white shadow-sm hover:bg-accent-hover"
              : "hover:bg-bg-secondary",
          )}
        >
          {mode.icon}
          {showLabels && (
            <span
              className={cn(
                "font-medium transition-colors",
                compact ? "text-xs" : "text-sm",
              )}
            >
              {mode.label}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

