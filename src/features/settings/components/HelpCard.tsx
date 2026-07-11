import { useState } from "react";
import { HelpCircle, Lightbulb, Clock, AlertTriangle, ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";

/* ─── Education Icons ─── */

const iconMap: Record<string, LucideIcon> = {
  why: HelpCircle,
  how: Lightbulb,
  when: Clock,
};

/* ─── Education Item ─── */

interface EducationItem {
  type: "why" | "how" | "when"|'tip';
  text: string;
}

/* ─── Props ─── */

interface HelpCardProps {
  title?: string;
  items: EducationItem[];
  /** Optional warning variant */
  variant?: "default" | "warning";
  /** Optional class name */
  className?: string;
  /** Collapse by default, expand on click. Default: true */
  collapsible?: boolean;
  /** Force expanded (ignored when collapsible is false) */
  defaultOpen?: boolean;
}

/**
 * Education icon style per icon type — 18x18 rounded box with tinted bg.
 */
const iconStyles: Record<string, string> = {
  why: "bg-warning/15 text-warning",
  how: "bg-accent/15 text-accent",
  when: "bg-success/15 text-success",
};

const labelStyles: Record<string, string> = {
  why: "text-warning",
  how: "text-accent",
  when: "text-success",
};

/**
 * HelpCard — "Why / How / When" educational component.
 *
 * Per Technical Spec §2.B:
 * - Container: bg-accent/5, border border-accent/12, rounded-[10px], p-4, mt-3
 * - Iconography: 18x18 rounded boxes with lucide-react icons
 *   - Why (Warning/Amber): user benefit
 *   - How (Accent/Indigo): technical background
 *   - When (Success/Emerald): best use case
 *
 * Supports accordion mode (collapsible by default) — shows a compact toggle
 * bar when collapsed, expands to full card on click.
 *
 * @example
 * ```tsx
 * <HelpCard
 *   title="Undo Send"
 *   items={[
 *     { type: 'why', text: 'Prevents accidental sends...' },
 *     { type: 'how', text: 'Email stored in local Tauri cache...' },
 *     { type: 'when', text: 'Best for high-stakes communication.' },
 *   ]}
 * />
 * ```
 */
export function HelpCard({
  title,
  items,
  variant = "default",
  className = "",
  collapsible = true,
  defaultOpen = false,
}: HelpCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  /* ─── Collapsed: compact toggle bar ─── */
  if (collapsible && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`
          w-full text-left bg-accent/5 border border-accent/12 rounded-[10px] px-4 py-2.5 mt-3
          ${variant === "warning" ? "border-warning/20 bg-warning/4" : ""}
          hover:bg-accent/10 transition-colors cursor-pointer
          ${className}
        `}
      >
        <div className="flex items-center gap-2">
          <ChevronRight size={14} className="text-accent shrink-0" />
          <HelpCircle size={13} className="text-accent shrink-0" />
          <span className="text-xs font-medium text-text-secondary">
            {title ?? "Learn more — why, how, when"}
          </span>
          <span className="ml-auto text-[10px] text-text-tertiary uppercase tracking-wider">
            {items.map((i) => i.type.charAt(0).toUpperCase()).join(" · ")}
          </span>
        </div>
      </button>
    );
  }

  /* ─── Expanded: full card ─── */
  return (
    <div
      className={`
        bg-accent/5 border border-accent/12 rounded-[10px] p-4 mt-3
        ${variant === "warning" ? "border-warning/20 bg-warning/4" : ""}
        ${className}
      `}
    >
      {/* Header row with collapse button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {variant === "warning" ? (
            <AlertTriangle size={14} className="text-warning shrink-0" />
          ) : (
            <HelpCircle size={14} className="text-accent shrink-0" />
          )}
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {title ?? "Why · How · When"}
          </span>
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Collapse help"
          >
            <ChevronDown size={14} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => {
          const Icon = iconMap[item.type] ?? HelpCircle;
          return (
            <div key={idx} className="flex items-start gap-3">
              {/* Icon box — 18x18 rounded */}
              <div
                className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 mt-0.5 ${iconStyles[item.type]}`}
              >
                <Icon size={12} />
              </div>
              <div className="min-w-0">
                <span className={`text-[11px] font-semibold uppercase tracking-[0.04em] ${labelStyles[item.type]}`}>
                  {item.type === "why" ? "Why" : item.type === "how" ? "How" : "When"}
                </span>
                <p className="text-[13px] text-text-secondary leading-relaxed mt-0.5">
                  {item.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * InlineTooltip — hoverable (?) icon for technical terminology.
 *
 * Shows a brief definition/summary on hover (desktop) or tap (mobile).
 * For full details, use HelpCard instead.
 */
export function InlineTooltip({ text, label }: { text: string; label?: string }) {
  return (
    <span className="inline-flex items-center group relative">
      {label && <span className="text-sm text-text-secondary">{label}</span>}
      <span className="info-tooltip-trigger" title={text} tabIndex={0} role="tooltip" aria-label={text}>
        ?
      </span>
      {/* Desktop tooltip on hover */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block group-focus-within:block z-30 w-56 pointer-events-none">
        <span className="block bg-bg-primary border border-border-primary rounded-lg shadow-lg px-3 py-2 text-xs text-text-secondary text-left leading-relaxed pointer-events-none">
          {text}
        </span>
      </span>
    </span>
  );
}
