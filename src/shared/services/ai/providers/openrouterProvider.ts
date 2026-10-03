// providers/openrouterProvider.ts
/**
 * OpenRouter Provider — unified gateway to many models.
 *
 * Base URL: https://openrouter.ai/api/v1
 * Docs: https://openrouter.ai/docs
 *
 * OpenRouter is OpenAI-compatible. Model IDs use the provider/model format.
 * No native embeddings, STT, or TTS — text generation only.
 */

import type {
  AiProviderClient,
  AiCompletionRequest,
  AiEmbeddingRequest,
  ModelOption,
} from '../types';
import { buildSystemPrompt } from '../utils';
import { createOpenAICompatibleProvider } from './openAiCompatibleProvider';
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
} from '../capabilities';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export function createOpenRouterProvider(
  apiKey: string,
  model: string,
  aiLanguage = 'auto',
): AiProviderClient &
  StreamingCapable &
  SpeechToTextCapable &
  TextToSpeechCapable &
  RealtimeVoiceCapable &
  ModelDiscoveryCapable &
  EmbeddingCapable {
  const baseProvider = createOpenAICompatibleProvider(
    OPENROUTER_BASE_URL,
    apiKey,
    model,
    aiLanguage,
  );

  return {
    ...baseProvider,

    async *streamComplete(req: AiCompletionRequest): AsyncIterable<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: req.userContent },
          ],
          max_tokens: req.maxTokens ?? 1024,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter streaming error (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
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
      throw new Error('STT not supported by this provider');
    },

    async synthesize(_text: string, _options?: TtsOptions): Promise<Blob> {
      throw new Error('TTS not supported by this provider');
    },

    async startRealtimeSession(_options?: RealtimeOptions): Promise<RealtimeVoiceSession> {
      throw new Error('Realtime voice not supported by this provider');
    },

    async listModels(): Promise<ModelOption[]> {
      try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!response.ok) return [];
        const data = (await response.json()) as { data: { id: string }[] };
        return (data.data ?? []).map((m) => ({ id: m.id, label: m.id }));
      } catch {
        return [];
      }
    },

    async getEmbeddings(_req: AiEmbeddingRequest): Promise<EmbeddingResult | null> {
      throw new Error('Embeddings not supported by OpenRouter');
    },
  };
}

export function clearOpenRouterProvider(): void {
  // No-op — stateless
}
