import { useEffect, useState } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

const QUERIES = {
  mobile: "(max-width: 767px)",
  tablet: "(min-width: 768px) and (max-width: 1023px)",
  desktop: "(min-width: 1024px)",
} as const;

/**
 * Unified breakpoint hook.
 *
 * Breakpoint audit (2026-07-05):
 * - src/features/contacts/hooks/useBreakpoint.ts: 639px mobile threshold in useViewPrefs
 * - src/shared/hooks/usePlatform.ts: 768px mobile threshold (ScreenInfo), 4 categories
 * - This hook provides the 3-category standard used by CSS and layout components
 * - usePlatform.ts is the source of truth for ScreenInfo (phone/phone-folded/tablet/desktop)
 * - This hook provides the 3-way Breakpoint for layout decisions
 *
 * Use useBreakpoint() for layout rendering decisions.
 * Use usePlatform().screen for detailed screen category queries.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === "undefined") return "desktop";
    if (window.matchMedia(QUERIES.mobile).matches) return "mobile";
    if (window.matchMedia(QUERIES.tablet).matches) return "tablet";
    return "desktop";
  });

  useEffect(() => {
    const mqls = Object.entries(QUERIES).map(([key, query]) => {
      const mql = window.matchMedia(query);
      const handler = (e: MediaQueryListEvent) => {
        if (e.matches) setBp(key as Breakpoint);
      };
      mql.addEventListener("change", handler);
      return { mql, handler };
    });
    return () => {
      mqls.forEach(({ mql, handler }) =>
        mql.removeEventListener("change", handler),
      );
    };
  }, []);

  return bp;
}

/**
 * Hook that returns true when the viewport prefers grid layout (tablet or mobile).
 */
export function usePrefersGridView(): boolean {
  const bp = useBreakpoint();
  return bp === "tablet" || bp === "mobile";
}