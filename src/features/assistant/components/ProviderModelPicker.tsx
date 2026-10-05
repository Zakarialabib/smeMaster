/**
 * Provider/model selector dropdown for AI chat surfaces.
 *
 * Renders a compact provider toggle + model dropdown, populated from
 * PROVIDER_MODELS. The selected pair is persisted to settings so the
 * user's choice survives across sessions.
 */

import { useState, useEffect } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { PROVIDER_MODELS, DEFAULT_MODELS, type AiProvider } from '@shared/services/ai/types';
import { setSetting } from '@features/settings/db/settings';
import { StyledSelect } from '@shared/components/ui/StyledSelect';
import { cn } from '@shared/utils/cn';

const PROVIDERS: { id: AiProvider; label: string }[] = [
  { id: 'claude', label: 'Claude' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'copilot', label: 'Copilot' },
  { id: 'openrouter', label: 'OpenRouter' },
];

type ChatProvider = Exclude<AiProvider, 'ollama' | 'custom' | 'lmstudio' | 'local'>;

interface ProviderModelPickerProps {
  /** Currently selected provider */
  provider: AiProvider;
  /** Currently selected model id */
  model: string;
  /** Called when the user picks a new provider+model */
  onChange: (provider: AiProvider, model: string) => void;
  /** Disable the picker */
  disabled?: boolean;
  /** Compact variant (smaller) */
  compact?: boolean;
  /** Only show providers with configured API keys; falls back to offline */
  hasProviderKey?: boolean;
}

export function ProviderModelPicker({
  provider,
  model,
  onChange,
  disabled = false,
  compact = false,
  hasProviderKey = false,
}: ProviderModelPickerProps) {
  const [models, setModels] = useState(PROVIDER_MODELS[provider as ChatProvider] ?? []);
  const [loading, setLoading] = useState(false);

  // Reload models when provider changes
  useEffect(() => {
    setModels(PROVIDER_MODELS[provider as ChatProvider] ?? []);
    // Reset model to default for the new provider
    const defaultModel = DEFAULT_MODELS[provider] ?? '';
    if (!models.find((m: { id: string }) => m.id === model)) {
      onChange(provider, defaultModel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const handleProviderChange = async (val: string) => {
    setLoading(true);
    const newProvider = val as AiProvider;
    const newModels = PROVIDER_MODELS[newProvider as ChatProvider] ?? [];
    setModels(newModels);
    const defaultModel = DEFAULT_MODELS[newProvider] ?? '';
    await setSetting('ai_provider', newProvider);
    onChange(newProvider, defaultModel);
    setLoading(false);
  };

  const handleModelChange = async (val: string) => {
    await setSetting(`${provider}_model`, val);
    onChange(provider, val);
  };

  const providerModels = PROVIDER_MODELS[provider as ChatProvider] ?? [];

  // When no provider key is configured, show only offline/local option
  const availableProviders = hasProviderKey
    ? PROVIDERS
    : [{ id: 'offline' as AiProvider, label: 'Offline (Local)' }];

  return (
    <div className={cn('flex items-center gap-2', compact ? 'flex-row' : 'flex-row')}>
      <div className="flex items-center gap-1">
        <Sparkles size={compact ? 12 : 14} className="text-accent shrink-0" />
        <StyledSelect
          value={provider}
          onChange={(e) => void handleProviderChange(e.target.value)}
          disabled={disabled || loading}
          className={cn('text-xs', compact ? 'py-1 px-2' : 'py-1.5 px-3')}
        >
          {availableProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </StyledSelect>
      </div>
      <ChevronDown size={12} className="text-text-tertiary shrink-0" />
      <StyledSelect
        value={model}
        onChange={(e) => void handleModelChange(e.target.value)}
        disabled={disabled || loading || providerModels.length === 0}
        className={cn('text-xs', compact ? 'py-1 px-2' : 'py-1.5 px-3')}
      >
        {providerModels.map((m: { id: string; label: string }) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </StyledSelect>
    </div>
  );
}
