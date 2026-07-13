import { useTranslation } from "react-i18next";
import type { DividerBlock as DividerBlockT } from "../types";

interface DividerBlockProps {
  block: DividerBlockT;
  onChange: (changes: Partial<DividerBlockT>) => void;
}

export function DividerBlock({ block, onChange }: DividerBlockProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full">
      <div style={{ padding: `${block.padding.top}px ${block.padding.right}px ${block.padding.bottom}px ${block.padding.left}px` }}>
        <div style={{ width: `${block.width}%` }}>
          <div
            style={{
              height: `${block.thickness}px`,
              backgroundColor: block.color,
              borderRadius: "9999px",
            }}
          />
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3 opacity-0 transition-opacity group-hover/block:opacity-100">
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <span className="text-text-tertiary">{t("campaign.editor.thickness")}</span>
          <input
            type="range"
            min={1}
            max={12}
            value={block.thickness}
            onChange={(e) => onChange({ thickness: Number(e.target.value) })}
            className="w-24 accent-accent"
          />
          <span className="w-6 text-text-tertiary">{block.thickness}px</span>
        </label>
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <span className="text-text-tertiary">{t("campaign.editor.width")}</span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={block.width}
            onChange={(e) => onChange({ width: Number(e.target.value) })}
            className="w-24 accent-accent"
          />
          <span className="w-8 text-text-tertiary">{block.width}%</span>
        </label>
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <span className="text-text-tertiary">{t("campaign.editor.bgColor")}</span>
          <input
            type="color"
            value={block.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-6 w-8 cursor-pointer rounded border border-border-primary bg-transparent"
          />
        </label>
      </div>
    </div>
  );
}
