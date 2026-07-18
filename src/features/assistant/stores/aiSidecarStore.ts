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

  // ── Actions (UI state only) ──
  setActive: (active: boolean) => void;
  setModelPath: (modelPath: string | null) => void;
  setStatus: (status: AiSidecarStatus) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAiSidecarStore = create<AiSidecarState>((set) => ({
  active: false,
  modelPath: null,
  status: "idle",
  error: null,

  setActive: (active) => set({ active }),
  setModelPath: (modelPath) => set({ modelPath }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  reset: () => set({ active: false, modelPath: null, status: "idle", error: null }),
}));
