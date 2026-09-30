# AI Provider Capability Architecture — Implementation Plan

> **Date:** 2026-09-30
> **Status:** Draft — ready for review
> **Author:** docs-curator agent
> **Scope:** Desktop AI provider layer evolution (TypeScript side)
> **Excludes:** Python `agent-core` server-side work (ADR-001 D1 forbids unification)

---

## Executive Summary

The current desktop AI layer uses a single `AiProviderClient` interface with `complete()` and optional `getEmbeddings()`. This plan proposes evolving to a **capability-based architecture** with typed capability interfaces, a data-driven model registry, and per-task provider+model routing.

**Critical finding:** The Python `agent-core` voice service and the TypeScript desktop AI layer are **two separate systems** that must remain separate (ADR-001 D1). The capability architecture proposed here is TypeScript-only and does not merge with the Python side.

---

## 1. Documentation Status

### 1.1 What Exists

| Doc                  | Path                                                                      | Status      | Covers                                 |
| -------------------- | ------------------------------------------------------------------------- | ----------- | -------------------------------------- |
| AI Integration       | `docs/04-FEATURES/22-ai-integration.md`                                   | ✅ Current  | Provider model, surfaces, boundaries   |
| AI RAG Overview      | `docs/04-FEATURES/ai-rag.md`                                              | ✅ Current  | RAG architecture, data flows           |
| AI RAG Backend       | `docs/02-BACKEND/ai-rag.md`                                               | ✅ Current  | Rust candle/LanceDB                    |
| AI RAG Frontend      | `docs/03-FRONTEND/ai-rag.md`                                              | ✅ Current  | TS wrappers, store, components         |
| Prompt Engineering   | `docs/03-FRONTEND/ai-prompt-engineering.md`                               | ✅ Current  | All AI prompts                         |
| Context Engineering  | `docs/03-FRONTEND/ai-context-engineering.md`                              | ✅ Current  | Context construction                   |
| AI Settings Refactor | `docs/superpowers/specs/2026-07-13-ai-settings-refactor-design.md`        | ✅ Approved | LM Studio embedding model + page reorg |
| Voice Agent Spec     | `docs/specs/2026-09-28-voice-agent.md`                                    | ✅ Current  | Full voice agent spec                  |
| Voice README         | `docs/voice/README.md`                                                    | ✅ Current  | Folder map, reading order              |
| ADR-001              | `docs/01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md` | ✅ Accepted | Integration seams, 3 embedding spaces  |
| Voice Design         | `docs/voice/design/BACKEND.md`                                            | ✅ Current  | 4 seams, topology                      |
| Voice Frontend       | `docs/voice/design/FRONTEND.md`                                           | ✅ Current  | Speech abstraction, component tree     |

### 1.2 What's Stale

| Doc                            | Issue                                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/STATUS.md`               | Last updated 2026-07-14; carries stale metrics (831 commands vs 841 actual, 42 stores vs 44 actual, 735 Rust tests vs 915 actual). Header in `00-INDEX.md` flags this. |
| `docs/PRODUCTION-READINESS.md` | Says "735 Rust tests" — actual is 915 `#[test]` attributes. Says "3,205 tests" in Gate 9 — actual TS count is ~3,344.                                                  |

### 1.3 What's Missing

| Gap                           | Needed Doc                                              |
| ----------------------------- | ------------------------------------------------------- |
| Capability-based architecture | New: `docs/02-BACKEND/13-ai-capability-architecture.md` |
| Task routing                  | New: `docs/02-BACKEND/14-ai-task-router.md`             |
| Model registry                | New: `docs/02-BACKEND/15-ai-model-registry.md`          |
| Voice settings (desktop)      | New: `docs/04-FEATURES/38-voice-settings.md`            |
| Provider expansion guide      | New: `docs/05-DEVELOPMENT/08-ai-provider-adding.md`     |

---

## 2. Git Branch Status

### 2.1 Current State

```
Branch: private/voice-agent-client (ahead of origin by 1 commit)
Main branches: dev, main, dev-1, dev-2
Feature branches: feature-invoicing-morocco-dgi, pos-hardware-integration
Docs branch: docs/consolidation-architecture-audit
Release branch: release-please--branches--dev--components--smemaster
```

### 2.2 Recent Commits (last 20)

The recent commit history is dominated by agent-core (Python) and voice console work:

```
8f98450 docs(architecture): update and correct architecture docs
bf40e11 test(orchestrator): use the dead test fixtures
d052433 fix(tests): repair broken sidecar and automation tests
a95a717 feat(agent): C1 - console state primitives + the Ops screen
b05272d docs(agent): BUILD-LOG
d6ac079 fix: clean up code and fix critical sidecar bugs
df13292 feat: add useAgentResource hook + refactor ml-sidecar service
fd9c38f fix(agent): Rust IPC client COMPILES
8b5fd70 feat(agent): add secure managed bearer token handling
93dd95e feat(voice-console): add brainstorm docs, knowledge page
bfbfbbf docs(agent): Phase B closed
63c41cf style(agent-core): ruff --fix
c743673 feat(agent): B6 - transcript WebSocket
3411e8b feat(agent): B5 - console's HTTP client
31c92b4 docs(agent): RUNNING-DEV.md
cac933a test(agent): B5 - console fixtures
a05e260 feat(agent-core): B4 - calls, metering, knowledge
d49ce6e test(agent-core): live swap check (15/15 pass)
da70fd1 feat(agent): desktop IPC client for agent-core
9a01bc0 feat(agent-core): licence gate
```

### 2.3 Working Tree

- **Staged:** 3 docs files (quickstart, testing, manual-tests)
- **Unstaged:** 15+ files including docs reorganization, voice docs, agent-core `__init__.py`
- **Untracks:** 3 new roadmap docs (voice OSS landscape, WhatsApp landscape, topology decision)

### 2.4 Divergence Points

The `private/voice-agent-client` branch has diverged from `dev` with:

- Python `agent-core` service (new directory `services/agent-core/`)
- Voice console prototype (`prototype/voice-console/`)
- Voice docs (`docs/voice/`)
- Agent feature module (`src/features/agent/`)
- Rust IPC client for agent-core
- `ml-sidecar` Rust crate (Candle + LanceDB sidecar)

**Key insight:** The voice work is a **separate service** that communicates with the desktop via HTTP/WebSocket, not via Tauri IPC. The desktop AI layer (`src/shared/services/ai/`) and the voice agent-core are **two different architectures**.

---

## 3. Voice Work Assessment

### 3.1 Where Voice Code Lives

| Layer               | Location                                             | Language         | Protocol            |
| ------------------- | ---------------------------------------------------- | ---------------- | ------------------- |
| Server runtime      | `services/agent-core/`                               | Python 3.12      | HTTP + WebSocket    |
| Server providers    | `services/agent-core/agent_core/providers/`          | Python ABCs      | —                   |
| Desktop settings UI | `src/features/settings/components/VoiceSettings.tsx` | TypeScript/React | —                   |
| Desktop prototype   | `prototype/voice-console/`                           | TypeScript/React | —                   |
| Rust IPC client     | `src-tauri/src/` (agent commands)                    | Rust             | Tauri IPC           |
| ml-sidecar          | `src-tauri/crates/ml-sidecar/`                       | Rust             | JSON-RPC over stdio |

### 3.2 Architecture Divergence

**Desktop AI (TypeScript):**

- Single `AiProviderClient` interface
- One active provider at a time
- 8 providers: claude, openai, gemini, ollama, copilot, custom, lmstudio, openrouter
- `complete()` + optional `getEmbeddings()`
- Provider selected via `ai_provider` setting
- No capability detection — all providers treated uniformly

**Server AI (Python agent-core):**

- 4 seams: LLM, TTS, STT, Embedding
- Each seam is an ABC with multiple implementations
- Chain-based fallback (no silent failover)
- `ProviderRegistry` — swap by config value alone
- `Capabilities` dataclass — per-host capability detection
- `ProviderConfig` — chain + options per seam

### 3.3 Divergence Analysis

The two systems are **intentionally separate** (ADR-001 D1):

> `agent-core` is a 24/7 service on our VPS. It is **not** launched or supervised by Tauri, has no stdio JSON-RPC transport, and is **not** a Cargo workspace member.

**They share:**

- The same conceptual provider names (OpenAI, Gemini, etc.)
- The same need for API key management
- The same embedding dimension problem (ADR-001 D2)

**They do NOT share:**

- Runtime (TypeScript vs Python)
- Transport (Tauri IPC vs HTTP/WS)
- Provider interface shape
- Fallback strategy (single vs chain)
- Capability model

### 3.4 VoiceSettings.tsx Relationship

`src/features/settings/components/VoiceSettings.tsx` is a **desktop-side** settings UI for voice providers. It manages:

- `voice_provider` (browser, openai, elevenlabs, lmstudio, custom)
- `voice_api_key` (encrypted)
- `voice_tts_voice`, `voice_stt_model`
- `voice_tts_enabled`, `voice_stt_enabled`

This is **separate** from the Python agent-core provider chain. The desktop VoiceSettings configures the desktop's own voice capabilities (for the AI assistant's spoken replies), while agent-core has its own server-side provider chain.

**Gap:** VoiceSettings.tsx is a standalone component not yet integrated into the capability architecture. It uses its own provider enum (`VoiceProvider`) that doesn't overlap with `AiProvider`.

---

## 4. Settings Schema Findings

### 4.1 Storage Mechanism

Settings are stored in SQLite `settings` table (key-value pairs). Secure settings use **app-level AES-256-GCM encryption** (NOT Tauri keychain):

```typescript
// src/features/settings/db/settings.ts
export async function getSecureSetting(key: string): Promise<string | null> {
  const raw = await getSetting(key);
  if (!raw) return null;
  if (isEncrypted(raw)) {
    try {
      return await decryptValue(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}
```

Encryption key is:

- Randomly generated on first launch (256-bit)
- Stored in `<app_data_dir>/smemaster.key` via Tauri filesystem API
- Derived at runtime, NOT in app bundle, NOT in git
- Uses Web Crypto API (`crypto.getRandomValues`)

### 4.2 Current AI Settings Keys

| Key                        | Type    | Secure  | Used By              |
| -------------------------- | ------- | ------- | -------------------- |
| `ai_provider`              | string  | No      | `providerManager.ts` |
| `ai_enabled`               | boolean | No      | `providerManager.ts` |
| `ai_language`              | string  | No      | `providerManager.ts` |
| `ai_auto_categorize`       | boolean | No      | `aiService.ts`       |
| `ai_auto_summarize`        | boolean | No      | `aiService.ts`       |
| `ai_auto_draft_enabled`    | boolean | No      | `aiService.ts`       |
| `ai_writing_style_enabled` | boolean | No      | `aiService.ts`       |
| `ai_smart_replies_enabled` | boolean | No      | `aiService.ts`       |
| `ai_ask_inbox_enabled`     | boolean | No      | `aiService.ts`       |
| `openai_model`             | string  | No      | `providerManager.ts` |
| `gemini_model`             | string  | No      | `providerManager.ts` |
| `claude_model`             | string  | No      | `providerManager.ts` |
| `copilot_model`            | string  | No      | `providerManager.ts` |
| `openrouter_model`         | string  | No      | `providerManager.ts` |
| `ollama_model`             | string  | No      | `providerManager.ts` |
| `ollama_server_url`        | string  | No      | `providerManager.ts` |
| `lmstudio_model`           | string  | No      | `providerManager.ts` |
| `lmstudio_server_url`      | string  | No      | `providerManager.ts` |
| `lmstudio_embedding_model` | string  | No      | `providerManager.ts` |
| `custom_model`             | string  | No      | `providerManager.ts` |
| `custom_base_url`          | string  | No      | `providerManager.ts` |
| `openai_api_key`           | string  | **Yes** | `providerManager.ts` |
| `gemini_api_key`           | string  | **Yes** | `providerManager.ts` |
| `claude_api_key`           | string  | **Yes** | `providerManager.ts` |
| `copilot_api_key`          | string  | **Yes** | `providerManager.ts` |
| `openrouter_api_key`       | string  | **Yes** | `providerManager.ts` |
| `custom_api_key`           | string  | **Yes** | `providerManager.ts` |
| `voice_provider`           | string  | No      | `VoiceSettings.tsx`  |
| `voice_api_key`            | string  | **Yes** | `VoiceSettings.tsx`  |
| `voice_tts_voice`          | string  | No      | `VoiceSettings.tsx`  |
| `voice_stt_model`          | string  | No      | `VoiceSettings.tsx`  |
| `voice_tts_enabled`        | boolean | No      | `VoiceSettings.tsx`  |
| `voice_stt_enabled`        | boolean | No      | `VoiceSettings.tsx`  |

### 4.3 Gaps in Settings Schema

| Gap                             | Impact                                                   | Needed For                      |
| ------------------------------- | -------------------------------------------------------- | ------------------------------- |
| No capability metadata          | Can't declare which providers support which capabilities | Capability-based routing        |
| No task routing config          | All tasks go to the same provider                        | Per-task provider+model routing |
| No model registry               | Models are hardcoded in `PROVIDER_MODELS`                | Data-driven model definitions   |
| No embedding dimension tracking | RAG dimension is implicit                                | Multi-dimension RAG             |
| No provider priority/fallback   | Single provider, no fallback                             | Resilient AI calls              |
| Voice settings isolated         | Voice providers separate from AI providers               | Unified capability view         |

---

## 5. RAG Backend Findings

### 5.1 Current Embedding Model

- **Model:** `BAAI/bge-small-en-v1.5` (384-dim, ~130MB, int8-quantized)
- **Runtime:** Rust candle (`src-tauri/src/ai/local_engine.rs`)
- **Vector DB:** LanceDB (`src-tauri/src/ai/vector_db.rs`)
- **Model download:** Hugging Face Hub via `hf_hub` crate

### 5.2 Dimension Handling

The Rust vector DB supports **multiple dimensions** via table-per-dimension:

```rust
// src-tauri/src/ai/vector_db.rs:43
pub fn table_name(dim: usize) -> String {
    format!("knowledge_base_{dim}")
}
```

Three embedding spaces exist (ADR-001 D2):

| Space | Runtime                   | Dim                              | Selected by                    |
| ----- | ------------------------- | -------------------------------- | ------------------------------ |
| A     | Desktop candle BGE-small  | **384** (fixed)                  | `embeddingSource = "rust_bge"` |
| B     | Desktop provider endpoint | **N** (whatever endpoint serves) | `embeddingSource = "provider"` |
| C     | Server agent-core         | **1024** (bge-m3)                | Server config                  |

### 5.3 Key Insight

The desktop RAG dimension is **NOT fixed at 384**. It depends on the `embeddingSource` setting:

- `rust_bge` → 384-dim (candle BGE-small)
- `provider` → N-dim (whatever the provider's embedding endpoint returns)

This means any code that hardcodes 384 is a latent runtime failure. The `vector_db.rs` already handles this correctly with `ensure_table(dim)`.

---

## 6. Package Constraints

### 6.1 Current AI Dependencies

| Package                 | Version | Purpose              |
| ----------------------- | ------- | -------------------- |
| `@anthropic-ai/sdk`     | ^0.74.0 | Claude API           |
| `@google/generative-ai` | ^0.24.1 | Gemini API (old SDK) |
| `openai`                | ^6.38.0 | OpenAI API           |

### 6.2 Missing Dependencies

| Package                | Purpose        | Recommended                               |
| ---------------------- | -------------- | ----------------------------------------- |
| `@mistralai/mistralai` | Mistral API    | Latest                                    |
| `@google/genai`        | New Gemini SDK | Latest (replaces `@google/generative-ai`) |

### 6.3 Evaluation Notes

- `@google/generative-ai` (v0.24.1) is the **old** Gemini SDK. Google recommends migrating to `@google/genai`.
- `@mistralai/mistralai` is the official Mistral SDK, supports chat completions and embeddings.
- Both are tree-shakeable ESM packages, compatible with Vite.
- Adding these increases bundle size by ~50-80KB (gzipped) — acceptable for a desktop app.

---

## 7. Implementation Plan

### Phase 1: Capability Interfaces + Model Registry (TypeScript)

**Goal:** Define typed capability interfaces and a data-driven model registry.

**Files to create:**

- `src/shared/services/ai/capabilities.ts` — Capability interfaces
- `src/shared/services/ai/modelRegistry.ts` — Data-driven model definitions
- `src/shared/services/ai/capabilities.test.ts` — Tests

**Capability interfaces:**

```typescript
// src/shared/services/ai/capabilities.ts

export interface TextCapable {
  complete(req: AiCompletionRequest): Promise<string>;
}

export interface EmbeddingCapable {
  getEmbeddings(req: AiEmbeddingRequest): Promise<number[][] | null>;
}

export interface SpeechToTextCapable {
  transcribe(audio: Blob, options?: SttOptions): Promise<string>;
}

export interface TextToSpeechCapable {
  synthesize(text: string, options?: TtsOptions): Promise<Blob>;
}

export interface RealtimeVoiceCapable {
  startRealtimeSession(options?: RealtimeOptions): Promise<RealtimeVoiceSession>;
}

export interface ModelDiscoveryCapable {
  listModels(): Promise<ModelOption[]>;
}

export interface ConnectionTestable {
  testConnection(): Promise<boolean>;
}

// Composite capability type
export type Capability =
  | 'text'
  | 'embedding'
  | 'stt'
  | 'tts'
  | 'realtime_voice'
  | 'model_discovery';

// Provider capabilities declaration
export interface ProviderCapabilities {
  provider: AiProvider;
  capabilities: Capability[];
  embeddingDims?: number; // if embedding-capable
}
```

**Model registry:**

```typescript
// src/shared/services/ai/modelRegistry.ts

export interface ModelDefinition {
  id: string;
  provider: AiProvider;
  label: string;
  capabilities: Capability[];
  embeddingDims?: number; // for embedding models
  maxTokens?: number;
  costPer1kTokens?: { input: number; output: number };
}

export const MODEL_REGISTRY: ModelDefinition[] = [
  // OpenAI
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    label: 'GPT-4o Mini',
    capabilities: ['text'],
    maxTokens: 128000,
  },
  { id: 'gpt-4o', provider: 'openai', label: 'GPT-4o', capabilities: ['text'], maxTokens: 128000 },
  {
    id: 'gpt-4.1-nano',
    provider: 'openai',
    label: 'GPT-4.1 Nano',
    capabilities: ['text'],
    maxTokens: 128000,
  },
  {
    id: 'text-embedding-3-small',
    provider: 'openai',
    label: 'Embedding 3 Small',
    capabilities: ['embedding'],
    embeddingDims: 1536,
  },
  { id: 'whisper-1', provider: 'openai', label: 'Whisper STT', capabilities: ['stt'] },
  { id: 'tts-1', provider: 'openai', label: 'TTS', capabilities: ['tts'] },

  // Gemini
  {
    id: 'gemini-2.5-flash',
    provider: 'gemini',
    label: 'Gemini 2.5 Flash',
    capabilities: ['text'],
    maxTokens: 1000000,
  },
  {
    id: 'gemini-2.5-pro',
    provider: 'gemini',
    label: 'Gemini 2.5 Pro',
    capabilities: ['text'],
    maxTokens: 1000000,
  },

  // Mistral
  {
    id: 'mistral-small',
    provider: 'mistral',
    label: 'Mistral Small',
    capabilities: ['text'],
    maxTokens: 32000,
  },
  {
    id: 'mistral-embed',
    provider: 'mistral',
    label: 'Mistral Embed',
    capabilities: ['embedding'],
    embeddingDims: 1024,
  },

  // Ollama (local)
  { id: 'llama3.2', provider: 'ollama', label: 'Llama 3.2', capabilities: ['text', 'embedding'] },

  // LM Studio (local)
  // Models are user-defined, discovered via ModelDiscoveryCapable
];
```

**Provider capability declarations:**

```typescript
export const PROVIDER_CAPABILITIES: Record<AiProvider, Capability[]> = {
  claude: ['text'],
  openai: ['text', 'embedding', 'stt', 'tts'],
  gemini: ['text'],
  ollama: ['text', 'embedding'],
  copilot: ['text'],
  custom: ['text', 'embedding'], // OpenAI-compatible
  lmstudio: ['text', 'embedding', 'model_discovery'],
  openrouter: ['text'],
  mistral: ['text', 'embedding'], // NEW
};
```

### Phase 2: Task Router

**Goal:** Per-task provider+model routing (e.g., `email.classify` → `openai:gpt-4.1-nano`).

**Files to create:**

- `src/shared/services/ai/taskRouter.ts` — Task routing logic
- `src/shared/services/ai/taskRouter.test.ts` — Tests

**Design:**

```typescript
// src/shared/services/ai/taskRouter.ts

export type AiTask =
  | 'email.classify'
  | 'email.summarize'
  | 'email.compose'
  | 'email.reply'
  | 'email.smart_reply'
  | 'email.improve'
  | 'email.shorten'
  | 'email.formalize'
  | 'email.ask_inbox'
  | 'email.extract_task'
  | 'email.smart_label'
  | 'rag.query'
  | 'voice.stt'
  | 'voice.tts';

export interface TaskRoute {
  task: AiTask;
  provider: AiProvider;
  model: string;
  fallback?: { provider: AiProvider; model: string };
}

// Default routing table (user-overridable via settings)
export const DEFAULT_TASK_ROUTES: Record<AiTask, TaskRoute> = {
  'email.classify': { task: 'email.classify', provider: 'openai', model: 'gpt-4.1-nano' },
  'email.summarize': { task: 'email.summarize', provider: 'openai', model: 'gpt-4o-mini' },
  'email.compose': { task: 'email.compose', provider: 'claude', model: 'claude-sonnet-4-20250514' },
  'email.reply': { task: 'email.reply', provider: 'claude', model: 'claude-sonnet-4-20250514' },
  'email.smart_reply': { task: 'email.smart_reply', provider: 'openai', model: 'gpt-4.1-nano' },
  'email.improve': { task: 'email.improve', provider: 'openai', model: 'gpt-4o-mini' },
  'email.shorten': { task: 'email.shorten', provider: 'openai', model: 'gpt-4.1-nano' },
  'email.formalize': { task: 'email.formalize', provider: 'openai', model: 'gpt-4.1-nano' },
  'email.ask_inbox': { task: 'email.ask_inbox', provider: 'openai', model: 'gpt-4o' },
  'email.extract_task': { task: 'email.extract_task', provider: 'openai', model: 'gpt-4.1-nano' },
  'email.smart_label': { task: 'email.smart_label', provider: 'openai', model: 'gpt-4.1-nano' },
  'rag.query': { task: 'rag.query', provider: 'openai', model: 'gpt-4o-mini' },
  'voice.stt': { task: 'voice.stt', provider: 'openai', model: 'whisper-1' },
  'voice.tts': { task: 'voice.tts', provider: 'openai', model: 'tts-1' },
};

// User overrides stored in settings as JSON
const TASK_ROUTE_SETTINGS_KEY = 'ai_task_routes';

export async function getTaskRoute(task: AiTask): Promise<TaskRoute> {
  const overrides = await getTaskRouteOverrides();
  return overrides[task] ?? DEFAULT_TASK_ROUTES[task];
}

export async function setTaskRoute(task: AiTask, route: TaskRoute): Promise<void> {
  const overrides = await getTaskRouteOverrides();
  overrides[task] = route;
  await setSetting(TASK_ROUTE_SETTINGS_KEY, JSON.stringify(overrides));
}
```

### Phase 3: Provider Expansion

**Goal:** Add Mistral and new Gemini SDK support.

**Files to create:**

- `src/shared/services/ai/providers/mistralProvider.ts` — Mistral provider
- `src/shared/services/ai/providers/mistralProvider.test.ts` — Tests
- Update `src/shared/services/ai/types.ts` — Add `"mistral"` to `AiProvider`
- Update `src/shared/services/ai/providerManager.ts` — Add Mistral case
- Update `package.json` — Add `@mistralai/mistralai`

**Mistral provider:**

```typescript
// src/shared/services/ai/providers/mistralProvider.ts
import Mistral from '@mistralai/mistralai';
import type { AiProviderClient, AiCompletionRequest, AiEmbeddingRequest } from '../types';

export function createMistralProvider(
  apiKey: string,
  model: string,
  aiLanguage = 'auto',
): AiProviderClient {
  const client = new Mistral({ apiKey });

  return {
    async complete(req: AiCompletionRequest): Promise<string> {
      const response = await client.chat.complete({
        model,
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userContent },
        ],
        maxTokens: req.maxTokens,
      });
      return response.choices[0]?.message?.content ?? '';
    },

    async testConnection(): Promise<boolean> {
      try {
        await client.chat.complete({
          model,
          messages: [{ role: 'user', content: 'test' }],
          maxTokens: 1,
        });
        return true;
      } catch {
        return false;
      }
    },

    async getEmbeddings(req: AiEmbeddingRequest): Promise<number[][] | null> {
      try {
        const response = await client.embeddings.create({
          model: req.model ?? 'mistral-embed',
          input: req.input,
        });
        return response.data.map((e) => e.embedding);
      } catch {
        return null;
      }
    },
  };
}
```

**Gemini SDK migration:**

- Current: `@google/generative-ai` v0.24.1 (old)
- Target: `@google/genai` (new official SDK)
- The new SDK has a different API surface (`GoogleGenAI` class vs `GoogleGenerativeAI`)
- Migration is straightforward — update `geminiProvider.ts` imports and constructor

### Phase 4: Voice Alignment

**Goal:** Ensure VoiceSettings.tsx works with the new capability system.

**Approach:**

- VoiceSettings.tsx remains a separate component (it configures desktop voice, not agent-core)
- Add capability detection: if the selected AI provider supports `stt`/`tts`, show a "Use AI provider" option
- The `voice_provider` setting can reference an AI provider (e.g., `voice_provider = "openai"` reuses `openai_api_key`)

**Files to update:**

- `src/features/settings/components/VoiceSettings.tsx` — Add AI provider integration
- `src/shared/services/ai/capabilities.ts` — Export voice capability helpers

### Phase 5: RAG Dimension Documentation

**Goal:** Document the multi-dimension RAG system and ensure no hardcoded 384.

**Files to create:**

- `docs/02-BACKEND/16-ai-rag-dimensions.md` — RAG dimension guide

**Content:**

- Three embedding spaces (ADR-001 D2)
- Table-per-dimension in LanceDB
- How to add a new embedding source
- Migration path when changing embedding models

### Phase 6: Settings Schema Updates

**Goal:** Add new settings keys for capability architecture.

**New settings keys:**

| Key                        | Type   | Secure  | Purpose                                           |
| -------------------------- | ------ | ------- | ------------------------------------------------- |
| `ai_task_routes`           | JSON   | No      | User task routing overrides                       |
| `ai_provider_capabilities` | JSON   | No      | Cached provider capability detection              |
| `mistral_model`            | string | No      | Mistral model selection                           |
| `mistral_api_key`          | string | **Yes** | Mistral API key                                   |
| `embedding_source`         | string | No      | `rust_bge` / `provider` / `auto` (already exists) |
| `embedding_dims`           | number | No      | Cached embedding dimension                        |

---

## 8. Documentation to Write

### 8.1 New Docs

| Doc                        | Path                                               | Priority |
| -------------------------- | -------------------------------------------------- | -------- |
| AI Capability Architecture | `docs/02-BACKEND/13-ai-capability-architecture.md` | P1       |
| AI Task Router             | `docs/02-BACKEND/14-ai-task-router.md`             | P1       |
| AI Model Registry          | `docs/02-BACKEND/15-ai-model-registry.md`          | P2       |
| RAG Dimensions             | `docs/02-BACKEND/16-ai-rag-dimensions.md`          | P2       |
| Voice Settings (Desktop)   | `docs/04-FEATURES/38-voice-settings.md`            | P2       |
| Adding an AI Provider      | `docs/05-DEVELOPMENT/08-ai-provider-adding.md`     | P3       |

### 8.2 Docs to Update

| Doc                                     | Change                                              |
| --------------------------------------- | --------------------------------------------------- |
| `docs/04-FEATURES/22-ai-integration.md` | Add capability architecture section                 |
| `docs/00-INDEX.md`                      | Add new doc entries                                 |
| `docs/STATUS.md`                        | Refresh metrics, add capability architecture status |
| `docs/PRODUCTION-READINESS.md`          | Update test counts (915 Rust, ~3,344 TS)            |

---

## 9. Risk Assessment

| Risk                         | Likelihood | Impact | Mitigation                                                              |
| ---------------------------- | ---------- | ------ | ----------------------------------------------------------------------- |
| Breaking existing AI calls   | Medium     | High   | Keep `AiProviderClient` as fallback; capability interfaces are additive |
| Bundle size increase         | High       | Low    | Tree-shaking; only load SDKs for configured providers                   |
| RAG dimension mismatch       | Low        | High   | Already handled by `ensure_table(dim)`; document the invariant          |
| Voice settings confusion     | Medium     | Medium | Clear UI separation: "AI Provider Voice" vs "Standalone Voice Provider" |
| Python agent-core divergence | Low        | Low    | ADR-001 D1 already forbids unification; document the boundary           |

---

## 10. Success Criteria

- [ ] All existing AI tests pass (2,470+ TS tests)
- [ ] New capability interfaces have 100% test coverage
- [ ] Task router correctly routes `email.classify` to `openai:gpt-4.1-nano`
- [ ] Mistral provider passes connection test
- [ ] Gemini SDK migration completes without breaking existing calls
- [ ] Voice settings work with both standalone and AI-provider modes
- [ ] RAG dimension documentation is complete
- [ ] All new docs are indexed in `00-INDEX.md`
- [ ] `STATUS.md` metrics are refreshed

---

## Appendix A: Current AiProviderClient Interface

```typescript
// src/shared/services/ai/types.ts:22-32
export interface AiProviderClient {
  complete(req: AiCompletionRequest): Promise<string>;
  testConnection(): Promise<boolean>;
  getEmbeddings?(req: AiEmbeddingRequest): Promise<number[][] | null>;
}
```

## Appendix B: Python agent-core Provider Seams

```python
# services/agent-core/agent_core/providers/base.py
class Seam(StrEnum):
    LLM = "llm"
    TTS = "tts"
    STT = "stt"
    EMBEDDING = "embedding"

class LLMProvider(ABC): ...
class TTSProvider(ABC): ...
class STTProvider(ABC): ...
class EmbeddingProvider(ABC): ...
```

## Appendix C: Three Embedding Spaces (ADR-001 D2)

| Space | Runtime                   | Dim  | Selected by                    |
| ----- | ------------------------- | ---- | ------------------------------ |
| A     | Desktop candle BGE-small  | 384  | `embeddingSource = "rust_bge"` |
| B     | Desktop provider endpoint | N    | `embeddingSource = "provider"` |
| C     | Server agent-core bge-m3  | 1024 | Server config                  |

**Invariant:** The three spaces are never merged.
