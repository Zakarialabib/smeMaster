/**
 * AI Readiness Service — unified readiness indicator across all AI services.
 *
 * Aggregates the state of:
 *   - LLM (chat provider configured & available)
 *   - Embedding (BGE model loaded OR provider embeddings available)
 *   - TTS (text-to-speech provider available)
 *   - STT (speech-to-text provider available)
 *
 * Each service is independently checked, and the overall readiness is
 * derived from the combination. This gives the UI a single source of
 * truth for "is AI ready?" without polling multiple stores.
 *
 * @module
 */

import { isAiAvailable } from '@shared/services/ai/providerManager';
import { useRagStore } from '@features/assistant/stores/ragStore';
import { getSetting } from '@features/settings/db/settings';

// ── Types ────────────────────────────────────────────────────────────────────

export type AiServiceKind = 'llm' | 'embedding' | 'tts' | 'stt';

export type AiServiceStatus = 'ready' | 'partial' | 'unavailable' | 'loading';

export interface AiServiceReadiness {
  kind: AiServiceKind;
  status: AiServiceStatus;
  label: string;
  detail: string;
}

export interface AiReadiness {
  /** Overall readiness — true when at least LLM or embedding is ready */
  ready: boolean;
  /** True when ALL configured services are ready */
  fullyReady: boolean;
  /** Individual service states */
  services: Record<AiServiceKind, AiServiceReadiness>;
  /** Timestamp of last check */
  checkedAt: number;
}

// ── Service Checkers ─────────────────────────────────────────────────────────

async function checkLlm(): Promise<AiServiceReadiness> {
  try {
    const available = await isAiAvailable();
    if (available) {
      return {
        kind: 'llm',
        status: 'ready',
        label: 'LLM',
        detail: 'Chat provider configured',
      };
    }
    return {
      kind: 'llm',
      status: 'unavailable',
      label: 'LLM',
      detail: 'No AI provider configured',
    };
  } catch {
    return {
      kind: 'llm',
      status: 'unavailable',
      label: 'LLM',
      detail: 'Provider check failed',
    };
  }
}

async function checkEmbedding(): Promise<AiServiceReadiness> {
  const { modelStatus, embeddingSource } = useRagStore.getState();

  if (embeddingSource === 'rust_bge' && modelStatus === 'loaded') {
    return {
      kind: 'embedding',
      status: 'ready',
      label: 'Embedding',
      detail: 'BGE-small loaded',
    };
  }

  if (
    embeddingSource === 'rust_bge' &&
    (modelStatus === 'loading' || modelStatus === 'downloading')
  ) {
    return {
      kind: 'embedding',
      status: 'loading',
      label: 'Embedding',
      detail: 'Loading BGE-small…',
    };
  }

  if (embeddingSource === 'provider') {
    return {
      kind: 'embedding',
      status: 'ready',
      label: 'Embedding',
      detail: 'Provider embeddings',
    };
  }

  // Auto mode — check if provider embeddings are available
  try {
    const { getProviderEmbedding } = await import('@shared/services/ai/embeddingService');
    const result = await getProviderEmbedding('test');
    if (result) {
      return {
        kind: 'embedding',
        status: 'ready',
        label: 'Embedding',
        detail: 'Provider embeddings',
      };
    }
  } catch {
    // Fall through
  }

  return {
    kind: 'embedding',
    status: 'unavailable',
    label: 'Embedding',
    detail: 'No embedding model loaded',
  };
}

async function checkTts(): Promise<AiServiceReadiness> {
  try {
    const provider = await getSetting('voice_provider');
    if (provider && provider !== 'browser') {
      return {
        kind: 'tts',
        status: 'ready',
        label: 'TTS',
        detail: `${provider} TTS configured`,
      };
    }
    // Browser TTS is always available
    return {
      kind: 'tts',
      status: 'ready',
      label: 'TTS',
      detail: 'Browser TTS',
    };
  } catch {
    return {
      kind: 'tts',
      status: 'unavailable',
      label: 'TTS',
      detail: 'TTS check failed',
    };
  }
}

async function checkStt(): Promise<AiServiceReadiness> {
  try {
    const provider = await getSetting('voice_provider');
    if (provider && provider !== 'browser') {
      return {
        kind: 'stt',
        status: 'ready',
        label: 'STT',
        detail: `${provider} STT configured`,
      };
    }
    // Browser STT is available in Chromium-based webviews
    return {
      kind: 'stt',
      status: 'ready',
      label: 'STT',
      detail: 'Browser STT',
    };
  } catch {
    return {
      kind: 'stt',
      status: 'unavailable',
      label: 'STT',
      detail: 'STT check failed',
    };
  }
}

// ── Main API ─────────────────────────────────────────────────────────────────

let cachedReadiness: AiReadiness | null = null;
let checkInProgress: Promise<AiReadiness> | null = null;

/**
 * Check the readiness of all AI services.
 *
 * Results are cached for 5 seconds to avoid redundant polling.
 * Pass `force: true` to bypass the cache.
 */
export async function checkAiReadiness(force = false): Promise<AiReadiness> {
  if (!force && cachedReadiness && Date.now() - cachedReadiness.checkedAt < 5000) {
    return cachedReadiness;
  }

  if (checkInProgress) {
    return checkInProgress;
  }

  checkInProgress = (async () => {
    const [llm, embedding, tts, stt] = await Promise.all([
      checkLlm(),
      checkEmbedding(),
      checkTts(),
      checkStt(),
    ]);

    const services: Record<AiServiceKind, AiServiceReadiness> = {
      llm,
      embedding,
      tts,
      stt,
    };

    const readyCount = [llm, embedding, tts, stt].filter((s) => s.status === 'ready').length;
    const totalCount = 4;

    const readiness: AiReadiness = {
      ready: llm.status === 'ready' || embedding.status === 'ready',
      fullyReady: readyCount === totalCount,
      services,
      checkedAt: Date.now(),
    };

    cachedReadiness = readiness;
    checkInProgress = null;
    return readiness;
  })();

  return checkInProgress;
}

/**
 * Invalidate the cached readiness. Call this after a service state change
 * (e.g., model loaded, provider switched).
 */
export function invalidateAiReadiness(): void {
  cachedReadiness = null;
}

/**
 * Get the cached readiness without triggering a new check.
 * Returns null if no check has been performed yet.
 */
export function getCachedReadiness(): AiReadiness | null {
  return cachedReadiness;
}
