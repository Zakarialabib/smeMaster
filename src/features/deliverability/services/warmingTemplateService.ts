import { getTemplatesByType, type DbTemplate } from "@features/mail/db/templates";
import { renderTemplate } from "@features/mail/services/templates/renderPipeline";

export async function getWarmingTemplateForDay(
  accountId: string,
  day: number,
): Promise<DbTemplate | null> {
  const templates = await getTemplatesByType(accountId, 'email');
  if (templates.length === 0) return null;
  return templates[day % templates.length] ?? templates[0] ?? null;
}

export async function renderWarmingEmail(
  accountId: string,
  template: DbTemplate,
  recipientEmail: string,
  recipientName: string,
): Promise<{ bodyHtml: string; subject: string }> {
  const rendered = await renderTemplate(
    { subject: template.subject, body_html: template.body_html },
    { recipientEmail, recipientName, accountId },
    'email_html',
  );
  return { bodyHtml: rendered.bodyHtml, subject: rendered.subject };
}

