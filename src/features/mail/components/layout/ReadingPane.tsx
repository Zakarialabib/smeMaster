import { useEffect, useCallback, useRef, useState } from "react";
import { ThreadView } from "@features/mail/components/ThreadView";
import { useThreadStore } from "@features/mail/stores/threadStore";
import { useSelectedThreadId } from "@shared/hooks/useRouteNavigation";
import { useLayoutStore } from "@shared/stores/layoutStore";
import type { ReadingPanePosition } from "@shared/stores/layoutStore";
import {
  Maximize2, Minimize2, ChevronDown, Mail,
  PanelRightClose, PanelBottom,
  EyeOff, Eye,
} from "lucide-react";
import { FocusReader } from "@shared/components/ui/FocusReader";
import { useClickOutside } from "@shared/hooks/useClickOutside";

const POSITION_CYCLE: ReadingPanePosition[] = ["right", "bottom", "hidden"];

const POSITION_LABELS: Record<ReadingPanePosition | "expanded", string> = {
  right: "Right",
  bottom: "Bottom",
  hidden: "Hidden",
  expanded: "Expanded",
};

// Position icons for compact display
const POSITION_ICONS: Record<ReadingPanePosition, typeof PanelRightClose> = {
  right: PanelRightClose,
  bottom: PanelBottom,
  hidden: EyeOff,
};

/** Determine whether the reading pane has enough room for extra chrome. */
function usePaneWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

export function ReadingPane() {
  const selectedThreadId = useSelectedThreadId();
  const selectedThread = useThreadStore((s) => selectedThreadId ? s.threadMap.get(selectedThreadId) ?? null : null);
  const readingPanePosition = useLayoutStore((s) => s.readingPanePosition);
  const readingPaneExpanded = useLayoutStore((s) => s.readingPaneExpanded);
  const setReadingPanePosition = useLayoutStore((s) => s.setReadingPanePosition);
  const setReadingPaneExpanded = useLayoutStore((s) => s.setReadingPaneExpanded);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useClickOutside(dropdownRef, () => setDropdownOpen(false));

  const cyclePosition = useCallback(() => {
    const currentIdx = POSITION_CYCLE.indexOf(readingPanePosition);
    const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % POSITION_CYCLE.length;
    setReadingPanePosition(POSITION_CYCLE[nextIdx]!);
  }, [readingPanePosition, setReadingPanePosition]);

  const toggleExpanded = useCallback(() => {
    setReadingPaneExpanded(!readingPaneExpanded);
  }, [readingPaneExpanded, setReadingPaneExpanded]);

  const handlePositionSelect = useCallback((pos: ReadingPanePosition | "expanded") => {
    if (pos === "expanded") {
      setReadingPaneExpanded(true);
    } else {
      setReadingPaneExpanded(false);
      setReadingPanePosition(pos);
    }
    setDropdownOpen(false);
  }, [setReadingPanePosition, setReadingPaneExpanded]);

  // Keyboard shortcut 'm' to cycle reading pane position
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "m" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        cyclePosition();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cyclePosition]);

  const currentLabel = readingPaneExpanded
    ? POSITION_LABELS.expanded
    : POSITION_LABELS[readingPanePosition];

  // ── Width-adaptive header chrome ──
  const { ref: paneRef, width: paneWidth } = usePaneWidth();
  // Breakpoints: narrow <320px · medium 320-480px · full >480px
  const isNarrow = paneWidth < 320;
  const isMedium = paneWidth >= 320 && paneWidth < 480;

  const PositionIcon = readingPaneExpanded
    ? readingPanePosition === "right" ? Minimize2 : Minimize2
    : POSITION_ICONS[readingPanePosition];

  const handleCycleIconClick = useCallback(() => {
    cyclePosition();
  }, [cyclePosition]);

  // ── No thread selected: clean minimal empty state ──
  if (!selectedThreadId) {
    return (
      <div ref={paneRef} className="flex-1 flex items-center justify-center bg-bg-primary/30 glass-workspace">
        <div className="flex flex-col items-center gap-3 px-8 max-w-xs text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/8 flex items-center justify-center">
            <Mail size={28} className="text-accent/40" />
          </div>
          <p className="text-sm font-medium text-text-secondary">
            Select an email to read
          </p>
          <p className="text-xs text-text-tertiary leading-relaxed">
            Choose a conversation from your inbox or use <kbd className="px-1 py-0.5 rounded bg-bg-tertiary text-[0.625rem] font-mono text-text-secondary border border-border-primary">↑↓</kbd> to navigate
          </p>
        </div>
      </div>
    );
  }

  // ── Thread selected: full reading pane with controls ──
  return (
    <div ref={paneRef} className="flex-1 flex flex-col bg-bg-primary/30 overflow-hidden liquid-glass animate-in fade-in duration-150 rounded-none sm:rounded-l-none">
      {/* Header with position controls — adapts to available width */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-1.5 border-b border-border-secondary bg-bg-secondary/50 shrink-0 gap-1 min-h-[34px]">
        {/* Left side — keyboard hint (hidden when narrow) */}
        {!isNarrow && (
          <div className="flex items-center gap-1.5">
            <kbd className="hidden md:inline-flex items-center justify-center text-[0.625rem] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded font-mono border border-border-secondary leading-none">
              [
            </kbd>
            <span className="hidden md:inline text-[0.625rem] text-text-tertiary">cycle</span>
            <kbd className="hidden md:inline-flex items-center justify-center text-[0.625rem] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded font-mono border border-border-secondary leading-none">
              ]
            </kbd>
          </div>
        )}
        {/* Spacer when left side hidden */}
        {isNarrow && <div />}

        {/* Right side — position controls */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {isNarrow ? (
            /* Narrow: single icon button that cycles positions */
            <button
              onClick={handleCycleIconClick}
              className="flex items-center justify-center w-7 h-7 text-text-tertiary hover:text-text-primary rounded transition-colors"
              title={`Position: ${currentLabel}`}
            >
              <PositionIcon size={14} />
            </button>
          ) : (
            /* Medium/Full: dropdown + expand toggle */
            <>
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdownOpen((p) => !p)}
                  className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 text-xs text-text-tertiary hover:text-text-primary rounded transition-colors ${
                    isMedium ? "border border-border-secondary bg-bg-tertiary/40" : ""
                  }`}
                  title="Reading pane position"
                >
                  {!isMedium && <PositionIcon size={12} className="shrink-0" />}
                  <span className={isMedium ? "sr-only" : ""}>{currentLabel}</span>
                  {!isMedium && <ChevronDown size={10} />}
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 glass-dropdown rounded-md py-1 min-w-[140px] animate-in fade-in duration-100">
                    {(["right", "bottom", "hidden", "expanded"] as const).map((pos) => {
                      const isActive = pos === "expanded"
                        ? readingPaneExpanded
                        : pos === readingPanePosition && !readingPaneExpanded;
                      return (
                        <button
                          key={pos}
                          onClick={() => handlePositionSelect(pos)}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-all duration-150 flex items-center justify-between ${
                            isActive
                              ? "text-accent glass-accent-tint"
                              : "text-text-primary hover:glass-accent-tint hover:text-accent"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 flex items-center justify-center">
                              {pos === "right" && (readingPaneExpanded ? <Minimize2 size={12} /> : <PanelRightClose size={12} />)}
                              {pos === "bottom" && <PanelBottom size={12} />}
                              {pos === "hidden" && <EyeOff size={12} />}
                              {pos === "expanded" && <Maximize2 size={12} />}
                            </span>
                            {POSITION_LABELS[pos]}
                          </span>
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={toggleExpanded}
                className="flex items-center justify-center w-7 h-7 text-text-tertiary hover:text-text-primary rounded transition-colors"
                title={readingPaneExpanded ? "Collapse reading pane" : "Expand reading pane"}
              >
                {readingPaneExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>

              <button
                onClick={() => setFocusMode((p) => !p)}
                className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${
                  focusMode
                    ? "text-accent bg-accent/10"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
                title={focusMode ? "Exit focus mode" : "Focus mode"}
              >
                <Eye size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden animate-in fade-in duration-200">
        {selectedThread ? (
          <FocusReader
            onBack={() => setFocusMode(false)}
            actions={focusMode ? [{ label: "Exit focus", icon: <Eye size={14} />, onAction: () => setFocusMode(false) }] : []}
            autoHideToolbar={focusMode}
          >
            <ThreadView thread={selectedThread} />
          </FocusReader>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-text-tertiary">Loading…</span>
          </div>
        )}
      </div>
    </div>
  );
}
