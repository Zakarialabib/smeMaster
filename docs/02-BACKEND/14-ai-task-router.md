# AI Task Router

> Per-task provider+model routing — replaces "one active provider" with "provider for this task."
> **Source:** `src/shared/services/ai/taskRouter.ts`

## Overview

The task router allows each AI task to be routed to a different provider+model combination. Instead of a single global AI provider, you can use GPT-4.1 Nano for email classification, Claude Sonnet for email composition, and OpenAI embeddings for RAG queries — all simultaneously.

User overrides are persisted in the `ai_task_routes` setting as JSON.

## The 16 AI Tasks

| Task ID               | Category | Description                         |
| --------------------- | -------- | ----------------------------------- |
| `email.classify`      | Email    | Auto-categorize threads             |
| `email.summarize`     | Email    | Thread summarization                |
| `email.compose`       | Email    | Full email composition              |
| `email.reply`         | Email    | Reply generation                    |
| `email.smart_reply`   | Email    | Smart reply suggestions             |
| `email.improve`       | Email    | Improve existing draft              |
| `email.shorten`       | Email    | Shorten email text                  |
| `email.formalize`     | Email    | Make text more formal               |
| `email.ask_inbox`     | Email    | Ask Inbox (natural language search) |
| `email.extract_task`  | Email    | Extract tasks from email            |
| `email.smart_label`   | Email    | Smart labeling                      |
| `email.quality_check` | Email    | Content quality check               |
| `rag.query`           | RAG      | Knowledge base semantic search      |
| `voice.stt`           | Voice    | Speech-to-text transcription        |
| `voice.tts`           | Voice    | Text-to-speech synthesis            |

## Default Routing Table

```typescript
const DEFAULT_TASK_ROUTES: Record<AiTask, TaskRoute> = {
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
  'email.quality_check': { task: 'email.quality_check', provider: 'openai', model: 'gpt-4o-mini' },
  'rag.query': { task: 'rag.query', provider: 'openai', model: 'text-embedding-3-small' },
  'voice.stt': { task: 'voice.stt', provider: 'openai', model: 'whisper-1' },
  'voice.tts': { task: 'voice.tts', provider: 'openai', model: 'tts-1' },
};
```

### Routing Strategy

- **Fast/cheap models** for high-volume tasks (classify, smart_reply, shorten, formalize, extract_task, smart_label) → `gpt-4.1-nano`
- **Balanced models** for quality-sensitive tasks (summarize, improve, quality_check) → `gpt-4o-mini`
- **Flagship models** for complex generation (compose, reply) → `claude-sonnet-4`
- **Specialized models** for embeddings and voice → `text-embedding-3-small`, `whisper-1`, `tts-1`

## TaskRoute Interface

```typescript
interface TaskRoute {
  task: AiTask;
  provider: AiProvider;
  model: string;
  fallback?: { provider: AiProvider; model: string };
}
```

## User Override System

Users can override any task's route via the `ai_task_routes` setting (stored as JSON):

```typescript
// Read overrides
const overrides = await getSetting('ai_task_routes');
// → { "email.classify": { task: "email.classify", provider: "mistral", model: "mistral-small" } }

// Set an override
await setTaskRoute('email.classify', {
  task: 'email.classify',
  provider: 'mistral',
  model: 'mistral-small',
});

// Reset to default
await resetTaskRoute('email.classify');
```

## Public API

### `getTaskRoute(task): Promise<TaskRoute>`

Resolves the provider+model for a task. Returns the user override if set, otherwise the default.

```typescript
const route = await getTaskRoute('email.classify');
// → { task: "email.classify", provider: "openai", model: "gpt-4.1-nano" }
```

### `setTaskRoute(task, route): Promise<void>`

Sets a user override for a specific task route.

### `resetTaskRoute(task): Promise<void>`

Removes the user override, reverting to the default route.

### `getAllTaskRoutes(): Promise<Record<AiTask, TaskRoute>>`

Returns all task routes (defaults merged with overrides).

### `getTaskModel(task): Promise<ModelDefinition | undefined>`

Looks up the full `ModelDefinition` from the model registry for a task's routed model.

```typescript
const modelDef = await getTaskModel('rag.query');
// → { id: "text-embedding-3-small", provider: "openai", ..., embeddingSpaceId: "openai-te3-small-1536" }
```

### `getAllTasks(): AiTask[]`

Returns all available task IDs as an array (for UI rendering).

### `getProvidersForTask(task): AiProvider[]`

Returns all providers that support a given task's required capability.

```typescript
const providers = getProvidersForTask('rag.query');
// → ["openai", "gemini", "mistral"]  (all providers with embedding models)
```

## Adding New Tasks

1. **Add the task ID** to the `AiTask` union type in `taskRouter.ts`:

   ```typescript
   export type AiTask =
     | 'email.classify'
     // ... existing tasks ...
     | 'email.translate'; // ← new task
   ```

2. **Add a default route** in `DEFAULT_TASK_ROUTES`:

   ```typescript
   "email.translate": { task: "email.translate", provider: "openai", model: "gpt-4o-mini" },
   ```

3. **Register the model** in `modelRegistry.ts` if it's not already there.

4. **Add i18n keys** for any UI labels in `src/locales/*/translation.json`.

5. **Use the route** in your feature code:

   ```typescript
   const route = await getTaskRoute('email.translate');
   const provider = await getActiveProvider(); // or getProviderFor(route.provider)
   ```

## Settings Key

| Key              | Type | Description                                                   |
| ---------------- | ---- | ------------------------------------------------------------- |
| `ai_task_routes` | JSON | User task routing overrides — a map of `AiTask` → `TaskRoute` |

## Key Files

| File                                       | Purpose                                        |
| ------------------------------------------ | ---------------------------------------------- |
| `src/shared/services/ai/taskRouter.ts`     | Task definitions, default routes, override API |
| `src/shared/services/ai/modelRegistry.ts`  | Model lookup for routed models                 |
| `src/shared/services/ai/settingsSchema.ts` | `ai_task_routes` setting definition            |
