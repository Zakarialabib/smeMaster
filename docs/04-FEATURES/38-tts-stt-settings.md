# Voice Settings

> Desktop voice & speech provider configuration for TTS and STT.
> **Sources:** `src/features/settings/components/VoiceSettings.tsx`, `src/shared/services/ai/voiceService.ts`
> **Status note (2026-10-05):** the `agent-core` provider is gone (Python
> backend deleted); ElevenLabs TTS/STT and browser STT are implemented, so the
> stub tables further down are historical. "Voice" here means STT/TTS only —
> the voice-call system was dropped.
> **Engine decision for offline speech:** [20-tts-stt-email](../02-BACKEND/20-tts-stt-email.md)

## Overview

The Voice Settings panel lets users configure Text-to-Speech (TTS) and Speech-to-Text (STT) providers for the AI assistant. It supports multiple provider types, displays capability badges, persists configuration via the settings store, and offers one-click **Test voice** / **Record & transcribe** self-tests that run against the live form values.

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

> **2026-10-05:** the `agent-core` provider row is gone — the Python backend
> was deleted with the voice-call system. Six providers remain.

```typescript
type VoiceProviderType = 'browser' | 'openai' | 'elevenlabs' | 'lmstudio' | 'custom' | 'offline';
```

| Provider     | STT | TTS | Auth    | URL                | Description                              |
| ------------ | --- | --- | ------- | ------------------ | ---------------------------------------- |
| `browser`    | ✓   | ✓   | None    | None               | Web Speech API — zero-config, on-device  |
| `openai`     | ✓   | ✓   | API Key | Default OpenAI     | Whisper STT + TTS voices                 |
| `elevenlabs` | ✓   | ✓   | API Key | Default ElevenLabs | High-quality TTS + STT                   |
| `lmstudio`   | ✓   | ✓   | None    | Required           | Local OpenAI-compatible server           |
| `custom`     | ✓   | ✓   | API Key | Required           | Any OpenAI-compatible endpoint           |
| `offline`    | ✓   | ✓   | None    | None               | On-device sherpa-onnx (model dir needed) |

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

| Provider     | STT    | TTS                         |
| ------------ | ------ | --------------------------- |
| `browser`    | `true` | `isBrowserVoiceSupported()` |
| `openai`     | `true` | `true`                      |
| `elevenlabs` | `true` | `true`                      |
| `lmstudio`   | `true` | `true`                      |
| `custom`     | `true` | `true`                      |
| `offline`    | `true` | `true`                      |

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

### What actually works (2026-10-05)

| Provider     | STT      | TTS      | Auth needed            | Notes                                                    |
| ------------ | -------- | -------- | ---------------------- | -------------------------------------------------------- |
| `browser`    | ✅ works | ✅ works | None                   | Web Speech API — zero-config                             |
| `openai`     | ✅ works | ✅ works | API Key                | Real `fetch` to `/audio/transcriptions`, `/audio/speech` |
| `custom`     | ✅ works | ✅ works | API Key                | Same OpenAI-compatible path                              |
| `lmstudio`   | ✅ works | ✅ works | None, **URL required** | Same path against a local server                         |
| `elevenlabs` | ✅ works | ✅ works | API Key                | ElevenLabs API for both directions                       |
| `offline`    | ✅ works | ✅ works | None                   | sherpa-onnx via ml-sidecar; model dir required           |

### The five historical stubs (all resolved)

> At the time of writing, five code paths threw `not yet implemented`
> (ElevenLabs TTS/STT, browser STT, agent-core both directions). ElevenLabs
> and browser STT have since been implemented; `agent-core` was deleted with
> its backend. Locations kept for archaeology:

| Location                  | Message                              |
| ------------------------- | ------------------------------------ |
| `voiceService.ts:156-157` | `ElevenLabs TTS not yet implemented` |
| `voiceService.ts:159-160` | `Agent-core TTS not yet implemented` |
| `voiceService.ts:175-176` | `Browser STT not yet implemented`    |
| `voiceService.ts:182-183` | `ElevenLabs STT not yet implemented` |
| `voiceService.ts:185-186` | `Agent-core STT not yet implemented` |

### Capability badges — now truthful (was: misreported two providers)

`getVoiceCapabilities()` drives the ✓/✗ badges. It previously disagreed with
reality (green ✓ TTS on the ElevenLabs stub, full marks for the agent-core
stub); the flags were flipped alongside each implementation, and the deleted
provider reports nothing. The truthfulness contract lives on the function —
flip the flag in the same change that implements a stub.

### Model registry: no local speech models

`modelRegistry.ts` registers `whisper-1`, `gpt-4o-transcribe`, `tts-1` and
`gpt-4o-mini-tts` — **all cloud (OpenAI)**. No local speech model is registered, so the
offline engine has no registry entry yet. `ModelCapabilities` already declares
`stt?` / `tts?` / `realtime?`, so adding local entries needs **no type change**.

## Desktop voice only (no Python backend)

> **2026-10-05:** the Python agent-core backend was deleted outright, so
> there is no proxy provider and no separate server-side voice system. All
> providers below operate directly from the desktop app.

## Key Files

| File                                                 | Purpose                                                 |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `src/features/settings/components/VoiceSettings.tsx` | Voice settings UI component                             |
| `src/shared/services/ai/voiceService.ts`             | Voice service bridge, capability detection              |
| `src/shared/services/ai/capabilities.ts`             | `SpeechToTextCapable`, `TextToSpeechCapable` interfaces |
| `src/shared/services/ai/settingsSchema.ts`           | Voice settings schema definitions                       |
| `src/features/settings/components/tabs/AiTab.tsx`    | Parent tab that renders VoiceSettings                   |
