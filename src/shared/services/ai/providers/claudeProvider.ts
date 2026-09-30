// providers/claudeProvider.ts
import Anthropic from "@anthropic-ai/sdk";
import type { AiProviderClient, AiCompletionRequest, AiEmbeddingRequest, ModelOption } from "../types";
import { createProviderFactory } from "../providerFactory";
import { buildSystemPrompt } from "../utils";
import type {
  StreamingCapable,
  SpeechToTextCapable,
  TextToSpeechCapable,
  RealtimeVoiceCapable,
  ModelDiscoveryCapable,
  EmbeddingCapable,
  EmbeddingResult,
  SttOptions,
  TtsOptions,
  RealtimeOptions,
  RealtimeVoiceSession,
} from "../capabilities";

const factory = createProviderFactory(
  (apiKey) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true }),
);

export function createClaudeProvider(
  apiKey: string,
  model: string,
  aiLanguage = "auto",
): AiProviderClient & StreamingCapable & SpeechToTextCapable & TextToSpeechCapable & RealtimeVoiceCapable & ModelDiscoveryCapable & EmbeddingCapable {
  const client = factory.getClient(apiKey);

  return {
    async complete(req: AiCompletionRequest): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      try {
        const response = await client.messages.create({
          model,
          max_tokens: req.maxTokens ?? 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: req.userContent }],
        });

        const textBlock = response.content.find((b) => b.type === "text");
        return textBlock?.text ?? "";
      } catch (err) {
        throw new Error(
          `Claude API error (${model}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },

    async testConnection(): Promise<boolean> {
      try {
        await client.messages.create({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "Say hi" }],
        });
        return true;
      } catch {
        return false;
      }
    },

    async *streamComplete(req: AiCompletionRequest): AsyncIterable<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const stream = client.messages.stream({
        model,
        max_tokens: req.maxTokens ?? 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: req.userContent }],
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
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
        const response = await client.models.list();
        return response.data.map((m) => ({ id: m.id, label: m.display_name ?? m.id }));
      } catch {
        return [];
      }
    },

    async getEmbeddings(_req: AiEmbeddingRequest): Promise<EmbeddingResult | null> {
      throw new Error("Embeddings not supported by Claude");
    },
  };
}

export function clearClaudeProvider(): void {
  factory.clear();
}