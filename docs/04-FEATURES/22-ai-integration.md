# AI Integration

> Shared AI layer for categorization, summaries, writing assistance, inbox querying, and generation helpers.

## Scope

AI in SMEMaster is a shared capability, not a single isolated screen. It powers features across email, tasks, settings, templates, and automation-adjacent workflows.

This page covers:

- provider management
- model selection and settings
- the major AI-assisted product surfaces
- the shared service layer that features consume

## Current Ownership

Primary code lives in:

- `src/shared/services/ai/`
- AI settings in `src/features/settings/components/tabs/AiTab.tsx`

Representative services include:

- `aiService.ts`
- `providerFactory.ts`
- `providerManager.ts`
- `categorizationManager.ts`
- `askInbox.ts`
- `taskExtraction.ts`
- `writingStyleService.ts`
- `templateGenerator.ts`
- `workflowGenerator.ts`

## Provider Model

The settings surface and service layer currently support multiple provider families, including hosted and self-hosted options.

Configured examples in the codebase include:

- Claude
- OpenAI
- Gemini
- Ollama
- Copilot
- custom/OpenAI-compatible endpoints

The source of truth for active provider settings is the AI settings tab and shared AI service types, not scattered feature pages.

## Main AI-Powered Surfaces

### Inbox assistance

AI is used for inbox-oriented workflows such as:

- categorization
- summaries
- inbox querying
- writing assistance and reply support

### Task and workflow support

AI helpers also exist for:

- extracting tasks from messages or content
- generating templates
- generating workflow-related content
- generating warmup or signature-related content

### Settings and configuration

The AI settings tab controls provider, model, key, and enablement choices, while secure settings storage keeps secrets out of plain-text docs and feature descriptions.

## Boundaries

Keep these responsibilities separate:

- composer UX belongs to `34-mail-composer.md`
- reusable content belongs to `24-templates.md`
- regulatory/policy checks belong to `23-compliance-engine.md`
- general email behavior belongs to `Core/01-email-management.md`

This page should describe the shared AI layer and its product touchpoints, not duplicate every consumer feature.

## Local RAG & AI Assistant

The app includes a complete local Retrieval-Augmented Generation (RAG) system providing semantic search over emails, attachments, and vault documents:

| Doc                                                     | Covers                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| [RAG Overview](ai-rag.md)                   | Architecture, data flows, design decisions                    |
| [RAG Backend](../02-BACKEND/ai-rag.md)        | Rust: candle, LanceDB, parser, indexer                        |
| [RAG Commands](../02-BACKEND/ai-rag.md)             | Tauri IPC command reference                                   |
| [RAG Frontend](../03-FRONTEND/ai-rag.md)       | TS wrappers, store, components, routing                       |
| [Prompt Engineering](../03-FRONTEND/ai-prompt-engineering.md)   | **All prompt systems** — email, inbox, CRM, RAG               |
| [Context Engineering](../03-FRONTEND/ai-context-engineering.md) | **Context construction** — data sourcing, truncation, quality |

### RAG-Specific AI Features

- **Local embedding model** (BAAI/bge-small-en-v1.5) via candle — no cloud dependency
- **Vector database** (LanceDB) for semantic similarity search
- **Full index** of emails, attachments, and vault documents
- **Settings UI** for model management and indexing control
- **AI Assistant page** (`/ai-assistant`) for chat-like query interface

## Prompt Engineering Inventory

All AI prompts are centralized in `src/shared/services/ai/prompts.ts`. The full inventory, analysis, and improvement recommendations are documented in the [Prompt Engineering](../03-FRONTEND/ai-prompt-engineering.md) guide.

Current prompt surfaces:

| Surface             | Prompts                                                                  | Quality                            |
| ------------------- | ------------------------------------------------------------------------ | ---------------------------------- |
| Email writing       | COMPOSE, REPLY, SMART_REPLY, AUTO_DRAFT, IMPROVE, SHORTEN, FORMALIZE     | ✅ Injection guard, tagged content |
| Inbox intelligence  | SUMMARIZE, ASK_INBOX, CATEGORIZE, SMART_LABEL                            | ✅ Structured output, citations    |
| Task extraction     | EXTRACT_TASK                                                             | ✅ JSON output, fallback           |
| Content quality     | CONTENT_QUALITY                                                          | ✅ Scoring rubric, JSON            |
| Template generation | TEMPLATE_GENERATION                                                      | ✅ Strict schema, HTML rules       |
| Writing style       | WRITING_STYLE_ANALYSIS                                                   | ✅ Multi-dimension analysis        |
| CRM intelligence    | (planned — see [30-contact-intelligence.md](30-contact-intelligence.md)) | 🔄 Not yet implemented             |

## Context Construction

How the app builds context for AI calls — data sourcing, formatting, truncation, and quality heuristics — is documented in the [Context Engineering](../03-FRONTEND/ai-context-engineering.md) guide. This covers:

- Email reply context (thread formatting, style profile injection)
- Inbox search context (FTS results → structured context)
- RAG context (vector DB chunks → augmented prompt)
- CRM context (proposed: interaction history + contact profile)
- Token budget management and truncation strategies

## Key Files

| Area                 | Files                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Shared AI services   | `src/shared/services/ai/`                                                                                            |
| Provider setup       | `src/shared/services/ai/providerFactory.ts`, `providerManager.ts`, `types.ts`                                        |
| Inbox/query helpers  | `src/shared/services/ai/askInbox.ts`, `categorizationManager.ts`                                                     |
| Generation helpers   | `src/shared/services/ai/templateGenerator.ts`, `workflowGenerator.ts`, `signatureGenerator.ts`, `warmupGenerator.ts` |
| Writing/task helpers | `src/shared/services/ai/writingStyleService.ts`, `taskExtraction.ts`                                                 |
| Settings UI          | `src/features/settings/components/tabs/AiTab.tsx`                                                                    |
| Backend commands     | `src-tauri/src/commands/ai.rs`                                                                                       |
| Backend DB domain    | `src-tauri/src/db/ai/`                                                                                               |

## Update Rules

Update this page when:

- supported providers or models change materially
- a shared AI capability becomes first-class or is removed
- AI settings ownership moves
- a major feature begins to depend on a new shared AI service
