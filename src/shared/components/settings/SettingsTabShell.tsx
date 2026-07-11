import { type ReactNode, useState } from "react";
import { ChevronRight, ChevronDown, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@shared/utils/cn";
import { StatTile, type StatTileProps } from "./StatTile";

/** A single help-card item: a label header + body text. */
export interface HelpCardItem {
  label: string;
  body: string;
}

export interface SettingsTabShellProps {
  /** Lucide icon component for the tab hero (e.g. `Globe`, `Activity`). */
  icon: LucideIcon;
  /** Tab title (caller does the `t(...)` translation themselves). */
  title: string;
  /** Short description shown under the title. */
  description: string;
  /** Optional action buttons (e.g. "Bulk Check", "AI Generate"). */
  headerActions?: ReactNode;
  /** Optional stat tiles rendered as a grid above the body. */
  stats?: StatTileProps[];
  /** Optional collapsible help card items. */
  help?: HelpCardItem[];
  /** Whether the help card starts expanded. Defaults to false. */
  helpDefaultOpen?: boolean;
  /** The tab body. */
  children: ReactNode;
  className?: string;
}

/**
 * SettingsTabShell - tab hero + optional stats grid + optional help card +
 * body, used across all settings tabs.
 *
 * Renders the consistent layout shared by Dns/Content/Bounce/Blacklist/
 * Warming/Snooze/... tabs: flex column with max-w-4xl/5xl, hero with icon
 * + title + description + actions, then optional stats, then children.
 *
 * The help card uses the same collapsible toggle bar pattern as the existing
 * `HelpCard` in settings. The caller may pre-translate label/body strings
 * (i18n migration of the help copy is a deferred follow-up per spec S8).
 */
export function SettingsTabShell({
  icon: Icon,
  title,
  description,
  headerActions,
  stats,
  help,
  helpDefaultOpen = false,
  children,
  className,
}: SettingsTabShellProps) {
  const [helpOpen, setHelpOpen] = useState(helpDefaultOpen);
  const hasStats = !!stats && stats.length > 0;
  const hasHelp = !!help && help.length > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-6 max-w-4xl mx-auto pb-8",
        className,
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Icon className="w-5 h-5 text-accent" />
            {title}
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
        </div>
        {headerActions && (
          <div className="flex items-center gap-2">{headerActions}</div>
        )}
      </div>

      {/* Stats grid */}
      {hasStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats!.map((s, i) => (
            <StatTile key={`${s.label}-${i}`} {...s} />
          ))}
        </div>
      )}

      {/* Help card (collapsible) */}
      {hasHelp && (
        <HelpCard
          items={help!}
          open={helpOpen}
          onToggle={() => setHelpOpen((o) => !o)}
        />
      )}

      {/* Body */}
      {children}
    </div>
  );
}

/* --- Local HelpCard --- */

interface HelpCardInternalProps {
  items: HelpCardItem[];
  open: boolean;
  onToggle: () => void;
}

function HelpCard({ items, open, onToggle }: HelpCardInternalProps) {
  if (items.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left bg-accent/5 border border-accent/12 rounded-[10px] px-4 py-2.5 hover:bg-accent/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <ChevronRight size={14} className="text-accent shrink-0" />
          <HelpCircle size={13} className="text-accent shrink-0" />
          <span className="text-xs font-medium text-text-secondary">
            Learn more
          </span>
          <span className="ml-auto text-[10px] text-text-tertiary uppercase tracking-wider">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="bg-accent/5 border border-accent/12 rounded-[10px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HelpCircle size={14} className="text-accent shrink-0" />
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Help
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          aria-label="Collapse help"
        >
          <ChevronDown size={14} />
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 mt-0.5 bg-accent/15 text-accent">
              <HelpCircle size={12} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-accent">
                {item.label}
              </span>
              <p className="text-[13px] text-text-secondary leading-relaxed mt-0.5">
                {item.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SettingsTabShell;
