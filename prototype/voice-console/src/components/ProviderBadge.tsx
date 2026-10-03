import type { AiProvider } from '../types';
import { PROVIDER_META } from '../providers/providerMeta';

/**
 * One pill per provider (optionally with a model name, optionally with a
 * muted style for fallback chains). Zero state, zero async, zero side effects.
 *
 * Usage:
 *   <ProviderBadge provider="openai" />
 *   <ProviderBadge provider="openai" model="gpt-6-sol" />
 *   <ProviderBadge provider="gemini" model="gemini-3.8-flash" muted />
 */
export interface ProviderBadgeProps {
  provider: AiProvider;
  model?: string;
  muted?: boolean;
  showLabel?: boolean;
  title?: string;
}

export function ProviderBadge({ provider, model, muted, showLabel, title }: ProviderBadgeProps) {
  const meta = PROVIDER_META[provider];
  const label = showLabel ? meta.label : meta.short;
  const text = model ? `${label} · ${model}` : label;

  return (
    <span
      title={title ?? `${meta.label}${model ? ' — ' + model : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
        background: muted ? 'var(--bg-tertiary)' : `color-mix(in oklch, ${meta.color} 14%, transparent)`,
        color: muted ? 'var(--text-secondary)' : meta.color,
        border: `1px solid ${muted ? 'var(--border-primary)' : `color-mix(in oklch, ${meta.color} 30%, transparent)`}`,
        opacity: muted ? 0.75 : 1,
      }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: 999,
          background: meta.color,
          opacity: muted ? 0.6 : 1,
          flex: 'none',
        }}
      />
      {text}
    </span>
  );
}