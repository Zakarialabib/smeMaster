import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, ChevronLeft, ChevronRight, History, Grid3X3 } from "lucide-react";
import type { SettingsTabId } from "./SettingsTabRegistry";
import { tabGroups, getTabLabel } from "./SettingsTabRegistry";
import { useRecentSettingsStore } from "@features/settings/stores/recentSettingsStore";
import { cn } from "@shared/utils/cn";

/**
 * SettingsSidebar — Persistent navigation sidebar for settings.
 *
 * Shows all tab groups with expandable sections, recent tabs at top,
 * and a filterable search.
 *
 * Features:
 * - Collapsible to icons-only (48px) via toggle button
 * - Overview/Home link at the top to see the settings card grid
 * - Recent settings section shows last 3 visited tabs
 * - Real-time search filtering of tabs
 * - Keyboard navigation support
 */
export function SettingsSidebar({
  activeTab,
  onSelectTab,
  onGoHome,
  collapsed = false,
  onToggleCollapse,
}: {
  activeTab: SettingsTabId | null;
  onSelectTab: (id: SettingsTabId) => void;
  onGoHome?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { t } = useTranslation();
  const recentSettings = useRecentSettingsStore((s) => s.recent);
  const [searchQuery, setSearchQuery] = useState("");

  const labelFor = useCallback((id: string) => getTabLabel(id, t), [t]);

  // Filter groups & tabs by search
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tabGroups
      .map((group) => ({
        ...group,
        tabs: group.tabs.filter((tab) => {
          if (!q) return true;
          const label = labelFor(tab.id).toLowerCase();
          return label.includes(q);
        }),
      }))
      .filter((group) => group.tabs.length > 0);
  }, [searchQuery, labelFor]);

  if (collapsed) {
    return (
      <nav className="w-[48px] shrink-0 flex flex-col items-center gap-1 py-3 border-r border-border-primary bg-bg-secondary/20 backdrop-blur-[--glass-blur]">
        {/* Home/Overview */}
        {onGoHome && (
          <button
            onClick={onGoHome}
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
              !activeTab
                ? "bg-accent/15 text-accent"
                : "text-text-tertiary hover:text-text-primary hover:bg-bg-hover",
            )}
            title="Settings Overview"
            aria-label="Settings Overview"
          >
            <Grid3X3 size={16} />
          </button>
        )}
        {tabGroups.flatMap((g) => g.tabs).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-text-tertiary hover:text-text-primary hover:bg-bg-hover",
              )}
              title={labelFor(tab.id)}
              aria-label={labelFor(tab.id)}
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

  return (
    <nav className="w-[200px] shrink-0 flex flex-col border-r border-border-primary bg-bg-secondary/20 backdrop-blur-[--glass-blur] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border-primary">
        <span className="text-xs font-semibold text-text-primary uppercase tracking-[0.05em]">
          Settings
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
          placeholder="Filter…"
          className="w-full ps-6 pe-2 py-1.5 text-[11px] rounded-md border border-border-primary bg-bg-tertiary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
        />
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* Home / Overview */}
        {onGoHome && (
          <div>
            <div className="space-y-0.5">
              <button
                onClick={onGoHome}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-start transition-all text-xs",
                  !activeTab
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                )}
              >
                <Grid3X3 size={14} className={cn("shrink-0", !activeTab ? "text-accent" : "text-text-tertiary")} />
                <span className="truncate">Overview</span>
              </button>
            </div>
          </div>
        )}

        {/* Recent section */}
        {recentSettings.length > 0 && !searchQuery && (
          <div>
            <div className="flex items-center gap-1.5 px-2 mb-1.5">
              <History size={10} className="text-text-tertiary" />
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-[0.05em]">
                Recent
              </span>
            </div>
            <div className="space-y-0.5">
              {recentSettings.slice(0, 3).map((recent) => {
                const tab = tabGroups.flatMap((g) => g.tabs).find((t) => t.id === recent.id);
                const TabIcon = tab?.icon;
                return (
                  <button
                    key={recent.id}
                    onClick={() => {
                      onSelectTab(recent.id as SettingsTabId);
                      setSearchQuery("");
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-start transition-all text-xs",
                      activeTab === recent.id
                        ? "bg-accent/15 text-accent font-medium"
                        : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                    )}
                  >
                    {TabIcon && <TabIcon size={13} className="shrink-0" />}
                    <span className="truncate">{recent.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab groups */}
        {filteredGroups.map((group) => (
          <div key={group.label}>
            <div className="px-2 mb-1.5">
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-[0.05em]">
                {group.label}
              </span>
            </div>
            <div className="space-y-0.5">
              {group.tabs.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onSelectTab(tab.id);
                      setSearchQuery("");
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-start transition-all",
                      "text-xs",
                      isActive
                        ? "bg-accent/15 text-accent font-semibold"
                        : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                    )}
                  >
                    <TabIcon size={14} className={cn(
                      "shrink-0",
                      isActive ? "text-accent" : "text-text-tertiary",
                    )} />
                    <span className="truncate">{labelFor(tab.id)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {filteredGroups.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-text-tertiary">
              No matches
            </p>
          </div>
        )}
      </div>
    </nav>
  );
}
