import { useCallback, useEffect, useRef, useState } from "react";
import { EmailList } from "./EmailList";
import { ReadingPane } from "./ReadingPane";
import { ThreadViewMobile } from "@features/mail/components/ThreadViewMobile";
import { useLayoutStore } from "@shared/stores/layoutStore";
import { useScreenInfo } from "@shared/hooks/usePlatform";
import { useSelectedThreadId } from "@shared/hooks/useRouteNavigation";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";
import { usePlatform } from "@shared/hooks/usePlatform";

const MIN_LIST_WIDTH = 240;
const MAX_LIST_WIDTH = 800;

function ResizableEmailLayout() {
  const emailListWidth = useLayoutStore((s) => s.emailListWidth);
  const setEmailListWidth = useLayoutStore((s) => s.setEmailListWidth);
  const readingPaneExpanded = useLayoutStore((s) => s.readingPaneExpanded);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverlay, setDragOverlay] = useState<{ atMin: boolean; atMax: boolean } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = listRef.current?.offsetWidth ?? emailListWidth;
    setIsDragging(true);

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.min(MAX_LIST_WIDTH, Math.max(MIN_LIST_WIDTH, startWidth + delta));
      if (listRef.current) listRef.current.style.width = `${newWidth}px`;
      setDragOverlay({
        atMin: newWidth <= MIN_LIST_WIDTH,
        atMax: newWidth >= MAX_LIST_WIDTH,
      });
    };

    const handleMouseUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setIsDragging(false);
      setDragOverlay(null);
      const delta = ev.clientX - startX;
      const finalWidth = Math.min(MAX_LIST_WIDTH, Math.max(MIN_LIST_WIDTH, startWidth + delta));
      setEmailListWidth(finalWidth);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [emailListWidth, setEmailListWidth]);

  return (
    <div ref={containerRef} className="flex flex-1 min-w-0 flex-row">
      {!readingPaneExpanded && (
        <>
          <EmailList width={emailListWidth} listRef={listRef} />
          {/* Premium drag handle */}
          <div
            onMouseDown={handleMouseDown}
            className="relative w-[5px] cursor-col-resize bg-transparent hover:bg-accent/20 active:bg-accent/30 transition-colors shrink-0 group z-10"
          >
            {/* Center grip line */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border-secondary group-hover:bg-accent/40 transition-colors" />
            {/* Active drag indicator - subtle glow */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px opacity-0 group-hover:opacity-100 group-active:opacity-100 bg-accent/30 blur-sm transition-opacity" />
            {/* Drag bounds overlay */}
            {isDragging && dragOverlay && (
              <div className="absolute inset-0 pointer-events-none">
                {dragOverlay.atMin && (
                  <div className="absolute right-full top-0 bottom-0 w-0.5 bg-warning/50 animate-pulse" />
                )}
                {dragOverlay.atMax && (
                  <div className="absolute left-full top-0 bottom-0 w-0.5 bg-warning/50 animate-pulse" />
                )}
              </div>
            )}
          </div>
        </>
      )}
      {/* Reading pane with smooth expand/collapse via CSS grid column */}
      <div
        className={`flex flex-1 min-w-0 transition-all duration-200 ease-out ${
          readingPaneExpanded ? "ml-0" : ""
        }`}
      >
        <ReadingPane />
      </div>
    </div>
  );
}

/**
 * MailLayout — adaptive 3-pane mail view.
 *
 * - **Screens < 1024 px** (phone / tablet): single-pane navigation.
 *   Shows either the thread list or (if a thread is selected) the thread detail.
 * - **Screens ≥ 1024 px** (tablet-landscape / desktop): multi-pane layout.
 *   Renders sidebar (from the shell), message list (EmailList), and detail
 *   (ReadingPane) in a responsive grid.
 */
export function MailLayout() {
  const screen = useScreenInfo();
  const platform = usePlatform();
  const selectedThreadId = useSelectedThreadId();
  const readingPanePosition = useLayoutStore((s) => s.readingPanePosition);
  const setReadingPanePosition = useLayoutStore((s) => s.setReadingPanePosition);
  const setReadingPaneExpanded = useLayoutStore((s) => s.setReadingPaneExpanded);

  // When reading pane is hidden and user clicks an email, auto-show it
  useEffect(() => {
    if (readingPanePosition === "hidden" && selectedThreadId) {
      setReadingPanePosition("right");
      setReadingPaneExpanded(true);
    }
  }, [readingPanePosition, selectedThreadId, setReadingPanePosition, setReadingPaneExpanded]);

  // Mobile (phone / phone-folded) → single-pane full-width layout
  if (screen.isMobile) {
    if (selectedThreadId) {
      return <ThreadViewMobile />;
    }
    return (
      <div className="flex flex-1 min-w-0 w-full">
        <ErrorBoundary name="EmailList">
          <EmailList />
        </ErrorBoundary>
      </div>
    );
  }

  // Screens ≥ 1024 px → multi-pane with reading pane
  if (readingPanePosition === "right") {
    return (
      <ErrorBoundary name="EmailLayout">
        <ResizableEmailLayout />
      </ErrorBoundary>
    );
  }

  // Bottom or hidden reading pane
  const paneVisible = readingPanePosition !== "hidden" && !!selectedThreadId;

  return (
    <div
      data-platform={platform.mobile ? "mobile" : "desktop"}
      className={`flex flex-1 min-w-0 ${
        readingPanePosition === "bottom" ? "flex-col" : "flex-row"
      }`}
    >
      <ErrorBoundary name="EmailList">
        <EmailList />
      </ErrorBoundary>
      {paneVisible && (
        <div className={readingPanePosition === "bottom" ? "min-h-[300px] max-h-[45vh] border-t border-border-secondary overflow-hidden" : ""}>
          <ErrorBoundary name="ReadingPane">
            <ReadingPane />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
