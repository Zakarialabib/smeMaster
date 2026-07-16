import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp, BarChart3, AreaChart as AreaChartIcon } from "lucide-react";
import { dashboardContactGrowth } from "@shared/services/db/db-invoke";
import type { DashboardTimeSeries } from "@shared/services/db/db-invoke";
import { WidgetHeader, WidgetError } from "./WidgetHelpers";

type ChartMode = "area" | "bar";

/** Parse a date string that may be "2026-W27" ISO week format or an ISO date. */
function formatTickLabel(val: string): string {
  // Try ISO week format like "2026-W27"
  const weekMatch = val.match(/^(\d{4})-W(\d+)$/);
  if (weekMatch) {
    const year = Number(weekMatch[1]);
    const week = Number(weekMatch[2]);
    // Approximate: week 1 starts around Jan 4, each week is 7 days
    const janFourth = new Date(year, 0, 4);
    const approxDate = new Date(janFourth.getTime() + (week - 1) * 7 * 86400000);
    return approxDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  // Fall back to ISO date parsing
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return val;
}

function formatTooltipLabel(val: string): string {
  const weekMatch = val.match(/^(\d{4})-W(\d+)$/);
  if (weekMatch) {
    return `Week ${weekMatch[2]} (${formatTickLabel(val)})`;
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  return val;
}

export function ContactGrowthWidget({ rangeDays = 30 }: { rangeDays?: number }) {
  const [data, setData] = useState<DashboardTimeSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("area");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await dashboardContactGrowth();
        if (!cancelled) setData(rows);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const weeks = Math.max(1, Math.round(rangeDays / 7));
  const visible = useMemo(
    () => data.slice(-Math.min(weeks, data.length)),
    [data, weeks],
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-bg-tertiary rounded w-24" />
        <div className="h-32 bg-bg-tertiary rounded w-full" />
      </div>
    );
  }

  if (error) {
    return <WidgetError message={error} />;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <WidgetHeader icon={<TrendingUp size={16} />} title={`Contact Growth (${weeks}w)`} />
        <div className="flex items-center gap-0.5 bg-bg-tertiary rounded-lg p-0.5">
          <button
            onClick={() => setChartMode("area")}
            className={`p-1.5 rounded-md transition-colors ${
              chartMode === "area"
                ? "bg-bg-secondary shadow-sm text-text-primary"
                : "text-text-tertiary hover:text-text-primary"
            }`}
            title="Area chart"
            aria-label="Switch to area chart"
          >
            <AreaChartIcon size={14} />
          </button>
          <button
            onClick={() => setChartMode("bar")}
            className={`p-1.5 rounded-md transition-colors ${
              chartMode === "bar"
                ? "bg-bg-secondary shadow-sm text-text-primary"
                : "text-text-tertiary hover:text-text-primary"
            }`}
            title="Bar chart"
            aria-label="Switch to bar chart"
          >
            <BarChart3 size={14} />
          </button>
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <TrendingUp className="w-8 h-8 text-text-tertiary mb-2" />
          <p className="text-sm text-text-tertiary font-medium">No growth data</p>
          <p className="text-xs text-text-quaternary mt-1">Contact signup data will appear here as contacts are added</p>
        </div>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === "area" ? (
              <AreaChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                  tickFormatter={formatTickLabel}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-bg-secondary)",
                    border: "1px solid var(--color-border-primary)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={formatTooltipLabel}
                  formatter={(value: number) => [value, "New Contacts"]}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-success)"
                  fill="url(#growthGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            ) : (
              <BarChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                  tickFormatter={formatTickLabel}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-bg-secondary)",
                    border: "1px solid var(--color-border-primary)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={formatTooltipLabel}
                  formatter={(value: number) => [value, "New Contacts"]}
                />
                <Bar dataKey="score" fill="var(--color-success)" radius={[2, 2, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}
