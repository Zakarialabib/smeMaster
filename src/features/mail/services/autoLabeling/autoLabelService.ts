/**
 * Auto-labeling rule engine (A4).
 *
 * Applies labels to threads deterministically based on sender domain,
 * subject regex, and body keywords. Rules are stored in localStorage
 * and evaluated during sync for deterministic (non-AI) labeling.
 *
 * This is a lightweight, fast-path alternative to the deprecated
 * smart_label_rules table. Rules are evaluated immediately on sync
 * without requiring any DB table or AI service.
 */

import { addThreadLabel } from "@features/mail/services/emailActions";
import type { ParsedMessage } from "@features/mail/services/gmail/messageParser";

export interface AutoLabelRule {
  id: string;
  name: string;
  /** Label ID to apply when the rule matches */
  labelId: string;
  /** Match against sender domain (e.g., "newsletter.com") */
  senderDomain?: string;
  /** Regex pattern to match against subject line */
  subjectPattern?: string;
  /** Keywords to match against body text (OR logic) */
  bodyKeywords?: string[];
  /** Match against sender display name (e.g., "LinkedIn") */
  senderName?: string;
  /** When true, all conditions must match. When false, any condition can match */
  matchAll?: boolean;
  isEnabled: boolean;
  order: number;
}

const STORAGE_KEY = "smemaster-autolabel-rules";

export function loadRules(): AutoLabelRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AutoLabelRule[]) : [];
  } catch {
    return [];
  }
}

export function saveRules(rules: AutoLabelRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export function addRule(rule: AutoLabelRule): void {
  const rules = loadRules();
  rules.push(rule);
  saveRules(rules);
}

export function updateRule(id: string, updates: Partial<AutoLabelRule>): void {
  const rules = loadRules().map((r) => (r.id === id ? { ...r, ...updates } : r));
  saveRules(rules);
}

export function deleteRule(id: string): void {
  saveRules(loadRules().filter((r) => r.id !== id));
}

/**
 * Evaluate a message against a single auto-label rule.
 * Returns true if the message matches the rule.
 */
export function evaluateRule(message: ParsedMessage, rule: AutoLabelRule): boolean {
  if (!rule.isEnabled) return false;

  const fromAddress = (message.fromAddress ?? "").toLowerCase();
  const fromName = (message.fromName ?? "").toLowerCase();
  const subject = (message.subject ?? "").toLowerCase();
  const body = `${message.bodyText ?? ""} ${message.bodyHtml ?? ""}`.toLowerCase();

  const results: boolean[] = [];

  // Sender domain match
  if (rule.senderDomain) {
    const domain = rule.senderDomain.toLowerCase();
    results.push(fromAddress.includes(domain) || fromAddress.endsWith(`@${domain}`));
  }

  // Sender name match
  if (rule.senderName) {
    results.push(fromName.includes(rule.senderName.toLowerCase()));
  }

  // Subject regex match
  if (rule.subjectPattern) {
    try {
      results.push(new RegExp(rule.subjectPattern, "i").test(subject));
    } catch {
      results.push(false);
    }
  }

  // Body keywords match (OR — any keyword matches)
  if (rule.bodyKeywords && rule.bodyKeywords.length > 0) {
    const keywords = rule.bodyKeywords.map((k) => k.toLowerCase());
    results.push(keywords.some((kw) => body.includes(kw)));
  }

  if (results.length === 0) return false;

  return rule.matchAll ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Evaluate a batch of messages against all enabled auto-label rules.
 * Returns a map of threadId → labelIds to apply.
 */
export function evaluateBatch(
  messages: ParsedMessage[],
): Map<string, Set<string>> {
  const rules = loadRules().filter((r) => r.isEnabled).sort((a, b) => a.order - b.order);
  if (rules.length === 0) return new Map();

  const result = new Map<string, Set<string>>();

  // Deduplicate threads — use first message per thread
  const threadMap = new Map<string, ParsedMessage>();
  for (const msg of messages) {
    if (!threadMap.has(msg.threadId)) {
      threadMap.set(msg.threadId, msg);
    }
  }

  for (const [threadId, msg] of threadMap) {
    const matchedLabels = new Set<string>();
    for (const rule of rules) {
      if (evaluateRule(msg, rule)) {
        matchedLabels.add(rule.labelId);
      }
    }
    if (matchedLabels.size > 0) {
      result.set(threadId, matchedLabels);
    }
  }

  return result;
}

/**
 * Apply auto-labeling rules to a batch of messages.
 * This is the main entry point called during sync.
 */
export async function applyAutoLabels(
  accountId: string,
  messages: ParsedMessage[],
): Promise<void> {
  const matches = evaluateBatch(messages);
  if (matches.size === 0) return;

  for (const [threadId, labelIds] of matches) {
    for (const labelId of labelIds) {
      try {
        await addThreadLabel(accountId, threadId, labelId);
      } catch (err) {
        console.warn(`[autoLabel] Failed to apply label ${labelId} to thread ${threadId}:`, err);
      }
    }
  }
}
