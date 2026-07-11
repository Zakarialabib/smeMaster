// ── Data Export Service ────────────────────────────────────────────────────
// Frontend wrapper for Rust export commands. These allow the user to export
// their data in standard, portable formats (no vendor lock-in).
//
// All export functions return the number of records written.

import { invoke } from "@shared/services/commands";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";

export type ExportFormat = "csv" | "vcard" | "ics";

export interface ExportResult {
  format: ExportFormat;
  destinationPath: string;
  recordCount: number;
  filename: string;
}

const DIALOG_FILTERS: Record<string, Array<{ name: string; extensions: string[] }>> = {
  contacts_csv: [{ name: "CSV", extensions: ["csv"] }],
  contacts_vcard: [{ name: "vCard", extensions: ["vcf"] }],
  tasks_csv: [{ name: "CSV", extensions: ["csv"] }],
  calendar_ics: [{ name: "iCalendar", extensions: ["ics"] }],
};

const DEFAULT_FILENAMES = {
  contacts_csv: "smemaster-contacts.csv",
  contacts_vcard: "smemaster-contacts.vcf",
  tasks_csv: "smemaster-tasks.csv",
  calendar_ics: "smemaster-calendar.ics",
};

/**
 * Open a save dialog and export contacts to CSV.
 */
export async function exportContactsToCsv(): Promise<ExportResult | null> {
  const destinationPath = await saveDialog({
    title: "Export Contacts as CSV",
    defaultPath: DEFAULT_FILENAMES.contacts_csv,
    filters: DIALOG_FILTERS.contacts_csv,
  });
  if (!destinationPath) return null;
  const recordCount = await invoke("export_contacts_csv", { destinationPath });
  return {
    format: "csv",
    destinationPath,
    recordCount: Number(recordCount),
    filename: DEFAULT_FILENAMES.contacts_csv,
  };
}

/**
 * Open a save dialog and export contacts to vCard 3.0.
 */
export async function exportContactsToVcard(): Promise<ExportResult | null> {
  const destinationPath = await saveDialog({
    title: "Export Contacts as vCard",
    defaultPath: DEFAULT_FILENAMES.contacts_vcard,
    filters: DIALOG_FILTERS.contacts_vcard,
  });
  if (!destinationPath) return null;
  const recordCount = await invoke("export_contacts_vcard", { destinationPath });
  return {
    format: "vcard",
    destinationPath,
    recordCount: Number(recordCount),
    filename: DEFAULT_FILENAMES.contacts_vcard,
  };
}

/**
 * Open a save dialog and export tasks to CSV.
 */
export async function exportTasksToCsv(): Promise<ExportResult | null> {
  const destinationPath = await saveDialog({
    title: "Export Tasks as CSV",
    defaultPath: DEFAULT_FILENAMES.tasks_csv,
    filters: DIALOG_FILTERS.tasks_csv,
  });
  if (!destinationPath) return null;
  const recordCount = await invoke("export_tasks_csv", { destinationPath });
  return {
    format: "csv",
    destinationPath,
    recordCount: Number(recordCount),
    filename: DEFAULT_FILENAMES.tasks_csv,
  };
}

/**
 * Open a save dialog and export calendar events to ICS (iCalendar RFC 5545).
 */
export async function exportCalendarToIcs(): Promise<ExportResult | null> {
  const destinationPath = await saveDialog({
    title: "Export Calendar as ICS",
    defaultPath: DEFAULT_FILENAMES.calendar_ics,
    filters: DIALOG_FILTERS.calendar_ics,
  });
  if (!destinationPath) return null;
  const recordCount = await invoke("export_calendar_ics", { destinationPath });
  return {
    format: "ics",
    destinationPath,
    recordCount: Number(recordCount),
    filename: DEFAULT_FILENAMES.calendar_ics,
  };
}
