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
import type { AiProviderClient, AiCompletionRequest, ModelOption } from "../types";
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

const MISTRAL_BASE_URL = "https://api.mistral.ai";

export function createMistralProvider(
  apiKey: string,
  model: string,
  aiLanguage = "auto",
  embeddingModel = "mistral-embed",
): AiProviderClient & StructuredOutputCapable & ToolCallingCapable & ReasoningCapable & VisionCapable & ContextCachingCapable & BatchProcessingCapable & StreamingCapable & SpeechToTextCapable & TextToSpeechCapable & RealtimeVoiceCapable & ModelDiscoveryCapable {
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

    async *streamComplete(req: AiCompletionRequest): AsyncIterable<string> {
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
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Mistral streaming error (${response.status})`);
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

    async transcribe(audio: Blob, options?: SttOptions): Promise<string> {
      const formData = new FormData();
      formData.append("file", audio, "audio.webm");
      formData.append("model", options?.model ?? "voxtral-realtime");
      if (options?.language) {
        formData.append("language", options.language);
      }

      const response = await fetch(`${MISTRAL_BASE_URL}/v1/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Mistral STT error (${response.status})`);
      }

      const data = await response.json() as { text?: string };
      return data.text ?? "";
    },

    async synthesize(text: string, options?: TtsOptions): Promise<Blob> {
      const response = await fetch(`${MISTRAL_BASE_URL}/v1/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options?.model ?? "voxtral-tts",
          input: text,
          voice: options?.voice,
        }),
      });

      if (!response.ok) {
        throw new Error(`Mistral TTS error (${response.status})`);
      }

      return response.blob();
    },

    async startRealtimeSession(options?: RealtimeOptions): Promise<RealtimeVoiceSession> {
      const ws = new WebSocket(`wss://api.mistral.ai/v1/realtime?model=${encodeURIComponent(options?.model ?? "voxtral-realtime")}&voice=${encodeURIComponent(options?.voice ?? "default")}`);

      let transcriptCb: ((text: string) => void) | null = null;
      let responseCb: ((text: string) => void) | null = null;

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as { type?: string; text?: string };
          if (msg.type === "transcript" && msg.text && transcriptCb) {
            transcriptCb(msg.text);
          } else if (msg.type === "response" && msg.text && responseCb) {
            responseCb(msg.text);
          }
        } catch {
          // skip malformed messages
        }
      };

      return {
        sendAudio(audio: Blob) {
          audio.arrayBuffer().then((buf) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(buf);
            }
          });
        },
        onTranscript(cb: (text: string) => void) {
          transcriptCb = cb;
        },
        onResponse(cb: (text: string) => void) {
          responseCb = cb;
        },
        close() {
          ws.close();
        },
      };
    },

    async listModels(): Promise<ModelOption[]> {
      try {
        const response = await fetch(`${MISTRAL_BASE_URL}/v1/models`, {
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

export function clearMistralProvider(): void {
  // No-op — stateless
}
