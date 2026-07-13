import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ParagraphBlock as ParagraphBlockT } from "../types";

interface ParagraphBlockProps {
  block: ParagraphBlockT;
  onChange: (changes: Partial<ParagraphBlockT>) => void;
}

function fontFamilyStack(family: ParagraphBlockT["typography"]["fontFamily"]): string {
  switch (family) {
    case "serif":
      return "Georgia, 'Times New Roman', serif";
    case "monospace":
      return "'Courier New', Courier, monospace";
    default:
      return "Arial, Helvetica, sans-serif";
  }
}

export function ParagraphBlock({ block, onChange }: ParagraphBlockProps) {
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
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== block.content) onChange({ content: value });
      }}
      rows={2}
      placeholder={t("campaign.editor.paragraph")}
      className="w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none focus:ring-0"
      style={{
        fontSize: `${typography.fontSize}px`,
        fontWeight: typography.fontWeight,
        color: typography.color,
        fontFamily: fontFamilyStack(typography.fontFamily),
        textAlign: typography.textAlign,
        lineHeight: typography.lineHeight,
      }}
    />
  );
}
