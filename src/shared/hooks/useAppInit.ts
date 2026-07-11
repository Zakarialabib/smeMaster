import { useEffect, useState } from "react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useSyncStore } from "@shared/stores/syncStore";
import { triggerSync } from "@features/mail/services/gmail/syncManager";
import { triggerQueueFlush } from "@features/mail/services/queue/queueProcessor";

import { getSplashBridge, isAndroid } from "@shared/services/nativeBridges";
import { startNativeEventForwarder } from "@shared/services/nativeEventForwarder";
import { useI18nLocale } from "./init/useI18nLocale";
import { useSettingsRestorer } from "./init/useSettingsRestorer";
import { useKeyMapLoader } from "./init/useKeyMapLoader";
import { useAccountsAndClients } from "./init/useAccountsAndClients";
import { useSeedOnFirstRun } from "./init/useSeedOnFirstRun";
import { useBackgroundServices } from "./init/useBackgroundServices";
import { useSystemIntegrations } from "./init/useSystemIntegrations";

/**
 * Hook: handles full app initialization lifecycle.
 *
 * Decomposed from a 413-line god hook into 7 focused sub-hooks
 * in `src/shared/hooks/init/`. This file is a thin composer that:
 *
 * 1. Calls each init hook in the correct phase order
 * 2. Runs independent system listeners (network status, Rust events)
 * 3. Exposes `{ initialized, handleAddAccountSuccess }` for App.tsx
 *
 * Returns:
 * - `initialized`: whether the init sequence has completed
 * - `handleAddAccountSuccess`: callback for when a new account is added
 */
export function useAppInit() {
  const [initialized, setInitialized] = useState(false);

  // ── Phase 2: i18n locale restoration ─────────────────────────────
  useI18nLocale();

  // ── Phase 3: Batch-restore all persisted settings ────────────────
  useSettingsRestorer();

  // ── Phase 4: Load custom keyboard shortcuts ──────────────────────
  useKeyMapLoader();

  // ── Phases 5 & 7: Accounts, clients, send-as aliases ─────────────
  const accounts = useAccountsAndClients();

  // ── Phases 6a & 6b: Seed demo data on first run ──────────────────
  useSeedOnFirstRun(accounts.accounts);

  // ── Phase 8: Background services (Rust-owned) ────────────────────
  useBackgroundServices();

  // ── Phases 9, 10, 11: System integrations ────────────────────────
  useSystemIntegrations();

  // ── Phase 0: Rust orchestrator init listener (non-blocking) ──────
  useEffect(() => {
    import("@tauri-apps/api/event")
      .then(({ listen }) => {
        listen("rust:init:complete", () => {
          console.log("[init] Rust orchestrator init complete");
        }).catch(() => {
          /* event system unavailable */
        });
      })
      .catch(() => {
        /* tauri event api unavailable */
      });
  }, []);

  // ── Signal ready after the first render (all hooks fire their own
  //    async init in effects, so they do not block the commit phase) ─
  useEffect(() => {
    setInitialized(true);

    // Start Rust→Kotlin event relay
    startNativeEventForwarder();

    // Safety net: dismiss native splash screen on mobile (Android only).
    // The native bridges below are injected exclusively on Android, so their
    // presence is a reliable synchronous Android check — on desktop we skip
    // the Android-only `close_splashscreen` IPC call (it doesn't exist there).
    if (isAndroid()) {
      import("@shared/services/db/invoke/command").then(({ invokeCommand }) => {
        invokeCommand("close_splashscreen").catch(() => {
          // Silently fail - this is just a safety net
        });
      });
    }
    // Also notify the Kotlin SplashBridge directly (faster path)
    try {
      getSplashBridge()?.onAppReady();
    } catch {
      // SplashBridge not available (desktop or non-Tauri), ignore
    }
  }, []);

  // ── Network status + online reconnect handler ────────────────────
  useEffect(() => {
    const { setOnline } = useSyncStore.getState();
    setOnline(navigator.onLine);

    const handleOnline = () => {
      setOnline(true);
      triggerQueueFlush();
      const activeIds = useAccountStore
        .getState()
        .accounts.filter((a) => a.isActive)
        .map((a) => a.id);
      if (activeIds.length > 0) triggerSync(activeIds);
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    initialized,
    handleAddAccountSuccess: accounts.refresh,
  };
}