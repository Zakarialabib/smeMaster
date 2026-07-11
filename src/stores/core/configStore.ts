import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ColorThemeId } from "@/constants/themes";
import type { SupportedLocale } from "@/locales";
import { LOCALE_DIRS } from "@/locales";
import { tauriStoreStorage } from "@shared/services/storage/tauriStoreStorage";

export type ThemeMode = "light" | "dark" | "system";
export type FontScale = "small" | "default" | "large" | "xlarge";
export type ReadingPanePosition = "right" | "bottom" | "hidden";
export type ReadFilter = "all" | "read" | "unread";
export type EmailDensity = "compact" | "default" | "spacious";
export type DefaultReplyMode = "reply" | "replyAll";
export type MarkAsReadBehavior = "instant" | "2s" | "manual";
export type InboxViewMode = "unified" | "split";

export interface SidebarNavItem {
  id: string;
  visible: boolean;
}

/**
 * ConfigStore — Persisted application configuration.
 * Theme, layout preferences, locale, and advanced mode toggle.
 * Uses zustand persist middleware backed by the Tauri store plugin.
 */
interface ConfigState {
  // Theme
  theme: ThemeMode;
  colorTheme: ColorThemeId;
  fontScale: FontScale;
  reduceMotion: boolean;
  highContrast: boolean;

  // Layout preferences (persistent)
  readingPanePosition: ReadingPanePosition;
  readFilter: ReadFilter;
  emailListWidth: number;
  emailDensity: EmailDensity;
  defaultReplyMode: DefaultReplyMode;
  markAsReadBehavior: MarkAsReadBehavior;
  sendAndArchive: boolean;
  inboxViewMode: InboxViewMode;
  sidebarNavConfig: SidebarNavItem[] | null;

  // Locale
  locale: SupportedLocale;
  textDirection: "ltr" | "rtl";
  aiLanguage: string;

  // Advanced mode
  advancedMode: boolean;

  // Hydration
  isHydrated: boolean;

  // Actions
  setTheme: (theme: ThemeMode) => void;
  setColorTheme: (theme: ColorThemeId) => void;
  setFontScale: (scale: FontScale) => void;
  setReduceMotion: (reduce: boolean) => void;
  setHighContrast: (highContrast: boolean) => void;
  setReadingPanePosition: (position: ReadingPanePosition) => void;
  setReadFilter: (filter: ReadFilter) => void;
  setEmailListWidth: (width: number) => void;
  setEmailDensity: (density: EmailDensity) => void;
  setDefaultReplyMode: (mode: DefaultReplyMode) => void;
  setMarkAsReadBehavior: (behavior: MarkAsReadBehavior) => void;
  setSendAndArchive: (enabled: boolean) => void;
  setInboxViewMode: (mode: InboxViewMode) => void;
  setSidebarNavConfig: (config: SidebarNavItem[]) => void;
  restoreSidebarNavConfig: (config: SidebarNavItem[]) => void;
  setLocale: (locale: SupportedLocale) => void;
  setAiLanguage: (lang: string) => void;
  setAdvancedMode: (val: boolean) => void;

  // Hydration
  hydrate: () => Promise<void>;
  dehydrate: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      // Theme defaults
      theme: "system",
      colorTheme: "indigo" as ColorThemeId,
      fontScale: "default",
      reduceMotion: false,
      highContrast: false,

      // Layout defaults
      readingPanePosition: "right" as ReadingPanePosition,
      readFilter: "all" as ReadFilter,
      emailListWidth: 320,
      emailDensity: "default" as EmailDensity,
      defaultReplyMode: "reply" as DefaultReplyMode,
      markAsReadBehavior: "instant" as MarkAsReadBehavior,
      sendAndArchive: false,
      inboxViewMode: "unified" as InboxViewMode,
      sidebarNavConfig: null,

      // Locale defaults
      locale: "en" as SupportedLocale,
      textDirection: "ltr",
      aiLanguage: "auto",

      // Advanced mode
      advancedMode: false,

      isHydrated: false,

      // Theme actions
      setTheme: (theme) => set({ theme }),
      setColorTheme: (colorTheme) => set({ colorTheme }),
      setFontScale: (fontScale) => set({ fontScale }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setHighContrast: (highContrast) => set({ highContrast }),

      // Layout actions
      setReadingPanePosition: (readingPanePosition) => set({ readingPanePosition }),
      setReadFilter: (readFilter) => set({ readFilter }),
      setEmailListWidth: (emailListWidth) => set({ emailListWidth }),
      setEmailDensity: (emailDensity) => set({ emailDensity }),
      setDefaultReplyMode: (defaultReplyMode) => set({ defaultReplyMode }),
      setMarkAsReadBehavior: (markAsReadBehavior) => set({ markAsReadBehavior }),
      setSendAndArchive: (sendAndArchive) => set({ sendAndArchive }),
      setInboxViewMode: (inboxViewMode) => set({ inboxViewMode }),
      setSidebarNavConfig: (sidebarNavConfig) => set({ sidebarNavConfig }),
      restoreSidebarNavConfig: (sidebarNavConfig) => set({ sidebarNavConfig }),

      // Locale actions
      setLocale: (locale) => {
        const textDirection = LOCALE_DIRS[locale] ?? "ltr";
        set({ locale, textDirection });
      },
      setAiLanguage: (aiLanguage) => set({ aiLanguage }),

      // Advanced mode
      setAdvancedMode: (advancedMode) => set({ advancedMode }),

      // Hydration — load from SQLite settings table, override persisted defaults
      hydrate: async () => {
        try {
          const { getSetting } = await import("@features/settings/db/settings");
          const { COLOR_THEMES } = await import("@/constants/themes");
          
          const savedTheme = await getSetting("theme");
          if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
            set({ theme: savedTheme });
          }

          const savedFontScale = await getSetting("font_size");
          if (savedFontScale === "small" || savedFontScale === "default" || savedFontScale === "large" || savedFontScale === "xlarge") {
            set({ fontScale: savedFontScale });
          }

          const savedColorTheme = await getSetting("color_theme");
          if (savedColorTheme && COLOR_THEMES.some((t: { id: string }) => t.id === savedColorTheme)) {
            set({ colorTheme: savedColorTheme as ColorThemeId });
          }

          const savedReduceMotion = await getSetting("reduce_motion");
          if (savedReduceMotion === "true") set({ reduceMotion: true });

          const savedHighContrast = await getSetting("high_contrast");
          if (savedHighContrast === "true") set({ highContrast: true });

          const savedPanePos = await getSetting("reading_pane_position");
          if (savedPanePos === "right" || savedPanePos === "bottom" || savedPanePos === "hidden") {
            set({ readingPanePosition: savedPanePos });
          }

          const savedReadFilter = await getSetting("read_filter");
          if (savedReadFilter === "all" || savedReadFilter === "read" || savedReadFilter === "unread") {
            set({ readFilter: savedReadFilter });
          }

          const savedListWidth = await getSetting("email_list_width");
          if (savedListWidth) {
            const w = parseInt(savedListWidth, 10);
            if (w >= 240 && w <= 800) set({ emailListWidth: w });
          }

          const savedDensity = await getSetting("email_density");
          if (savedDensity === "compact" || savedDensity === "default" || savedDensity === "spacious") {
            set({ emailDensity: savedDensity });
          }

          const savedReplyMode = await getSetting("default_reply_mode");
          if (savedReplyMode === "reply" || savedReplyMode === "replyAll") {
            set({ defaultReplyMode: savedReplyMode });
          }

          const savedMarkRead = await getSetting("mark_as_read_behavior");
          if (savedMarkRead === "instant" || savedMarkRead === "2s" || savedMarkRead === "manual") {
            set({ markAsReadBehavior: savedMarkRead });
          }

          const savedSendArchive = await getSetting("send_and_archive");
          if (savedSendArchive === "true") set({ sendAndArchive: true });

          const savedViewMode = await getSetting("inbox_view_mode");
          if (savedViewMode === "unified" || savedViewMode === "split") {
            set({ inboxViewMode: savedViewMode });
          }

          const savedNavConfig = await getSetting("sidebar_nav_config");
          if (savedNavConfig) {
            try {
              const parsed = JSON.parse(savedNavConfig);
              if (Array.isArray(parsed)) set({ sidebarNavConfig: parsed });
            } catch { /* ignore */ }
          }

          const savedLocale = await getSetting("locale");
          if (savedLocale) {
            const textDirection = LOCALE_DIRS[savedLocale as SupportedLocale] ?? "ltr";
            set({ locale: savedLocale as SupportedLocale, textDirection });
          }

          const savedAiLang = await getSetting("ai_language");
          if (savedAiLang) set({ aiLanguage: savedAiLang });

          const savedAdvanced = await getSetting("advanced_settings_mode");
          if (savedAdvanced === "true") set({ advancedMode: true });
        } catch (e) {
          console.warn("[configStore] Hydration failed, using defaults:", e);
        } finally {
          set({ isHydrated: true });
        }
      },

      dehydrate: async () => {
        // Persist is handled by zustand persist middleware
        // This is a no-op since we use the persist middleware for local state
      },
    }),
    {
      name: "smemaster.config",
      storage: createJSONStorage(() => tauriStoreStorage),
      partialize: (state) => ({
        theme: state.theme,
        colorTheme: state.colorTheme,
        fontScale: state.fontScale,
        reduceMotion: state.reduceMotion,
        highContrast: state.highContrast,
        readingPanePosition: state.readingPanePosition,
        readFilter: state.readFilter,
        emailListWidth: state.emailListWidth,
        emailDensity: state.emailDensity,
        defaultReplyMode: state.defaultReplyMode,
        markAsReadBehavior: state.markAsReadBehavior,
        sendAndArchive: state.sendAndArchive,
        inboxViewMode: state.inboxViewMode,
        sidebarNavConfig: state.sidebarNavConfig,
        locale: state.locale,
        textDirection: state.textDirection,
        aiLanguage: state.aiLanguage,
        advancedMode: state.advancedMode,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    }
  )
);
