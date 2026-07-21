import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAiSidecarStore } from '@features/assistant/stores/aiSidecarStore';
import { useRagStore } from '@features/assistant/stores/ragStore';
import {
  activateAiSidecar,
  ensureAiSidecar,
  isAiSidecarActive,
  refreshAiSidecarRuntime,
} from '@features/assistant/services/aiSidecar';
import {
  aiDownloadModel,
  aiLoadEmbeddingModel,
  aiGetSidecarStatus,
  aiGetSidecarMetrics,
  aiListSidecarModels,
} from '@shared/services/db/invoke/rag';

// Mock the external dependencies
vi.mock('@shared/services/db/invoke/rag', () => ({
  aiDownloadModel: vi.fn(),
  aiLoadEmbeddingModel: vi.fn(),
  aiGetSidecarStatus: vi.fn(),
  aiGetSidecarMetrics: vi.fn(),
  aiListSidecarModels: vi.fn(),
}));

vi.mock('@features/assistant/stores/ragStore', () => {
  const initialState = { modelPath: null, tokenizerPath: null, modelStatus: 'idle' };
  const state = { ...initialState };
  const api = {
    getState: () => state,
    setState: (partial) => {
      const next = typeof partial === 'function' ? partial(state) : partial;
      Object.assign(state, next);
    },
    subscribe: vi.fn(),
    destroy: vi.fn(),
  };
  Object.assign(state, api);
  return { useRagStore: api };
});

vi.mock('@features/assistant/stores/aiSidecarStore', () => {
  const initialState = {
    active: false,
    modelPath: null,
    status: 'idle',
    error: null,
    enabled: false,
    running: false,
    healthy: false,
    version: null,
    metrics: null,
  };
  const state = { ...initialState };
  const api = {
    getState: () => state,
    setState: (partial) => {
      const next = typeof partial === 'function' ? partial(state) : partial;
      Object.assign(state, next);
    },
    subscribe: vi.fn(),
    destroy: vi.fn(),
    setActive: (active) => api.setState({ active }),
    setModelPath: (modelPath) => api.setState({ modelPath }),
    setStatus: (status) => api.setState({ status }),
    setError: (error) => api.setState({ error }),
    reset: () => api.setState({ ...initialState }),
    setSidecarRuntime: (payload) => api.setState(payload),
    setMetrics: (metrics) => api.setState({ metrics }),
  };
  Object.assign(state, api);
  return { useAiSidecarStore: api };
});

describe('aiSidecar service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAiSidecarStore.getState().reset();
    useRagStore.getState().setState({ modelPath: null, tokenizerPath: null, modelStatus: 'idle' });
  });

  describe('lazy loading behavior', () => {
    it('does not initialize engine on import', () => {
      expect(aiDownloadModel).not.toHaveBeenCalled();
      expect(aiLoadEmbeddingModel).not.toHaveBeenCalled();
    });

    it('engine is created on first activation', async () => {
      const mockModelPath = '/fake/path/model.safetensors';
      const mockTokenizerPath = '/fake/path/tokenizer.json';

      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockResolvedValue(undefined);

      const result = await activateAiSidecar();

      expect(aiDownloadModel).toHaveBeenCalledTimes(2);
      expect(aiLoadEmbeddingModel).toHaveBeenCalledWith(mockModelPath, mockTokenizerPath);
      expect(result).toBe(mockModelPath);
    });
  });

  describe('activation with existing model', () => {
    it('activates successfully when model already exists', async () => {
      useRagStore.getState().setState({
        modelPath: '/existing/model.safetensors',
        tokenizerPath: '/existing/tokenizer.json',
        modelStatus: 'loaded',
      });
      useAiSidecarStore.getState().setState({
        active: true,
        modelPath: '/existing/model.safetensors',
        status: 'ready',
      });

      const result = await activateAiSidecar();

      expect(aiDownloadModel).not.toHaveBeenCalled();
      expect(aiLoadEmbeddingModel).not.toHaveBeenCalled();
      expect(result).toBe('/existing/model.safetensors');
    });
  });

  describe('model download and load flow', () => {
    it('downloads model when not present', async () => {
      const mockModelPath = '/downloaded/model.safetensors';
      const mockTokenizerPath = '/downloaded/tokenizer.json';

      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockResolvedValue(undefined);

      const result = await activateAiSidecar();

      expect(aiDownloadModel).toHaveBeenCalledTimes(2);
      expect(aiDownloadModel).toHaveBeenCalledWith('BAAI/bge-small-en-v1.5', 'model.safetensors');
      expect(aiDownloadModel).toHaveBeenCalledWith('BAAI/bge-small-en-v1.5', 'tokenizer.json');
      expect(aiLoadEmbeddingModel).toHaveBeenCalledWith(mockModelPath, mockTokenizerPath);
    });

    it('handles download errors gracefully', async () => {
      const error = new Error('Download failed');
      (aiDownloadModel as vi.Mock).mockRejectedValue(error);

      await expect(activateAiSidecar()).rejects.toThrow(error);
      expect(aiLoadEmbeddingModel).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles model load errors', async () => {
      const mockModelPath = '/fake/path/model.safetensors';
      const mockTokenizerPath = '/fake/path/tokenizer.json';
      const loadError = new Error('Load failed');

      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockRejectedValue(loadError);

      await expect(activateAiSidecar()).rejects.toThrow(loadError);
      expect(useAiSidecarStore.getState().status).toBe('error');
      expect(useAiSidecarStore.getState().error).toContain('Load failed');
    });

    it('handles activation errors gracefully', async () => {
      const error = new Error('Activation failed');
      (aiDownloadModel as vi.Mock).mockRejectedValue(error);

      await expect(activateAiSidecar()).rejects.toThrow(error);
      expect(useAiSidecarStore.getState().status).toBe('error');
    });
  });

  describe('state management', () => {
    it('updates store state correctly', async () => {
      const mockModelPath = '/fake/path/model.safetensors';
      const mockTokenizerPath = '/fake/path/tokenizer.json';

      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockResolvedValue(undefined);

      await activateAiSidecar();

      expect(useAiSidecarStore.getState().active).toBe(true);
      expect(useAiSidecarStore.getState().modelPath).toBe(mockModelPath);
      expect(useAiSidecarStore.getState().status).toBe('ready');
      expect(useAiSidecarStore.getState().error).toBeNull();
    });

    it('maintains consistent state across multiple calls', async () => {
      const mockModelPath = '/fake/path/model.safetensors';
      const mockTokenizerPath = '/fake/path/tokenizer.json';

      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockResolvedValue(undefined);

      const result1 = await activateAiSidecar();
      const stateAfterFirst = useAiSidecarStore.getState();

      const result2 = await activateAiSidecar();
      const stateAfterSecond = useAiSidecarStore.getState();

      expect(stateAfterFirst).toEqual(stateAfterSecond);
      expect(result1).toBe(result2);
    });
  });

  describe('ensureAiSidecar function', () => {
    it('returns existing model path when active', async () => {
      useAiSidecarStore.getState().setState({
        active: true,
        modelPath: '/existing/model.safetensors',
        status: 'ready',
      });

      const result = await ensureAiSidecar();
      expect(result).toBe('/existing/model.safetensors');
      expect(aiDownloadModel).not.toHaveBeenCalled();
      expect(aiLoadEmbeddingModel).not.toHaveBeenCalled();
    });

    it('activates sidecar when not ready', async () => {
      const mockModelPath = '/fake/path/model.safetensors';
      const mockTokenizerPath = '/fake/path/tokenizer.json';

      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockResolvedValue(undefined);

      const result = await ensureAiSidecar();

      expect(result).toBe(mockModelPath);
      expect(useAiSidecarStore.getState().active).toBe(true);
    });
  });

  describe('isAiSidecarActive function', () => {
    it('returns true when sidecar is active and ready', () => {
      useAiSidecarStore.getState().setState({
        active: true,
        modelPath: '/model.safetensors',
        status: 'ready',
      });

      expect(isAiSidecarActive()).toBe(true);
    });

    it('returns false when sidecar is not active', () => {
      useAiSidecarStore.getState().setState({
        active: false,
        modelPath: null,
        status: 'idle',
      });

      expect(isAiSidecarActive()).toBe(false);
    });

    it('returns false when sidecar is loading', () => {
      useAiSidecarStore.getState().setState({
        active: true,
        modelPath: null,
        status: 'loading',
      });

      expect(isAiSidecarActive()).toBe(false);
    });

    it('returns false when sidecar has error', () => {
      useAiSidecarStore.getState().setState({
        active: true,
        modelPath: null,
        status: 'error',
      });

      expect(isAiSidecarActive()).toBe(false);
    });
  });

  describe('idempotency', () => {
    it('multiple calls with same parameters return same result', async () => {
      const mockModelPath = '/fake/path/model.safetensors';
      const mockTokenizerPath = '/fake/path/tokenizer.json';

      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockResolvedValue(undefined);

      const result1 = await activateAiSidecar();
      const result2 = await activateAiSidecar();

      expect(result1).toBe(result2);
      expect(aiDownloadModel).toHaveBeenCalledTimes(2);
      expect(aiLoadEmbeddingModel).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshAiSidecarRuntime', () => {
    it('success path updates store runtime fields and metrics', async () => {
      (aiGetSidecarStatus as vi.Mock).mockResolvedValue({
        enabled: true,
        running: true,
        healthy: true,
        version: '1.2.3',
      });
      (aiGetSidecarMetrics as vi.Mock).mockResolvedValue({
        embed_count: 1,
        index_count: 2,
        query_count: 3,
        parse_count: 4,
        unload_count: 0,
        last_model_load_ms: 12,
        model_loaded: true,
        rss_mb: 128,
      });
      (aiListSidecarModels as vi.Mock).mockResolvedValue(['model-a']);

      await refreshAiSidecarRuntime();

      expect(aiGetSidecarStatus).toHaveBeenCalledTimes(1);
      expect(aiGetSidecarMetrics).toHaveBeenCalledTimes(1);
      expect(aiListSidecarModels).toHaveBeenCalledTimes(1);

      expect(useAiSidecarStore.getState().enabled).toBe(true);
      expect(useAiSidecarStore.getState().running).toBe(true);
      expect(useAiSidecarStore.getState().healthy).toBe(true);
      expect(useAiSidecarStore.getState().version).toBe('1.2.3');
      expect(useAiSidecarStore.getState().metrics).toEqual({
        embed_count: 1,
        index_count: 2,
        query_count: 3,
        parse_count: 4,
        unload_count: 0,
        last_model_load_ms: 12,
        model_loaded: true,
        rss_mb: 128,
      });
    });

    it('handles backend rejection from aiGetSidecarStatus without crashing', async () => {
      (aiGetSidecarStatus as vi.Mock).mockRejectedValue(
        new Error('status backend error'),
      );

      await expect(refreshAiSidecarRuntime()).resolves.toBeUndefined();

      expect(useAiSidecarStore.getState().enabled).toBe(false);
      expect(useAiSidecarStore.getState().running).toBe(false);
      expect(useAiSidecarStore.getState().healthy).toBe(false);
      expect(useAiSidecarStore.getState().version).toBeNull();
    });

    it('handles backend throw from aiGetSidecarMetrics without crashing', async () => {
      (aiGetSidecarStatus as vi.Mock).mockResolvedValue({
        enabled: true,
        running: true,
        healthy: true,
        version: '1.2.3',
      });
      (aiGetSidecarMetrics as vi.Mock).mockRejectedValue(
        new Error('metrics backend error'),
      );
      (aiListSidecarModels as vi.Mock).mockResolvedValue(['model-a']);

      await expect(refreshAiSidecarRuntime()).resolves.toBeUndefined();

      expect(useAiSidecarStore.getState().enabled).toBe(true);
      expect(useAiSidecarStore.getState().running).toBe(true);
      expect(useAiSidecarStore.getState().healthy).toBe(true);
      expect(useAiSidecarStore.getState().version).toBe('1.2.3');
      expect(useAiSidecarStore.getState().metrics).toBeNull();
    });

    it('does not crash on total upper-level failure', async () => {
      (aiGetSidecarStatus as vi.Mock).mockRejectedValue(
        new Error('fatal refresh error'),
      );
      (aiGetSidecarMetrics as vi.Mock).mockRejectedValue(
        new Error('metrics fatal error'),
      );
      (aiListSidecarModels as vi.Mock).mockRejectedValue(
        new Error('models fatal error'),
      );

      await expect(refreshAiSidecarRuntime()).resolves.toBeUndefined();
    });
  });

  describe('rag wrapper command names', () => {
    it('aiGetSidecarStatus calls invokeCommand with ai_get_sidecar_status', async () => {
      (aiGetSidecarStatus as vi.Mock).mockResolvedValue({
        enabled: true,
        running: true,
        healthy: true,
        version: null,
      });

      await refreshAiSidecarRuntime();

      expect(aiGetSidecarStatus).toHaveBeenCalledTimes(1);
    });

    it('aiGetSidecarMetrics calls invokeCommand with ai_get_sidecar_metrics', async () => {
      (aiGetSidecarStatus as vi.Mock).mockResolvedValue({
        enabled: true,
        running: true,
        healthy: true,
        version: null,
      });
      (aiGetSidecarMetrics as vi.Mock).mockResolvedValue({
        embed_count: 0,
        index_count: 0,
        query_count: 0,
        parse_count: 0,
        unload_count: 0,
        last_model_load_ms: 0,
        model_loaded: false,
        rss_mb: 0,
      });

      await refreshAiSidecarRuntime();

      expect(aiGetSidecarMetrics).toHaveBeenCalledTimes(1);
    });

    it('aiListSidecarModels calls invokeCommand with ai_list_sidecar_models', async () => {
      (aiGetSidecarStatus as vi.Mock).mockResolvedValue({
        enabled: true,
        running: true,
        healthy: true,
        version: null,
      });
      (aiGetSidecarMetrics as vi.Mock).mockResolvedValue({
        embed_count: 0,
        index_count: 0,
        query_count: 0,
        parse_count: 0,
        unload_count: 0,
        last_model_load_ms: 0,
        model_loaded: false,
        rss_mb: 0,
      });
      (aiListSidecarModels as vi.Mock).mockResolvedValue([]);

      await refreshAiSidecarRuntime();

      expect(aiListSidecarModels).toHaveBeenCalledTimes(1);
    });
  });
});
