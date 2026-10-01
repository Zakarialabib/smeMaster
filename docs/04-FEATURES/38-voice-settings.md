# Voice Settings

> Desktop voice & speech provider configuration for TTS and STT.
> **Sources:** `src/features/settings/components/VoiceSettings.tsx`, `src/shared/services/ai/voiceService.ts`
> **Status note (2026-10-01):** ⚠️ Five of the six providers throw on at least one
> advertised direction, and the capability badges misreport two of them. See
> [§Implementation status](#implementation-status-2026-10-01) — the tables below that
> describe capability are **the intended contract, not the current behaviour**.
> **Engine decision for offline speech:** [20-offline-stt-and-audio-summarization](../02-BACKEND/20-offline-stt-and-audio-summarization.md)

## Overview

The Voice Settings panel lets users configure Text-to-Speech (TTS) and Speech-to-Text (STT) providers for the AI assistant. It supports multiple provider types, displays capability badges, and persists configuration via the settings store.

**Note:** Desktop voice and Python agent-core are **separate systems** per ADR-001. The `agent-core` voice provider proxies through the Python backend, while all other providers operate directly from the desktop app.

## VoiceSettings Component

**Location:** `src/features/settings/components/VoiceSettings.tsx`

The component renders a `SettingGroup` with:

- Provider selector dropdown
- STT/TTS capability badges (green/red)
- Provider-specific configuration fields
- TTS voice name input
- STT model name input
- Enable/disable toggles for TTS and STT
- Save button with validation

### Capability Badges

The component displays real-time capability detection:

```tsx
<span className={capabilities.stt ? "bg-green-500/20" : "bg-red-500/20"}>
  {capabilities.stt ? "✓" : "✗"} STT
</span>
<span className={capabilities.tts ? "bg-green-500/20" : "bg-red-500/20"}>
  {capabilities.tts ? "✓" : "✗"} TTS
</span>
```

## Voice Provider Types

```typescript
type VoiceProviderType = 'browser' | 'openai' | 'elevenlabs' | 'lmstudio' | 'custom' | 'agent-core';
```

| Provider     | STT | TTS | Auth    | URL                | Description                             |
| ------------ | --- | --- | ------- | ------------------ | --------------------------------------- |
| `browser`    | ✗   | ✓   | None    | None               | Web Speech API — zero-config, on-device |
| `openai`     | ✓   | ✓   | API Key | Default OpenAI     | Whisper STT + TTS voices                |
| `elevenlabs` | ✗   | ✓   | API Key | Default ElevenLabs | High-quality TTS                        |
| `lmstudio`   | ✓   | ✓   | None    | Required           | Local OpenAI-compatible server          |
| `custom`     | ✓   | ✓   | API Key | Required           | Any OpenAI-compatible endpoint          |
| `agent-core` | ✓   | ✓   | None    | None               | Python agent-core proxy                 |

### Provider Selection Logic

```typescript
const needsKey = provider !== 'browser' && provider !== 'lmstudio';
const needsUrl = provider === 'custom' || provider === 'lmstudio';
```

- **Browser** and **LM Studio** don't require an API key
- **Custom** and **LM Studio** require a base URL
- **OpenAI** and **ElevenLabs** use default endpoints

## voiceService.ts — Bridge to Capability System

**Location:** `src/shared/services/ai/voiceService.ts`

The voice service bridges the VoiceSettings UI with the AI capability system. It provides:

### Configuration Loading

```typescript
interface VoiceConfig {
  provider: VoiceProviderType;
  baseUrl: string;
  apiKey: string;
  ttsVoice: string;
  sttModel: string;
  ttsEnabled: boolean;
  sttEnabled: boolean;
}

async function getVoiceConfig(): Promise<VoiceConfig>;
```

Loads all voice settings from the settings store with defaults:

| Setting             | Default                       |
| ------------------- | ----------------------------- |
| `voice_provider`    | `"browser"`                   |
| `voice_base_url`    | `"https://api.openai.com/v1"` |
| `voice_api_key`     | `""`                          |
| `voice_tts_voice`   | `"alloy"`                     |
| `voice_stt_model`   | `"whisper-1"`                 |
| `voice_tts_enabled` | `false`                       |
| `voice_stt_enabled` | `false`                       |

### Capability Detection

```typescript
function getVoiceCapabilities(config: VoiceConfig): { stt: boolean; tts: boolean };
```

Returns whether the selected provider supports STT and TTS:

| Provider     | STT     | TTS                         |
| ------------ | ------- | --------------------------- |
| `browser`    | `false` | `isBrowserVoiceSupported()` |
| `openai`     | `true`  | `true`                      |
| `elevenlabs` | `false` | `true`                      |
| `lmstudio`   | `true`  | `true`                      |
| `custom`     | `true`  | `true`                      |
| `agent-core` | `true`  | `true`                      |

### Unified Voice Interface

```typescript
async function synthesizeSpeech(
  text: string,
  config: VoiceConfig,
  options?: TtsOptions,
): Promise<Blob | null>;
async function transcribeSpeech(
  audio: Blob,
  config: VoiceConfig,
  options?: SttOptions,
): Promise<string | null>;
```

Both functions check the enabled flag before processing and route to the appropriate provider implementation.

### Browser Web Speech API (Fallback)

```typescript
function isBrowserVoiceSupported(): boolean;
function speakWithBrowser(text: string, voice?: string): void;
```

Uses `window.speechSynthesis` for zero-config TTS. Voice selection matches by name substring.

### OpenAI-Compatible TTS/STT

```typescript
async function synthesizeWithOpenAI(
  text: string,
  config: VoiceConfig,
  options?: TtsOptions,
): Promise<Blob>;
async function transcribeWithOpenAI(
  audio: Blob,
  config: VoiceConfig,
  options?: SttOptions,
): Promise<string>;
```

Direct `fetch` calls to `{baseUrl}/audio/speech` and `{baseUrl}/audio/transcriptions`. Used by `openai`, `custom`, and `lmstudio` providers.

## Settings Keys

| Key                 | Type    | Secure | Description               |
| ------------------- | ------- | ------ | ------------------------- |
| `voice_provider`    | string  | No     | Voice provider type       |
| `voice_base_url`    | string  | No     | Voice API base URL        |
| `voice_api_key`     | string  | Yes    | Voice API key (encrypted) |
| `voice_tts_voice`   | string  | No     | TTS voice name            |
| `voice_stt_model`   | string  | No     | STT model name            |
| `voice_tts_enabled` | boolean | No     | TTS toggle                |
| `voice_stt_enabled` | boolean | No     | STT toggle                |

## Implementation status (2026-10-01)

Verified by reading `voiceService.ts`. **This is the current truth; the tables above
describe the intended contract.**

### What actually works

| Provider     | STT           | TTS           | Auth needed            | Notes                                                    |
| ------------ | ------------- | ------------- | ---------------------- | -------------------------------------------------------- |
| `browser`    | ❌ **throws** | ✅ works      | None                   | TTS via `window.speechSynthesis`; STT is a `TODO`        |
| `openai`     | ✅ works      | ✅ works      | API Key                | Real `fetch` to `/audio/transcriptions`, `/audio/speech` |
| `custom`     | ✅ works      | ✅ works      | API Key                | Same OpenAI-compatible path                              |
| `lmstudio`   | ✅ works      | ✅ works      | None, **URL required** | Same path against a local server                         |
| `elevenlabs` | ❌ **throws** | ❌ **throws** | API Key                | No implementation at all                                 |
| `agent-core` | ❌ **throws** | ❌ **throws** | None                   | No implementation at all                                 |

**Consequence:** there is **no zero-config offline STT**. Every working STT path needs
either an API key or a user-installed local server.

### The five stubs (exact locations)

| Location                  | Message                              |
| ------------------------- | ------------------------------------ |
| `voiceService.ts:156-157` | `ElevenLabs TTS not yet implemented` |
| `voiceService.ts:159-160` | `Agent-core TTS not yet implemented` |
| `voiceService.ts:175-176` | `Browser STT not yet implemented`    |
| `voiceService.ts:182-183` | `ElevenLabs STT not yet implemented` |
| `voiceService.ts:185-186` | `Agent-core STT not yet implemented` |

### Capability badges misreport two providers

`getVoiceCapabilities()` is what drives the ✓/✗ badges, and it disagrees with reality:

| Provider     | Badge says                  | Reality    | Problem                                     |
| ------------ | --------------------------- | ---------- | ------------------------------------------- |
| `elevenlabs` | `{ stt: false, tts: true }` | TTS throws | ⚠️ Green **✓ TTS** on a stub                |
| `agent-core` | `{ stt: true, tts: true }`  | Both throw | ⚠️ Reports full capability, implements none |
| `browser`    | `{ stt: false, tts: … }`    | Honest     | ✅                                          |

A user selects ElevenLabs, sees "✓ TTS", and gets a thrown error. Fixing this is
**Phase 0** of [the offline-voice plan](../02-BACKEND/20-offline-stt-and-audio-summarization.md#5-recommended-sequence).

### Model registry: no local speech models

`modelRegistry.ts` registers `whisper-1`, `gpt-4o-transcribe`, `tts-1` and
`gpt-4o-mini-tts` — **all cloud (OpenAI)**. No local speech model is registered, so the
offline engine has no registry entry yet. `ModelCapabilities` already declares
`stt?` / `tts?` / `realtime?`, so adding local entries needs **no type change**.

## Desktop Voice vs Python Agent-Core

Per ADR-001, desktop voice and Python agent-core are **separate systems**:

- **Desktop voice** (this feature) operates entirely within the Tauri app, using the capability system and direct API calls
- **Python agent-core** is a separate server-side system for multi-device sync and server-side AI processing
- The `agent-core` voice provider is a **stub** — it reports full capabilities but throws `"not yet implemented"` for actual TTS/STT operations

## Key Files

| File                                                 | Purpose                                                 |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `src/features/settings/components/VoiceSettings.tsx` | Voice settings UI component                             |
| `src/shared/services/ai/voiceService.ts`             | Voice service bridge, capability detection              |
| `src/shared/services/ai/capabilities.ts`             | `SpeechToTextCapable`, `TextToSpeechCapable` interfaces |
| `src/shared/services/ai/settingsSchema.ts`           | Voice settings schema definitions                       |
| `src/features/settings/components/tabs/AiTab.tsx`    | Parent tab that renders VoiceSettings                   |
