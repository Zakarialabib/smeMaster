import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import type { AiProviderClient, AiCompletionRequest } from "../types";
import { createProviderFactory } from "../providerFactory";
import { buildSystemPrompt } from "../utils";
import type {
  StructuredOutputCapable,
  ToolCallingCapable,
  ReasoningCapable,
  ReasoningEffort,
  ToolDefinition,
  ToolCallResult,
} from "../capabilities";

const factory = createProviderFactory(
  (apiKey) => new GoogleGenAI({ apiKey }),
);

export function createGeminiProvider(apiKey: string, modelId: string, aiLanguage = "auto"): AiProviderClient & StructuredOutputCapable & ToolCallingCapable & ReasoningCapable {
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
  };
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
