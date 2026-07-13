import type {
  AiProviderClient,
  AiCompletionRequest,
  AiEmbeddingRequest,
  LMStudioProviderOptions,
  TestEmbeddingResult,
} from "../types";
import { buildSystemPrompt } from "../utils";
import { validateUrl } from "./openAiCompatibleProvider";

interface ModelListResponse {
  data: { id: string; name?: string }[];
}

interface EmbeddingResponse {
  data: { embedding: number[] }[];
  model: string;
}

let cachedUrl: string | null = null;
let cachedKey: string | null = null;

async function embeddingsRequest(
  baseUrl: string,
  model: string,
  input: string | string[],
): Promise<EmbeddingResponse> {
  const normalizedUrl = baseUrl.replace(/\/+$/, "");
  const response = await fetch(`${normalizedUrl}/v1/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || "default",
      input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LMStudio embeddings error (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function chatCompletion(
  baseUrl: string,
  model: string,
  req: { messages: { role: string; content: string }[]; max_tokens?: number },
): Promise<{ choices: { message: { content: string } }[] }> {
  const normalizedUrl = baseUrl.replace(/\/+$/, "");
  const response = await fetch(`${normalizedUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...req, model }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LMStudio API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export function createLMStudioProvider(
  serverUrl: string,
  options: LMStudioProviderOptions,
  aiLanguage = "auto",
): AiProviderClient {
  const safeUrl = validateUrl(serverUrl);
  const { chatModel, embeddingModel } = options;
  const cacheKey = `${safeUrl}|${chatModel}|${embeddingModel ?? ""}`;

  if (cachedUrl !== safeUrl || cachedKey !== cacheKey) {
    cachedUrl = safeUrl;
    cachedKey = cacheKey;
  }

  const resolveEmbeddingModel = (requested?: string): string => {
    const requestedModel = (requested ?? embeddingModel ?? "").trim();
    return requestedModel || "default";
  };

  return {
    async complete(req: AiCompletionRequest): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const messages: { role: string; content: string }[] = [];

      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: req.userContent });

      const response = await chatCompletion(safeUrl, chatModel, {
        messages,
        max_tokens: req.maxTokens ?? 1024,
      });

      return response.choices[0]?.message?.content ?? "";
    },

    async testConnection(): Promise<boolean> {
      try {
        const response = await chatCompletion(safeUrl, chatModel, {
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
        const model = resolveEmbeddingModel(req.model);
        const response = await embeddingsRequest(safeUrl, model, req.input);
        return response.data.map((d) => d.embedding);
      } catch {
        // LM Studio may not have embeddings endpoint loaded
        return null;
      }
    },
  };
}

/**
 * Lightweight health check for the LM Studio embeddings endpoint. Embeds a short
 * test string and reports the vector dimension so the UI can validate that the
 * configured embedding model actually returns vectors before indexing.
 */
export async function testEmbedding(
  serverUrl: string,
  embeddingModel?: string,
): Promise<TestEmbeddingResult> {
  const normalizedUrl = serverUrl.replace(/\/+$/, "");
  const model = (embeddingModel ?? "").trim() || "default";

  try {
    const response = await fetch(`${normalizedUrl}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: "test" }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `LM Studio embeddings error (${response.status}): ${errorText}`,
      };
    }

    const data: EmbeddingResponse = await response.json();
    const dims = data.data?.[0]?.embedding?.length;

    if (!dims) {
      return { ok: false, error: "Embedding response contained no vector." };
    }

    return { ok: true, dims };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function listLMStudioModels(
  serverUrl: string,
): Promise<{ id: string; name: string }[]> {
  const normalizedUrl = serverUrl.replace(/\/+$/, "");

  try {
    const response = await fetch(`${normalizedUrl}/v1/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const data: ModelListResponse = await response.json();
    return (data.data ?? []).map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
    }));
  } catch {
    return [];
  }
}

export async function detectLMStudio(
  serverUrl = "http://localhost:1234",
): Promise<boolean> {
  try {
    const normalizedUrl = serverUrl.replace(/\/+$/, "");
    const response = await fetch(`${normalizedUrl}/v1/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function clearLMStudioProvider(): void {
  cachedUrl = null;
  cachedKey = null;
}