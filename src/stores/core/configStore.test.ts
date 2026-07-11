import { describe, it, expect, beforeEach, vi } from "vitest";
import { useConfigStore } from "@/stores/core";
import type { ThemeMode, FontScale, ReadingPanePosition, ReadFilter, EmailDensity } from "@/stores/core";

vi.mock("@features/settings/db/settings", () => ({
  getSetting: vi.fn(),
}));

vi.mock("@/constants/themes", () => ({
  COLOR_THEMES: [{ id: "indigo" }, { id: "rose" }, { id: "blue" }],
}));

import { getSetting } from "@features/settings/db/settings";

const mockGetSetting = vi.mocked(getSetting);

beforeEach(() => {
  useConfigStore.setState({
    theme: "system",
    colorTheme: "indigo",
    fontScale: "default",
    reduceMotion: false,
    readingPanePosition: "right",
    readFilter: "all",
    emailListWidth: 320,
    emailDensity: "default",
    defaultReplyMode: "reply",
    markAsReadBehavior: "instant",
    sendAndArchive: false,
    inboxViewMode: "unified",
    sidebarNavConfig: null,
    locale: "en",
    textDirection: "ltr",
    aiLanguage: "auto",
    advancedMode: false,
    isHydrated: false,
  });
  vi.clearAllMocks();
});

describe("configStore", () => {
  describe("initial state", () => {
    it("should have correct default values", () => {
      const state = useConfigStore.getState();
      expect(state.theme).toBe("system");
      expect(state.colorTheme).toBe("indigo");
      expect(state.fontScale).toBe("default");
      expect(state.reduceMotion).toBe(false);
      expect(state.readingPanePosition).toBe("right");
      expect(state.readFilter).toBe("all");
      expect(state.emailListWidth).toBe(320);
      expect(state.emailDensity).toBe("default");
      expect(state.defaultReplyMode).toBe("reply");
      expect(state.markAsReadBehavior).toBe("instant");
      expect(state.sendAndArchive).toBe(false);
      expect(state.inboxViewMode).toBe("unified");
      expect(state.sidebarNavConfig).toBeNull();
      expect(state.locale).toBe("en");
      expect(state.textDirection).toBe("ltr");
      expect(state.aiLanguage).toBe("auto");
      expect(state.advancedMode).toBe(false);
      expect(state.isHydrated).toBe(false);
    });
  });

  describe("setTheme", () => {
    it("should set theme to light", () => {
      useConfigStore.getState().setTheme("light");
      expect(useConfigStore.getState().theme).toBe("light");
    });

    it("should set theme to dark", () => {
      useConfigStore.getState().setTheme("dark");
      expect(useConfigStore.getState().theme).toBe("dark");
    });

    it("should set theme to system", () => {
      useConfigStore.getState().setTheme("dark");
      useConfigStore.getState().setTheme("system");
      expect(useConfigStore.getState().theme).toBe("system");
    });
  });

  describe("setColorTheme", () => {
    it("should set color theme", () => {
      useConfigStore.getState().setColorTheme("rose");
      expect(useConfigStore.getState().colorTheme).toBe("rose");
    });
  });

  describe("setFontScale", () => {
    it("should set font scale to small", () => {
      useConfigStore.getState().setFontScale("small");
      expect(useConfigStore.getState().fontScale).toBe("small");
    });

    it("should set font scale to large", () => {
      useConfigStore.getState().setFontScale("large");
      expect(useConfigStore.getState().fontScale).toBe("large");
    });

    it("should set font scale to xlarge", () => {
      useConfigStore.getState().setFontScale("xlarge");
      expect(useConfigStore.getState().fontScale).toBe("xlarge");
    });
  });

  describe("setReduceMotion", () => {
    it("should enable reduce motion", () => {
      useConfigStore.getState().setReduceMotion(true);
      expect(useConfigStore.getState().reduceMotion).toBe(true);
    });

    it("should disable reduce motion", () => {
      useConfigStore.getState().setReduceMotion(true);
      useConfigStore.getState().setReduceMotion(false);
      expect(useConfigStore.getState().reduceMotion).toBe(false);
    });
  });

  describe("setReadingPanePosition", () => {
    it("should set reading pane position to bottom", () => {
      useConfigStore.getState().setReadingPanePosition("bottom");
      expect(useConfigStore.getState().readingPanePosition).toBe("bottom");
    });

    it("should set reading pane position to hidden", () => {
      useConfigStore.getState().setReadingPanePosition("hidden");
      expect(useConfigStore.getState().readingPanePosition).toBe("hidden");
    });
  });

  describe("setReadFilter", () => {
    it("should set read filter to unread", () => {
      useConfigStore.getState().setReadFilter("unread");
      expect(useConfigStore.getState().readFilter).toBe("unread");
    });

    it("should set read filter to read", () => {
      useConfigStore.getState().setReadFilter("read");
      expect(useConfigStore.getState().readFilter).toBe("read");
    });
  });

  describe("setEmailListWidth", () => {
    it("should set email list width", () => {
      useConfigStore.getState().setEmailListWidth(400);
      expect(useConfigStore.getState().emailListWidth).toBe(400);
    });

    it("should update email list width to a different value", () => {
      useConfigStore.getState().setEmailListWidth(600);
      expect(useConfigStore.getState().emailListWidth).toBe(600);
    });
  });

  describe("setEmailDensity", () => {
    it("should set email density to compact", () => {
      useConfigStore.getState().setEmailDensity("compact");
      expect(useConfigStore.getState().emailDensity).toBe("compact");
    });

    it("should set email density to spacious", () => {
      useConfigStore.getState().setEmailDensity("spacious");
      expect(useConfigStore.getState().emailDensity).toBe("spacious");
    });
  });

  describe("setDefaultReplyMode", () => {
    it("should set default reply mode to replyAll", () => {
      useConfigStore.getState().setDefaultReplyMode("replyAll");
      expect(useConfigStore.getState().defaultReplyMode).toBe("replyAll");
    });
  });

  describe("setMarkAsReadBehavior", () => {
    it("should set mark as read behavior to 2s", () => {
      useConfigStore.getState().setMarkAsReadBehavior("2s");
      expect(useConfigStore.getState().markAsReadBehavior).toBe("2s");
    });

    it("should set mark as read behavior to manual", () => {
      useConfigStore.getState().setMarkAsReadBehavior("manual");
      expect(useConfigStore.getState().markAsReadBehavior).toBe("manual");
    });
  });

  describe("setSendAndArchive", () => {
    it("should enable send and archive", () => {
      useConfigStore.getState().setSendAndArchive(true);
      expect(useConfigStore.getState().sendAndArchive).toBe(true);
    });

    it("should disable send and archive", () => {
      useConfigStore.getState().setSendAndArchive(true);
      useConfigStore.getState().setSendAndArchive(false);
      expect(useConfigStore.getState().sendAndArchive).toBe(false);
    });
  });

  describe("setInboxViewMode", () => {
    it("should set inbox view mode to split", () => {
      useConfigStore.getState().setInboxViewMode("split");
      expect(useConfigStore.getState().inboxViewMode).toBe("split");
    });
  });

  describe("setSidebarNavConfig", () => {
    it("should set sidebar nav config", () => {
      const config = [{ id: "inbox", visible: true }, { id: "sent", visible: false }];
      useConfigStore.getState().setSidebarNavConfig(config);
      expect(useConfigStore.getState().sidebarNavConfig).toEqual(config);
    });
  });

  describe("restoreSidebarNavConfig", () => {
    it("should restore sidebar nav config", () => {
      const config = [{ id: "inbox", visible: true }];
      useConfigStore.getState().restoreSidebarNavConfig(config);
      expect(useConfigStore.getState().sidebarNavConfig).toEqual(config);
    });
  });

  describe("setLocale", () => {
    it("should set locale", () => {
      useConfigStore.getState().setLocale("en");
      expect(useConfigStore.getState().locale).toBe("en");
      expect(useConfigStore.getState().textDirection).toBe("ltr");
    });
  });

  describe("setAiLanguage", () => {
    it("should set AI language", () => {
      useConfigStore.getState().setAiLanguage("en");
      expect(useConfigStore.getState().aiLanguage).toBe("en");
    });

    it("should update AI language", () => {
      useConfigStore.getState().setAiLanguage("fr");
      expect(useConfigStore.getState().aiLanguage).toBe("fr");
    });
  });

  describe("setAdvancedMode", () => {
    it("should enable advanced mode", () => {
      useConfigStore.getState().setAdvancedMode(true);
      expect(useConfigStore.getState().advancedMode).toBe(true);
    });

    it("should disable advanced mode", () => {
      useConfigStore.getState().setAdvancedMode(true);
      useConfigStore.getState().setAdvancedMode(false);
      expect(useConfigStore.getState().advancedMode).toBe(false);
    });
  });

  describe("state isolation", () => {
    it("should not affect other fields when setting theme", () => {
      useConfigStore.getState().setTheme("dark");
      const state = useConfigStore.getState();
      expect(state.colorTheme).toBe("indigo");
      expect(state.fontScale).toBe("default");
      expect(state.readingPanePosition).toBe("right");
      expect(state.locale).toBe("en");
      expect(state.advancedMode).toBe(false);
    });

    it("should not affect other fields when setting advanced mode", () => {
      useConfigStore.getState().setAdvancedMode(true);
      const state = useConfigStore.getState();
      expect(state.theme).toBe("system");
      expect(state.colorTheme).toBe("indigo");
      expect(state.fontScale).toBe("default");
      expect(state.reduceMotion).toBe(false);
      expect(state.emailDensity).toBe("default");
      expect(state.locale).toBe("en");
    });

    it("should not affect other fields when changing layout", () => {
      useConfigStore.getState().setReadingPanePosition("hidden");
      useConfigStore.getState().setEmailListWidth(500);
      const state = useConfigStore.getState();
      expect(state.theme).toBe("system");
      expect(state.fontScale).toBe("default");
      expect(state.advancedMode).toBe(false);
      expect(state.locale).toBe("en");
    });
  });

  describe("hydrate", () => {
    it("should load settings and update state", async () => {
      mockGetSetting.mockImplementation(async (key: string) => {
        const settings: Record<string, string> = {
          theme: "dark",
          font_size: "large",
          color_theme: "rose",
          reduce_motion: "true",
          reading_pane_position: "bottom",
          read_filter: "unread",
          email_list_width: "500",
          email_density: "compact",
          default_reply_mode: "replyAll",
          mark_as_read_behavior: "2s",
          send_and_archive: "true",
          inbox_view_mode: "split",
          sidebar_nav_config: '[{"id":"inbox","visible":true}]',
          locale: "en",
          ai_language: "en",
          advanced_settings_mode: "true",
        };
        return settings[key] ?? null;
      });

      await useConfigStore.getState().hydrate();

      const state = useConfigStore.getState();
      expect(state.theme).toBe("dark");
      expect(state.fontScale).toBe("large");
      expect(state.colorTheme).toBe("rose");
      expect(state.reduceMotion).toBe(true);
      expect(state.readingPanePosition).toBe("bottom");
      expect(state.readFilter).toBe("unread");
      expect(state.emailListWidth).toBe(500);
      expect(state.emailDensity).toBe("compact");
      expect(state.defaultReplyMode).toBe("replyAll");
      expect(state.markAsReadBehavior).toBe("2s");
      expect(state.sendAndArchive).toBe(true);
      expect(state.inboxViewMode).toBe("split");
      expect(state.sidebarNavConfig).toEqual([{ id: "inbox", visible: true }]);
      expect(state.aiLanguage).toBe("en");
      expect(state.advancedMode).toBe(true);
      expect(state.isHydrated).toBe(true);
    });

    it("should keep defaults when settings return null", async () => {
      mockGetSetting.mockResolvedValue(null);

      await useConfigStore.getState().hydrate();

      const state = useConfigStore.getState();
      expect(state.theme).toBe("system");
      expect(state.fontScale).toBe("default");
      expect(state.colorTheme).toBe("indigo");
      expect(state.reduceMotion).toBe(false);
      expect(state.readingPanePosition).toBe("right");
      expect(state.readFilter).toBe("all");
      expect(state.emailListWidth).toBe(320);
      expect(state.emailDensity).toBe("default");
      expect(state.isHydrated).toBe(true);
    });

    it("should handle invalid email list width", async () => {
      mockGetSetting.mockImplementation(async (key: string) => {
        if (key === "email_list_width") return "100";
        return null;
      });

      await useConfigStore.getState().hydrate();

      expect(useConfigStore.getState().emailListWidth).toBe(320);
    });

    it("should handle JSON parse error in sidebar nav config", async () => {
      mockGetSetting.mockImplementation(async (key: string) => {
        if (key === "sidebar_nav_config") return "invalid json";
        return null;
      });

      await useConfigStore.getState().hydrate();

      expect(useConfigStore.getState().sidebarNavConfig).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      mockGetSetting.mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await useConfigStore.getState().hydrate();

      expect(consoleSpy).toHaveBeenCalled();
      expect(useConfigStore.getState().isHydrated).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  describe("dehydrate", () => {
    it("should be a no-op", async () => {
      useConfigStore.getState().setAdvancedMode(true);
      await useConfigStore.getState().dehydrate();
      expect(useConfigStore.getState().advancedMode).toBe(true);
    });
  });

  describe("persist middleware", () => {
    it("should exclude isHydrated from persisted state", () => {
      const state = useConfigStore.getState();
      const partialize = (s: typeof state) => ({
        theme: s.theme,
        colorTheme: s.colorTheme,
        fontScale: s.fontScale,
        reduceMotion: s.reduceMotion,
        readingPanePosition: s.readingPanePosition,
        readFilter: s.readFilter,
        emailListWidth: s.emailListWidth,
        emailDensity: s.emailDensity,
        defaultReplyMode: s.defaultReplyMode,
        markAsReadBehavior: s.markAsReadBehavior,
        sendAndArchive: s.sendAndArchive,
        inboxViewMode: s.inboxViewMode,
        sidebarNavConfig: s.sidebarNavConfig,
        locale: s.locale,
        textDirection: s.textDirection,
        aiLanguage: s.aiLanguage,
        advancedMode: s.advancedMode,
      });

      const persisted = partialize(state);
      expect(persisted).not.toHaveProperty("isHydrated");
      expect(persisted.theme).toBe("system");
      expect(persisted.advancedMode).toBe(false);
    });

    it("should include all config fields in partialize output", () => {
      const state = useConfigStore.getState();
      const partialize = (s: typeof state) => ({
        theme: s.theme,
        colorTheme: s.colorTheme,
        fontScale: s.fontScale,
        reduceMotion: s.reduceMotion,
        readingPanePosition: s.readingPanePosition,
        readFilter: s.readFilter,
        emailListWidth: s.emailListWidth,
        emailDensity: s.emailDensity,
        defaultReplyMode: s.defaultReplyMode,
        markAsReadBehavior: s.markAsReadBehavior,
        sendAndArchive: s.sendAndArchive,
        inboxViewMode: s.inboxViewMode,
        sidebarNavConfig: s.sidebarNavConfig,
        locale: s.locale,
        textDirection: s.textDirection,
        aiLanguage: s.aiLanguage,
        advancedMode: s.advancedMode,
      });

      const persisted = partialize(state);
      const expectedKeys = [
        "theme", "colorTheme", "fontScale", "reduceMotion",
        "readingPanePosition", "readFilter", "emailListWidth", "emailDensity",
        "defaultReplyMode", "markAsReadBehavior", "sendAndArchive", "inboxViewMode",
        "sidebarNavConfig", "locale", "textDirection", "aiLanguage", "advancedMode",
      ];
      expect(Object.keys(persisted).sort()).toEqual([...expectedKeys].sort());
    });
  });
});
