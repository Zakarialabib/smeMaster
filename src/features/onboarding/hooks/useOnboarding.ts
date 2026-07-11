// src/features/onboarding/hooks/useOnboarding.ts
import { useCallback } from "react";
import { invokeCommand } from "@shared/services/db/invoke/command";

export function useOnboarding() {
  const completeOnboarding = useCallback(async (): Promise<void> => {
    try {
      await invokeCommand("complete_onboarding", {});
    } catch {
      // Silently ignore when not in Tauri environment (browser dev mode)
    }
  }, []);

  const isSystemInitialized = useCallback(async (): Promise<boolean> => {
    try {
      return await invokeCommand<boolean>("is_system_initialized", {});
    } catch {
      return false;
    }
  }, []);

  return { completeOnboarding, isSystemInitialized };
}
