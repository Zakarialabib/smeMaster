import { PremiumSidebar } from './PremiumSidebar';
import type { NavRailGroup } from './NavRail';
import { MainWorkspace } from './MainWorkspace';
import { SidebarContainer } from './SidebarContainer';
import type { ReactNode } from 'react';

interface AppLayoutProps {
  navGroups: NavRailGroup[];
  activeNavId: string;
  activeSubItemId: string | null;
  onNavSelect: (id: string) => void;
  onSubItemSelect: (groupId: string, subItemId: string) => void;
  children: ReactNode;
  /** Optional secondary sidebar (e.g., mail list, contact list) */
  sidebar?: ReactNode;
  /** Title for the secondary sidebar */
  sidebarTitle?: string;
}

/**
 * 3-pane layout: PremiumSidebar (icon rail + content panel) + Content.
 * Single cohesive sliding sidebar combining NavRail's icon rail with
 * all of the old Sidebar's features (mail items, smart folders, labels).
 *
 * When `sidebar` is provided, renders a third pane via SidebarContainer
 * between the PremiumSidebar and MainWorkspace.
 */
export function AppLayout({
  navGroups,
  activeNavId,
  activeSubItemId,
  onNavSelect,
  onSubItemSelect,
  children,
  sidebar,
  sidebarTitle,
}: AppLayoutProps) {
  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      <PremiumSidebar
        groups={navGroups}
        activeGroupId={activeNavId}
        activeSubItemId={activeSubItemId}
        onGroupSelect={onNavSelect}
        onSubItemSelect={onSubItemSelect}
      />
      {sidebar && <SidebarContainer title={sidebarTitle ?? 'Sidebar'}>{sidebar}</SidebarContainer>}
      <MainWorkspace>{children}</MainWorkspace>
    </div>
  );
}
