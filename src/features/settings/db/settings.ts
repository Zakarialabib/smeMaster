import { getSetting as dbGetSetting, setSetting as dbSetSetting, executeSearchQuery } from "@/shared/services/db/db-invoke";
import { encryptValue, decryptValue, isEncrypted } from "@shared/utils/crypto";

export async function getSetting(key: string): Promise<string | null> {
  return dbGetSetting(key);
}

export async function setSetting(key: string, value: string): Promise<void> {
  await dbSetSetting(key, value);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await executeSearchQuery("SELECT key, value FROM settings", []) as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/**
 * Get a setting that is stored encrypted. Transparently decrypts the value.
 * Falls back to returning the raw value if decryption fails (e.g. not yet encrypted).
 */
export async function getSecureSetting(key: string): Promise<string | null> {
  const raw = await getSetting(key);
  if (!raw) return null;

  if (isEncrypted(raw)) {
    try {
      return await decryptValue(raw);
    } catch {
      // If decryption fails, the value may be plaintext (pre-encryption migration)
      return raw;
    }
  }
  return raw;
}

/**
 * Set a setting with encryption. The value is encrypted before storing.
 */
export async function setSecureSetting(key: string, value: string): Promise<void> {
  const encrypted = await encryptValue(value);
  await setSetting(key, encrypted);
}

export async function getQueuePaused(): Promise<boolean> {
  try {
    const value = await getSetting("queue_paused");
    return value === "true";
  } catch {
    return false;
  }
}

export async function setQueuePaused(paused: boolean): Promise<void> {
  await setSetting("queue_paused", paused ? "true" : "false");
}

/* ── Undo-send duration preference ──────────────────────────────────────── */

/** Valid global undo-send durations (seconds), matching Gmail's options. */
export const UNDO_SEND_DURATIONS = [5, 10, 20, 30] as const;
export type UndoSendDuration = (typeof UNDO_SEND_DURATIONS)[number];

export const DEFAULT_UNDO_SEND_DURATION: UndoSendDuration = 10;

/**
 * Read the global undo-send duration preference (seconds).
 * Falls back to the active account's default composer preset
 * `undo_send_delay` when the global setting has not been set, and to
 * {@link DEFAULT_UNDO_SEND_DURATION} when neither is available or unparseable.
 */
export async function getUndoSendDuration(
  accountId?: string | null,
): Promise<UndoSendDuration> {
  const raw = await getSetting("undo_send_delay_seconds");
  if (raw != null && raw.trim() !== "") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && (UNDO_SEND_DURATIONS as readonly number[]).includes(n)) {
      return n as UndoSendDuration;
    }
  }

  if (accountId) {
    try {
      const { listComposerPresets } = await import(
        "@shared/services/db/invoke/comms"
      );
      const presets = await listComposerPresets(accountId);
      const fallback = presets.find((p) => p.is_default === 1) ?? presets[0];
      if (fallback && Number.isFinite(fallback.undo_send_delay)) {
        const n = fallback.undo_send_delay;
        return (
          (UNDO_SEND_DURATIONS as readonly number[]).includes(n)
            ? n
            : DEFAULT_UNDO_SEND_DURATION
        ) as UndoSendDuration;
      }
    } catch {
      // ignore — preset lookup is best-effort
    }
  }

  return DEFAULT_UNDO_SEND_DURATION;
}

/**
 * Persist the global undo-send duration preference (seconds).
 * Clamped to the allowed set.
 */
export async function setUndoSendDuration(
  seconds: number,
): Promise<UndoSendDuration> {
  const clamped = (UNDO_SEND_DURATIONS as readonly number[]).includes(seconds)
    ? (seconds as UndoSendDuration)
    : DEFAULT_UNDO_SEND_DURATION;
  await setSetting("undo_send_delay_seconds", String(clamped));
  return clamped;
}

/** Queue schedule preset identifier */
export type QueueSchedulePreset = "fast" | "normal" | "gentle" | "business-hours" | "custom";

export interface QueueSchedule {
  preset: QueueSchedulePreset;
  /** Poll interval in milliseconds */
  intervalMs: number;
  /** Optional: only process during business hours (9am-5pm Mon-Fri) */
  businessHoursOnly?: boolean;
  /** Optional: minimum delay between individual sends in ms (spread delivery) */
  minSendGapMs?: number;
}

const DEFAULT_SCHEDULE: QueueSchedule = {
  preset: "normal",
  intervalMs: 30_000,
  businessHoursOnly: false,
  minSendGapMs: 0,
};

const PRESETS: Record<QueueSchedulePreset, QueueSchedule> = {
  fast: { preset: "fast", intervalMs: 10_000, businessHoursOnly: false, minSendGapMs: 500 },
  normal: { preset: "normal", intervalMs: 30_000, businessHoursOnly: false, minSendGapMs: 2_000 },
  gentle: { preset: "gentle", intervalMs: 120_000, businessHoursOnly: false, minSendGapMs: 10_000 },
  "business-hours": { preset: "business-hours", intervalMs: 60_000, businessHoursOnly: true, minSendGapMs: 5_000 },
  custom: { preset: "custom", intervalMs: 30_000, businessHoursOnly: false, minSendGapMs: 0 },
};

export function getQueueSchedulePresets(): Record<QueueSchedulePreset, QueueSchedule> {
  return PRESETS;
}

export async function getQueueSchedule(): Promise<QueueSchedule> {
  try {
    const raw = await getSetting("queue_schedule");
    if (!raw) return DEFAULT_SCHEDULE;
    return { ...DEFAULT_SCHEDULE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export async function setQueueSchedule(schedule: QueueSchedule): Promise<void> {
  await setSetting("queue_schedule", JSON.stringify(schedule));
}
