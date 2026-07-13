import { getActiveProvider } from "./providerManager";
import { getAiCache, setAiCache } from "@features/mail/db/aiCache";
import { getSetting } from "@features/settings/db/settings";
import { AiError } from "./errors";
import type { DbMessage } from "@shared/services/db/messages";
import { tauriStoreStorage } from "@shared/services/storage/tauriStoreStorage";
import { fetchRagContext, buildFusedContext } from "./ragContext";
import {
  SUMMARIZE_PROMPT,
  COMPOSE_PROMPT,
  REPLY_PROMPT,
  IMPROVE_PROMPT,
  SHORTEN_PROMPT,
  FORMALIZE_PROMPT,
  CATEGORIZE_PROMPT,
  SMART_REPLY_PROMPT,
  ASK_INBOX_PROMPT,
  SMART_LABEL_PROMPT,
  EXTRACT_TASK_PROMPT,
  POLISH_REPLY_PROMPT,
} from "./prompts";

// AI Feature Toggles - persisted to durable storage
export interface AiFeatureToggles {
  summarize: boolean;      // Summarize Thread
  compose: boolean;       // Compose from Prompt
  generateReply: boolean; // Generate Reply
  transform: boolean;     // Transform Text (improve/shorten/formalize)
  smartReplies: boolean;  // Generate Smart Replies
  categorize: boolean;    // Categorize Threads
  smartLabels: boolean;   // Classify by Smart Labels
  extractTask: boolean;   // Extract Task
}

const AI_TOGGLES_STORAGE_KEY = "smemaster.ai.featureToggles";

const DEFAULT_TOGGLES: AiFeatureToggles = {
  summarize: true,
  compose: true,
  generateReply: true,
  transform: true,
  smartReplies: true,
  categorize: true,
  smartLabels: true,
  extractTask: true,
};

// ── In-memory mirror for sync getters ──────────────────────────────────────
// The Tauri store is async. `getAiFeatureToggles` is called from many
// places that expect a sync result, so we keep the latest toggles in a
// module-level mirror and rehydrate on first import.
let togglesMirror: AiFeatureToggles = { ...DEFAULT_TOGGLES };
let mirrorHydrated = false;

async function hydrateTogglesMirror(): Promise<void> {
  if (mirrorHydrated) return;
  mirrorHydrated = true;
  try {
    const raw = await tauriStoreStorage.getItem(AI_TOGGLES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiFeatureToggles>;
      togglesMirror = { ...DEFAULT_TOGGLES, ...parsed };
    }
  } catch {
    // ignore — keep defaults
  }
}

if (typeof window !== "undefined") {
  void hydrateTogglesMirror();
}

function persistToggles(toggles: AiFeatureToggles): void {
  togglesMirror = toggles;
  void tauriStoreStorage.setItem(
    AI_TOGGLES_STORAGE_KEY,
    JSON.stringify(toggles),
  );
}

export function getAiFeatureToggles(): AiFeatureToggles {
  return togglesMirror;
}

export function setAiFeatureToggle<K extends keyof AiFeatureToggles>(
  key: K,
  value: boolean
): AiFeatureToggles {
  const toggles: AiFeatureToggles = { ...togglesMirror, [key]: value };
  persistToggles(toggles);
  return toggles;
}

function sanitizeErrorMessage(raw: string): string {
  const apiKeyPatterns = [
    /sk-[a-zA-Z0-9]{20,}/g,
    /sk-ant-[a-zA-Z0-9]{20,}/g,
    /ghp_[a-zA-Z0-9]{36,}/g,
    /gho_[a-zA-Z0-9]{36,}/g,
    /AIza[0-9A-Za-z_-]{35,}/g,
    /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
  ];
  let sanitized = raw;
  for (const pattern of apiKeyPatterns) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized;
}

export async function callAi(systemPrompt: string, userContent: string): Promise<string> {
  try {
    const provider = await getActiveProvider();
    return await provider.complete({ systemPrompt, userContent });
  } catch (err) {
    if (err instanceof AiError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("401") || message.includes("authentication")) {
      throw new AiError("AUTH_ERROR", "Invalid API key");
    }
    if (message.includes("429") || message.includes("rate")) {
      throw new AiError("RATE_LIMITED", "Rate limited â€” please try again shortly");
    }
    throw new AiError("NETWORK_ERROR", sanitizeErrorMessage(message));
  }
}

function formatMessageForSummary(msg: DbMessage): string {
  const from = msg.from_name
    ? `${msg.from_name} <${msg.from_address}>`
    : (msg.from_address ?? "Unknown");
  const date = new Date(msg.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const body = (msg.body_text ?? msg.snippet ?? "").trim();
  return `<email_content>From: ${from}\nDate: ${date}\n\n${body}</email_content>`;
}

export async function summarizeThread(
  threadId: string,
  accountId: string,
  messages: DbMessage[],
): Promise<string> {
  const toggles = getAiFeatureToggles();
  if (!toggles.summarize) {
    return "AI summarization is disabled. Enable it in Settings > AI.";
  }

  // Check cache first
  const cached = await getAiCache(accountId, threadId, "summary");
  if (cached) return cached;

  const subject = messages[0]?.subject ?? "No subject";
  const formatted = messages.map(formatMessageForSummary).join("\n---\n");

  // Enrich with RAG context from knowledge base (related emails/docs)
  let combined = `Subject: ${subject}\n\n${formatted}`.slice(0, 6000);
  try {
    const ragContext = await fetchRagContext(subject);
    if (ragContext && ragContext.length > 100) {
      combined = `Subject: ${subject}\n\n${formatted}\n\n---\nRelated context:\n${ragContext.slice(0, 1500)}`.slice(0, 8000);
    }
  } catch {
    // RAG unavailable — use thread-only context
  }

  const summary = await callAi(SUMMARIZE_PROMPT, combined);

  // Cache the result
  await setAiCache(accountId, threadId, "summary", summary);
  return summary;
}

export async function composeFromPrompt(instructions: string): Promise<string> {
  const toggles = getAiFeatureToggles();
  if (!toggles.compose) {
    return "AI compose is disabled. Enable it in Settings > AI.";
  }

  return callAi(COMPOSE_PROMPT, instructions);
}

export async function generateReply(
  messagesText: string[],
  instructions?: string,
): Promise<string> {
  const toggles = getAiFeatureToggles();
  if (!toggles.generateReply) {
    return "AI reply generation is disabled. Enable it in Settings > AI.";
  }

  const combined = messagesText.join("\n---\n").slice(0, 4000);
  const threadSubject = messagesText[0]?.slice(0, 100) ?? "";

  // Enrich with RAG context if no custom instructions
  let enrichedInstructions = instructions;
  if (!enrichedInstructions) {
    try {
      const ragContext = await fetchRagContext(threadSubject);
      if (ragContext && ragContext.length > 100) {
        enrichedInstructions = `Use relevant context from your knowledge base:\n${ragContext.slice(0, 2000)}`;
      }
    } catch {
      // RAG unavailable
    }
  }

  const userContent = enrichedInstructions
    ? `<email_content>${combined}</email_content>\n\nInstructions: ${enrichedInstructions}`
    : `<email_content>${combined}</email_content>`;
  return callAi(REPLY_PROMPT, userContent);
}

export type TransformType = "improve" | "shorten" | "formalize";

export async function transformText(
  text: string,
  type: TransformType,
): Promise<string> {
  const toggles = getAiFeatureToggles();
  if (!toggles.transform) {
    return "AI text transformation is disabled. Enable it in Settings > AI.";
  }

  const prompts: Record<TransformType, string> = {
    improve: IMPROVE_PROMPT,
    shorten: SHORTEN_PROMPT,
    formalize: FORMALIZE_PROMPT,
  };
  return callAi(prompts[type], text);
}

export async function polishDraft(draft: string): Promise<string> {
  const toggles = getAiFeatureToggles();
  if (!toggles.transform) {
    return draft;
  }

  const prompt = POLISH_REPLY_PROMPT.replace("{{draft}}", draft);
  return callAi(prompt, "");
}

export async function generateSmartReplies(
  threadId: string,
  accountId: string,
  messages: DbMessage[],
): Promise<string[]> {
  const smartRepliesEnabled = await getSetting("ai_smart_replies_enabled");
  if (smartRepliesEnabled === "false") return [];

  const toggles = getAiFeatureToggles();
  if (!toggles.smartReplies) {
    return ["AI smart replies are disabled. Enable them in Settings > AI."];
  }

  // Check cache first
  const cached = await getAiCache(accountId, threadId, "smart_replies");
  if (cached) {
    try {
      return JSON.parse(cached) as string[];
    } catch {
      // Corrupted cache, regenerate
    }
  }

  const formatted = messages.map(formatMessageForSummary).join("\n---\n");
  let combined = formatted.slice(0, 4000);

  // Enrich with RAG context from knowledge base for more relevant suggestions
  try {
    const subject = messages[0]?.subject ?? "";
    if (subject) {
      const ragContext = await fetchRagContext(subject);
      if (ragContext && ragContext.length > 100) {
        combined = `${formatted}\n\n---\nAdditional relevant context:\n${ragContext.slice(0, 1500)}`.slice(0, 5000);
      }
    }
  } catch {
    // RAG unavailable
  }

  const result = await callAi(SMART_REPLY_PROMPT, `<email_content>${combined}</email_content>`);

  // Parse JSON array from response
  let replies: string[];
  try {
    // Extract JSON array from the response (handle potential markdown wrapping)
    // Use non-greedy match to avoid capturing extra content
    const jsonMatch = result.match(/\[[\s\S]*?\]/);
    replies = jsonMatch ? JSON.parse(jsonMatch[0]) as string[] : [result];
  } catch {
    // If parsing fails, split by newlines as fallback
    replies = result
      .split("\n")
      .map((l) => l.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  // Validate and sanitize each reply
  replies = replies
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.replace(/<[^>]*>/g, "").slice(0, 200));

  // Ensure exactly 3 replies
  while (replies.length < 3) replies.push("Thanks for the update.");
  replies = replies.slice(0, 3);

  // Cache the result
  await setAiCache(accountId, threadId, "smart_replies", JSON.stringify(replies));
  return replies;
}

export async function askInbox(
  question: string,
  _accountId: string,
  context: string,
): Promise<string> {
  const askInboxEnabled = await getSetting("ai_ask_inbox_enabled");
  if (askInboxEnabled === "false") throw new Error("Ask Inbox is disabled in settings");

  const ftsContext = `<email_content>${context}</email_content>`;
  // Fuse FTS results with RAG vector-search context. Gracefully
  // falls back to FTS-only when RAG is unavailable.
  const fusedContext = await buildFusedContext(ftsContext, question);
  const userContent = `${fusedContext}\n\nQuestion: ${question}`;
  return callAi(ASK_INBOX_PROMPT, userContent);
}

const VALID_CATEGORIES = new Set(["Primary", "Updates", "Promotions", "Social", "Newsletters"]);

export async function categorizeThreads(
  threads: { id: string; subject: string; snippet: string; fromAddress: string }[],
): Promise<Map<string, string>> {
  const toggles = getAiFeatureToggles();
  if (!toggles.categorize) {
    return new Map();
  }

  const input = threads
    .map((t) => `<email_content>ID:${t.id} | From:${t.fromAddress} | Subject:${t.subject} | ${t.snippet}</email_content>`)
    .join("\n");

  const validThreadIds = new Set(threads.map((t) => t.id));

  const result = await callAi(CATEGORIZE_PROMPT, input);
  const categories = new Map<string, string>();

  for (const line of result.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const threadId = trimmed.slice(0, colonIdx).trim();
    const category = trimmed.slice(colonIdx + 1).trim();
    // Validate: only accept known thread IDs and valid categories
    if (threadId && category && validThreadIds.has(threadId) && VALID_CATEGORIES.has(category)) {
      categories.set(threadId, category);
    }
  }

  return categories;
}

export async function classifyThreadsBySmartLabels(
  threads: { id: string; subject: string; snippet: string; fromAddress: string }[],
  labelRules: { labelId: string; description: string }[],
): Promise<Map<string, string[]>> {
  const toggles = getAiFeatureToggles();
  if (!toggles.smartLabels) {
    return new Map();
  }

  const labelDefs = labelRules
    .map((r) => `LABEL_ID:${r.labelId} â€” ${r.description}`)
    .join("\n");

  const threadData = threads
    .map((t) => `<email_content>ID:${t.id} | From:${t.fromAddress} | Subject:${t.subject} | ${t.snippet}</email_content>`)
    .join("\n");

  const userContent = `Label definitions:\n${labelDefs}\n\nThreads:\n${threadData}`;

  const validThreadIds = new Set(threads.map((t) => t.id));
  const validLabelIds = new Set(labelRules.map((r) => r.labelId));

  const result = await callAi(SMART_LABEL_PROMPT, userContent);
  const assignments = new Map<string, string[]>();

  for (const line of result.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const threadId = trimmed.slice(0, colonIdx).trim();
    const labelsPart = trimmed.slice(colonIdx + 1).trim();
    if (!threadId || !labelsPart || !validThreadIds.has(threadId)) continue;

    const labelIds = labelsPart
      .split(",")
      .map((l) => l.trim())
      .filter((l) => validLabelIds.has(l));

    if (labelIds.length > 0) {
      assignments.set(threadId, labelIds);
    }
  }

  return assignments;
}

export interface ContentQualityResult {
  score: number;
  issues: string[];
  suggestions: string[];
}

export async function checkContentQuality(
  subject: string,
  bodyHtml: string,
  _options: { isBulk: boolean; recipientCount: number },
): Promise<ContentQualityResult> {
  const toggles = getAiFeatureToggles();
  if (!toggles.smartReplies) {
    return { score: 100, issues: [], suggestions: [] };
  }

  const text = bodyHtml.replace(/<[^>]+>/g, "").slice(0, 2000);
  const prompt = `Analyze this email for quality:\nSubject: ${subject}\n\n${text}`;

  try {
    const result = await callAi(`You are an email quality analyzer. Score 0-100, list issues and suggestions. JSON: {score, issues:[], suggestions:[]}`, prompt);
    return JSON.parse(result);
  } catch {
    return { score: 100, issues: [], suggestions: [] };
  }
}

export async function extractTaskFromThread(
  _threadId: string,
  _accountId: string,
  messages: DbMessage[],
): Promise<string> {
  const toggles = getAiFeatureToggles();
  if (!toggles.extractTask) {
    return "AI task extraction is disabled. Enable it in Settings > AI.";
  }

  const subject = messages[0]?.subject ?? "No subject";
  const formatted = messages.map(formatMessageForSummary).join("\n---\n");
  const combined = `<email_content>Subject: ${subject}\n\n${formatted}</email_content>`.slice(0, 6000);
  return callAi(EXTRACT_TASK_PROMPT, combined);
}

export async function testConnection(): Promise<boolean> {
  try {
    const provider = await getActiveProvider();
    return await provider.testConnection();
  } catch {
    return false;
  }
}
