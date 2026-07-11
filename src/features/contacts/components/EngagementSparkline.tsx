import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, Loader2, AlertCircle } from "lucide-react";
import { getEngagementTrend, type EngagementTrendPoint } from "@features/contacts/services/engagement";

interface EngagementSparklineProps {
  contactId: string;
  days?: number;
  height?: number;
  width?: number;
  className?: string;
}

function sparklinePath(points: { date: string; score: number }[], width: number, height: number): string {
  if (points.length < 2) return "";
  const minScore = Math.min(...points.map((p) => p.score));
  const maxScore = Math.max(...points.map((p) => p.score));
  const range = maxScore - minScore || 1;
  const padding = 2;
  const drawW = width - padding * 2;
  const drawH = height - padding * 2;

  const parts = points.map((p, i) => {
    const x = padding + (i / Math.max(points.length - 1, 1)) * drawW;
    const y = padding + drawH - ((p.score - minScore) / range) * drawH;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return parts.join(" ");
}

export function EngagementSparkline({
  contactId,
  days = 30,
  height = 48,
  width = 160,
  className = "",
}: EngagementSparklineProps) {
  const [data, setData] = useState<EngagementTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getEngagementTrend(contactId, days)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load trend");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [contactId, days]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <Loader2 size={14} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-1 ${className}`} style={{ height }}>
        <AlertCircle size={12} className="text-danger shrink-0" />
        <span className="text-[0.6rem] text-danger">Failed to load</span>
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className={`flex items-center gap-1 ${className}`} style={{ height }}>
        <Minus size={12} className="text-text-tertiary" />
        <span className="text-[0.6rem] text-text-tertiary">Insufficient data</span>
      </div>
    );
  }

  const latest = data[data.length - 1]!.score;
  const first = data[0]!.score;
  const trend = latest - first;
  const TrendIcon = trend > 0.01 ? TrendingUp : trend < -0.01 ? TrendingDown : Minus;
  const trendColor = trend > 0.01 ? "text-success" : trend < -0.01 ? "text-danger" : "text-text-tertiary";

  const path = sparklinePath(data, width, height);
  const gradientId = `tg-${contactId.replace(/[^a-zA-Z0-9-]/g, "")}`;

  return (
    <div className={`flex items-end gap-2 ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="shrink-0"
        aria-label="Engagement trend sparkline"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* Fill area under line */}
        {path && (
          <path
            d={`${path} L${(width - 2).toFixed(1)},${height - 2} L2,${height - 2} Z`}
            fill={`url(#${gradientId})`}
            className="text-accent"
          />
        )}
        {/* Line */}
        {path && (
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
          />
        )}
        {/* End dot */}
        {data.length > 0 && (() => {
          const last = data[data.length - 1]!;
          const minScore = Math.min(...data.map((p) => p.score));
          const maxScore = Math.max(...data.map((p) => p.score));
          const range = maxScore - minScore || 1;
          const x = width - 2;
          const y = 2 + (height - 4) - ((last.score - minScore) / range) * (height - 4);
          return (
            <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill="currentColor" className="text-accent" />
          );
        })()}
      </svg>
      <div className="flex flex-col items-start shrink-0">
        <div className="flex items-center gap-1">
          <TrendIcon size={12} className={trendColor} />
          <span className={`text-xs font-semibold ${trendColor}`}>
            {trend > 0 ? "+" : ""}{(trend * 100).toFixed(1)}%
          </span>
        </div>
        <span className="text-[0.55rem] text-text-tertiary">{days}-day trend</span>
      </div>
    </div>
  );
}
