// providers/__tests__/claudeProvider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClaudeProvider, clearClaudeProvider } from '../claudeProvider';

// Mock the Anthropic SDK
const mockCreate = vi.fn();
const mockGetClient = vi.fn(() => ({
  messages: { create: mockCreate },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => mockGetClient()),
}));

vi.mock('../providerFactory', () => ({
  createProviderFactory: vi.fn((createClient) => ({
    getClient: (key: string) => createClient(key),
    clear: vi.fn(),
  })),
}));

vi.mock('../utils', () => ({
  buildSystemPrompt: vi.fn((prompt: string) => prompt),
}));

describe('createClaudeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearClaudeProvider();
  });

  it('returns text from successful completion', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hello from Claude' }],
    });

    const provider = createClaudeProvider('test-key', 'claude-sonnet-5-5');
    const result = await provider.complete({
      systemPrompt: 'You are helpful',
      userContent: 'Say hi',
    });

    expect(result).toBe('Hello from Claude');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-5-5',
        system: 'You are helpful',
        messages: [{ role: 'user', content: 'Say hi' }],
      }),
    );
  });

  it('returns empty string when no text block exists', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: '1', name: 'test', input: {} }],
    });

    const provider = createClaudeProvider('test-key', 'claude-sonnet-5-5');
    const result = await provider.complete({
      systemPrompt: '',
      userContent: 'hi',
    });

    expect(result).toBe('');
  });

  it('throws with model context on API error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('rate limited'));

    const provider = createClaudeProvider('test-key', 'claude-sonnet-5-5');
    await expect(provider.complete({ systemPrompt: '', userContent: 'hi' })).rejects.toThrow(
      'Claude API error (claude-sonnet-5-5): rate limited',
    );
  });

  it('testConnection returns true on success', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'hi' }],
    });

    const provider = createClaudeProvider('test-key', 'claude-sonnet-5-5');
    await expect(provider.testConnection()).resolves.toBe(true);
  });

  it('testConnection returns false on error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('auth failed'));

    const provider = createClaudeProvider('bad-key', 'claude-sonnet-5-5');
    await expect(provider.testConnection()).resolves.toBe(false);
  });

  it('respects maxTokens default of 1024', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'ok' }],
    });

    const provider = createClaudeProvider('test-key', 'claude-sonnet-5-5');
    await provider.complete({ systemPrompt: '', userContent: 'hi' });

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 1024 }));
  });

  it('respects custom maxTokens', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'ok' }],
    });

    const provider = createClaudeProvider('test-key', 'claude-sonnet-5-5');
    await provider.complete({
      systemPrompt: '',
      userContent: 'hi',
      maxTokens: 4096,
    });

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 4096 }));
  });
});
