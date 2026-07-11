import { useLocation, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PremiumSidebar } from "./PremiumSidebar";
import { MainWorkspace } from "./MainWorkspace";
import { WindowTitleBar } from "./WindowTitleBar";
import { OfflineBanner } from "@shared/components/ui/OfflineBanner";
import { OfflineQueueIndicator } from "@shared/components/ui/OfflineQueueIndicator";
import { SyncProgressIndicator } from "@features/sync/components/SyncProgressIndicator";
import { FrostedBackground } from "@shared/components/ui/FrostedBackground";
import {
  NAV_GROUPS,
  getActiveNavFromPath,
  getActiveSubItem,
  handleNavSelect,
  handleSubItemSelect,
} from "./navConfig";
import { SidebarContentLayout } from "./SidebarContentLayout";
import { useLayoutStore } from "@shared/stores/layoutStore";

export interface DesktopShellProps {
  syncing: boolean;
  licenseBanner?: ReactNode;
}

export function DesktopShell({ syncing, licenseBanner }: DesktopShellProps) {
  const location = useLocation();
  const activeNavId = getActiveNavFromPath(location.pathname);
  const activeSubItemId = getActiveSubItem(location.pathname);
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed);
  // Icon rail always visible. Mail panel only expands on mail pages.
  // All other pages (settings, help, tasks, calendar) show icon rail only.
  const isMailPage = activeNavId === "mail";
  const effectiveSidebarWidth = isMailPage && !sidebarCollapsed ? 344 : 64;

  const header = (
    <>
      <WindowTitleBar />
      <OfflineBanner />
      {syncing && <div className="h-0.5 bg-accent/70 animate-pulse shrink-0" />}
    </>
  );

  const sidebar = (
    <PremiumSidebar
      groups={NAV_GROUPS}
      activeGroupId={activeNavId}
      activeSubItemId={activeSubItemId}
      onGroupSelect={handleNavSelect}
      onSubItemSelect={handleSubItemSelect}
    />
  );

  const content = (
    <MainWorkspace>
      {/* Outlet is provided by the router context when used in route elements */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
        <SyncProgressIndicator />
        <OfflineQueueIndicator />
      </div>
    </MainWorkspace>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <FrostedBackground intensity={0.35} />
      <div className="relative z-10 flex flex-col h-screen overflow-hidden bg-bg-primary/50 backdrop-blur-[--glass-blur-light]">
        {licenseBanner}
        <SidebarContentLayout
          header={header}
          sidebar={sidebar}
          content={content}
          collapsed={false}
          headerHeight={48}
          sidebarWidth={effectiveSidebarWidth}
        />
      </div>
    </div>
  );
}