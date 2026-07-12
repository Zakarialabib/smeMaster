import { useState, lazy, Suspense } from "react";
import { Workflow, Megaphone } from "lucide-react";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";
import { SkeletonPage } from "@shared/components/ui/Skeleton";
import { CardTabBar, type CardTabItem } from "@shared/components/ui/CardTabBar";

type AutomationCampaignsTab = "automation" | "campaigns";

const TABS: CardTabItem<AutomationCampaignsTab>[] = [
  { id: "automation", label: "Automation", icon: Workflow },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
];

// Each surface owns its load effect, empty states and editors. Lazy-load so
// only the active surface's bundle is pulled (xyflow in Automation, recharts
// in Campaigns) instead of eagerly bundling both.
const AutomationPage = lazy(() =>
  import("@features/automation/pages/AutomationPage").then((m) => ({
    default: m.AutomationPage,
  })),
);

const CampaignPage = lazy(() =>
  import("@features/campaigns/components/CampaignPage").then((m) => ({
    default: m.CampaignPage,
  })),
);

/**
 * Automation & Campaigns surface.
 *
 * Both capabilities share an account-scoped context behind a single nav
 * item with an in-page card-tab strip. Each tab reuses the existing
 * self-contained page component (load effect, empty states, editors).
 */
export function AutomationCampaignsPage() {
  const [tab, setTab] = useState<AutomationCampaignsTab>("automation");
  const ActivePage = tab === "automation" ? AutomationPage : CampaignPage;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Card-tab strip */}
      <div className="py-2 px-3 sm:px-6 shrink-0">
        <CardTabBar
          tabs={TABS}
          activeTab={tab}
          onTabChange={setTab}
          ariaLabel="Automation and Campaigns"
        />
      </div>

      {/* Active section */}
      <div className="flex-1 overflow-hidden">
        <ErrorBoundary name="AutomationCampaignsTab">
          <Suspense fallback={<SkeletonPage />}>
            <ActivePage />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
