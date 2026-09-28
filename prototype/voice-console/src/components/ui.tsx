import type { ReactNode } from 'react';
import { Sparkles, AlertTriangle, ShieldAlert, Info, X, Check } from 'lucide-react';

/* ── Pills ────────────────────────────────────────────────────────────────── */
export type PillTone = 'ok' | 'tr' | 'vm' | 'p1' | 'flag' | 'off' | 'ai';

const PILL: Record<PillTone, React.CSSProperties> = {
  ok: { background: 'var(--success-light)', color: '#065f46', borderColor: 'rgba(5,150,105,.25)' },
  tr: { background: 'var(--accent-light)', color: 'var(--accent-hover)', borderColor: 'rgba(11,87,208,.25)' },
  vm: { background: 'var(--info-light)', color: '#075985', borderColor: 'rgba(2,132,199,.25)' },
  p1: { background: '#ffe4e6', color: '#9f1239', borderColor: 'rgba(225,29,72,.3)' },
  flag: { background: 'var(--warning-light)', color: '#92400e', borderColor: 'rgba(217,119,6,.3)' },
  off: { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', borderColor: 'var(--border-primary)' },
  ai: { background: 'var(--ai-subtle)', color: 'var(--ai)', borderColor: 'rgba(147,51,234,.28)' },
};

export function Pill({ tone, children, title }: { tone: PillTone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
        padding: '3px 9px', borderRadius: 999, borderWidth: 1, borderStyle: 'solid',
        whiteSpace: 'nowrap', ...PILL[tone],
      }}
    >
      {children}
    </span>
  );
}

/* ── AiSuggestionBanner ──────────────────────────────────────────────────────
   The app's shared component shape. Purple means THE ASSISTANT INFERRED THIS.
   A transcript is a fact (neutral). A summary or judgement is an inference.   */
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

/* ── Degraded / offline banner ────────────────────────────────────────────────
   NEVER renders as an empty list. "Cannot reach the agent" and "no calls" are
   different facts and an operator conflating them stands down during an outage. */
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

export function Note({ children, icon = true }: { children: ReactNode; icon?: boolean }) {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start', padding: 12, margin: '12px 0',
      borderRadius: 'var(--radius-lg)', background: 'var(--bg-tertiary)',
      color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.5,
    }}>
      {icon && <Info size={14} style={{ flex: 'none', marginTop: 2, color: 'var(--text-tertiary)' }} />}
      <div>{children}</div>
    </div>
  );
}

/* ── Buttons ────────────────────────────────────────────────────────────────
   Token classes from src/shared/styles/ui-tokens.ts: BTN_BASE, BTN_PRIMARY.  */
export function Button({ children, primary, onClick, disabled, type = 'button', size = 'md' }: {
  children: ReactNode; primary?: boolean; onClick?: () => void; disabled?: boolean;
  type?: 'button' | 'submit'; size?: 'sm' | 'md';
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

/* ── Panel / section chrome ───────────────────────────────────────────────── */
export function Panel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
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

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 style={{
      fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', margin: 0,
      color: 'var(--text-tertiary)', fontWeight: 600,
    }}>{children}</h2>
  );
}

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
  name: string; checked: boolean; label: string; disabled?: boolean; onChange?: () => void;
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
  checked: boolean; label: string; disabled?: boolean; onChange?: () => void;
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

/* ── DataTable ──────────────────────────────────────────────────────────────
   The app's shared table. Columns are config objects (see the real DataTable)
   so it is themeable without forking — a console-specific table would be a
   design-system bug.                                                              */
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
  /** Identity for React keys and row clicks. Defaults to `row.id` when present. */
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

/* ── Provisional-threshold marker (WIREFRAMES G3) ─────────────────────────── */
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
