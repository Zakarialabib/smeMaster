import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HeadingBlock as HeadingBlockT } from "../types";

interface HeadingBlockProps {
  block: HeadingBlockT;
  onChange: (changes: Partial<HeadingBlockT>) => void;
}

const LEVEL_LABELS: Record<HeadingBlockT["level"], string> = {
  1: "H1",
  2: "H2",
  3: "H3",
};

function fontFamilyStack(family: HeadingBlockT["typography"]["fontFamily"]): string {
  switch (family) {
    case "serif":
      return "Georgia, 'Times New Roman', serif";
    case "monospace":
      return "'Courier New', Courier, monospace";
    default:
      return "Arial, Helvetica, sans-serif";
  }
}

export function HeadingBlock({ block, onChange }: HeadingBlockProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(block.content);

  useEffect(() => {
    setValue(block.content);
  }, [block.content]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const { typography } = block;

  return (
    <div className="group/block w-full">
      <div className="mb-1 flex justify-end opacity-0 transition-opacity group-hover/block:opacity-100">
        <div
          className="inline-flex overflow-hidden rounded-md border border-border-primary bg-bg-tertiary text-[10px] font-medium text-text-secondary"
          role="group"
          aria-label={t("campaign.editor.heading")}
        >
          {([1, 2, 3] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => onChange({ level: lvl })}
              className={`px-2 py-0.5 transition-colors ${
                block.level === lvl
                  ? "bg-accent text-white"
                  : "hover:bg-bg-tertiary/80 hover:text-text-primary"
              }`}
            >
              {LEVEL_LABELS[lvl]}
            </button>
          ))}
        </div>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== block.content) onChange({ content: value });
        }}
        rows={1}
        placeholder={t("campaign.editor.heading")}
        className="w-full resize-none overflow-hidden border-0 bg-transparent p-0 leading-tight outline-none focus:ring-0"
        style={{
          fontSize: `${typography.fontSize}px`,
          fontWeight: typography.fontWeight,
          color: typography.color,
          fontFamily: fontFamilyStack(typography.fontFamily),
          textAlign: typography.textAlign,
          lineHeight: typography.lineHeight,
        }}
      />
    </div>
  );
}
