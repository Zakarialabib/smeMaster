import { useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Users, Settings, Mail, Grid2x2, Plus, CheckSquare, Calendar, ReceiptText, Calculator, Zap, BarChart3 } from "lucide-react";
import { AdaptiveBottomSheet } from "@shared/components/ui/AdaptiveBottomSheet";
import { useTranslation } from "react-i18next";

interface Props {
  onAddAccount: () => void;
  hingeOffset?: number;
}

/** Secondary destinations surfaced via the center Hub sheet (max 4 thumb tabs
 *  on the bar itself, so the rest live here). */
const HUB_ITEMS = [
  { path: "/tasks", icon: CheckSquare, label: "Tasks" },
  { path: "/calendar", icon: Calendar, label: "Calendar" },
  { path: "/invoicing", icon: ReceiptText, label: "Invoicing" },
  { path: "/erp", icon: Calculator, label: "ERP" },
  { path: "/automation", icon: Zap, label: "Automation" },
  { path: "/campaigns", icon: BarChart3, label: "Campaigns" },
];

/** iOS-style production bottom tab bar with spring bounce indicator. */
export function BottomTabBar({ onAddAccount, hingeOffset }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [hubOpen, setHubOpen] = useState(false);

  const tabs = [
    { path: "/dashboard/mobile", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/mail/inbox", icon: Mail, label: "Mail" },
    { path: "/crm", icon: Users, label: "CRM" },
    // { path: "/campaigns", icon: BarChart3, label: "Campaigns" } // in Hub
    // { path: "/calendar", icon: Calendar, label: "Calendar" } // in Hub
    { path: "/settings/general", icon: Settings, label: "Settings" },
  ];

  const isActive = (path: string) => {
    if (path === "/mail/inbox") return location.pathname.startsWith("/mail");
    if (path === "/settings/general") return location.pathname.startsWith("/settings");
    if (path === "/crm") return location.pathname.startsWith("/crm") || location.pathname.startsWith("/people");
    if (path === "/dashboard/mobile") return location.pathname.startsWith("/dashboard");
    return location.pathname.startsWith(path);
  };

  const paddingBottom = hingeOffset
    ? `max(env(safe-area-inset-bottom, 0px), ${hingeOffset}px)`
    : "env(safe-area-inset-bottom, 0px)";

  return (
    <>
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="relative z-99 flex items-center justify-around bg-white/25 dark:bg-white/5 backdrop-blur-[24px] border-t border-white/35 dark:border-white/10 bottom-tab-bar"
        style={{ paddingBottom, paddingTop: 6, minHeight: 60 }}
      >
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate({ to: tab.path })}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full py-1 bottom-tab-btn ios-tap transition-all duration-200 ${active ? "text-accent" : "text-sidebar-text/50"}`}
            >
              {active && (
                <span className="absolute -top-1 left-[18%] right-[18%] h-[3px] rounded-full bg-accent" aria-hidden="true" />
              )}
              <div className="relative transition-transform duration-150">
                <tab.icon size={22} aria-hidden="true" strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span className={`text-[10px] leading-none font-medium ${active ? "font-semibold" : ""}`}>
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* Center Hub button — secondary destinations */}
        <button
          onClick={() => setHubOpen(true)}
          aria-label="More"
          className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/30 ios-tap"
        >
          <Grid2x2 size={20} aria-hidden="true" />
        </button>
      </nav>

      <AdaptiveBottomSheet
        isOpen={hubOpen}
        onClose={() => setHubOpen(false)}
        title={t("nav.more") ?? "More"}
      >
        <div className="grid grid-cols-3 gap-3 p-4">
          {HUB_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => {
                  setHubOpen(false);
                  navigate({ to: item.path });
                }}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${active ? "border-accent bg-accent/10 text-accent" : "border-border-primary text-text-secondary"}`}
              >
                <item.icon size={22} aria-hidden="true" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => {
              setHubOpen(false);
              onAddAccount();
            }}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-border-primary p-3 text-text-secondary"
          >
            <Plus size={22} aria-hidden="true" />
            <span className="text-[11px] font-medium">Add account</span>
          </button>
        </div>
      </AdaptiveBottomSheet>
    </>
  );
}
