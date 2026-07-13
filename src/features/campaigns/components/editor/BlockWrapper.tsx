import { type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
import { Copy, GripVertical, Settings2, Trash2 } from "lucide-react";
import { useCampaignComposerStore } from "../../stores/campaignComposerStore";

interface BlockWrapperProps {
  id: string;
  selected: boolean;
  children: ReactNode;
  /** Optional overlay content rendered below the block body (e.g. open inputs). */
  toolbar?: ReactNode;
}

export function BlockWrapper({ id, selected, children, toolbar }: BlockWrapperProps) {
  const { t } = useTranslation();
  const store = useCampaignComposerStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const configOpen = store.configOpenBlockId === id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        store.selectBlock(id);
      }}
      className={`group/block relative rounded-xl border transition-colors ${
        selected
          ? "border-accent bg-bg-tertiary/30"
          : "border-transparent hover:border-border-primary hover:bg-bg-tertiary/20"
      }`}
    >
      {/* Drag handle + actions, visible on hover or when selected */}
      <div
        className={`absolute -left-9 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 opacity-0 transition-opacity group-hover/block:opacity-100 ${
          selected ? "opacity-100" : ""
        }`}
      >
        <button
          type="button"
          aria-label={t("campaign.editor.blocks")}
          className="cursor-grab rounded-md border border-border-primary bg-bg-tertiary p-1 text-text-secondary hover:text-text-primary active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div
        className={`absolute -right-2 -top-2 flex items-center gap-1 rounded-lg border border-border-primary bg-bg-primary p-1 opacity-0 shadow-sm transition-opacity group-hover/block:opacity-100 ${
          selected || configOpen ? "opacity-100" : ""
        }`}
      >
        <button
          type="button"
          aria-label={t("campaign.editor.configure")}
          title={t("campaign.editor.configure")}
          onClick={(e) => {
            e.stopPropagation();
            store.toggleConfig(id);
          }}
          className={`rounded-md p-1 transition-colors hover:bg-bg-tertiary ${
            configOpen ? "text-accent" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Settings2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={t("campaign.editor.duplicate")}
          title={t("campaign.editor.duplicate")}
          onClick={(e) => {
            e.stopPropagation();
            store.duplicateBlock(id);
          }}
          className="rounded-md p-1 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={t("campaign.editor.delete")}
          title={t("campaign.editor.delete")}
          onClick={(e) => {
            e.stopPropagation();
            store.removeBlock(id);
          }}
          className="rounded-md p-1 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3">{children}</div>
      {toolbar}
    </div>
  );
}
