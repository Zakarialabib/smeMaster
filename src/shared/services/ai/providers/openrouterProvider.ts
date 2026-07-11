import type { AiProviderClient } from "../types";
import { createOpenAICompatibleProvider } from "./openAiCompatibleProvider";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api";

export function createOpenRouterProvider(
  apiKey: string,
  model: string,
  aiLanguage = "auto"
): AiProviderClient {
  return createOpenAICompatibleProvider(OPENROUTER_BASE_URL, apiKey, model, aiLanguage);
}

export function clearOpenRouterProvider(): void {
  // No-op - stateless provider
}
