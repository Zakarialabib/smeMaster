import { describe, it, expect, beforeEach, vi } from "vitest";
import { useUIStore } from "@/stores/core";

describe("uiStore", () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarCollapsed: false,
      contactSidebarVisible: true,
      taskSidebarVisible: false,
      readingPaneExpanded: false,
    });
  });

  describe("initial state", () => {
    it("should have correct defaults", () => {
      const state = useUIStore.getState();
      expect(state.sidebarCollapsed).toBe(false);
      expect(state.contactSidebarVisible).toBe(true);
      expect(state.taskSidebarVisible).toBe(false);
      expect(state.readingPaneExpanded).toBe(false);
    });
  });

  describe("toggleSidebar", () => {
    it("should toggle sidebar from expanded to collapsed", () => {
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });

    it("should toggle sidebar from collapsed to expanded", () => {
      useUIStore.getState().toggleSidebar();
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe("setSidebarCollapsed", () => {
    it("should set sidebar collapsed directly", () => {
      useUIStore.getState().setSidebarCollapsed(true);
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });

    it("should set sidebar expanded directly", () => {
      useUIStore.getState().setSidebarCollapsed(true);
      useUIStore.getState().setSidebarCollapsed(false);
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe("toggleContactSidebar", () => {
    it("should toggle contact sidebar from visible to hidden", () => {
      useUIStore.getState().toggleContactSidebar();
      expect(useUIStore.getState().contactSidebarVisible).toBe(false);
    });

    it("should toggle contact sidebar from hidden to visible", () => {
      useUIStore.getState().toggleContactSidebar();
      useUIStore.getState().toggleContactSidebar();
      expect(useUIStore.getState().contactSidebarVisible).toBe(true);
    });
  });

  describe("setContactSidebarVisible", () => {
    it("should set contact sidebar visibility", () => {
      useUIStore.getState().setContactSidebarVisible(false);
      expect(useUIStore.getState().contactSidebarVisible).toBe(false);
    });
  });

  describe("toggleTaskSidebar", () => {
    it("should toggle task sidebar from hidden to visible", () => {
      useUIStore.getState().toggleTaskSidebar();
      expect(useUIStore.getState().taskSidebarVisible).toBe(true);
    });

    it("should toggle task sidebar from visible to hidden", () => {
      useUIStore.getState().toggleTaskSidebar();
      useUIStore.getState().toggleTaskSidebar();
      expect(useUIStore.getState().taskSidebarVisible).toBe(false);
    });
  });

  describe("setTaskSidebarVisible", () => {
    it("should set task sidebar visibility", () => {
      useUIStore.getState().setTaskSidebarVisible(true);
      expect(useUIStore.getState().taskSidebarVisible).toBe(true);
    });
  });

  describe("setReadingPaneExpanded", () => {
    it("should expand reading pane", () => {
      useUIStore.getState().setReadingPaneExpanded(true);
      expect(useUIStore.getState().readingPaneExpanded).toBe(true);
    });

    it("should collapse reading pane", () => {
      useUIStore.getState().setReadingPaneExpanded(true);
      useUIStore.getState().setReadingPaneExpanded(false);
      expect(useUIStore.getState().readingPaneExpanded).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset all state to defaults", () => {
      useUIStore.getState().setSidebarCollapsed(true);
      useUIStore.getState().toggleContactSidebar();
      useUIStore.getState().toggleTaskSidebar();
      useUIStore.getState().setReadingPaneExpanded(true);
      useUIStore.getState().reset();
      const state = useUIStore.getState();
      expect(state.sidebarCollapsed).toBe(false);
      expect(state.contactSidebarVisible).toBe(true);
      expect(state.taskSidebarVisible).toBe(false);
      expect(state.readingPaneExpanded).toBe(false);
    });
  });

  describe("state isolation", () => {
    it("should not affect other fields when toggling sidebar", () => {
      useUIStore.getState().toggleSidebar();
      const state = useUIStore.getState();
      expect(state.contactSidebarVisible).toBe(true);
      expect(state.taskSidebarVisible).toBe(false);
      expect(state.readingPaneExpanded).toBe(false);
    });
  });
});
