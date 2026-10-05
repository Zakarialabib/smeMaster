/**
 * ProviderBadge — colored pill per provider, adapted from the
 * prototype's ProviderBadge for our design system.
 *
 * Zero state, zero async, zero side effects.
 *
 * Usage:
 *   <ProviderBadge provider="openai" />
 *   <ProviderBadge provider="openai" model="gpt-4o" />
 *   <ProviderBadge provider="gemini" model="gemini-3.8-flash" muted />
 */

import { PROVIDER_META } from '@shared/services/ai/providerCapabilities';
import type { AiProvider } from '@shared/services/ai/types';

export interface ProviderBadgeProps {
  provider: AiProvider;
  model?: string;
  muted?: boolean;
  showLabel?: boolean;
  title?: string;
}

export function ProviderBadge({ provider, model, muted, showLabel, title }: ProviderBadgeProps) {
  const meta = PROVIDER_META[provider];
  const label = showLabel ? meta.label : meta.label.split(' ')[0];
  const text = model ? `${label} · ${model}` : label;
  const color = meta.color;

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
        background: muted ? 'var(--bg-tertiary)' : `color-mix(in oklch, ${color} 14%, transparent)`,
        color: muted ? 'var(--text-secondary)' : color,
        border: `1px solid ${muted ? 'var(--border-primary)' : `color-mix(in oklch, ${color} 30%, transparent)`}`,
        opacity: muted ? 0.75 : 1,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: meta.color,
          opacity: muted ? 0.6 : 1,
          flex: 'none',
        }}
      />
      {text}
    </span>
  );
}
