/**
 * DensityContext — global UI density provider.
 *
 * Applies CSS custom properties on <html> based on the current density mode
 * from layoutStore. Also provides a convenience hook for component-level class
 * overrides.
 *
 * Density modes:
 *   'comfortable' (default) — standard spacing, padding, and font sizes
 *   'compact'               — tighter rows, smaller padding, smaller fonts
 */
import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { useLayoutStore, type AppDensity } from "@shared/stores/layoutStore";
import { setSetting } from "@features/settings/db/settings";

// ─── CSS custom property values ────────────────────────────────────────────

export interface DensityTokens {
  /** Row height in px */
  rowHeight: number;
  /** Horizontal/vertical padding in px */
  padding: number;
  /** Font size tailwind class */
  fontSize: "text-sm" | "text-xs";
  /** Row padding tailwind class */
  rowPadding: string;
}

const TOKENS: Record<AppDensity, DensityTokens> = {
  comfortable: {
    rowHeight: 48,
    padding: 16,
    fontSize: "text-sm",
    rowPadding: "py-3 px-4",
  },
  compact: {
    rowHeight: 32,
    padding: 8,
    fontSize: "text-xs",
    rowPadding: "py-2 px-2",
  },
};

// ─── Context ───────────────────────────────────────────────────────────────

interface DensityContextValue {
  density: AppDensity;
  setDensity: (d: AppDensity) => void;
  tokens: DensityTokens;
}

const DensityCtx = createContext<DensityContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────

interface DensityProviderProps {
  children: ReactNode;
}

export function DensityProvider({ children }: DensityProviderProps) {
  const density = useLayoutStore((s) => s.density);
  const setDensity = useLayoutStore((s) => s.setDensity);

  // Apply CSS custom properties on <html>
  useEffect(() => {
    const root = document.documentElement;
    const t = TOKENS[density];

    root.style.setProperty("--density-row-height", `${t.rowHeight}px`);
    root.style.setProperty("--density-padding", `${t.padding}px`);

    // Set a data attribute for descendant selectors
    root.dataset.density = density;

    // Persist to backend settings
    setSetting("app_density", density).catch(() => {});
  }, [density]);

  // Also run once on mount to restore from any pre-set value
  useEffect(() => {
    const root = document.documentElement;
    const t = TOKENS[density];
    root.style.setProperty("--density-row-height", `${t.rowHeight}px`);
    root.style.setProperty("--density-padding", `${t.padding}px`);
    root.dataset.density = density;
  }, [density]);

  return (
    <DensityCtx.Provider value={{ density, setDensity, tokens: TOKENS[density] }}>
      {children}
    </DensityCtx.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useDensityContext(): DensityContextValue {
  const ctx = useContext(DensityCtx);
  if (!ctx) {
    throw new Error("useDensityContext must be used within a DensityProvider");
  }
  return ctx;
}

/**
 * Returns the CSS class string for the current density mode on a row element.
 */
export function useDensityClasses(): DensityTokens {
  const ctx = useContext(DensityCtx);
  if (!ctx) {
    // Fallback: read directly from the store if no provider
    const density = useLayoutStore.getState().density;
    return TOKENS[density];
  }
  return ctx.tokens;
}
