import "./mobile.css";
import { useEffect, useRef, useState, useCallback } from "react";
import { Outlet, useLocation } from "@tanstack/react-router";
import { useScreenInfo } from "@shared/hooks/usePlatform";
import { useNotificationStore } from "@shared/stores/notificationStore";
import { eventBus, EventNames } from "@shared/services/events/eventBus";
import { DesktopShell } from "./DesktopShell";
import { WindowTitleBar } from "./WindowTitleBar";
import { BottomTabBar } from "@features/mail/components/layout/BottomTabBar";
import { OfflineBanner } from "@shared/components/ui/OfflineBanner";
import { ToastContainer } from "@shared/components/ui/ToastContainer";
import { FloatingActionButton } from "@shared/components/ui/FloatingActionButton";
import { AppLayout } from "./AppLayout";
import { FrostedBackground } from "@shared/components/ui/FrostedBackground";
import {
  NAV_GROUPS,
  getActiveNavFromPath,
  getActiveSubItem,
  handleNavSelect,
  handleSubItemSelect,
} from "./navConfig";
import type { ReactNode } from "react";
import { SkipLink } from "@shared/components/ui/SkipLink";

/**
 * Uses the EventBus to drive shell-level UI reactivity:
 * - Sync indicator visibility
 * - Auto-refresh after sync complete
 * - Error toasts on sync failure
 * - Notification toasts
 */
function useEventSubscriptions() {
  const [isSyncing, setIsSyncing] = useState(false);
  const addNotif = useNotificationStore((s) => s.addNotification);
  const notifAddRef = useRef(addNotif);
  notifAddRef.current = addNotif;

  useEffect(() => {
    const unregisters: Array<() => void> = [];

    unregisters.push(
      eventBus.register(EventNames.SyncStarted, () => {
        setIsSyncing(true);
      }),
    );

    unregisters.push(
      eventBus.register(EventNames.SyncComplete, (_payload: unknown) => {
        setIsSyncing(false);
      }),
    );

    unregisters.push(
      eventBus.register(EventNames.SyncError, (payload: unknown) => {
        setIsSyncing(false);
        const err = payload as { last_error?: string };
        notifAddRef.current({
          title: "Sync Error",
          body: err.last_error ?? "A sync error occurred",
        });
      }),
    );

    unregisters.push(
      eventBus.register(EventNames.NotificationReceived, (payload: unknown) => {
        const p = payload as { title: string; body: string; thread_id?: string };
        notifAddRef.current({
          title: p.title,
          body: p.body,
          threadId: p.thread_id,
        });
      }),
    );

    return () => {
      for (const unreg of unregisters) {
        unreg();
      }
    };
  }, []);

  return { isSyncing };
}

interface ShellProps {
  onAddAccount: () => void;
  licenseBanner?: ReactNode;
}

// ── Sync indicator bar ────────────────────────────────────────────────────
function SyncIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="h-0.5 bg-accent/70 animate-pulse shrink-0" />
  );
}

// ─── Tablet landscape shell: icon-only sidebar + content ───────────────────
function TabletLandscapeShell({
  children,
  syncing,
  licenseBanner,
}: {
  children: ReactNode;
  syncing: boolean;
  licenseBanner?: ReactNode;
}) {
  const location = useLocation();
  const activeNavId = getActiveNavFromPath(location.pathname);
  const activeSubItemId = getActiveSubItem(location.pathname);

  return (
    <div className="flex flex-col h-screen overflow-hidden text-text-primary">
      <FrostedBackground intensity={0.4} />
      <div className="relative z-10 flex flex-col h-screen overflow-hidden">
        <SkipLink />
        <OfflineBanner />
        {licenseBanner}
        <SyncIndicator visible={syncing} />
        <div className="safe-area-top shrink-0">
          <WindowTitleBar />
        </div>
        <div className="flex-1 min-h-0 safe-area-bottom">
          <AppLayout
            navGroups={NAV_GROUPS}
            activeNavId={activeNavId}
            activeSubItemId={activeSubItemId}
            onNavSelect={handleNavSelect}
            onSubItemSelect={handleSubItemSelect}
          >
            {children}
          </AppLayout>
        </div>
      </div>
    </div>
  );
}

// ─── Phone portrait / folded shell: BottomTabBar layout ────────────────────
function PhoneShell({
  children,
  hingeOffset,
  onAddAccount,
  syncing,
  licenseBanner,
}: {
  children: ReactNode;
  hingeOffset?: number;
  onAddAccount: () => void;
  syncing: boolean;
  licenseBanner?: ReactNode;
}) {
  const handleQuickCompose = useCallback(() => {
    eventBus.emit("composer:open", { mode: "new" });
  }, []);
  return (
    <div className="flex flex-col h-screen overflow-hidden text-text-primary">
      {/* Frosted Glass animated background */}
      <FrostedBackground intensity={0.5} />

      <WindowTitleBar showWindowControls={false} />
      <ToastContainer />
      <OfflineBanner />
      {licenseBanner}
      <SyncIndicator visible={syncing} />
      <div className="flex-1 overflow-hidden mobile-shell-content safe-area-bottom relative z-10 bg-bg-primary/40 backdrop-blur-[--glass-blur-light]">
        {children}
      </div>

      {/* Quick-compose FAB */}
      <div className="absolute bottom-20 right-4 z-30">
        <FloatingActionButton
          actions={[
            {
              id: "compose",
              label: "New email",
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17l-4 4 4-4zm0 0l4-4m-4 4l4-4M22 2l-5 15-5-5L22 2z"/></svg>
              ),
              onAction: handleQuickCompose,
            },
          ]}
        />
      </div>

      <BottomTabBar onAddAccount={onAddAccount} hingeOffset={hingeOffset} />
    </div>
  );
}

/**
 * MobileShell — adaptive layout shell.
 *
 * Automatically chooses between:
 * - **Phone portrait / folded**: BottomTabBar layout with optional hinge offset
 * - **Tablet landscape**: Compact icon-only sidebar + content
 * - **Desktop**: Full sidebar + content
 */
export function MobileShell({ onAddAccount, licenseBanner }: ShellProps) {
  const screen = useScreenInfo();
  const { isSyncing } = useEventSubscriptions();

  const isPhoneOrFolded =
    screen.category === "phone" || screen.category === "phone-folded";

  // Tablet landscape → compact split layout
  if (screen.category === "tablet" && screen.aspect === "landscape") {
    return (
      <TabletLandscapeShell syncing={isSyncing} licenseBanner={licenseBanner}>
        <Outlet />
      </TabletLandscapeShell>
    );
  }

  // Phone / phone-folded → mobile layout (BottomTabBar)
  if (isPhoneOrFolded) {
    return (
      <PhoneShell
        hingeOffset={screen.isFoldable ? screen.hingeOffset : undefined}
        onAddAccount={onAddAccount}
        syncing={isSyncing}
        licenseBanner={licenseBanner}
      >
        <Outlet />
      </PhoneShell>
    );
  }

  // Desktop → full layout
  return (
    <DesktopShell syncing={isSyncing} licenseBanner={licenseBanner} />
  );
}
