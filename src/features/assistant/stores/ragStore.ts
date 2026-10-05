/**
 * RAG Store — Zustand state for the local AI RAG system.
 *
 * Manages model status, indexing state, conversation history,
 * and all interactions with the Rust RAG backend commands.
 *
 * @module
 */

import { create } from 'zustand';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { safeListen } from '@shared/services/ipc';
import { tauriStoreStorage } from '@shared/services/storage/tauriStoreStorage';
import {
  aiDownloadModel,
  aiLoadEmbeddingModel,
  aiIndexEmails,
  aiQueryRagHybrid,
  aiSearchByVector,
  aiGetModelsDir,
  aiDeleteModel,
  aiGetEmailChunks,
  aiGetContactChunks,
  aiGetDealChunks,
  aiInsertProviderVectors,
} from '@shared/services/db/invoke/rag';
import {
  downloaderListJobs,
  downloaderPauseJob,
  downloaderResumeJob,
  downloaderCancelJob,
  type DownloaderProgressEvent,
} from '@shared/services/db/invoke/downloader';
import { getProviderEmbedding } from '@shared/services/ai/embeddingService';
import { RAG_ANSWER_SYSTEM_PROMPT } from '@shared/services/ai/prompts';
import { TestEmbeddingResult, type AiProvider } from '@/shared/services/ai/types';
import { streamAi } from '@shared/services/ai/aiService';
import { getLocalModelById } from '@shared/services/ai/localModelCatalog';

// ── Constants ────────────────────────────────────────────────────────────────

const RAG_ENABLED_KEY = 'smemaster.rag.enabled';
const RAG_MODEL_PATH_KEY = 'smemaster.rag.modelPath';
const RAG_TOKENIZER_PATH_KEY = 'smemaster.rag.tokenizerPath';
const RAG_LAST_INDEXED_KEY = 'smemaster.rag.lastIndexedAt';
const RAG_EMBEDDING_SOURCE_KEY = 'smemaster.rag.embeddingSource';

// ── Types ────────────────────────────────────────────────────────────────────

export type ModelStatus = 'idle' | 'downloading' | 'paused' | 'loading' | 'loaded' | 'error';
export type IndexingStatus = 'idle' | 'indexing' | 'completed' | 'error';
export type EmbeddingSource = 'rust_bge' | 'provider' | null;

export interface RagConversationEntry {
  id: string;
  query: string;
  /** The retrieved RAG context chunks (shown as collapsible sources) */
  response: string;
  /** Optional LLM-generated natural-language answer (primary content) */
  answer?: string;
  timestamp: number;
}

export interface RagState {
  // ── Feature flag ──
  enabled: boolean;

  // ── Model ──
  modelStatus: ModelStatus;
  modelPath: string | null;
  tokenizerPath: string | null;
  modelError: string | null;
  /** Selected local embedding model id (from catalog) */
  embeddingModelId: string;
  /** Live progress of the BGE model download (`downloader:progress`). */
  downloadProgress: DownloaderProgressEvent | null;
  embeddingSource: EmbeddingSource;
  modelsDir: string | null;

  // ── Indexing ──
  indexingStatus: IndexingStatus;
  lastIndexedAt: string | null;
  indexingError: string | null;
  indexingProgress: { source: string; current: number; total: number } | null;

  // ── Search ──
  conversation: RagConversationEntry[];
  isSearching: boolean;
  searchError: string | null;
  /** ID of the entry currently being streamed (null when not streaming) */
  streamingEntryId: string | null;
  /** Partial answer text while streaming */
  streamingAnswer: string;

  // ── Embedding endpoint validation ──
  embeddingTest: TestEmbeddingResult | null;
  embeddingTesting: boolean;

  // ── Persisted config rehydration ──
  _hydrated: boolean;

  // ── Actions ──
  hydrate: () => Promise<void>;
  setEnabled: (val: boolean) => Promise<void>;
  setEmbeddingSource: (val: EmbeddingSource) => Promise<void>;
  setEmbeddingModelId: (val: string) => Promise<void>;
  fetchModelsDir: () => Promise<void>;
  removeModel: () => Promise<void>;
  downloadBgeModel: () => Promise<void>;
  pauseDownload: () => Promise<void>;
  resumeDownload: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  loadEmbeddingModel: () => Promise<void>;
  indexAll: () => Promise<void>;
  search: (query: string) => Promise<void>;
  searchStreaming: (query: string, provider?: AiProvider, model?: string) => Promise<void>;
  testEmbedding: () => Promise<TestEmbeddingResult | null>;
  clearHistory: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let entryCounter = 0;

/** True while `downloadBgeModel` awaits the backend (guards listener re-entry). */
let downloadRunning = false;

function nextEntryId(): string {
  entryCounter += 1;
  return `rag-entry-${entryCounter}-${Date.now()}`;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useRagStore = create<RagState>((set, get) => ({
  // ── Initial state ──
  enabled: false,
  modelStatus: 'idle',
  modelPath: null,
  tokenizerPath: null,
  modelError: null,
  embeddingModelId: 'bge-small-en-v1.5',
  downloadProgress: null,
  embeddingSource: null,
  modelsDir: null,
  indexingStatus: 'idle',
  lastIndexedAt: null,
  indexingError: null,
  indexingProgress: null,
  conversation: [],
  isSearching: false,
  searchError: null,
  streamingEntryId: null,
  streamingAnswer: '',
  embeddingTest: null,
  embeddingTesting: false,
  _hydrated: false,

  // ── Hydrate persisted config ──
  hydrate: async () => {
    if (get()._hydrated) return;

    try {
      const enabled = await tauriStoreStorage.getItem(RAG_ENABLED_KEY);
      const modelPath = await tauriStoreStorage.getItem(RAG_MODEL_PATH_KEY);
      const tokenizerPath = await tauriStoreStorage.getItem(RAG_TOKENIZER_PATH_KEY);
      const lastIndexedAt = await tauriStoreStorage.getItem(RAG_LAST_INDEXED_KEY);
      const embeddingSourceRaw = await tauriStoreStorage.getItem(RAG_EMBEDDING_SOURCE_KEY);
      const embeddingSource: EmbeddingSource | null =
        embeddingSourceRaw === 'rust_bge' || embeddingSourceRaw === 'provider'
          ? (embeddingSourceRaw as EmbeddingSource)
          : null;

      set({
        enabled: enabled === 'true',
        modelPath: modelPath ?? null,
        tokenizerPath: tokenizerPath ?? null,
        lastIndexedAt: lastIndexedAt ?? null,
        embeddingSource,
        modelStatus: modelPath ? 'loaded' : 'idle',
        _hydrated: true,
      });

      // Resolve the dedicated local models folder path.
      void get().fetchModelsDir();
    } catch {
      set({ _hydrated: true });
    }

    // Listen for Tauri indexing events
    const unlistenStart = await safeListen<unknown>('ai:indexing_started', () => {
      set({ indexingStatus: 'indexing', indexingError: null });
    });

    const unlistenComplete = await safeListen<unknown>('ai:indexing_completed', () => {
      const now = new Date().toISOString();
      set({ indexingStatus: 'completed', lastIndexedAt: now, indexingProgress: null });
      void tauriStoreStorage.setItem(RAG_LAST_INDEXED_KEY, now);
    });

    const unlistenProgress = await safeListen<{ source: string; current: number; total: number }>(
      'ai:indexing_progress',
      (event) => {
        set({ indexingProgress: event.payload });
      },
    );

    // Live model-download progress (resumable Rust downloader)
    const unlistenDownload = await safeListen<DownloaderProgressEvent>(
      'downloader:progress',
      (event) => {
        const ev = event.payload;
        if (!ev?.jobId) return; // boot-recovery ping — no job attached
        set({ downloadProgress: ev });
        if (ev.status === 'failed' || ev.status === 'cancelled') {
          // Only relevant after a webview reload (an awaited download gets
          // its error via the rejected `aiDownloadModel` promise instead).
          if (!downloadRunning && get().modelStatus === 'downloading') {
            set({ modelStatus: 'error', modelError: ev.error ?? 'Download failed' });
          }
        } else if (
          ev.status === 'completed' &&
          !downloadRunning &&
          get().modelStatus === 'downloading'
        ) {
          // Webview reloaded mid-download: the Rust engine finished the job,
          // but no promise is awaiting — the cache-hit path completes state.
          void get().downloadBgeModel();
        }
      },
    );

    // Store cleanup functions on window for teardown
    if (typeof window !== 'undefined') {
      const win = window as unknown as Record<string, unknown>;
      const unlisteners = (win.__rag_unlisteners as UnlistenFn[] | undefined) ?? [];
      unlisteners.push(unlistenStart, unlistenComplete, unlistenProgress, unlistenDownload);
      win.__rag_unlisteners = unlisteners;
    }

    // Rehydrate an in-flight download — the Rust engine keeps running
    // through webview reloads, so the bar must come back too.
    void (async () => {
      try {
        const jobs = await downloaderListJobs('ai_model');
        const active = jobs.find(
          (j) => j.status === 'downloading' || j.status === 'probing' || j.status === 'queued',
        );
        if (active && get().modelStatus !== 'loaded') {
          set({ downloadProgress: active, modelStatus: 'downloading' });
        }
      } catch {
        /* backend not ready — the next download click retries */
      }
    })();
  },

  // ── Toggle RAG enabled ──
  setEnabled: async (val: boolean) => {
    set({ enabled: val });
    await tauriStoreStorage.setItem(RAG_ENABLED_KEY, val ? 'true' : 'false');
  },

  // ── Download embedding model ──
  downloadBgeModel: async () => {
    set({ modelStatus: 'downloading', modelError: null, downloadProgress: null });
    downloadRunning = true;
    try {
      const modelId = get().embeddingModelId;
      const modelDef = getLocalModelById(modelId);
      if (!modelDef) throw new Error(`Unknown embedding model: ${modelId}`);

      // Download all required files for the selected model
      const paths: Record<string, string> = {};
      for (const file of modelDef.files) {
        if (file.required) {
          const path = await aiDownloadModel(modelDef.repoId, file.path);
          paths[file.dest] = path;
        }
      }

      const modelPath = paths['model.safetensors'];
      const tokenizerPath = paths['tokenizer.json'];
      if (!modelPath || !tokenizerPath) {
        throw new Error('Failed to download required model files');
      }

      set({
        modelStatus: 'idle',
        modelPath,
        tokenizerPath,
      });

      await tauriStoreStorage.setItem(RAG_MODEL_PATH_KEY, modelPath);
      await tauriStoreStorage.setItem(RAG_TOKENIZER_PATH_KEY, tokenizerPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ modelStatus: 'error', modelError: msg });
    } finally {
      downloadRunning = false;
    }
  },

  // ── Pause download ──
  pauseDownload: async () => {
    try {
      const jobs = await downloaderListJobs('ai_model');
      const active = jobs.find(
        (j) => j.status === 'downloading' || j.status === 'probing' || j.status === 'queued',
      );
      if (active) {
        await downloaderPauseJob(active.jobId);
        set({ modelStatus: 'paused' });
      }
    } catch {
      /* backend not ready */
    }
  },

  // ── Resume download ──
  resumeDownload: async () => {
    try {
      const jobs = await downloaderListJobs('ai_model');
      const paused = jobs.find((j) => j.status === 'paused' || j.status === 'failed');
      if (paused) {
        await downloaderResumeJob(paused.jobId);
        set({ modelStatus: 'downloading' });
      }
    } catch {
      /* backend not ready */
    }
  },

  // ── Cancel download ──
  cancelDownload: async () => {
    try {
      const jobs = await downloaderListJobs('ai_model');
      const active = jobs.find(
        (j) =>
          j.status === 'downloading' ||
          j.status === 'probing' ||
          j.status === 'queued' ||
          j.status === 'paused',
      );
      if (active) {
        await downloaderCancelJob(active.jobId, false);
        set({ modelStatus: 'idle', downloadProgress: null });
      }
    } catch {
      /* backend not ready */
    }
  },

  // ── Load embedding model into memory ──
  loadEmbeddingModel: async () => {
    const { modelPath, tokenizerPath } = get();
    if (!modelPath || !tokenizerPath) {
      set({ modelStatus: 'error', modelError: 'Model not downloaded yet' });
      return;
    }

    set({ modelStatus: 'loading', modelError: null });
    try {
      await aiLoadEmbeddingModel(modelPath, tokenizerPath);
      set({ modelStatus: 'loaded' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ modelStatus: 'error', modelError: msg });
    }
  },

  // ── Trigger indexing ──
  indexAll: async () => {
    set({ indexingStatus: 'indexing', indexingError: null });
    try {
      const source = get().embeddingSource;

      if (source === 'rust_bge') {
        // Explicit local engine (BGE-small). Rust embeds + indexes.
        await aiIndexEmails();
        set({ indexingStatus: 'completed' });
        return;
      }

      // Provider embeddings (LM Studio / Ollama / OpenAI-compatible):
      // fetch chunked docs from Rust, embed each with the active provider,
      // and send the vectors back. No BGE-small download required.
      const { isAiAvailable } = await import('@shared/services/ai/providerManager');
      if (!(await isAiAvailable())) {
        throw new Error(
          'No AI provider is configured for embeddings. Add a Local AI provider (LM Studio / Ollama) with an embeddings endpoint, or switch the embedding source to Local BGE-small.',
        );
      }

      const emailChunks = await aiGetEmailChunks();
      const contactChunks = await aiGetContactChunks();
      const dealChunks = await aiGetDealChunks();
      const chunks = [...emailChunks, ...contactChunks, ...dealChunks];
      if (chunks.length === 0) {
        set({ indexingStatus: 'completed' });
        return;
      }

      const vectors: number[][] = [];
      for (const chunk of chunks) {
        const emb = await getProviderEmbedding(chunk.text);
        if (emb) vectors.push(emb.vectors[0] ?? []);
        else vectors.push([]);
      }
      const valid = vectors.filter((v) => v.length > 0);
      if (valid.length === 0) {
        throw new Error('The active provider did not return any embeddings.');
      }

      await aiInsertProviderVectors(
        vectors,
        chunks.map((c) => c.id),
        chunks.map((c) => c.text),
      );
      set({ indexingStatus: 'completed' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ indexingStatus: 'error', indexingError: msg });
    }
  },

  // ── Search ──
  search: async (query: string) => {
    if (!query.trim()) return;

    set({ isSearching: true, searchError: null });

    try {
      let response: string;

      const source = get().embeddingSource;

      if (source === 'rust_bge') {
        // Explicit local engine — use hybrid search (BM25 + vector + RRF)
        set({ embeddingSource: 'rust_bge' });
        response = await aiQueryRagHybrid(query);
      } else if (source === 'provider') {
        // Explicit provider embeddings (LM Studio / Ollama / OpenAI-compatible)
        const providerEmbedding = await getProviderEmbedding(query);
        if (!providerEmbedding) {
          throw new Error(
            'No AI provider with embeddings support is configured. Add a Custom (LM Studio) provider with an embeddings endpoint, or switch the embedding source to Local BGE-small.',
          );
        }
        set({ embeddingSource: 'provider' });
        response = await aiSearchByVector(providerEmbedding.vectors[0] ?? [], query);
      } else {
        // Auto: prefer provider, fall back to local BGE-small
        const providerEmbedding = await getProviderEmbedding(query);
        if (providerEmbedding) {
          set({ embeddingSource: 'provider' });
          response = await aiSearchByVector(providerEmbedding.vectors[0] ?? [], query);
        } else {
          set({ embeddingSource: 'rust_bge' });
          response = await aiQueryRagHybrid(query);
        }
      }

      // Generate a natural-language answer with the active AI provider
      // (LM Studio, Ollama, OpenAI, etc.), falling back to the
      // raw retrieved context when no provider is configured.
      let answer: string | undefined;
      try {
        const { isAiAvailable } = await import('@shared/services/ai/providerManager');
        const { callAi } = await import('@shared/services/ai/aiService');
        if (await isAiAvailable()) {
          answer = await callAi(RAG_ANSWER_SYSTEM_PROMPT, response);
        }
      } catch {
        answer = undefined;
      }

      const entry: RagConversationEntry = {
        id: nextEntryId(),
        query: query.trim(),
        response,
        answer,
        timestamp: Date.now(),
      };

      set((s) => ({
        conversation: [...s.conversation, entry],
        isSearching: false,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isSearching: false, searchError: msg });
    }
  },

  // ── Streaming Search ──
  searchStreaming: async (query: string, provider?: AiProvider, model?: string) => {
    if (!query.trim()) return;

    set({ isSearching: true, searchError: null, streamingAnswer: '' });

    try {
      let response: string;

      const source = get().embeddingSource;

      if (source === 'rust_bge') {
        set({ embeddingSource: 'rust_bge' });
        response = await aiQueryRagHybrid(query);
      } else if (source === 'provider') {
        const providerEmbedding = await getProviderEmbedding(query);
        if (!providerEmbedding) {
          throw new Error(
            'No AI provider with embeddings support is configured. Add a Custom (LM Studio) provider with an embeddings endpoint, or switch the embedding source to Local BGE-small.',
          );
        }
        set({ embeddingSource: 'provider' });
        response = await aiSearchByVector(providerEmbedding.vectors[0] ?? [], query);
      } else {
        const providerEmbedding = await getProviderEmbedding(query);
        if (providerEmbedding) {
          set({ embeddingSource: 'provider' });
          response = await aiSearchByVector(providerEmbedding.vectors[0] ?? [], query);
        } else {
          set({ embeddingSource: 'rust_bge' });
          response = await aiQueryRagHybrid(query);
        }
      }

      // Create a placeholder entry for streaming
      const entryId = nextEntryId();
      const entry: RagConversationEntry = {
        id: entryId,
        query: query.trim(),
        response,
        answer: '',
        timestamp: Date.now(),
      };

      set((s) => ({
        conversation: [...s.conversation, entry],
        streamingEntryId: entryId,
        streamingAnswer: '',
      }));

      // Stream the AI answer token by token
      const { isAiAvailable } = await import('@shared/services/ai/providerManager');
      let accumulated = '';
      if (await isAiAvailable()) {
        for await (const chunk of streamAi(RAG_ANSWER_SYSTEM_PROMPT, response, provider, model)) {
          accumulated += chunk;
          set({ streamingAnswer: accumulated });
        }
      }

      // Finalize: set the complete answer
      set((s) => ({
        conversation: s.conversation.map((e) =>
          e.id === entryId ? { ...e, answer: accumulated || undefined } : e,
        ),
        isSearching: false,
        streamingEntryId: null,
        streamingAnswer: '',
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        isSearching: false,
        searchError: msg,
        streamingEntryId: null,
        streamingAnswer: '',
      });
    }
  },

  // ── Set embedding source (local BGE vs provider vs auto) ──
  setEmbeddingSource: async (val) => {
    set({ embeddingSource: val });
    await tauriStoreStorage.setItem(RAG_EMBEDDING_SOURCE_KEY, val ?? 'auto');
  },

  // ── Set embedding model (local model selection) ──
  setEmbeddingModelId: async (val) => {
    set({ embeddingModelId: val });
    await tauriStoreStorage.setItem('smemaster.rag.embeddingModelId', val);
  },

  // ── Validate the configured LM Studio embedding model ──
  testEmbedding: async () => {
    set({ embeddingTesting: true, embeddingTest: null });
    try {
      const { testLMStudioEmbedding } = await import('@shared/services/ai/providerManager');
      const result = await testLMStudioEmbedding();
      set({ embeddingTest: result });
      return result;
    } catch (err) {
      const result: TestEmbeddingResult = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      set({ embeddingTest: result });
      return result;
    } finally {
      set({ embeddingTesting: false });
    }
  },

  // ── Resolve the local models folder path ──
  fetchModelsDir: async () => {
    try {
      const dir = await aiGetModelsDir();
      set({ modelsDir: dir });
    } catch {
      /* folder not available yet — UI shows "Loading…" */
    }
  },

  // ── Remove the downloaded local embedding model ──
  removeModel: async () => {
    try {
      const modelDef = getLocalModelById(get().embeddingModelId);
      if (modelDef) await aiDeleteModel(modelDef.repoId);
      set({
        modelPath: null,
        tokenizerPath: null,
        modelStatus: 'idle',
        modelError: null,
        downloadProgress: null,
      });
      await tauriStoreStorage.removeItem(RAG_MODEL_PATH_KEY);
      await tauriStoreStorage.removeItem(RAG_TOKENIZER_PATH_KEY);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ modelError: msg });
    }
  },

  // ── Clear conversation history ──
  clearHistory: () => {
    set({ conversation: [], searchError: null });
  },
}));

// ── Auto-hydrate on import (for module-level access) ──────────────────────────

if (typeof window !== 'undefined') {
  const store = useRagStore.getState();
  if (!store._hydrated) {
    void store.hydrate();
  }
}
