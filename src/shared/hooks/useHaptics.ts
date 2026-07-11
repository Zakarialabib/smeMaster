import { useCallback } from "react";
import { usePlatform } from "@shared/hooks/usePlatform";
import { getHapticsBridge } from "@shared/services/nativeBridges";
import type { HapticIntensity } from "@/types/native-bridges";

export type HapticType = "light" | "medium" | "heavy" | "success" | "error";

/**
 * Standalone haptic helper — works outside React components.
 *
 * Tries the Android native bridge (`window.HapticsBridge`) first for
 * stronger vibration, then falls back to `navigator.vibrate()`.
 * On desktop or unsupported devices, calls are silently ignored.
 *
 * "success" and "error" map to patterned sequences for richer feedback.
 *
 * @example
 * ```ts
 * import { triggerHaptic } from "@shared/hooks/useHaptics";
 * triggerHaptic("heavy");   // after swipe action
 * triggerHaptic("success"); // success confirmation
 * ```
 */
export function triggerHaptic(type: HapticType): void {
  try {
    const bridge = getHapticsBridge();
    if (bridge?.performHaptic) {
      // Only simple intensities are sent to the native bridge;
      // patterns ("success" / "error") fall through to navigator.vibrate()
      const simpleTypes: HapticIntensity[] = ["light", "medium", "heavy"];
      if (simpleTypes.includes(type as HapticIntensity)) {
        bridge.performHaptic(type as HapticIntensity);
        return;
      }
    }
    // WebView fallback vibration patterns
    switch (type) {
      case "light":
        navigator.vibrate?.(10);
        break;
      case "medium":
        navigator.vibrate?.(25);
        break;
      case "heavy":
        navigator.vibrate?.(50);
        break;
      case "success":
        navigator.vibrate?.([15, 50, 15]);
        break;
      case "error":
        navigator.vibrate?.([40, 30, 40]);
        break;
    }
  } catch {
    /* mobile only — silently ignore */
  }
}

/**
 * React hook providing haptic feedback on mobile devices.
 * Tries the Android native bridge (`window.HapticsBridge`) first for
 * stronger vibration, then falls back to `navigator.vibrate()`.
 * On desktop or unsupported devices, calls are silently ignored.
 *
 * @example
 * ```tsx
 * const haptics = useHaptics();
 * haptics.light();  // subtle tap
 * haptics.medium(); // medium pulse
 * haptics.heavy();  // firm thud
 * haptics.success(); // success pattern
 * haptics.error();   // error pattern
 * ```
 */
export function useHaptics() {
  const { mobile: isMobile } = usePlatform();

  const performHaptic = useCallback(
    (type: HapticType) => {
      if (!isMobile) return;
      triggerHaptic(type);
    },
    [isMobile],
  );

  const light = useCallback(() => performHaptic("light"), [performHaptic]);
  const medium = useCallback(() => performHaptic("medium"), [performHaptic]);
  const heavy = useCallback(() => performHaptic("heavy"), [performHaptic]);
  const success = useCallback(() => performHaptic("success"), [performHaptic]);
  const error = useCallback(() => performHaptic("error"), [performHaptic]);

  return { light, medium, heavy, success, error, performHaptic };
}
