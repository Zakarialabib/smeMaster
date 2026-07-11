import type { ReactNode } from "react";
import { cn } from "@shared/utils/cn";

export type StatTone = "neutral" | "success" | "warning" | "danger" | "accent";

export interface StatTileProps {
  label: string;
  value: number | string;
  /** Visual tone. Defaults to "neutral". */
  tone?: StatTone;
  /** Optional icon (typically a Lucide icon component). */
  icon?: ReactNode;
  /** Optional small subtitle line. */
  sub?: string;
  /** When true, shows "—" instead of the value. */
  loading?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<StatTone, string> = {
  neutral: "text-text-secondary bg-bg-tertiary/40 border-border/40",
  success: "text-success bg-success/5 border-success/20",
  warning: "text-warning bg-warning/5 border-warning/20",
  danger: "text-danger bg-danger/5 border-danger/20",
  accent: "text-accent bg-accent/5 border-accent/20",
};

/**
 * StatTile — compact metric card used across settings tabs.
 *
 * Consolidates 6 inline `StatCard` copies in `DnsTab`, `ContentTab`,
 * `BounceTab`, `BlacklistTab`, `WarmingTab`, `SnoozeTab`, and a 7th
 * `StatCard` in `BounceManager`.
 *
 * @example
 * ```tsx
 * <StatTile
 *   label="Domains Monitored"
 *   value="—"
 *   icon={<Globe className="w-4 h-4" />}
 *   tone="accent"
 *   loading
 * />
 * ```
 */
export function StatTile({
  label,
  value,
  tone = "neutral",
  icon,
  sub,
  loading = false,
  className,
}: StatTileProps) {
  const displayValue = loading ? "—" : value;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {icon && (
        <div className="p-2 rounded-lg bg-white/50 text-current shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
          {label}
        </p>
        <p className="text-sm font-bold truncate">{displayValue}</p>
        {sub && (
          <p className="text-[10px] opacity-60 truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}

