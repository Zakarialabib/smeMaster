import { List, LayoutGrid, Minus, Circle, Plus } from "lucide-react";
import type { ViewMode, Density } from "@features/contacts/hooks/useViewPrefs";

interface ViewToggleProps {
  viewMode: ViewMode;
  density: Density;
  onViewModeChange: (mode: ViewMode) => void;
  onDensityChange: (density: Density) => void;
}

const SEG_BASE =
  "inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent min-h-[28px]";
const SEG_ACTIVE = "bg-bg-tertiary text-text-primary";
const SEG_INACTIVE = "text-text-tertiary hover:text-text-primary";

const DENSITY_OPTIONS: { value: Density; label: string; icon: typeof Minus }[] = [
  { value: "compact", label: "Compact", icon: Minus },
  { value: "normal", label: "Normal", icon: Circle },
  { value: "comfortable", label: "Comfortable", icon: Plus },
];

/**
 * ViewToggle — segmented controls for view mode (list/grid) and density.
 * Density selector is hidden in grid view per spec (grid uses its own column count).
 */
export function ViewToggle({
  viewMode,
  density,
  onViewModeChange,
  onDensityChange,
}: ViewToggleProps) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label="View preferences"
    >
      {/* List / Grid segmented control */}
      <div
        className="flex items-center bg-bg-tertiary rounded-lg p-0.5"
        role="group"
        aria-label="View mode"
      >
        <button
          type="button"
          onClick={() => onViewModeChange("list")}
          className={`${SEG_BASE} ${viewMode === "list" ? SEG_ACTIVE : SEG_INACTIVE}`}
          title="List view"
          aria-label="List view"
          aria-pressed={viewMode === "list"}
        >
          <List size={12} />
          <span>List</span>
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("grid")}
          className={`${SEG_BASE} ${viewMode === "grid" ? SEG_ACTIVE : SEG_INACTIVE}`}
          title="Grid view"
          aria-label="Grid view"
          aria-pressed={viewMode === "grid"}
        >
          <LayoutGrid size={12} />
          <span>Grid</span>
        </button>
      </div>

      {/* Density segmented control (list view only) */}
      {viewMode === "list" && (
        <>
          <div className="w-px h-4 bg-border-primary" aria-hidden="true" />
          <div
            className="flex items-center bg-bg-tertiary rounded-lg p-0.5"
            role="group"
            aria-label="Row density"
          >
            {DENSITY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = density === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onDensityChange(opt.value)}
                  className={`${SEG_BASE} ${active ? SEG_ACTIVE : SEG_INACTIVE}`}
                  title={`${opt.label} rows`}
                  aria-label={`${opt.label} density`}
                  aria-pressed={active}
                >
                  <Icon size={10} />
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
