import { memo, useCallback } from "react";
import type { Deal } from "@shared/services/db/schema";

export interface DealCardProps {
  deal: Deal;
  stageColor?: string | null;
  onOpen?: (id: string) => void;
}

const formatMoney = (amountMinor: number, currency = "USD") => {
  const value = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency ?? "USD"} ${value.toFixed(0)}`;
  }
};

export const DealCard = memo(function DealCard({ deal, stageColor, onOpen }: DealCardProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("text/plain", deal.id);
      e.dataTransfer.effectAllowed = "move";
    },
    [deal.id],
  );

  const handleClick = useCallback(() => {
    onOpen?.(deal.id);
  }, [deal.id, onOpen]);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className="group cursor-grab active:cursor-gathering select-none rounded-xl border border-border-primary bg-bg-secondary/80 p-3 transition hover-lift"
      role="article"
      aria-label={`${deal.title}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
          {deal.title}
        </p>
        {stageColor ? (
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: stageColor }}
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-text-tertiary">
        <span className="font-medium text-text-secondary">
          {formatMoney(deal.amount_minor, deal.currency)}
        </span>
        <span className="text-text-tertiary/70">•</span>
        <span className="truncate">{deal.status}</span>
      </div>
    </div>
  );
});
