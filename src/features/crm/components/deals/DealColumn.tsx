import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import type { DealStage, Deal } from "@shared/services/db/schema";
import { DealCard } from "./DealCard";

export interface DealColumnProps {
  stage: DealStage;
  deals: Deal[];
  onDrop: (dealId: string, stageId: string) => void;
  onOpenDeal: (id: string) => void;
}

export function DealColumn({ stage, deals, onDrop, onOpenDeal }: DealColumnProps) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const dealId = e.dataTransfer.getData("text/plain");
      if (!dealId) return;
      setIsOver(false);
      onDrop(dealId, stage.id);
    },
    [stage.id, onDrop],
  );

  return (
    <div className="flex flex-col min-w-[260px] w-[300px] shrink-0">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: stage.color || "currentColor" }}
            aria-hidden="true"
          />
          <h3 className="text-sm font-semibold text-text-primary truncate">{stage.name}</h3>
          <span className="text-[11px] text-text-tertiary">{deals.length}</span>
        </div>
        <button
          type="button"
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors"
          aria-label="New deal"
        >
          <Plus size={14} />
        </button>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 overflow-y-auto rounded-2xl border p-2 space-y-2 transition-colors ${
          isOver
            ? "border-accent/60 bg-accent/5"
            : "border-border-primary/70 bg-bg-secondary/40"
        }`}
      >
        {deals.length === 0 ? (
          <div className="h-full min-h-[80px] flex items-center justify-center">
            <p className="text-xs text-text-tertiary">Drop deals here</p>
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} stageColor={stage.color} onOpen={onOpenDeal} />
          ))
        )}
      </div>
    </div>
  );
}
