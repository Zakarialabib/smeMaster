import { getEngagementTimeSeries } from "@features/campaigns/db/campaignRecipients";
import { executeSearchQuery } from "@shared/services/db/db-invoke";
import { insertAnalyticsSnapshot } from "@shared/services/db/invoke/core";

export interface DailyStat {
  date: string;
  opens: number;
  clicks: number;
}

export interface LinkStat {
  url: string;
  clicks: number;
}

export interface CampaignAnalytics {
  totalSent: number;
  uniqueOpens: number;
  totalClicks: number;
  bouncedCount: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  dailyStats: DailyStat[];
  topLinks: LinkStat[];
}

export interface OverviewStats {
  totalCampaigns: number;
  totalSent: number;
  totalOpens: number;
  totalClicks: number;
  totalBounced: number;
  averageOpenRate: number;
  averageClickRate: number;
}

/**
 * Get live campaign analytics from campaign_recipients and utm_links tables.
 * Saves a snapshot after computation for future use.
 */
export async function getCampaignAnalytics(
  campaignId: string,
): Promise<CampaignAnalytics> {
  return computeLiveAnalytics(campaignId);
}

/**
 * Compute analytics live from campaign_recipients and utm_links tables.
 */
async function computeLiveAnalytics(
  campaignId: string,
): Promise<CampaignAnalytics> {
  const [statsRow, dailyStats, linkRows] = await Promise.all([
    (async () => {
      const rows = await executeSearchQuery(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status IN ('sent','opened','clicked') THEN 1 ELSE 0 END) as sent,
           SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
           SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
           SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced
         FROM campaign_recipients WHERE campaign_id = $1`,
        [campaignId],
      ) as unknown as {
        total: number;
        sent: number;
        opened: number;
        clicked: number;
        bounced: number;
      }[];
      return rows[0] ?? {
        total: 0, sent: 0, opened: 0, clicked: 0, bounced: 0,
      };
    })(),
    getEngagementTimeSeries(campaignId),
    executeSearchQuery(
      "SELECT url, click_count FROM utm_links WHERE campaign_id = $1 ORDER BY click_count DESC LIMIT 10",
      [campaignId],
    ) as unknown as { url: string; click_count: number }[],
  ]);

  const total = statsRow.total || 1;

  const analytics: CampaignAnalytics = {
    totalSent: statsRow.sent,
    uniqueOpens: statsRow.opened,
    totalClicks: statsRow.clicked,
    bouncedCount: statsRow.bounced,
    openRate: statsRow.opened / total,
    clickRate: statsRow.clicked / total,
    bounceRate: statsRow.bounced / total,
    dailyStats,
    topLinks: linkRows.map((r) => ({ url: r.url, clicks: r.click_count })),
  };

  // Fire-and-forget snapshot save for future dashboard caching
  try {
    await insertAnalyticsSnapshot(crypto.randomUUID(), campaignId, JSON.stringify(analytics));
  } catch {
    // Snapshot failure is non-critical
  }

  return analytics;
}

/**
 * Get aggregate campaign stats across all campaigns for an account.
 */
export async function getOverview(
  accountId: string,
): Promise<OverviewStats> {
  const rows = await executeSearchQuery(
    `SELECT
       (SELECT COUNT(*) FROM campaigns WHERE company_id = $1) as campaign_count,
       COALESCE(SUM(CASE WHEN cr.status IN ('sent','opened','clicked') THEN 1 ELSE 0 END), 0) as total_sent,
       COALESCE(SUM(CASE WHEN cr.opened_at IS NOT NULL THEN 1 ELSE 0 END), 0) as total_opens,
       COALESCE(SUM(CASE WHEN cr.clicked_at IS NOT NULL THEN 1 ELSE 0 END), 0) as total_clicks,
       COALESCE(SUM(CASE WHEN cr.status = 'bounced' THEN 1 ELSE 0 END), 0) as total_bounced
     FROM campaigns c
     LEFT JOIN campaign_recipients cr ON cr.campaign_id = c.id
     WHERE c.company_id = $1`,
    [accountId],
  ) as unknown as {
    campaign_count: number;
    total_sent: number;
    total_opens: number;
    total_clicks: number;
    total_bounced: number;
  }[];

  const r = rows[0] ?? {
    campaign_count: 0, total_sent: 0, total_opens: 0, total_clicks: 0, total_bounced: 0,
  };

  return {
    totalCampaigns: r.campaign_count,
    totalSent: r.total_sent,
    totalOpens: r.total_opens,
    totalClicks: r.total_clicks,
    totalBounced: r.total_bounced,
    averageOpenRate: r.total_sent > 0 ? r.total_opens / r.total_sent : 0,
    averageClickRate: r.total_sent > 0 ? r.total_clicks / r.total_sent : 0,
  };
}

/**
 * Compute and persist an analytics snapshot for a campaign.
 * Useful as a manual "refresh snapshot" action.
 */
export async function takeAnalyticsSnapshot(
  campaignId: string,
): Promise<void> {
  const analytics = await computeLiveAnalytics(campaignId);
  await insertAnalyticsSnapshot(crypto.randomUUID(), campaignId, JSON.stringify(analytics));
}
