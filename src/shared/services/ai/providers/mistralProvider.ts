// providers/mistralProvider.ts
/**
 * Mistral Provider — Mistral AI's API.
 *
 * Base URL: https://api.mistral.ai/v1
 * Docs: https://docs.mistral.ai
 *
 * Uses the OpenAI-compatible endpoint for chat completions.
 * Native Mistral SDK could replace this later for Mistral-specific features
 * (e.g. Voxtral realtime STT), but the OpenAI-compatible path keeps the
 * provider-agnostic contract clean.
 */

import type { AiProviderClient } from "../types";
import { createOpenAICompatibleProvider } from "./openAiCompatibleProvider";

const MISTRAL_BASE_URL = "https://api.mistral.ai";

export function createMistralProvider(
  apiKey: string,
  model: string,
  aiLanguage = "auto",
  embeddingModel = "mistral-embed",
): AiProviderClient {
  return createOpenAICompatibleProvider(
    MISTRAL_BASE_URL,
    apiKey,
    model,
    aiLanguage,
    embeddingModel,
  );
}

export function clearMistralProvider(): void {
  // No-op — stateless
}