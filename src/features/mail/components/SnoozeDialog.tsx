import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { DateTimePickerDialog } from "@shared/components/ui/DateTimePickerDialog";
import { getSnoozePresets } from "@features/calendar/db/snoozePresets";
import { getCurrentUnixTimestamp } from "@shared/utils/timestamp";
import { parseSnooze } from "@shared/utils/parseSnooze";

interface Preset {
  label: string;
  timestamp: number;
  detail?: string;
  recurring?: boolean;
}

function getBuiltinPresets(): { label: string; minutes: number }[] {
  return [
    { label: "15 Minutes", minutes: 15 },
    { label: "30 Minutes", minutes: 30 },
    { label: "1 Hour", minutes: 60 },
    { label: "2 Hours", minutes: 120 },
    { label: "4 Hours", minutes: 240 },
    { label: "8 Hours", minutes: 480 },
  ];
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTimestamp(until: number): string {
  return new Date(until * 1000).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface SnoozeDialogProps {
  isOpen?: boolean;
  onSnooze: (until: number) => void;
  onClose: () => void;
}

export function SnoozeDialog({
  isOpen = true,
  onSnooze,
  onClose,
}: SnoozeDialogProps) {
  const { t } = useTranslation();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  const [builtinPresets, setBuiltinPresets] = useState<Preset[]>([]);
  const [nlInput, setNlInput] = useState("");

  useEffect(() => {
    async function loadPresets() {
      if (!activeAccountId) return;
      const presets = await getSnoozePresets(activeAccountId);
      const now = getCurrentUnixTimestamp();
      setCustomPresets(
        presets
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((p) => ({
            label: p.label,
            timestamp: now + p.duration_minutes * 60,
            detail: formatDuration(p.duration_minutes),
            recurring: p.is_recurring === 1,
          })),
      );
    }
    loadPresets();
  }, [activeAccountId]);

  useEffect(() => {
    const now = new Date();
    setBuiltinPresets(
      getBuiltinPresets().map((p) => {
        const ts = new Date(now.getTime() + p.minutes * 60 * 1000);
        return {
          label: p.label,
          timestamp: Math.floor(ts.getTime() / 1000),
          detail: formatDuration(p.minutes),
        };
      }),
    );
  }, []);

  const parsed = useMemo(
    () => (nlInput.trim() ? parseSnooze(nlInput) : null),
    [nlInput],
  );

  const allPresets = [...customPresets, ...builtinPresets];

  return (
    <DateTimePickerDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("dialog.snoozeTitle")}
      presets={allPresets}
      onSelect={onSnooze}
      submitLabel={t("actionBar.snooze")}
      footer={
        <div className="mt-3 border-t border-border-primary pt-3">
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t("snooze.naturalLanguage", "Or type a time (e.g. “tomorrow 9am”, “friday”, “in 3 hours”)")}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              placeholder={t("snooze.nlPlaceholder", "tomorrow 9am")}
              className="flex-1 rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent"
              onKeyDown={(e) => {
                if (e.key === "Enter" && parsed) {
                  e.preventDefault();
                  onSnooze(parsed.until);
                }
              }}
            />
            <button
              type="button"
              disabled={!parsed}
              onClick={() => parsed && onSnooze(parsed.until)}
              className="rounded-md bg-accent px-3 py-1 text-sm font-medium text-white disabled:opacity-40"
            >
              {t("actionBar.snooze", "Snooze")}
            </button>
          </div>
          {parsed && (
            <p className="mt-1 text-xs text-text-tertiary">
              → {formatTimestamp(parsed.until)}
            </p>
          )}
        </div>
      }
    />
  );
}
