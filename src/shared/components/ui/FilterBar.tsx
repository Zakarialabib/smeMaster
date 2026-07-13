/**
 * Filter Bar - Styled controls for filtering tasks/emails by status, priority, grouping, etc.
 * Replaces raw HTML <select> dropdowns with polished, accessible components.
 */
import { useCallback } from "react";
import { cn } from "@shared/utils/cn";
import { StyledSelect } from "./StyledSelect";
import { Filter } from "lucide-react";

export interface FilterBarOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface FilterBarConfig {
  status?: {
    label: string;
    options: FilterBarOption[];
    value: string;
  };
  priority?: {
    label: string;
    options: FilterBarOption[];
    value: string;
  };
  groupBy?: {
    label: string;
    options: FilterBarOption[];
    value: string;
  };
  sortBy?: {
    label: string;
    options: FilterBarOption[];
    value: string;
  };
  dateFilter?: {
    label: string;
    options: FilterBarOption[];
    value: string;
  };
}

export interface FilterBarProps {
  /** Filter configuration and current values */
  config: FilterBarConfig;
  /** Called when any filter changes: (filterName, newValue) */
  onFilterChange: (filterName: string, value: string) => void;
  /** Show as compact inline version */
  compact?: boolean;
  /** Optional custom className */
  className?: string;
  /** Show filter icon and label */
  showLabel?: boolean;
  /** Position filters vertically on small screens */
  responsive?: boolean;
}

export function FilterBar({
  config,
  onFilterChange,
  compact = false,
  className = "",
  showLabel = true,
  responsive = true,
}: FilterBarProps) {
  const handleChange = useCallback(
    (filterName: string, e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange(filterName, e.target.value);
    },
    [onFilterChange],
  );

  const containerClass = cn(
    "w-full flex justify-start items-cnter gap-2 flex-wrap",
    responsive ? "md:flex-nowrap" : "",
    "px-3 py-2 border-b border-border-primary glass-category-bar",
    compact ? "gap-1.5" : "gap-2.5",
    className,
  );

  return (
    <div className={containerClass} role="region" aria-label="Email filters">
      {/* Label with icon */}
      {showLabel && (
        <div className="flex items-center gap-1 text-text-secondary text-sm font-medium shrink-0">
          <Filter size={16} className="text-accent" />
          <span className="hidden sm:inline">Filters</span>
        </div>
      )}

      {/* Priority filter */}
      {config.priority && (
        <StyledSelect
          id="priority-filter"
          value={config.priority.value}
          onChange={(e) => handleChange("priority", e)}
          aria-label="Filter by priority"
          compact
          size="sm"
          className="flex-1 min-w-[90px] sm:min-w-[120px]"
        >
          {config.priority.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </StyledSelect>
      )}

      {/* Group by filter */}
      {config.groupBy && (
        <StyledSelect
          id="groupby-filter"
          value={config.groupBy.value}
          onChange={(e) => handleChange("groupBy", e)}
          aria-label="Group by"
          compact
          size="sm"
          className="flex-1 min-w-[90px] sm:min-w-[120px]"
        >
          {config.groupBy.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </StyledSelect>
      )}

      {/* Date filter */}
      {config.dateFilter && (
        <StyledSelect
          id="date-filter"
          value={config.dateFilter.value}
          onChange={(e) => handleChange("dateFilter", e)}
          aria-label="Date range"
          compact
          size="sm"
          className="flex-1 min-w-[90px] sm:min-w-[120px]"
        >
          {config.dateFilter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </StyledSelect>
      )}
    </div>
  );
}

