import { useState, useEffect, useMemo } from "react";
import { getDeviceInfoBridge } from "@/shared/services/nativeBridges";
import { isTauriEnvironment } from "@/shared/services/ipc";

/**
 * Platform identity from Rust IPC. Matches the Rust `PlatformInfo` struct.
 */
export interface PlatformInfo {
  mobile: boolean;
  desktop: boolean;
  os: string;
  arch: string;
  is_tablet: boolean;
  is_phone: boolean;
}

/**
 * Screen categories based on viewport width (inclusive lower bound):
 * - "phone": < 480px
 * - "phone-folded": 480–768px (foldable folded state or small tablet)
 * - "tablet": 768–1024px
 * - "desktop": > 1024px
 */
export type ScreenCategory = "phone" | "phone-folded" | "tablet" | "desktop";

/**
 * Aspect / posture classification:
 * - "portrait": height/width > 1.5
 * - "landscape": otherwise
 * - "foldable": dual-screen or device-posture: folded
 * - "seamless": dual-screen but currently spanning (not folded)
 */
export type ScreenAspect = "portrait" | "landscape" | "foldable" | "seamless";

export interface ScreenInfo {
  /** Whether the device is considered mobile (phone or phone-folded) */
  isMobile: boolean;
  /** Whether the viewport is desktop-sized (>= 1024px) */
  isDesktop: boolean;
  /** Screen size category */
  category: ScreenCategory;
  /** Aspect ratio / foldable posture classification */
  aspect: ScreenAspect;
  /** Current viewport width in pixels */
  width: number;
  /** Current viewport height in pixels */
  height: number;
  /** Whether the device is a detected foldable */
  isFoldable: boolean;
  /** Computed hinge offset in pixels (0 if no hinge detected) */
  hingeOffset: number;
  /** Visual viewport height (smaller when keyboard is open on mobile) */
  visualHeight: number;
  /** Whether the virtual keyboard is likely shown (visual height < layout height) */
  keyboardOpen: boolean;
}

export interface FullPlatformInfo extends PlatformInfo {
  screen: ScreenInfo;
  /** Screen size class from the native Android bridge (if available). */
  screenSizeClass?: string;
}

// ── Module-level cache ────────────────────────────────────────────────
let cachedPlatform: PlatformInfo | null = null;

/**
 * @internal Test helper to reset the module-level platform cache.
 * Not exported in production builds.
 */
export function __resetPlatformCache(): void {
  cachedPlatform = null;
}

// ── Screen helpers ────────────────────────────────────────────────────

function getScreenCategory(width: number): ScreenCategory {
  if (width < 480) return "phone";
  if (width < 768) return "phone-folded";
  if (width < 1024) return "tablet";
  return "desktop";
}

function getScreenAspect(width: number, height: number, isFoldable: boolean): ScreenAspect {
  if (isFoldable && window.matchMedia("(device-posture: folded)").matches) return "foldable";
  if (isFoldable && (navigator as any).screen?.isDualScreen && window.screen.orientation?.type?.startsWith("landscape")) return "seamless";
  return height / width > 1.5 ? "portrait" : "landscape";
}

function detectFoldable(): { isFoldable: boolean; hingeOffset: number } {
  const nav = navigator as any;
  const isDualScreen = Boolean(nav?.screen?.isDualScreen);
  const isFolded = window.matchMedia("(device-posture: folded)").matches;
  const isFoldable = isDualScreen || isFolded;
  let hingeOffset = 0;
  if (isFoldable) hingeOffset = isFolded ? 48 : 16;
  return { isFoldable, hingeOffset };
}

function computeScreenInfo(): ScreenInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const { isFoldable, hingeOffset } = detectFoldable();
  const vv = window.visualViewport;
  const visualHeight = vv?.height ?? height;
  const keyboardOpen = visualHeight < height * 0.8;
  return {
    isMobile: width < 768,
    isDesktop: width >= 1024,
    category: getScreenCategory(width),
    aspect: getScreenAspect(width, height, isFoldable),
    width, height, isFoldable, hingeOffset,
    visualHeight,
    keyboardOpen,
  };
}

// ── Default fallback ──────────────────────────────────────────────────
const DEFAULT_PLATFORM: PlatformInfo = {
  mobile: false,
  desktop: true,
  os: "web",
  arch: "web",
  is_tablet: false,
  is_phone: false,
};

/**
 * Platform identity used when running outside a Tauri shell (browser dev
 * server / web build). There is no native desktop or mobile backend, so
 * capability flags are reported as false. Layout decisions should use
 * `screen.isDesktop` / `screen.isMobile` (viewport based) instead — those
 * remain accurate. Reporting `desktop: false` here lets capability-gated
 * features (backup scheduler, hardware, native dialogs) skip their backend
 * calls instead of throwing TauriUnavailableError in a dev server.
 */
const WEB_FALLBACK: PlatformInfo = {
  mobile: false,
  desktop: false,
  os: "web",
  arch: "web",
  is_tablet: false,
  is_phone: false,
};

// ── Public API ────────────────────────────────────────────────────────

/**
 * Single authoritative platform + screen info hook.
 *
 * **Platform identity** comes from Rust IPC (cached after first call).
 * Falls back to web-safe defaults when Tauri is not available.
 *
 * **Screen info** is reactive to viewport changes, orientation changes,
 * foldable posture changes, and dual-screen events.
 *
 * @example
 * ```tsx
 * const { mobile, screen } = usePlatform();
 * if (mobile) { /* behavior decisions based on actual hardware *&#47; }
 * if (screen.isMobile) { /* layout decisions based on viewport *&#47; }
 * ```
 */
export function usePlatform(): FullPlatformInfo {
  const [platform, setPlatform] = useState<PlatformInfo>(() => {
    if (cachedPlatform) return cachedPlatform;
    // Outside a Tauri shell there is no native backend — report no platform
    // capability so capability-gated features skip their IPC calls.
    return isTauriEnvironment() ? DEFAULT_PLATFORM : WEB_FALLBACK;
  });
  const [screenInfo, setScreenInfo] = useState<ScreenInfo>(computeScreenInfo);
  const [nativeInfo, setNativeInfo] = useState<{ is_tablet: boolean; screenSizeClass?: string } | null>(null);

  // Fetch platform identity from Rust IPC (once)
  useEffect(() => {
    if (cachedPlatform) return;
    import("@shared/services/db/invoke/command").then(({ invokeCommand }) => {
      invokeCommand<PlatformInfo>("get_platform").then((result) => {
        cachedPlatform = result;
        setPlatform(result);
      }).catch(() => {
        setPlatform(WEB_FALLBACK);
      });
    });
  }, []);

  // Try native DeviceInfoBridge on mount (Android only)
  useEffect(() => {
    const bridge = getDeviceInfoBridge();
    if (bridge) {
      try {
        setNativeInfo({
          is_tablet: bridge.isTablet(),
          screenSizeClass: bridge.getScreenSizeClass(),
        });
      } catch {
        // Bridge methods may throw before the WebView is fully initialized
      }
    }
  }, []);

  // React to viewport / orientation / foldable + keyboard changes
  useEffect(() => {
    const handleChange = () => {
      const info = computeScreenInfo();
      setScreenInfo(info);
      document.documentElement.classList.toggle("mobile", info.isMobile);
      // Toggle class for keyboard-open state so CSS can adjust
      document.documentElement.classList.toggle("keyboard-open", info.keyboardOpen);
    };
    // Sync initial mobile class on <html>
    handleChange();
    window.addEventListener("resize", handleChange);
    window.addEventListener("orientationchange", handleChange);
    const foldMatch = window.matchMedia("(device-posture: folded)");
    foldMatch.addEventListener("change", handleChange);
    const screen = (navigator as any).screen;
    if (screen?.addEventListener) screen.addEventListener("screenchange", handleChange);
    // Track visualViewport for mobile keyboard detection
    window.visualViewport?.addEventListener("resize", handleChange);
    return () => {
      window.removeEventListener("resize", handleChange);
      window.removeEventListener("orientationchange", handleChange);
      foldMatch.removeEventListener("change", handleChange);
      if (screen?.removeEventListener) screen.removeEventListener("screenchange", handleChange);
      window.visualViewport?.removeEventListener("resize", handleChange);
    };
  }, []);

  return useMemo(() => ({
    ...platform,
    is_tablet: nativeInfo?.is_tablet ?? platform.is_tablet,
    screenSizeClass: nativeInfo?.screenSizeClass,
    screen: screenInfo,
  }), [platform, screenInfo, nativeInfo]);
}

/**
 * Viewscreen-only mobile check. Returns `true` when viewport < 768px.
 *
 * **For behavior decisions** (e.g. "is this actually a phone?"),
 * use `platform.mobile` from `usePlatform()` instead.
 *
 * **For layout decisions** (e.g. "render hamburger menu"),
 * this hook (or `screen.isMobile`) is appropriate.
 */
export function useMobile(): boolean {
  const { screen } = usePlatform();
  return screen.isMobile;
}

/**
 * Reactive screen information without platform identity.
 *
 * Prefer `usePlatform()` when you also need Rust-level platform detection.
 * This is a convenience wrapper returning `FullPlatformInfo['screen']`.
 */
export function useScreenInfo(): ScreenInfo {
  const { screen } = usePlatform();
  return screen;
}
