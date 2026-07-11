import { cn } from "@shared/utils/cn";

/**
 * SettingsDivider — Horizontal rule with optional centered label.
 *
 * Used sparingly between major section boundaries (max 1 per tab).
 *
 * @example
 * ```tsx
 * <SettingsDivider />
 * <SettingsDivider label="Advanced" />
 * ```
 */
export function SettingsDivider({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  if (!label) {
    return (
      <hr
        className={cn(
          "border-t border-border-primary/20 my-2",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 my-4",
        className,
      )}
    >
      <hr className="flex-1 border-t border-border-primary/20" />
      <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-[0.08em] shrink-0">
        {label}
      </span>
      <hr className="flex-1 border-t border-border-primary/20" />
    </div>
  );
}
