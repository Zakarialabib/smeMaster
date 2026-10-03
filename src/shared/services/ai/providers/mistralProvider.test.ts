// providers/__tests__/mistralProvider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMistralProvider } from './mistralProvider';

vi.mock('./openAiCompatibleProvider', () => ({
  createOpenAICompatibleProvider: vi.fn(),
}));

import { createOpenAICompatibleProvider } from './openAiCompatibleProvider';

describe('createMistralProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the Mistral base URL', () => {
    createMistralProvider('test-key', 'mistral-medium-3-5');

    expect(createOpenAICompatibleProvider).toHaveBeenCalledWith(
      'https://api.mistral.ai',
      'test-key',
      'mistral-medium-3-5',
      'auto',
      'mistral-embed',
    );
  });

  it('passes a custom embedding model', () => {
    createMistralProvider('test-key', 'mistral-medium-3-5', 'fr', 'custom-embed');

    expect(createOpenAICompatibleProvider).toHaveBeenCalledWith(
      'https://api.mistral.ai',
      'test-key',
      'mistral-medium-3-5',
      'fr',
      'custom-embed',
    );
  });
});
