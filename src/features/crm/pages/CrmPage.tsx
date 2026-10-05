import { lazy, Suspense, Component, type ReactNode } from 'react';
import { toast } from '@shared/stores/toastStore';
import { SkeletonPage } from '@shared/components/ui/Skeleton';
import { useLocation } from '@tanstack/react-router';
import { Plus, RefreshCw, AlertCircle } from 'lucide-react';

// ── Error Boundary for tab content ────────────────────────────────────────
class TabErrorBoundary extends Component<
  { children: ReactNode; tabName: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; tabName: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <AlertCircle size={32} className="text-danger" />
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Failed to load {this.props.tabName}
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
          </div>
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

// ── Tab configuration ────────────────────────────────────────────────────
// Navigation lives in the CRM sidebar (like the mail sidebar) — no top tabs.
// The active tab is URL-synced (`/people?tab=tasks`) so the sidebar,
// refresh and deep links all agree on what is on screen. Tasks + Calendar
// live here (folded in from the old Schedule page), not on a separate page.
const TABS = [
  { id: 'people', label: 'People' },
  { id: 'deals', label: 'Deals' },
  { id: 'activity', label: 'Activity' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'invoices', label: 'Invoices' },
] as const;

type CrmTab = (typeof TABS)[number]['id'];

const TAB_TITLES: Record<CrmTab, string> = {
  people: 'People & relationships',
  deals: 'Deals pipeline',
  activity: 'Activity timeline',
  tasks: 'Tasks',
  calendar: 'Calendar',
  invoices: 'Invoices',
};

// ── Lazy-loaded tab content ──────────────────────────────────────────────
const PeopleContent = lazy(() =>
  import('@features/crm/pages/PeopleRelationships').then((m) => ({
    default: function PeopleTab() {
      return <m.PeopleRelationships section="people" />;
    },
  })),
);

const ActivityContent = lazy(() =>
  import('@features/crm/pages/PeopleRelationships').then((m) => ({
    default: function ActivityTab() {
      return <m.PeopleRelationships section="activity" />;
    },
  })),
);

const InvoicesContent = lazy(() =>
  import('@features/crm/components/InvoicesTab').then((m) => ({
    default: m.default,
  })),
);

const DealsContent = lazy(() =>
  import('@features/crm/pages/DealsPage').then((m) => ({
    default: m.DealsPage,
  })),
);

const TasksContent = lazy(() =>
  import('@features/tasks/components/TasksPage').then((m) => ({
    default: m.TasksPage,
  })),
);

const CalendarContent = lazy(() =>
  import('@features/calendar/components/CalendarPage').then((m) => ({
    default: m.CalendarPage,
  })),
);

const TAB_COMPONENTS: Record<CrmTab, React.LazyExoticComponent<React.ComponentType<unknown>>> = {
  people: PeopleContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  deals: DealsContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  activity: ActivityContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  tasks: TasksContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  calendar: CalendarContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  invoices: InvoicesContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
};

// ── Main Component ───────────────────────────────────────────────────────
export function CrmPage() {
  const location = useLocation();

  // URL-synced tab — the CRM sidebar links here, so refresh and deep links
  // agree with the sidebar highlight.
  const param = new URLSearchParams(location.searchStr).get('tab');
  const activeTab: CrmTab =
    param && (TABS as readonly { id: string }[]).some((t) => t.id === param)
      ? (param as CrmTab)
      : 'people';

  const TabContent = TAB_COMPONENTS[activeTab];

  return (
    <div className="flex flex-col h-full bg-bg-primary text-text-primary overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border-secondary/30">
        <div>
          <h1 className="text-[17px] font-semibold text-text-primary">CRM</h1>
          <p className="text-[11px] text-text-tertiary mt-0.5">{TAB_TITLES[activeTab]}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.info('Refreshing...')}
            className="flex items-center justify-center w-9 h-9 rounded-full text-text-secondary ios-tap"
            aria-label="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => toast.info('New item')}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-accent text-white ios-tap shadow-sm shadow-accent/30"
            aria-label="Add new"
          >
            <Plus size={18} />
          </button>
        </div>
      </header>

      {/* Tab content — switched by the CRM sidebar, not by in-page tabs */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        className="flex-1 overflow-hidden animate-[pageEnter_350ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        <TabErrorBoundary tabName={TAB_TITLES[activeTab]}>
          <Suspense fallback={<SkeletonPage />}>{TabContent ? <TabContent /> : null}</Suspense>
        </TabErrorBoundary>
      </div>
    </div>
  );
}
