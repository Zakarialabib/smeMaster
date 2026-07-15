import { ReactNode, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Modal } from "@shared/components/ui/Modal";
import { INPUT_BASE, MENU_ITEM } from "@shared/styles/ui-tokens";

interface Preset {
  label: string;
  /** Unix timestamp in seconds */
  timestamp: number;
  /** Optional custom detail string; if omitted, a default date format is used */
  detail?: string;
}

interface DateTimePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  presets: Preset[];
  /** Called with a Unix timestamp in seconds */
  onSelect: (timestamp: number) => void;
  submitLabel: string;
  zIndex?: string;
  /** Optional content rendered below the custom date/time row. */
  footer?: ReactNode;
}

export function DateTimePickerDialog({
  isOpen,
  onClose,
  title,
  presets,
  onSelect,
  submitLabel,
  zIndex,
  footer,
}: DateTimePickerDialogProps) {
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");

  const handlePresetClick = (timestamp: number) => {
    onSelect(timestamp);
  };

  const handleCustomSubmit = () => {
    if (!customDate) return;
    const dt = new Date(`${customDate}T${customTime}`);
    onSelect(Math.floor(dt.getTime() / 1000));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} zIndex={zIndex}>
      <div className="py-1">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePresetClick(preset.timestamp)}
            className={MENU_ITEM}
          >
            <span className="flex-1">{preset.label}</span>
            <span className="text-xs text-text-tertiary">
              {preset.detail ??
                new Date(preset.timestamp * 1000).toLocaleDateString(
                  undefined,
                  { weekday: "short", month: "short", day: "numeric" },
                )}
            </span>
          </button>
        ))}
      </div>

      <div className="border-t border-border-secondary px-4 py-3 space-y-2">
        <div className="text-xs text-text-tertiary font-medium">
          Custom date & time
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className={INPUT_BASE}
          />
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className={`${INPUT_BASE} w-24`}
          />
        </div>
        <Button
          variant="primary"
          onClick={handleCustomSubmit}
          disabled={!customDate}
          className="w-full"
        >
          {submitLabel}
        </Button>
      </div>
      {footer}
    </Modal>
  );
}
