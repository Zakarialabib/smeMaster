import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies needed for the hook to mount and dispatch events.
// The hook reads store state and calls navigate/emailActions ��� only mock
// what's needed for the three event-dispatch tests below.
vi.mock("@shared/stores/uiStore", () => ({
  useUIStore: { getState: () => ({ inboxViewMode: "unified", toggleSidebar: vi.fn() }) },
}));
vi.mock("@features/mail/stores/threadStore", () => ({
  useThreadStore: {
    getState: () => ({
      threads: [],
      selectedThreadIds: new Set(),
      removeThread: vi.fn(),
      removeThreads: vi.fn(),
      updateThread: vi.fn(),
      clearMultiSelect: vi.fn(),
      selectAll: vi.fn(),
      selectAllFromHere: vi.fn(),
    }),
  },
}));
vi.mock("@features/mail/stores/composerStore", () => ({
  useComposerStore: { getState: () => ({ isOpen: false, openComposer: vi.fn(), closeComposer: vi.fn() }) },
}));
vi.mock("@features/accounts/stores/accountStore", () => ({
  useAccountStore: { getState: () => ({ activeAccountId: null }) },
}));
vi.mock("@features/settings/stores/shortcutStore", () => ({
  useShortcutStore: {
    getState: () => ({
      keyMap: {
        "app.askInbox": "i",
        "app.commandPalette": "/",
        "app.toggleSidebar": "Ctrl+Shift+E",
        "app.help": "?",
      },
    }),
  },
}));
vi.mock("@features/mail/stores/contextMenuStore", () => ({
  useContextMenuStore: { getState: () => ({ menuType: null, closeMenu: vi.fn() }) },
}));
vi.mock("@/router/navigate", () => ({
  navigateToLabel: vi.fn(),
  navigateToThread: vi.fn(),
  navigateBack: vi.fn(),
  getActiveLabel: () => "inbox",
  getSelectedThreadId: () => null,
}));
vi.mock("@features/mail/services/emailActions", () => ({
  archiveThread: vi.fn(),
  trashThread: vi.fn(),
  permanentDeleteThread: vi.fn(),
  starThread: vi.fn(),
  spamThread: vi.fn(),
}));
vi.mock("@shared/services/db/threads", () => ({
  deleteThread: vi.fn(),
  pinThread: vi.fn(),
  unpinThread: vi.fn(),
  muteThread: vi.fn(),
  unmuteThread: vi.fn(),
}));
vi.mock("@features/mail/services/gmail/draftDeletion", () => ({ deleteDraftsForThread: vi.fn() }));
vi.mock("@features/mail/services/gmail/tokenManager", () => ({ getGmailClient: vi.fn() }));
vi.mock("@shared/services/db/messages", () => ({ getMessagesForThread: vi.fn() }));
vi.mock("@features/mail/components/MessageItem", () => ({ parseUnsubscribeUrl: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@features/mail/services/gmail/syncManager", () => ({ triggerSync: vi.fn() }));

import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { uiBus } from "@shared/services/events/uiBus";

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches toggle:ask-inbox when 'i' is pressed", () => {
    renderHook(() => useKeyboardShortcuts());

    const listener = vi.fn();
    const off = uiBus.on("toggle:ask-inbox", listener);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "i", bubbles: true }),
    );

    expect(listener).toHaveBeenCalledTimes(1);

    off();
  });

  it("dispatches toggle:command-palette when '/' is pressed", () => {
    renderHook(() => useKeyboardShortcuts());

    const listener = vi.fn();
    const off = uiBus.on("toggle:command-palette", listener);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "/", bubbles: true }),
    );

    expect(listener).toHaveBeenCalledTimes(1);

    off();
  });

  it("dispatches toggle:shortcuts-help when '?' is pressed", () => {
    renderHook(() => useKeyboardShortcuts());

    const listener = vi.fn();
    const off = uiBus.on("toggle:shortcuts-help", listener);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "?", shiftKey: true, bubbles: true }),
    );

    expect(listener).toHaveBeenCalledTimes(1);

    off();
  });
});



