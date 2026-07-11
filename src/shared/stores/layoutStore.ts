/**
 * Layout & Settings Store — extracted from the monolithic uiStore.
 *
 * Pure state store: no side effects (no setSetting calls).
 * Side effects are handled by the consumer (useAppInit.ts, etc.).
 *
 * Migration: useLayoutStore(s => s.sidebarCollapsed) instead of useUIStore(s => s.sidebarCollapsed)
 */
import { create } from "zustand";
import type { SupportedLocale } from "@/locales";
import { LOCALE_DIRS } from "@/locales";

export type ReadingPanePosition = "right" | "bottom" | "hidden";
export type ReadFilter = "all" | "read" | "unread";
export type EmailDensity = "compact" | "default" | "spacious";
export type AppDensity = "comfortable" | "compact";
export type DefaultReplyMode = "reply" | "replyAll";
export type MarkAsReadBehavior = "instant" | "2s" | "manual";
export type InboxViewMode = "unified" | "split";
export type ViewMode = "list" | "kanban" | "calendar" | "agenda";

export interface SidebarNavItem {
  id: string;
  visible: boolean;
}

interface LayoutState {
  sidebarCollapsed: boolean;
  contactSidebarVisible: boolean;
  /** App-level UI density: 'comfortable' (default) or 'compact' (dense rows/padding/fonts) */
  density: AppDensity;
  setDensity: (density: AppDensity) => void;
  readingPanePosition: ReadingPanePosition;
  readingPaneExpanded: boolean;
  readFilter: ReadFilter;
  emailListWidth: number;
  emailDensity: EmailDensity;
  defaultReplyMode: DefaultReplyMode;
  markAsReadBehavior: MarkAsReadBehavior;
  sendAndArchive: boolean;
  inboxViewMode: InboxViewMode;
  taskSidebarVisible: boolean;
  sidebarNavConfig: SidebarNavItem[] | null;
  locale: SupportedLocale;
  textDirection: "ltr" | "rtl";
  /** @deprecated Will be removed in a future refactor. Use aiLanguage from a dedicated AI settings store. */
  aiLanguage: string;
  /** View mode for tasks and emails (list/kanban/calendar/agenda) */
  viewMode: ViewMode;

  setLocale: (locale: SupportedLocale) => void;
  setAiLanguage: (lang: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleContactSidebar: () => void;
  setContactSidebarVisible: (visible: boolean) => void;
  setReadingPanePosition: (position: ReadingPanePosition) => void;
  setReadingPaneExpanded: (expanded: boolean) => void;
  setReadFilter: (filter: ReadFilter) => void;
  setEmailListWidth: (width: number) => void;
  setEmailDensity: (density: EmailDensity) => void;
  setDefaultReplyMode: (mode: DefaultReplyMode) => void;
  setMarkAsReadBehavior: (behavior: MarkAsReadBehavior) => void;
  setSendAndArchive: (enabled: boolean) => void;
  setInboxViewMode: (mode: InboxViewMode) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleTaskSidebar: () => void;
  setTaskSidebarVisible: (visible: boolean) => void;
  setSidebarNavConfig: (config: SidebarNavItem[]) => void;
  restoreSidebarNavConfig: (config: SidebarNavItem[]) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarCollapsed: false,
  contactSidebarVisible: false,
  density: "comfortable",
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
  viewMode: "list",

  setLocale: (locale) => {
    const textDirection = LOCALE_DIRS[locale];
    set({ locale, textDirection });
  },
  setAiLanguage: (aiLanguage) => set({ aiLanguage }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  toggleContactSidebar: () =>
    set((state) => ({ contactSidebarVisible: !state.contactSidebarVisible })),

  setContactSidebarVisible: (contactSidebarVisible) =>
    set({ contactSidebarVisible }),

  setDensity: (density) => set({ density }),

  setReadingPanePosition: (readingPanePosition) =>
    set({ readingPanePosition }),

  setReadingPaneExpanded: (readingPaneExpanded) =>
    set({ readingPaneExpanded }),

  setReadFilter: (readFilter) => set({ readFilter }),

  setEmailListWidth: (emailListWidth) => set({ emailListWidth }),

  setEmailDensity: (emailDensity) => set({ emailDensity }),

  setDefaultReplyMode: (defaultReplyMode) => set({ defaultReplyMode }),

  setMarkAsReadBehavior: (markAsReadBehavior) => set({ markAsReadBehavior }),

  setSendAndArchive: (sendAndArchive) => set({ sendAndArchive }),

  setInboxViewMode: (inboxViewMode) => set({ inboxViewMode }),

  setViewMode: (viewMode) => set({ viewMode }),

  toggleTaskSidebar: () =>
    set((state) => ({ taskSidebarVisible: !state.taskSidebarVisible })),

  setTaskSidebarVisible: (taskSidebarVisible) => set({ taskSidebarVisible }),

  setSidebarNavConfig: (sidebarNavConfig) => set({ sidebarNavConfig }),

  restoreSidebarNavConfig: (sidebarNavConfig) => set({ sidebarNavConfig }),
}));
