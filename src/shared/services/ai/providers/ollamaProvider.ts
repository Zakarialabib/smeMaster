import OpenAI from "openai";
import type { AiProviderClient, AiCompletionRequest, AiEmbeddingRequest } from "../types";
import { buildSystemPrompt } from "../utils";
import { validateUrl } from "./openAiCompatibleProvider";

let instance: OpenAI | null = null;
let cachedKey: string | null = null;

function getClient(serverUrl: string, model: string): OpenAI {
  const safeUrl = validateUrl(serverUrl);
  const cacheKey = `${safeUrl}|${model}`;
  if (!instance || cachedKey !== cacheKey) {
    instance = new OpenAI({
      baseURL: `${safeUrl.replace(/\/+$/, "")}/v1`,
      apiKey: "ollama",
      dangerouslyAllowBrowser: true,
    });
    cachedKey = cacheKey;
  }
  return instance;
}

export function createOllamaProvider(serverUrl: string, model: string, aiLanguage = "auto"): AiProviderClient {
  const client = getClient(serverUrl, model);

  async function ollamaEmbeddings(input: string | string[]): Promise<number[][]> {
    const safeUrl = validateUrl(serverUrl);
    const normalizedUrl = safeUrl.replace(/\/+$/, "");
    const texts = Array.isArray(input) ? input : [input];

    const results: number[][] = [];
    for (const text of texts) {
      const response = await fetch(`${normalizedUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embeddings error (${response.status})`);
      }

      const data = await response.json() as { embedding?: number[] };
      if (data.embedding) {
        results.push(data.embedding);
      }
    }

    return results;
  }

  return {
    async complete(req: AiCompletionRequest): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await client.chat.completions.create({
        model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: req.userContent },
        ],
      });

      return response.choices[0]?.message?.content ?? "";
    },

    async testConnection(): Promise<boolean> {
      try {
        await client.chat.completions.create({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "Say hi" }],
        });
        return true;
      } catch {
        return false;
      }
    },

    async getEmbeddings(req: AiEmbeddingRequest): Promise<number[][] | null> {
      try {
        return await ollamaEmbeddings(req.input);
      } catch {
        return null;
      }
    },
  };
}

export function clearOllamaProvider(): void {
  instance = null;
  cachedKey = null;
}
