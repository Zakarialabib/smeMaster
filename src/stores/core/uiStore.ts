import { create } from "zustand";

export type ReadingPanePosition = "right" | "bottom" | "hidden";

export interface SidebarNavItem {
  id: string;
  visible: boolean;
}

/**
 * UIStore — Transient UI state. NOT persisted.
 * Tracks sidebar state, modal visibility, panel dimensions, etc.
 * These values reset on app restart.
 */
interface UIState {
  sidebarCollapsed: boolean;
  contactSidebarVisible: boolean;
  taskSidebarVisible: boolean;
  readingPaneExpanded: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleContactSidebar: () => void;
  setContactSidebarVisible: (visible: boolean) => void;
  toggleTaskSidebar: () => void;
  setTaskSidebarVisible: (visible: boolean) => void;
  setReadingPaneExpanded: (expanded: boolean) => void;
  reset: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  contactSidebarVisible: true,
  taskSidebarVisible: false,
  readingPaneExpanded: false,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleContactSidebar: () => set((state) => ({ contactSidebarVisible: !state.contactSidebarVisible })),
  setContactSidebarVisible: (contactSidebarVisible) => set({ contactSidebarVisible }),
  toggleTaskSidebar: () => set((state) => ({ taskSidebarVisible: !state.taskSidebarVisible })),
  setTaskSidebarVisible: (taskSidebarVisible) => set({ taskSidebarVisible }),
  setReadingPaneExpanded: (readingPaneExpanded) => set({ readingPaneExpanded }),

  reset: () => set({
    sidebarCollapsed: false,
    contactSidebarVisible: true,
    taskSidebarVisible: false,
    readingPaneExpanded: false,
  }),
}));
