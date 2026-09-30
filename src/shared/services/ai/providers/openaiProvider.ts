import OpenAI from "openai";
import type { z } from "zod";
import type { AiProviderClient, AiCompletionRequest, AiEmbeddingRequest } from "../types";
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
  ReasoningEffort,
  EmbeddingResult,
  ToolDefinition,
  ToolCallResult,
  SttOptions,
  TtsOptions,
  RealtimeOptions,
  RealtimeVoiceSession,
} from "../capabilities";

const factory = createProviderFactory(
  (apiKey) => new OpenAI({ apiKey, dangerouslyAllowBrowser: true }),
);

export function createOpenAIProvider(apiKey: string, model: string, aiLanguage = "auto"): AiProviderClient & StructuredOutputCapable & ToolCallingCapable & ReasoningCapable & VisionCapable & ContextCachingCapable & BatchProcessingCapable & StreamingCapable & SpeechToTextCapable & TextToSpeechCapable & RealtimeVoiceCapable {
  const client = factory.getClient(apiKey);

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

    async getEmbeddings(req: AiEmbeddingRequest): Promise<EmbeddingResult | null> {
      try {
        const response = await client.embeddings.create({
          model: req.model ?? "text-embedding-3-small",
          input: req.input,
        });
        const vectors = response.data.map((d) => d.embedding);
        const dimensions = vectors[0]?.length ?? 0;
        return {
          vectors,
          spaceId: `openai-${req.model ?? "text-embedding-3-small"}-${dimensions}`,
          dimensions,
          modelId: req.model ?? "text-embedding-3-small",
        };
      } catch {
        return null;
      }
    },

    async completeStructured<T>(
      req: AiCompletionRequest,
      schema: z.ZodSchema<T>,
      options?: { strict?: boolean },
    ): Promise<T> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await client.chat.completions.create({
        model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: req.userContent },
        ],
        response_format: { type: "json_schema", json_schema: { name: "response", strict: options?.strict ?? true, schema: zodToJsonSchema(schema) } },
      });

      const content = response.choices[0]?.message?.content ?? "{}";
      return schema.parse(JSON.parse(content));
    },

    async completeWithTools(
      req: AiCompletionRequest,
      tools: ToolDefinition[],
      options?: { toolChoice?: "auto" | "required" | "none" | { name: string } },
    ): Promise<ToolCallResult> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await client.chat.completions.create({
        model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: req.userContent },
        ],
        tools: tools.map((t) => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: zodToJsonSchema(t.parameters),
          },
        })),
        tool_choice: options?.toolChoice as "auto" | "required" | "none" | undefined,
      });

      const toolCalls = response.choices[0]?.message?.tool_calls?.map((tc) => {
        const fn = "function" in tc ? tc.function : null;
        return {
          name: fn?.name ?? "",
          arguments: fn?.arguments ? JSON.parse(fn.arguments) as Record<string, unknown> : {},
        };
      }) ?? [];

      return {
        content: response.choices[0]?.message?.content ?? "",
        toolCalls,
      };
    },

    async completeWithReasoning(
      req: AiCompletionRequest,
      effort: ReasoningEffort,
    ): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await client.chat.completions.create({
        model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: req.userContent },
        ],
        reasoning_effort: effort,
      });

      return response.choices[0]?.message?.content ?? "";
    },

    async completeWithImage(
      req: AiCompletionRequest,
      image: Blob,
      options?: { detail?: "low" | "high" },
    ): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const base64 = await blobToBase64(image);
      const response = await client.chat.completions.create({
        model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: req.userContent },
              { type: "image_url", image_url: { url: base64, detail: options?.detail ?? "auto" } },
            ],
          },
        ],
      });

      return response.choices[0]?.message?.content ?? "";
    },

    async completeWithCachedContext(
      req: AiCompletionRequest,
      cachedContext: string,
    ): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await client.chat.completions.create({
        model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: "system", content: `${systemPrompt}\n\n${cachedContext}` },
          { role: "user", content: req.userContent },
        ],
      });

      return response.choices[0]?.message?.content ?? "";
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
            const response = await client.chat.completions.create({
              model,
              max_tokens: req.maxTokens ?? 1024,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: req.userContent },
              ],
            });
            return response.choices[0]?.message?.content ?? "";
          }),
        );
        results.push(...batchResults);
      }

      return results;
    },

    async *streamComplete(req: AiCompletionRequest): AsyncIterable<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const stream = await client.chat.completions.create({
        model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: req.userContent },
        ],
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    },

    async transcribe(audio: Blob, options?: SttOptions): Promise<string> {
      const formData = new FormData();
      formData.append("file", audio, "audio.webm");
      formData.append("model", options?.model ?? "whisper-1");
      if (options?.language) {
        formData.append("language", options.language);
      }

      const response = await client.audio.transcriptions.create({
        file: audio as unknown as File,
        model: options?.model ?? "whisper-1",
        language: options?.language,
      });

      return response.text;
    },

    async synthesize(text: string, options?: TtsOptions): Promise<Blob> {
      const response = await client.audio.speech.create({
        model: options?.model ?? "tts-1",
        voice: (options?.voice ?? "alloy") as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
        input: text,
      });

      return new Blob([await response.arrayBuffer()], { type: "audio/mpeg" });
    },

    async startRealtimeSession(options?: RealtimeOptions): Promise<RealtimeVoiceSession> {
      // OpenAI Realtime API requires WebSocket connection
      // This is a simplified implementation — production would use the realtime SDK
      const ws = new WebSocket("wss://api.openai.com/v1/realtime");

      return {
        sendAudio(audio: Blob) {
          // Send audio data via WebSocket
          audio.arrayBuffer().then((buffer) => {
            ws.send(buffer);
          });
        },
        onTranscript(cb: (text: string) => void) {
          ws.addEventListener("message", (event) => {
            const data = JSON.parse(event.data as string) as { type?: string; transcript?: string };
            if (data.type === "transcript" && data.transcript) {
              cb(data.transcript);
            }
          });
        },
        onResponse(cb: (text: string) => void) {
          ws.addEventListener("message", (event) => {
            const data = JSON.parse(event.data as string) as { type?: string; text?: string };
            if (data.type === "response" && data.text) {
              cb(data.text);
            }
          });
        },
        close() {
          ws.close();
        },
      };
    },
  };
}

/**
 * Convert a Blob to a base64 data URL for the OpenAI API.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert a Zod schema to JSON Schema for OpenAI structured output.
 * This is a simplified conversion — for production use, consider zod-to-json-schema.
 */
function zodToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
  // Basic Zod to JSON Schema conversion
  // For production, use zod-to-json-schema package
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
      return {
        type: "array",
        items: zodToJsonSchema(itemType),
      };
    }
    case "ZodEnum": {
      const values = def.values as string[];
      return {
        type: "string",
        enum: values,
      };
    }
    case "ZodOptional": {
      const innerType = def.innerType as z.ZodSchema;
      return zodToJsonSchema(innerType);
    }
    case "ZodNullable": {
      const innerType = def.innerType as z.ZodSchema;
      return {
        ...zodToJsonSchema(innerType),
        nullable: true,
      };
    }
    default:
      return { type: "object" };
  }
}

export function clearOpenAIProvider(): void {
  factory.clear();
}
