// providers/byteplusProvider.ts
/**
 * BytePlus Provider — ByteDance's ModelArk platform (international).
 *
 * Base URL: https://ark.ap-southeast.bytepluses.com/api/v3
 * Docs: https://docs.byteplus.com/en/docs/ModelArk/product-overview
 *
 * Capability-gated: text completion via OpenAI-compatible API.
 * Future: Seed Speech ASR at ~$0.15/hr (75% cheaper than OpenAI STT at scale).
 *
 * NOTE: Model IDs require the versioned suffix (e.g. doubao-seed-2-1-pro-260628).
 * The unversioned form (doubao-seed-2.1-pro) is the marketing name, not the API ID.
 */

import type { AiProviderClient, AiCompletionRequest } from "../types";
import { buildSystemPrompt } from "../utils";
import { createOpenAICompatibleProvider } from "./openAiCompatibleProvider";

// International BytePlus endpoint (ap-southeast-1)
export const BYTEPLUS_BASE_URL =
  "https://ark.ap-southeast.bytepluses.com/api/v3";

// China Volcengine endpoint (cn-beijing) — use only for mainland clients
export const VOLCENGINE_BASE_URL =
  "https://ark.cn-beijing.volces.com/api/v3";

/**
 * Create a BytePlus provider client.
 *
 * @param apiKey - ARK_API_KEY from the BytePlus console
 * @param model - Versioned model ID (e.g. doubao-seed-2-1-pro-260628)
 * @param aiLanguage - Language override for system prompt
 * @param region - "international" (default) or "china"
 */
export function createBytePlusProvider(
  apiKey: string,
  model: string,
  aiLanguage = "auto",
  region: "international" | "china" = "international",
): AiProviderClient {
  const baseUrl = region === "china" ? VOLCENGINE_BASE_URL : BYTEPLUS_BASE_URL;
  return createOpenAICompatibleProvider(baseUrl, apiKey, model, aiLanguage);
}

export function clearBytePlusProvider(): void {
  // No-op — stateless provider (delegates to openAiCompatibleProvider)
}