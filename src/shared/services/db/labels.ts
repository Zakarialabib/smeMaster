import {
  getLabelsForAccount as dbInvokeGetLabelsForAccount,
  upsertLabel as dbInvokeUpsertLabel,
  deleteLabel as dbInvokeDeleteLabel,
  deleteLabelsForAccount as dbInvokeDeleteLabelsForAccount,
  updateLabelSortOrder as dbInvokeUpdateLabelSortOrder,
  type Label,
} from "@shared/services/db/db-invoke";

export type DbLabel = Label;

/**
 * Get all labels for an account via the typed db-invoke wrapper.
 */
export async function getLabelsForAccount(
  accountId: string,
): Promise<DbLabel[]> {
  return dbInvokeGetLabelsForAccount(accountId);
}

/**
 * Upsert a label via the typed db-invoke wrapper.
 */
export async function upsertLabel(label: {
  id: string;
  accountId: string;
  name: string;
  type: string;
  colorBg?: string | null;
  colorFg?: string | null;
  imapFolderPath?: string | null;
  imapSpecialUse?: string | null;
}): Promise<void> {
  await dbInvokeUpsertLabel({
    id: label.id,
    accountId: label.accountId,
    name: label.name,
    type: label.type,
    colorBg: label.colorBg ?? null,
    colorFg: label.colorFg ?? null,
    visible: null,
    sortOrder: null,
    imapFolderPath: label.imapFolderPath ?? null,
    imapSpecialUse: label.imapSpecialUse ?? null,
  });
}

/**
 * Delete all labels for an account.
 * Uses raw SQL since there is no db-invoke bulk-delete equivalent.
 */
export async function deleteLabelsForAccount(
  accountId: string,
): Promise<void> {
  await dbInvokeDeleteLabelsForAccount(accountId);
}

/**
 * Delete a label via the typed db-invoke wrapper.
 */
export async function deleteLabel(
  accountId: string,
  labelId: string,
): Promise<void> {
  await dbInvokeDeleteLabel(accountId, labelId);
}

/**
 * Update sort orders for multiple labels.
 * Uses raw SQL since there is no db-invoke batch-update equivalent for sort orders.
 */
export async function updateLabelSortOrder(
  accountId: string,
  labelOrders: { id: string; sortOrder: number }[],
): Promise<void> {
  if (labelOrders.length === 0) return;
  await dbInvokeUpdateLabelSortOrder(accountId, labelOrders);
}
