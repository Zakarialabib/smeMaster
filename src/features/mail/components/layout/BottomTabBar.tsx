import { useNavigate, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Users, Settings, Mail } from "lucide-react";

interface Props {
  onAddAccount: () => void;
  hingeOffset?: number;
}

/** iOS-style production bottom tab bar with spring bounce indicator. */
export function BottomTabBar({ onAddAccount, hingeOffset }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { path: "/dashboard/mobile", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/mail/inbox", icon: Mail, label: "Mail" },
    { path: "/crm", icon: Users, label: "CRM" },
    // { path: "/campaigns", icon: BarChart3, label: "Campaigns" },
    // { path: "/calendar", icon: Calendar, label: "Calendar" },
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

      <button
        onClick={onAddAccount}
        aria-label="Add account"
        className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/30 ios-tap"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="6" x2="12" y2="18" />
          <line x1="6" y1="12" x2="18" y2="12" />
        </svg>
      </button>
    </nav>
  );
}
