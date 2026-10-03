import { useId, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Info, ArrowRight, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SlidePanel } from '@shared/components/ui/SlidePanel';
import { StatBox } from './StatBox';

/**
 * SectionCard — reusable "menu console" card for the dashboard.
 *
 * The whole card surface navigates to `to` via a stretched-link overlay
 * (`absolute inset-0` anchor), keeping the DOM valid (no <button> inside
 * <a>) while making every pixel of the card clickable. Content sits above
 * the link with `pointer-events-none` so clicks fall through to it — except
 * the info button and the optional `children` slot, which opt back in with
 * `pointer-events-auto`.
 *
 * The info button opens a SlidePanel describing what the section is
 * ("slide similar to settings"), without triggering navigation.
 *
 * All i18n strings are passed as translation keys and resolved here with
 * `t()`. Styling uses design tokens only — never hardcoded colors.
 */

export interface SectionStat {
  /** i18n key (e.g. `dashboard.cards.stat.unread`) — translated by the card. */
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
    <div className="group relative rounded-xl border border-border-primary bg-bg-primary p-4 transition-colors hover:border-accent/40 hover:bg-bg-secondary focus-within:border-accent/60">
      {/* Stretched link — the whole card surface navigates */}
      <Link
        to={to}
        aria-labelledby={titleId}
        className="absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      />

      {/* Content sits above the link; clicks fall through to it */}
      <div className="pointer-events-none relative z-20 flex flex-col gap-3">
        {/* Header: icon chip + title + info button */}
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
                {sectionTitle}
              </h3>
              {badge && (
                <span className="mt-0.5 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[0.625rem] font-medium text-accent">
                  {t(badge)}
                </span>
              )}
            </div>
          </div>

          {/* Info button — opens the slide-over, never navigates */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setInfoOpen(true);
            }}
            aria-label={aboutLabel}
            title={aboutLabel}
            className="pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
        {children && <div className="pointer-events-auto">{children}</div>}

        {/* Open-section affordance */}
        <span className="flex items-center gap-1 text-xs font-medium text-accent">
          {t('dashboard.cards.openSection')}
          <ArrowRight size={13} aria-hidden="true" />
        </span>
      </div>

      {/* "What is this section" slide-over */}
      <SlidePanel
        isOpen={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={sectionTitle}
        headerIcon={<Icon size={16} className="text-accent" />}
        footerChildren={
          <div className="flex items-center justify-end px-5 py-3.5">
            <Link
              to={to}
              onClick={() => setInfoOpen(false)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              {t('dashboard.cards.openSection')}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        }
      >
        <p>{t(description)}</p>
        {stats && stats.length > 0 && (
          <dl className="mt-3 space-y-1.5 rounded-lg border border-border-primary bg-bg-secondary p-3">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-3">
                <dt className="text-xs text-text-tertiary">{t(s.label)}</dt>
                <dd className="text-sm font-semibold text-text-primary">{s.value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        )}
      </SlidePanel>
    </div>
  );
}
