import type { AiProviderClient } from "../types";
import { createOpenAICompatibleProvider } from "./openAiCompatibleProvider";

export function createCustomProvider(
  baseUrl: string,
  apiKey: string,
  model: string,
  aiLanguage = "auto",
): AiProviderClient {
  return createOpenAICompatibleProvider(baseUrl, apiKey, model, aiLanguage);
}


