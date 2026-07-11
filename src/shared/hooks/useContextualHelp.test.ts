import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useContextualHelp } from "./useContextualHelp";

// ── Mock localStorage for jsdom ──────────────────────────────────────────
function createMockStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = String(value); }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
}

const mockStorage = createMockStorage();
Object.defineProperty(globalThis, "localStorage", { value: mockStorage, writable: true });

// ── Mock the constants module ────────────────────────────────────────────
const mockEntry = (key: string) => {
  const map: Record<string, { summary: string; description: string; tips?: string[]; learnMoreHref?: string }> = {
    "smart-folders": {
      summary: "Smart Folders are saved searches",
      description: "Smart Folders work like saved search filters.",
      tips: ["Use quotes for exact phrase matching"],
      learnMoreHref: "/help/smart-folders",
    },
    "split-inbox": {
      summary: "Split inbox separates mail into Category tabs",
      description: "Your inbox is divided into category tabs.",
    },
    "bundle-rules": {
      summary: "Bundles group related emails",
      description: "Bundle rules let you group related emails.",
      tips: ["Create rules based on subject patterns"],
    },
  };
  return map[key];
};

vi.mock("@/constants/contextualHelp", () => ({
  getContextualHelp: vi.fn((key: string) => mockEntry(key) ?? undefined),
  getContextualHelpKeys: vi.fn(() => ["smart-folders", "split-inbox", "bundle-rules"]),
}));

describe("useContextualHelp", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ─── Initial state ───────────────────────────────────────────────────

  it("returns all keys via getContextualHelpKeys (derived)", () => {
    const { result } = renderHook(() => useContextualHelp());
    // The hook uses getContextualHelpKeys internally to compute unseenKeys
    expect(result.current.unseenKeys.sort()).toEqual([
      "bundle-rules",
      "smart-folders",
      "split-inbox",
    ]);
  });

  it("starts with activeKey as null", () => {
    const { result } = renderHook(() => useContextualHelp());
    expect(result.current.activeKey).toBeNull();
  });

  it("starts with activeEntry as null", () => {
    const { result } = renderHook(() => useContextualHelp());
    expect(result.current.activeEntry).toBeNull();
  });

  it("starts with empty dismissedKeys set", () => {
    const { result } = renderHook(() => useContextualHelp());
    expect(result.current.dismissedKeys.size).toBe(0);
  });

  // ─── openHelp ────────────────────────────────────────────────────────

  it("sets activeKey when openHelp is called", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.openHelp("smart-folders");
    });

    expect(result.current.activeKey).toBe("smart-folders");
  });

  it("sets activeEntry when openHelp is called with valid key", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.openHelp("smart-folders");
    });

    expect(result.current.activeEntry).toEqual({
      summary: "Smart Folders are saved searches",
      description: "Smart Folders work like saved search filters.",
      tips: ["Use quotes for exact phrase matching"],
      learnMoreHref: "/help/smart-folders",
    });
  });

  it("marks key as seen when openHelp is called", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.openHelp("smart-folders");
    });

    expect(result.current.unseenKeys).not.toContain("smart-folders");
  });

  it("persists seen key to localStorage on openHelp", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.openHelp("smart-folders");
    });

    const stored = JSON.parse(localStorage.getItem("smemaster.contextualHelp.seen") || "[]");
    expect(stored).toContain("smart-folders");
  });

  // ─── closeHelp ───────────────────────────────────────────────────────

  it("clears activeKey when closeHelp is called", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.openHelp("smart-folders");
    });
    expect(result.current.activeKey).toBe("smart-folders");

    act(() => {
      result.current.closeHelp();
    });
    expect(result.current.activeKey).toBeNull();
    expect(result.current.activeEntry).toBeNull();
  });

  // ─── dismissKey ──────────────────────────────────────────────────────

  it("adds key to dismissedKeys on dismissKey", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.dismissKey("smart-folders");
    });

    expect(result.current.dismissedKeys.has("smart-folders")).toBe(true);
  });

  it("removes dismissed key from unseenKeys", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.dismissKey("smart-folders");
    });

    expect(result.current.unseenKeys).not.toContain("smart-folders");
  });

  it("persists dismissed key to localStorage", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.dismissKey("smart-folders");
    });

    const stored = JSON.parse(localStorage.getItem("smemaster.contextualHelp.dismissed") || "[]");
    expect(stored).toContain("smart-folders");
  });

  it("dismissKey is idempotent (no duplicate in localStorage)", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.dismissKey("smart-folders");
    });
    act(() => {
      result.current.dismissKey("smart-folders");
    });

    const stored = JSON.parse(localStorage.getItem("smemaster.contextualHelp.dismissed") || "[]");
    expect(stored.filter((k: string) => k === "smart-folders").length).toBe(1);
  });

  // ─── unseenKeys ──────────────────────────────────────────────────────

  it("unseenKeys excludes dismissed keys", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.dismissKey("smart-folders");
      result.current.dismissKey("bundle-rules");
    });

    expect(result.current.unseenKeys).toEqual(["split-inbox"]);
  });

  it("unseenKeys excludes seen keys without permanent dismissal", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.markSeen("smart-folders");
    });

    expect(result.current.unseenKeys).not.toContain("smart-folders");
    expect(result.current.unseenKeys).toContain("split-inbox");
  });

  it("unseenKeys is empty when all keys are dismissed", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.dismissKey("smart-folders");
      result.current.dismissKey("split-inbox");
      result.current.dismissKey("bundle-rules");
    });

    expect(result.current.unseenKeys).toEqual([]);
  });

  // ─── markSeen ────────────────────────────────────────────────────────

  it("markSeen adds key to seen without dismissing", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.markSeen("smart-folders");
    });

    expect(result.current.unseenKeys).not.toContain("smart-folders");
    expect(result.current.dismissedKeys.has("smart-folders")).toBe(false);
  });

  it("markSeen persists to localStorage", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.markSeen("bundle-rules");
    });

    const stored = JSON.parse(localStorage.getItem("smemaster.contextualHelp.seen") || "[]");
    expect(stored).toContain("bundle-rules");
  });

  // ─── resetAll ────────────────────────────────────────────────────────

  it("resetAll clears dismissedKeys", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.dismissKey("smart-folders");
      result.current.dismissKey("split-inbox");
    });
    expect(result.current.dismissedKeys.size).toBe(2);

    act(() => {
      result.current.resetAll();
    });
    expect(result.current.dismissedKeys.size).toBe(0);
  });

  it("resetAll clears seenKeys and restores all unseenKeys", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.markSeen("smart-folders");
      result.current.markSeen("split-inbox");
    });
    expect(result.current.unseenKeys).toEqual(["bundle-rules"]);

    act(() => {
      result.current.resetAll();
    });
    expect(result.current.unseenKeys.sort()).toEqual([
      "bundle-rules",
      "smart-folders",
      "split-inbox",
    ]);
  });

  it("resetAll removes both localStorage keys", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.dismissKey("smart-folders");
      result.current.markSeen("split-inbox");
    });

    act(() => {
      result.current.resetAll();
    });

    expect(localStorage.getItem("smemaster.contextualHelp.dismissed")).toBeNull();
    expect(localStorage.getItem("smemaster.contextualHelp.seen")).toBeNull();
  });

  // ─── Corrupted localStorage ──────────────────────────────────────────

  it("handles corrupted dismissed keys localStorage gracefully", () => {
    localStorage.setItem("smemaster.contextualHelp.dismissed", "{invalid json}");
    const { result } = renderHook(() => useContextualHelp());

    expect(result.current.dismissedKeys.size).toBe(0);
    expect(result.current.unseenKeys.length).toBe(3);
  });

  it("handles corrupted seen keys localStorage gracefully", () => {
    localStorage.setItem("smemaster.contextualHelp.seen", "not valid json");
    const { result } = renderHook(() => useContextualHelp());

    // All keys should be unseen since seen set is empty
    expect(result.current.unseenKeys.length).toBe(3);
  });

  // ─── activeEntry for unknown key ─────────────────────────────────────

  it("returns null activeEntry when opening nonexistent key", () => {
    const { result } = renderHook(() => useContextualHelp());

    act(() => {
      result.current.openHelp("nonexistent-key");
    });

    expect(result.current.activeKey).toBe("nonexistent-key");
    expect(result.current.activeEntry).toBeNull();
  });
});
