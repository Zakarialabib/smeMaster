/**
 * Backward-compatible re-export of the unified theme store.
 *
 * New code should import from `@/shared/theme/themeStore` directly.
 */
export { useThemeStore } from "@/shared/theme/themeStore";
export type {
  ThemePreference,
  ThemeMode,
  FontScale,
  ColorThemeId,
} from "@/shared/theme/themeStore";
