import type { ReactNode } from "react";
import { cn } from "@shared/utils/cn";
import {
  CARD_BASE,
  SETTINGS_DANGER_BG,
  SETTINGS_COMPACT_BG,
  SETTINGS_SECTION_GAP,
} from "@shared/styles/ui-tokens";

type SectionVariant = "default" | "danger" | "compact";

/**
 * SettingsSection — A self-contained group of related settings.
 *
 * - `default`: Card with bg, border, rounded-xl (standard)
 * - `danger`: Red-tinted variant for destructive actions
 * - `compact`: No background/border — use within a larger card
 *
 * @example
 * ```tsx
 * <SettingsSection title="Display" description="Font and layout">
 *   <SettingsRow label="Font size">...</SettingsRow>
 * </SettingsSection>
 * ```
 */
export function SettingsSection({
  title,
  description,
  children,
  variant = "default",
  className,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  variant?: SectionVariant;
  className?: string;
  /** Optional action button rendered in the header (e.g. "Add", "Reset") */
  action?: ReactNode;
}) {
  const containerClass = cn(
    "flex flex-col",
    variant === "default" && CARD_BASE,
    variant === "danger" && cn(CARD_BASE, SETTINGS_DANGER_BG),
    variant === "compact" && SETTINGS_COMPACT_BG,
    SETTINGS_SECTION_GAP,
    className,
  );

  return (
    <div className={containerClass}>
      {/* Header */}
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary leading-snug">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {action && (
            <div className="shrink-0">{action}</div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col">
        {children}
      </div>
    </div>
  );
}
