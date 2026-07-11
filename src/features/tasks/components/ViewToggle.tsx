import { useState, useRef, useEffect, useCallback } from "react";
import { List, LayoutGrid, Calendar, ClipboardList } from "lucide-react";
import { usePlatform } from "@shared/hooks/usePlatform";
import { FOCUS_RING, TOOLTIP_BASE } from "@shared/styles/ui-tokens";
import type { TaskViewMode, TaskDensity } from "@features/tasks/stores/taskStore";

/**
 * View mode options with their icons and labels
 */
const VIEW_MODES: { value: TaskViewMode; label: string; icon: typeof List }[] = [
  { value: "list", label: "List", icon: List },
  { value: "kanban", label: "Kanban", icon: LayoutGrid },
  { value: "calendar", label: "Calendar", icon: Calendar },
  { value: "agenda", label: "Agenda", icon: ClipboardList },
];

/**
 * Density options with their labels
 */
const DENSITY_OPTIONS: { value: TaskDensity; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "comfortable", label: "Comfortable" },
];

/**
 * Props for ViewToggle component
 * @spec §3.7
 */
export interface ViewToggleProps {
  /** Current view mode */
  viewMode: TaskViewMode;
  /** Current density setting */
  density: TaskDensity;
  /** Handler for view mode changes */
  onViewModeChange: (mode: TaskViewMode) => void;
  /** Handler for density changes */
  onDensityChange: (density: TaskDensity) => void;
  /** Total number of tasks (for smart recommendations) */
  taskCount: number;
}

/**
 * ViewToggle - Segmented control for switching between task views.
 *
 * Features:
 * - View mode buttons: List (≡), Kanban (▦), Calendar (📅), Agenda (📋)
 * - Density controls: compact (-), normal (○), comfortable (+)
 * - Smart recommendation tooltip when taskCount > 50 and viewMode === "list"
 * - Agenda hidden on desktop (only mobile)
 * - Calendar hidden on mobile (replaced by Agenda)
 *
 * @spec §3.7
 */
export function ViewToggle({
  viewMode,
  density,
  onViewModeChange,
  onDensityChange,
  taskCount,
}: ViewToggleProps) {
  const { screen } = usePlatform();
  const [showRecommendation, setShowRecommendation] = useState(false);
  const recommendationRef = useRef<HTMLDivElement>(null);

  // Show recommendation when taskCount > 50 and viewMode is list
  const shouldShowRecommendation = taskCount > 50 && viewMode === "list";

  // Close recommendation on outside click or escape
  useEffect(() => {
    if (!shouldShowRecommendation) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (recommendationRef.current && !recommendationRef.current.contains(e.target as Node)) {
        setShowRecommendation(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowRecommendation(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shouldShowRecommendation]);

  const handleViewModeClick = useCallback(
    (mode: TaskViewMode) => {
      onViewModeChange(mode);
      // Close recommendation when user selects kanban
      if (mode === "kanban" && showRecommendation) {
        setShowRecommendation(false);
      }
    },
    [onViewModeChange, showRecommendation],
  );

  const handleDensityClick = useCallback(
    (newDensity: TaskDensity) => {
      onDensityChange(newDensity);
    },
    [onDensityChange],
  );

  // Density button symbols
  const getDensitySymbol = (d: TaskDensity): string => {
    switch (d) {
      case "compact":
        return "-";
      case "normal":
        return "○";
      case "comfortable":
        return "+";
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* View Mode Segmented Control */}
      <div
        role="radiogroup"
        aria-label="Switch task view"
        className="flex items-center bg-bg-tertiary rounded-lg p-0.5"
      >
        {VIEW_MODES.map((mode) => {
          // Hide agenda on desktop, hide calendar on mobile
          if (screen.isDesktop && mode.value === "agenda") return null;
          if (!screen.isDesktop && mode.value === "calendar") return null;

          const Icon = mode.icon;
          const isActive = viewMode === mode.value;

          return (
            <button
              key={mode.value}
              role="radio"
              aria-checked={isActive}
              onClick={() => handleViewModeClick(mode.value)}
              className={`
                flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all
                ${
                  isActive
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }
                ${FOCUS_RING}
              `}
            >
              <Icon size={14} />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Density Controls - Desktop only */}
      {screen.isDesktop && (
        <div
          role="radiogroup"
          aria-label="Change density"
          className="flex items-center bg-bg-tertiary rounded-lg p-0.5 ml-1"
        >
          {DENSITY_OPTIONS.map((option) => {
            const isActive = density === option.value;

            return (
              <button
                key={option.value}
                role="radio"
                aria-checked={isActive}
                aria-label={`Set ${option.label} density`}
                onClick={() => handleDensityClick(option.value)}
                className={`
                  flex items-center justify-center w-7 h-7 text-xs font-medium rounded-md transition-all
                  ${
                    isActive
                      ? "bg-accent text-white shadow-sm"
                      : "text-text-tertiary hover:text-text-primary"
                  }
                  ${FOCUS_RING}
                `}
                title={option.label}
              >
                {getDensitySymbol(option.value)}
              </button>
            );
          })}
        </div>
      )}

      {/* Smart Recommendation Tooltip */}
      {shouldShowRecommendation && showRecommendation && (
        <div
          ref={recommendationRef}
          className={`${TOOLTIP_BASE} right-0 mt-2 whitespace-nowrap`}
          role="tooltip"
        >
          <span>Try Kanban for better overview</span>
          <button
            onClick={() => handleViewModeClick("kanban")}
            className="ml-2 text-accent hover:underline text-xs font-medium"
          >
            Switch now
          </button>
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-border-primary" />
        </div>
      )}

      {/* Recommendation Trigger - Show when condition is met */}
      {shouldShowRecommendation && !showRecommendation && (
        <button
          onClick={() => setShowRecommendation(true)}
          className={`
            flex items-center gap-1 px-2 py-1 text-xs rounded-md
            bg-warning/10 text-warning border border-warning/20
            hover:bg-warning/20 transition-colors
            ${FOCUS_RING}
          `}
          aria-label="View recommendation available"
        >
          <span>💡</span>
          <span className="hidden sm:inline">Kanban recommended</span>
        </button>
      )}
    </div>
  );
}