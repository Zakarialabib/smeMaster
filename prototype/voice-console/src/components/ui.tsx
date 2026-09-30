import type { ReactNode, CSSProperties } from 'react';
import { Sparkles, AlertTriangle, ShieldAlert, Info, X, Check } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════════════
   PILLS + BADGES
   ══════════════════════════════════════════════════════════════════════════ */

export type PillTone = 'ok' | 'tr' | 'vm' | 'p1' | 'flag' | 'off' | 'ai';

const PILL: Record<PillTone, CSSProperties> = {
  ok: { background: 'var(--success-light)', color: '#065f46', borderColor: 'rgba(5,150,105,.25)' },
  tr: { background: 'var(--accent-light)', color: 'var(--accent-hover)', borderColor: 'rgba(11,87,208,.25)' },
  vm: { background: 'var(--info-light)', color: '#075985', borderColor: 'rgba(2,132,199,.25)' },
  p1: { background: '#ffe4e6', color: '#9f1239', borderColor: 'rgba(225,29,72,.3)' },
  flag: { background: 'var(--warning-light)', color: '#92400e', borderColor: 'rgba(217,119,6,.3)' },
  off: { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', borderColor: 'var(--border-primary)' },
  ai: { background: 'var(--ai-subtle)', color: 'var(--ai)', borderColor: 'rgba(147,51,234,.28)' },
};

export function Pill({ tone, children, title, style }: { tone: PillTone; children: ReactNode; title?: string; style?: CSSProperties }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
        padding: '3px 9px', borderRadius: 999, borderWidth: 1, borderStyle: 'solid',
        whiteSpace: 'nowrap', ...PILL[tone], ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   BANNERS (Ai / Degraded / Note)
   ══════════════════════════════════════════════════════════════════════════ */

export function AiBanner({ title, body, actions }: { title: string; body: string; actions?: ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start', margin: '12px 0',
      padding: 12, borderRadius: 'var(--radius-lg)',
      background: 'var(--ai-subtle)', border: '1px solid rgba(147,51,234,.28)',
    }}>
      <span style={{
        width: 22, height: 22, flex: 'none', borderRadius: 999, background: 'var(--ai)',
        color: '#fff', display: 'grid', placeItems: 'center',
      }}>
        <Sparkles size={12} strokeWidth={2.5} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', color: 'var(--ai)', fontWeight: 600, marginBottom: 2 }}>{title}</strong>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>{body}</p>
        {actions && <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>{actions}</div>}
      </div>
    </div>
  );
}

export function DegradedBanner({ title, body, tone = 'danger', action }: {
  title: string; body: string; tone?: 'danger' | 'warning'; action?: ReactNode;
}) {
  const warn = tone === 'warning';
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start', margin: '12px 0', padding: 12,
      borderRadius: 'var(--radius-lg)',
      background: warn ? 'var(--warning-light)' : '#fff1f2',
      border: `1px solid ${warn ? 'rgba(217,119,6,.35)' : 'rgba(225,29,72,.3)'}`,
    }}>
      <span style={{
        width: 22, height: 22, flex: 'none', borderRadius: 999,
        background: warn ? 'var(--warning)' : 'var(--danger)', color: '#fff',
        display: 'grid', placeItems: 'center',
      }}>
        {warn ? <AlertTriangle size={12} /> : <ShieldAlert size={12} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', marginBottom: 2, color: warn ? '#92400e' : '#9f1239' }}>{title}</strong>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>{body}</p>
        {action && <div style={{ marginTop: 10 }}>{action}</div>}
      </div>
    </div>
  );
}

export function Note({ children, icon = true, style }: { children: ReactNode; icon?: boolean; style?: CSSProperties }) {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start', padding: 12, margin: '12px 0',
      borderRadius: 'var(--radius-lg)', background: 'var(--bg-tertiary)',
      color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.5,
      ...style,
    }}>
      {icon && <Info size={14} style={{ flex: 'none', marginTop: 2, color: 'var(--text-tertiary)' }} />}
      <div>{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   BUTTONS
   ══════════════════════════════════════════════════════════════════════════ */

export function Button({
  children, primary, onClick, onClickWithEvent, disabled, type = 'button', size = 'md',
}: {
  children: ReactNode;
  primary?: boolean;
  onClick?: () => void;
  onClickWithEvent?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="focus-ring"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        font: 'inherit', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        borderRadius: 'var(--radius)',
        padding: size === 'sm' ? '5px 10px' : '7px 12px',
        fontSize: size === 'sm' ? 12.5 : 13.5,
        border: `1px solid ${primary ? 'var(--accent)' : 'var(--border-primary)'}`,
        background: primary ? 'var(--accent)' : 'var(--bg-primary)',
        color: primary ? '#fff' : 'var(--text-secondary)',
        transition: 'background .12s, border-color .12s',
      }}
    >
      {children}
    </button>
  );
}

/* ── IconButton — a square, icon-only button.
   Sizes: 'sm' = 24px (trash/refresh inline), 'md' = 32px (toolbar). */
export type IconButtonTone = 'neutral' | 'accent' | 'danger' | 'ai';

export function IconButton({
  icon, onClick, title, disabled, tone = 'neutral', size = 'sm', ariaLabel,
}: {
  icon: ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  tone?: IconButtonTone;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}) {
  const color =
    tone === 'danger' ? 'var(--danger)' :
      tone === 'accent' ? 'var(--accent)' :
        tone === 'ai' ? 'var(--ai)' :
          'var(--text-secondary)';
  const dim = size === 'sm' ? 26 : 34;
  const pad = size === 'sm' ? 5 : 8;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      className="focus-ring"
      style={{
        display: 'inline-grid', placeItems: 'center',
        width: dim, height: dim, padding: pad,
        font: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border-primary)',
        background: 'var(--bg-primary)',
        color,
        transition: 'background .12s, border-color .12s, color .12s',
      }}
    >
      {icon}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   INPUTS
   ══════════════════════════════════════════════════════════════════════════ */

export function Input({
  value, onChange, placeholder, type = 'text', ariaLabel,
  autoFocus, monospace, disabled, onKeyDown, width, fullWidth,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'number' | 'email';
  ariaLabel?: string;
  autoFocus?: boolean;
  monospace?: boolean;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Fixed pixel width (used for compact numeric fields). */
  width?: number;
  /** Take all available space (default when width is not set). */
  fullWidth?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className="focus-ring"
      style={{
        font: 'inherit',
        fontFamily: monospace ? 'ui-monospace, SFMono-Regular, monospace' : 'inherit',
        fontSize: 12.5,
        width: width ? `${width}px` : (fullWidth === false ? 'auto' : '100%'),
        padding: '6px 10px',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius)',
        background: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        opacity: disabled ? 0.55 : 1,
      }}
    />
  );
}

export function Select({ value, onChange, options, disabled, ariaLabel }: {
  value: string; onChange?: (v: string) => void; options: { v: string; l: string; disabled?: boolean }[];
  disabled?: boolean; ariaLabel?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="focus-ring"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        font: 'inherit', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius)',
        background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
        padding: '6px 10px', opacity: disabled ? 0.55 : 1,
      }}
    >
      {options.map((o) => <option key={o.v} value={o.v} disabled={o.disabled}>{o.l}</option>)}
    </select>
  );
}

export function Radio({ name, checked, label, disabled, onChange }: {
  name: string; checked: boolean; label: ReactNode; disabled?: boolean; onChange?: () => void;
}) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
      color: disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} />
      {label}
    </label>
  );
}

export function Checkbox({ checked, label, disabled, onChange }: {
  checked: boolean; label: ReactNode; disabled?: boolean; onChange?: () => void;
}) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
      color: disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
      {label}
    </label>
  );
}

/* ── Slider — the range input with label + value + bounds.
   Used by the Cost simulator for volume and outcome mix. */
export function Slider({
  label, value, min, max, step, unit, onChange, tone = 'ok', showBounds = true,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  tone?: PillTone;
  showBounds?: boolean;
}) {
  const toneColor =
    tone === 'ok' ? 'var(--success)' :
      tone === 'flag' ? 'var(--warning)' :
        tone === 'p1' ? 'var(--danger)' :
          tone === 'ai' ? 'var(--ai)' :
            tone === 'tr' ? 'var(--accent)' :
              tone === 'vm' ? '#0891b2' :
                'var(--accent)';

  const fmt = (v: number) => (Number.isInteger(step) ? v.toString() : v.toFixed(1));

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: toneColor }}>
          {fmt(value)}{unit && ` ${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
        style={{ width: '100%', accentColor: toneColor }}
      />
      {showBounds && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
          <span>{fmt(min)}{unit && ` ${unit}`}</span>
          <span>{fmt(max)}{unit && ` ${unit}`}</span>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PANEL + SECTION CHROME
   ══════════════════════════════════════════════════════════════════════════ */

export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      className="frost-surface"
      style={{
        borderRadius: 'var(--radius-lg)', background: 'var(--bg-primary)',
        border: '1px solid var(--border-primary)', boxShadow: 'var(--elevation-sm)',
        overflow: 'hidden', ...style,
      }}
    >
      {children}
    </section>
  );
}

export function PanelHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      padding: '12px 16px', borderBottom: '1px solid var(--border-primary)',
    }}>
      <h1 style={{ fontSize: 16, margin: 0, fontWeight: 600 }}>{title}</h1>
      {sub && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{sub}</span>}
      <span style={{ flex: 1 }} />
      {right}
    </header>
  );
}

export function SectionTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <h2 style={{
      fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', margin: 0,
      color: 'var(--text-tertiary)', fontWeight: 600,
      ...style,
    }}>{children}</h2>
  );
}

/** Full-width labeled section header used above DataTable groups (Ops page). */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: '10px 16px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
      color: 'var(--text-tertiary)', fontWeight: 600, background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-primary)',
    }}>{children}</div>
  );
}

/** Horizontal rule. With a label it becomes a labeled divider. */
export function Divider({ label }: { label?: string }) {
  if (!label) {
    return <hr style={{ border: 0, borderTop: '1px solid var(--border-secondary)', margin: '12px 0' }} />;
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0',
      color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600,
    }}>
      <hr style={{ flex: 1, border: 0, borderTop: '1px solid var(--border-secondary)' }} />
      {label}
      <hr style={{ flex: 1, border: 0, borderTop: '1px solid var(--border-secondary)' }} />
    </div>
  );
}

/** Inline monospace snippet — for model IDs, env vars, config values. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code style={{
      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      fontSize: '0.92em',
      padding: '1px 6px',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--bg-tertiary)',
      color: 'var(--text-primary)',
    }}>{children}</code>
  );
}

/* ── Labeled row — the layout used by Settings + Config for form rows. */
export function Labeled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, alignItems: 'center', padding: '8px 0' }}>
      <label style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {children}
        {hint && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{hint}</span>}
      </div>
    </div>
  );
}

/* ── KeyValueRow — the label / value display used in the About tab and
   anywhere a compact read-only fact needs to be shown. */
export function KeyValueRow({ k, v, labelWidth = 170 }: {
  k: string; v: ReactNode; labelWidth?: number;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${labelWidth}px 1fr`, gap: 12, fontSize: 13, padding: '4px 0' }}>
      <span style={{ color: 'var(--text-tertiary)' }}>{k}</span>
      <span style={{ color: 'var(--text-secondary)' }}>{v}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CARD — the clickable option surface
   Used by: vertical templates (Config), tier picker (Config),
   stat cards (Cost), wizard questions (Knowledge).
   ══════════════════════════════════════════════════════════════════════════ */

export function Card({
  children, active, disabled, onClick, style, interactive,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  /** Sets cursor + hover affordance. Auto-enabled when onClick is provided. */
  interactive?: boolean;
}) {
  const isInteractive = interactive ?? !!onClick;
  return (
    <div
      onClick={disabled ? undefined : onClick}
      role={isInteractive && !disabled ? 'button' : undefined}
      tabIndex={isInteractive && !disabled ? 0 : undefined}
      onKeyDown={
        isInteractive && !disabled && onClick
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }
          : undefined
      }
      className={isInteractive ? 'focus-ring' : undefined}
      style={{
        padding: 14,
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-primary)'}`,
        background: active ? 'var(--accent-subtle)' : 'var(--bg-primary)',
        cursor: disabled ? 'not-allowed' : (isInteractive ? 'pointer' : 'default'),
        opacity: disabled ? 0.6 : 1,
        transition: 'border-color .12s, background .12s',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Stat — the small numeric display used in the Cost results column.
   Layout 'card': centred, big number, colored label. Used inline in a grid.
   Layout 'inline': label above small value, no chrome. Used below the fold. */
export function Stat({
  label, value, sub, tone = 'ai', highlight, layout = 'card', style,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: PillTone;
  highlight?: boolean;
  layout?: 'card' | 'inline';
  style?: CSSProperties;
}) {
  const toneColor =
    tone === 'ok' ? 'var(--success)' :
      tone === 'flag' ? 'var(--warning)' :
        tone === 'p1' ? 'var(--danger)' :
          tone === 'ai' ? 'var(--ai)' :
            tone === 'tr' ? 'var(--accent)' :
              tone === 'vm' ? '#0891b2' :
                'var(--text-tertiary)';

  if (layout === 'inline') {
    return (
      <div style={{
        padding: '8px 10px', borderRadius: 'var(--radius)',
        background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
        ...style,
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      </div>
    );
  }

  return (
    <div style={{
      padding: 12,
      borderRadius: 'var(--radius-lg)',
      background: highlight ? 'var(--bg-secondary)' : 'var(--bg-primary)',
      border: `1px solid ${highlight ? toneColor : 'var(--border-primary)'}33`,
      textAlign: 'center',
      ...style,
    }}>
      <div style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
        color: toneColor, fontWeight: 600, marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color: 'var(--text-primary)', marginBottom: 2,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</div>}
    </div>
  );
}

/* ── ProgressBar — the horizontal bar used in the pilot scorecard and the
   scenario play progress. */
export function ProgressBar({
  value, max = 100, tone = 'ok', height = 6, style,
}: {
  value: number;
  max?: number;
  tone?: PillTone;
  height?: number;
  style?: CSSProperties;
}) {
  const pct = max === 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  const toneColor =
    tone === 'ok' ? 'var(--success)' :
      tone === 'flag' ? 'var(--warning)' :
        tone === 'p1' ? 'var(--danger)' :
          tone === 'ai' ? 'var(--ai)' :
            'var(--accent)';
  return (
    <div style={{
      height, background: 'var(--border-primary)', borderRadius: 999, overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: toneColor,
        transition: 'width .2s',
      }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TABS — segmented control. Replaces the inline tab bars in
   Settings, Config, and Knowledge.
   ══════════════════════════════════════════════════════════════════════════ */

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Optional numeric counter shown as a small pill. */
  count?: number;
}

export function Tabs<T extends string>({
  tabs, value, onChange, size = 'md', variant = 'pill', ariaLabel,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  size?: 'sm' | 'md';
  variant?: 'pill' | 'underline';
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{ display: 'inline-flex', gap: variant === 'pill' ? 4 : 0, alignItems: 'center' }}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        const disabled = !!t.disabled;
        const common: CSSProperties = {
          font: 'inherit',
          fontSize: size === 'sm' ? 12 : 12.5,
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: size === 'sm' ? '4px 8px' : '6px 10px',
          borderRadius: variant === 'pill' ? 'var(--radius)' : 0,
          border: 0,
          background: active && variant === 'pill' ? 'var(--accent-subtle)' : 'transparent',
          color: active ? 'var(--accent)' : (disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)'),
          fontWeight: active ? 600 : 400,
          display: 'inline-flex', gap: 6, alignItems: 'center',
          opacity: disabled ? 0.5 : 1,
          borderBottom: variant === 'underline'
            ? `2px solid ${active ? 'var(--accent)' : 'transparent'}`
            : undefined,
        };
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => !disabled && onChange(t.id)}
            className="focus-ring"
            style={common}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <Pill tone="off" style={{ fontSize: 10, padding: '0 6px' }}>{t.count}</Pill>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   EMPTY STATE — a consistent placeholder for "nothing here yet".
   Used when a list is empty, not when it failed (that is a DegradedBanner).
   ══════════════════════════════════════════════════════════════════════════ */

export function EmptyState({
  icon, title, body, action, style,
}: {
  icon?: ReactNode;
  title: string;
  body: ReactNode;
  action?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{
      padding: 40, display: 'grid', placeItems: 'center',
      color: 'var(--text-tertiary)', textAlign: 'center',
      ...style,
    }}>
      <div style={{ maxWidth: 420 }}>
        {icon && <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>}
        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>{body}</div>
        {action && <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 8 }}>{action}</div>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DATATABLE
   ══════════════════════════════════════════════════════════════════════════ */

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'start' | 'end';
  render: (row: T) => ReactNode;
}

export function DataTable<T>({ rows, columns, onRowClick, selectedId, caption, rowKey }: {
  rows: T[]; columns: Column<T>[]; onRowClick?: (id: string) => void; selectedId?: string | null;
  caption?: string;
  rowKey?: (row: T) => string;
}) {
  const keyOf = rowKey ?? ((r: T) => (r as unknown as { id?: string }).id ?? JSON.stringify(r).slice(0, 40));
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 640 }}>
        {caption && (
          <caption style={{ textAlign: 'start', padding: '0 16px 8px', fontSize: 12, color: 'var(--text-tertiary)' }}>
            {caption}
          </caption>
        )}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={{
                  fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em',
                  color: 'var(--text-tertiary)', fontWeight: 600, textAlign: c.align ?? 'start',
                  padding: '8px 16px', borderBottom: '1px solid var(--border-primary)',
                  background: 'var(--bg-secondary)', width: c.width,
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={keyOf(r)}
              onClick={() => onRowClick?.(keyOf(r))}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={(e) => { if (onRowClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(keyOf(r)); } }}
              className="focus-ring"
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                background: selectedId && selectedId === keyOf(r) ? 'var(--bg-selected)' : undefined,
              }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border-secondary)',
                    color: 'var(--text-secondary)', textAlign: c.align ?? 'start', verticalAlign: 'middle',
                  }}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SMALL MARKERS
   ══════════════════════════════════════════════════════════════════════════ */

export function ProvisionalTag() {
  return (
    <Pill tone="flag" title="Threshold not yet measured. Awaiting pilot data.">
      <AlertTriangle size={11} /> threshold provisional
    </Pill>
  );
}

export function AckBadge({ at, by }: { at: string | null; by: string | null }) {
  if (!at) return null;
  return <Pill tone="ok" title={`Acknowledged by ${by}`}><Check size={11} /> ack {at.slice(11, 16)}</Pill>;
}

/* ══════════════════════════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════════════════════════ */

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div role="status" style={{
      position: 'fixed', insetInlineEnd: 16, bottom: 16, zIndex: 50,
      display: 'flex', alignItems: 'center', gap: 10, maxWidth: 420,
      padding: '10px 14px', borderRadius: 'var(--radius-lg)',
      background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
      boxShadow: 'var(--elevation-lg)', fontSize: 13,
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} aria-label="Dismiss" className="focus-ring"
        style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
        <X size={14} />
      </button>
    </div>
  );
}