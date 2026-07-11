import { useState, useEffect, useCallback, useRef } from "react";
import { checkStatus, authenticate } from "@tauri-apps/plugin-biometric";
import { listen } from "@tauri-apps/api/event";
import { getSetting } from "@features/settings/db/settings";

export interface BiometricState {
  isAvailable: boolean;
  isLoading: boolean;
  isLocked: boolean;
  error: string | null;
}

export function useBiometricLock() {
  const [state, setState] = useState<BiometricState>({
    isAvailable: false,
    isLoading: true,
    isLocked: false,
    error: null,
  });
  const enabledRef = useRef(false);
  const unlockCleanupRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    async function init() {
      try {
        const setting = await getSetting("biometric_lock_enabled");
        enabledRef.current = setting === "true";
        if (!enabledRef.current) {
          setState({ isAvailable: false, isLoading: false, isLocked: false, error: null });
          return;
        }

        let available = false;
        try {
          const status = await checkStatus();
          available = status.isAvailable;
        } catch {
          const { invokeCommand } = await import("@shared/services/db/invoke/command");
          const result = await invokeCommand<{ is_available: boolean }>("check_biometric");
          available = result.is_available;
        }

        setState((prev) => ({
          ...prev,
          isAvailable: available,
          isLoading: false,
          isLocked: available,
        }));
      } catch (err) {
        setState({ isAvailable: false, isLoading: false, isLocked: false, error: String(err) });
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!enabledRef.current || !state.isAvailable) return;

    let cancelled = false;
    (async () => {
      const unlisten = await listen("tauri://blur", () => {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isLocked: true }));
        }
      });
      if (!cancelled) unlockCleanupRef.current = unlisten;
    })();

    return () => {
      cancelled = true;
      unlockCleanupRef.current?.();
    };
  }, [state.isAvailable]);

  const unlock = useCallback(async () => {
    try {
      await authenticate("Unlock SMEMaster");
      setState((prev) => ({ ...prev, isLocked: false, error: null }));
      return true;
    } catch (err) {
      const msg = String(err);
      if (msg.includes("userCancel") || msg.includes("User canceled")) {
        return false;
      }
      setState((prev) => ({ ...prev, error: msg }));
      return false;
    }
  }, []);

  const lock = useCallback(() => {
    setState((prev) => ({ ...prev, isLocked: true, error: null }));
  }, []);

  return {
    ...state,
    lock,
    unlock,
  };
}

