import { createBackgroundChecker, type BackgroundChecker } from "@shared/services/backgroundCheckers";
import { useSyncStore } from "@shared/stores/syncStore";
import { useQueueProgressStore } from "@shared/stores/queueProgressStore";
import {
  getPendingOperations,
  updateOperationStatus,
  deleteOperation,
  incrementRetry,
  getPendingOpsCount,
  compactQueue,
} from "@features/settings/db/pendingOperations";
import { executeQueuedAction } from "@features/mail/services/emailActions";
import { getEmailProvider } from "@features/mail/services/email/providerFactory";
import { getContactById } from "../../../../features/contacts/db/contacts.ts";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { renderTemplate } from "@features/mail/services/templates/renderPipeline";
import { classifyError } from "@shared/utils/networkErrors";
import { getQueueSchedule } from "@features/settings/db/settings";


const BATCH_SIZE = 50;

let checker: BackgroundChecker | null = null;

async function processSendCampaignEmail(
  opId: string,
  accountId: string,
  params: Record<string, unknown>,
): Promise<void> {
  const campaignId = params.campaignId as string;
  const contactId = params.contactId as string;
  const templateId = params.templateId as string | undefined;

  if (!campaignId || !contactId) {
    throw new Error("send_campaign_email: missing campaignId or contactId");
  }

  // 1. Get contact email
  const contact = await getContactById(contactId);
  if (!contact) {
    await deleteOperation(opId);
    return;
  }

  // 2. Get template content
  let subject = "";
  let bodyHtml = "";
  if (templateId) {
    const rows = await invokeCommand<{ subject: string | null; body_html: string }[]>(
      "db_get_template_content",
      { templateId },
    );
    const tmpl = rows[0];
    if (tmpl) {
      subject = tmpl.subject ?? "";
      bodyHtml = tmpl.body_html;
    }
  }

  // 3. Resolve template variables via unified render pipeline
  const rendered = await renderTemplate(
    { subject, body_html: bodyHtml },
    { recipientEmail: contact.email, recipientName: contact.display_name ?? undefined, accountId },
    'email_html',
  );

  // 4. Send via provider
  const provider = await getEmailProvider(accountId);
  const rawContent = btoa(
    `To: ${contact.email}\r\nSubject: ${rendered.subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${rendered.bodyHtml}`,
  );
  const rawBase64Url = rawContent
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await provider.sendMessage(rawBase64Url);
}

async function processQueue(): Promise<void> {
  // Skip if offline
  if (!useSyncStore.getState().isOnline) return;

  // Compact first to eliminate redundant ops
  await compactQueue();

  // Get pending operations
  const ops = await getPendingOperations(undefined, BATCH_SIZE);
  if (ops.length === 0) {
    await updatePendingCount();
    return;
  }

  useQueueProgressStore.getState().startBatch(ops.length);

  for (const op of ops) {
    try {
      useQueueProgressStore.getState().setProgress(op.id, op.operation_type, "processing");

      // Mark as executing
      await updateOperationStatus(op.id, "executing");

      // Parse params
      const params = JSON.parse(op.params) as Record<string, unknown>;

      if (op.operation_type === "send_campaign_email") {
        await processSendCampaignEmail(op.id, op.company_id, params);
      } else {
        await executeQueuedAction(op.company_id, op.operation_type, params);
      }

      // Success — delete from queue
      await deleteOperation(op.id);
      useQueueProgressStore.getState().setProgress(op.id, op.operation_type, "completed", "Completed successfully");
    } catch (err) {
      const classified = classifyError(err);

      if (classified.isRetryable) {
        // Increment retry with exponential backoff
        await updateOperationStatus(op.id, "pending", classified.message);
        await incrementRetry(op.id);
        useQueueProgressStore.getState().setProgress(op.id, op.operation_type, "failed", `Retrying: ${classified.message}`);
      } else {
        // Permanent failure
        await updateOperationStatus(op.id, "failed", classified.message);
        useQueueProgressStore.getState().setProgress(op.id, op.operation_type, "failed", classified.message);
      }
    }
  }

  await updatePendingCount();
}

async function updatePendingCount(): Promise<void> {
  const count = await getPendingOpsCount();
  useSyncStore.getState().setPendingOpsCount(count);
}

export async function startQueueProcessor(): Promise<void> {
  if (checker) return;
  const schedule = await getQueueSchedule();
  checker = createBackgroundChecker("QueueProcessor", processQueue, schedule.intervalMs);
  checker.start();
}

export function stopQueueProcessor(): void {
  checker?.stop();
  checker = null;
}

/**
 * Trigger an immediate queue flush (e.g., when coming back online).
 * Returns a promise that resolves when processing completes.
 */
export async function triggerQueueFlush(): Promise<void> {
  try {
    await processQueue();
  } catch (err) {
    console.error("[QueueProcessor] flush failed:", err);
  }
}


