/**
 * RAG Store — Zustand state for the local AI RAG system.
 *
 * Manages model status, indexing state, conversation history,
 * and all interactions with the Rust RAG backend commands.
 *
 * @module
 */

import { create } from "zustand";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { tauriStoreStorage } from "@shared/services/storage/tauriStoreStorage";
import {
  aiDownloadModel,
  aiLoadEmbeddingModel,
  aiIndexEmails,
  aiQueryRag,
  aiSearchByVector,
  aiGetModelsDir,
  aiDeleteModel,
  aiGetEmailChunks,
  aiInsertProviderVectors,
} from "@shared/services/db/invoke/rag";
import {
  getProviderEmbedding,
} from "@shared/services/ai/embeddingService";
import { RAG_ANSWER_SYSTEM_PROMPT } from "@shared/services/ai/prompts";
import { TestEmbeddingResult } from "@/shared/services/ai/types";

// ── Constants ────────────────────────────────────────────────────────────────

const RAG_ENABLED_KEY = "smemaster.rag.enabled";
const RAG_MODEL_PATH_KEY = "smemaster.rag.modelPath";
const RAG_TOKENIZER_PATH_KEY = "smemaster.rag.tokenizerPath";
const RAG_LAST_INDEXED_KEY = "smemaster.rag.lastIndexedAt";
const RAG_EMBEDDING_SOURCE_KEY = "smemaster.rag.embeddingSource";

const BGE_REPO_ID = "BAAI/bge-small-en-v1.5";
const BGE_MODEL_FILE = "model.safetensors";
const BGE_TOKENIZER_FILE = "tokenizer.json";

// ── Types ────────────────────────────────────────────────────────────────────

export type ModelStatus = "idle" | "downloading" | "loading" | "loaded" | "error";
export type IndexingStatus = "idle" | "indexing" | "completed" | "error";
export type EmbeddingSource = "rust_bge" | "provider" | null;

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
  embeddingSource: EmbeddingSource;
  modelsDir: string | null;

  // ── Indexing ──
  indexingStatus: IndexingStatus;
  lastIndexedAt: string | null;
  indexingError: string | null;

  // ── Search ──
  conversation: RagConversationEntry[];
  isSearching: boolean;
  searchError: string | null;

  // ── Embedding endpoint validation ──
  embeddingTest: TestEmbeddingResult | null;
  embeddingTesting: boolean;

  // ── Persisted config rehydration ──
  _hydrated: boolean;

  // ── Actions ──
  hydrate: () => Promise<void>;
  setEnabled: (val: boolean) => Promise<void>;
  setEmbeddingSource: (val: EmbeddingSource) => Promise<void>;
  fetchModelsDir: () => Promise<void>;
  removeModel: () => Promise<void>;
  downloadBgeModel: () => Promise<void>;
  loadEmbeddingModel: () => Promise<void>;
  indexAll: () => Promise<void>;
  search: (query: string) => Promise<void>;
  testEmbedding: () => Promise<TestEmbeddingResult | null>;
  clearHistory: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let entryCounter = 0;

function nextEntryId(): string {
  entryCounter += 1;
  return `rag-entry-${entryCounter}-${Date.now()}`;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useRagStore = create<RagState>((set, get) => ({
  // ── Initial state ──
  enabled: false,
  modelStatus: "idle",
  modelPath: null,
  tokenizerPath: null,
  modelError: null,
  embeddingSource: null,
  modelsDir: null,
  indexingStatus: "idle",
  lastIndexedAt: null,
  indexingError: null,
  conversation: [],
  isSearching: false,
  searchError: null,
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
        embeddingSourceRaw === "rust_bge" || embeddingSourceRaw === "provider"
          ? (embeddingSourceRaw as EmbeddingSource)
          : null;

      set({
        enabled: enabled === "true",
        modelPath: modelPath ?? null,
        tokenizerPath: tokenizerPath ?? null,
        lastIndexedAt: lastIndexedAt ?? null,
        embeddingSource,
        modelStatus: modelPath ? "loaded" : "idle",
        _hydrated: true,
      });

      // Resolve the dedicated local models folder path.
      void get().fetchModelsDir();
    } catch {
      set({ _hydrated: true });
    }

    // Listen for Tauri indexing events
    const unlistenStart = await listen<unknown>("ai:indexing_started", () => {
      set({ indexingStatus: "indexing", indexingError: null });
    });

    const unlistenComplete = await listen<unknown>("ai:indexing_completed", () => {
      const now = new Date().toISOString();
      set({ indexingStatus: "completed", lastIndexedAt: now });
      void tauriStoreStorage.setItem(RAG_LAST_INDEXED_KEY, now);
    });

    // Store cleanup function on window for teardown
    if (typeof window !== "undefined") {
      const win = window as unknown as Record<string, unknown>;
      const unlisteners = win.__rag_unlisteners as UnlistenFn[] | undefined;
      if (!unlisteners) {
        win.__rag_unlisteners = [unlistenStart, unlistenComplete];
      }
    }
  },

  // ── Toggle RAG enabled ──
  setEnabled: async (val: boolean) => {
    set({ enabled: val });
    await tauriStoreStorage.setItem(RAG_ENABLED_KEY, val ? "true" : "false");
  },

  // ── Download BGE-Small model ──
  downloadBgeModel: async () => {
    set({ modelStatus: "downloading", modelError: null });
    try {
      const modelPath = await aiDownloadModel(BGE_REPO_ID, BGE_MODEL_FILE);
      const tokenizerPath = await aiDownloadModel(BGE_REPO_ID, BGE_TOKENIZER_FILE);

      set({
        modelStatus: "idle",
        modelPath,
        tokenizerPath,
      });

      await tauriStoreStorage.setItem(RAG_MODEL_PATH_KEY, modelPath);
      await tauriStoreStorage.setItem(RAG_TOKENIZER_PATH_KEY, tokenizerPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ modelStatus: "error", modelError: msg });
    }
  },

  // ── Load embedding model into memory ──
  loadEmbeddingModel: async () => {
    const { modelPath, tokenizerPath } = get();
    if (!modelPath || !tokenizerPath) {
      set({ modelStatus: "error", modelError: "Model not downloaded yet" });
      return;
    }

    set({ modelStatus: "loading", modelError: null });
    try {
      await aiLoadEmbeddingModel(modelPath, tokenizerPath);
      set({ modelStatus: "loaded" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ modelStatus: "error", modelError: msg });
    }
  },

  // ── Trigger indexing ──
  indexAll: async () => {
    set({ indexingStatus: "indexing", indexingError: null });
    try {
      const source = get().embeddingSource;

      if (source === "rust_bge") {
        // Explicit local engine (BGE-small). Rust embeds + indexes.
        await aiIndexEmails();
        set({ indexingStatus: "completed" });
        return;
      }

      // Provider embeddings (LM Studio / Ollama / OpenAI-compatible):
      // fetch chunked docs from Rust, embed each with the active provider,
      // and send the vectors back. No BGE-small download required.
      const { isAiAvailable } = await import("@shared/services/ai/providerManager");
      if (!(await isAiAvailable())) {
        throw new Error(
          "No AI provider is configured for embeddings. Add a Local AI provider (LM Studio / Ollama) with an embeddings endpoint, or switch the embedding source to Local BGE-small.",
        );
      }

      const chunks = await aiGetEmailChunks();
      if (chunks.length === 0) {
        set({ indexingStatus: "completed" });
        return;
      }

      const vectors: number[][] = [];
      for (const chunk of chunks) {
        const emb = await getProviderEmbedding(chunk.text);
        if (emb) vectors.push(emb.vector);
        else vectors.push([]);
      }
      const valid = vectors.filter((v) => v.length > 0);
      if (valid.length === 0) {
        throw new Error("The active provider did not return any embeddings.");
      }

      await aiInsertProviderVectors(
        vectors,
        chunks.map((c) => c.id),
        chunks.map((c) => c.text),
      );
      set({ indexingStatus: "completed" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ indexingStatus: "error", indexingError: msg });
    }
  },

  // ── Search ──
  search: async (query: string) => {
    if (!query.trim()) return;

    set({ isSearching: true, searchError: null });

    try {
      let response: string;

      const source = get().embeddingSource;

      if (source === "rust_bge") {
        // Explicit local engine
        set({ embeddingSource: "rust_bge" });
        response = await aiQueryRag(query);
      } else if (source === "provider") {
        // Explicit provider embeddings (LM Studio / Ollama / OpenAI-compatible)
        const providerEmbedding = await getProviderEmbedding(query);
        if (!providerEmbedding) {
          throw new Error(
            "No AI provider with embeddings support is configured. Add a Custom (LM Studio) provider with an embeddings endpoint, or switch the embedding source to Local BGE-small.",
          );
        }
        set({ embeddingSource: "provider" });
        response = await aiSearchByVector(providerEmbedding.vector, query);
      } else {
        // Auto: prefer provider, fall back to local BGE-small
        const providerEmbedding = await getProviderEmbedding(query);
        if (providerEmbedding) {
          set({ embeddingSource: "provider" });
          response = await aiSearchByVector(providerEmbedding.vector, query);
        } else {
          set({ embeddingSource: "rust_bge" });
          response = await aiQueryRag(query);
        }
      }

      // Generate a natural-language answer with the active AI provider
      // (LM Studio, Ollama, OpenAI, etc.), falling back to the
      // raw retrieved context when no provider is configured.
      let answer: string | undefined;
      try {
        const { isAiAvailable } = await import("@shared/services/ai/providerManager");
        const { callAi } = await import("@shared/services/ai/aiService");
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

  // ── Set embedding source (local BGE vs provider vs auto) ──
  setEmbeddingSource: async (val) => {
    set({ embeddingSource: val });
    await tauriStoreStorage.setItem(RAG_EMBEDDING_SOURCE_KEY, val ?? "auto");
  },

  // ── Validate the configured LM Studio embedding model ──
  testEmbedding: async () => {
    set({ embeddingTesting: true, embeddingTest: null });
    try {
      const { testLMStudioEmbedding } = await import("@shared/services/ai/providerManager");
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
      await aiDeleteModel(BGE_REPO_ID);
      set({ modelPath: null, tokenizerPath: null, modelStatus: "idle", modelError: null });
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

if (typeof window !== "undefined") {
  const store = useRagStore.getState();
  if (!store._hydrated) {
    void store.hydrate();
  }
}
