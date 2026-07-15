import { useEffect, useMemo, useCallback, useState } from "react";
import { RefreshCw, Plus } from "lucide-react";
import { useDealStore } from "@features/crm/stores/dealStore";
import { ACTIVE_COMPANY_ID } from "@shared/constants/company";
import { Button } from "@shared/components/ui/Button";
import { SkeletonPage } from "@shared/components/ui/Skeleton";
import { DealColumn } from "./DealColumn";
import type { DealStage, Deal } from "@shared/services/db/schema";

export function PipelineBoard() {
  const {
    pipelines,
    stages,
    deals,
    activePipelineId,
    isLoading,
    loadPipelines,
    loadStages,
    loadDeals,
    moveDeal,
  } = useDealStore();

  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadPipelines(ACTIVE_COMPANY_ID)
      .then(async () => {
        if (cancelled) return;
        const current = useDealStore.getState().activePipelineId ?? pipelines[0]?.id ?? null;
        setActiveId(current);
        if (current) {
          await loadStages(current);
          await loadDeals(ACTIVE_COMPANY_ID);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load pipeline");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ACTIVE_COMPANY_ID]);

  // Keep local activeId in sync with store when it changes externally.
  useEffect(() => {
    setActiveId(activePipelineId);
  }, [activePipelineId]);

  const activePipeline = useMemo(
    () => pipelines.find((p) => p.id === activeId) ?? null,
    [pipelines, activeId],
  );

  const pipelineStages = useMemo<DealStage[]>(() => {
    if (!activeId) return [];
    return (stages[activeId] ?? []).slice().sort((a, b) => a.position - b.position);
  }, [activeId, stages]);

  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const d of deals) {
      const bucket = map[d.stage_id] ?? [];
      bucket.push(d);
      map[d.stage_id] = bucket;
    }
    return map;
  }, [deals]);

  const handleColumnDrop = useCallback(
    async (dealId: string, stageId: string) => {
      try {
        await moveDeal(dealId, stageId);
      } catch {
        // moveDeal updates local store; surface any failure via global toast/service in a real app.
      }
    },
    [moveDeal],
  );

  const handleOpenDeal = useCallback((id: string) => {
    // Future: route to deal detail panel
    console.log("Open deal", id);
  }, []);

  if (!activePipeline) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-sm text-text-tertiary">No pipeline selected.</p>
        <Button
          icon={<Plus size={16} />}
          onClick={() => {
            useDealStore.getState().loadPipelines(ACTIVE_COMPANY_ID);
          }}
        >
          Create pipeline
        </Button>
      </div>
    );
  }

  if (isLoading || pipelineStages.length === 0) {
    return <SkeletonPage />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center">
          <RefreshCw size={18} className="text-danger" />
        </div>
        <p className="text-sm text-danger">{error}</p>
        <Button
          variant="secondary"
          icon={<RefreshCw size={16} />}
          onClick={() => {
            setError(null);
            loadPipelines(ACTIVE_COMPANY_ID);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-text-primary">{activePipeline.name}</h2>
          <p className="text-[11px] text-text-tertiary">Pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={15} />}
            onClick={() => {
              if (activeId) {
                loadStages(activeId);
                loadDeals(ACTIVE_COMPANY_ID);
              }
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 p-1 h-full min-w-fit">
          {pipelineStages.map((stage) => (
            <DealColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] ?? []}
              onDrop={handleColumnDrop}
              onOpenDeal={handleOpenDeal}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
