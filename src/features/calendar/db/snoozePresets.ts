import {
  listSnoozePresets,
  createSnoozePreset,
  deleteSnoozePreset as dbDeleteSnoozePreset,
} from "../../../shared/services/db/db-invoke";
import type { SnoozePreset } from "../../../shared/services/db/db-invoke";

export type { SnoozePreset };

export async function getSnoozePresets(companyId: string): Promise<SnoozePreset[]> {
  return listSnoozePresets(companyId);
}

export async function upsertSnoozePreset(preset: {
  id?: string;
  companyId: string;
  label: string;
  durationMinutes: number;
  isRecurring?: boolean;
  sortOrder?: number;
}): Promise<string> {
  const created = await createSnoozePreset({
    companyId: preset.companyId,
    label: preset.label,
    durationMinutes: preset.durationMinutes,
    isRecurring: preset.isRecurring ?? null,
    sortOrder: preset.sortOrder ?? null,
  });
  return created.id;
}

export async function deleteSnoozePreset(id: string): Promise<void> {
  await dbDeleteSnoozePreset(id);
}
