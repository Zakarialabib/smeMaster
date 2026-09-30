// providers/openAiCompatibleProvider.ts (enhanced)
/**
 * Factory for OpenAI-compatible providers (custom, lmstudio, ollama, byteplus, mistral).
 * Consolidates the common chat completion pattern with configurable baseURL and auth.
 */
import type { AiProviderClient, AiCompletionRequest, AiEmbeddingRequest } from "../types";
import type { EmbeddingResult } from "../capabilities";
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

export function createOpenAICompatibleProvider(
  baseUrl: string,
  apiKey: string,
  model: string,
  aiLanguage = "auto",
  embeddingModel?: string,
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
      throw new Error(
        `AI provider error (${response.status}) [model=${model}]: ${errorText}`,
      );
    }

    return response.json();
  }

  async function embeddingsRequest(
    input: string | string[],
    embModel: string,
  ): Promise<EmbeddingResponse> {
    const response = await fetch(`${normalizedBaseUrl}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: embModel, input }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Embeddings error (${response.status}) [model=${embModel}]: ${errorText}`,
      );
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

    async getEmbeddings(req: AiEmbeddingRequest): Promise<EmbeddingResult | null> {
      const embModel = req.model ?? embeddingModel ?? model;
      try {
        const response = await embeddingsRequest(req.input, embModel);
        const vectors = response.data.map((d) => d.embedding);
        const dimensions = vectors[0]?.length ?? 0;
        return {
          vectors,
          spaceId: `openai-compatible-${embModel}-${dimensions}`,
          dimensions,
          modelId: embModel,
        };
      } catch {
        return null;
      }
    },
  };
}