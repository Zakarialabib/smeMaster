import { useState, lazy, Suspense, Component, type ReactNode } from "react";
import { toast } from "@shared/stores/toastStore";
import { SkeletonPage } from "@shared/components/ui/Skeleton";
import { CardTabBar, type CardTabItem } from "@shared/components/ui";
import {
  Users,
  ListChecks,
  CalendarDays,
  ReceiptText,
  Plus,
  RefreshCw,
  AlertCircle,
  FileText,
  Sparkles,
} from "lucide-react";

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
              {this.state.error?.message ?? "An unexpected error occurred"}
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
const TABS: CardTabItem[] = [
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "deals", label: "Deals", icon: FileText },
  { id: "relationships", label: "Relationships", icon: Sparkles },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "invoices", label: "Invoices", icon: ReceiptText },
];

// ── Lazy-loaded tab content ──────────────────────────────────────────────
const ContactsContent = lazy(() =>
  import("@features/contacts/pages/ContactsPage").then((m) => ({
    default: m.ContactsPage,
  })),
);

const TasksContent = lazy(() =>
  import("@features/tasks/components/TasksPage").then((m) => ({
    default: m.TasksPage,
  })),
);

const CalendarContent = lazy(() =>
  import("@features/calendar/components/CalendarPage").then((m) => ({
    default: m.CalendarPage,
  })),
);

const InvoicesContent = lazy(() =>
  import("@features/crm/components/InvoicesTab").then((m) => ({
    default: m.default,
  })),
);

const DealsContent = lazy(() =>
  import("@features/crm/pages/DealsPage").then((m) => ({
    default: m.DealsPage,
  })),
);

const RelationshipsContent = lazy(() =>
  import("@features/crm/pages/PeopleRelationships").then((m) => ({
    default: m.PeopleRelationships,
  })),
);

const TAB_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<unknown>>> = {
  contacts: ContactsContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  tasks: TasksContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  calendar: CalendarContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  deals: DealsContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  relationships: RelationshipsContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  invoices: InvoicesContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
};

// ── Main Component ───────────────────────────────────────────────────────
export function CrmPage() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const search = new URLSearchParams(window.location.search);
      const tab = search.get("tab");
      if (tab && TABS.some((t) => t.id === tab)) return tab;
    } catch {
      // ignore URL parsing in non-browser environments
    }
    return "contacts";
  });

  const handleTabChange = (id: string) => {
    toast.info(`Switching to ${TABS.find((t) => t.id === id)?.label ?? id}...`);
    setActiveTab(id);
  };

  const TabContent = TAB_COMPONENTS[activeTab];

  return (
    <div className="flex flex-col h-full bg-bg-primary text-text-primary overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border-secondary/30">
        <div>
          <h1 className="text-[17px] font-semibold text-text-primary">CRM</h1>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            {TABS.find((t) => t.id === activeTab)?.label ?? ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.info("Refreshing...")}
            className="flex items-center justify-center w-9 h-9 rounded-full text-text-secondary ios-tap"
            aria-label="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => toast.info("New item")}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-accent text-white ios-tap shadow-sm shadow-accent/30"
            aria-label="Add new"
          >
            <Plus size={18} />
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="py-2 shrink-0">
        <CardTabBar tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} ariaLabel="CRM tabs" className="mx-3" />
      </div>

      {/* Tab content */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        className="flex-1 overflow-hidden animate-[pageEnter_350ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        <TabErrorBoundary tabName={TABS.find((t) => t.id === activeTab)?.label ?? ""}>
          <Suspense fallback={<SkeletonPage />}>
            {TabContent ? <TabContent /> : null}
          </Suspense>
        </TabErrorBoundary>
      </div>
    </div>
  );
}
