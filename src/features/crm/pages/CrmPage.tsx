import { useState, lazy, Suspense, Component, type ReactNode } from "react";
import { toast } from "@shared/stores/toastStore";
import { SkeletonPage } from "@shared/components/ui/Skeleton";
import {
  Users,
  BarChart3,
  ListChecks,
  CalendarDays,
  ReceiptText,
  Plus,
  RefreshCw,
  AlertCircle,
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
interface Tab {
  id: string;
  label: string;
  icon: typeof Users;
}

const TABS: Tab[] = [
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "campaigns", label: "Campaigns", icon: BarChart3 },
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

const CampaignsContent = lazy(() =>
  import("@features/campaigns/components/CampaignPage").then((m) => ({
    default: m.CampaignPage,
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

const TAB_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<unknown>>> = {
  contacts: ContactsContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  campaigns: CampaignsContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  tasks: TasksContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  calendar: CalendarContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  invoices: InvoicesContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
};

// ── Tab bar ──────────────────────────────────────────────────────────────
function TabBar({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div
      className="flex gap-1 px-2 py-1.5 mx-3 rounded-2xl bg-bg-secondary/40 backdrop-blur-[12px] border border-border-secondary/40"
      role="tablist"
      aria-label="CRM tabs"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`crm-tabpanel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-medium transition-all duration-200 ios-tap ${
              isActive
                ? "bg-accent text-white shadow-sm shadow-accent/30"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────
export function CrmPage() {
  const [activeTab, setActiveTab] = useState("contacts");

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
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* Tab content */}
      <div
        id={`crm-tabpanel-${activeTab}`}
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
