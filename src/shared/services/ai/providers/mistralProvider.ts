import { Mistral } from "@mistralai/mistralai";
import type { AiProviderClient, AiCompletionRequest, AiEmbeddingRequest } from "../types";
import { createProviderFactory } from "../providerFactory";
import { buildSystemPrompt } from "../utils";

const factory = createProviderFactory(
  (apiKey) => new Mistral({ apiKey }),
);

export function createMistralProvider(apiKey: string, model: string, aiLanguage = "auto"): AiProviderClient {
  const client = factory.getClient(apiKey);

  return {
    async complete(req: AiCompletionRequest): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await client.chat.complete({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: req.userContent },
        ],
        maxTokens: req.maxTokens ?? 1024,
      });

      return response.choices[0]?.message?.content ?? "";
    },

    async testConnection(): Promise<boolean> {
      try {
        await client.chat.complete({
          model,
          messages: [{ role: "user", content: "Say hi" }],
          maxTokens: 10,
        });
        return true;
      } catch {
        return false;
      }
    },

    async getEmbeddings(req: AiEmbeddingRequest): Promise<number[][] | null> {
      try {
        const response = await client.embeddings.create({
          model: req.model ?? "mistral-embed",
          input: req.input,
        });
        return response.data.map((e: { embedding: number[] }) => e.embedding);
      } catch {
        return null;
      }
    },
  };
}

export function clearMistralProvider(): void {
  factory.clear();
}
