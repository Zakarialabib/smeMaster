import { useState, useCallback, useRef } from "react";
import { Send, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCampaignStore, type Campaign } from "@features/campaigns/stores/campaignStore";
import { CAMPAIGN_STATUS_COLORS } from "@/constants/campaignDefaults";
import { CampaignAnalytics } from "@features/campaigns/components/CampaignAnalytics";
import { CampaignComposer } from "@features/campaigns/components/CampaignComposer";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { PullToRefresh } from "@shared/components/ui/PullToRefresh";
import { useTranslation } from "react-i18next";
import { usePlatform } from "@shared/hooks/usePlatform";
import { safeDbOperation } from "@features/campaigns/services/errorHandler";
import { notify } from "@shared/services/notifications/toastHelper";
import { deleteCampaign as dbDeleteCampaign } from "@features/campaigns/db/campaigns";

interface CampaignListProps {
  accountId: string;
}

// Collapsed row height in pixels (mobile cards) — expanded cards use measureElement.
const MOBILE_CARD_ESTIMATE = 96;
const DESKTOP_ROW_ESTIMATE = 48;

export function CampaignList({ accountId }: CampaignListProps) {
  const { t } = useTranslation();
  const isMobileDevice  = usePlatform();
  const campaigns = useCampaignStore((s) => s.campaigns);
  const isLoading = useCampaignStore((s) => s.isLoading);
  const loadStats = useCampaignStore((s) => s.loadStats);
  const loadCampaigns = useCampaignStore((s) => s.loadCampaigns);
  const stats = useCampaignStore((s) => s.stats);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);

  function handleToggle(campaign: Campaign) {
    if (expandedId === campaign.id) {
      setExpandedId(null);
    } else {
      setExpandedId(campaign.id);
      if (!stats[campaign.id]) {
        loadStats(campaign.id);
      }
    }
  }

  function handleCardTap(campaign: Campaign) {
    handleToggle(campaign);
  }

  const handleRefresh = useCallback(() => {
    return loadCampaigns(accountId);
  }, [loadCampaigns, accountId]);

  const handleDelete = useCallback(async (campaignId: string, campaignName: string) => {
    const result = await safeDbOperation(
      async () => { await dbDeleteCampaign(campaignId); },
      { operationLabel: "delete campaign" },
    );
    if (result.success) {
      notify("Campaign deleted", `"${campaignName}" has been removed.`);
      loadCampaigns(accountId);
    } else {
      notify("Failed to delete campaign", result.error);
    }
  }, [accountId, loadCampaigns]);

  const header = (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
      <h2 className="text-lg font-semibold text-text-primary">{t('campaign.campaigns')}</h2>
      <button
        onClick={() => setShowComposer(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg transition-colors"
      >
        <Plus size={14} />
        {t('campaign.newCampaign')}
      </button>
    </div>
  );

  if (!isLoading && campaigns.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className="flex-1">
          <EmptyState
            icon={Send}
            title={t('campaign.noCampaigns')}
            subtitle={t('campaign.createCampaign')}
            action={
              <button
                onClick={() => setShowComposer(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
              >
                <Plus size={14} />
                New Campaign
              </button>
            }
          />
        </div>
        <CampaignComposer isOpen={showComposer} onClose={() => setShowComposer(false)} accountId={accountId} />
      </div>
    );
  }

  // ── Mobile virtualized list (cards) ───────────────────────────────────────
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileVirtualizer = useVirtualizer({
    count: campaigns.length,
    getScrollElement: () => mobileScrollRef.current,
    estimateSize: () => MOBILE_CARD_ESTIMATE,
    overscan: 4,
    getItemKey: (idx) => campaigns[idx]?.id ?? idx,
  });

  // ── Desktop virtualized list (expandable rows) ────────────────────────────
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopVirtualizer = useVirtualizer({
    count: campaigns.length,
    getScrollElement: () => desktopScrollRef.current,
    estimateSize: () => DESKTOP_ROW_ESTIMATE,
    overscan: 4,
    getItemKey: (idx) => campaigns[idx]?.id ?? idx,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  return (
    <div className="flex flex-col h-full">
      {header}

      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-sm text-text-tertiary">{t('common.loading')}</div>
      ) : isMobileDevice ? (
        /* ── Mobile: virtualized card list with pull-to-refresh ── */
        <PullToRefresh onRefresh={handleRefresh} className="flex-1">
          <div ref={mobileScrollRef} className="h-full overflow-y-auto">
            <div
              style={{
                height: `${mobileVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {mobileVirtualizer.getVirtualItems().map((vRow) => {
                const c = campaigns[vRow.index];
                if (!c) return null;
                const colorClass = CAMPAIGN_STATUS_COLORS[c.status] ?? "text-text-tertiary";
                const campaignStats = stats[c.id];
                const openRate =
                  campaignStats && campaignStats.sent > 0
                    ? ((campaignStats.opened / campaignStats.sent) * 100).toFixed(1)
                    : null;

                return (
                  <div
                    key={vRow.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vRow.start}px)`,
                      padding: "0 1rem 0.75rem 1rem",
                    }}
                  >
                    <button
                      onClick={() => handleCardTap(c)}
                      className="w-full liquid-glass rounded-xl p-4 text-left active:scale-[0.98] active:bg-bg-hover transition-all duration-150"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-medium text-text-primary truncate">{c.name}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-bg-secondary shrink-0 ${colorClass}`}>
                          {c.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-tertiary">
                        <span>{t('campaign.nSent', { n: c.sent_count })}</span>
                        {openRate !== null && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-text-tertiary/30 shrink-0" />
                            <span>{openRate}% {t('campaign.opened')}</span>
                          </>
                        )}
                        <span className="ml-auto">{new Date(c.created_at * 1000).toLocaleDateString()}</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </PullToRefresh>
      ) : (
        /* ── Desktop: virtualized expandable rows ── */
        <div ref={desktopScrollRef} className="flex-1 overflow-y-auto p-4">
          <div
            style={{
              height: `${desktopVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {desktopVirtualizer.getVirtualItems().map((vRow) => {
              const c = campaigns[vRow.index];
              if (!c) return null;
              const isExpanded = expandedId === c.id;
              const colorClass = CAMPAIGN_STATUS_COLORS[c.status] ?? "text-text-tertiary";
              return (
                <div
                  key={vRow.key}
                  data-index={vRow.index}
                  ref={desktopVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vRow.start}px)`,
                    paddingBottom: "0.5rem",
                  }}
                >
                  <div className="liquid-glass rounded-lg overflow-hidden">
                    <button
                      onClick={() => handleToggle(c)}
                      className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-bg-hover transition-colors"
                    >
                      {isExpanded ? <ChevronDown size={14} className="text-text-tertiary shrink-0" /> : <ChevronRight size={14} className="text-text-tertiary shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-text-primary truncate block">{c.name}</span>
                      </div>
                      <span className={`text-xs font-medium ${colorClass} shrink-0`}>{c.status}</span>
                      {!isMobileDevice && <span className="text-xs text-text-tertiary shrink-0">{t('campaign.nSent', { n: c.sent_count })}</span>}
                      {!isMobileDevice && <span className="text-xs text-text-tertiary shrink-0">{new Date(c.created_at * 1000).toLocaleDateString()}</span>}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(c.id, c.name); }}
                        className="p-1 text-text-tertiary hover:text-danger transition-colors shrink-0"
                        title={t('campaign.deleteCampaign')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-border-primary">
                        <CampaignAnalytics stats={stats[c.id] ?? { total: 0, sent: 0, opened: 0, clicked: 0, bounced: 0 }} campaignId={c.id} campaignName={c.name} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CampaignComposer isOpen={showComposer} onClose={() => setShowComposer(false)} accountId={accountId} />
    </div>
  );
}
