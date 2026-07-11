import { describe, it, expect, vi } from "vitest";

// Mock useMatches from TanStack Router
const mockMatches: Array<{
  routeId: string;
  params: Record<string, string>;
  search?: Record<string, unknown>;
}> = [];

vi.mock("@tanstack/react-router", () => ({
  useMatches: () => mockMatches,
}));

import {
  useActiveLabel,
  useSelectedThreadId,
  useActiveCategory,
  useSearchQuery,
} from "./useRouteNavigation";

function setMatches(
  matches: Array<{
    routeId: string;
    params: Record<string, string>;
    search?: Record<string, unknown>;
  }>,
) {
  mockMatches.length = 0;
  mockMatches.push(...matches);
}

describe("useRouteNavigation hooks", () => {
  describe("useActiveLabel", () => {
    it("should return label from /mail/$label route", () => {
      setMatches([{ routeId: "/mail/$label", params: { label: "inbox" } }]);
      expect(useActiveLabel()).toBe("inbox");
    });

    it("should return label from /mail/$label/thread/$threadId route", () => {
      setMatches([
        { routeId: "/mail/$label/thread/$threadId", params: { label: "sent", threadId: "t-1" } },
      ]);
      expect(useActiveLabel()).toBe("sent");
    });

    it("should return labelId from /label/$labelId route", () => {
      setMatches([{ routeId: "/label/$labelId", params: { labelId: "Label_42" } }]);
      expect(useActiveLabel()).toBe("Label_42");
    });

    it("should return labelId from /label/$labelId/thread/$threadId route", () => {
      setMatches([
        { routeId: "/label/$labelId/thread/$threadId", params: { labelId: "Label_42", threadId: "t-1" } },
      ]);
      expect(useActiveLabel()).toBe("Label_42");
    });

    it("should return smart-folder: prefix from smart folder route", () => {
      setMatches([{ routeId: "/smart-folder/$folderId", params: { folderId: "sf-1" } }]);
      expect(useActiveLabel()).toBe("smart-folder:sf-1");
    });

    it("should return 'settings' from settings route", () => {
      setMatches([{ routeId: "/settings/$tab", params: { tab: "general" } }]);
      expect(useActiveLabel()).toBe("settings");
    });

    it("should return 'settings' from settings index route", () => {
      setMatches([{ routeId: "/settings", params: {} }]);
      expect(useActiveLabel()).toBe("settings");
    });

    it("should return 'calendar' from calendar route", () => {
      setMatches([{ routeId: "/calendar", params: {} }]);
      expect(useActiveLabel()).toBe("calendar");
    });

    it("should return 'inbox' as fallback when no matches", () => {
      setMatches([]);
      expect(useActiveLabel()).toBe("inbox");
    });
  });

  describe("useSelectedThreadId", () => {
    it("should return threadId from mail thread route", () => {
      setMatches([
        { routeId: "/mail/$label/thread/$threadId", params: { label: "inbox", threadId: "t-42" } },
      ]);
      expect(useSelectedThreadId()).toBe("t-42");
    });

    it("should return threadId from label thread route", () => {
      setMatches([
        { routeId: "/label/$labelId/thread/$threadId", params: { labelId: "L1", threadId: "t-99" } },
      ]);
      expect(useSelectedThreadId()).toBe("t-99");
    });

    it("should return null when no thread in route", () => {
      setMatches([{ routeId: "/mail/$label", params: { label: "inbox" } }]);
      expect(useSelectedThreadId()).toBeNull();
    });

    it("should return null when no matches", () => {
      setMatches([]);
      expect(useSelectedThreadId()).toBeNull();
    });
  });

  describe("useActiveCategory", () => {
    it("should return category from search params", () => {
      setMatches([
        { routeId: "/mail/$label", params: { label: "inbox" }, search: { category: "Updates" } },
      ]);
      expect(useActiveCategory()).toBe("Updates");
    });

    it("should return 'Primary' when no category in search", () => {
      setMatches([
        { routeId: "/mail/$label", params: { label: "inbox" }, search: {} },
      ]);
      expect(useActiveCategory()).toBe("Primary");
    });

    it("should return 'Primary' when no search params", () => {
      setMatches([{ routeId: "/mail/$label", params: { label: "inbox" } }]);
      expect(useActiveCategory()).toBe("Primary");
    });

    it("should return 'Primary' when no matches", () => {
      setMatches([]);
      expect(useActiveCategory()).toBe("Primary");
    });
  });

  describe("useSearchQuery", () => {
    it("should return query from search params", () => {
      setMatches([
        { routeId: "/mail/$label", params: { label: "inbox" }, search: { q: "hello world" } },
      ]);
      expect(useSearchQuery()).toBe("hello world");
    });

    it("should return empty string when no query", () => {
      setMatches([
        { routeId: "/mail/$label", params: { label: "inbox" }, search: {} },
      ]);
      expect(useSearchQuery()).toBe("");
    });

    it("should return empty string when no matches", () => {
      setMatches([]);
      expect(useSearchQuery()).toBe("");
    });
  });
});
