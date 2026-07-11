/**
 * @deprecated Import from `@shared/hooks/usePlatform` directly.
 * This file is kept for backward compatibility.
 *
 * ```ts
 * // Old:
 * import { useMobile, useScreenInfo } from "@shared/hooks/useMobile";
 * // New (still works via re-export):
 * import { useMobile, useScreenInfo } from "@shared/hooks/usePlatform";
 * ```
 */
export { useMobile, useScreenInfo } from "./usePlatform";
export type { ScreenInfo, ScreenCategory, ScreenAspect } from "./usePlatform";
