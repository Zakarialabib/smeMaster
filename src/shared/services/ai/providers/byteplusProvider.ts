// providers/byteplusProvider.ts
/**
 * BytePlus Provider — ByteDance's ModelArk platform (international).
 *
 * Base URL: https://ark.ap-southeast.bytepluses.com/api/v3
 * Docs: https://docs.byteplus.com/en/docs/ModelArk/product-overview
 *
 * Capability-gated: text completion via OpenAI-compatible API.
 * Future: Seed Speech ASR at ~$0.15/hr (75% cheaper than OpenAI STT at scale).
 *
 * NOTE: Model IDs require the versioned suffix (e.g. doubao-seed-2-1-pro-260628).
 * The unversioned form (doubao-seed-2.1-pro) is the marketing name, not the API ID.
 *
 * Extended with StructuredOutputCapable, ToolCallingCapable, and ReasoningCapable.
 */

import type { z } from "zod";
import type { AiProviderClient, ModelOption } from "../types";
import { buildSystemPrompt } from "../utils";
import { createOpenAICompatibleProvider } from "./openAiCompatibleProvider";
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
  ReasoningEffort,
  ToolDefinition,
  ToolCallResult,
  SttOptions,
  TtsOptions,
  RealtimeOptions,
  RealtimeVoiceSession,
} from "../capabilities";

// International BytePlus endpoint (ap-southeast-1)
export const BYTEPLUS_BASE_URL =
  "https://ark.ap-southeast.bytepluses.com/api/v3";

// China Volcengine endpoint (cn-beijing) — use only for mainland clients
export const VOLCENGINE_BASE_URL =
  "https://ark.cn-beijing.volces.com/api/v3";

/**
 * Create a BytePlus provider client.
 *
 * @param apiKey - ARK_API_KEY from the BytePlus console
 * @param model - Versioned model ID (e.g. doubao-seed-2-1-pro-260628)
 * @param aiLanguage - Language override for system prompt
 * @param region - "international" (default) or "china"
 */
export function createBytePlusProvider(
  apiKey: string,
  model: string,
  aiLanguage = "auto",
  region: "international" | "china" = "international",
): AiProviderClient & StructuredOutputCapable & ToolCallingCapable & ReasoningCapable & VisionCapable & ContextCachingCapable & BatchProcessingCapable & StreamingCapable & SpeechToTextCapable & TextToSpeechCapable & RealtimeVoiceCapable & ModelDiscoveryCapable {
  const baseUrl = region === "china" ? VOLCENGINE_BASE_URL : BYTEPLUS_BASE_URL;
  const baseProvider = createOpenAICompatibleProvider(baseUrl, apiKey, model, aiLanguage);

  return {
    ...baseProvider,

    async completeStructured<T>(
      req: { systemPrompt: string; userContent: string; maxTokens?: number },
      schema: z.ZodSchema<T>,
      _options?: { strict?: boolean },
    ): Promise<T> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: req.userContent },
          ],
          max_tokens: req.maxTokens ?? 1024,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        throw new Error(`BytePlus API error (${response.status})`);
      }

      const data = await response.json() as { choices: { message: { content: string } }[] };
      const content = data.choices[0]?.message?.content ?? "{}";
      return schema.parse(JSON.parse(content));
    },

    async completeWithTools(
      req: { systemPrompt: string; userContent: string; maxTokens?: number },
      tools: ToolDefinition[],
      _options?: { toolChoice?: "auto" | "required" | "none" | { name: string } },
    ): Promise<ToolCallResult> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: req.userContent },
          ],
          max_tokens: req.maxTokens ?? 1024,
          tools: tools.map((t) => ({
            type: "function" as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: zodToJsonSchema(t.parameters),
            },
          })),
          tool_choice: _options?.toolChoice,
        }),
      });

      if (!response.ok) {
        throw new Error(`BytePlus API error (${response.status})`);
      }

      const data = await response.json() as {
        choices: {
          message: {
            content: string;
            tool_calls?: { function: { name: string; arguments: string } }[];
          };
        }[];
      };

      const toolCalls = data.choices[0]?.message?.tool_calls?.map((tc) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      })) ?? [];

      return {
        content: data.choices[0]?.message?.content ?? "",
        toolCalls,
      };
    },

    async completeWithReasoning(
      req: { systemPrompt: string; userContent: string; maxTokens?: number },
      effort: ReasoningEffort,
    ): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const reasoningPrompt = getReasoningPrompt(effort);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: `${systemPrompt}\n\n${reasoningPrompt}` },
            { role: "user", content: req.userContent },
          ],
          max_tokens: req.maxTokens ?? 1024,
        }),
      });

      if (!response.ok) {
        throw new Error(`BytePlus API error (${response.status})`);
      }

      const data = await response.json() as { choices: { message: { content: string } }[] };
      return data.choices[0]?.message?.content ?? "";
    },

    async completeWithImage(
      req: { systemPrompt: string; userContent: string; maxTokens?: number },
      image: Blob,
      options?: { detail?: "low" | "high" },
    ): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const base64 = await blobToBase64(image);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
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
          max_tokens: req.maxTokens ?? 1024,
        }),
      });

      if (!response.ok) {
        throw new Error(`BytePlus API error (${response.status})`);
      }

      const data = await response.json() as { choices: { message: { content: string } }[] };
      return data.choices[0]?.message?.content ?? "";
    },

    async completeWithCachedContext(
      req: { systemPrompt: string; userContent: string; maxTokens?: number },
      cachedContext: string,
    ): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: `${systemPrompt}\n\n${cachedContext}` },
            { role: "user", content: req.userContent },
          ],
          max_tokens: req.maxTokens ?? 1024,
        }),
      });

      if (!response.ok) {
        throw new Error(`BytePlus API error (${response.status})`);
      }

      const data = await response.json() as { choices: { message: { content: string } }[] };
      return data.choices[0]?.message?.content ?? "";
    },

    async completeBatch(
      requests: { systemPrompt: string; userContent: string; maxTokens?: number }[],
      options?: { maxConcurrent?: number },
    ): Promise<string[]> {
      const systemPrompt = buildSystemPrompt(requests[0]?.systemPrompt ?? "", aiLanguage);
      const maxConcurrent = options?.maxConcurrent ?? 5;
      const results: string[] = [];

      for (let i = 0; i < requests.length; i += maxConcurrent) {
        const batch = requests.slice(i, i + maxConcurrent);
        const batchResults = await Promise.all(
          batch.map(async (req) => {
            const response = await fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: req.userContent },
                ],
                max_tokens: req.maxTokens ?? 1024,
              }),
            });

            if (!response.ok) {
              throw new Error(`BytePlus API error (${response.status})`);
            }

            const data = await response.json() as { choices: { message: { content: string } }[] };
            return data.choices[0]?.message?.content ?? "";
          }),
        );
        results.push(...batchResults);
      }

      return results;
    },

    async *streamComplete(req: { systemPrompt: string; userContent: string; maxTokens?: number }): AsyncIterable<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: req.userContent },
          ],
          max_tokens: req.maxTokens ?? 1024,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`BytePlus streaming error (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;
            try {
              const parsed = JSON.parse(data) as { choices: { delta: { content?: string } }[] };
              const content = parsed.choices[0]?.delta?.content;
              if (content) yield content;
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
    },

    async transcribe(_audio: Blob, _options?: SttOptions): Promise<string> {
      throw new Error("STT not supported by this provider");
    },

    async synthesize(_text: string, _options?: TtsOptions): Promise<Blob> {
      throw new Error("TTS not supported by this provider");
    },

    async startRealtimeSession(_options?: RealtimeOptions): Promise<RealtimeVoiceSession> {
      throw new Error("Realtime voice not supported by this provider");
    },

    async listModels(): Promise<ModelOption[]> {
      try {
        const response = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!response.ok) return [];
        const data = await response.json() as { data: { id: string }[] };
        return (data.data ?? []).map((m) => ({ id: m.id, label: m.id }));
      } catch {
        return [];
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

function getReasoningPrompt(effort: ReasoningEffort): string {
  switch (effort) {
    case "none":
      return "Respond directly without reasoning.";
    case "low":
      return "Think briefly before responding.";
    case "medium":
      return "Think through the problem step by step before responding.";
    case "high":
      return "Think deeply and thoroughly about this problem. Consider multiple approaches, evaluate trade-offs, and provide a well-reasoned response.";
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

export function clearBytePlusProvider(): void {
  // No-op — stateless provider (delegates to openAiCompatibleProvider)
}
