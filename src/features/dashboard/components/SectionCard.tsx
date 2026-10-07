import { useId, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Info, X, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatBox } from './StatBox';

/**
 * SectionCard — reusable "menu console" card for the dashboard.
 *
 * Navigation lives in the section TITLE (a real link) — the card surface
 * itself is not clickable. The info button opens an in-card popover
 * describing the section (it never covers the dashboard), and the optional
 * `children` slot stays interactive.
 *
 * All i18n strings are passed as translation keys and resolved here with
 * `t()`. Styling uses design tokens only — never hardcoded colors.
 */

export interface SectionStat {
  /** i18n key (e.g. `common.unread`) — translated by the card. */
  label: string;
  /** `null` renders an em-dash placeholder (loading / unavailable). */
  value: string | number | null;
  /** Optional i18n key rendered as a small hint under the value. */
  hint?: string;
  variant?: 'default' | 'danger' | 'warning' | 'muted';
}

export type SectionAccent = 'accent' | 'success' | 'warning' | 'danger';

export interface SectionCardProps {
  /** i18n key for the card title. */
  title: string;
  /** lucide-react icon component. */
  icon: LucideIcon;
  /** i18n key — the "what is this section" text shown in the slide-over. */
  description: string;
  /** Router path the whole card navigates to (hash history). */
  to: string;
  /** Optional search params for query-bearing deep links (e.g. CRM tabs). */
  search?: Record<string, string>;
  /** Stats row — each label/hint is an i18n key. */
  stats?: SectionStat[];
  /** Rich content slot — can hold as much extra information as needed. */
  children?: ReactNode;
  /** Optional i18n key for a pill badge next to the title. */
  badge?: string;
  /** Accent tint for the icon chip. Defaults to `accent`. */
  accent?: SectionAccent;
}

const ACCENT_CHIP_CLASSES: Record<SectionAccent, string> = {
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

export function SectionCard({
  title,
  icon: Icon,
  description,
  to,
  search,
  stats,
  children,
  badge,
  accent = 'accent',
}: SectionCardProps) {
  const { t } = useTranslation();
  const [infoOpen, setInfoOpen] = useState(false);
  const titleId = useId();

  const sectionTitle = t(title);
  const aboutLabel = t('dashboard.cards.aboutSection', { section: sectionTitle });
  const chipClasses = ACCENT_CHIP_CLASSES[accent];
  const singleStat = stats && stats.length === 1;

  return (
    <div className="group relative rounded-xl border border-border-primary bg-bg-primary p-4 transition-colors hover:border-accent/40 hover:bg-bg-secondary">
      {/* Content — only links/buttons inside are interactive */}
      <div className="flex flex-col gap-3">
        {/* Header: icon chip + linked title + info button */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${chipClasses}`}
            >
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <h3 id={titleId} className="truncate text-sm font-semibold text-text-primary">
                <Link
                  to={to}
                  search={search}
                  className="rounded transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {sectionTitle}
                </Link>
              </h3>
              {badge && (
                <span className="mt-0.5 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[0.625rem] font-medium text-accent">
                  {t(badge)}
                </span>
              )}
            </div>
          </div>

          {/* Info button — toggles the in-card popover, never navigates */}
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-label={aboutLabel}
            aria-expanded={infoOpen}
            title={aboutLabel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Info size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Stats row */}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {stats.map((s) => (
              <div key={s.label} className={singleStat ? 'col-span-2' : undefined}>
                <StatBox
                  label={t(s.label)}
                  value={s.value ?? '—'}
                  variant={s.variant}
                  subtitle={s.hint ? t(s.hint) : undefined}
                />
              </div>
            ))}
          </div>
        )}

        {/* Optional rich content slot (interactive) */}
        {children}
      </div>

      {/* "What is this section" popover — lives INSIDE the card, never a
          dashboard-wide overlay */}
      {infoOpen && (
        <div
          role="dialog"
          aria-label={sectionTitle}
          className="absolute inset-x-2 top-2 z-30 rounded-xl border border-border-primary bg-bg-secondary p-3 shadow-xl"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-text-primary">{sectionTitle}</p>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              aria-label="Close"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t(description)}</p>
          {stats && stats.length > 0 && (
            <dl className="mt-2 space-y-1 rounded-lg border border-border-primary bg-bg-primary p-2.5">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-text-tertiary">{t(s.label)}</dt>
                  <dd className="text-xs font-semibold text-text-primary">{s.value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
