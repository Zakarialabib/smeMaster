import type { DbWorkflowRule } from "@features/settings/db/workflowRules";
import { getActiveWorkflowRules } from "@features/settings/db/workflowRules";
import { getTemplateById } from "@features/mail/db/templates";
import { renderTemplate } from "@features/mail/services/templates/renderPipeline";
import { getAccount } from "@features/accounts/db/accounts";
import { buildSmtpConfig } from "@features/mail/services/imap/imapConfigBuilder";
import { ensureFreshToken } from "@shared/services/oauth/oauthTokenManager";
export type WorkflowAction =
  | { type: "apply_label"; labelId: string }
  | { type: "send_template"; templateId: string; delayHours?: number }
  | {
      type: "create_task";
      title?: string;
      dueDays?: number;
      dueDate?: string;
      priority?: "none" | "low" | "medium" | "high" | "urgent";
    }
  | { type: "mark_read" }
  | { type: "archive" }
  | { type: "star" }
  | { type: "forward_to"; email: string; forwardTo?: string };
interface TriggerContext {
  accountId: string;
  messageId?: string;
  threadId?: string;
  fromAddress?: string;
  subject?: string;
  fromDomain?: string;
  fromName?: string;
  body?: string;
}
export function parseWorkflowActions(actionsJson: string): WorkflowAction[] {
  try {
    const parsed = JSON.parse(actionsJson);
    if (Array.isArray(parsed)) return parsed as WorkflowAction[];
    return [];
  } catch {
    return [];
  }
}
export function matchesConditions(
  rule: DbWorkflowRule,
  context: TriggerContext,
): boolean {
  if (!rule.trigger_conditions) return true;
  try {
    const conditions = JSON.parse(rule.trigger_conditions) as Record<
      string,
      unknown
    >;
    if (conditions.from_domain && typeof conditions.from_domain === "string") {
      if (context.fromDomain !== conditions.from_domain) return false;
    }
    if (
      conditions.subject_contains &&
      typeof conditions.subject_contains === "string"
    ) {
      if (
        !context.subject ||
        !context.subject
          .toLowerCase()
          .includes(conditions.subject_contains.toLowerCase())
      ) {
        return false;
      }
    }
    if (
      conditions.from_address &&
      typeof conditions.from_address === "string"
    ) {
      if (context.fromAddress !== conditions.from_address) return false;
    }
    return true;
  } catch {
    return true;
  }
}
export async function evaluateAndExecute(
  rule: DbWorkflowRule,
  context: TriggerContext,
): Promise<void> {
  if (!matchesConditions(rule, context)) return;
  const actions = parseWorkflowActions(rule.actions);
  for (const action of actions) {
    await executeAction(action, context);
  }
}
async function executeAction(
  action: WorkflowAction,
  context: TriggerContext,
): Promise<void> {
  switch (action.type) {
    case "apply_label": {
      const { addThreadLabel } =
        await import("@features/mail/services/emailActions");
      if (context.threadId) {
        await addThreadLabel(
          context.accountId,
          context.threadId,
          action.labelId,
        );
      }
      break;
    }
    case "mark_read": {
      const { markThreadRead } =
        await import("@features/mail/services/emailActions");
      if (context.threadId) {
        await markThreadRead(context.accountId, context.threadId, [], true);
      }
      break;
    }
    case "archive": {
      const { archiveThread } =
        await import("@features/mail/services/emailActions");
      if (context.threadId) {
        await archiveThread(context.accountId, context.threadId, []);
      }
      break;
    }
    case "star": {
      const { starThread } =
        await import("@features/mail/services/emailActions");
      if (context.threadId) {
        await starThread(context.accountId, context.threadId, [], true);
      }
      break;
    }
    case "forward_to": {
      const forwardAddress = action.forwardTo ?? action.email;
      try {
        const { smtpSendEmail } =
          await import("@features/mail/services/imap/tauriCommands");
        const account = await getAccount(context.accountId);
        if (!account) break;
        const smtpConfig =
          account.auth_method === "oauth2"
            ? buildSmtpConfig(account, await ensureFreshToken(account))
            : buildSmtpConfig(account);
        const forwardSubject = context.subject
          ? `Fwd: ${context.subject}`
          : "Fwd: (no subject)";
        const forwardBody = context.body ?? "";
        const rawMessage = [
          `From: ${account.email}`,
          `To: ${forwardAddress}`,
          `Subject: ${forwardSubject}`,
          `Date: ${new Date().toUTCString()}`,
          "MIME-Version: 1.0",
          "Content-Type: text/plain; charset=utf-8",
          "",
          `---------- Forwarded message ----------`,
          `From: ${context.fromName ? `${context.fromName} <${context.fromAddress}>` : (context.fromAddress ?? "unknown")}`,
          `Subject: ${context.subject ?? "(no subject)"}`,
          "",
          forwardBody,
        ].join("\r\n");
        const encoded = btoa(rawMessage)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
        await smtpSendEmail(smtpConfig, encoded);
      } catch (err) {
        console.error("[Workflow] forward_to action failed:", err);
      }
      break;
    }
    case "send_template": {
      const template = await getTemplateById(action.templateId);
      if (!template) {
        console.error(`[Workflow] Template not found: ${action.templateId}`);
        break;
      }
      const account = await getAccount(context.accountId);
      if (!account) break;
      const rendered = await renderTemplate(
        { subject: template.subject, body_html: template.body_html },
        {
          recipientEmail: context.fromAddress,
          recipientName: context.fromName,
          subject: context.subject,
          senderEmail: account.email,
          senderName: account.display_name ?? undefined,
          accountId: context.accountId,
        },
        "email_html",
      );
      try {
        const { smtpSendEmail } =
          await import("@features/mail/services/imap/tauriCommands");
        const smtpConfig =
          account.auth_method === "oauth2"
            ? buildSmtpConfig(account, await ensureFreshToken(account))
            : buildSmtpConfig(account);
        const replySubject = context.subject
          ? `Re: ${context.subject}`
          : "(no subject)";
        const rawMessage = [
          `From: ${account.email}`,
          `To: ${context.fromAddress ?? ""}`,
          `Subject: ${rendered.subject || replySubject}`,
          `Date: ${new Date().toUTCString()}`,
          "MIME-Version: 1.0",
          "Content-Type: text/html; charset=utf-8",
          "",
          rendered.bodyHtml,
        ].join("\r\n");
        const encoded = btoa(rawMessage)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
        await smtpSendEmail(smtpConfig, encoded);
        try {
          const { incrementTemplateUsage } =
            await import("@features/mail/db/templates");
          await incrementTemplateUsage(action.templateId);
        } catch {}
      } catch (err) {
        console.error("[Workflow] send_template action failed:", err);
      }
      break;
    }
    case "create_task": {
      try {
        const { insertTask } = await import("@features/tasks/db/tasks");
        const taskTitle = action.title || context.subject || "Task from email";
        const description = `From: ${context.fromName ? `${context.fromName} <${context.fromAddress}>` : (context.fromAddress ?? "unknown")}\n${context.body?.substring(0, 200) ?? ""}`;
        let dueDate: number | null = null;
        if (action.dueDate) {
          dueDate = Math.floor(new Date(action.dueDate).getTime() / 1000);
        } else if (action.dueDays) {
          dueDate = Math.floor(Date.now() / 1000) + action.dueDays * 86400;
        }
        await insertTask({
          accountId: context.accountId,
          title: taskTitle,
          description,
          threadId: context.threadId,
          threadAccountId: context.threadId ? context.accountId : undefined,
          dueDate,
          priority: action.priority || "medium",
        });
      } catch (err) {
        console.error("[Workflow] create_task action failed:", err);
      }
      break;
    }
  }
}
export async function evaluateWorkflowRules(
  accountId: string,
  event: string,
  context: TriggerContext,
): Promise<void> {
  const rules = await getActiveWorkflowRules(accountId, event);
  for (const rule of rules) {
    await evaluateAndExecute(rule, context);
  }
}
