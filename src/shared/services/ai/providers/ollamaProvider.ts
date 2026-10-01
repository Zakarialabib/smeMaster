import OpenAI from 'openai';
import type {
  AiProviderClient,
  AiCompletionRequest,
  AiEmbeddingRequest,
  ModelOption,
} from '../types';
import type {
  EmbeddingResult,
  StreamingCapable,
  SpeechToTextCapable,
  TextToSpeechCapable,
  RealtimeVoiceCapable,
  ModelDiscoveryCapable,
  SttOptions,
  TtsOptions,
  RealtimeOptions,
  RealtimeVoiceSession,
} from '../capabilities';
import { buildSystemPrompt } from '../utils';
import { validateUrl } from './openAiCompatibleProvider';

let instance: OpenAI | null = null;
let cachedKey: string | null = null;

function getClient(serverUrl: string, model: string): OpenAI {
  const safeUrl = validateUrl(serverUrl);
  const cacheKey = `${safeUrl}|${model}`;
  if (!instance || cachedKey !== cacheKey) {
    instance = new OpenAI({
      baseURL: `${safeUrl.replace(/\/+$/, '')}/v1`,
      apiKey: 'ollama',
      dangerouslyAllowBrowser: true,
    });
    cachedKey = cacheKey;
  }
  return instance;
}

export function createOllamaProvider(
  serverUrl: string,
  model: string,
  aiLanguage = 'auto',
): AiProviderClient &
  StreamingCapable &
  SpeechToTextCapable &
  TextToSpeechCapable &
  RealtimeVoiceCapable &
  ModelDiscoveryCapable {
  const client = getClient(serverUrl, model);

  async function ollamaEmbeddings(input: string | string[]): Promise<number[][]> {
    const safeUrl = validateUrl(serverUrl);
    const normalizedUrl = safeUrl.replace(/\/+$/, '');
    const texts = Array.isArray(input) ? input : [input];

    const results: number[][] = [];
    for (const text of texts) {
      const response = await fetch(`${normalizedUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: text }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embeddings error (${response.status})`);
      }

      const data = (await response.json()) as { embedding?: number[] };
      if (data.embedding) {
        results.push(data.embedding);
      }
    }

    return results;
  }

  return {
    async complete(req: AiCompletionRequest): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const response = await client.chat.completions.create({
        model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: req.userContent },
        ],
      });

      return response.choices[0]?.message?.content ?? '';
    },

    async testConnection(): Promise<boolean> {
      try {
        await client.chat.completions.create({
          model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say hi' }],
        });
        return true;
      } catch {
        return false;
      }
    },

    async getEmbeddings(req: AiEmbeddingRequest): Promise<EmbeddingResult | null> {
      try {
        const vectors = await ollamaEmbeddings(req.input);
        if (!vectors || vectors.length === 0) return null;
        const dimensions = vectors[0]?.length ?? 0;
        return {
          vectors,
          spaceId: `ollama-${req.model ?? 'default'}-${dimensions}`,
          dimensions,
          modelId: req.model ?? 'default',
        };
      } catch {
        return null;
      }
    },

    async *streamComplete(req: AiCompletionRequest): AsyncIterable<string> {
      const systemPrompt = buildSystemPrompt(req.systemPrompt, aiLanguage);
      const stream = await client.chat.completions.create({
        model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: req.userContent },
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
        const safeUrl = validateUrl(serverUrl);
        const normalizedUrl = safeUrl.replace(/\/+$/, '');
        const response = await fetch(`${normalizedUrl}/api/tags`);
        if (!response.ok) return [];
        const data = (await response.json()) as { models: { name: string }[] };
        return (data.models ?? []).map((m) => ({ id: m.name, label: m.name }));
      } catch {
        return [];
      }
    },
  };
}

export function clearOllamaProvider(): void {
  instance = null;
  cachedKey = null;
}
