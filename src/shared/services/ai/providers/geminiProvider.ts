import { GoogleGenAI } from "@google/genai";
import type { AiProviderClient, AiCompletionRequest } from "../types";
import { createProviderFactory } from "../providerFactory";
import { buildSystemPrompt } from "../utils";

const factory = createProviderFactory(
  (apiKey) => new GoogleGenAI({ apiKey }),
);

export function createGeminiProvider(apiKey: string, modelId: string, aiLanguage = "auto"): AiProviderClient {
  const client = factory.getClient(apiKey);

  return {
    async complete(req: AiCompletionRequest): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await client.models.generateContent({
        model: modelId,
        contents: req.userContent,
        config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
      });
      return response.text ?? "";
    },

    async testConnection(): Promise<boolean> {
      try {
        await client.models.generateContent({
          model: modelId,
          contents: "Say hi",
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function clearGeminiProvider(): void {
  factory.clear();
}
