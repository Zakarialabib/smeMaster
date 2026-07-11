import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import {
  Send,
  MailOpen,
  MousePointerClick,
  AlertTriangle,
  Trophy,
  FlaskConical,
  TrendingUp,
  Maximize2,
  Minimize2,
  BarChart3,
} from 'lucide-react';
import { usePlatform } from '@shared/hooks/usePlatform';
import { CampaignStatsCard } from '@features/campaigns/components/CampaignStatsCard';
import { ExportMenu } from '@features/campaigns/components/ExportMenu';
import type { CampaignStat } from '@features/campaigns/stores/campaignStore';
import { getEngagementTimeSeries } from '@features/campaigns/db/campaignRecipients';
import { getVariantStats, getABTestConfig } from '@features/campaigns/services/abTesting';
import { getCampaignAnalytics } from '@features/campaigns/services/analyticsService';
import type { CampaignAnalytics as AnalyticsData } from '@features/campaigns/services/analyticsService';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@shared/components/ui/EmptyState';

const COLORS = {
  accent: 'var(--color-accent, #4f46e5)',
  success: 'var(--color-success, #059669)',
  warning: 'var(--color-warning, #d97706)',
  danger: 'var(--color-danger, #dc2626)',
};

interface CampaignAnalyticsProps {
  stats: CampaignStat;
  campaignId?: string;
  campaignName?: string;
}

export function CampaignAnalytics({
  stats,
  campaignId,
  campaignName = 'campaign',
}: CampaignAnalyticsProps) {
  const { t } = useTranslation();
  const { mobile: isMobileDevice } = usePlatform();
  const [expanded, setExpanded] = useState(false);
  const [timeSeries, setTimeSeries] = useState<{ date: string; opens: number; clicks: number }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [abVariantStats, setAbVariantStats] = useState<{
    a: { total: number; opens: number; clicks: number; openRate: number; clickRate: number } | null;
    b: { total: number; opens: number; clicks: number; openRate: number; clickRate: number } | null;
    winner: string | null;
    significant: boolean;
    pValue: number | null;
  } | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getEngagementTimeSeries(campaignId),
      getCampaignAnalytics(campaignId),
      getABTestConfig(campaignId).then((config) => {
        if (!config) return null;
        return getVariantStats(campaignId).then((vs) => ({
          a: vs.a,
          b: vs.b,
          winner: config.winnerId ?? null,
          significant: config.significant ?? false,
          pValue: config.pValue ?? null,
        }));
      }),
    ])
      .then(([ts, an, abResult]) => {
        if (cancelled) return;
        setTimeSeries(ts);
        setAnalytics(an);
        if (abResult) setAbVariantStats(abResult);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const barData = [
    { name: t('campaign.sent'), value: stats.sent, fill: COLORS.accent },
    { name: t('campaign.opened'), value: stats.opened, fill: COLORS.success },
    { name: t('campaign.clicked'), value: stats.clicked, fill: COLORS.warning },
    { name: t('campaign.bounced'), value: stats.bounced, fill: COLORS.danger },
  ];

  const pieData = [
    { name: t('campaign.opened'), value: stats.opened, color: COLORS.success },
    { name: t('campaign.clicked'), value: stats.clicked, color: COLORS.warning },
    { name: t('campaign.bounced'), value: stats.bounced, color: COLORS.danger },
  ].filter((d) => d.value > 0);

  const timeSeriesData = timeSeries.length > 0 ? timeSeries : [];

  const chartHeight = expanded && !isMobileDevice ? 350 : 200;
  const allZeros =
    stats.sent === 0 && stats.opened === 0 && stats.clicked === 0 && stats.bounced === 0;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className={`grid ${isMobileDevice ? 'grid-cols-1' : 'grid-cols-4'} gap-3`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-bg-tertiary h-24" />
          ))}
        </div>
        <div className="rounded-lg bg-bg-tertiary h-64" />
      </div>
    );
  }

  if (allZeros) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No campaign data yet"
        subtitle="Send your campaign to see analytics."
      />
    );
  }

  const tooltipStyle = {
    backgroundColor: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border-primary)',
    borderRadius: '8px',
    fontSize: '12px',
  };

  const axisTickStyle = { fontSize: 12, fill: 'var(--color-text-tertiary)' };

  return (
    <div className="space-y-4">
      {/* Stats cards row + export + expand toggle */}
      <div className="flex items-center justify-between">
        <div className={`grid ${isMobileDevice ? 'grid-cols-1' : 'grid-cols-4'} gap-3 flex-1`}>
          <CampaignStatsCard
            label={t('campaign.sent')}
            value={stats.sent}
            icon={Send}
            color={COLORS.accent}
          />
          <CampaignStatsCard
            label={t('campaign.opened')}
            value={stats.opened}
            icon={MailOpen}
            color={COLORS.success}
          />
          <CampaignStatsCard
            label={t('campaign.clicked')}
            value={stats.clicked}
            icon={MousePointerClick}
            color={COLORS.warning}
          />
          <CampaignStatsCard
            label={t('campaign.bounced')}
            value={stats.bounced}
            icon={AlertTriangle}
            color={COLORS.danger}
          />
        </div>
        <div className="flex items-center gap-2 ml-3">
          {!isMobileDevice && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
              title={expanded ? t('campaign.collapse') : t('campaign.expand')}
            >
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
          {campaignId && analytics && (
            <ExportMenu campaignId={campaignId} campaignName={campaignName} analytics={analytics} />
          )}
        </div>
      </div>

      {/* Rates summary row */}
      {stats.sent > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-text-tertiary px-1">
          <span>
            Open rate:{' '}
            <span className="text-text-primary font-medium">
              {((stats.opened / stats.sent) * 100).toFixed(1)}%
            </span>
          </span>
          <span>
            Click rate:{' '}
            <span className="text-text-primary font-medium">
              {((stats.clicked / stats.sent) * 100).toFixed(1)}%
            </span>
          </span>
          <span>
            Bounce rate:{' '}
            <span className="text-text-primary font-medium">
              {((stats.bounced / stats.sent) * 100).toFixed(1)}%
            </span>
          </span>
          <span>
            CTOR:{' '}
            <span className="text-text-primary font-medium">
              {stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : '0.0'}%
            </span>
          </span>
        </div>
      )}

      {/* Charts: side-by-side on desktop, stacked on mobile */}
      <div
        className={`grid ${isMobileDevice || !expanded ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}
      >
        <div className="glass-panel rounded-lg p-4">
          <h4 className="text-sm font-medium text-text-primary mb-3">
            {t('campaign.deliveryStatus')}
          </h4>
          <ResponsiveContainer
            width="100%"
            {...(isMobileDevice ? { aspect: 4 / 3 } : { height: chartHeight })}
          >
            <BarChart data={barData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <XAxis dataKey="name" tick={axisTickStyle} />
              <YAxis tick={axisTickStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {(!expanded || isMobileDevice) && (
          <div className="glass-panel rounded-lg p-4">
            <h4 className="text-sm font-medium text-text-primary mb-3">
              {t('campaign.engagementBreakdown')}
            </h4>
            <ResponsiveContainer
              width="100%"
              {...(isMobileDevice ? { aspect: 1 } : { height: chartHeight })}
            >
              <PieChart margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={72}
                  innerRadius={40}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Full-width engagement over time when expanded */}
      {expanded && !isMobileDevice && (
        <div className="glass-panel rounded-lg p-4">
          <h4 className="text-sm font-medium text-text-primary mb-3">
            {t('campaign.engagementBreakdown')}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={55}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center gap-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-text-secondary">{d.name}</span>
                  <span className="ml-auto text-text-primary font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {timeSeriesData.length > 0 ? (
        <div className="glass-panel rounded-lg p-4">
          <h4 className="text-sm font-medium text-text-primary mb-3">
            {t('campaign.engagementOverTime')}
          </h4>
          <ResponsiveContainer
            width="100%"
            {...(isMobileDevice
              ? { aspect: 16 / 9 }
              : { height: expanded && !isMobileDevice ? 350 : 220 })}
          >
            <LineChart data={timeSeriesData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
              <XAxis dataKey="date" tick={axisTickStyle} />
              <YAxis tick={axisTickStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="opens"
                stroke={COLORS.success}
                strokeWidth={2}
                dot={{ fill: COLORS.success, r: 3 }}
                name={t('campaign.opens')}
              />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke={COLORS.warning}
                strokeWidth={2}
                dot={{ fill: COLORS.warning, r: 3 }}
                name={t('campaign.clicks')}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {abVariantStats && (abVariantStats.a || abVariantStats.b) && (
        <div className="glass-panel rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical size={16} className="text-accent" />
            <h4 className="text-sm font-medium text-text-primary">{t('campaign.abTestResults')}</h4>
            {abVariantStats.significant && abVariantStats.winner && (
              <span className="flex items-center gap-1 ml-2 px-2 py-0.5 bg-success/10 text-success text-xs rounded-full">
                <Trophy size={12} />
                {t('campaign.winner')}: {abVariantStats.winner}
              </span>
            )}
            {abVariantStats.pValue !== null && (
              <span className="ml-auto text-xs text-text-tertiary">
                p = {abVariantStats.pValue.toFixed(4)}
                {abVariantStats.significant
                  ? t('campaign.significant')
                  : t('campaign.notSignificant')}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(['a', 'b'] as const).map((key) => {
              const v = abVariantStats[key];
              if (!v) return null;
              const isWinner = abVariantStats.winner === key.toUpperCase();
              return (
                <div
                  key={key}
                  className={`rounded-lg p-3 border ${
                    isWinner
                      ? 'border-success/40 bg-success/5'
                      : 'border-border-primary bg-bg-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      {key === 'a' ? t('campaign.variantA') : t('campaign.variantB')}
                    </span>
                    {isWinner && (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <Trophy size={12} />
                        {t('campaign.winner')}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-text-tertiary">{t('campaign.sent')}:</span>{' '}
                      <span className="text-text-primary font-medium">{v.total}</span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">{t('campaign.opens')}:</span>{' '}
                      <span className="text-text-primary font-medium">{v.opens}</span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">{t('campaign.openRate')}:</span>{' '}
                      <span className="text-text-primary font-medium">
                        {(v.openRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">{t('campaign.clickRate')}:</span>{' '}
                      <span className="text-text-primary font-medium">
                        {(v.clickRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {analytics && analytics.topLinks.length > 0 && (
        <div className="glass-panel rounded-lg p-4">
          <h4 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-1.5">
            <TrendingUp size={14} />
            {t('campaign.topLinks')}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-tertiary text-xs">
                  <th className="text-left py-1 pr-2">{t('campaign.url')}</th>
                  <th className="text-right py-1 w-20">{t('campaign.clicks')}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topLinks
                  .slice(0, expanded && !isMobileDevice ? 10 : 5)
                  .map((link, i) => (
                    <tr key={i} className="border-t border-border-primary">
                      <td className="py-1.5 pr-2 text-text-primary truncate max-w-[400px]">
                        {link.url}
                      </td>
                      <td className="py-1.5 text-right text-text-primary font-medium">
                        {link.clicks}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
