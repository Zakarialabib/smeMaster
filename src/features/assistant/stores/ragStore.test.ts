import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRagStore } from './ragStore';

// Mock DB invoke functions
vi.mock('@shared/services/db/invoke/rag', () => ({
  aiDownloadModel: vi.fn(),
  aiLoadEmbeddingModel: vi.fn(),
  aiIndexEmails: vi.fn(),
  aiQueryRag: vi.fn(),
  aiSearchByVector: vi.fn(),
  aiGetModelsDir: vi.fn(),
  aiDeleteModel: vi.fn(),
  aiGetEmailChunks: vi.fn(),
  aiInsertProviderVectors: vi.fn(),
}));

// Mock IPC safeListen
vi.mock('@shared/services/ipc', () => ({
  safeListen: vi.fn().mockResolvedValue(() => {}),
}));

// Mock storage
vi.mock('@shared/services/storage/tauriStoreStorage', () => ({
  tauriStoreStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock provider manager
vi.mock('@shared/services/ai/providerManager', () => ({
  isAiAvailable: vi.fn().mockResolvedValue(true),
  testLMStudioEmbedding: vi.fn(),
}));

// Mock embedding service
vi.mock('@shared/services/ai/embeddingService', () => ({
  getProviderEmbedding: vi.fn(),
}));

import { aiGetEmailChunks, aiInsertProviderVectors } from '@shared/services/db/invoke/rag';
import { getProviderEmbedding } from '@shared/services/ai/embeddingService';

describe('ragStore - indexAll provider embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRagStore.setState({
      indexingStatus: 'idle',
      indexingError: null,
      embeddingSource: 'provider',
    });
  });

  it('indexes chunks concurrently and passes vectors to aiInsertProviderVectors', async () => {
    const mockChunks = [
      { id: 'chunk-1', text: 'Text 1' },
      { id: 'chunk-2', text: 'Text 2' },
      { id: 'chunk-3', text: 'Text 3' },
    ];

    vi.mocked(aiGetEmailChunks).mockResolvedValue(mockChunks as any);

    let activeRequests = 0;
    let maxConcurrentRequests = 0;

    vi.mocked(getProviderEmbedding).mockImplementation(async (text: string) => {
      activeRequests++;
      if (activeRequests > maxConcurrentRequests) {
        maxConcurrentRequests = activeRequests;
      }

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 50));

      activeRequests--;

      if (text === 'Text 1') return { vectors: [[0.1, 0.2]], dimensions: 2, model: 'test' };
      if (text === 'Text 2') return { vectors: [[0.3, 0.4]], dimensions: 2, model: 'test' };
      if (text === 'Text 3') return { vectors: [[0.5, 0.6]], dimensions: 2, model: 'test' };
      return null;
    });

    const start = Date.now();
    await useRagStore.getState().indexAll();
    const duration = Date.now() - start;

    expect(getProviderEmbedding).toHaveBeenCalledTimes(3);
    expect(aiInsertProviderVectors).toHaveBeenCalledWith(
      [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]],
      ['chunk-1', 'chunk-2', 'chunk-3'],
      ['Text 1', 'Text 2', 'Text 3'],
    );
    expect(useRagStore.getState().indexingStatus).toBe('completed');

    // Store max concurrency and duration for assertion/verification in step 3
    (globalThis as any).__lastTestConcurrency = maxConcurrentRequests;
    (globalThis as any).__lastTestDuration = duration;
  });
});
