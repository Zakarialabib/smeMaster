import { useState, lazy, Suspense } from "react";
import { toast } from "@shared/stores/toastStore";
import { SkeletonPage } from "@shared/components/ui/Skeleton";
import {
  Users,
  BarChart3,
  ListChecks,
  CalendarDays,
  Plus,
  RefreshCw,
} from "lucide-react";

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

const TAB_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<unknown>>> = {
  contacts: ContactsContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  campaigns: CampaignsContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  tasks: TasksContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
  calendar: CalendarContent as React.LazyExoticComponent<React.ComponentType<unknown>>,
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
    <div className="flex gap-1 px-2 py-1.5 mx-3 rounded-2xl bg-white/8 dark:bg-white/5 backdrop-blur-[12px] border border-white/15 dark:border-white/8">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
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
export function MergedCRMPage() {
  const [activeTab, setActiveTab] = useState("contacts");

  const handleTabChange = (id: string) => {
    toast.info(`Switching to ${TABS.find((t) => t.id === id)?.label ?? id}...`);
    setActiveTab(id);
  };

  const TabContent = TAB_COMPONENTS[activeTab];

  return (
    <div className="flex flex-col h-full bg-bg-primary text-text-primary overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/10 dark:border-white/5">
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
      <div className="flex-1 overflow-hidden animate-[pageEnter_350ms_cubic-bezier(0.16,1,0.3,1)]">
        <Suspense fallback={<SkeletonPage />}>
          {TabContent ? <TabContent /> : null}
        </Suspense>
      </div>
    </div>
  );
}
