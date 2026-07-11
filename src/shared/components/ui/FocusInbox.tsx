/**
 * FocusInbox — Chatwoot-inspired unified feed that aggregates Tasks, pending Emails,
 * and Automation Alerts into a single timeline view.
 *
 * Features:
 * - Filter chips: All / Tasks / Emails / Alerts (horizontally scrollable on mobile)
 * - Feed items with category icon, title, preview, relative timestamp, unread indicator
 * - Swipe actions: complete (tasks), archive (emails), dismiss (alerts)
 * - Tap-to-expand for alert items
 * - Pull-to-refresh support
 * - Responsive: single-column timeline on mobile, wider layout on desktop
 * - Empty state with InboxClearIllustration
 */
import { useState, useMemo, type ReactNode } from "react";
import {
  CheckCircle2,
  Mail,
  Bell,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SwipeableRow } from "./SwipeableRow";
import type { SwipeActions } from "@shared/hooks/useSwipeGesture";
import { PullToRefresh } from "./PullToRefresh";
import { usePlatform } from "@shared/hooks/usePlatform";
import { EmptyState } from "./EmptyState";
import { InboxClearIllustration } from "./illustrations";
import { cn } from "@shared/utils/cn";

/* ─── Public Types ─────────────────────────────────────────────────── */

export type FocusItemType = "task" | "email" | "alert";

export interface FocusItemMetadata {
  priority?: "low" | "medium" | "high" | "urgent";
  /** Sender name / email (email items) */
  from?: string;
  taskStatus?: "pending" | "in_progress" | "completed";
  alertSeverity?: "info" | "warning" | "critical";
  alertCategory?: string;
}

export interface FocusItem {
  id: string;
  type: FocusItemType;
  title: string;
  preview: string;
  timestamp: Date;
  unread: boolean;
  metadata?: FocusItemMetadata;
}

export interface FocusInboxProps {
  /** Feed items to display */
  items: FocusItem[];
  /** Called when user pulls to refresh */
  onRefresh?: () => Promise<void>;
  /** Called when a swipe/tap action is performed */
  onItemAction?: (
    itemId: string,
    action: "complete" | "archive" | "expand" | "snooze" | "dismiss",
  ) => void;
  /** Additional classes for the container */
  className?: string;
  /** Section title — defaults to "Focus Inbox" */
  title?: string;
  /** External refreshing state */
  refreshing?: boolean;
}

/* ─── Filter definitions ───────────────────────────────────────────── */

type FilterKey = "all" | FocusItemType;

interface FilterChip {
  key: FilterKey;
  label: string;
}

const FILTERS: FilterChip[] = [
  { key: "all", label: "All" },
  { key: "task", label: "Tasks" },
  { key: "email", label: "Emails" },
  { key: "alert", label: "Alerts" },
];

/* ─── Icon map ─────────────────────────────────────────────────────── */

const TYPE_ICON: Record<FocusItemType, LucideIcon> = {
  task: CheckCircle2,
  email: Mail,
  alert: Bell,
};

/* ─── Relative time helper ─────────────────────────────────────────── */

function getRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const seconds = Math.floor(abs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/* ─── Swipe action builder ─────────────────────────────────────────── */

function buildSwipeActions(
  item: FocusItem,
  onAction: FocusInboxProps["onItemAction"],
): SwipeActions {
  switch (item.type) {
    case "task":
      return {
        left: {
          primary: {
            label: "Complete",
            icon: "check-circle-2",
            color: "bg-success",
            onAction: () => onAction?.(item.id, "complete"),
          },
          secondary: {
            label: "Snooze",
            icon: "clock",
            color: "bg-warning",
            onAction: () => onAction?.(item.id, "snooze"),
          },
        },
      };
    case "email":
      return {
        left: {
          primary: {
            label: "Archive",
            icon: "archive",
            color: "bg-accent",
            onAction: () => onAction?.(item.id, "archive"),
          },
        },
      };
    case "alert":
      return {
        left: {
          primary: {
            label: "Dismiss",
            icon: "bell-off",
            color: "bg-text-tertiary",
            onAction: () => onAction?.(item.id, "dismiss"),
          },
        },
      };
  }
}

/* ─── Category count badge helper ──────────────────────────────────── */

function getFilterLabel(key: FilterKey, count: number): string {
  const base = FILTERS.find((f) => f.key === key)?.label ?? "All";
  return `${base} (${count})`;
}

/* ─── Single Feed Item ─────────────────────────────────────────────── */

interface FeedItemContentProps {
  item: FocusItem;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}

function FeedItemContent({
  item,
  isExpanded,
  onToggleExpand,
}: FeedItemContentProps) {
  const isAlert = item.type === "alert";
  const Icon = TYPE_ICON[item.type];

  const handleAlertClick = () => {
    if (isAlert) {
      onToggleExpand(item.id);
    }
  };

  const handleAlertKeyDown = (e: React.KeyboardEvent) => {
    if (isAlert && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onToggleExpand(item.id);
    }
  };

  /* -- Severity icon for expanded alerts -- */
  const alertSeverityIcon = (severity?: string): ReactNode => {
    if (!severity || severity === "info") return null;
    const colorClass =
      severity === "critical"
        ? "text-danger"
        : severity === "warning"
          ? "text-warning"
          : "text-accent";
    return <AlertTriangle size={10} className={colorClass} />;
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 border-b border-border-secondary transition-colors",
        item.unread && "bg-accent-light/50",
        isAlert && "cursor-pointer hover:bg-bg-hover",
      )}
      onClick={handleAlertClick}
      onKeyDown={handleAlertKeyDown}
      role={isAlert ? "button" : undefined}
      tabIndex={isAlert ? 0 : undefined}
      aria-expanded={isAlert ? isExpanded : undefined}
      aria-label={`${item.type}: ${item.title}`}
    >
      {/* Category icon */}
      <div className="shrink-0 mt-0.5" aria-hidden="true">
        <Icon
          size={24}
          strokeWidth={1.5}
          className={cn(
            "transition-colors",
            item.unread
              ? item.type === "alert"
                ? "text-warning"
                : "text-accent"
              : "text-text-tertiary",
          )}
        />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Title row + timestamp */}
        <div className="flex items-center justify-between gap-2">
          <h3
            className={cn(
              "text-sm truncate",
              item.unread
                ? "font-semibold text-text-primary"
                : "font-medium text-text-primary",
            )}
          >
            {item.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {item.unread && (
              <span
                className="w-2 h-2 rounded-full bg-accent"
                aria-label="Unread"
              />
            )}
            <time
              className="text-xs text-text-tertiary whitespace-nowrap tabular-nums"
              dateTime={item.timestamp.toISOString()}
            >
              {getRelativeTime(item.timestamp)}
            </time>
          </div>
        </div>

        {/* Preview line */}
        <p
          className={cn(
            "text-xs text-text-tertiary mt-0.5",
            isExpanded ? "" : "line-clamp-1",
          )}
        >
          {item.preview}
        </p>

        {/* Sender metadata (emails) */}
        {!isExpanded && item.type === "email" && item.metadata?.from && (
          <p className="text-[11px] text-text-tertiary/70 mt-0.5 truncate">
            {item.metadata.from}
          </p>
        )}

        {/* Expanded alert detail */}
        {isAlert && isExpanded && (
          <div className="mt-2 pt-2 border-t border-border-secondary space-y-1.5">
            {item.metadata?.alertCategory && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded-full">
                {alertSeverityIcon(item.metadata.alertSeverity)}
                {item.metadata.alertCategory}
              </span>
            )}
            <p className="text-xs text-text-secondary leading-relaxed">
              {item.preview}
            </p>
            {item.metadata?.alertSeverity === "critical" && (
              <p className="text-[11px] font-medium text-danger">
                Requires attention
              </p>
            )}
          </div>
        )}
      </div>

      {/* Expand indicator for alerts */}
      {isAlert && (
        <div className="shrink-0 mt-0.5 text-text-tertiary transition-transform">
          {isExpanded ? (
            <ChevronDown size={14} aria-hidden />
          ) : (
            <ChevronRight size={14} aria-hidden />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Feed Item wrapper (swipeable for tasks/emails, plain for alerts) ── */

interface FeedItemWrapperProps {
  item: FocusItem;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onAction?: FocusInboxProps["onItemAction"];
}

function FeedItemWrapper({
  item,
  isExpanded,
  onToggleExpand,
  onAction,
}: FeedItemWrapperProps) {
  const content = (
    <FeedItemContent
      item={item}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    />
  );

  // Alerts are tap-to-expand — no swipe wrapper
  if (item.type === "alert") return content;

  return (
    <SwipeableRow actions={buildSwipeActions(item, onAction)}>
      {content}
    </SwipeableRow>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export function FocusInbox({
  items,
  onRefresh,
  onItemAction,
  className = "",
  title = "Focus Inbox",
  refreshing = false,
}: FocusInboxProps) {
  const { screen } = usePlatform();
  const isMobile = screen.isMobile;
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(
    () => new Set(),
  );

  /* -- Toggle alert expand -- */
  const toggleExpand = (id: string) => {
    setExpandedAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /* -- Filter counts -- */
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: items.length };
    for (const type of ["task", "email", "alert"] as const) {
      result[type] = items.filter((i) => i.type === type).length;
    }
    return result;
  }, [items]);

  /* -- Filtered items -- */
  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return items;
    return items.filter((item) => item.type === activeFilter);
  }, [items, activeFilter]);

  /* -- Pull-to-refresh handler -- */
  const handleRefresh = async () => {
    await onRefresh?.();
  };

  /* -- Render empty state -- */
  const renderEmpty = () => (
    <div className="flex-1 flex items-center justify-center py-12">
      <EmptyState
        title="All caught up!"
        subtitle={
          activeFilter === "all"
            ? "No pending tasks, unread emails, or active alerts."
            : `No ${activeFilter === "task" ? "pending tasks" : activeFilter === "email" ? "unread emails" : "active alerts"} to show.`
        }
        illustration={InboxClearIllustration}
        size="md"
      />
    </div>
  );

  /* -- Render feed items -- */
  const renderFeed = () => {
    if (filteredItems.length === 0) return renderEmpty();

    return (
      <div className="divide-y divide-border-secondary" role="list">
        {filteredItems.map((item) => (
          <div key={item.id} role="listitem">
            <FeedItemWrapper
              item={item}
              isExpanded={expandedAlerts.has(item.id)}
              onToggleExpand={toggleExpand}
              onAction={onItemAction}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <section
      className={cn(
        "flex flex-col bg-bg-primary rounded-xl border border-border-primary overflow-hidden",
        isMobile ? "h-full rounded-none border-0" : "shadow-sm",
        className,
      )}
      aria-label={title}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-primary bg-bg-secondary/50">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <span className="text-xs text-text-tertiary tabular-nums">
          {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filter chips — horizontally scrollable on mobile */}
      <nav
        className="flex gap-1.5 overflow-x-auto hide-scrollbar px-4 py-2 border-b border-border-secondary"
        aria-label="Filter feed by category"
      >
        {FILTERS.map((filter) => {
          const count = counts[filter.key] ?? 0;
          const isActive = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={cn(
                "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
                isActive
                  ? "bg-accent text-white"
                  : "bg-bg-tertiary text-text-secondary hover:bg-bg-hover",
              )}
              aria-pressed={isActive}
              aria-label={`Show ${filter.label.toLowerCase()}`}
            >
              {getFilterLabel(filter.key, count)}
            </button>
          );
        })}
      </nav>

      {/* Feed — pull-to-refresh on mobile */}
      {isMobile ? (
        <PullToRefresh
          onRefresh={handleRefresh}
          refreshing={refreshing}
          className="flex-1 overflow-y-auto"
        >
          {renderFeed()}
        </PullToRefresh>
      ) : (
        <div className="flex-1 overflow-y-auto">{renderFeed()}</div>
      )}
    </section>
  );
}
