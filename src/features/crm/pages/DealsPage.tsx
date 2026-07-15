import { useEffect } from "react";
import { PipelineBoard } from "@features/crm/components/deals/PipelineBoard";
import { useDealStore } from "@features/crm/stores/dealStore";
import { ACTIVE_COMPANY_ID } from "@shared/constants/company";
import { SkeletonPage } from "@shared/components/ui/Skeleton";

export function DealsPage() {
  const loadPipelines = useDealStore((s) => s.loadPipelines);
  const isLoading = useDealStore((s) => s.isLoading);

  useEffect(() => {
    loadPipelines(ACTIVE_COMPANY_ID);
  }, [loadPipelines]);

  if (isLoading) {
    return <SkeletonPage />;
  }

  return (
    <div className="flex flex-col h-full p-4">
      <PipelineBoard />
    </div>
  );
}
