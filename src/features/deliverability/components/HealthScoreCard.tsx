import { Shield } from "lucide-react";
import { getScoreVariant } from "@shared/utils/scoreVariant";

interface Props {
  domain: string;
  score: number;
  onCheck?: (domain: string) => void;
}

export function HealthScoreCard({ domain, score, onCheck }: Props) {
  const v = getScoreVariant(score);
  const Icon = v.icon;

  return (
    <div
      className={`rounded-lg border border-border-primary ${v.bgColor} ${v.borderColor} border-l-4 p-4 space-y-3`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-text-tertiary" />
          <span className="text-sm font-medium text-text-primary">{domain}</span>
        </div>
        {onCheck && (
          <button
            onClick={() => onCheck(domain)}
            className="px-3 py-1 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
          >
            Check Now
          </button>
        )}
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-4xl font-bold leading-none ${v.color}`}>
          {score}
          <span className="text-sm font-normal text-text-tertiary ml-0.5">/100</span>
        </span>
        <div className="flex items-center gap-1.5 pb-1">
          <Icon size={14} className={v.color} />
          <span className={`text-xs font-medium ${v.color}`}>{v.label}</span>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${v.barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
