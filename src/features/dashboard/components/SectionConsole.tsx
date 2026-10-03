import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccountStore } from '@features/accounts/stores/accountStore';
import { SECTION_CARDS, type SectionCardConfig } from '../data/sectionCards';
import { SectionCard, type SectionStat } from './SectionCard';

/**
 * SectionConsole — the dashboard "menu console": a grid of SectionCards,
 * one per core section (Emails, People, Tasks, Invoicing, Campaigns,
 * Automation, Calendar), each showing live stats and linking to its route.
 *
 * Stats start as `null` skeletons (rendered "—") and are filled from the
 * existing db-invoke wrappers. Pass `refreshKey` to refetch alongside the
 * dashboard's manual/auto refresh.
 */

type SectionStatsMap = Record<string, SectionStat[]>;

function buildSkeletons(cards: SectionCardConfig[]): SectionStatsMap {
  const map: SectionStatsMap = {};
  for (const card of cards) {
    map[card.id] = card.stats;
  }
  return map;
}

export function SectionConsole({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useTranslation();
  const headingId = useId();
  const accountId = useAccountStore((s) => s.activeAccountId);
  const [stats, setStats] = useState<SectionStatsMap>(() => buildSkeletons(SECTION_CARDS));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        SECTION_CARDS.map(async (card) => {
          let values: Array<string | number | null>;
          try {
            values = await card.fetchValues({ accountId });
          } catch {
            values = []; // keep the "—" skeleton
          }
          const merged: SectionStat[] = card.stats.map((stat, index) => ({
            ...stat,
            value: values[index] ?? null,
          }));
          return { id: card.id, merged };
        }),
      );
      if (cancelled) return;
      setStats((prev) => {
        const next: SectionStatsMap = { ...prev };
        for (const { id, merged } of results) {
          next[id] = merged;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, accountId]);

  return (
    <section aria-labelledby={headingId} className="mb-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="text-base font-semibold text-text-primary">
          {t('dashboard.sections.consoleTitle')}
        </h2>
        <p className="text-xs text-text-tertiary">{t('dashboard.sections.consoleDescription')}</p>
      </div>

      <div className="grid auto-rows-min grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {SECTION_CARDS.map((card) => (
          <SectionCard
            key={card.id}
            title={card.titleKey}
            icon={card.icon}
            description={card.descriptionKey}
            to={card.to}
            accent={card.accent}
            badge={card.badgeKey}
            stats={stats[card.id] ?? card.stats}
          />
        ))}
      </div>
    </section>
  );
}
