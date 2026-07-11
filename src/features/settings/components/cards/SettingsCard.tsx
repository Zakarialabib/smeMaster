import type { ReactNode } from "react";

export type SettingsCardVariant = "default" | "compact";

export interface SettingsCardProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
  variant?: SettingsCardVariant;
}

export function SettingsCard({
  title,
  description,
  children,
  className = "",
  action,
  variant = "default",
}: SettingsCardProps) {
  const isCompact = variant === "compact";

  return (
    <div
      className={`${isCompact ? "flex flex-col gap-3 p-3" : "flex flex-col sm:flex-row sm:items-start gap-4 p-4"} rounded-xl bg-bg-secondary border border-border-primary ${className}`}
    >
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-text-primary">
          {title}
        </h3>
        {description && (
          <p className={`text-xs text-text-tertiary ${isCompact ? "" : "mt-1"}`}>
            {description}
          </p>
        )}
        {children && <div className={isCompact ? "mt-2" : "mt-3"}>{children}</div>}
      </div>
      {action && (
        <div className={`flex-shrink-0 ${isCompact ? "self-start" : "self-start sm:self-center"}`}>
          {action}
        </div>
      )}
    </div>
  );
}

