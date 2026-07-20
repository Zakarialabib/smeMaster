/**
 * Shared UI utility class patterns.
 *
 * Central source of truth for consistent styling across all UI components.
 * Every component in src/shared/components/ui/ should reference these
 * instead of using ad‑hoc Tailwind classes.
 *
 * Design principles:
 * - Border radius: rounded-md (6px) for controls, rounded-lg (8px) for containers
 * - Focus: ring-1 ring-accent + settings-focus-ring for keyboard nav
 * - Borders: border-border-primary for containers, border-border-secondary for internals
 * - Bg: bg-bg-secondary for cards, bg-bg-tertiary for inputs
 */

/* ─── Focus ring (matches .settings-focus-ring in globals.css) ─── */
export const FOCUS_RING = "focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent settings-focus-ring";

/* ─── Input base (text fields, selects, textareas) ─── */
export const INPUT_BASE = `w-full glass-input text-text-primary text-sm px-3 py-1.5 rounded-md ${FOCUS_RING} placeholder:text-text-tertiary`;

/* ─── Button base ─── */
export const BTN_BASE = "inline-flex items-center justify-center font-medium rounded-[--radius] transition-colors active:scale-[0.97] active:transition-transform disabled:opacity-50 disabled:cursor-not-allowed settings-focus-ring";
export const BTN_PRIMARY = "text-white bg-accent hover:bg-accent-hover";
export const BTN_SECONDARY = "text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border-primary";
export const BTN_GHOST = "text-text-tertiary hover:text-text-primary hover:bg-bg-hover";
export const BTN_DANGER = "text-white bg-danger hover:bg-red-700";
export const BTN_GLASS = "text-text-primary bg-white/20 dark:bg-white/5 backdrop-blur-[12px] border border-white/30 dark:border-white/10 hover:bg-white/30 dark:hover:bg-white/10 hover:border-white/50 dark:hover:border-white/20 transition-all duration-200";
export const BTN_GLASS_PRIMARY = "text-white bg-accent/20 dark:bg-accent/15 backdrop-blur-[12px] border border-accent/30 hover:bg-accent/30 hover:border-accent/50 active:bg-accent/40 transition-all duration-200";
export const BTN_GLASS_DANGER = "text-danger bg-danger/10 dark:bg-danger/10 backdrop-blur-[12px] border border-danger/20 hover:bg-danger/20 hover:border-danger/40 active:bg-danger/30 transition-all duration-200";
export const BTN_GLASS_ICON = "inline-flex items-center justify-center w-7 h-7 rounded-[--radius-sm] text-text-secondary hover:text-text-primary hover:bg-white/20 dark:hover:bg-white/10 backdrop-blur-[8px] border border-transparent hover:border-white/30 dark:hover:border-white/10 transition-all duration-150";

/* ─── Flex row patterns ─── */
export const ROW_BETWEEN = "flex items-center justify-between";
export const ROW_GAP_1 = "flex items-center gap-1";
export const ROW_GAP_2 = "flex items-center gap-2";
export const ROW_GAP_3 = "flex items-center gap-3";
export const ROW_GAP_4 = "flex items-center gap-4";

/* ─── Panel header ─── */
export const PANEL_HEADER = "px-4 py-3 border-b border-border-primary";

/* ─── Card / panel surfaces ─── */
export const CARD_BASE = "frost-surface rounded-[--radius-lg] p-6";
export const CARD_SURFACE = "frost-surface rounded-[--radius-lg]";
export const CARD_HOVER = "hover:border-accent/25 transition-all";

export const GLASS_SURFACE = "frost-surface";
export const GLASS_SURFACE_ELEVATED = "frost-surface-strong";

/* ─── Condensed elevation (border-based depth) ─── */
export const ELEVATION_SM = "shadow-[var(--elevation-sm)]";
export const ELEVATION_MD = "shadow-[var(--elevation-md)]";
export const ELEVATION_LG = "shadow-[var(--elevation-lg)]";

/* ─── Contextual Intelligence rail ─── */
export const INSIGHT_RAIL =
  "bg-[var(--insight-bg)] border border-[var(--insight-border)] rounded-[var(--insight-radius)]";
export const INSIGHT_CARD =
  "bg-[var(--color-ai-subtle)] border border-ai/20 rounded-[--radius-lg] p-4";

/* ─── Modal / dialog ─── */
export const MODAL_BACKDROP = "fixed inset-0 bg-black/20 backdrop-blur-md";
export const MODAL_PANEL = "relative bg-bg-primary/90 backdrop-blur-[--glass-blur-heavy] border border-border-primary border-t-2 border-t-accent rounded-[--frost-radius]";
export const MODAL_PANEL_LIQUID = "relative liquid-glass-elevated bg-bg-primary/60 rounded-[--frost-radius]";
export const MODAL_HEADER = "px-5 py-3.5 border-b border-border-primary";
export const MODAL_BODY = "p-5";
export const MODAL_CLOSE_BTN = "absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors backdrop-blur-sm bg-white/10";

/* ─── Context menu ─── */
export const MENU_BASE = "glass-dropdown rounded-lg py-1 min-w-[200px] z-[100]";
export const MENU_ITEM = "flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors";
export const MENU_SEPARATOR = "my-1 border-t border-border-secondary";

/* ─── Help education card (matches .education-block pattern) ─── */
export const EDU_BLOCK = "bg-accent/5 border border-accent/12 rounded-[10px] p-4";
export const EDU_WARNING = "border-warning/20 bg-warning/[0.04]";

/* ─── Animations (keyframes defined in globals.css) ─── */
export const ANIM_SLIDE_IN_RIGHT = "animate-[slideInRight_250ms_cubic-bezier(0.16,1,0.3,1)]";
export const ANIM_SLIDE_UP = "animate-[slideUp_250ms_cubic-bezier(0.16,1,0.3,1)]";
export const ANIM_FADE_IN = "animate-[fadeIn_150ms_ease-out]";
export const ANIM_SLIDE_DOWN = "animate-slide-down";
export const ANIM_PULSE = "animate-pulse";

/* ─── Empty state ─── */
export const EMPTY_STATE = "flex flex-col items-center justify-center h-full text-text-tertiary px-4";
export const EMPTY_ICON = "opacity-40 mb-3";
export const EMPTY_ILLUSTRATION = "opacity-80 mb-4";

/* ─── Text hints ─── */
export const TEXT_HINT = "text-xs text-text-tertiary";

/* ─── Badge / tag pills ─── */
export const BADGE_BASE = "inline-flex items-center px-2 py-0.5 text-[0.625rem] font-medium rounded-full";
export const BADGE_ACCENT = "bg-accent/15 text-accent";
export const BADGE_AI = "bg-ai/15 text-ai";
export const BADGE_SUCCESS = "bg-success/15 text-success";
export const BADGE_WARNING = "bg-warning/15 text-warning";
export const BADGE_DANGER = "bg-danger/15 text-danger";

/* ─── Tooltip ─── */
export const TOOLTIP_BASE = "absolute z-50 max-w-[260px] px-2.5 py-1.5 rounded-lg bg-bg-primary border border-border-primary text-text-secondary text-[0.6875rem] leading-relaxed shadow-lg pointer-events-none";

/* ─── Spacing system ─── */
export const SPACING_SCALE = {
  "1": "4px",
  "2": "8px",
  "3": "12px",
  "4": "16px",
  "5": "20px",
  "6": "24px",
  "8": "32px",
  "10": "40px",
  "12": "48px",
  "16": "64px",
};

/* ─── Icon sizing system ─── */
export const ICON_SIZE = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;
export type IconSize = keyof typeof ICON_SIZE;

/* ─── Desktop superapp density ─── */
export const DESKTOP_DENSITY = {
  compact: 32,
  normal: 40,
  relaxed: 48,
} as const;
export type DesktopDensity = keyof typeof DESKTOP_DENSITY;

/* ─── Component spacing (margins between sections, content blocks) ─── */
export const SPACE_SECTION = "mb-4"; // 16px margin below sections
export const SPACE_ITEM = "mb-2"; // 8px margin below items
export const SPACE_TIGHT = "mb-1"; // 4px margin for tight spacing
export const SPACE_RELAXED = "mb-6"; // 24px margin for relaxed spacing

/* ─── Tab and panel spacing ─── */
export const TAB_CONTAINER = "flex flex-col gap-3 p-4 sm:p-5 md:p-6";
export const TAB_SECTION = "space-y-4";
export const TAB_ROW = "flex items-center justify-between gap-3 py-2";

/* ─── Settings-specific spacing ─── */
export const SETTING_GROUP_SPACING = "mb-6";
export const SETTING_ROW_SPACING = "py-2.5 mb-4";
export const SETTING_LABEL = "block text-sm font-medium text-text-primary mb-1.5";
export const SETTING_DESCRIPTION = "text-xs text-text-tertiary mt-1";

/* ─── Settings redesign tokens (Phase 1 / 2026-07-08) ─── */
export const SETTINGS_PANEL = "max-w-7xl p-5";
export const SETTINGS_SIDEBAR_WIDTH = "w-[200px]";
export const SETTINGS_SIDEBAR_COLLAPSED = "w-[48px]";
export const SETTINGS_SECTION_GAP = "mb-6";
export const SETTINGS_ROW_MIN_H = "min-h-[44px]";
export const SETTINGS_ROW_GAP = "gap-4";
export const SETTINGS_CARD_PADDING = "p-4";

/* ─── Settings variant tokens ─── */
export const SETTINGS_DANGER_BG = "bg-danger/5 border-danger/15";
export const SETTINGS_COMPACT_BG = ""; // plain, no bg

