import { memo, useMemo, useRef, useState, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Thread } from "@features/mail/stores/threadStore";
import { useThreadStore } from "@features/mail/stores/threadStore";
import { useLayoutStore } from "@shared/stores/layoutStore";
import { useActiveLabel } from "@shared/hooks/useRouteNavigation";
import { formatRelativeDate } from "@shared/utils/date";
import { Paperclip, Star, Check, Pin, BellRing, VolumeX, Archive, Trash2, Mail, MailOpen, Clock, Flag, ListTodo, CalendarDays } from "lucide-react";
import type { DragData } from "@features/mail/components/dnd/DndProvider";
import { LongPressMenu, type MenuAction } from "@shared/components/ui/LongPressMenu";
import { HoverPreview } from "@shared/components/ui/HoverPreview";
import { useColumnConfigStore } from "@shared/stores/columnConfigStore";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Updates: { bg: "bg-category-updates/10 dark:bg-category-updates/15", text: "text-category-updates", dot: "bg-category-updates" },
  Promotions: { bg: "bg-category-promotions/10 dark:bg-category-promotions/15", text: "text-category-promotions", dot: "bg-category-promotions" },
  Social: { bg: "bg-category-social/10 dark:bg-category-social/15", text: "text-category-social", dot: "bg-category-social" },
  Newsletters: { bg: "bg-category-newsletters/10 dark:bg-category-newsletters/15", text: "text-category-newsletters", dot: "bg-category-newsletters" },
};

interface ThreadCardProps {
  thread: Thread;
  isSelected: boolean;
  onClick: (thread: Thread) => void;
  onContextMenu?: (e: React.MouseEvent, threadId: string) => void;
  category?: string;
  showCategoryBadge?: boolean;
  hasFollowUp?: boolean;
  /** Called when a long-press is detected on mobile. Receives tap position and thread ID. */
  onLongPress?: (position: { x: number; y: number }, threadId: string) => void;
  /** Mobile-specific quick action callbacks */
  onArchive?: (threadId: string) => void;
  onDelete?: (threadId: string) => void;
  onMarkRead?: (threadId: string) => void;
  onMarkUnread?: (threadId: string) => void;
  onStar?: (threadId: string) => void;
  /** Snooze a thread (opens the snooze picker in the parent) */
  onSnooze?: (threadId: string) => void;
  /** Toggle the thread's importance (star/flag marker) */
  onToggleImportant?: (threadId: string) => void;
  /** Create a task linked to this thread */
  onCreateTask?: (thread: Thread) => void;
  /** Create a calendar event linked to this thread */
  onCreateEvent?: (thread: Thread) => void;
}

export const ThreadCard = memo(function ThreadCard({ thread, isSelected, onClick, onContextMenu, category, showCategoryBadge, hasFollowUp, onLongPress, onArchive, onDelete, onMarkRead, onMarkUnread, onStar, onSnooze, onToggleImportant, onCreateTask, onCreateEvent }: ThreadCardProps) {
  const isMultiSelected = useThreadStore((s) => s.selectedThreadIds.has(thread.id));
  const hasMultiSelect = useThreadStore((s) => s.selectedThreadIds.size > 0);
  const toggleThreadSelection = useThreadStore((s) => s.toggleThreadSelection);
  const selectThreadRange = useThreadStore((s) => s.selectThreadRange);
  const activeLabel = useActiveLabel();
  const emailDensity = useLayoutStore((s) => s.emailDensity);
  const isSpam = thread.labelIds.includes("SPAM");

  // Read selectedThreadIds lazily for drag â€” avoids subscribing all cards to the Set reference
  const dragData: DragData = useMemo(() => ({
    threadIds: hasMultiSelect && isMultiSelected
      ? [...useThreadStore.getState().selectedThreadIds]
      : [thread.id],
    sourceLabel: activeLabel,
  }), [hasMultiSelect, isMultiSelected, thread.id, activeLabel]);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `thread-${thread.id}`,
    data: dragData,
  });

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
      selectThreadRange(thread.id);
    } else if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggleThreadSelection(thread.id);
    } else if (hasMultiSelect) {
      toggleThreadSelection(thread.id);
    } else {
      onClick(thread);
    }
  };

  const handleContextMenu = onContextMenu
    ? (e: React.MouseEvent) => onContextMenu(e, thread.id)
    : undefined;

  // �?�?�? Long-press for mobile context menu �?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    longPressTimerRef.current = setTimeout(() => {
      if (onLongPress) {
        onLongPress({ x: touch.clientX, y: touch.clientY }, thread.id);
      }
      setMenuPosition({ x: touch.clientX, y: touch.clientY });
    }, 500);
  }, [onLongPress, thread.id]);

  const handleTouchMove = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const menuActions: MenuAction[] = useMemo(() => {
    const actions: MenuAction[] = [];
    if (thread.isRead && onMarkUnread) {
      actions.push({ id: "mark-unread", label: "Mark unread", icon: Mail, onClick: () => onMarkUnread(thread.id) });
    }
    if (!thread.isRead && onMarkRead) {
      actions.push({ id: "mark-read", label: "Mark read", icon: MailOpen, onClick: () => onMarkRead(thread.id) });
    }
    if (onStar) {
      actions.push({
        id: "star",
        label: thread.isStarred ? "Unstar" : "Star",
        icon: Star,
        onClick: () => onStar(thread.id),
      });
    }
    if (onArchive) {
      actions.push({ id: "archive", label: "Archive", icon: Archive, onClick: () => onArchive(thread.id) });
    }
    if (onDelete) {
      actions.push({
        id: "delete",
        label: "Delete",
        icon: Trash2,
        dangerous: true,
        onClick: () => onDelete(thread.id),
      });
    }
    return actions;
  }, [thread.isRead, thread.isStarred, thread.id, onArchive, onDelete, onMarkRead, onMarkUnread, onStar]);

  // ── Column visibility for email list ───────────────────────────────
  const emailColumns = useColumnConfigStore((s) => s.columnVisibility.email);
  const visibleColumns = useMemo(
    () => new Set(emailColumns.filter((c) => c.visible).map((c) => c.id)),
    [emailColumns],
  );

  const showStar = visibleColumns.has("star");
  const showSender = visibleColumns.has("sender");
  const showSubject = visibleColumns.has("subject");
  const showPreview = visibleColumns.has("preview");
  const showAttachments = visibleColumns.has("attachments");
  const showDate = visibleColumns.has("date");

  const initial = (
    thread.fromName?.[0] ??
    thread.fromAddress?.[0] ??
    "?"
  ).toUpperCase();

  return (
    <>
    <HoverPreview
      content={{
        title: thread.fromName ?? thread.fromAddress ?? "",
        subtitle: thread.subject ?? "",
        body: thread.snippet ?? "",
        timestamp: formatRelativeDate(thread.lastMessageAt),
        onOpen: () => onClick(thread),
      }}
      desktopOnly={true}
    >
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="button"
      tabIndex={0}
      aria-label={`${thread.isRead ? "" : "Unread "}email from ${thread.fromName ?? thread.fromAddress ?? "Unknown"}: ${thread.subject ?? "(No subject)"}`}
      aria-selected={isSelected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as any);
        }
      }}
      className={`glass-thread-row w-full text-left border-b border-border-secondary/70 group cursor-pointer transition-all duration-200 ease-out relative ${
        emailDensity === "compact" ? "px-3 py-1.5" : emailDensity === "spacious" ? "px-4 py-4" : "px-4 py-2.5"
      } ${
        isDragging
          ? "opacity-50"
          : isMultiSelected
            ? "bg-accent/10"
            : isSelected
              ? "selected bg-bg-selected/90"
              : ""
      } ${isSpam ? "bg-danger/[0.04] dark:bg-danger/[0.06]" : ""} ${
        !thread.isRead && !isMultiSelected && !isSelected
          ? "border-l-[3px] border-l-accent pl-[calc(1rem-3px)]"
          : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar (sender column) */}
        {showSender && (
          <div
            className={`rounded-full flex items-center justify-center shrink-0 font-medium text-white ${
              emailDensity === "compact" ? "w-7 h-7 text-xs" : emailDensity === "spacious" ? "w-10 h-10 text-sm" : "w-9 h-9 text-sm"
            } ${
              isMultiSelected ? "bg-accent" : thread.isRead ? "bg-text-tertiary" : "bg-accent"
            }`}
          >
            {isMultiSelected ? <Check size={emailDensity === "compact" ? 14 : 16} /> : initial}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* First row: sender + date + desktop hover actions */}
          <div className="flex items-center justify-between gap-2">
            {showSender && (
              <span
                className={`text-sm truncate ${
                  thread.isRead
                    ? "text-text-secondary"
                    : "font-semibold text-text-primary"
                }`}
              >
                {thread.fromName ?? thread.fromAddress ?? "Unknown"}
              </span>
            )}
            <span className="flex items-center gap-1.5 shrink-0">
              {/* Desktop hover-reveal actions: shown on row hover, hidden by default */}
              <span className="row-actions flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                {/* Archive */}
                {onArchive && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onArchive(thread.id); }}
                    className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors active:scale-90"
                    title="Archive (E)"
                    aria-label="Archive thread"
                  >
                    <Archive size={13} />
                  </button>
                )}
                {/* Delete */}
                {onDelete && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(thread.id); }}
                    className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors active:scale-90"
                    title="Delete (#)"
                    aria-label="Delete thread"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                {/* Mark read/unread */}
                {thread.isRead && onMarkUnread && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMarkUnread(thread.id); }}
                    className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors active:scale-90"
                    title="Mark unread"
                    aria-label="Mark thread as unread"
                  >
                    <Mail size={13} />
                  </button>
                )}
                {!thread.isRead && onMarkRead && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMarkRead(thread.id); }}
                    className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors active:scale-90"
                    title="Mark read"
                    aria-label="Mark thread as read"
                  >
                    <MailOpen size={13} />
                  </button>
                )}
                {/* Star toggle (star column) */}
                {showStar && onStar && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onStar(thread.id); }}
                    className={`p-1 rounded transition-colors active:scale-90 ${
                      thread.isStarred
                        ? "text-warning hover:text-warning/80"
                        : "text-text-tertiary hover:text-warning hover:bg-warning/10"
                    }`}
                    title={thread.isStarred ? "Unstar (S)" : "Star (S)"}
                    aria-label={thread.isStarred ? "Unstar thread" : "Star thread"}
                  >
                    <Star size={13} className={thread.isStarred ? "fill-current" : ""} />
                  </button>
                )}
                {/* Mark important (flag) */}
                {onToggleImportant && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleImportant(thread.id); }}
                    className={`p-1 rounded transition-colors active:scale-90 ${
                      thread.isImportant
                        ? "text-danger hover:text-danger/80"
                        : "text-text-tertiary hover:text-danger hover:bg-danger/10"
                    }`}
                    title={thread.isImportant ? "Unmark important" : "Mark important"}
                    aria-label={thread.isImportant ? "Unmark thread as important" : "Mark thread as important"}
                  >
                    <Flag size={13} className={thread.isImportant ? "fill-current" : ""} />
                  </button>
                )}
                {/* Snooze */}
                {onSnooze && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onSnooze(thread.id); }}
                    className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors active:scale-90"
                    title="Snooze thread"
                    aria-label="Snooze thread"
                  >
                    <Clock size={13} />
                  </button>
                )}
                {/* Create task from email */}
                {onCreateTask && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onCreateTask(thread); }}
                    className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors active:scale-90"
                    title="Create task from email"
                    aria-label="Create task from this email"
                  >
                    <ListTodo size={13} />
                  </button>
                )}
                {/* Create calendar event from email */}
                {onCreateEvent && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onCreateEvent(thread); }}
                    className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors active:scale-90"
                    title="Create calendar event from email"
                    aria-label="Create calendar event from this email"
                  >
                    <CalendarDays size={13} />
                  </button>
                )}
              </span>
              {/* Date (date column) */}
              {showDate && (
                <span className="text-xs text-text-tertiary whitespace-nowrap">
                  {formatRelativeDate(thread.lastMessageAt)}
                </span>
              )}
            </span>
          </div>

          {/* Subject (subject column) */}
          {showSubject && (
            <div
              className={`text-sm truncate mt-0.5 ${
                thread.isRead ? "text-text-secondary" : "text-text-primary"
              }`}
            >
              {thread.subject ?? "(No subject)"}
            </div>
          )}

          {/* Snippet + indicators (preview column) */}
          {showPreview && (
            <div className={`flex items-center gap-1.5 mt-0.5 ${emailDensity === "compact" ? "hidden" : ""}`}>
              <span className="text-xs text-text-tertiary truncate flex-1">
                {thread.snippet}
              </span>
              {showCategoryBadge && category && category !== "Primary" && CATEGORY_COLORS[category] && (
                <span className={`shrink-0 inline-flex items-center gap-1.5 text-[0.675rem] font-medium px-2 py-0.5 rounded-full leading-normal border border-current/8 ${CATEGORY_COLORS[category].bg} ${CATEGORY_COLORS[category].text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_COLORS[category].dot}`} />
                  {category}
                </span>
              )}
              {hasFollowUp && (
                <span className="shrink-0 text-accent" title="Follow-up reminder set">
                  <BellRing size={12} />
                </span>
              )}
              {thread.isMuted && (
                <span className="shrink-0 text-warning" title="Muted">
                  <VolumeX size={12} />
                </span>
              )}
              {thread.isPinned && (
                <span className="shrink-0 text-accent" title="Pinned">
                  <Pin size={12} className="fill-current" />
                </span>
              )}
              {showAttachments && thread.hasAttachments && (
                <span className="shrink-0 text-text-tertiary" title="Has attachments">
                  <Paperclip size={12} />
                </span>
              )}
              {showStar && thread.isStarred && (
                <span className="shrink-0 text-warning star-animate" title="Starred">
                  <Star size={12} className="fill-current" />
                </span>
              )}
              {thread.messageCount > 1 && (
                <span className="text-xs text-text-tertiary shrink-0 bg-bg-tertiary rounded-full px-1.5">
                  {thread.messageCount}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
    </HoverPreview>

      {/* Mobile long-press context menu */}
      {menuPosition && menuActions.length > 0 && (
        <LongPressMenu
          actions={menuActions}
          position={menuPosition}
          onClose={() => setMenuPosition(null)}
        />
      )}
    </>
  );
});

