# Adding a New AI Provider

> Step-by-step guide for adding a new AI provider to SMEMaster.
> **Reference:** How Mistral was added (2026-09)

## Overview

Adding a new AI provider involves changes across 5 layers:

1. **Provider implementation** — the actual API client
2. **Type registration** — union types and model lists
3. **Provider manager** — instantiation and caching
4. **Settings schema** — API key and model settings
5. **i18n** — UI labels

## Step 1: Create the Provider Implementation

Create a new file in `src/shared/services/ai/providers/`:

```
src/shared/services/ai/providers/myNewProvider.ts
```

### Provider Pattern

Every provider exports a `create*Provider` function that returns an `AiProviderClient`:

```typescript
// src/shared/services/ai/providers/myNewProvider.ts
import type { AiProviderClient, AiCompletionRequest, AiEmbeddingRequest } from '../types';

export function createMyNewProvider(
  apiKey: string,
  model: string,
  aiLanguage = 'auto',
): AiProviderClient {
  const baseUrl = 'https://api.mynewprovider.com/v1';

  async function complete(req: AiCompletionRequest): Promise<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userContent },
        ],
        max_tokens: req.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`MyNewProvider API error: ${response.status}`);
    }

    const data = (await response.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? '';
  }

  async function testConnection(): Promise<boolean> {
    try {
      await complete({ systemPrompt: 'test', userContent: 'test', maxTokens: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async function getEmbeddings(req: AiEmbeddingRequest): Promise<number[][] | null> {
    // Only implement if the provider supports embeddings
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: req.model ?? 'my-embedding-model',
        input: req.input,
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => d.embedding);
  }

  return { complete, testConnection, getEmbeddings };
}

// Optional: cleanup function for clearProviderClients()
export function clearMyNewProvider(): void {
  // Release any resources (connections, caches, etc.)
}
```

### Key Requirements

- **Must implement:** `complete()` and `testConnection()` (required by `AiProviderClient`)
- **Optionally implement:** `getEmbeddings()` (for RAG support)
- **Return type:** `AiProviderClient` (structural typing — no class needed)
- **Export a `clear*Provider` function** if the provider holds resources

## Step 2: Register in types.ts

**File:** `src/shared/services/ai/types.ts`

### 2a. Add to AiProvider Union

```typescript
export type AiProvider =
  | 'claude'
  | 'openai'
  | 'gemini'
  | 'mistral'
  | 'mynewprovider' // ← add here
  | 'byteplus'
  | 'ollama'
  | 'copilot'
  | 'custom'
  | 'lmstudio'
  | 'openrouter';
```

### 2b. Add to DEFAULT_MODELS

```typescript
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  // ... existing providers ...
  mynewprovider: 'my-default-model', // ← add here
};
```

### 2c. Add to PROVIDER_MODELS

```typescript
export const PROVIDER_MODELS: Record<
  Exclude<AiProvider, 'ollama' | 'custom' | 'lmstudio'>,
  ModelOption[]
> = {
  // ... existing providers ...
  mynewprovider: [
    { id: 'my-model-1', label: 'My Model 1' },
    { id: 'my-model-2', label: 'My Model 2' },
  ],
};
```

### 2d. Add to MODEL_SETTINGS

```typescript
export const MODEL_SETTINGS: Record<
  Exclude<AiProvider, 'ollama' | 'custom' | 'lmstudio'>,
  string
> = {
  // ... existing providers ...
  mynewprovider: 'mynewprovider_model', // ← add here
};
```

## Step 3: Register in providerManager.ts

**File:** `src/shared/services/ai/providerManager.ts`

### 3a. Import the Provider

```typescript
import { createMyNewProvider, clearMyNewProvider } from './providers/myNewProvider';
```

### 3b. Add to API_KEY_SETTINGS

```typescript
const API_KEY_SETTINGS: Record<Exclude<AiProvider, 'ollama' | 'custom' | 'lmstudio'>, string> = {
  // ... existing providers ...
  mynewprovider: 'mynewprovider_api_key', // ← add here
};
```

### 3c. Add to getActiveProviderName()

```typescript
export async function getActiveProviderName(): Promise<AiProvider> {
  const setting = await getSetting('ai_provider');
  if (
    setting === 'openai' ||
    // ... existing providers ...
    setting === 'mynewprovider' // ← add here
  )
    return setting;
  // ...
}
```

### 3d. Add to the Switch Statement

```typescript
switch (providerName) {
  // ... existing cases ...
  case 'mynewprovider':
    client = createMyNewProvider(apiKey, model, aiLanguage);
    break;
}
```

### 3e. Add to clearProviderClients()

```typescript
export function clearProviderClients(): void {
  cachedProvider = null;
  // ... existing clear calls ...
  clearMyNewProvider(); // ← add here
}
```

## Step 4: Add to Settings Schema

**File:** `src/shared/services/ai/settingsSchema.ts`

```typescript
export const AI_SETTINGS_SCHEMA = {
  // ... existing settings ...

  // MyNewProvider settings
  mynewprovider_api_key: { type: 'string', secure: true, description: 'MyNewProvider API key' },
  mynewprovider_model: { type: 'string', secure: false, description: 'MyNewProvider model ID' },
};
```

Also add the provider to the `ai_provider` options:

```typescript
ai_provider: {
  type: "string",
  secure: false,
  description: "Active AI provider",
  options: ["claude", "openai", "gemini", "mistral", "mynewprovider", "ollama", "copilot", "custom", "lmstudio", "openrouter"],
},
```

## Step 5: Add i18n Keys

**Files:** `src/locales/{en,fr,ar,ja,it}/translation.json`

Add provider label and any UI strings:

```json
{
  "settings": {
    "aiProviderMyNewProvider": "MyNewProvider",
    "myNewProviderApiKeyHelp": "Enter your MyNewProvider API key"
  }
}
```

## Step 6: Add Models to Model Registry

**File:** `src/shared/services/ai/modelRegistry.ts`

```typescript
{
  id: "my-model-1",
  provider: "mynewprovider",
  label: "My Model 1",
  tier: "balanced",
  capabilities: { text: true, streaming: true, vision: false, jsonMode: true, toolCalling: true },
  contextWindow: 128_000,
  pricing: { inputPer1M: 1.0, outputPer1M: 3.0 },
},
```

For embedding models, add `embeddingSpaceId`:

```typescript
{
  id: "my-embedding-model",
  provider: "mynewprovider",
  label: "My Embedding Model",
  tier: "balanced",
  capabilities: { text: false, streaming: false, vision: false, jsonMode: false, toolCalling: false, embeddings: { dimensions: 1024 } },
  contextWindow: 8_192,
  embeddingSpaceId: "mynewprovider-embed-1024",
},
```

## Step 7: Testing

### Unit Tests

Create `src/shared/services/ai/providers/myNewProvider.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMyNewProvider } from './myNewProvider';

describe('createMyNewProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an AiProviderClient', () => {
    const client = createMyNewProvider('test-key', 'test-model');
    expect(client).toHaveProperty('complete');
    expect(client).toHaveProperty('testConnection');
    expect(typeof client.complete).toBe('function');
    expect(typeof client.testConnection).toBe('function');
  });

  it('complete() calls the API', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Hello!' } }] }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const client = createMyNewProvider('test-key', 'test-model');
    const result = await client.complete({ systemPrompt: 'test', userContent: 'Hi' });
    expect(result).toBe('Hello!');
  });
});
```

### Integration Test

```typescript
// In your test file
import { getActiveProvider } from './providerManager';

it('creates MyNewProvider when selected', async () => {
  // Mock settings
  vi.mocked(getSetting).mockImplementation(async (key: string) => {
    if (key === 'ai_provider') return 'mynewprovider';
    if (key === 'mynewprovider_model') return 'my-model-1';
    return null;
  });
  vi.mocked(getSecureSetting).mockResolvedValue('test-api-key');

  const provider = await getActiveProvider();
  expect(provider).toBeDefined();
  expect(typeof provider.complete).toBe('function');
});
```

### Manual Verification

1. **Settings UI:** Verify the provider appears in the AI provider dropdown
2. **API Key:** Verify the key is saved securely and loaded correctly
3. **Connection Test:** Verify `testConnection()` works with a real API key
4. **Text Completion:** Verify `complete()` returns expected output
5. **Embeddings (if applicable):** Verify `getEmbeddings()` returns correct dimensions
6. **Cache Invalidation:** Verify `clearProviderClients()` clears the cache

## Example: How Mistral Was Added

Mistral was added as a new provider with the following changes:

1. **Provider:** `src/shared/services/ai/providers/mistralProvider.ts` — `createMistralProvider()` + `clearMistralProvider()`
2. **Types:** Added `"mistral"` to `AiProvider` union, `DEFAULT_MODELS`, `PROVIDER_MODELS`, `MODEL_SETTINGS`
3. **Provider Manager:** Added to `API_KEY_SETTINGS`, `getActiveProviderName()`, switch statement, `clearProviderClients()`
4. **Settings:** Added `mistral_api_key` (secure) and `mistral_model` to schema
5. **Models:** Added `mistral-large-3`, `mistral-small`, `mistral-embed` to model registry
6. **i18n:** Added provider label to all 5 locale files

## Checklist

- [ ] Provider implementation file created with `create*Provider()` and `clear*Provider()`
- [ ] Added to `AiProvider` union in `types.ts`
- [ ] Added to `DEFAULT_MODELS`, `PROVIDER_MODELS`, `MODEL_SETTINGS` in `types.ts`
- [ ] Imported and registered in `providerManager.ts` (API_KEY_SETTINGS, switch, getActiveProviderName, clearProviderClients)
- [ ] Added to `AI_SETTINGS_SCHEMA` in `settingsSchema.ts`
- [ ] Added to `ai_provider` options list
- [ ] Added models to `MODEL_REGISTRY` in `modelRegistry.ts`
- [ ] Added i18n keys to all 5 locale files
- [ ] Unit tests pass (`npx vitest run`)
- [ ] Type check passes (`npx tsc --noEmit`)
- [ ] Lint passes (`npx eslint src --max-warnings=0`)
