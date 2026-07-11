import { invokeCommand } from "@shared/services/db/invoke/command";

export type ExportFormat = "mbox" | "eml" | "pdf" | "zip";

export interface ExportOptions {
  accountId: string;
  format: ExportFormat;
  destinationPath: string;
  dateFrom?: number;
  dateTo?: number;
  includeAttachments: boolean;
  encryptBackup: boolean;
}

export interface BackupSchedule {
  id: string;
  account_id: string | null;
  name: string;
  format: string;
  cron_expression: string;
  destination_path: string | null;
  encrypt: number;
  is_enabled: number;
  last_run_at: number | null;
  next_run_at: number | null;
  created_at: number;
}

export async function getExportFormats(): Promise<string[]> {
  try {
    return await invokeCommand<string[]>("get_export_formats");
  } catch (error) {
    throw new Error(
      `Failed to get export formats: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function validateExportConfig(
  format: string,
  destination: string,
): Promise<boolean> {
  try {
    return await invokeCommand<boolean>("validate_export_config", { format, destination });
  } catch (error) {
    throw new Error(
      `Failed to validate export config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function exportMessages(options: ExportOptions): Promise<void> {
  await validateExportConfig(options.format, options.destinationPath);

  const messages = await invokeCommand<{
    id: string;
    from_address: string | null;
    date: number;
    subject: string | null;
    to_addresses: string | null;
    cc_addresses: string | null;
    body_text: string | null;
    body_html: string | null;
  }[]>("db_get_messages_for_export", {
    accountId: options.accountId,
    dateFrom: options.dateFrom ?? null,
    dateTo: options.dateTo ?? null,
  });

  if (messages.length === 0) return;

  for (const msg of messages) {
    const rfc2822 = buildRfc2822(msg);
    const from = msg.from_address ?? "unknown";
    const date = msg.date ?? Math.floor(Date.now() / 1000);

    try {
      await invokeCommand("append_to_mbox", {
        filePath: options.destinationPath,
        messageRfc2822: rfc2822,
        fromAddress: from,
        dateSeconds: date,
      });
    } catch (error) {
      throw new Error(
        `Failed to append to mbox: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function buildRfc2822(msg: {
  id: string;
  from_address: string | null;
  date: number;
  subject: string | null;
  to_addresses: string | null;
  cc_addresses: string | null;
  body_text: string | null;
  body_html: string | null;
}): string {
  const dateStr = new Date((msg.date ?? 0) * 1000).toUTCString();
  const lines: string[] = [];

  lines.push(`Message-ID: <${msg.id}>`);
  if (msg.from_address) lines.push(`From: ${msg.from_address}`);
  if (msg.to_addresses) lines.push(`To: ${msg.to_addresses}`);
  if (msg.cc_addresses) lines.push(`Cc: ${msg.cc_addresses}`);
  lines.push(`Date: ${dateStr}`);
  lines.push(`Subject: ${msg.subject ?? "(No Subject)"}`);
  lines.push("MIME-Version: 1.0");
  lines.push("Content-Type: text/plain; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 8bit");
  lines.push("");
  lines.push(msg.body_text || msg.body_html || "");

  return lines.join("\r\n");
}

export async function scheduleBackup(schedule: {
  accountId: string;
  name: string;
  format: string;
  cronExpression: string;
  destinationPath: string;
  encrypt: boolean;
}): Promise<void> {
  await invokeCommand<void>("db_create_backup_schedule", {
    accountId: schedule.accountId,
    name: schedule.name,
    format: schedule.format,
    cronExpression: schedule.cronExpression,
    destinationPath: schedule.destinationPath,
    encrypt: schedule.encrypt,
  });
}

export async function getSchedules(accountId: string): Promise<BackupSchedule[]> {
  return invokeCommand<BackupSchedule[]>("db_list_backup_schedules", { accountId });
}

export async function toggleSchedule(id: string, enabled: boolean): Promise<void> {
  await invokeCommand<void>("db_update_backup_schedule", {
    id,
    fields: { set: { is_enabled: enabled ? 1 : 0 }, unset: [] },
  });
}

export async function updateSchedule(
  id: string,
  updates: {
    name?: string;
    format?: string;
    cronExpression?: string;
    destinationPath?: string;
    encrypt?: boolean;
  },
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.format !== undefined) set.format = updates.format;
  if (updates.cronExpression !== undefined) set.cron_expression = updates.cronExpression;
  if (updates.destinationPath !== undefined) set.destination_path = updates.destinationPath;
  if (updates.encrypt !== undefined) set.encrypt = updates.encrypt ? 1 : 0;
  if (Object.keys(set).length === 0) return;

  await invokeCommand<void>("db_update_backup_schedule", {
    id,
    fields: { set, unset: [] },
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  await invokeCommand<void>("db_delete_backup_schedule", { id });
}

export async function runBackupNow(scheduleId: string): Promise<void> {
  const schedule = await invokeCommand<BackupSchedule | null>(
    "db_get_backup_schedule",
    { id: scheduleId },
  );

  if (!schedule) {
    throw new Error(`Backup schedule not found: ${scheduleId}`);
  }

  await exportMessages({
    accountId: schedule.account_id ?? "",
    format: schedule.format as ExportFormat,
    destinationPath: schedule.destination_path ?? "",
    includeAttachments: true,
    encryptBackup: schedule.encrypt === 1,
  });

  await invokeCommand<void>("db_update_backup_schedule_last_run", {
    id: scheduleId,
    lastRunAt: Math.floor(Date.now() / 1000),
  });
}
