import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDomainHealthStore } from "./domainHealthStore";

vi.mock("@features/deliverability/services/domainHealthService", () => ({
  checkDomainHealth: vi.fn(),
  getRemediation: vi.fn(),
  runSentinelCheck: vi.fn(),
}));

import {
  checkDomainHealth,
  getRemediation,
  runSentinelCheck,
} from "@features/deliverability/services/domainHealthService";

beforeEach(() => {
  useDomainHealthStore.setState({
    healthScores: {},
    currentDomain: null,
    remediation: [],
    alerts: [],
    isLoading: false,
    error: null,
  });
  vi.clearAllMocks();
});

describe("domainHealthStore", () => {
  describe("initial state", () => {
    it("should have correct defaults", () => {
      const state = useDomainHealthStore.getState();
      expect(state.healthScores).toEqual({});
      expect(state.currentDomain).toBeNull();
      expect(state.remediation).toEqual([]);
      expect(state.alerts).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("setCurrentDomain", () => {
    it("should set the current domain", () => {
      useDomainHealthStore.getState().setCurrentDomain("example.com");
      expect(useDomainHealthStore.getState().currentDomain).toBe("example.com");
    });

    it("should clear the current domain", () => {
      useDomainHealthStore.getState().setCurrentDomain("example.com");
      useDomainHealthStore.getState().setCurrentDomain(null);
      expect(useDomainHealthStore.getState().currentDomain).toBeNull();
    });
  });

  describe("checkDomain", () => {
    it("should check domain health and store result", async () => {
      const mockHealth = { score: 85, spf: true, dkim: true, dmarc: false };
      vi.mocked(checkDomainHealth).mockResolvedValue(mockHealth);

      await useDomainHealthStore.getState().checkDomain("example.com");

      expect(checkDomainHealth).toHaveBeenCalledWith("example.com", undefined);
      expect(useDomainHealthStore.getState().healthScores["example.com"]).toEqual(mockHealth);
      expect(useDomainHealthStore.getState().currentDomain).toBe("example.com");
      expect(useDomainHealthStore.getState().isLoading).toBe(false);
    });

    it("should pass sendingIp when provided", async () => {
      vi.mocked(checkDomainHealth).mockResolvedValue({ score: 90 });

      await useDomainHealthStore.getState().checkDomain("example.com", "1.2.3.4");

      expect(checkDomainHealth).toHaveBeenCalledWith("example.com", "1.2.3.4");
    });

    it("should set loading state during check", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise<unknown>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(checkDomainHealth).mockReturnValue(promise as never);

      const checkPromise = useDomainHealthStore.getState().checkDomain("example.com");
      expect(useDomainHealthStore.getState().isLoading).toBe(true);

      resolvePromise!({ score: 85 });
      await checkPromise;
      expect(useDomainHealthStore.getState().isLoading).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(checkDomainHealth).mockRejectedValue(new Error("Network error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useDomainHealthStore.getState().checkDomain("example.com");

      expect(useDomainHealthStore.getState().isLoading).toBe(false);
      expect(useDomainHealthStore.getState().error).toBe("Network error");
      consoleSpy.mockRestore();
    });

    it("should store health scores for multiple domains independently", async () => {
      vi.mocked(checkDomainHealth)
        .mockResolvedValueOnce({ score: 85 })
        .mockResolvedValueOnce({ score: 70 });

      await useDomainHealthStore.getState().checkDomain("domain1.com");
      await useDomainHealthStore.getState().checkDomain("domain2.com");

      expect(useDomainHealthStore.getState().healthScores["domain1.com"]).toEqual({ score: 85 });
      expect(useDomainHealthStore.getState().healthScores["domain2.com"]).toEqual({ score: 70 });
    });
  });

  describe("getRemediationForDomain", () => {
    it("should fetch remediation for a domain", async () => {
      const mockRemediation = [
        { id: "r1", type: "fix", description: "Add SPF record" },
      ];
      vi.mocked(getRemediation).mockResolvedValue(mockRemediation);

      await useDomainHealthStore.getState().getRemediationForDomain("example.com", ["spf_fail"]);

      expect(getRemediation).toHaveBeenCalledWith("example.com", ["spf_fail"]);
      expect(useDomainHealthStore.getState().remediation).toEqual(mockRemediation);
    });

    it("should replace previous remediation", async () => {
      vi.mocked(getRemediation)
        .mockResolvedValueOnce([{ id: "r1", type: "fix", description: "Fix 1" }])
        .mockResolvedValueOnce([{ id: "r2", type: "fix", description: "Fix 2" }]);

      await useDomainHealthStore.getState().getRemediationForDomain("example.com", []);
      expect(useDomainHealthStore.getState().remediation).toHaveLength(1);

      await useDomainHealthStore.getState().getRemediationForDomain("example.com", []);
      expect(useDomainHealthStore.getState().remediation).toHaveLength(1);
      expect(useDomainHealthStore.getState().remediation[0].id).toBe("r2");
    });
  });

  describe("runSentinel", () => {
    it("should run sentinel check and append alerts", async () => {
      const mockAlerts = [
        { id: "a1", severity: "high", message: "SPF record missing" },
      ];
      vi.mocked(runSentinelCheck).mockResolvedValue(mockAlerts);

      await useDomainHealthStore.getState().runSentinel("example.com", 85);

      expect(runSentinelCheck).toHaveBeenCalledWith("example.com", 85);
      expect(useDomainHealthStore.getState().alerts).toEqual(mockAlerts);
    });

    it("should append alerts to existing alerts", async () => {
      useDomainHealthStore.setState({
        alerts: [{ id: "a0", severity: "low", message: "Old alert" }],
      });
      vi.mocked(runSentinelCheck).mockResolvedValue([
        { id: "a1", severity: "high", message: "New alert" },
      ]);

      await useDomainHealthStore.getState().runSentinel("example.com", 85);

      const alerts = useDomainHealthStore.getState().alerts;
      expect(alerts).toHaveLength(2);
      expect(alerts[0].id).toBe("a0");
      expect(alerts[1].id).toBe("a1");
    });

    it("should handle empty alerts", async () => {
      vi.mocked(runSentinelCheck).mockResolvedValue([]);

      await useDomainHealthStore.getState().runSentinel("example.com", 85);

      expect(useDomainHealthStore.getState().alerts).toEqual([]);
    });
  });

  describe("state isolation", () => {
    it("should not affect other fields when setting currentDomain", () => {
      useDomainHealthStore.getState().setCurrentDomain("example.com");
      const state = useDomainHealthStore.getState();
      expect(state.healthScores).toEqual({});
      expect(state.remediation).toEqual([]);
      expect(state.alerts).toEqual([]);
    });
  });
});
