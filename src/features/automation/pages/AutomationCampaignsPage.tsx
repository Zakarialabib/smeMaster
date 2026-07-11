import { useState } from "react";
import { Workflow, Megaphone } from "lucide-react";
import { cn } from "@shared/utils/cn";
import { AutomationPage } from "@features/automation/pages/AutomationPage";
import { CampaignPage } from "@features/campaigns/components/CampaignPage";

type AutomationCampaignsTab = "automation" | "campaigns";

const TABS: { id: AutomationCampaignsTab; label: string; icon: typeof Workflow }[] = [
  { id: "automation", label: "Automation", icon: Workflow },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
];

/**
 * Merged Automation + Campaigns surface.
 *
 * Both capabilities share an account-scoped context, so they live behind a
 * single nav item with an in-page tab strip. Each tab reuses the existing,
 * self-contained page component (load effect, empty states, editors).
 */
export function AutomationCampaignsPage() {
  const [tab, setTab] = useState<AutomationCampaignsTab>("automation");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Segmented control */}
      <div className="flex items-center gap-1 px-3 sm:px-6 pt-3 border-b border-border/50">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-accent text-text-primary"
                  : "border-transparent text-text-tertiary hover:text-text-secondary",
              )}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Active section */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {tab === "automation" ? <AutomationPage /> : <CampaignPage />}
      </div>
    </div>
  );
}
