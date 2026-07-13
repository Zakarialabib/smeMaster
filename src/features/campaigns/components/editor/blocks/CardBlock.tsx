import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus } from "lucide-react";
import type { CardBlock as CardBlockT } from "../types";

interface CardBlockProps {
  block: CardBlockT;
  onChange: (changes: Partial<CardBlockT>) => void;
  onPickFromVault?: () => void;
}

export function CardBlock({ block, onChange, onPickFromVault }: CardBlockProps) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(block.title);
  const [body, setBody] = useState(block.body);

  useEffect(() => setTitle(block.title), [block.title]);
  useEffect(() => setBody(block.body), [block.body]);

  useEffect(() => {
    [titleRef, bodyRef].forEach((r) => {
      const el = r.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    });
  }, [title, body]);

  return (
    <div
      className="rounded-xl overflow-hidden border border-border-primary"
      style={{ backgroundColor: block.backgroundColor }}
    >
      {block.image ? (
        <img
          src={block.image}
          alt={block.imageAlt}
          className="w-full h-auto object-cover"
          style={{ maxHeight: 220 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => onPickFromVault?.()}
          className="w-full flex items-center justify-center gap-1.5 py-6 text-xs text-text-tertiary hover:text-accent transition-colors bg-bg-tertiary/40"
        >
          <ImagePlus size={14} /> {t("campaign.editor.cardImage")}
        </button>
      )}
      <div className="p-4" style={{ textAlign: block.alignment }}>
        <textarea
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== block.title && onChange({ title })}
          rows={1}
          placeholder={t("campaign.editor.cardTitle")}
          className="w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-lg font-bold text-text-primary outline-none focus:ring-0"
        />
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => body !== block.body && onChange({ body })}
          rows={2}
          placeholder={t("campaign.editor.cardBody")}
          className="mt-1 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-sm text-text-secondary outline-none focus:ring-0"
        />
        <input
          value={block.buttonText}
          onChange={(e) => onChange({ buttonText: e.target.value })}
          placeholder={t("campaign.editor.cardButton")}
          className="mt-2 w-full rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}
