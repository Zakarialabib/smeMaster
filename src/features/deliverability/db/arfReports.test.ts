import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/shared/services/db/db-invoke", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/db/db-invoke")>();
  return {
    ...actual,
  };
});

import { invoke } from "@tauri-apps/api/core";
import { saveARFReport, getARFReports, markARFProcessed } from "./arfReports";

const mockInvoke = vi.mocked(invoke);

describe("arfReports service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveARFReport", () => {
    it("calls db_create_arf_report with full report data", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await saveARFReport(
        "acc-1",
        {
          feedbackType: "abuse",
          userAgent: "SpamFilter/1.0",
          originalRecipient: "user@example.com",
          originalMailFrom: "sender@test.com",
          arrivalDate: "2024-01-15T10:30:00Z",
          sourceIP: "192.168.1.1",
          reportedDomain: "example.com",
        },
        "raw ARF body content",
      );
      expect(mockInvoke).toHaveBeenCalledWith("db_create_arf_report", {
        report: {
          accountId: "acc-1",
          feedbackType: "abuse",
          userAgent: "SpamFilter/1.0",
          originalRecipient: "user@example.com",
          originalMailFrom: "sender@test.com",
          arrivalDate: "2024-01-15T10:30:00Z",
          sourceIP: "192.168.1.1",
          reportedDomain: "example.com",
          reportRaw: "raw ARF body content",
        },
      });
    });

    it("passes null for optional fields when not provided", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await saveARFReport(
        "acc-1",
        {
          feedbackType: "abuse",
          userAgent: "SpamFilter/1.0",
          originalRecipient: "user@example.com",
          originalMailFrom: null,
          arrivalDate: null,
          sourceIP: null,
          reportedDomain: null,
        },
        "raw body",
      );
      expect(mockInvoke).toHaveBeenCalledWith("db_create_arf_report", {
        report: expect.objectContaining({
          originalMailFrom: null,
          arrivalDate: null,
          sourceIP: null,
          reportedDomain: null,
        }),
      });
    });
  });

  describe("getARFReports", () => {
    it("calls db_list_arf_reports with accountId", async () => {
      const reports = [{ id: "arf-1", account_id: "acc-1", feedback_type: "abuse" }];
      mockInvoke.mockResolvedValue(reports);
      const result = await getARFReports("acc-1");
      expect(result).toEqual(reports);
      expect(mockInvoke).toHaveBeenCalledWith("db_list_arf_reports", {
        accountId: "acc-1",
      });
    });

    it("ignores the limit parameter (passed through to db)", async () => {
      mockInvoke.mockResolvedValue([]);
      await getARFReports("acc-1", 25);
      expect(mockInvoke).toHaveBeenCalledWith("db_list_arf_reports", {
        accountId: "acc-1",
      });
    });
  });

  describe("markARFProcessed", () => {
    it("calls db_update_arf_report_processed with id", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await markARFProcessed("arf-1");
      expect(mockInvoke).toHaveBeenCalledWith("db_update_arf_report_processed", {
        id: "arf-1",
      });
    });
  });
});
