import { memo, useCallback, useRef, useState, type ReactNode } from "react";
import { Package, ChevronRight, ChevronDown, Send, GripVertical } from "lucide-react";
import { ThreadCard } from "@features/mail/components/ThreadCard";
import { releaseHeldThreads, type DbBundleRule } from "@features/deliverability/db/bundleRules";
import type { Thread } from "@features/mail/stores/threadStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";

interface BundleRowProps {
  rule: DbBundleRule;
  summary: { count: number; latestSubject: string | null; latestSender: string | null };
  isExpanded: boolean;
  onToggle: (category: string) => void;
  bundledThreads: Thread[];
  selectedThreadId: string | null;
  onThreadClick: (thread: Thread) => void;
  onThreadContextMenu: (e: React.MouseEvent, threadId: string) => void;
  followUpThreadIds: Set<string>;
  /** Render before the thread list inside the expanded area (e.g. "Deliver now" area) */
  beforeThreads?: ReactNode;
}

/**
 * A composite bundle row with expand/collapse, "Deliver now", and mobile drag gesture.
 */
export const BundleRow = memo(function BundleRow({
  rule,
  summary,
  isExpanded,
  onToggle,
  bundledThreads,
  selectedThreadId,
  onThreadClick,
  onThreadContextMenu,
  followUpThreadIds,
  beforeThreads,
}: BundleRowProps) {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [delivering, setDelivering] = useState(false);
  const [delivered, setDelivered] = useState(false);

  // ── Drag-to-expand for mobile ──────────────────────────────────────────
  const dragThreshold = 80; // px of downward drag to expand
  const dragStartY = useRef<number | null>(null);
  const dragAccumulated = useRef(0);
  const [dragProgress, setDragProgress] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    dragStartY.current = touch.clientY;
    dragAccumulated.current = 0;
    setDragProgress(0);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (dragStartY.current === null) return;
      const touch = e.touches[0];
      if (!touch) return;
      const delta = touch.clientY - dragStartY.current;
      // Only respond to downward drag
      if (delta > 10) {
        dragAccumulated.current = delta;
        const progress = Math.min(delta / dragThreshold, 1);
        setDragProgress(progress);
      }
    },
    [dragThreshold],
  );

  const handleTouchEnd = useCallback(
    (_e: React.TouchEvent) => {
      if (dragAccumulated.current >= dragThreshold && !isExpanded) {
        onToggle(rule.category);
      }
      dragStartY.current = null;
      dragAccumulated.current = 0;
      setDragProgress(0);
    },
    [dragThreshold, isExpanded, onToggle, rule.category],
  );

  // ── Deliver now ────────────────────────────────────────────────────────
  const handleDeliverNow = useCallback(
    async (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      if (!activeAccountId || delivering) return;
      setDelivering(true);
      try {
        await releaseHeldThreads(activeAccountId, rule.category);
        setDelivered(true);
        window.dispatchEvent(new Event("smemaster-sync-done"));
        setTimeout(() => setDelivered(false), 2000);
      } catch (err) {
        console.error("Failed to release held threads:", err);
      } finally {
        setDelivering(false);
      }
    },
    [activeAccountId, delivering, rule.category],
  );

  return (
    <div
      className="border-b border-border-secondary"
      style={
        dragProgress > 0
          ? { transform: `translateY(${dragProgress * 10}px)`, transition: "none" }
          : undefined
      }
    >
      {/* Bundle header row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(rule.category)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(rule.category);
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full text-left px-4 py-3 hover:bg-bg-hover transition-colors flex items-center gap-3 group"
        aria-expanded={isExpanded}
        aria-label={`${rule.category} bundle, ${summary.count} threads`}
      >
        {/* Drag handle for mobile */}
        <span
          className="hidden max-sm:flex items-center justify-center w-5 h-8 text-text-tertiary/40 touch-none"
          aria-hidden="true"
        >
          <GripVertical size={14} />
        </span>

        {/* Category icon */}
        <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
          <Package size={16} className="text-accent" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">
              {rule.category}
            </span>
            <span className="text-xs bg-accent/15 text-accent px-1.5 rounded-full font-medium">
              {summary.count}
            </span>
            {/* Sender count */}
            {summary.latestSender && (
              <span className="text-xs text-text-tertiary hidden sm:inline">
                · {summary.latestSender}
                {summary.count > 1 && summary.latestSender ? " +" + (summary.count - 1) : ""}
              </span>
            )}
          </div>
          <span className="text-xs text-text-tertiary truncate block mt-0.5">
            {summary.latestSender && `${summary.latestSender}: `}
            {summary.latestSubject ?? ""}
          </span>
        </div>

        {/* Deliver now button */}
        <button
          onClick={handleDeliverNow}
          disabled={delivering}
          className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-all mr-1 ${
            delivered
              ? "bg-success/15 text-success"
              : "bg-accent/10 text-accent hover:bg-accent/20"
          } disabled:opacity-50 hidden sm:flex items-center gap-1`}
          title="Deliver held threads now"
          aria-label={`Deliver ${summary.count} held threads now`}
        >
          <Send size={11} />
          {delivered ? "Delivered!" : delivering ? "Delivering..." : "Deliver now"}
        </button>

        {/* Expand/collapse icon */}
        {isExpanded ? (
          <ChevronDown size={14} className="text-text-tertiary shrink-0 transition-transform" />
        ) : (
          <ChevronRight size={14} className="text-text-tertiary shrink-0 transition-transform" />
        )}
      </div>

      {/* ── Expanded thread list with max-height transition ── */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? `${bundledThreads.length * 72 + 48}px` : "0px",
          opacity: isExpanded ? 1 : 0,
        }}
      >
        {/* Inner padding wrapper */}
        <div className="pl-4">
          {/* Extra actions bar */}
          {beforeThreads}

          {bundledThreads.map((thread) => (
            <div key={thread.id} className="thread-item-enter-active">
              <ThreadCard
                thread={thread}
                isSelected={thread.id === selectedThreadId}
                onClick={onThreadClick}
                onContextMenu={onThreadContextMenu}
                category={rule.category}
                showCategoryBadge={false}
                hasFollowUp={followUpThreadIds.has(thread.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Deliver Now button (visible only when expanded) */}
      {isExpanded && bundledThreads.length > 0 && (
        <div className="px-4 py-2 border-t border-border-secondary sm:hidden">
          <button
            onClick={handleDeliverNow}
            disabled={delivering}
            className={`w-full text-xs font-medium py-2 rounded-lg transition-all ${
              delivered
                ? "bg-success/15 text-success"
                : "bg-accent/10 text-accent hover:bg-accent/20"
            } disabled:opacity-50 flex items-center justify-center gap-1.5`}
          >
            <Send size={13} />
            {delivered ? "Delivered!" : delivering ? "Delivering..." : `Deliver ${summary.count} threads now`}
          </button>
        </div>
      )}
    </div>
  );
});
