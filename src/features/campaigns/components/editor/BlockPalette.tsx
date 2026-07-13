import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Heading1,
  Image as ImageIcon,
  MousePointerClick,
  Minus,
  Pilcrow,
  Plus,
  Type,
} from "lucide-react";
import type { BlockType } from "./types";
import { BLOCK_PALETTE } from "./blockDefaults";
import { useCampaignComposerStore } from "../../stores/campaignComposerStore";

const ICONS: Record<BlockType, React.ReactNode> = {
  heading: <Heading1 className="h-4 w-4" />,
  paragraph: <Pilcrow className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  button: <MousePointerClick className="h-4 w-4" />,
  divider: <Minus className="h-4 w-4" />,
  spacer: <Type className="h-4 w-4" />,
};

interface BlockPaletteProps {
  /** Index after which to insert when a block type is chosen. undefined = append at end. */
  afterIndex?: number;
  /** Visual style for the trigger. */
  variant?: "floating" | "inline";
}

export function BlockPalette({ afterIndex, variant = "floating" }: BlockPaletteProps) {
  const { t } = useTranslation();
  const store = useCampaignComposerStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (type: BlockType) => {
    store.addBlock(type, afterIndex);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex justify-center">
      <button
        type="button"
        aria-label={t("campaign.editor.addBlock")}
        title={t("campaign.editor.addBlock")}
        onClick={() => setOpen((v) => !v)}
        className={
          variant === "inline"
            ? "flex h-7 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border-primary text-xs text-text-tertiary transition-colors hover:border-accent hover:text-accent"
            : "flex h-9 w-9 items-center justify-center rounded-full border border-border-primary bg-bg-primary text-text-secondary shadow-sm transition-colors hover:border-accent hover:text-accent"
        }
      >
        <Plus className="h-4 w-4" />
        {variant === "inline" && <span>{t("campaign.editor.addBlock")}</span>}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-48 rounded-xl border border-border-primary bg-bg-primary p-1 shadow-lg">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
            {t("campaign.editor.blocks")}
          </p>
          {BLOCK_PALETTE.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => pick(item.type)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-text-primary transition-colors hover:bg-bg-tertiary"
            >
              <span className="text-text-secondary">{ICONS[item.type]}</span>
              {t(`campaign.editor.${item.type}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
