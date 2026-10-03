# AI Capability Architecture

> Composable capability interfaces that replace the monolithic `AiProviderClient` contract.
> **Source:** `src/shared/services/ai/capabilities.ts`

## Overview

SMEMaster's AI provider layer uses **narrow, composable capability interfaces** instead of one fat interface that every provider partially implements. A provider implements only the capabilities it actually supports, and the rest of the codebase detects those capabilities at runtime via type guards.

This design follows the **Interface Segregation Principle**: a text-only embedding model doesn't need to pretend it supports streaming, and a local LM Studio instance doesn't need to implement model discovery.

## The 8 Capability Interfaces

| Interface               | Method                                                          | Purpose                                                      |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| `TextCapable`           | `complete(req): Promise<string>`                                | Baseline text generation — all remote providers support this |
| `StreamingCapable`      | `streamComplete(req): AsyncIterable<string>`                    | Live token-by-token streaming output                         |
| `EmbeddingCapable`      | `getEmbeddings(req): Promise<number[][] \| null>`               | Embedding generation for RAG and semantic search             |
| `SpeechToTextCapable`   | `transcribe(audio, options?): Promise<string>`                  | Audio-to-text transcription                                  |
| `TextToSpeechCapable`   | `synthesize(text, options?): Promise<Blob>`                     | Text-to-audio synthesis                                      |
| `RealtimeVoiceCapable`  | `startRealtimeSession(options?): Promise<RealtimeVoiceSession>` | Bidirectional voice sessions                                 |
| `ModelDiscoveryCapable` | `listModels(): Promise<ModelOption[]>`                          | List available models from the provider                      |
| `ConnectionTestable`    | `testConnection(): Promise<boolean>`                            | Connection health check                                      |

### Voice capability — current truth (2026-10-01)

Declaring an interface and **implementing** it are different things, and for voice they
diverge. Verified by reading the providers:

| Interface              | Real implementations                                            | Declared-but-refusing                                                                      |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `SpeechToTextCapable`  | `openai`, `gemini`, `mistral`, `byteplus`, `lmstudio`, `custom` | `claude`, `ollama`, `copilot`, `openrouter` (throw `'STT not supported by this provider'`) |
| `TextToSpeechCapable`  | `openai`, `gemini`, `mistral`, `byteplus`, `lmstudio`, `custom` | `claude`, `ollama`, `copilot`, `openrouter` (same pattern)                                 |
| `RealtimeVoiceCapable` | **none**                                                        | all providers throw                                                                        |

The refusals are **correct behaviour**, not stubs: the interface is satisfied and the
error is truthful, so type guards can be used safely.

Two layers are genuinely **unimplemented**, and both are tracked:

1. **`voiceService.ts` provider dispatch** — five stubs that throw (`elevenlabs` TTS/STT,
   `agent-core` TTS/STT, `browser` STT). Its `getVoiceCapabilities()` used to _advertise_
   two of them; fixed 2026-10-01 so the UI badge matches reality. See
   [Voice settings](../04-FEATURES/38-voice-settings.md) §Implementation status.
2. **No local/offline speech engine** — every working path needs an API key or a
   user-run server. Engine decision, phase plan and locale coverage:
   [20-offline-stt-and-audio-summarization](20-offline-stt-and-audio-summarization.md).

### Voice Helper Types

```typescript
interface SttOptions {
  model?: string;
  language?: string;
}
interface TtsOptions {
  voice?: string;
  model?: string;
}
interface RealtimeOptions {
  model?: string;
  voice?: string;
}

interface RealtimeVoiceSession {
  sendAudio(audio: Blob): void;
  onTranscript(cb: (text: string) => void): void;
  onResponse(cb: (text: string) => void): void;
  close(): void;
}
```

## Capability Union Type

```typescript
type AiCapability =
  'text' | 'streaming' | 'embedding' | 'stt' | 'tts' | 'realtime_voice' | 'model_discovery';
```

## Provider Capability Declaration

Providers can declare their capabilities explicitly for UI display:

```typescript
interface ProviderCapabilities {
  provider: string;
  capabilities: AiCapability[];
  embeddingDims?: number;
}
```

## Type Guards — Runtime Capability Detection

Each capability has a corresponding type guard that checks whether a provider object implements it:

```typescript
function isTextCapable(provider: unknown): provider is TextCapable;
function isStreamingCapable(provider: unknown): provider is StreamingCapable;
function isEmbeddingCapable(provider: unknown): provider is EmbeddingCapable;
function isSpeechToTextCapable(provider: unknown): provider is SpeechToTextCapable;
function isTextToSpeechCapable(provider: unknown): provider is TextToSpeechCapable;
function isRealtimeVoiceCapable(provider: unknown): provider is RealtimeVoiceCapable;
function isModelDiscoveryCapable(provider: unknown): provider is ModelDiscoveryCapable;
function isConnectionTestable(provider: unknown): provider is ConnectionTestable;
```

Each guard checks for a non-null object with the expected method as a function property:

```typescript
export function isEmbeddingCapable(provider: unknown): provider is EmbeddingCapable {
  return (
    typeof provider === 'object' &&
    provider !== null &&
    'getEmbeddings' in provider &&
    typeof (provider as EmbeddingCapable).getEmbeddings === 'function'
  );
}
```

## How Providers Compose Capabilities

Providers are **plain objects** that implement one or more capability interfaces. There is no base class or abstract provider — just structural typing.

### OpenAI — Full Capability Stack

```typescript
const client: AiProviderClient = createOpenAIProvider(apiKey, model);
// Implements: TextCapable, StreamingCapable, EmbeddingCapable,
//             SpeechToTextCapable, TextToSpeechCapable, ConnectionTestable
```

### Mistral — Text + Embedding

```typescript
const client: AiProviderClient = createMistralProvider(apiKey, model);
// Implements: TextCapable, EmbeddingCapable, ConnectionTestable
// Does NOT implement: StreamingCapable, SpeechToTextCapable, TextToSpeechCapable
```

### LM Studio — Text + Embedding (Local)

```typescript
const client: AiProviderClient = createLMStudioProvider(serverUrl, options);
// Implements: TextCapable, EmbeddingCapable, ConnectionTestable
// Does NOT implement: StreamingCapable (varies by model)
```

### Ollama — Text + Embedding (Local)

```typescript
const client: AiProviderClient = createOllamaProvider(serverUrl, model);
// Implements: TextCapable, EmbeddingCapable, ConnectionTestable
```

## AiProviderClient — Backwards Compatibility

The `AiProviderClient` interface remains as a **minimal contract** that all providers must satisfy:

```typescript
interface AiProviderClient {
  complete(req: AiCompletionRequest): Promise<string>;
  testConnection(): Promise<boolean>;
  getEmbeddings?(req: AiEmbeddingRequest): Promise<number[][] | null>;
}
```

This ensures that any provider returned by `getActiveProvider()` can at minimum complete text requests and test its connection. Optional capabilities (embeddings, streaming, voice) are accessed via type guards.

## Checking Capabilities at Runtime

```typescript
import {
  isTextCapable,
  isEmbeddingCapable,
  isStreamingCapable,
  isSpeechToTextCapable,
  isTextToSpeechCapable,
} from '@shared/services/ai/capabilities';
import { getActiveProvider } from '@shared/services/ai/providerManager';

const provider = await getActiveProvider();

// Guard before calling optional methods
if (isEmbeddingCapable(provider)) {
  const vectors = await provider.getEmbeddings({ input: 'hello world' });
  // vectors: number[][] | null
}

if (isStreamingCapable(provider)) {
  for await (const chunk of provider.streamComplete(req)) {
    process.stdout.write(chunk);
  }
}

if (isSpeechToTextCapable(provider)) {
  const text = await provider.transcribe(audioBlob, { model: 'whisper-1' });
}

if (isTextToSpeechCapable(provider)) {
  const audio = await provider.synthesize('Hello!', { voice: 'alloy' });
}
```

## Key Files

| File                                          | Purpose                                                         |
| --------------------------------------------- | --------------------------------------------------------------- |
| `src/shared/services/ai/capabilities.ts`      | Capability interfaces + type guards                             |
| `src/shared/services/ai/types.ts`             | `AiProviderClient`, `AiCompletionRequest`, `AiEmbeddingRequest` |
| `src/shared/services/ai/providerManager.ts`   | Provider instantiation and caching                              |
| `src/shared/services/ai/capabilities.test.ts` | Unit tests for all type guards                                  |
