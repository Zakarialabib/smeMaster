import OpenAI from "openai";
import type { z } from "zod";
import type { AiProviderClient, AiCompletionRequest, AiEmbeddingRequest } from "../types";
import { createProviderFactory } from "../providerFactory";
import { buildSystemPrompt } from "../utils";
import type {
  StructuredOutputCapable,
  ToolCallingCapable,
  ReasoningCapable,
  ReasoningEffort,
  EmbeddingResult,
  ToolDefinition,
  ToolCallResult,
} from "../capabilities";

const factory = createProviderFactory(
  (apiKey) => new OpenAI({ apiKey, dangerouslyAllowBrowser: true }),
);

export function createOpenAIProvider(apiKey: string, model: string, aiLanguage = "auto"): AiProviderClient & StructuredOutputCapable & ToolCallingCapable & ReasoningCapable {
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
        tool_choice: options?.toolChoice,
      });

      const toolCalls = response.choices[0]?.message?.tool_calls?.map((tc) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      })) ?? [];

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
  };
}

/**
 * Convert a Zod schema to JSON Schema for OpenAI structured output.
 * This is a simplified conversion — for production use, consider zod-to-json-schema.
 */
function zodToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
  // Basic Zod to JSON Schema conversion
  // For production, use zod-to-json-schema package
  const def = schema._def;
  switch (def.typeName) {
    case "ZodObject":
      return {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(def.shape()).map(([key, value]) => [
            key,
            zodToJsonSchema(value as z.ZodSchema),
          ]),
        ),
        required: Object.keys(def.shape()),
        additionalProperties: false,
      };
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodArray":
      return {
        type: "array",
        items: zodToJsonSchema(def.type as z.ZodSchema),
      };
    case "ZodEnum":
      return {
        type: "string",
        enum: def.values as string[],
      };
    case "ZodOptional":
      return zodToJsonSchema(def.innerType as z.ZodSchema);
    case "ZodNullable":
      return {
        ...zodToJsonSchema(def.innerType as z.ZodSchema),
        nullable: true,
      };
    default:
      return { type: "object" };
  }
}

export function clearOpenAIProvider(): void {
  factory.clear();
}
