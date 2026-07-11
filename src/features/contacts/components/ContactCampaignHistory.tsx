import { useTranslation } from "react-i18next";
import { Send, Eye, MousePointerClick, AlertCircle } from "lucide-react";
import { formatRelativeDate } from "@shared/utils/date";
import { EmptyState } from "@shared/components/ui/EmptyState";

// ── Types ──

export interface CampaignHistoryEntry {
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  sent_at: number | null;
  campaign_created_at: number;
  recipient_status: string;
  opened_at: number | null;
  clicked_at: number | null;
  variant: string | null;
  is_winner: number | null;
}

export interface ContactCampaignHistoryProps {
  campaigns: CampaignHistoryEntry[];
  isLoading?: boolean;
}

// ── Status helpers ──

type StatusKey = "pending" | "sent" | "opened" | "clicked" | "bounced";

interface StatusConfig {
  icon: typeof Send;
  badgeClass: string;
  circleClass: string;
}

const STATUS_CONFIG: Record<StatusKey, StatusConfig> = {
  pending: {
    icon: Send,
    badgeClass: "text-warning bg-warning/15",
    circleClass: "text-warning bg-warning/15",
  },
  sent: {
    icon: Send,
    badgeClass: "text-text-secondary bg-bg-tertiary",
    circleClass: "text-text-secondary bg-bg-tertiary",
  },
  opened: {
    icon: Eye,
    badgeClass: "text-success bg-success/15",
    circleClass: "text-success bg-success/15",
  },
  clicked: {
    icon: MousePointerClick,
    badgeClass: "text-accent bg-accent/15",
    circleClass: "text-accent bg-accent/15",
  },
  bounced: {
    icon: AlertCircle,
    badgeClass: "text-danger bg-danger/15",
    circleClass: "text-danger bg-danger/15",
  },
};

function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status as StatusKey] ?? STATUS_CONFIG.pending;
}

function getStatusTranslationKey(status: string): string {
  const map: Record<string, string> = {
    pending: "contact.campaign.pending",
    sent: "contact.campaign.sent",
    opened: "contact.campaign.opened",
    clicked: "contact.campaign.clicked",
    bounced: "contact.campaign.bounced",
  };
  return map[status] ?? "contact.campaign.pending";
}

// ── Loading skeleton ──

function CampaignHistorySkeleton() {
  return (
    <div className="space-y-2 p-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3.5 animate-pulse rounded-lg border border-border-primary"
        >
          <div className="w-9 h-9 rounded-full bg-bg-tertiary shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-bg-tertiary rounded w-3/5" />
            <div className="h-3 bg-bg-tertiary rounded w-2/5" />
          </div>
          <div className="h-6 bg-bg-tertiary rounded-full w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── Main component ──

export function ContactCampaignHistory({
  campaigns,
  isLoading = false,
}: ContactCampaignHistoryProps) {
  const { t } = useTranslation();

  // ── Loading state ──
  if (isLoading) {
    return <CampaignHistorySkeleton />;
  }

  // ── Empty state ──
  if (campaigns.length === 0) {
    return <EmptyState icon={Send} title={t("contact.campaign.noHistory", "No campaign history")} />;
  }

  // ── Campaign list ──
  return (
    <div className="divide-y divide-border-primary">
      {campaigns.map((campaign) => {
        const config = getStatusConfig(campaign.recipient_status);
        const StatusIcon = config.icon;

        const primaryDate = campaign.sent_at ?? campaign.campaign_created_at;
        const hasSentDate = campaign.sent_at !== null;
        const dateLabel = primaryDate ? formatRelativeDate(primaryDate) : null;

        return (
          <div
            key={campaign.campaign_id}
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-hover transition-colors"
          >
            {/* Status icon circle */}
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${config.circleClass}`}
            >
              <StatusIcon size={15} />
            </div>

            {/* Campaign info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary truncate">
                  {campaign.campaign_name}
                </span>
                {campaign.is_winner ? (
                  <span className="text-[0.6rem] font-medium text-success bg-success/15 px-1.5 py-0.5 rounded shrink-0">
                    {t("contact.campaign.winner", "Winner")}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {/* Sent / Created date */}
                {dateLabel && (
                  <span className="text-[0.65rem] text-text-tertiary">
                    {hasSentDate
                      ? t("contact.campaign.sentPrefix", "Sent {date}").replace("{date}", dateLabel)
                      : t("contact.campaign.createdPrefix", "Created {date}").replace("{date}", dateLabel)}
                  </span>
                )}

                {/* A/B test variant */}
                {campaign.variant && (
                  <span className="text-[0.6rem] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded">
                    {campaign.variant}
                  </span>
                )}
              </div>

              {/* Open / Click timestamps */}
              {(campaign.opened_at || campaign.clicked_at) && (
                <div className="flex items-center gap-3 mt-1">
                  {campaign.opened_at && (
                    <span className="flex items-center gap-1 text-[0.6rem] text-success">
                      <Eye size={9} />
                      {t("contact.campaign.openedLabel", "Opened {date}").replace(
                        "{date}",
                        formatRelativeDate(campaign.opened_at),
                      )}
                    </span>
                  )}
                  {campaign.clicked_at && (
                    <span className="flex items-center gap-1 text-[0.6rem] text-accent">
                      <MousePointerClick size={9} />
                      {t("contact.campaign.clickedLabel", "Clicked {date}").replace(
                        "{date}",
                        formatRelativeDate(campaign.clicked_at),
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Status badge */}
            <div
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-medium ${config.badgeClass}`}
            >
              <StatusIcon size={10} />
              {t(getStatusTranslationKey(campaign.recipient_status))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
