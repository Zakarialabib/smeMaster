import { useTranslation } from "react-i18next";
import type { ColumnsBlock as ColumnsBlockT } from "../types";

interface ColumnsBlockProps {
  block: ColumnsBlockT;
  onChange: (changes: Partial<ColumnsBlockT>) => void;
}

export function ColumnsBlock({ block, onChange }: ColumnsBlockProps) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-xl overflow-hidden border border-border-primary grid grid-cols-2 gap-3 p-3"
      style={{ backgroundColor: block.backgroundColor, borderRadius: block.borderRadius }}
    >
      <div className="flex flex-col">
        <span className="text-[0.625rem] uppercase tracking-wider text-text-tertiary mb-1">
          {t("campaign.editor.leftColumn")}
        </span>
        <textarea
          value={block.leftHtml}
          onChange={(e) => onChange({ leftHtml: e.target.value })}
          rows={4}
          className="w-full resize-y rounded-md border border-border-primary bg-bg-primary p-2 font-mono text-[0.7rem] text-text-secondary outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col">
        <span className="text-[0.625rem] uppercase tracking-wider text-text-tertiary mb-1">
          {t("campaign.editor.rightColumn")}
        </span>
        <textarea
          value={block.rightHtml}
          onChange={(e) => onChange({ rightHtml: e.target.value })}
          rows={4}
          className="w-full resize-y rounded-md border border-border-primary bg-bg-primary p-2 font-mono text-[0.7rem] text-text-secondary outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}
