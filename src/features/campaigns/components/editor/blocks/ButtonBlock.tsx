import { useTranslation } from "react-i18next";
import type { ButtonBlock as ButtonBlockT } from "../types";

interface ButtonBlockProps {
  block: ButtonBlockT;
  onChange: (changes: Partial<ButtonBlockT>) => void;
}

function fontFamilyStack(family: ButtonBlockT["typography"]["fontFamily"]): string {
  switch (family) {
    case "serif":
      return "Georgia, 'Times New Roman', serif";
    case "monospace":
      return "'Courier New', Courier, monospace";
    default:
      return "Arial, Helvetica, sans-serif";
  }
}

export function ButtonBlock({ block, onChange }: ButtonBlockProps) {
  const { t } = useTranslation();
  const align =
    block.alignment === "center"
      ? "center"
      : block.alignment === "right"
        ? "right"
        : "left";

  return (
    <div className="w-full" style={{ textAlign: align }}>
      <span
        style={{
          display: block.fullWidth ? "block" : "inline-block",
          backgroundColor: block.backgroundColor,
          color: block.textColor,
          fontSize: `${block.typography.fontSize}px`,
          fontWeight: block.typography.fontWeight,
          fontFamily: fontFamilyStack(block.typography.fontFamily),
          borderRadius: `${block.borderRadius}px`,
          padding: `${block.padding.top}px ${block.padding.right}px ${block.padding.bottom}px ${block.padding.left}px`,
          textDecoration: "none",
        }}
        className="select-none"
      >
        {block.text || t("campaign.editor.button")}
      </span>
      <div className="mt-2 flex flex-wrap items-center gap-2 opacity-0 transition-opacity group-hover/block:opacity-100">
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <span className="text-text-tertiary">{t("campaign.editor.heading")}</span>
          <input
            type="text"
            value={block.text}
            onChange={(e) => onChange({ text: e.target.value })}
            className="w-40 rounded-md border border-border-primary bg-bg-tertiary px-2 py-1 text-text-primary outline-none focus:border-accent"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <span className="text-text-tertiary">{t("campaign.editor.linkUrl")}</span>
          <input
            type="text"
            value={block.url}
            placeholder="https://"
            onChange={(e) => onChange({ url: e.target.value })}
            className="w-40 rounded-md border border-border-primary bg-bg-tertiary px-2 py-1 text-text-primary outline-none focus:border-accent"
          />
        </label>
      </div>
    </div>
  );
}
