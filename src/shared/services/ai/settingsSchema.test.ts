import { describe, it, expect } from 'vitest';
import { validateSetting, getSecureSettingKeys, getProviderSettingKeys } from '../settingsSchema';

describe('settings schema', () => {
  it('validateSetting returns true for valid boolean', () => {
    expect(validateSetting('ai_enabled', 'true')).toBe(true);
    expect(validateSetting('ai_enabled', 'false')).toBe(true);
    expect(validateSetting('ai_enabled', 'invalid')).toBe(false);
  });

  it('validateSetting returns true for valid number', () => {
    expect(validateSetting('rag_chunk_size', '500')).toBe(true);
    expect(validateSetting('rag_chunk_size', 'invalid')).toBe(false);
  });

  it('validateSetting returns true for valid JSON', () => {
    expect(validateSetting('ai_task_routes', '{}')).toBe(true);
    expect(validateSetting('ai_task_routes', 'invalid')).toBe(false);
  });

  it('validateSetting returns true for valid string with options', () => {
    expect(validateSetting('ai_provider', 'openai')).toBe(true);
    expect(validateSetting('ai_provider', 'invalid')).toBe(false);
  });

  it('validateSetting returns true for unknown keys', () => {
    expect(validateSetting('unknown_key', 'any_value')).toBe(true);
  });

  it('getSecureSettingKeys returns encrypted keys', () => {
    const keys = getSecureSettingKeys();
    expect(keys).toContain('openai_api_key');
    expect(keys).toContain('gemini_api_key');
    expect(keys).toContain('mistral_api_key');
    expect(keys).toContain('byteplus_api_key');
    expect(keys).not.toContain('ai_provider');
  });

  it('getProviderSettingKeys returns keys for a provider', () => {
    const keys = getProviderSettingKeys('openai');
    expect(keys).toContain('openai_api_key');
    expect(keys).toContain('openai_model');
    expect(keys).not.toContain('gemini_api_key');
  });
});
