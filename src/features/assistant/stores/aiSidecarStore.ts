/**
 * AI Sidecar Store — UI state for the lazily-activated local AI engine.
 *
 * This store is intentionally thin: it only tracks *whether the local AI
 * sidecar has been activated* and its load status. It does NOT perform any
 * model loading itself — that is delegated to `aiSidecar.ts`, which wraps the
 * Tauri commands. Keeping this store UI-only means app startup is never
 * blocked by the heavy candle/LanceDB init on the Rust side.
 *
 * @module
 */

import { create } from "zustand";

export type AiSidecarStatus = "idle" | "loading" | "ready" | "error";

export interface AiSidecarState {
  /** Whether the user has explicitly activated the local AI sidecar. */
  active: boolean;
  /** Local filesystem path of the loaded embedding model (if any). */
  modelPath: string | null;
  /** Lifecycle status of the sidecar engine. */
  status: AiSidecarStatus;
  /** Last error message, if status === "error". */
  error: string | null;

  // ── Runtime observability (gaps #1/#3/#5/#6/#7/#8/#9) ──────────────
  /** Sidecar binary is compiled in (`local-ai` feature present). */
  enabled: boolean;
  /** Sidecar process is currently running. */
  running: boolean;
  /** Last health-check result. */
  healthy: boolean;
  /** Cached version string from sidecar `ping`/`init`. */
  version: string | null;
  /** Last metrics snapshot from the sidecar (null until polled). */
  metrics:
    | {
        embed_count: number;
        index_count: number;
        query_count: number;
        parse_count: number;
        unload_count: number;
        last_model_load_ms: number;
        model_loaded: boolean;
        rss_mb: number;
      }
    | null;

  // ── Actions (UI state only) ─────────────────────────────────────────
  setActive: (active: boolean) => void;
  setModelPath: (modelPath: string | null) => void;
  setStatus: (status: AiSidecarStatus) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // ── Observability actions ───────────────────────────────────────────
  setSidecarRuntime: (payload: {
    enabled?: boolean;
    running?: boolean;
    healthy?: boolean;
    version?: string | null;
  }) => void;
  setMetrics: (
    metrics:
      | {
          embed_count: number;
          index_count: number;
          query_count: number;
          parse_count: number;
          unload_count: number;
          last_model_load_ms: number;
          model_loaded: boolean;
          rss_mb: number;
        }
      | null,
  ) => void;
}

export const useAiSidecarStore = create<AiSidecarState>((set) => ({
  active: false,
  modelPath: null,
  status: "idle",
  error: null,
  enabled: false,
  running: false,
  healthy: false,
  version: null,
  metrics: null,

  setActive: (active) => set({ active }),
  setModelPath: (modelPath) => set({ modelPath }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      active: false,
      modelPath: null,
      status: "idle",
      error: null,
      enabled: false,
      running: false,
      healthy: false,
      version: null,
      metrics: null,
    }),

  setSidecarRuntime: (payload) =>
    set((state) => ({
      enabled: payload.enabled ?? state.enabled,
      running: payload.running ?? state.running,
      healthy: payload.healthy ?? state.healthy,
      version: payload.version ?? state.version,
    })),
  setMetrics: (metrics) => set({ metrics }),
}));
