// providers/__tests__/byteplusProvider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBytePlusProvider, BYTEPLUS_BASE_URL, VOLCENGINE_BASE_URL } from './byteplusProvider';

vi.mock('./openAiCompatibleProvider', () => ({
  createOpenAICompatibleProvider: vi.fn((baseUrl: string, apiKey: string, model: string) => ({
    complete: vi.fn(),
    testConnection: vi.fn(),
    getEmbeddings: vi.fn(),
    _baseUrl: baseUrl,
    _apiKey: apiKey,
    _model: model,
  })),
}));

import { createOpenAICompatibleProvider } from './openAiCompatibleProvider';

describe('createBytePlusProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the international BytePlus endpoint by default', () => {
    createBytePlusProvider('test-key', 'doubao-seed-2-1-pro-260628');

    expect(createOpenAICompatibleProvider).toHaveBeenCalledWith(
      BYTEPLUS_BASE_URL,
      'test-key',
      'doubao-seed-2-1-pro-260628',
      'auto',
    );
  });

  it('uses the China Volcengine endpoint when region is china', () => {
    createBytePlusProvider('test-key', 'doubao-seed-2-1-pro-260628', 'auto', 'china');

    expect(createOpenAICompatibleProvider).toHaveBeenCalledWith(
      VOLCENGINE_BASE_URL,
      'test-key',
      'doubao-seed-2-1-pro-260628',
      'auto',
    );
  });

  it('passes aiLanguage through', () => {
    createBytePlusProvider('test-key', 'doubao-seed-2-1-pro-260628', 'fr');

    expect(createOpenAICompatibleProvider).toHaveBeenCalledWith(
      BYTEPLUS_BASE_URL,
      'test-key',
      'doubao-seed-2-1-pro-260628',
      'fr',
    );
  });

  it('BYTEPLUS_BASE_URL matches the documented international endpoint', () => {
    expect(BYTEPLUS_BASE_URL).toBe('https://ark.ap-southeast.bytepluses.com/api/v3');
  });

  it('VOLCENGINE_BASE_URL matches the documented China endpoint', () => {
    expect(VOLCENGINE_BASE_URL).toBe('https://ark.cn-beijing.volces.com/api/v3');
  });
});
