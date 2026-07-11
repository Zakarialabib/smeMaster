import { cn } from "@shared/utils/cn";

export type CenteredLoaderSize = "sm" | "md" | "lg";

export interface CenteredLoaderProps {
  /** Optional caption rendered below the spinner. */
  label?: string;
  /** Spinner diameter. Defaults to "md" (32px). */
  size?: CenteredLoaderSize;
  /**
   * Layout variant.
   * - `false` (default): stacked column with vertical padding, suitable for
   *   full-area loading states (e.g. an entire panel showing "Loading…").
   * - `true`: inline row with no padding, suitable for placing the spinner
   *   next to text (e.g. "Generating summary…" with the spinner on the left).
   */
  inline?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<CenteredLoaderSize, string> = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-2",
  lg: "w-10 h-10 border-[3px]",
};

/**
 * CenteredLoader — spinner with optional caption.
 *
 * Replaces 10+ inline copies of the border-accent spinner pattern across
 * tasks, mail, calendar, vault, and contacts. Uses a pure CSS spinner (no
 * SVG) for consistency with the existing code style.
 *
 * Two layouts:
 * - Default (`inline={false}`): stacked column with `py-6` padding — drop
 *   into an empty panel that should show "Loading…".
 * - `inline={true}`: horizontal row, no padding — drop next to a label
 *   like "Generating summary…".
 *
 * @example
 * ```tsx
 * <CenteredLoader label="Loading tasks…" />
 * <CenteredLoader size="sm" />
 * <CenteredLoader size="lg" label="Loading…" className="py-12" />
 * <CenteredLoader size="sm" inline label="Generating…" />
 * ```
 */
export function CenteredLoader({
  label,
  size = "md",
  inline = false,
  className,
}: CenteredLoaderProps) {
  return (
    <div
      className={cn(
        inline
          ? "inline-flex items-center gap-2"
          : "flex flex-col items-center justify-center gap-2 py-6",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          SIZE_CLASSES[size],
          "border-accent/30 border-t-accent rounded-full animate-spin shrink-0",
        )}
        aria-hidden="true"
      />
      {label && (
        <p className={cn("text-xs text-text-tertiary", inline && "leading-none")}>
          {label}
        </p>
      )}
    </div>
  );
}

