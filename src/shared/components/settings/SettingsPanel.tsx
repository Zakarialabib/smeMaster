import type { ReactNode } from "react";
import { cn } from "@shared/utils/cn";
import { SETTINGS_PANEL } from "@shared/styles/ui-tokens";

/**
 * SettingsPanel — Outer container for every settings tab.
 *
 * Provides consistent padding, max-width, and scroll behavior.
 * All settings tab content must be wrapped in this panel.
 *
 * @example
 * ```tsx
 * <SettingsPanel>
 *   <SettingsSection title="Display">...</SettingsSection>
 * </SettingsPanel>
 * ```
 */
export function SettingsPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full flex flex-col gap-6 overflow-y-auto",
        SETTINGS_PANEL,
        className,
      )}
    >
      {children}
    </div>
  );
}
