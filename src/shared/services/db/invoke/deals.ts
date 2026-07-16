// ── Deal / Pipeline wrappers ──────────────────────────────────────────────

import { invokeCommand } from './command';

import type {
  Deal,
  DealStage,
  Pipeline,
  CreateDealInput,
  MoveDealStageInput,
  RecomputeScoresInput,
} from '../schema';

// Pipelines

export async function listPipelines(companyId: string): Promise<Pipeline[]> {
  return invokeCommand<Pipeline[]>('db_list_pipelines', { companyId });
}

export async function createPipeline(
  companyId: string,
  name: string,
  isDefault = false,
): Promise<Pipeline> {
  return invokeCommand<Pipeline>('db_create_pipeline', {
    companyId,
    name,
    isDefault,
  });
}

// Stages

export async function listDealStages(pipelineId: string): Promise<DealStage[]> {
  return invokeCommand<DealStage[]>('db_list_deal_stages', { pipelineId });
}

export async function createDealStage(input: {
  pipelineId: string;
  name: string;
  position: number;
  probability: number;
  color?: string | null;
}): Promise<DealStage> {
  return invokeCommand<DealStage>('db_create_deal_stage', {
    pipelineId: input.pipelineId,
    name: input.name,
    position: input.position,
    probability: input.probability,
    color: input.color ?? null,
  });
}

// Deals

export async function createDeal(input: CreateDealInput): Promise<Deal> {
  return invokeCommand<Deal>('db_create_deal', {
    companyId: input.companyId,
    contactId: input.contactId ?? null,
    pipelineId: input.pipelineId,
    stageId: input.stageId,
    title: input.title,
    amountMinor: input.amountMinor,
    currency: input.currency ?? null,
    expectedCloseAt: input.expectedCloseAt ?? null,
    notes: input.notes ?? null,
  });
}

export async function getDeal(id: string): Promise<Deal> {
  return invokeCommand<Deal>('db_get_deal', { id });
}

export async function updateDeal(
  id: string,
  companyId: string,
  fields: Partial<Omit<Deal, 'id' | 'company_id' | 'created_at'>>,
): Promise<Deal> {
  // Rust `db_update_deal` requires `company_id` in its DTO to scope the
  // UPDATE to the owning tenant. Omitting it would fail command deserialization.
  return invokeCommand<Deal>('db_update_deal', {
    id,
    companyId,
    fields: fields as unknown as Record<string, unknown>,
  });
}

export async function deleteDeal(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_deal', { id });
}

export async function listDeals(input: {
  companyId: string;
  pipelineId?: string | null;
  stageId?: string | null;
  status?: string | null;
}): Promise<Deal[]> {
  return invokeCommand<Deal[]>('db_list_deals', {
    companyId: input.companyId,
    pipelineId: input.pipelineId ?? null,
    stageId: input.stageId ?? null,
    status: input.status ?? null,
  });
}

export async function moveDealStage(input: MoveDealStageInput): Promise<Deal> {
  return invokeCommand<Deal>('db_move_deal_stage', {
    id: input.id,
    stageId: input.stageId,
  });
}

// Scoring

export async function recomputeScores(input: RecomputeScoresInput): Promise<number> {
  return invokeCommand<number>('db_recompute_scores', {
    companyId: input.companyId,
  });
}

// Idempotently ensure a default pipeline with the standard `DEFAULT_STAGES`
// exists for the company, returning the (existing or newly created) pipeline
// along with its stages. Used by the CRM board on first mount / after reset.
export async function ensureDefaultPipeline(companyId: string): Promise<Pipeline & { stages: DealStage[] }> {
  return invokeCommand<Pipeline & { stages: DealStage[] }>('db_ensure_default_pipeline', {
    companyId,
  });
}

// Fetch a single deal stage by id. Returns `null` if the stage was deleted.
export async function getDealStage(stageId: string): Promise<DealStage | null> {
  return invokeCommand<DealStage | null>('db_get_deal_stage', { stageId });
}
