/**
 * useAiReadiness — React hook for unified AI service readiness.
 *
 * Polls `checkAiReadiness()` at a configurable interval and returns
 * the current readiness state. Automatically invalidates the cache
 * when the ragStore model status changes.
 *
 * @module
 */

import { useState, useEffect, useCallback } from 'react';
import { checkAiReadiness, invalidateAiReadiness, type AiReadiness } from '../services/aiReadiness';
import { useRagStore } from '../stores/ragStore';

export function useAiReadiness(refreshIntervalMs = 10000) {
  const [readiness, setReadiness] = useState<AiReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const modelStatus = useRagStore((s) => s.modelStatus);
  const embeddingSource = useRagStore((s) => s.embeddingSource);

  const refresh = useCallback(async (force = false) => {
    try {
      const result = await checkAiReadiness(force);
      setReadiness(result);
    } catch {
      // Keep previous state on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial check + periodic polling
  useEffect(() => {
    setLoading(true);
    void refresh(true);

    const handle = setInterval(() => {
      void refresh(false);
    }, refreshIntervalMs);

    return () => clearInterval(handle);
  }, [refresh, refreshIntervalMs]);

  // Invalidate cache when model status or embedding source changes
  useEffect(() => {
    invalidateAiReadiness();
    void refresh(true);
  }, [modelStatus, embeddingSource, refresh]);

  return { readiness, loading, refresh };
}
