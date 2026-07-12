import { useCallback, useEffect, useMemo, useState, Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "@tanstack/react-router";
import {
  navigateToLabel,
  navigateToSettings,
  navigateToHelp,
} from "@/router/navigate";
import { usePlatform } from "@shared/hooks/usePlatform";
import { useSettingsUiStore } from "@shared/stores/settingsUiStore";
import { useRecentSettingsStore } from "@features/settings/stores/recentSettingsStore";
import { ArrowLeft, BookOpen, Search, Settings, AlertCircle, RefreshCw } from "lucide-react";
import { SkeletonPage } from "@shared/components/ui/Skeleton";
import type { SettingsTabId } from "./SettingsTabRegistry";
import {
  tabGroups,
  sectionComponents,
  TAB_KEYWORDS,
  getTabLabel,
  getSectionSubtitle,
} from "./SettingsTabRegistry";
import { HelpCenterSidebar } from "./HelpCenterSidebar";
import { SettingsPanel } from "@shared/components/settings/SettingsPanel";
import { SettingsSidebar } from "./SettingsSidebar";
import { cn } from "@shared/utils/cn";

// ── Error Boundary for section content ─────────────────────────────────────
class SectionErrorBoundary extends Component<
  { children: ReactNode; sectionName: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; sectionName: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle size={32} className="text-danger mb-3" />
          <p className="text-sm font-semibold text-text-primary mb-1">
            Failed to load {this.props.sectionName}
          </p>
          <p className="text-xs text-text-tertiary mb-4 max-w-md">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Search Results Grid ───────────────────────────────────────────────────

function SearchResultsGrid({
  tabs,
  onSelectTab,
  labelFor,
}: {
  tabs: { id: string; label: string; icon: React.ElementType; subtitle?: string }[];
  onSelectTab: (id: SettingsTabId) => void;
  labelFor: (id: string) => string;
}) {
  return (
    <div className="space-y-4 p-5">
      <h2 className="text-sm font-bold text-text-primary">Search Results</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id as SettingsTabId)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-secondary border border-border-primary hover:border-accent/30 hover:bg-bg-hover/50 transition-all text-left active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Icon size={15} className="text-accent" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium text-text-primary block truncate">
                  {labelFor(tab.id)}
                </span>
                {tab.subtitle && (
                  <span className="text-[10px] text-text-tertiary block truncate">
                    {tab.subtitle}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {tabs.length === 0 && (
        <div className="text-center py-12">
          <Search size={24} className="mx-auto text-text-tertiary mb-2" />
          <p className="text-sm text-text-tertiary">No matching settings found</p>
        </div>
      )}
    </div>
  );
}

// ── Main SettingsPage ─────────────────────────────────────────────────────

export function SettingsPage() {
  const { t } = useTranslation();
  const { screen } = usePlatform();
  const isMobile = screen.isMobile;
  const [searchQuery, setSearchQuery] = useState("");
  const [helpSidebarOpen, setHelpSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Simulate initialization loading
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        useSettingsUiStore.getState().init();
        setPageLoading(false);
      } catch (err) {
        setPageError(err instanceof Error ? err.message : "Failed to initialize settings");
        setPageLoading(false);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Cmd+K: focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          ".settings-search-input",
        );
        input?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Navigate-to-help listener
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ topic: string }>).detail;
      if (detail?.topic) {
        navigateToHelp(detail.topic);
      }
    };
    window.addEventListener("smemaster-navigate-help", handler);
    return () => window.removeEventListener("smemaster-navigate-help", handler);
  }, []);

  const labelFor = useCallback((id: string) => getTabLabel(id, t), [t]);

  // Filter groups & tabs by platform
  const visibleTabGroups = useMemo(() => {
    return tabGroups
      .map((group) => ({
        ...group,
        tabs: group.tabs.filter((tab) => {
          const platform = tab.platform ?? "all";
          if (platform === "all") return true;
          if (platform === "desktop" && isMobile) return false;
          if (platform === "mobile" && !isMobile) return false;
          return true;
        }),
      }))
      .filter((group) => group.tabs.length > 0);
  }, [isMobile]);

  const visibleTabs = useMemo(
    () => visibleTabGroups.flatMap((g) => g.tabs),
    [visibleTabGroups],
  );

  // Search filtering
  const filteredTabs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return visibleTabs.filter((tab) => {
      const label = labelFor(tab.id).toLowerCase();
      const keywords = TAB_KEYWORDS[tab.id] ?? [];
      return (
        label.includes(q) || keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, labelFor, visibleTabs]);

  // Active tab from URL
  const { tab } = useParams({ strict: false }) as { tab?: string };
  const hasActiveTab = tab && visibleTabs.some((t) => t.id === tab);
  const activeTab = (hasActiveTab ? tab : null) as SettingsTabId | null;
  const activeTabDef = activeTab ? visibleTabs.find((t) => t.id === activeTab) : null;
  const ActiveSection = activeTab ? sectionComponents[activeTab] : null;

  const setActiveTab = (t: SettingsTabId) => {
    setSearchQuery("");
    // Record in recent settings
    useRecentSettingsStore.getState().visit(t, labelFor(t));
    if (t === "help-center") {
      navigateToHelp();
      return;
    }
    navigateToSettings(t);
  };

  const goToHome = () => {
    setSearchQuery("");
    navigateToSettings();
  };

  const showSearchResults = searchQuery.trim().length > 0;

  // Loading state
  if (pageLoading) {
    return <SkeletonPage />;
  }

  // Error state
  if (pageError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <AlertCircle size={36} className="text-danger" />
        <div>
          <p className="text-sm font-semibold text-text-primary">Failed to load settings</p>
          <p className="text-xs text-text-tertiary mt-1">{pageError}</p>
        </div>
        <button
          onClick={() => {
            setPageLoading(true);
            setPageError(null);
            setTimeout(() => {
              try {
                useSettingsUiStore.getState().init();
                setPageLoading(false);
              } catch (err) {
                setPageError(err instanceof Error ? err.message : "Failed to initialize settings");
                setPageLoading(false);
              }
            }, 100);
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
        >
          <RefreshCw size={13} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden text-text-primary flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-primary shrink-0">
        {!sidebarCollapsed && (
          <>
            <button
              onClick={() => navigateToLabel("inbox")}
              className="p-1.5 -ml-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
              title={t("settings.backToInbox")}
              aria-label={t("settings.backToInbox")}
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-base font-semibold text-text-primary shrink-0">
              {activeTab ? labelFor(activeTab) : t("search.settings")}
            </h1>
          </>
        )}

        {sidebarCollapsed && activeTab && (
          <>
            <button
              onClick={goToHome}
              className="p-1.5 -ml-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
              title="Back to settings overview"
              aria-label="Back to settings overview"
            >
              <Settings size={18} />
            </button>
            <h1 className="text-base font-semibold text-text-primary shrink-0">
              {labelFor(activeTab)}
            </h1>
          </>
        )}

        {/* Search */}
        <div className="relative flex-1 min-w-0 ml-auto max-w-xs">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings… ⌘K"
            aria-label="Search settings"
            className="settings-search-input w-full pl-8 pr-8 py-2 text-xs rounded-md border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
              aria-label="Clear search"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Help toggle */}
        {!isMobile && (
          <button
            onClick={() => setHelpSidebarOpen((prev) => !prev)}
            className={cn(
              "p-2 rounded-md transition-colors shrink-0",
              helpSidebarOpen
                ? "bg-accent/10 text-accent"
                : "text-text-tertiary hover:text-text-primary hover:bg-bg-hover",
            )}
            title="Toggle help sidebar"
            aria-label="Toggle help sidebar"
          >
            <BookOpen size={16} />
          </button>
        )}
      </div>

      {/* ── Body: Sidebar + Content ─────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {!isMobile && (
          <SettingsSidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onGoHome={goToHome}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          />
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Search Results */}
          {showSearchResults && (
            <SearchResultsGrid
              tabs={filteredTabs ?? []}
              onSelectTab={setActiveTab}
              labelFor={labelFor}
            />
          )}

          {/* No tab selected: show welcome */}
          {!activeTab && !showSearchResults && (
            <SettingsPanel>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Settings size={40} className="text-accent/40 mb-4" />
                <h2 className="text-lg font-semibold text-text-primary mb-2">
                  {t("search.settings")}
                </h2>
                <p className="text-sm text-text-tertiary max-w-md">
                  Select a setting from the sidebar to configure your preferences.
                  Use the search bar above to find specific settings quickly.
                </p>
              </div>
            </SettingsPanel>
          )}

          {/* Active Tab Content */}
          {activeTab && ActiveSection && !showSearchResults && (
            <SettingsPanel>
              {activeTabDef && (
                <div>
                  <h2 className="text-sm font-bold text-text-primary">
                    {labelFor(activeTabDef.id)}
                  </h2>
                  {(() => {
                    const subtitle = getSectionSubtitle(activeTab);
                    return subtitle ? (
                      <p className="text-xs text-text-tertiary mt-1">{subtitle}</p>
                    ) : null;
                  })()}
                </div>
              )}
              <SectionErrorBoundary sectionName={labelFor(activeTab)}>
                <ActiveSection />
              </SectionErrorBoundary>
            </SettingsPanel>
          )}
        </div>
      </div>

      {/* Help Sidebar */}
      {!isMobile && (
        <HelpCenterSidebar
          currentTab={activeTab ?? "general"}
          isOpen={helpSidebarOpen}
          onClose={() => setHelpSidebarOpen(false)}
        />
      )}
    </div>
  );
}
