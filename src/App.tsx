import { useEffect, useState, useCallback, Suspense } from "react";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { AddAccount } from "@features/accounts/components/AddAccount";
import { Composer } from "./features/mail/components/composer/Composer";
import { UndoSendToast } from "./features/mail/components/composer/UndoSendToast";
import { CommandPalette } from "./features/mail/components/search/CommandPalette";
import { ShortcutsHelp } from "./features/mail/components/search/ShortcutsHelp";
import { AskInbox } from "./features/mail/components/search/AskInbox";
import { useKeyboardShortcuts } from "@shared/hooks/useKeyboardShortcuts";
import { useInputModality } from "@shared/hooks/useInputModality";
import { useAppInit } from "@shared/hooks/useAppInit";
import { useThemeManager } from "@features/settings/hooks/useThemeManager";
import { useBiometricLock } from "@shared/hooks/useBiometricLock";
import { useSyncStatus } from "@features/calendar/hooks/useSyncStatus";
import { useNetworkStatus } from "@shared/hooks/useNetworkStatus";
import { OfflineIndicator } from "@shared/components/ui/OfflineIndicator";
import { OfflineQueueIndicator } from "@shared/components/ui/OfflineQueueIndicator";
import { DndProvider } from "./features/mail/components/dnd/DndProvider";
import { MobileShell } from "@shared/components/layout/shell/MobileShell";
import { ContextMenuPortal } from "@shared/components/ui/ContextMenuPortal";
import { MoveToFolderDialog } from "./features/mail/components/MoveToFolderDialog";
import { UpdateToast } from "@shared/components/ui/UpdateToast";
import { NotificationToast } from "@shared/components/ui/NotificationToast";
import { TemplateDemo } from "./features/mail/components/templates/TemplateDemo";
import { DEMO_FOLLOW_UP } from "./features/mail/constants/templateDemos";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";
import { OnboardingScreen } from "@features/onboarding/OnboardingScreen";
import { useLicenseStore } from "@shared/stores/licenseStore";
import { SinglePageLayout } from "@shared/components/layout";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { triggerSync } from "./features/mail/services/gmail/syncManager";
import { router } from "./router";
import { getSelectedThreadId } from "./router/navigate";
import { useThreadStore } from "./features/mail/stores/threadStore";
import BiometricLockScreen from "@features/accounts/components/mobile/BiometricLockScreen";
import { useLocalStorage } from "@shared/hooks/useLocalStorage";
import { useSyncEvents } from "@shared/hooks/useSyncEvents";
import { usePushNotifications } from "@shared/hooks/usePushNotifications";
import { useTaskWorkflowEngine } from "@features/tasks/hooks/useTaskWorkflowEngine";
import { eventBus } from "@shared/services/events/eventBus";
import { useSyncStore } from "@shared/stores/syncStore";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { useNotificationStore } from "@shared/stores/notificationStore";
import { initActionStatusEventBridge } from "@shared/stores/actionStatus/eventBusBridge";
import { ConflictResolutionPanel } from "@features/sync/components/ConflictResolutionPanel";
import { useConflictStore } from "@features/sync/stores/conflictStore";
import { SyncProgressIndicator } from "@features/sync/components/SyncProgressIndicator";
import { GitCompareArrows } from "lucide-react";

/**
 * Sync bridge: subscribes to router state changes and writes the selected
 * thread ID to the threadStore so that range-select and other multi-select
 * logic can use it as an anchor.
 */
function useRouterSyncBridge() {
  useEffect(() => {
    return router.subscribe("onResolved", () => {
      const threadId = getSelectedThreadId();
      if (useThreadStore.getState().selectedThreadId !== threadId) {
        useThreadStore.getState().selectThread(threadId);
      }
    });
  }, []);
}

/**
 * Listens for the tray "Check for Mail" menu item and triggers a sync
 * for all active accounts.
 */
function useTrayCheckMail() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("tray-check-mail", () => {
        const accounts = useAccountStore.getState().accounts;
        const activeIds = accounts.filter((a) => a.isActive).map((a) => a.id);
        if (activeIds.length > 0) {
          triggerSync(activeIds);
        }
      }).then((fn) => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, []);
}

/**
 * Suppresses the default browser context menu globally.
 * Elements with `data-native-context-menu` attribute opt out.
 */
function useContextMenuSuppression() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest?.("[data-native-context-menu]")) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);
}

/**
 * Opens Tauri devtools on F12 keypress (desktop only, requires devtools feature).
 */
function useDevtoolsShortcut() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        import("@shared/services/db/invoke/command").then(({ invokeCommand }) => {
          invokeCommand("open_devtools").catch((err) => {
            console.warn("[devtools] Could not open DevTools:", err);
          });
        });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}

function useShareHandler() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import("@shared/services/mobile/shareHandler").then((m) => {
      m.initShareHandler().then((c) => { cleanup = c; });
    });
    return () => cleanup?.();
  }, []);
}

/**
 * Registers all Zustand store handlers with the central EventBus and
 * starts listening for Rust-side events. This is the reactive glue
 * that makes UI auto-update when background sync completes, push
 * notifications arrive, etc.
 */
function useEventBus() {
  useEffect(() => {
    // Register each store only for events it actually handles.
    // This eliminates unnecessary wake-ups from the old wildcard "*" pattern
    // where every event hit ALL 5 stores even though most stores only handle
    // 1-3 specific events.
    //
    // NOTE: During Step 1 of the manifest migration, both the App.tsx
    // handlers (here) and the per-store self-subscriptions (via
    // `initXxxStoreEvents`) are active.  Once all stores have fully
    // migrated, these handlers will be removed.
    const unregisters: (() => void)[] = [];

    // ── UI Store: sync lifecycle + init ────────────────────────────────
    unregisters.push(
      eventBus.on("sync:started", (payload) => {
        useSyncStore.getState().handleEvent?.("sync:started", payload);
      }),
    );
    unregisters.push(
      eventBus.on("sync:complete", (payload) => {
        useSyncStore.getState().handleEvent?.("sync:complete", payload);
      }),
    );
    unregisters.push(
      eventBus.on("sync:error", (payload) => {
        useSyncStore.getState().handleEvent?.("sync:error", payload);
      }),
    );
    unregisters.push(
      eventBus.on("rust:init:complete", (payload) => {
        useSyncStore.getState().handleEvent?.("rust:init:complete", payload);
      }),
    );

    // ── Thread Store: sync data refresh ────────────────────────────────
    unregisters.push(
      eventBus.on("sync:complete", (payload) => {
        console.warn(
          "[EventBus] sync:complete — store should handle this via manifest",
        );
        useThreadStore.getState().handleEvent?.("sync:complete", payload);
      }),
    );
    unregisters.push(
      eventBus.on("sync:account-complete", (payload) => {
        console.warn(
          "[EventBus] sync:account-complete — store should handle this via manifest",
        );
        useThreadStore.getState().handleEvent?.("sync:account-complete", payload);
      }),
    );
    unregisters.push(
      eventBus.on("sync:account-error", (payload) => {
        console.warn(
          "[EventBus] sync:account-error — store should handle this via manifest",
        );
        useThreadStore.getState().handleEvent?.("sync:account-error", payload);
      }),
    );

    // ── Composer Store: compose window ────────────────────────────────
    unregisters.push(
      eventBus.on("composer:open", (payload) => {
        console.warn(
          "[EventBus] composer:open — store should handle this via manifest",
        );
        useComposerStore.getState().handleEvent?.("composer:open", payload);
      }),
    );

    // ── Notification Store: push notifications ─────────────────────────
    unregisters.push(
      eventBus.on("notification:received", (payload) => {
        console.warn(
          "[EventBus] notification:received — store should handle this via manifest",
        );
        useNotificationStore.getState().handleEvent?.("notification:received", payload);
      }),
    );

    // ── ActionStatus Store: EventBus bridge ────────────────────────────
    unregisters.push(initActionStatusEventBridge());

    // Note: useAccountStore.handleEvent is a no-op, so we skip it entirely.

    eventBus.init();

    return () => {
      unregisters.forEach((unreg) => unreg());
      eventBus.destroy();
    };
  }, []);
}

export default function App() {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showAskInbox, setShowAskInbox] = useState(false);
  const [moveToFolderState, setMoveToFolderState] = useState<{ open: boolean; threadIds: string[] }>({ open: false, threadIds: [] });
  const [showTemplateDemo, setShowTemplateDemo] = useState(false);
  const [showConflictPanel, setShowConflictPanel] = useState(false);
  // Paired device count — conflict button only shows when other devices are paired
  const [deviceCount, setDeviceCount] = useState(0);

  // Core lifecycle hooks (extracted from the old 689-line monolith)
  const conflictCount = useConflictStore((s) =>
    s.conflicts.filter((c) => !c.resolved).length,
  );
  const { initialized, handleAddAccountSuccess } = useAppInit();
  useThemeManager();
  const biometric = useBiometricLock();
  // License store: only need init trigger
  useEffect(() => {
    useLicenseStore.getState().init();
  }, []);
  const syncStatus = useSyncStatus();
  useNetworkStatus();
  useInputModality();
  useRouterSyncBridge();

  // Start attachment pre-cache manager after initialisation
  useEffect(() => {
    import("@features/mail/services/attachments/preCacheManager").then(
      ({ startPreCacheManager }) => startPreCacheManager(),
    );
  }, []);
  useKeyboardShortcuts();
  useTrayCheckMail();
  useShareHandler();
  useSyncEvents();
  usePushNotifications();
  useTaskWorkflowEngine();
  useEventBus();
  useContextMenuSuppression();
  useDevtoolsShortcut();

  // Fetch paired device count for conditional conflict button visibility
  useEffect(() => {
    invokeCommand<{ device_id: string }[]>("get_pairings")
      .then((result) => setDeviceCount(result.length))
      .catch(() => setDeviceCount(0));
  }, []);

  // ── Onboarding: persist & restore progress ─────────────────────────────────
  const [onboardingDone, setOnboardingDone] = useLocalStorage("smemaster.onboarding.done", false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [hasData, setHasData] = useState<boolean | null>(null); // null = loading, true = accounts/demo exist

  // Check if email accounts or demo data already exist — skip onboarding if they do
  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;
    (async () => {
      try {
        const { invokeCommand } = await import("@shared/services/db/invoke/command");
        const hasAccounts = await invokeCommand<boolean>("db_has_email_accounts", {});
        if (!cancelled) {
          if (hasAccounts) {
            setHasData(true);
            setOnboardingDone(true);
          } else {
            // No accounts — check if system was initialized (e.g. demo data seeded)
            const sysInit = await invokeCommand<boolean>("is_system_initialized", {}).catch(() => false);
            if (!cancelled) {
              setHasData(sysInit);
              if (sysInit) setOnboardingDone(true);
            }
          }
        }
      } catch {
        if (!cancelled) setHasData(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialized, setOnboardingDone]);

  // Restore onboarding progress from sessionStorage on tab crash / close
  useEffect(() => {
    if (!onboardingDone && !onboardingDismissed && hasData === false) {
      const savedStep = sessionStorage.getItem("smemaster.onboarding.step");
      if (savedStep) {
        window.dispatchEvent(
          new CustomEvent("smemaster-restore-onboarding", { detail: { step: Number(savedStep) } }),
        );
      }
    }
  }, [onboardingDone, onboardingDismissed, hasData]);

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingDone(true);
    setOnboardingDismissed(true);
    sessionStorage.removeItem("smemaster.onboarding.step");
  }, [setOnboardingDone]);

  const handleOnboardingProgress = useCallback((step: number) => {
    sessionStorage.setItem("smemaster.onboarding.step", String(step));
  }, []);

  // Show onboarding only when truly fresh: no accounts, no demo data, not completed prior
  const showOnboarding =
    !onboardingDone &&
    !onboardingDismissed &&
    initialized &&
    hasData === false &&
    hasData !== null;

  // Listen for command palette / shortcuts help / ask inbox toggle events
  useEffect(() => {
    const togglePalette = () => setShowCommandPalette((p) => !p);
    const toggleHelp = () => setShowShortcutsHelp((p) => !p);
    const toggleAskInbox = () => setShowAskInbox((p) => !p);
    const handleMoveToFolder = (e: Event) => {
      const detail = (e as CustomEvent<{ threadIds: string[] }>).detail;
      setMoveToFolderState({ open: true, threadIds: detail.threadIds });
    };
    const toggleDemo = () => setShowTemplateDemo((p) => !p);
    window.addEventListener("smemaster-toggle-command-palette", togglePalette);
    window.addEventListener("smemaster-toggle-shortcuts-help", toggleHelp);
    window.addEventListener("smemaster-toggle-ask-inbox", toggleAskInbox);
    window.addEventListener("smemaster-move-to-folder", handleMoveToFolder);
    window.addEventListener("smemaster-toggle-template-demo", toggleDemo);
    return () => {
      window.removeEventListener("smemaster-toggle-command-palette", togglePalette);
      window.removeEventListener("smemaster-toggle-shortcuts-help", toggleHelp);
      window.removeEventListener("smemaster-toggle-ask-inbox", toggleAskInbox);
      window.removeEventListener("smemaster-move-to-folder", handleMoveToFolder);
      window.removeEventListener("smemaster-toggle-template-demo", toggleDemo);
    };
  }, []);

  if (!initialized) {
    return (
      <SinglePageLayout centerVertically className="bg-bg-primary">
        <div className="flex flex-col items-center gap-6">
          {/* App wordmark */}
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-accent">SME</span>
            <span className="text-2xl font-bold tracking-tight text-text-primary">Master</span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1" />
          </div>
          <div className="text-xs text-text-tertiary tracking-widest uppercase">
            Your Mail &amp; CRM
          </div>
          {/* Spinner */}
          <div className="relative w-8 h-8 mt-2">
            <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
          </div>
          <span className="text-xs text-text-tertiary animate-pulse">
            Loading your inbox...
          </span>
        </div>
      </SinglePageLayout>
    );
  }

  return (
    <>
      {showOnboarding ? (
        <OnboardingScreen onComplete={handleOnboardingComplete} onProgress={handleOnboardingProgress} />
      ) : (
        <ErrorBoundary name="App">
          <Suspense fallback={<div className="flex h-screen items-center justify-center bg-bg-primary"><span className="text-xs text-text-tertiary">Loading...</span></div>}>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded focus:outline-none focus:ring-2 focus:ring-accent-hover"
            >
              Skip to main content
            </a>
            <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" id="status-announcer" />
            {biometric.isLocked && biometric.isAvailable && (
              <BiometricLockScreen
                error={biometric.error}
                onUnlock={biometric.unlock}
                isLoading={biometric.isLoading}
              />
            )}
            <OfflineIndicator />
            <OfflineQueueIndicator />
            <DndProvider>
              <div id="main-content">
                <MobileShell
                  onAddAccount={() => setShowAddAccount(true)}
                />
              </div>
            </DndProvider>

            {/* Sync status bar */}
            {syncStatus && (
              <div
                className={`fixed bottom-0 left-0 right-0 glass-panel text-white text-xs px-4 py-1.5 text-center z-40 animate-[slideUp_200ms_ease-out,fadeIn_200ms_ease-out] ${
                  syncStatus.startsWith("Sync failed") ? "bg-danger/90" : "bg-accent/90"
                }`}
              >
                {syncStatus}
              </div>
            )}

            {/* Sync conflict trigger button — only visible when other devices are paired */}
            {(conflictCount > 0 || showConflictPanel) && deviceCount > 0 && (
              <button
                onClick={() => setShowConflictPanel((p) => !p)}
                className={`fixed bottom-4 right-4 z-50 flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
                  showConflictPanel
                    ? "bg-accent text-white"
                    : conflictCount > 0
                      ? "bg-danger text-white"
                      : "bg-bg-primary text-text-secondary border border-border-primary"
                }`}
                aria-label={
                  showConflictPanel
                    ? "Close conflict panel"
                    : `Open conflict panel${conflictCount > 0 ? ` (${conflictCount} unresolved)` : ""}`
                }
                title={
                  conflictCount > 0
                    ? `${conflictCount} unresolved conflict${conflictCount > 1 ? "s" : ""}`
                    : "Sync conflicts"
                }
              >
                <GitCompareArrows size={18} />
                {conflictCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-danger rounded-full leading-none">
                    {conflictCount > 9 ? "9+" : conflictCount}
                  </span>
                )}
              </button>
            )}

            {/* Conflict resolution panel */}
            <ConflictResolutionPanel
              isOpen={showConflictPanel}
              onClose={() => setShowConflictPanel(false)}
            />

            {/* Sync progress indicator */}
            <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
              <div className="pointer-events-auto">
                <SyncProgressIndicator />
              </div>
            </div>

            {showAddAccount && (
              <AddAccount
                onClose={() => setShowAddAccount(false)}
                onSuccess={() => {
                  setShowAddAccount(false);
                  handleAddAccountSuccess();
                }}
              />
            )}

            <ErrorBoundary name="Composer">
              <Composer />
            </ErrorBoundary>
            <UndoSendToast />
            <UpdateToast />
            <NotificationToast />
            <ErrorBoundary name="CommandPalette">
              <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
              />
            </ErrorBoundary>
            <ShortcutsHelp
              isOpen={showShortcutsHelp}
              onClose={() => setShowShortcutsHelp(false)}
            />
            <ErrorBoundary name="AskInbox">
              <AskInbox
                isOpen={showAskInbox}
                onClose={() => setShowAskInbox(false)}
              />
            </ErrorBoundary>
            <ContextMenuPortal />
            <MoveToFolderDialog
              isOpen={moveToFolderState.open}
              threadIds={moveToFolderState.threadIds}
              onClose={() => setMoveToFolderState({ open: false, threadIds: [] })}
            />
            {showTemplateDemo && (
              <TemplateDemo
                demo={DEMO_FOLLOW_UP}
                onClose={() => setShowTemplateDemo(false)}
              />
            )}
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}