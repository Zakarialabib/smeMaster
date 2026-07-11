import { createArfReport, listArfReports, updateArfReportProcessed } from "@/shared/services/db/db-invoke";
import type { ArfReportRow } from "@/shared/services/db/db-invoke";

export type { ArfReportRow };

export async function saveARFReport(
  accountId: string,
  report: {
    feedbackType: string;
    userAgent: string;
    originalRecipient: string;
    originalMailFrom: string | null;
    arrivalDate: string | null;
    sourceIP: string | null;
    reportedDomain: string | null;
  },
  rawBody: string,
): Promise<void> {
  await createArfReport({
    accountId,
    feedbackType: report.feedbackType,
    userAgent: report.userAgent,
    originalRecipient: report.originalRecipient,
    originalMailFrom: report.originalMailFrom,
    arrivalDate: report.arrivalDate,
    sourceIP: report.sourceIP,
    reportedDomain: report.reportedDomain,
    reportRaw: rawBody,
  });
}

export async function getARFReports(accountId: string, _limit: number = 50): Promise<ArfReportRow[]> {
  return listArfReports(accountId);
}

export async function markARFProcessed(id: string): Promise<void> {
  await updateArfReportProcessed(id);
}
