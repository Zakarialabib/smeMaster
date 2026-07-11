import { useCallback } from "react";
import { useConfigStore } from "@/stores/core";
import { setSetting } from "@features/settings/db/settings";

export type DensityMode = "spacious" | "standard" | "compact";

export interface DensityResult {
  density: DensityMode;
  setDensity: (d: DensityMode) => void;
  spacingClass: "gap-6 p-6" | "gap-4 p-4" | "gap-2 p-2";
}

const SPACING_MAP: Record<DensityMode, DensityResult["spacingClass"]> = {
  spacious: "gap-6 p-6",
  standard: "gap-4 p-4",
  compact: "gap-2 p-2",
};

/**
 * Map from the hook's DensityMode to the store's EmailDensity.
 *
 *   spacious → spacious
 *   standard → default
 *   compact  → compact
 */
const HOOK_TO_STORE: Record<DensityMode, "spacious" | "default" | "compact"> = {
  spacious: "spacious",
  standard: "default",
  compact: "compact",
};

/**
 * Map from the store's EmailDensity back to the hook's DensityMode.
 */
const STORE_TO_HOOK: Record<string, DensityMode> = {
  spacious: "spacious",
  default: "standard",
  compact: "compact",
};

const DEFAULT_DENSITY: DensityMode = "standard";

export function useDensity(): DensityResult {
  const storeDensity = useConfigStore((s) => s.emailDensity);
  const setStoreDensity = useConfigStore((s) => s.setEmailDensity);

  // Map the store value to the hook's density mode; fall back to default if
  // the store returns an unexpected string (e.g. during migration).
  const density = STORE_TO_HOOK[storeDensity] ?? DEFAULT_DENSITY;

  const setDensity = useCallback(
    (d: DensityMode) => {
      const storeValue = HOOK_TO_STORE[d];
      setStoreDensity(storeValue);
      // Persist to the backend via the existing settings pipeline
      setSetting("email_density", storeValue).catch(() => {});
    },
    [setStoreDensity],
  );

  return {
    density,
    setDensity,
    spacingClass: SPACING_MAP[density],
  };
}
