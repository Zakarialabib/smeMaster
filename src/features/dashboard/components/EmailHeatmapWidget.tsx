import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { dashboardEmailHeatmap } from '@shared/services/db/db-invoke';
import type { DailyCount } from '@shared/services/db/db-invoke';
import { WidgetHeader } from './WidgetHelpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getHeatColor = (count: number, max: number): string => {
  if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
  const intensity = count / max;
  if (intensity > 0.75) return 'bg-green-700 dark:bg-green-600';
  if (intensity > 0.5) return 'bg-green-500 dark:bg-green-500';
  if (intensity > 0.25) return 'bg-green-300 dark:bg-green-400';
  return 'bg-green-200 dark:bg-green-300';
};

const formatDate = (d: Date): string => {
  return d.toISOString().split('T')[0] ?? "";
};

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

function buildWeeks(): Date[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start 52 weeks (364 days) ago
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);

  // Adjust to Monday (getDay: 0=Sun, 1=Mon, ..., 6=Sat)
  const dayOfWeek = startDate.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startDate.setDate(startDate.getDate() + diffToMonday);

  const weeks: Date[][] = [];
  const current = new Date(startDate);

  while (current <= today) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function getMonthLabels(weeks: Date[][]): { label: string; col: number }[] {
  const labels: { label: string; col: number }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, colIdx) => {
    // Use the Thursday of each week to determine which month it belongs to
    const thursday = week[3];
    if (thursday && thursday.getMonth() !== lastMonth) {
      const monthLabel = MONTH_LABELS[thursday.getMonth()] ?? "";
      labels.push({ label: monthLabel, col: colIdx });
      lastMonth = thursday.getMonth();
    }
  });

  return labels;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmailHeatmapWidget() {
  const [data, setData] = useState<DailyCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await dashboardEmailHeatmap();
        if (!cancelled) setData(rows);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build lookup map: date string -> count
  const countMap = new Map<string, number>();
  let maxCount = 0;
  for (const d of data) {
    countMap.set(d.date, d.count);
    if (d.count > maxCount) maxCount = d.count;
  }

  const weeks = buildWeeks();
  const monthLabels = getMonthLabels(weeks);

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        <WidgetHeader icon={<CalendarDays size={16} />} title="Email Activity" />
        <div className="animate-pulse space-y-1">
          <div className="flex gap-0.5">
            {Array.from({ length: 52 }).map((_, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {Array.from({ length: 7 }).map((_, di) => (
                  <div key={di} className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-3">
        <WidgetHeader icon={<CalendarDays size={16} />} title="Email Activity" />
        <div className="text-xs text-danger bg-danger/5 rounded-lg p-3">{error}</div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (data.length === 0) {
    return (
      <div className="space-y-3">
        <WidgetHeader icon={<CalendarDays size={16} />} title="Email Activity" />
        <div className="text-center py-8 text-text-tertiary text-xs">
          No email data available for the past year
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <WidgetHeader icon={<CalendarDays size={16} />} title="Email Activity" />
      <div className="overflow-x-auto max-h-48 overflow-y-hidden">
        <div className="inline-flex gap-0.5">
          {/* Left gutter for day labels */}
          <div className="flex flex-col gap-0.5 mr-1 pt-5">
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="w-3 h-3 flex items-center justify-end text-[0.5rem] text-text-tertiary leading-none"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div>
            {/* Month labels */}
            <div className="flex gap-0.5 mb-0.5" style={{ paddingLeft: 0 }}>
              {monthLabels.map((ml) => (
                <div
                  key={ml.col}
                  className="text-[0.5rem] text-text-tertiary"
                  style={{
                    marginLeft: ml.col === 0 ? 0 : undefined,
                    width: ml.col === 0 ? undefined : undefined,
                  }}
                >
                  <span style={{ position: 'relative', left: 0 }}>{ml.label}</span>
                </div>
              ))}
            </div>

            {/* Recalculate month positions for proper alignment */}
            <div className="relative">
              {/* Month labels absolutely positioned above grid */}
              <div className="flex gap-0.5 mb-0.5 text-[0.5rem] text-text-tertiary">
                {monthLabels.map((ml, idx) => {
                  const nextCol =
                    idx < monthLabels.length - 1 ? (monthLabels[idx + 1] as { col: number }).col : weeks.length;
                  const span = nextCol - ml.col;
                  return (
                    <div key={ml.col} style={{ width: `${span * 14}px` }} className="shrink-0">
                      {ml.label}
                    </div>
                  );
                })}
              </div>

              {/* Rows */}
              <div className="flex gap-0.5">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-0.5">
                    {week.map((day, di) => {
                      const dateStr = formatDate(day);
                      const count = countMap.get(dateStr) ?? 0;
                      return (
                        <div
                          key={di}
                          className={`w-3 h-3 rounded-sm ${getHeatColor(count, maxCount)}`}
                          title={`${dateStr}: ${count} emails`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-2 text-[0.5rem] text-text-tertiary">
        <span>Less</span>
        <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
        <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-300" />
        <div className="w-3 h-3 rounded-sm bg-green-300 dark:bg-green-400" />
        <div className="w-3 h-3 rounded-sm bg-green-500" />
        <div className="w-3 h-3 rounded-sm bg-green-700 dark:bg-green-600" />
        <span>More</span>
      </div>
    </>
  );
}
