import { interpolateVariables, interpolateVariablesSync, evaluateConditionalBlocks } from "@shared/utils/templateVariables";

export type TemplateOutputMode = 'email_html' | 'email_text' | 'voice_script' | 'preview';

export interface RenderContext {
  recipientEmail?: string;
  recipientName?: string;
  senderEmail?: string;
  senderName?: string;
  subject?: string;
  accountId: string;
  contactId?: string;
  myTitle?: string;
  myPhone?: string;
  conditionalVars?: Record<string, string>;
}

export interface RenderedTemplate {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  voiceScript?: string;
}

function convertHtmlToVoiceScript(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();

  text = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/CTA:/gi, "\n\n[ACTION REQUIRED]: ")
    .replace(/(?:https?:\/\/[^\s]+)/g, (_url) => " [link] ");

  return text;
}

export async function renderTemplate(
  template: { subject: string | null; body_html: string; conditional_blocks_json?: string | null },
  context: RenderContext,
  mode: TemplateOutputMode = 'email_html',
): Promise<RenderedTemplate> {
  let resolved = template.body_html;

  if (template.conditional_blocks_json) {
    try {
      const condVars = JSON.parse(template.conditional_blocks_json);
      resolved = evaluateConditionalBlocks(resolved, { ...condVars, ...context.conditionalVars });
    } catch {
      /* ignore parse errors */
    }
  }

  resolved = await interpolateVariables(resolved, {
    recipientEmail: context.recipientEmail,
    recipientName: context.recipientName,
    senderEmail: context.senderEmail,
    senderName: context.senderName,
    subject: context.subject ?? template.subject ?? undefined,
    contactId: context.contactId,
    accountId: context.accountId,
    myTitle: context.myTitle,
    myPhone: context.myPhone,
  });

  const bodyText = resolved.replace(/<[^>]+>/g, '').trim();
  let voiceScript: string | undefined;

  if (mode === 'voice_script') {
    voiceScript = convertHtmlToVoiceScript(resolved);
  }

  return {
    subject: interpolateVariablesSync(template.subject ?? '', {
      recipientEmail: context.recipientEmail,
      recipientName: context.recipientName,
    }),
    bodyHtml: resolved,
    bodyText,
    voiceScript,
  };
}
