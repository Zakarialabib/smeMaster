import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Upload } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import type { ImageBlock as ImageBlockT } from "../types";

interface ImageBlockProps {
  block: ImageBlockT;
  onChange: (changes: Partial<ImageBlockT>) => void;
  onPickFromVault?: () => void;
}

function alignmentStyle(alignment: ImageBlockT["alignment"]): React.CSSProperties {
  if (alignment === "center")
    return { margin: "0 auto", display: "block" };
  if (alignment === "right")
    return { marginLeft: "auto", marginRight: 0, display: "block" };
  return { margin: 0, display: "block" };
}

export function ImageBlock({ block, onChange, onPickFromVault }: ImageBlockProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const hasImage = block.src.length > 0;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange({ src: reader.result });
    };
    reader.readAsDataURL(file);
  };

  if (!hasImage) {
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-primary bg-bg-tertiary/40 px-4 py-8 text-center transition-colors hover:border-accent hover:bg-bg-tertiary"
        >
          <ImageIcon className="h-8 w-8 text-text-tertiary" />
          <span className="text-sm font-medium text-text-secondary">
            {t("campaign.editor.insertImage")}
          </span>
          <span className="flex items-center gap-1 text-xs text-text-tertiary">
            <Upload className="h-3.5 w-3.5" />
            {t("campaign.editor.fromVault")}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="mt-2 flex justify-center">
          <Button
            size="xs"
            variant="ghost"
            icon={<ImageIcon className="h-3.5 w-3.5" />}
            onClick={onPickFromVault}
          >
            {t("campaign.editor.fromVault")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className="relative"
        style={{ ...alignmentStyle(block.alignment), maxWidth: block.width }}
      >
        <img
          src={block.src}
          alt={block.alt}
          width={block.width}
          style={{ borderRadius: `${block.borderRadius}px`, maxWidth: "100%", height: "auto" }}
          className="block w-full"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 opacity-0 transition-opacity group-hover/block:opacity-100">
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <span className="text-text-tertiary">{t("campaign.editor.imageAlt")}</span>
          <input
            type="text"
            value={block.alt}
            onChange={(e) => onChange({ alt: e.target.value })}
            className="w-40 rounded-md border border-border-primary bg-bg-tertiary px-2 py-1 text-text-primary outline-none focus:border-accent"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <span className="text-text-tertiary">{t("campaign.editor.linkUrl")}</span>
          <input
            type="text"
            value={block.linkUrl}
            placeholder="https://"
            onChange={(e) => onChange({ linkUrl: e.target.value })}
            className="w-40 rounded-md border border-border-primary bg-bg-tertiary px-2 py-1 text-text-primary outline-none focus:border-accent"
          />
        </label>
      </div>
    </div>
  );
}
