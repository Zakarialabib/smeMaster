import { describe, it, expect, beforeEach, vi } from "vitest";
import { useLayoutStore } from "./layoutStore";

beforeEach(() => {
  useLayoutStore.setState({
    sidebarCollapsed: false,
    contactSidebarVisible: true,
    readingPanePosition: "right",
    readingPaneExpanded: false,
    readFilter: "all",
    emailListWidth: 320,
    emailDensity: "default",
    defaultReplyMode: "reply",
    markAsReadBehavior: "instant",
    sendAndArchive: false,
    inboxViewMode: "unified",
    taskSidebarVisible: false,
    sidebarNavConfig: null,
    locale: "en",
    textDirection: "ltr",
    aiLanguage: "auto",
  });
});

describe("layoutStore", () => {
  describe("initial state", () => {
    it("should have correct defaults", () => {
      const state = useLayoutStore.getState();
      expect(state.sidebarCollapsed).toBe(false);
      expect(state.contactSidebarVisible).toBe(true);
      expect(state.readingPanePosition).toBe("right");
      expect(state.readingPaneExpanded).toBe(false);
      expect(state.readFilter).toBe("all");
      expect(state.emailListWidth).toBe(320);
      expect(state.emailDensity).toBe("default");
      expect(state.defaultReplyMode).toBe("reply");
      expect(state.markAsReadBehavior).toBe("instant");
      expect(state.sendAndArchive).toBe(false);
      expect(state.inboxViewMode).toBe("unified");
      expect(state.taskSidebarVisible).toBe(false);
      expect(state.sidebarNavConfig).toBeNull();
      expect(state.locale).toBe("en");
      expect(state.textDirection).toBe("ltr");
      expect(state.aiLanguage).toBe("auto");
    });
  });

  describe("toggleSidebar", () => {
    it("should toggle sidebar from expanded to collapsed", () => {
      useLayoutStore.getState().toggleSidebar();
      expect(useLayoutStore.getState().sidebarCollapsed).toBe(true);
    });

    it("should toggle sidebar from collapsed to expanded", () => {
      useLayoutStore.getState().toggleSidebar();
      useLayoutStore.getState().toggleSidebar();
      expect(useLayoutStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe("setSidebarCollapsed", () => {
    it("should set sidebar collapsed directly", () => {
      useLayoutStore.getState().setSidebarCollapsed(true);
      expect(useLayoutStore.getState().sidebarCollapsed).toBe(true);
    });

    it("should set sidebar expanded directly", () => {
      useLayoutStore.getState().setSidebarCollapsed(true);
      useLayoutStore.getState().setSidebarCollapsed(false);
      expect(useLayoutStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe("toggleContactSidebar", () => {
    it("should toggle contact sidebar from visible to hidden", () => {
      useLayoutStore.getState().toggleContactSidebar();
      expect(useLayoutStore.getState().contactSidebarVisible).toBe(false);
    });

    it("should toggle contact sidebar from hidden to visible", () => {
      useLayoutStore.getState().toggleContactSidebar();
      useLayoutStore.getState().toggleContactSidebar();
      expect(useLayoutStore.getState().contactSidebarVisible).toBe(true);
    });
  });

  describe("setContactSidebarVisible", () => {
    it("should set contact sidebar visibility", () => {
      useLayoutStore.getState().setContactSidebarVisible(false);
      expect(useLayoutStore.getState().contactSidebarVisible).toBe(false);
    });
  });

  describe("setReadingPanePosition", () => {
    it("should set position to right", () => {
      useLayoutStore.getState().setReadingPanePosition("right");
      expect(useLayoutStore.getState().readingPanePosition).toBe("right");
    });

    it("should set position to bottom", () => {
      useLayoutStore.getState().setReadingPanePosition("bottom");
      expect(useLayoutStore.getState().readingPanePosition).toBe("bottom");
    });

    it("should set position to hidden", () => {
      useLayoutStore.getState().setReadingPanePosition("hidden");
      expect(useLayoutStore.getState().readingPanePosition).toBe("hidden");
    });
  });

  describe("setReadingPaneExpanded", () => {
    it("should expand reading pane", () => {
      useLayoutStore.getState().setReadingPaneExpanded(true);
      expect(useLayoutStore.getState().readingPaneExpanded).toBe(true);
    });

    it("should collapse reading pane", () => {
      useLayoutStore.getState().setReadingPaneExpanded(true);
      useLayoutStore.getState().setReadingPaneExpanded(false);
      expect(useLayoutStore.getState().readingPaneExpanded).toBe(false);
    });
  });

  describe("setReadFilter", () => {
    it("should set filter to read", () => {
      useLayoutStore.getState().setReadFilter("read");
      expect(useLayoutStore.getState().readFilter).toBe("read");
    });

    it("should set filter to unread", () => {
      useLayoutStore.getState().setReadFilter("unread");
      expect(useLayoutStore.getState().readFilter).toBe("unread");
    });

    it("should set filter back to all", () => {
      useLayoutStore.getState().setReadFilter("unread");
      useLayoutStore.getState().setReadFilter("all");
      expect(useLayoutStore.getState().readFilter).toBe("all");
    });
  });

  describe("setEmailListWidth", () => {
    it("should set email list width", () => {
      useLayoutStore.getState().setEmailListWidth(400);
      expect(useLayoutStore.getState().emailListWidth).toBe(400);
    });

    it("should handle zero width", () => {
      useLayoutStore.getState().setEmailListWidth(0);
      expect(useLayoutStore.getState().emailListWidth).toBe(0);
    });
  });

  describe("setEmailDensity", () => {
    it("should set density to compact", () => {
      useLayoutStore.getState().setEmailDensity("compact");
      expect(useLayoutStore.getState().emailDensity).toBe("compact");
    });

    it("should set density to spacious", () => {
      useLayoutStore.getState().setEmailDensity("spacious");
      expect(useLayoutStore.getState().emailDensity).toBe("spacious");
    });
  });

  describe("setDefaultReplyMode", () => {
    it("should set reply mode to reply", () => {
      useLayoutStore.getState().setDefaultReplyMode("reply");
      expect(useLayoutStore.getState().defaultReplyMode).toBe("reply");
    });

    it("should set reply mode to replyAll", () => {
      useLayoutStore.getState().setDefaultReplyMode("replyAll");
      expect(useLayoutStore.getState().defaultReplyMode).toBe("replyAll");
    });
  });

  describe("setMarkAsReadBehavior", () => {
    it("should set to instant", () => {
      useLayoutStore.getState().setMarkAsReadBehavior("instant");
      expect(useLayoutStore.getState().markAsReadBehavior).toBe("instant");
    });

    it("should set to 2s", () => {
      useLayoutStore.getState().setMarkAsReadBehavior("2s");
      expect(useLayoutStore.getState().markAsReadBehavior).toBe("2s");
    });

    it("should set to manual", () => {
      useLayoutStore.getState().setMarkAsReadBehavior("manual");
      expect(useLayoutStore.getState().markAsReadBehavior).toBe("manual");
    });
  });

  describe("setSendAndArchive", () => {
    it("should enable send and archive", () => {
      useLayoutStore.getState().setSendAndArchive(true);
      expect(useLayoutStore.getState().sendAndArchive).toBe(true);
    });

    it("should disable send and archive", () => {
      useLayoutStore.getState().setSendAndArchive(true);
      useLayoutStore.getState().setSendAndArchive(false);
      expect(useLayoutStore.getState().sendAndArchive).toBe(false);
    });
  });

  describe("setInboxViewMode", () => {
    it("should set to unified", () => {
      useLayoutStore.getState().setInboxViewMode("unified");
      expect(useLayoutStore.getState().inboxViewMode).toBe("unified");
    });

    it("should set to split", () => {
      useLayoutStore.getState().setInboxViewMode("split");
      expect(useLayoutStore.getState().inboxViewMode).toBe("split");
    });
  });

  describe("toggleTaskSidebar", () => {
    it("should toggle task sidebar from hidden to visible", () => {
      useLayoutStore.getState().toggleTaskSidebar();
      expect(useLayoutStore.getState().taskSidebarVisible).toBe(true);
    });

    it("should toggle task sidebar from visible to hidden", () => {
      useLayoutStore.getState().toggleTaskSidebar();
      useLayoutStore.getState().toggleTaskSidebar();
      expect(useLayoutStore.getState().taskSidebarVisible).toBe(false);
    });
  });

  describe("setTaskSidebarVisible", () => {
    it("should set task sidebar visibility", () => {
      useLayoutStore.getState().setTaskSidebarVisible(true);
      expect(useLayoutStore.getState().taskSidebarVisible).toBe(true);
    });
  });

  describe("setLocale", () => {
    it("should set locale and text direction for ltr locale", () => {
      useLayoutStore.getState().setLocale("fr");
      const state = useLayoutStore.getState();
      expect(state.locale).toBe("fr");
      expect(state.textDirection).toBe("ltr");
    });

    it("should set locale and text direction for rtl locale", () => {
      useLayoutStore.getState().setLocale("ar");
      const state = useLayoutStore.getState();
      expect(state.locale).toBe("ar");
      expect(state.textDirection).toBe("rtl");
    });

    it("should set locale for ja", () => {
      useLayoutStore.getState().setLocale("ja");
      const state = useLayoutStore.getState();
      expect(state.locale).toBe("ja");
      expect(state.textDirection).toBe("ltr");
    });
  });

  describe("setAiLanguage", () => {
    it("should set AI language", () => {
      useLayoutStore.getState().setAiLanguage("en");
      expect(useLayoutStore.getState().aiLanguage).toBe("en");
    });

    it("should set AI language to auto", () => {
      useLayoutStore.getState().setAiLanguage("fr");
      useLayoutStore.getState().setAiLanguage("auto");
      expect(useLayoutStore.getState().aiLanguage).toBe("auto");
    });
  });

  describe("setSidebarNavConfig", () => {
    it("should set sidebar nav config", () => {
      const config = [
        { id: "inbox", visible: true },
        { id: "sent", visible: false },
      ];
      useLayoutStore.getState().setSidebarNavConfig(config);
      expect(useLayoutStore.getState().sidebarNavConfig).toEqual(config);
    });

    it("should replace existing config", () => {
      const config1 = [{ id: "inbox", visible: true }];
      const config2 = [{ id: "sent", visible: false }];
      useLayoutStore.getState().setSidebarNavConfig(config1);
      useLayoutStore.getState().setSidebarNavConfig(config2);
      expect(useLayoutStore.getState().sidebarNavConfig).toEqual(config2);
    });
  });

  describe("restoreSidebarNavConfig", () => {
    it("should restore sidebar nav config", () => {
      const config = [{ id: "inbox", visible: true }];
      useLayoutStore.getState().restoreSidebarNavConfig(config);
      expect(useLayoutStore.getState().sidebarNavConfig).toEqual(config);
    });
  });

  describe("state isolation", () => {
    it("should not affect other fields when toggling sidebar", () => {
      useLayoutStore.getState().toggleSidebar();
      const state = useLayoutStore.getState();
      expect(state.contactSidebarVisible).toBe(true);
      expect(state.readingPanePosition).toBe("right");
      expect(state.locale).toBe("en");
    });
  });
});
