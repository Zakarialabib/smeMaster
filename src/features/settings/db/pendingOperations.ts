import {
  upsertPendingOperation,
  deletePendingOperation as dbDeletePendingOperation,
} from '@/shared/services/db/db-invoke';
import {
  executeSearchQuery,
  updateOperationStatus as dbUpdateOperationStatus,
  incrementRetry as dbIncrementRetry,
  deletePendingOpsByIds,
  clearFailedOperations as dbClearFailedOperations,
  retryFailedOperations as dbRetryFailedOperations,
} from '@/shared/services/db/db-invoke';
import type { PendingOperation } from '@/shared/services/db/db-invoke';
import { ACTIVE_COMPANY_ID } from '@/shared/constants/company';

export type { PendingOperation };

/**
 * Scope column for the offline queue.
 *
 * `pending_operations.company_id` is a REAL foreign key to `companies(id)` —
 * the table has NO `account_id` column. Earlier revisions wrote the mail
 * account id into `company_id` (FOREIGN KEY failures) and filtered reads on
 * `account_id` (`no such column` failures, see docs/Issues.md).
 *
 * This module is the single-company seam: every op is stored under
 * `ACTIVE_COMPANY_ID`, and the mail account that enqueued it is embedded in
 * the `params` JSON (`params.accountId`). Account-scoped reads filter on it
 * via `json_extract`, so multi-account sync-conflict checks keep working
 * without a schema migration.
 */
const SCOPE_COMPANY_ID = ACTIVE_COMPANY_ID;

/** Name of the params field carrying the originating mail account id. */
export const PENDING_OP_ACCOUNT_KEY = 'accountId';

export async function enqueuePendingOperation(
  accountId: string,
  operationType: string,
  resourceId: string,
  params: Record<string, unknown>,
  campaignId?: string,
  holdUntil?: number,
): Promise<string> {
  return upsertPendingOperation({
    companyId: SCOPE_COMPANY_ID,
    operationType,
    resourceId,
    params: { ...params, [PENDING_OP_ACCOUNT_KEY]: accountId },
    campaignId: campaignId ?? null,
    holdUntil: holdUntil ?? null,
  });
}

const BASE_PENDING_FILTER = `company_id = $1 AND status = 'pending'
  AND (next_retry_at IS NULL OR next_retry_at <= $2)
  AND (hold_until IS NULL OR hold_until <= $2)`;

/** `json_extract` clause matching ops enqueued by one mail account. */
function accountClause(placeholder: string): string {
  return `json_extract(params, '$.${PENDING_OP_ACCOUNT_KEY}') = ${placeholder}`;
}

export async function getPendingOperations(
  accountId?: string,
  limit = 50,
): Promise<PendingOperation[]> {
  const now = Math.floor(Date.now() / 1000);
  if (accountId) {
    return executeSearchQuery(
      `SELECT * FROM pending_operations
       WHERE ${BASE_PENDING_FILTER}
         AND ${accountClause('$3')}
       ORDER BY created_at ASC LIMIT $4`,
      [SCOPE_COMPANY_ID, now, accountId, limit],
    ) as unknown as Promise<PendingOperation[]>;
  }
  return executeSearchQuery(
    `SELECT * FROM pending_operations
     WHERE ${BASE_PENDING_FILTER}
     ORDER BY created_at ASC LIMIT $3`,
    [SCOPE_COMPANY_ID, now, limit],
  ) as unknown as Promise<PendingOperation[]>;
}

export async function updateOperationStatus(
  id: string,
  status: string,
  errorMessage?: string,
): Promise<void> {
  await dbUpdateOperationStatus(id, status, errorMessage);
}

export async function deleteOperation(id: string): Promise<void> {
  await dbDeletePendingOperation(id);
}

const BACKOFF_SCHEDULE = [60, 300, 900, 3600];

export async function incrementRetry(id: string): Promise<void> {
  const rows = (await executeSearchQuery(
    `SELECT retry_count, max_retries FROM pending_operations WHERE id = $1`,
    [id],
  )) as unknown as { retry_count: number; max_retries: number }[];
  const op = rows[0];
  if (!op) return;

  const newCount = op.retry_count + 1;
  const isFailed = newCount >= op.max_retries;
  const nextRetryAt = !isFailed
    ? Math.floor(Date.now() / 1000) +
      BACKOFF_SCHEDULE[Math.min(newCount - 1, BACKOFF_SCHEDULE.length - 1)]!
    : undefined;

  await dbIncrementRetry(id, newCount, isFailed, nextRetryAt);
}

export async function getPendingOpsCount(accountId?: string): Promise<number> {
  if (accountId) {
    const rows = (await executeSearchQuery(
      `SELECT COUNT(*) as count FROM pending_operations
       WHERE company_id = $1 AND status = 'pending' AND ${accountClause('$2')}`,
      [SCOPE_COMPANY_ID, accountId],
    )) as unknown as { count: number }[];
    return rows[0]?.count ?? 0;
  }
  const rows = (await executeSearchQuery(
    `SELECT COUNT(*) as count FROM pending_operations
     WHERE company_id = $1 AND status = 'pending'`,
    [SCOPE_COMPANY_ID],
  )) as unknown as { count: number }[];
  return rows[0]?.count ?? 0;
}

export async function getFailedOpsCount(accountId?: string): Promise<number> {
  if (accountId) {
    const rows = (await executeSearchQuery(
      `SELECT COUNT(*) as count FROM pending_operations
       WHERE company_id = $1 AND status = 'failed' AND ${accountClause('$2')}`,
      [SCOPE_COMPANY_ID, accountId],
    )) as unknown as { count: number }[];
    return rows[0]?.count ?? 0;
  }
  const rows = (await executeSearchQuery(
    `SELECT COUNT(*) as count FROM pending_operations
     WHERE company_id = $1 AND status = 'failed'`,
    [SCOPE_COMPANY_ID],
  )) as unknown as { count: number }[];
  return rows[0]?.count ?? 0;
}

export async function getPendingOpsForResource(
  accountId: string,
  resourceId: string,
): Promise<PendingOperation[]> {
  return executeSearchQuery(
    `SELECT * FROM pending_operations
     WHERE company_id = $1 AND resource_id = $2 AND status = 'pending'
       AND ${accountClause('$3')}
     ORDER BY created_at ASC`,
    [SCOPE_COMPANY_ID, resourceId, accountId],
  ) as unknown as Promise<PendingOperation[]>;
}

export async function getPendingOperationById(id: string): Promise<PendingOperation | null> {
  const rows = (await executeSearchQuery('SELECT * FROM pending_operations WHERE id = $1', [
    id,
  ])) as unknown as PendingOperation[];
  return rows[0] ?? null;
}

/** Best-effort account id extraction from an op's params JSON. */
function paramsAccountId(paramsJson: string): string | undefined {
  try {
    const parsed = JSON.parse(paramsJson) as Record<string, unknown>;
    const v = parsed[PENDING_OP_ACCOUNT_KEY];
    return typeof v === 'string' ? v : undefined;
  } catch {
    return undefined;
  }
}

export async function compactQueue(accountId?: string): Promise<number> {
  const bindings: unknown[] = [SCOPE_COMPANY_ID];
  let whereClause = "WHERE company_id = $1 AND status = 'pending'";
  if (accountId) {
    whereClause += ` AND ${accountClause('$2')}`;
    bindings.push(accountId);
  }
  const ops = (await executeSearchQuery(
    `SELECT * FROM pending_operations ${whereClause} ORDER BY created_at ASC`,
    bindings,
  )) as unknown as PendingOperation[];

  const byResource = new Map<string, PendingOperation[]>();
  for (const op of ops) {
    // Group by scope + resource + originating account: thread ids are only
    // unique per provider, so two accounts must never collapse each other's ops.
    const key = `${op.company_id}:${op.resource_id}:${paramsAccountId(op.params) ?? ''}`;
    const list = byResource.get(key) ?? [];
    list.push(op);
    byResource.set(key, list);
  }

  const toDelete: string[] = [];

  for (const [, resourceOps] of byResource) {
    for (const toggleType of ['star', 'markRead']) {
      const toggleOps = resourceOps.filter((o) => o.operation_type === toggleType);
      while (toggleOps.length >= 2) {
        const a = toggleOps.shift()!;
        const b = toggleOps.shift()!;
        const paramsA = JSON.parse(a.params);
        const paramsB = JSON.parse(b.params);
        if (
          (toggleType === 'star' && paramsA.starred !== paramsB.starred) ||
          (toggleType === 'markRead' && paramsA.read !== paramsB.read)
        ) {
          toDelete.push(a.id, b.id);
        }
      }
    }

    const addLabelOps = resourceOps.filter((o) => o.operation_type === 'addLabel');
    const removeLabelOps = resourceOps.filter((o) => o.operation_type === 'removeLabel');
    for (const addOp of addLabelOps) {
      const addParams = JSON.parse(addOp.params);
      const matchIdx = removeLabelOps.findIndex((r) => {
        const rParams = JSON.parse(r.params);
        return rParams.labelId === addParams.labelId;
      });
      if (matchIdx !== -1) {
        toDelete.push(addOp.id, removeLabelOps[matchIdx]!.id);
        removeLabelOps.splice(matchIdx, 1);
      }
    }

    const moveOps = resourceOps.filter((o) => o.operation_type === 'moveToFolder');
    if (moveOps.length > 1) {
      for (let i = 0; i < moveOps.length - 1; i++) {
        toDelete.push(moveOps[i]!.id);
      }
    }
  }

  if (toDelete.length > 0) {
    await deletePendingOpsByIds(toDelete);
  }

  return toDelete.length;
}

export async function clearFailedOperations(companyId?: string): Promise<void> {
  await dbClearFailedOperations(companyId);
}

export async function retryFailedOperations(companyId?: string): Promise<void> {
  await dbRetryFailedOperations(companyId);
}
