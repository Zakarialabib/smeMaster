// providers/mistralProvider.ts
/**
 * Mistral Provider — Mistral AI's API.
 *
 * Base URL: https://api.mistral.ai/v1
 * Docs: https://docs.mistral.ai
 *
 * Uses the OpenAI-compatible endpoint for chat completions.
 * Native Mistral SDK could replace this later for Mistral-specific features
 * (e.g. Voxtral realtime STT), but the OpenAI-compatible path keeps the
 * provider-agnostic contract clean.
 *
 * Extended with StructuredOutputCapable, ToolCallingCapable, and ReasoningCapable.
 */

import type { z } from "zod";
import type { AiProviderClient } from "../types";
import { createOpenAICompatibleProvider } from "./openAiCompatibleProvider";
import type {
  StructuredOutputCapable,
  ToolCallingCapable,
  ReasoningCapable,
  VisionCapable,
  ContextCachingCapable,
  BatchProcessingCapable,
  ReasoningEffort,
  ToolDefinition,
  ToolCallResult,
} from "../capabilities";

const MISTRAL_BASE_URL = "https://api.mistral.ai";

export function createMistralProvider(
  apiKey: string,
  model: string,
  aiLanguage = "auto",
  embeddingModel = "mistral-embed",
): AiProviderClient & StructuredOutputCapable & ToolCallingCapable & ReasoningCapable & VisionCapable & ContextCachingCapable & BatchProcessingCapable {
  const baseProvider = createOpenAICompatibleProvider(
    MISTRAL_BASE_URL,
    apiKey,
    model,
    aiLanguage,
    embeddingModel,
  );

  return {
    ...baseProvider,

    async completeStructured<T>(
      req: { systemPrompt: string; userContent: string; maxTokens?: number },
      schema: z.ZodSchema<T>,
      _options?: { strict?: boolean },
    ): Promise<T> {
      const { buildSystemPrompt } = await import("../utils");
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await fetch(`${MISTRAL_BASE_URL}/v1/chat/completions`, {
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
        throw new Error(`Mistral API error (${response.status})`);
      }

      const data = await response.json() as { choices: { message: { content: string } }[] };
      const content = data.choices[0]?.message?.content ?? "{}";
      return schema.parse(JSON.parse(content));
    },

    async completeWithTools(
      req: AiCompletionRequest,
      tools: ToolDefinition[],
      _options?: { toolChoice?: "auto" | "required" | "none" | { name: string } },
    ): Promise<ToolCallResult> {
      const { buildSystemPrompt } = await import("../utils");
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await fetch(`${MISTRAL_BASE_URL}/v1/chat/completions`, {
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
        throw new Error(`Mistral API error (${response.status})`);
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
      const { buildSystemPrompt } = await import("../utils");
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const reasoningPrompt = getReasoningPrompt(effort);
      const response = await fetch(`${MISTRAL_BASE_URL}/v1/chat/completions`, {
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
        throw new Error(`Mistral API error (${response.status})`);
      }

      const data = await response.json() as { choices: { message: { content: string } }[] };
      return data.choices[0]?.message?.content ?? "";
    },

    async completeWithImage(
      req: { systemPrompt: string; userContent: string; maxTokens?: number },
      image: Blob,
      options?: { detail?: "low" | "high" },
    ): Promise<string> {
      const { buildSystemPrompt } = await import("../utils");
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const base64 = await blobToBase64(image);
      const response = await fetch(`${MISTRAL_BASE_URL}/v1/chat/completions`, {
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
        throw new Error(`Mistral API error (${response.status})`);
      }

      const data = await response.json() as { choices: { message: { content: string } }[] };
      return data.choices[0]?.message?.content ?? "";
    },

    async completeWithCachedContext(
      req: { systemPrompt: string; userContent: string; maxTokens?: number },
      cachedContext: string,
    ): Promise<string> {
      const { buildSystemPrompt } = await import("../utils");
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await fetch(`${MISTRAL_BASE_URL}/v1/chat/completions`, {
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
        throw new Error(`Mistral API error (${response.status})`);
      }

      const data = await response.json() as { choices: { message: { content: string } }[] };
      return data.choices[0]?.message?.content ?? "";
    },

    async completeBatch(
      requests: { systemPrompt: string; userContent: string; maxTokens?: number }[],
      options?: { maxConcurrent?: number },
    ): Promise<string[]> {
      const { buildSystemPrompt } = await import("../utils");
      const maxConcurrent = options?.maxConcurrent ?? 5;
      const results: string[] = [];

      for (let i = 0; i < requests.length; i += maxConcurrent) {
        const batch = requests.slice(i, i + maxConcurrent);
        const batchResults = await Promise.all(
          batch.map(async (req) => {
            const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
            const response = await fetch(`${MISTRAL_BASE_URL}/v1/chat/completions`, {
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
              throw new Error(`Mistral API error (${response.status})`);
            }

            const data = await response.json() as { choices: { message: { content: string } }[] };
            return data.choices[0]?.message?.content ?? "";
          }),
        );
        results.push(...batchResults);
      }

      return results;
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

export function clearMistralProvider(): void {
  // No-op — stateless
}
