// providers/__tests__/openAiCompatibleProvider.test.ts (enhanced)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOpenAICompatibleProvider, validateUrl } from './openAiCompatibleProvider';

describe('validateUrl', () => {
  it('accepts valid http URLs', () => {
    expect(validateUrl('http://localhost:1234')).toBe('http://localhost:1234');
  });

  it('accepts valid https URLs', () => {
    expect(validateUrl('https://api.example.com')).toBe('https://api.example.com');
  });

  it('throws for invalid protocols', () => {
    expect(() => validateUrl('ftp://invalid')).toThrow('Only http and https are allowed');
  });

  it('throws for malformed URLs', () => {
    expect(() => validateUrl('not-a-url')).toThrow('Invalid server URL');
  });
});

describe('createOpenAICompatibleProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns complete() result on successful response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'Hello' } }] }),
    });
    global.fetch = mockFetch;

    const provider = createOpenAICompatibleProvider(
      'http://localhost:1234',
      'test-key',
      'test-model',
    );
    const result = await provider.complete({
      systemPrompt: 'You are helpful',
      userContent: 'Say hi',
    });

    expect(result).toBe('Hello');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:1234/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('returns empty string on empty choices', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    });

    const provider = createOpenAICompatibleProvider(
      'http://localhost:1234',
      'test-key',
      'test-model',
    );
    const result = await provider.complete({ systemPrompt: '', userContent: 'hi' });
    expect(result).toBe('');
  });

  it('throws with model context on non-OK response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    const provider = createOpenAICompatibleProvider(
      'http://localhost:1234',
      'bad-key',
      'test-model',
    );

    await expect(provider.complete({ systemPrompt: '', userContent: 'hi' })).rejects.toThrow(
      'AI provider error (401) [model=test-model]',
    );
  });

  it('testConnection returns true on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'hi' } }] }),
    });

    const provider = createOpenAICompatibleProvider(
      'http://localhost:1234',
      'test-key',
      'test-model',
    );
    await expect(provider.testConnection()).resolves.toBe(true);
  });

  it('testConnection returns false on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const provider = createOpenAICompatibleProvider(
      'http://localhost:1234',
      'test-key',
      'test-model',
    );
    await expect(provider.testConnection()).resolves.toBe(false);
  });

  it('getEmbeddings uses embeddingModel when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          model: 'text-embedding-3-small',
        }),
    });
    global.fetch = mockFetch;

    const provider = createOpenAICompatibleProvider(
      'http://localhost:1234',
      'test-key',
      'chat-model',
      'auto',
      'embed-model',
    );

    const result = await provider.getEmbeddings!({ input: 'test' });
    expect(result?.vectors).toEqual([[0.1, 0.2, 0.3]]);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:1234/v1/embeddings',
      expect.objectContaining({
        body: JSON.stringify({ model: 'embed-model', input: 'test' }),
      }),
    );
  });

  it('getEmbeddings falls back to chat model when no embeddingModel', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ embedding: [0.1] }], model: 'chat-model' }),
    });
    global.fetch = mockFetch;

    const provider = createOpenAICompatibleProvider(
      'http://localhost:1234',
      'test-key',
      'chat-model',
    );

    await provider.getEmbeddings!({ input: 'test' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:1234/v1/embeddings',
      expect.objectContaining({
        body: JSON.stringify({ model: 'chat-model', input: 'test' }),
      }),
    );
  });

  it('getEmbeddings returns null on error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Embedding failed'));

    const provider = createOpenAICompatibleProvider(
      'http://localhost:1234',
      'test-key',
      'test-model',
    );

    const result = await provider.getEmbeddings!({ input: 'test' });
    expect(result).toBeNull();
  });
});
