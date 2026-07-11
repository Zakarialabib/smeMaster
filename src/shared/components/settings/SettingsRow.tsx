import type { ReactNode, ElementType } from "react";
import { cn } from "@shared/utils/cn";
import { SETTINGS_ROW_MIN_H, SETTINGS_ROW_GAP } from "@shared/styles/ui-tokens";

/**
 * SettingsRow — A single setting: label + optional description + control.
 *
 * Consistent height, hover highlight, and border-bottom separator.
 * Last child in a section has no border.
 *
 * @example
 * ```tsx
 * <SettingsRow
 *   label="Block Remote Images"
 *   description="Prevent senders from knowing you opened an email"
 * >
 *   <Toggle checked={true} onChange={fn} />
 * </SettingsRow>
 * ```
 */
export function SettingsRow({
  label,
  description,
  children,
  disabled = false,
  className,
  onClick,
  icon: Icon,
}: {
  label: string;
  description?: string;
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Optional callback when the row itself is clicked */
  onClick?: () => void;
  /** Optional leading icon */
  icon?: ElementType;
}) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-between",
        SETTINGS_ROW_GAP,
        SETTINGS_ROW_MIN_H,
        "px-3 -mx-3 rounded-lg transition-colors",
        "border-b border-border-primary/10 last:border-b-0",
        "text-left",
        onClick && !disabled && "cursor-pointer",
        !disabled && "hover:bg-bg-hover/50",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
        {Icon && (
          <div className="w-7 h-7 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
            <Icon size={14} className="text-accent" />
          </div>
        )}
        <div className="min-w-0">
          <span className="text-sm font-medium text-text-primary">
            {label}
          </span>
          {description && (
            <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {children && (
        <div className="shrink-0 flex items-center gap-2">
          {children}
        </div>
      )}
    </Component>
  );
}
