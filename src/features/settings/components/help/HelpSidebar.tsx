import { useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { HELP_CATEGORIES } from "@/constants/helpContent";
import { cn } from "@shared/utils/cn";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HelpSidebarProps {
  activeTopic: string;
  onSelectTopic: (topic: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

// ─── HelpSidebar ────────────────────────────────────────────────────────────

/**
 * HelpSidebar — Persistent navigation sidebar for the help page.
 *
 * Lists all help categories with icons, a search filter, and a collapsible
 * icon-only mode. Mirrors the pattern used by SettingsSidebar.
 */
export function HelpSidebar({
  activeTopic,
  onSelectTopic,
  collapsed = false,
  onToggleCollapse,
}: HelpSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter categories by search
  const filteredCategories = searchQuery.trim()
    ? HELP_CATEGORIES.filter((cat) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          cat.label.toLowerCase().includes(q) ||
          cat.cards.some((card) => card.title.toLowerCase().includes(q))
        );
      })
    : HELP_CATEGORIES;

  // ── Collapsed mode: icon rail ─────────────────────────────────────────
  if (collapsed) {
    return (
      <nav className="w-[48px] shrink-0 flex flex-col items-center gap-1 py-3 border-r border-border-primary bg-bg-secondary/50">
        {HELP_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeTopic === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectTopic(cat.id)}
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-text-tertiary hover:text-text-primary hover:bg-bg-hover",
              )}
              title={cat.label}
              aria-label={cat.label}
            >
              <Icon size={16} />
            </button>
          );
        })}
        {onToggleCollapse && (
          <>
            <div className="flex-1" />
            <button
              onClick={onToggleCollapse}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </nav>
    );
  }

  // ── Expanded mode ─────────────────────────────────────────────────────
  return (
    <nav className="w-[200px] shrink-0 flex flex-col border-r border-border-primary bg-bg-secondary/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border-primary">
        <span className="text-xs font-semibold text-text-primary uppercase tracking-[0.05em]">
          Help Topics
        </span>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-6 h-6 rounded-md flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative px-3 py-2">
        <Search
          size={12}
          className="absolute start-5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter topics…"
          className="w-full ps-6 pe-2 py-1.5 text-[11px] rounded-md border border-border-primary bg-bg-tertiary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
        />
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {filteredCategories.map((cat) => {
          const CatIcon = cat.icon;
          const isActive = activeTopic === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                onSelectTopic(cat.id);
                setSearchQuery("");
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-start transition-all text-xs",
                isActive
                  ? "bg-accent/15 text-accent font-semibold"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
              )}
            >
              <CatIcon
                size={14}
                className={cn(
                  "shrink-0",
                  isActive ? "text-accent" : "text-text-tertiary",
                )}
              />
              <span className="truncate">{cat.label}</span>
              <span className="ms-auto text-[10px] text-text-tertiary/60 tabular-nums">
                {cat.cards.length}
              </span>
            </button>
          );
        })}

        {/* Empty state */}
        {filteredCategories.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-text-tertiary">No matches</p>
          </div>
        )}
      </div>
    </nav>
  );
}
