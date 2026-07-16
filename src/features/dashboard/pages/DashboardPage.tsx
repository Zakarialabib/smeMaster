import { useEffect, useMemo, useState } from 'react';
import {
  Settings,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Clock,
  LayoutGrid,
  Rows3,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '@shared/hooks/usePlatform';
import { Modal } from '@shared/components/ui/Modal';
import { Button } from '@shared/components/ui/Button';
import { ErrorBoundary } from '@shared/components/ui/ErrorBoundary';
import { SkeletonPage, GlassPanel } from '@shared/components/ui';
import { useDashboardStore, DASHBOARD_RANGE_OPTIONS, type DashboardRangeDays, type DashboardDensity } from '@features/dashboard/stores/dashboardStore';
import {
  dashboardContactsTotal,
  dashboardContactsNewWeek,
  dashboardTasksDueToday,
  dashboardTasksOverdue,
  dashboardCampaignsTotal,
  dashboardContactGrowth,
} from "@shared/services/db/db-invoke";
import type { DashboardTimeSeries } from '@shared/services/db/db-invoke';
import { EmailVolumeWidget } from '@features/dashboard/components/EmailVolumeWidget';
import { EmailHeatmapWidget } from '@features/dashboard/components/EmailHeatmapWidget';
import { ContactGrowthWidget } from '@features/dashboard/components/ContactGrowthWidget';
import { ContactsStatsWidget } from '@features/dashboard/components/ContactsStatsWidget';
import { TaskSummaryWidget } from '@features/dashboard/components/TaskSummaryWidget';
import { RecentActivityWidget } from '@features/dashboard/components/RecentActivityWidget';
import { CampaignsStatsWidget } from '@features/dashboard/components/CampaignsStatsWidget';
import { AutomationRulesWidget } from '@features/dashboard/components/AutomationRulesWidget';
import { QuickActionsWidget } from '@features/dashboard/components/QuickActionsWidget';
import { EntityNetworkGraph } from '@features/dashboard/components/EntityNetworkGraph';
import { BusinessHealthWidget } from '@features/dashboard/components/BusinessHealthWidget';

// ─── Customization Modal ───────────────────────────────────────────────────

function WidgetCustomizeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { widgets, toggleWidget, reorderWidgets } = useDashboardStore();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('dashboard.customize')} size="md">
      <div className="p-4 space-y-2">
        {widgets.map((w, idx) => (
          <div
            key={w.id}
            className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-bg-secondary"
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleWidget(w.id)}
                className={`w-8 h-4 rounded-full transition-colors relative ${
                  w.visible ? 'bg-accent' : 'bg-bg-tertiary'
                }`}
                title={w.visible ? 'Hide' : 'Show'}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow ${
                    w.visible ? 'translate-x-4' : ''
                  }`}
                />
              </button>
              <span className="text-sm text-text-primary">{w.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => idx > 0 && reorderWidgets(idx, idx - 1)}
                disabled={idx === 0}
                className="p-1 text-text-tertiary hover:text-text-primary disabled:opacity-30"
                title="Move up"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => idx < widgets.length - 1 && reorderWidgets(idx, idx + 1)}
                disabled={idx === widgets.length - 1}
                className="p-1 text-text-tertiary hover:text-text-primary disabled:opacity-30"
                title="Move down"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ─── Hero KPI strip ────────────────────────────────────────────────────────

interface HeroMetricData {
  key: string;
  label: string;
  value: number;
  trendPct?: number;
  spark?: number[];
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  if (!values.length) return null;
  return (
    <div
      className="flex items-end gap-[3px] h-10 mt-3"
      aria-hidden="true"
      role="img"
      aria-label={`Sparkline with ${values.length} points`}
    >
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[5px] rounded-t-sm"
          style={{
            height: `${Math.max((v / max) * 100, 8)}%`,
            backgroundColor: 'var(--color-accent)',
            opacity: 0.35 + (i / Math.max(values.length - 1, 1)) * 0.65,
          }}
        />
      ))}
    </div>
  );
}

function HeroMetrics({ rangeDays, density }: { rangeDays: DashboardRangeDays; density: DashboardDensity }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<HeroMetricData[]>([]);
  const [featured, setFeatured] = useState<string>('contacts');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [total, newWeek, dueToday, overdue, campaignsTotal, growth] = await Promise.all([
          dashboardContactsTotal(),
          dashboardContactsNewWeek(),
          dashboardTasksDueToday(),
          dashboardTasksOverdue(),
          dashboardCampaignsTotal(),
          dashboardContactGrowth(),
        ]);
        if (cancelled) return;
        const scores = (growth as DashboardTimeSeries[]).map((d) => d.score);
        const first = scores[0] ?? 0;
        const last = scores[scores.length - 1] ?? 0;
        const pct = first > 0 ? ((last - first) / first) * 100 : 0;
        const weeks = Math.max(1, Math.round(rangeDays / 7));
        setMetrics([
          {
            key: 'contacts',
            label: t('dashboard.heroTotalContacts'),
            value: total,
            trendPct: Math.round(pct * 10) / 10,
            spark: scores.slice(-weeks),
          },
          { key: 'newContacts', label: t('dashboard.heroNewContacts'), value: newWeek },
          { key: 'tasksDue', label: t('dashboard.heroTasksDue'), value: dueToday },
          { key: 'overdue', label: t('dashboard.heroOverdue'), value: overdue },
          { key: 'campaigns', label: t('dashboard.heroCampaigns'), value: campaignsTotal },
        ]);
      } catch {
        // Hero metrics are decorative — fail silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rangeDays, t]);

  if (loading) {
    return (
      <GlassPanel variant="card" className={density === 'compact' ? 'p-4 mb-4' : 'p-5 mb-4'}>
        <div className="animate-pulse flex items-center gap-4">
          <div className="flex-1 space-y-3">
            <div className="h-3 bg-bg-tertiary rounded w-28" />
            <div className="h-9 bg-bg-tertiary rounded w-32" />
          </div>
          <div className="h-10 bg-bg-tertiary rounded w-40" />
        </div>
      </GlassPanel>
    );
  }

  if (!metrics.length) return null;
  const featuredMetric = metrics.find((m) => m.key === featured) ?? metrics[0];
  if (!featuredMetric) return null;

  const semanticColor =
    featuredMetric.trendPct === undefined
      ? 'text-text-tertiary'
      : featuredMetric.trendPct >= 5
        ? 'text-success'
        : featuredMetric.trendPct >= -5
          ? 'text-warning'
          : 'text-danger';
  const ArrowIcon = featuredMetric.trendPct !== undefined && featuredMetric.trendPct >= 0 ? ArrowUp : ArrowDown;

  return (
    <GlassPanel
      variant="card"
      className={density === 'compact' ? 'p-4 mb-4' : 'p-5 mb-4'}
      role="region"
      aria-label="Key metrics"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metrics.map((m) => {
          const isFeatured = m.key === featured;
          return (
            <button
              key={m.key}
              onClick={() => setFeatured(m.key)}
              aria-pressed={isFeatured}
              className={`flex flex-col text-left rounded-lg p-3 border transition-colors ${
                isFeatured
                  ? 'border-accent/40 bg-accent/5'
                  : 'border-border-primary bg-bg-secondary hover:border-accent/30'
              }`}
            >
              <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                {m.label}
              </span>
              <span className="text-2xl font-bold text-text-primary tabular-nums mt-1">
                {m.value.toLocaleString()}
              </span>
              {isFeatured && m.trendPct !== undefined && (
                <span className="mt-1 flex items-center gap-1 text-xs">
                  <span className={`inline-flex items-center gap-0.5 font-semibold ${semanticColor}`}>
                    <ArrowIcon size={12} aria-hidden="true" />
                    {Math.abs(m.trendPct)}%
                  </span>
                  <span className="text-text-quaternary">{t('dashboard.heroTrendLabel')}</span>
                </span>
              )}
              {isFeatured && m.spark && <Sparkline values={m.spark} />}
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}

// ─── Widget renderer ───────────────────────────────────────────────────────

function renderWidget(id: string, rangeDays: DashboardRangeDays): React.ReactNode {
  switch (id) {
    case 'emailVolume':
      return <EmailVolumeWidget rangeDays={rangeDays} />;
    case 'emailHeatmap':
      return <EmailHeatmapWidget />;
    case 'contactGrowth':
      return <ContactGrowthWidget rangeDays={rangeDays} />;
    case 'businessHealth':
      return <BusinessHealthWidget />;
    case 'contacts':
      return <ContactsStatsWidget />;
    case 'tasks':
      return <TaskSummaryWidget />;
    case 'activity':
      return <RecentActivityWidget />;
    case 'campaigns':
      return <CampaignsStatsWidget />;
    case 'automation':
      return <AutomationRulesWidget />;
    case 'quick':
      return <QuickActionsWidget />;
    case 'networkGraph':
      return <EntityNetworkGraph />;
    default:
      return null;
  }
}

// ─── Widget wrapper ────────────────────────────────────────────────────────

function WidgetWrapper({
  widgetId,
  density,
  refreshKey,
  children,
}: {
  widgetId: string;
  density: DashboardDensity;
  refreshKey: number;
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary name={`Widget-${widgetId}`}>
      <GlassPanel
        key={refreshKey}
        variant="card"
        className={density === 'compact' ? 'p-3' : 'p-4'}
      >
        {children}
      </GlassPanel>
    </ErrorBoundary>
  );
}

// ─── Main Dashboard Page ───────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 60_000;

export function DashboardPage() {
  const { t } = useTranslation();
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;
  const {
    widgets,
    loaded,
    loadPreferences,
    rangeDays,
    density,
    setRangeDays,
    setDensity,
  } = useDashboardStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    setLastUpdated(new Date());
  }, []);

  // Auto-refresh ticker
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      setRefreshNonce((n) => n + 1);
      setLastUpdated(new Date());
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoRefresh]);

  // "Updated Xs ago" ticker
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  const doRefresh = () => {
    setRefreshNonce((n) => n + 1);
    setLastUpdated(new Date());
  };

  const updatedLabel = useMemo(() => {
    if (!lastUpdated) return '';
    const secs = Math.max(0, Math.round((now.getTime() - lastUpdated.getTime()) / 1000));
    if (secs < 60) return t('dashboard.updatedSeconds', { count: secs });
    const mins = Math.round(secs / 60);
    if (mins < 60) return t('dashboard.updatedMinutes', { count: mins });
    return t('dashboard.updatedHours', { count: Math.round(mins / 60) });
  }, [lastUpdated, now, t]);

  if (!loaded) {
    return <SkeletonPage />;
  }

  const visibleWidgets = widgets.filter((w) => w.visible).sort((a, b) => a.order - b.order);
  const gridGap = density === 'compact' ? 'gap-2 sm:gap-3' : 'gap-3 sm:gap-4';

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            className={`${isMobileDevice ? 'text-xl' : 'text-2xl'} font-semibold text-text-primary`}
          >
            {t('dashboard.title')}
          </h1>
          <p className="text-sm text-text-tertiary mt-1">{t('dashboard.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Settings size={16} />}
            onClick={() => setModalOpen(true)}
          >
            {t('dashboard.customizeWidgets')}
          </Button>
          {/* Date range */}
          <div
            className="flex items-center rounded-lg bg-bg-secondary border border-border-primary p-0.5"
            role="group"
            aria-label={t('dashboard.range')}
          >
            {DASHBOARD_RANGE_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setRangeDays(d)}
                aria-pressed={rangeDays === d}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  rangeDays === d
                    ? 'bg-accent text-white'
                    : 'text-text-tertiary hover:text-text-primary'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          {/* Density toggle */}
          <button
            onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
            title={t('dashboard.density')}
            aria-pressed={density === 'compact'}
            className="p-1.5 rounded-lg bg-bg-secondary border border-border-primary text-text-tertiary hover:text-text-primary transition-colors"
          >
            {density === 'compact' ? <Rows3 size={16} /> : <LayoutGrid size={16} />}
          </button>
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((a) => !a)}
            title={t('dashboard.autoRefresh')}
            aria-pressed={autoRefresh}
            className={`p-1.5 rounded-lg bg-bg-secondary border border-border-primary transition-colors ${
              autoRefresh
                ? 'text-accent border-accent/40'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            <RefreshCw size={16} className={autoRefresh ? 'animate-spin' : ''} />
          </button>
          {/* Manual refresh */}
          <button
            onClick={doRefresh}
            title={t('dashboard.refresh')}
            className="p-1.5 rounded-lg bg-bg-secondary border border-border-primary text-text-tertiary hover:text-text-primary transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          {updatedLabel && (
            <span className="text-xs text-text-quaternary flex items-center gap-1 whitespace-nowrap">
              <Clock size={12} aria-hidden="true" />
              {updatedLabel}
            </span>
          )}
        </div>
      </div>

      <HeroMetrics rangeDays={rangeDays} density={density} />

      <div
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${gridGap} auto-rows-min`}
        aria-busy={!loaded}
        aria-live="polite"
        aria-label="Dashboard widgets"
      >
        {visibleWidgets.map((w) => (
          <WidgetWrapper
            key={w.id}
            widgetId={w.id}
            density={density}
            refreshKey={refreshNonce}
          >
            {renderWidget(w.id, rangeDays)}
          </WidgetWrapper>
        ))}
      </div>

      <WidgetCustomizeModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
