import OpenAI from 'openai';
import type {
  AiProviderClient,
  AiCompletionRequest,
  AiEmbeddingRequest,
  ModelOption,
} from '../types';
import { createProviderFactory } from '../providerFactory';
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

const factory = createProviderFactory(
  (apiKey) =>
    new OpenAI({
      apiKey,
      baseURL: 'https://models.github.ai/inference',
      defaultHeaders: { 'X-GitHub-Api-Version': '2022-11-28' },
      dangerouslyAllowBrowser: true,
    }),
);

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English',
  fr: 'French',
  ar: 'Arabic',
  it: 'Italian',
  ja: 'Japanese',
};

function buildSystemPrompt(basePrompt: string, aiLanguage: string): string {
  if (aiLanguage === 'auto') return basePrompt;
  const langName = LANGUAGE_MAP[aiLanguage];
  if (!langName) return basePrompt;
  return `${basePrompt}\n\nRespond in ${langName}.`;
}

export function createCopilotProvider(
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
  const client = factory.getClient(apiKey);

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
        const response = await client.models.list();
        return response.data.map((m) => ({ id: m.id, label: m.id }));
      } catch {
        return [];
      }
    },

    async getEmbeddings(_req: AiEmbeddingRequest): Promise<EmbeddingResult | null> {
      throw new Error('Embeddings not supported by Copilot');
    },
  };
}

export function clearCopilotProvider(): void {
  factory.clear();
}
