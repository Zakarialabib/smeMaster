import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiProviderClient, AiCompletionRequest } from "../types";
import { createProviderFactory } from "../providerFactory";
import { buildSystemPrompt } from "../utils";

const factory = createProviderFactory(
  (apiKey) => new GoogleGenerativeAI(apiKey),
);

export function createGeminiProvider(apiKey: string, modelId: string, aiLanguage = "auto"): AiProviderClient {
  const client = factory.getClient(apiKey);

  return {
    async complete(req: AiCompletionRequest): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const model = client.getGenerativeModel({
        model: modelId,
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent(req.userContent);
      return result.response.text();
    },

    async testConnection(): Promise<boolean> {
      try {
        const model = client.getGenerativeModel({
          model: modelId,
        });
        await model.generateContent("Say hi");
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
