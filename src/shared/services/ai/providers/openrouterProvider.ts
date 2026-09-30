// providers/openrouterProvider.ts
/**
 * OpenRouter Provider — unified gateway to many models.
 *
 * Base URL: https://openrouter.ai/api/v1
 * Docs: https://openrouter.ai/docs
 *
 * OpenRouter is OpenAI-compatible. Model IDs use the provider/model format.
 * No native embeddings, STT, or TTS — text generation only.
 */

import type { AiProviderClient } from "../types";
import { createOpenAICompatibleProvider } from "./openAiCompatibleProvider";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function createOpenRouterProvider(
  apiKey: string,
  model: string,
  aiLanguage = "auto",
): AiProviderClient {
  return createOpenAICompatibleProvider(
    OPENROUTER_BASE_URL,
    apiKey,
    model,
    aiLanguage,
  );
}

export function clearOpenRouterProvider(): void {
  // No-op — stateless
}