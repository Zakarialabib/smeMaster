import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import type { AiProviderClient, AiCompletionRequest, AiEmbeddingRequest, ModelOption } from "../types";
import { createProviderFactory } from "../providerFactory";
import { buildSystemPrompt } from "../utils";
import type {
  StructuredOutputCapable,
  ToolCallingCapable,
  ReasoningCapable,
  VisionCapable,
  ContextCachingCapable,
  BatchProcessingCapable,
  StreamingCapable,
  SpeechToTextCapable,
  TextToSpeechCapable,
  RealtimeVoiceCapable,
  ModelDiscoveryCapable,
  EmbeddingCapable,
  ReasoningEffort,
  ToolDefinition,
  ToolCallResult,
  SttOptions,
  TtsOptions,
  RealtimeOptions,
  RealtimeVoiceSession,
  EmbeddingResult,
} from "../capabilities";

const factory = createProviderFactory(
  (apiKey) => new GoogleGenAI({ apiKey }),
);

export function createGeminiProvider(apiKey: string, modelId: string, aiLanguage = "auto"): AiProviderClient & StructuredOutputCapable & ToolCallingCapable & ReasoningCapable & VisionCapable & ContextCachingCapable & BatchProcessingCapable & StreamingCapable & SpeechToTextCapable & TextToSpeechCapable & RealtimeVoiceCapable & ModelDiscoveryCapable & EmbeddingCapable {
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

    async completeStructured<T>(
      req: AiCompletionRequest,
      schema: z.ZodSchema<T>,
      _options?: { strict?: boolean },
    ): Promise<T> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await client.models.generateContent({
        model: modelId,
        contents: req.userContent,
        config: {
          systemInstruction: systemPrompt,
          responseSchema: zodToJsonSchema(schema),
          responseMimeType: "application/json",
        },
      });
      const text = response.text ?? "{}";
      return schema.parse(JSON.parse(text));
    },

    async completeWithTools(
      req: AiCompletionRequest,
      tools: ToolDefinition[],
      _options?: { toolChoice?: "auto" | "required" | "none" | { name: string } },
    ): Promise<ToolCallResult> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await client.models.generateContent({
        model: modelId,
        contents: req.userContent,
        config: {
          systemInstruction: systemPrompt,
          tools: tools.map((t) => ({
            functionDeclarations: [{
              name: t.name,
              description: t.description,
              parameters: zodToJsonSchema(t.parameters),
            }],
          })),
        },
      });

      const functionCalls = response.functionCalls?.map((fc) => ({
        name: fc.name ?? "",
        arguments: (fc.args ?? {}) as Record<string, unknown>,
      })) ?? [];

      return {
        content: response.text ?? "",
        toolCalls: functionCalls,
      };
    },

    async completeWithReasoning(
      req: AiCompletionRequest,
      effort: ReasoningEffort,
    ): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const thinkingConfig = getThinkingConfig(effort);
      const response = await client.models.generateContent({
        model: modelId,
        contents: req.userContent,
        config: {
          systemInstruction: systemPrompt,
          ...thinkingConfig,
        },
      });
      return response.text ?? "";
    },

    async completeWithImage(
      req: AiCompletionRequest,
      image: Blob,
      _options?: { detail?: "low" | "high" },
    ): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const base64 = await blobToBase64(image);
      const response = await client.models.generateContent({
        model: modelId,
        contents: [
          { text: req.userContent },
          { inlineData: { mimeType: "image/png", data: base64.split(",")[1] ?? "" } },
        ],
        config: {
          systemInstruction: systemPrompt,
        },
      });
      return response.text ?? "";
    },

    async completeWithCachedContext(
      req: AiCompletionRequest,
      cachedContext: string,
    ): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await client.models.generateContent({
        model: modelId,
        contents: req.userContent,
        config: {
          systemInstruction: `${systemPrompt}\n\n${cachedContext}`,
        },
      });
      return response.text ?? "";
    },

    async completeBatch(
      requests: AiCompletionRequest[],
      options?: { maxConcurrent?: number },
    ): Promise<string[]> {
      const maxConcurrent = options?.maxConcurrent ?? 5;
      const results: string[] = [];

      for (let i = 0; i < requests.length; i += maxConcurrent) {
        const batch = requests.slice(i, i + maxConcurrent);
        const batchResults = await Promise.all(
          batch.map(async (req) => {
            const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
            const response = await client.models.generateContent({
              model: modelId,
              contents: req.userContent,
              config: {
                systemInstruction: systemPrompt,
              },
            });
            return response.text ?? "";
          }),
        );
        results.push(...batchResults);
      }

      return results;
    },

    async *streamComplete(req: AiCompletionRequest): AsyncIterable<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const stream = await client.models.generateContentStream({
        model: modelId,
        contents: req.userContent,
        config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
      });
      for await (const chunk of stream) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
    },

    async transcribe(audio: Blob, _options?: SttOptions): Promise<string> {
      const base64 = await blobToBase64(audio);
      const response = await client.models.generateContent({
        model: modelId,
        contents: [
          { text: "Transcribe this audio" },
          { inlineData: { mimeType: "audio/webm", data: base64.split(",")[1] ?? "" } },
        ],
      });
      return response.text ?? "";
    },

    async synthesize(_text: string, _options?: TtsOptions): Promise<Blob> {
      throw new Error("TTS not supported by this provider");
    },

    async startRealtimeSession(_options?: RealtimeOptions): Promise<RealtimeVoiceSession> {
      throw new Error("Realtime voice not supported by this provider");
    },

    async listModels(): Promise<ModelOption[]> {
      const models: ModelOption[] = [];
      const response = await client.models.list();
      for await (const model of response) {
        if (model.name) {
          models.push({ id: model.name, label: model.name });
        }
      }
      return models;
    },

    async getEmbeddings(req: AiEmbeddingRequest): Promise<EmbeddingResult | null> {
      try {
        const response = await client.models.embedContent({
          model: "gemini-embedding-2",
          contents: Array.isArray(req.input) ? req.input : [req.input],
        });
        const vectors = response.embeddings?.map((e) => e.values ?? []) ?? [];
        const dimensions = vectors[0]?.length ?? 0;
        return {
          vectors,
          spaceId: `gemini-embedding-2-${dimensions}`,
          dimensions,
          modelId: "gemini-embedding-2",
        };
      } catch {
        return null;
      }
    },
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getThinkingConfig(effort: ReasoningEffort): Record<string, unknown> {
  switch (effort) {
    case "none":
      return { thinkingConfig: { includeThoughts: false } };
    case "low":
      return { thinkingConfig: { includeThoughts: true, thinkingBudget: 1024 } };
    case "medium":
      return { thinkingConfig: { includeThoughts: true, thinkingBudget: 4096 } };
    case "high":
      return { thinkingConfig: { includeThoughts: true, thinkingBudget: 8192 } };
  }
}

function zodToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
  const def = schema._def as Record<string, unknown>;
  const typeName = def.typeName as string;
  switch (typeName) {
    case "ZodObject": {
      const shape = def.shape as () => Record<string, z.ZodSchema>;
      const s = shape();
      return {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(s).map(([key, value]) => [
            key,
            zodToJsonSchema(value),
          ]),
        ),
        required: Object.keys(s),
        additionalProperties: false,
      };
    }
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodArray": {
      const itemType = def.type as z.ZodSchema;
      return { type: "array", items: zodToJsonSchema(itemType) };
    }
    case "ZodEnum": {
      const values = def.values as string[];
      return { type: "string", enum: values };
    }
    case "ZodOptional": {
      const innerType = def.innerType as z.ZodSchema;
      return zodToJsonSchema(innerType);
    }
    case "ZodNullable": {
      const innerType = def.innerType as z.ZodSchema;
      return { ...zodToJsonSchema(innerType), nullable: true };
    }
    default:
      return { type: "object" };
  }
}

export function clearGeminiProvider(): void {
  factory.clear();
}
