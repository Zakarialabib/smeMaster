import { create } from "zustand";
import { createAsyncActions, initialAsyncState } from "@shared/stores/createAsyncStore";

import {
  listPipelines,
  createPipeline,
  listDealStages,
  createDealStage,
  createDeal,
  getDeal,
  updateDeal,
  deleteDeal,
  listDeals,
  moveDealStage,
  recomputeScores,
  type Pipeline,
  type DealStage,
  type Deal,
  type CreateDealInput,
} from "@shared/services/db/invoke/deals";

export interface DealState {
  pipelines: Pipeline[];
  stages: Record<string, DealStage[]>;
  deals: Deal[];
  activePipelineId: string | null;
  isLoading: boolean;
  error: string | null;
  loadPipelines: (companyId: string) => Promise<void>;
  loadStages: (pipelineId: string) => Promise<DealStage[]>;
  loadDeals: (companyId: string) => Promise<void>;
  createDeal: (input: CreateDealInput) => Promise<Deal | undefined>;
  removeDeal: (id: string, companyId: string) => Promise<void>;
  moveDeal: (id: string, stageId: string) => Promise<Deal | undefined>;
}

export const useDealStore = create<DealState>((set, get) => {
  const { withLoading } = createAsyncActions(set);

  return {
    pipelines: [],
    stages: {},
    deals: [],
    activePipelineId: null,
    isLoading: false,
    error: null,
    ...initialAsyncState,

    loadPipelines: async (companyId) => {
      const pipelines = await withLoading(async () => listPipelines(companyId));
      if (pipelines) {
        set({ pipelines, activePipelineId: pipelines[0]?.id ?? null });
      }
    },

    loadStages: async (pipelineId) => {
      const stages = await withLoading(async () => listDealStages(pipelineId));
      if (stages) {
        set((s) => ({ stages: { ...s.stages, [pipelineId]: stages } }));
      }
      return stages ?? [];
    },

    loadDeals: async (companyId) => {
      const pipelineId = get().activePipelineId;
      const deals = await withLoading(async () =>
        listDeals({ companyId, pipelineId: pipelineId ?? null }),
      );
      if (deals) set({ deals });
    },

    createDeal: async (input) => {
      const created = await withLoading(async () => createDeal(input));
      if (created) {
        set((s) => ({ deals: [created, ...s.deals] }));
      }
      return created;
    },

    removeDeal: async (id, companyId) => {
      await withLoading(async () => deleteDeal(id));
      set((s) => ({ deals: s.deals.filter((d) => d.id !== id) }));
    },

    moveDeal: async (id, stageId) => {
      const moved = await withLoading(async () => moveDealStage({ id, stageId }));
      if (moved) {
        set((s) => ({
          deals: s.deals.map((d) => (d.id === id ? moved : d)),
        }));
      }
      return moved;
    },
  };
});
