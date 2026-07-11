import { useEffect, useState } from 'react';
import { Settings, ChevronUp, ChevronDown, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '@shared/hooks/usePlatform';
import { Modal } from '@shared/components/ui/Modal';
import { Button } from '@shared/components/ui/Button';
import { ErrorBoundary } from '@shared/components/ui/ErrorBoundary';
import { SkeletonPage, GlassPanel } from '@shared/components/ui';
import { useDashboardStore } from '@features/dashboard/stores/dashboardStore';
import { dashboardContactsTotal, dashboardContactGrowth } from '@shared/services/db/db-invoke';
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

// ─── Hero Metric ────────────────────────────────────────────────────────────

interface HeroMetricState {
  total: number;
  trendPct: number;
  isUp: boolean;
  sparkline: number[];
  maxSparkValue: number;
}

function HeroMetric() {
  const { t } = useTranslation();
  const [state, setState] = useState<HeroMetricState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [total, growth] = await Promise.all([
          dashboardContactsTotal(),
          dashboardContactGrowth(),
        ]);
        if (cancelled) return;

        const scores = growth.map((d: DashboardTimeSeries) => d.score);
        const firstVal = scores[0] ?? 0;
        const lastVal = scores[scores.length - 1] ?? 0;
        const pctChange = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;

        const sparkValues = scores.slice(-6);
        const maxVal = Math.max(...sparkValues, 1);

        setState({
          total,
          trendPct: Math.round(pctChange * 10) / 10,
          isUp: pctChange >= 0,
          sparkline: sparkValues,
          maxSparkValue: maxVal,
        });
      } catch {
        // Hero metric is decorative — fail silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <GlassPanel variant="card" className="p-5 mb-6" aria-label="Loading hero metric">
        <div className="animate-pulse flex items-center justify-between">
          <div className="space-y-3">
            <div className="h-3 bg-bg-tertiary rounded w-28" />
            <div className="h-10 bg-bg-tertiary rounded w-36" />
            <div className="h-3 bg-bg-tertiary rounded w-24" />
          </div>
          <div className="h-10 bg-bg-tertiary rounded w-32" />
        </div>
      </GlassPanel>
    );
  }

  if (!state) {
    return null;
  }

  const semanticColor =
    state.trendPct >= 5
      ? 'text-success'
      : state.trendPct >= -5
        ? 'text-warning'
        : 'text-danger';

  const ArrowIcon = state.isUp ? ArrowUp : ArrowDown;

  return (
    <GlassPanel variant="card" className="p-5 mb-6" role="region" aria-label="Key metric summary">
      <div className="flex items-center justify-between gap-4">
        {/* Left: big number + label + trend */}
        <div className="space-y-1.5 min-w-0">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
            {t('dashboard.heroTotalContacts', 'Total Contacts')}
          </p>
          <p className="text-4xl font-bold text-text-primary tabular-nums tracking-tight">
            {state.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-0.5 text-sm font-semibold ${semanticColor}`}>
              <ArrowIcon size={14} aria-hidden="true" />
              <span>{Math.abs(state.trendPct)}%</span>
            </span>
            <span className="text-xs text-text-quaternary">
              {t('dashboard.heroTrendLabel', 'vs last 12 weeks')}
            </span>
          </div>
        </div>

        {/* Center: sparkline bars */}
        <div
          className="flex items-end gap-[3px] h-12 shrink-0"
          aria-hidden="true"
          role="img"
          aria-label={`Sparkline showing ${state.sparkline.length} data points`}
        >
          {state.sparkline.map((val, i) => {
            const heightPct = (val / state.maxSparkValue) * 100;
            return (
              <div
                key={i}
                className="w-[6px] rounded-t-sm transition-all duration-300"
                style={{
                  height: `${Math.max(heightPct, 6)}%`,
                  backgroundColor: 'var(--color-accent)',
                  opacity: 0.35 + (i / Math.max(state.sparkline.length - 1, 1)) * 0.65,
                }}
              />
            );
          })}
        </div>

        {/* Right: accent icon */}
        <div className="text-accent/70 shrink-0 hidden sm:block">
          <TrendingUp size={36} strokeWidth={1.5} aria-hidden="true" />
        </div>
      </div>
    </GlassPanel>
  );
}

// ─── Widget renderer ───────────────────────────────────────────────────────

function renderWidget(id: string): React.ReactNode {
  switch (id) {
    case 'emailVolume':
      return <EmailVolumeWidget />;
    case 'emailHeatmap':
      return <EmailHeatmapWidget />;
    case 'contactGrowth':
      return <ContactGrowthWidget />;
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

function WidgetWrapper({ widgetId, children }: { widgetId: string; children: React.ReactNode }) {
  return (
    <ErrorBoundary name={`Widget-${widgetId}`}>
      <GlassPanel variant="card" className="p-4">
        {children}
      </GlassPanel>
    </ErrorBoundary>
  );
}

// ─── Main Dashboard Page ───────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation();
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;
  const { widgets, loaded, loadPreferences } = useDashboardStore();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  if (!loaded) {
    return <SkeletonPage />;
  }

  const visibleWidgets = widgets.filter((w) => w.visible).sort((a, b) => a.order - b.order);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className={`${isMobileDevice ? 'text-xl' : 'text-2xl'} font-semibold text-text-primary`}
          >
            {t('dashboard.title')}
          </h1>
          <p className="text-sm text-text-tertiary mt-1">{t('dashboard.description')}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Settings size={16} />}
          onClick={() => setModalOpen(true)}
        >
          {t('dashboard.customizeWidgets')}
        </Button>
      </div>

      <HeroMetric />

      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-min"
        aria-busy={!loaded}
        aria-live="polite"
        aria-label="Dashboard widgets"
      >
        {visibleWidgets.map((w) => (
          <WidgetWrapper key={w.id} widgetId={w.id}>
            {renderWidget(w.id)}
          </WidgetWrapper>
        ))}
      </div>

      <WidgetCustomizeModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
