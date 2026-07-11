import { getContactByEmail, getContactById } from "../../features/contacts/db/contacts.ts";
import { escapeHtml } from "@shared/utils/sanitize";

/**
 * Unified context for all template variable interpolation.
 * Supports both email-style and campaign-style variables.
 */
export interface TemplateContext {
  /** Recipient's email address (replaces {{email}}) */
  recipientEmail?: string;
  /** Recipient's display name (replaces {{display_name}}, used for {{first_name}}/{{last_name}}) */
  recipientName?: string;
  /** Sender's email address (replaces {{my_email}}) */
  senderEmail?: string;
  /** Sender's display name (replaces {{my_name}}) */
  senderName?: string;
  /** Thread or campaign subject (replaces {{subject}}) */
  subject?: string;
  /** Contact ID for DB lookup of recipient details */
  contactId?: string;
  /** Account ID for context */
  accountId?: string;
  /** Company/domain name (replaces {{company}}) */
  company?: string;
  /** Display name override (replaces {{display_name}}) */
  displayName?: string;
  /** Sender's job title (replaces {{my_title}}) */
  myTitle?: string;
  /** Sender's phone number (replaces {{my_phone}}) */
  myPhone?: string;
  /** Locale string for date/greeting formatting (defaults to "en-US") */
  locale?: string;
}

/** @deprecated Use TemplateContext instead */
export type VariableContext = TemplateContext;

export interface TemplateVariable {
  key: string;
  desc: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: "{{first_name}}", desc: "Recipient's first name" },
  { key: "{{last_name}}", desc: "Recipient's last name" },
  { key: "{{email}}", desc: "Recipient's email address" },
  { key: "{{company}}", desc: "Recipient's company/domain" },
  { key: "{{display_name}}", desc: "Recipient's display name" },
  { key: "{{my_name}}", desc: "Your display name" },
  { key: "{{my_email}}", desc: "Your email address" },
  { key: "{{my_title}}", desc: "Your job title" },
  { key: "{{my_phone}}", desc: "Your phone number" },
  { key: "{{subject}}", desc: "Thread subject" },
  { key: "{{date}}", desc: "Today's date" },
  { key: "{{date_long}}", desc: "Today's long date (with weekday)" },
  { key: "{{day}}", desc: "Day of week" },
  { key: "{{day_of_week}}", desc: "Day of week (long format)" },
  { key: "{{random_greeting}}", desc: "Random greeting" },
];

const GREETINGS: Record<string, string[]> = {
  en: ["Hello", "Hi", "Hey", "Greetings"],
  fr: ["Bonjour", "Salut", "Coucou"],
  de: ["Hallo", "Hallo", "Guten Tag"],
  es: ["Hola", "Buenos días"],
  zh: ["您好", "你好"],
  ja: ["こんにちは"],
  ar: ["مرحبا", "أهلا"],
  pt: ["Olá", "Oi"],
  it: ["Ciao", "Buongiorno"],
  nl: ["Hallo", "Hoi"],
};

function getGreetings(locale: string): string[] {
  const lang = locale.split("-")[0] ?? "en";
  return GREETINGS[lang] ?? GREETINGS["en"]!;
}

function splitName(fullName: string | undefined): { first: string; last: string } {
  if (!fullName) return { first: "", last: "" };
  const parts = fullName.trim().split(/\s+/);
  return {
    first: parts[0] ?? "",
    last: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
}

/**
 * Evaluate conditional blocks in template.
 * Supports {{#if var}}...{{else}}...{{/if}} syntax.
 */
export function evaluateConditionalBlocks(
  template: string,
  vars: Record<string, string>,
): string {
  let result = template;
  const blockRegex =
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
  result = result.replace(blockRegex, (_match, varName, ifBlock, elseBlock) => {
    const value = vars[varName];
    if (value && value.trim().length > 0) {
      return ifBlock ?? "";
    }
    return elseBlock ?? "";
  });
  return result;
}

/**
 * Interpolate template variables in HTML string.
 * Replaces {{variable}} patterns with resolved values.
 * Supports both email-style and campaign-style variables.
 * Resolves recipient info from contacts DB via contactId or recipientEmail.
 */
export async function interpolateVariables(
  html: string,
  ctx: TemplateContext,
): Promise<string> {
  // Only do work if there are variables to replace
  if (!html.includes("{{")) return html;

  const locale = ctx.locale ?? "en-US";
  let recipientName = ctx.recipientName ?? "";
  let email = ctx.recipientEmail ?? "";
  let displayName = ctx.displayName ?? "";

  // Look up contact from DB if contactId is provided
  if (ctx.contactId) {
    try {
      const contact = await getContactById(ctx.contactId);
      if (contact) {
        email = contact.email ?? email;
        displayName = contact.display_name ?? displayName;
        recipientName = displayName || recipientName;
      }
    } catch {
      // Fallback to context values
    }
  }

  // Fallback: look up by email if we still need a recipient name
  if (!recipientName && email) {
    try {
      const contact = await getContactByEmail(email);
      if (contact) {
        recipientName = contact.display_name ?? "";
      }
    } catch {
      // Fallback to empty
    }
  }

  const firstName = displayName.split(/\s+/)[0] ?? email.split("@")[0] ?? "";
  const { first, last } = splitName(recipientName || displayName);

  // Derive company from email if not provided
  const company =
    ctx.company ??
    (email.includes("@") ? email.split("@")[1]?.split(".")[0] ?? "" : "");

  const now = new Date();
  const dateStr = now.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dateLongStr = now.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dayStr = now.toLocaleDateString(locale, { weekday: "long" });
  const greetings = getGreetings(locale);
  const randomGreeting =
    greetings[Math.floor(Math.random() * greetings.length)] ?? "Hello";

  const { first: senderFirst } = splitName(ctx.senderName);

  const replacements: Record<string, string> = {
    "{{first_name}}": first || firstName,
    "{{last_name}}": last,
    "{{email}}": email,
    "{{company}}": company,
    "{{display_name}}": displayName || recipientName,
    "{{my_name}}": ctx.senderName ?? senderFirst,
    "{{my_email}}": ctx.senderEmail ?? "",
    "{{my_title}}": ctx.myTitle ?? "",
    "{{my_phone}}": ctx.myPhone ?? "",
    "{{subject}}": ctx.subject ?? "",
    "{{date}}": dateStr,
    "{{date_long}}": dateLongStr,
    "{{day}}": dayStr,
    "{{day_of_week}}": dayStr,
    "{{random_greeting}}": randomGreeting,
  };

  let result = html;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, escapeHtml(value));
  }

  return result;
}

/**
 * Synchronous version for simple variable interpolation without DB lookups.
 * Uses only the context provided (no contact resolution).
 * Supports both email-style and campaign-style variables.
 */
export function interpolateVariablesSync(
  html: string,
  ctx: TemplateContext,
): string {
  if (!html.includes("{{")) return html;

  const locale = ctx.locale ?? "en-US";
  const { first, last } = splitName(ctx.recipientName);

  const email = ctx.recipientEmail ?? "";
  const company =
    ctx.company ??
    (email.includes("@") ? email.split("@")[1]?.split(".")[0] ?? "" : "");

  const now = new Date();
  const dateStr = now.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dateLongStr = now.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dayStr = now.toLocaleDateString(locale, { weekday: "long" });
  const greetings = getGreetings(locale);
  const randomGreeting =
    greetings[Math.floor(Math.random() * greetings.length)] ?? "Hello";

  const replacements: Record<string, string> = {
    "{{first_name}}": first,
    "{{last_name}}": last,
    "{{email}}": email,
    "{{company}}": company,
    "{{display_name}}": ctx.recipientName ?? "",
    "{{my_name}}": ctx.senderName ?? "",
    "{{my_email}}": ctx.senderEmail ?? "",
    "{{my_title}}": ctx.myTitle ?? "",
    "{{my_phone}}": ctx.myPhone ?? "",
    "{{subject}}": ctx.subject ?? "",
    "{{date}}": dateStr,
    "{{date_long}}": dateLongStr,
    "{{day}}": dayStr,
    "{{day_of_week}}": dayStr,
    "{{random_greeting}}": randomGreeting,
  };

  let result = html;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, escapeHtml(value));
  }

  return result;
}

