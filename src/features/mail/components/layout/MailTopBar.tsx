import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SearchBar } from "@features/mail/components/search/SearchBar";
import type { ReadFilter } from "@shared/stores/layoutStore";
import { useConfigStore } from "@/stores/core/configStore";
import { RefreshCw } from "lucide-react";

export interface MailTopBarProps {
  activeLabel: string;
  labelDisplayName: string;
  conversationCount: number;
  isSmartFolder: boolean;
  readFilter: ReadFilter;
  onReadFilterChange: (filter: ReadFilter) => void;
  onRefresh?: () => void;
}

export function MailTopBar({
  activeLabel: _activeLabel,
  labelDisplayName,
  conversationCount,
  isSmartFolder: _isSmartFolder,
  readFilter,
  onReadFilterChange,
  onRefresh,
}: MailTopBarProps) {
  const { t } = useTranslation();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const focusedInbox = useConfigStore((s) => s.focusedInbox);
  const setFocusedInbox = useConfigStore((s) => s.setFocusedInbox);

  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "f") {
      e.preventDefault();
      const input = searchContainerRef.current?.querySelector<HTMLInputElement>("input[type='text']");
      input?.focus();
      input?.select();
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  return (
    <div className="glass-top-bar px-2 sm:px-3">
      <div className="flex flex-col min-h-[44px] py-1 gap-1">
        {/* Line 1: Search + Refresh (full width on mobile, side by side on desktop) */}
        <div className="flex items-center gap-2">
          <div ref={searchContainerRef} className="flex-1 min-w-0 sm:min-w-[160px] sm:max-w-sm">
            <SearchBar />
          </div>
          {/* Refresh — always visible */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="flex items-center justify-center w-7 h-7 shrink-0 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all duration-150 active:scale-95"
              title={t("common.refresh")}
              aria-label={t("common.refresh")}
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {/* Line 2: Label + count + read filter — single scrollable row */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar flex-nowrap">
          {/* Label + count — visible on mobile AND desktop */}
          <div className="flex items-center gap-1.5 shrink-0">
            <h2 className="truncate text-xs sm:text-sm font-semibold leading-tight text-text-primary max-w-[100px] sm:max-w-[140px]">
              {labelDisplayName}
            </h2>
            <span className="whitespace-nowrap text-[0.625rem] sm:text-xs text-text-tertiary tabular-nums">
              {conversationCount}
            </span>
          </div>

          {/* Vertical divider */}
          <span className="w-px h-4 bg-border-primary shrink-0" />

          {/* Focused / All segmented toggle (inbox only) */}
          {_activeLabel === "inbox" && (
            <div className="flex items-center shrink-0 rounded-md bg-bg-tertiary/60 p-0.5">
              {([true, false] as const).map((v) => (
                <button
                  key={v ? "focused" : "all"}
                  onClick={() => setFocusedInbox(v)}
                  aria-pressed={focusedInbox === v}
                  className={`px-2 py-1 text-[0.625rem] sm:text-[0.6875rem] font-medium rounded-[4px] transition-all duration-150 whitespace-nowrap ${
                    focusedInbox === v
                      ? "bg-bg-primary dark:bg-bg-secondary text-text-primary shadow-sm"
                      : "text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  {v ? t("email.focused") : t("email.allMail")}
                </button>
              ))}
            </div>
          )}

          {/* Vertical divider */}
          <span className="w-px h-4 bg-border-primary shrink-0" />

          {/* Read filter toggle — compact pill-style */}
          <div className="flex items-center shrink-0 rounded-md bg-bg-tertiary/60 p-0.5">
            {(["all", "unread", "read"] as const).map((f) => (
              <button
                key={f}
                onClick={() => onReadFilterChange(f)}
                className={`px-2 py-1 text-[0.625rem] sm:text-[0.6875rem] font-medium rounded-[4px] transition-all duration-150 whitespace-nowrap ${
                  readFilter === f
                    ? "bg-bg-primary dark:bg-bg-secondary text-text-primary shadow-sm"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {f === "all" ? t("email.all") : f === "unread" ? t("email.unread") : t("email.read")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

