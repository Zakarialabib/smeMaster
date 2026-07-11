/**
 * Factory for OpenAI-compatible providers (custom, lmstudio, ollama).
 * Consolidates the common chat completion pattern with configurable baseURL and auth.
 */
import type { AiProviderClient, AiCompletionRequest, AiEmbeddingRequest } from "../types";
import { buildSystemPrompt } from "../utils";

interface ChatCompletionRequest {
  model: string;
  messages: { role: string; content: string }[];
  max_tokens?: number;
  stream?: boolean;
}

interface ChatCompletionResponse {
  choices: {
    message: { content: string };
  }[];
}

interface EmbeddingResponse {
  data: { embedding: number[] }[];
  model: string;
}

/**
 * Validates that a URL uses http or https protocol.
 * Used by both custom and lmstudio providers.
 */
export function validateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http and https are allowed");
    }
    return url;
  } catch (err) {
    throw new Error(`Invalid server URL: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Creates an OpenAI-compatible provider client.
 * Used by customProvider, lmstudioProvider, and ollamaProvider (via SDK).
 */
export function createOpenAICompatibleProvider(
  baseUrl: string,
  apiKey: string,
  model: string,
  aiLanguage = "auto",
): AiProviderClient {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  async function chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await fetch(`${normalizedBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI provider error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async function embeddingsRequest(input: string | string[]): Promise<EmbeddingResponse> {
    const response = await fetch(`${normalizedBaseUrl}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embeddings error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  return {
    async complete(req: AiCompletionRequest): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const messages: { role: string; content: string }[] = [];

      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: req.userContent });

      const response = await chatCompletion({
        model,
        messages,
        max_tokens: req.maxTokens ?? 1024,
      });

      return response.choices[0]?.message?.content ?? "";
    },

    async testConnection(): Promise<boolean> {
      try {
        const response = await chatCompletion({
          model,
          messages: [{ role: "user", content: "Say hi" }],
          max_tokens: 10,
        });
        return !!response.choices[0]?.message?.content;
      } catch {
        return false;
      }
    },

    async getEmbeddings(req: AiEmbeddingRequest): Promise<number[][] | null> {
      try {
        const response = await embeddingsRequest(req.input);
        return response.data.map((d) => d.embedding);
      } catch {
        return null;
      }
    },
  };
}

/**
 * Shared test helper for provider connection tests.
 * Wraps a callable and returns true on success, false on any error.
 */
export async function runTest(callable: () => Promise<unknown>): Promise<boolean> {
  try {
    await callable();
    return true;
  } catch {
    return false;
  }
}