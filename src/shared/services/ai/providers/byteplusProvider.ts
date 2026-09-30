/**
 * BytePlus Provider — ByteDance's AI platform.
 *
 * Capability-gated: currently supports text completion via OpenAI-compatible API.
 * Future: Seed Speech ASR at ~$0.15/hr (75% cheaper than OpenAI STT at scale).
 *
 * @module
 */

import type { AiProviderClient, AiCompletionRequest } from "../types";
import { buildSystemPrompt } from "../utils";
import { createOpenAICompatibleProvider } from "./openAiCompatibleProvider";

const BYTEPLUS_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

/**
 * Create a BytePlus provider client.
 * Uses OpenAI-compatible API (BytePlus provides OpenAI-compatible endpoints).
 */
export function createBytePlusProvider(
  apiKey: string,
  model: string,
  aiLanguage = "auto",
): AiProviderClient {
  return createOpenAICompatibleProvider(BYTEPLUS_BASE_URL, apiKey, model, aiLanguage);
}

export function clearBytePlusProvider(): void {
  // No-op - stateless provider (delegates to openAiCompatibleProvider)
}
