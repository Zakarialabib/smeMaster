import { useEffect } from "react";
import { useConfigStore, useUIStore } from "@/stores/core";
import { getAllSettings } from "@features/settings/db/settings";
import { initConfigPersistence } from "@shared/services/settings/configPersistence";
import { COLOR_THEMES } from "@/constants/themes";
import type { ColorThemeId } from "@/constants/themes";
import type {
  ThemeMode,
  FontScale,
  ReadingPanePosition,
  ReadFilter,
  EmailDensity,
  DefaultReplyMode,
  MarkAsReadBehavior,
  InboxViewMode,
  SidebarNavItem,
} from "@/stores/core";
import { withRetry } from "./_utils";

/**
 * Phase 3: Restore all persisted user settings from the SQLite settings
 * table in a single batched read and apply them to Zustand stores.
 *
 * Replaces 16+ individual `getSetting` IPC round-trips with one
 * `getAllSettings()` call that returns a `Record<string, string>`.
 */
export function useSettingsRestorer(): void {
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const all = await withRetry<Record<string, string>>(
        "getAllSettings",
        () => getAllSettings(),
        {},
      );
      if (cancelled || !all) return;

      const config = useConfigStore.getState();
      const ui = useUIStore.getState();

      // Theme
      const theme = all.theme;
      if (theme === "light" || theme === "dark" || theme === "system") {
        config.setTheme(theme as ThemeMode);
      }

      // Sidebar collapsed
      if (all.sidebar_collapsed === "true") {
        ui.setSidebarCollapsed(true);
      }

      // Contact sidebar
      if (all.contact_sidebar_visible === "false") {
        ui.setContactSidebarVisible(false);
      }

      // Reading pane position
      const panePos = all.reading_pane_position;
      if (panePos === "right" || panePos === "bottom" || panePos === "hidden") {
        config.setReadingPanePosition(panePos as ReadingPanePosition);
      }

      // Read filter
      const readFilter = all.read_filter;
      if (readFilter === "all" || readFilter === "read" || readFilter === "unread") {
        config.setReadFilter(readFilter as ReadFilter);
      }

      // Email list width
      const listWidth = all.email_list_width;
      if (listWidth) {
        const w = parseInt(listWidth, 10);
        if (w >= 240 && w <= 800) config.setEmailListWidth(w);
      }

      // Email density
      const density = all.email_density;
      if (density === "compact" || density === "default" || density === "spacious") {
        config.setEmailDensity(density as EmailDensity);
      }

      // Default reply mode
      const replyMode = all.default_reply_mode;
      if (replyMode === "reply" || replyMode === "replyAll") {
        config.setDefaultReplyMode(replyMode as DefaultReplyMode);
      }

      // Mark-as-read behavior
      const markRead = all.mark_as_read_behavior;
      if (markRead === "instant" || markRead === "2s" || markRead === "manual") {
        config.setMarkAsReadBehavior(markRead as MarkAsReadBehavior);
      }

      // Send and archive
      if (all.send_and_archive === "true") {
        config.setSendAndArchive(true);
      }

      // Font scale
      const fontScale = all.font_size;
      if (fontScale === "small" || fontScale === "default" || fontScale === "large" || fontScale === "xlarge") {
        config.setFontScale(fontScale as FontScale);
      }

      // Color theme
      const colorTheme = all.color_theme;
      if (colorTheme && COLOR_THEMES.some((t) => t.id === colorTheme)) {
        config.setColorTheme(colorTheme as ColorThemeId);
      }

      // Inbox view mode
      const viewMode = all.inbox_view_mode;
      if (viewMode === "unified" || viewMode === "split") {
        config.setInboxViewMode(viewMode as InboxViewMode);
      }

      // Reduce motion
      if (all.reduce_motion === "true") {
        config.setReduceMotion(true);
      }

      // Task sidebar
      if (all.task_sidebar_visible === "true") {
        ui.setTaskSidebarVisible(true);
      }

      // Sidebar nav config
      const navConfig = all.sidebar_nav_config;
      if (navConfig) {
        try {
          const parsed = JSON.parse(navConfig) as SidebarNavItem[];
          if (Array.isArray(parsed)) config.restoreSidebarNavConfig(parsed);
        } catch {
          /* ignore malformed JSON */
        }
      }
    }

    restore();

    // Subscribe to future configStore changes and sync to SQLite.
    // This ensures settings survive page refresh even if the plugin
    // store falls back to ephemeral localStorage.
    initConfigPersistence();

    return () => {
      cancelled = true;
    };
  }, []);
}