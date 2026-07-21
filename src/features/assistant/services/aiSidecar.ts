/**
 * AI Sidecar Service — explicit activation wrapper around the local RAG engine.
 *
 * The Rust `LocalEngine` (candle + BGE-small) is constructed lazily on the
 * first `ai_load_embedding_model` call and is NOT initialised at app startup.
 * This module provides the single, explicit entry point the UI uses to
 * "activate" the local AI sidecar — i.e. download (if needed) and load the
 * embedding model into memory — and to query its activation state.
 *
 * Nothing here runs at import time, so app startup is never blocked.
 *
 * @module
 */

import {
  aiDownloadModel,
  aiLoadEmbeddingModel,
  aiGetSidecarStatus,
  aiGetSidecarMetrics,
  aiListSidecarModels,
} from "@shared/services/db/invoke/rag";
import { useRagStore } from "@features/assistant/stores/ragStore";
import {
  useAiSidecarStore,
  type AiSidecarStatus,
} from "@features/assistant/stores/aiSidecarStore";

// ── Constants ────────────────────────────────────────────────────────────────
// Kept in sync with ragStore.ts. The local embedding model is BGE-small.
const BGE_REPO_ID = "BAAI/bge-small-en-v1.5";
const BGE_MODEL_FILE = "model.safetensors";
const BGE_TOKENIZER_FILE = "tokenizer.json";

// ── Helpers ──────────────────────────────────────────────────────────────────

function setStatus(status: AiSidecarStatus, error: string | null = null): void {
  const store = useAiSidecarStore.getState();
  store.setStatus(status);
  store.setError(error);
}

/** Whether the local AI sidecar is currently active (model loaded & ready). */
export function isAiSidecarActive(): boolean {
  const { active, status } = useAiSidecarStore.getState();
  return active && status === "ready";
}

/** Refresh runtime observability from the backend into the UI store. */
export async function refreshAiSidecarRuntime(): Promise<void> {
  try {
    const [status, metrics, models] = await Promise.all([
      aiGetSidecarStatus().catch(() => ({
        enabled: false,
        running: false,
        healthy: false,
        version: null,
      })),
      aiGetSidecarMetrics().catch(() => null),
      aiListSidecarModels().catch(() => null),
    ]);

    const store = useAiSidecarStore.getState();
    store.setSidecarRuntime({
      enabled: status.enabled,
      running: status.running,
      healthy: status.healthy,
      version: status.version ?? null,
    });
    store.setMetrics(metrics);
    // Future: expose `models` in store when UI for model picker is added.
    void models;
  } catch {
    // Best-effort only.
  }
}

let runtimePollHandle: ReturnType<typeof setInterval> | null = null;

/** Start periodic refresh of runtime telemetry (sidecar metrics/version). */
export function startAiSidecarRuntimePolling(intervalMs = 5000): void {
  stopAiSidecarRuntimePolling();
  refreshAiSidecarRuntime();
  runtimePollHandle = setInterval(() => {
    refreshAiSidecarRuntime();
  }, intervalMs);
}

export function stopAiSidecarRuntimePolling(): void {
  if (runtimePollHandle) {
    clearInterval(runtimePollHandle);
    runtimePollHandle = null;
  }
}

/**
 * Explicitly activate the local AI sidecar.
 *
 * This is the ONLY place that triggers the heavy model load on the Rust side.
 * It is idempotent: if the sidecar is already ready, it returns immediately.
 *
 * Flow:
 *   1. If a model path is already known (persisted), load it.
 *   2. Otherwise download BGE-small + tokenizer, persist the paths, then load.
 *
 * Throws on failure so the caller can show a "Download model" prompt and
 * degrade gracefully — it never blocks app startup.
 *
 * @returns The loaded model path.
 */
export async function activateAiSidecar(): Promise<string> {
  const sidecar = useAiSidecarStore.getState();
  if (sidecar.active && sidecar.status === "ready" && sidecar.modelPath) {
    return sidecar.modelPath;
  }

  setStatus("loading");

  try {
    const rag = useRagStore.getState();

    let modelPath = rag.modelPath;
    let tokenizerPath = rag.tokenizerPath;

    // Download the model if it has not been fetched yet.
    if (!modelPath || !tokenizerPath) {
      modelPath = await aiDownloadModel(BGE_REPO_ID, BGE_MODEL_FILE);
      tokenizerPath = await aiDownloadModel(BGE_REPO_ID, BGE_TOKENIZER_FILE);
      // Persist the resolved paths in the rag store so subsequent
      // activations (and the RAG UI) skip the download.
      useRagStore.setState({ modelPath, tokenizerPath, modelStatus: "idle" });
    }

    // Load the embedding model into the (lazily created) Rust engine.
    await aiLoadEmbeddingModel(modelPath, tokenizerPath);

    // Reflect readiness in both stores.
    useRagStore.setState({ modelStatus: "loaded", modelPath, tokenizerPath });
    useAiSidecarStore.getState().setActive(true);
    useAiSidecarStore.getState().setModelPath(modelPath);
    setStatus("ready");

    // Refresh runtime telemetry after activation.
    await refreshAiSidecarRuntime();

    return modelPath;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus("error", message);
    throw err;
  }
}

/**
 * Convenience: ensure the sidecar is active before running a local-RAG
 * operation. Returns the model path, or throws a user-friendly error if the
 * model cannot be loaded (so the UI can prompt for a download).
 */
export async function ensureAiSidecar(): Promise<string> {
  if (isAiSidecarActive()) {
    return useAiSidecarStore.getState().modelPath as string;
  }
  return activateAiSidecar();
}
