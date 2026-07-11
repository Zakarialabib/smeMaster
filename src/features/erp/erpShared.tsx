import type { ReactNode } from 'react';
import { Info, Sparkles } from 'lucide-react';
import { formatMoney } from '@features/invoicing/utils/format';

/** Small "Demo / backend pending" badge — marks every ERP shell as non-live. */
export function DemoBadge({ label = 'Demo' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-accent/10 text-accent border border-accent/20">
      <Sparkles size={11} />
      {label}
    </span>
  );
}

/** Frosted info banner used to flag that a backend is not yet wired. */
export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-accent/5 border border-accent/15 text-sm text-text-secondary">
      <Info size={16} className="text-accent mt-0.5 shrink-0" />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

/** Frosted surface container. */
export function SectionCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border-primary bg-bg-secondary/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${className}`}
    >
      {children}
    </div>
  );
}

const STAT_TONES: Record<string, string> = {
  accent: 'bg-accent/10 text-accent',
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  neutral: 'bg-bg-tertiary text-text-secondary',
};

export function StatCard({
  label,
  value,
  icon,
  tone = 'accent',
  hint,
  compact,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: keyof typeof STAT_TONES | string;
  hint?: string;
  /** Use compact money formatting (e.g. "12.4K DH"). */
  compact?: boolean;
}) {
  return (
    <div className="bg-bg-primary/70 backdrop-blur-xl border border-border-primary rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          STAT_TONES[tone] ?? STAT_TONES.accent
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-text-tertiary text-[11px] font-semibold uppercase tracking-wider truncate">
          {label}
        </p>
        <p className="text-lg sm:text-xl font-bold text-text-primary mt-0.5 tabular-nums">
          {compact ? compactMoney(value) : formatMoney(value)}
        </p>
        {hint && <p className="text-[11px] text-text-tertiary mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function compactMoney(amount: number): string {
  const abs = Math.abs(amount);
  const symbol = 'DH';
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ${symbol}`;
  if (abs >= 1_000) return `${(amount / 1_000).toFixed(1)}K ${symbol}`;
  return formatMoney(amount);
}
