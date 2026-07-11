import type { LucideIcon } from "lucide-react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Optional ÔÇö whether to show labels (default: true) */
  showLabels?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** ARIA label for the group */
  ariaLabel?: string;
  /** Extra class name */
  className?: string;
}

const SIZE_CLASSES = {
  sm: "px-2 py-1 text-[0.625rem] min-h-[28px]",
  md: "px-3 py-1.5 text-xs min-h-[32px]",
} as const;

const ACTIVE_CLASSES = {
  sm: "bg-bg-tertiary text-text-primary shadow-sm",
  md: "bg-accent text-white shadow-sm",
} as const;

const INACTIVE_CLASSES =
  "text-text-tertiary hover:text-text-primary";

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1";

/**
 * Generic segmented control ÔÇö a row of toggle buttons.
 *
 * Used by contacts ViewToggle (list/grid + density) and tasks ViewToggle
 * (list/kanban/calendar/agenda + density). Keeps styling and accessibility
 * in one place so both features stay visually consistent.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  showLabels = true,
  size = "sm",
  ariaLabel = "Segmented control",
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex items-center bg-bg-tertiary rounded-lg p-0.5 ${className}`}
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        const Icon = opt.icon;

        return (
          <button
            key={opt.value}
            role="radio"
            type="button"
            aria-checked={isActive}
            aria-label={opt.label}
            onClick={() => onChange(opt.value)}
            className={`
              inline-flex items-center justify-center gap-1.5 rounded-md transition-all
              ${SIZE_CLASSES[size]}
              ${isActive ? ACTIVE_CLASSES[size] : INACTIVE_CLASSES}
              ${FOCUS_RING}
            `}
          >
            {Icon && <Icon size={size === "sm" ? 12 : 14} />}
            {showLabels && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Renders density-toggle buttons (compact / normal / comfortable).
 * Each button shows a single-character symbol instead of a full label.
 */
export interface DensityControlProps<T extends string = string> {
  options: { value: T; label: string; symbol: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function DensityControl<T extends string = string>({
  options,
  value,
  onChange,
}: DensityControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label="Row density"
      className="flex items-center bg-bg-tertiary rounded-lg p-0.5"
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            type="button"
            aria-checked={isActive}
            aria-label={`${opt.label} density`}
            onClick={() => onChange(opt.value)}
            title={opt.label}
            className={`
              inline-flex items-center justify-center w-7 h-7 rounded-md transition-all text-xs font-medium min-h-[44px] min-w-[44px]
              ${isActive ? "bg-accent text-white shadow-sm" : "text-text-tertiary hover:text-text-primary"}
              focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1
            `}
          >
            {opt.symbol}
          </button>
        );
      })}
    </div>
  );
}
