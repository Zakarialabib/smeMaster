import { Clock } from "lucide-react";
import { getHealthStyle } from "@shared/utils/scoreVariant";
import { formatRelativeDate } from "@shared/utils/date";

interface EngagementScoreBarProps {
  /** Score from 0.0 to 1.0 */
  score: number;
  /** Health status string (hot/warm/lukewarm/cold) */
  healthStatus?: string | null;
  /** When the contact was last engaged (optional) */
  lastEngagedAt?: number | string | null;
  /** Size variant */
  size?: "sm" | "md";
}

export function EngagementScoreBar({
  score,
  healthStatus,
  lastEngagedAt,
  size = "md",
}: EngagementScoreBarProps) {
  const health = getHealthStyle(healthStatus);
  const percentage = Math.round(score * 100);

  return (
    <div className={`space-y-2 ${size === "sm" ? "mb-3" : "mb-4"}`}>
      <div className="flex items-center justify-between">
        <span className={`font-semibold uppercase tracking-wider text-text-tertiary ${size === "sm" ? "text-[0.625rem]" : "text-xs"}`}>
          Engagement Score
        </span>
        <span className={`px-1.5 py-0.5 rounded font-medium ${health.bg} ${health.text} ${size === "sm" ? "text-[0.55rem]" : "text-[0.625rem]"}`}>
          {health.label}
        </span>
      </div>
      <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${health.barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[0.6rem] text-text-tertiary">{percentage}%</span>
        {lastEngagedAt && (
          <div className="flex items-center gap-1 text-[0.6rem] text-text-tertiary">
            <Clock size={10} />
            <span>Last engaged: {formatRelativeDate(Number(lastEngagedAt))}</span>
          </div>
        )}
      </div>
    </div>
  );
}
