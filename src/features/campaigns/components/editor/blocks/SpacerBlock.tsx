import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react";
import type { SpacerBlock as SpacerBlockT } from "../types";

interface SpacerBlockProps {
  block: SpacerBlockT;
  onChange: (changes: Partial<SpacerBlockT>) => void;
}

export function SpacerBlock({ block, onChange }: SpacerBlockProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full">
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border-primary text-text-tertiary"
        style={{ height: `${block.height}px`, minHeight: 16 }}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide">
          {t("campaign.editor.spacer")} · {block.height}px
        </span>
      </div>
      <div className="mt-1 flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover/block:opacity-100">
        <button
          type="button"
          aria-label={t("campaign.editor.height")}
          onClick={() => onChange({ height: Math.max(4, block.height - 4) })}
          className="rounded-md border border-border-primary p-1 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="range"
          min={4}
          max={200}
          step={2}
          value={block.height}
          onChange={(e) => onChange({ height: Number(e.target.value) })}
          className="w-40 accent-accent"
        />
        <button
          type="button"
          aria-label={t("campaign.editor.height")}
          onClick={() => onChange({ height: Math.min(200, block.height + 4) })}
          className="rounded-md border border-border-primary p-1 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
