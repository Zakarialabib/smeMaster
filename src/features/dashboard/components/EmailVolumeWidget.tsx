import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Mail, BarChart3, LineChart as LineChartIcon } from "lucide-react";
import { dashboardEmailVolume } from "@shared/services/db/db-invoke";
import type { DashboardTimeSeries } from "@shared/services/db/db-invoke";
import { WidgetHeader } from "./WidgetHelpers";

type ChartMode = "bar" | "line";

export function EmailVolumeWidget() {
  const [data, setData] = useState<DashboardTimeSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("bar");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await dashboardEmailVolume();
        if (!cancelled) setData(rows);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-bg-tertiary rounded w-24" />
        <div className="h-32 bg-bg-tertiary rounded w-full" />
      </div>
    );
  }

  if (error) {
    return <div className="text-xs text-danger bg-danger/5 rounded-lg p-3">{error}</div>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <WidgetHeader icon={<Mail size={16} />} title="Email Volume (30d)" />
        <div className="flex items-center gap-0.5 bg-bg-tertiary rounded-lg p-0.5">
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
          <button
            onClick={() => setChartMode("line")}
            className={`p-1.5 rounded-md transition-colors ${
              chartMode === "line"
                ? "bg-bg-secondary shadow-sm text-text-primary"
                : "text-text-tertiary hover:text-text-primary"
            }`}
            title="Line chart"
            aria-label="Switch to line chart"
          >
            <LineChartIcon size={14} />
          </button>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Mail className="w-8 h-8 text-text-tertiary mb-2" />
          <p className="text-sm text-text-tertiary font-medium">No email activity</p>
          <p className="text-xs text-text-quaternary mt-1">No emails sent or received in the last 30 days</p>
        </div>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === "bar" ? (
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                  tickFormatter={(val: string) => {
                    const d = new Date(val);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
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
                  labelFormatter={(label: string) => {
                    const d = new Date(label);
                    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                  }}
                  formatter={(value: number) => [value, "Emails"]}
                />
                <Bar dataKey="score" fill="var(--color-accent)" radius={[2, 2, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                  tickFormatter={(val: string) => {
                    const d = new Date(val);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
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
                  labelFormatter={(label: string) => {
                    const d = new Date(label);
                    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                  }}
                  formatter={(value: number) => [value, "Emails"]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "var(--color-accent)" }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}
