// providers/__tests__/openrouterProvider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOpenRouterProvider } from '../openrouterProvider';

vi.mock('../openAiCompatibleProvider', () => ({
  createOpenAICompatibleProvider: vi.fn(),
}));

import { createOpenAICompatibleProvider } from '../openAiCompatibleProvider';

describe('createOpenRouterProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the OpenRouter base URL', () => {
    createOpenRouterProvider('test-key', 'openai/gpt-6-sol');

    expect(createOpenAICompatibleProvider).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1',
      'test-key',
      'openai/gpt-6-sol',
      'auto',
    );
  });

  it('passes aiLanguage through', () => {
    createOpenRouterProvider('test-key', 'anthropic/claude-sonnet-5-5', 'en');

    expect(createOpenAICompatibleProvider).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1',
      'test-key',
      'anthropic/claude-sonnet-5-5',
      'en',
    );
  });
});
