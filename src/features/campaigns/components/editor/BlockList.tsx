import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@shared/components/ui/EmptyState";
import type {
  EmailBlock,
  HeadingBlock as HeadingBlockT,
  ParagraphBlock as ParagraphBlockT,
  ImageBlock as ImageBlockT,
  ButtonBlock as ButtonBlockT,
  DividerBlock as DividerBlockT,
  SpacerBlock as SpacerBlockT,
} from "./types";
import { useCampaignComposerStore } from "../../stores/campaignComposerStore";
import { BlockWrapper } from "./BlockWrapper";
import { BlockPalette } from "./BlockPalette";
import { HeadingBlock } from "./blocks/HeadingBlock";
import { ParagraphBlock } from "./blocks/ParagraphBlock";
import { ImageBlock } from "./blocks/ImageBlock";
import { ButtonBlock } from "./blocks/ButtonBlock";
import { DividerBlock } from "./blocks/DividerBlock";
import { SpacerBlock } from "./blocks/SpacerBlock";

function renderBlockBody(
  block: EmailBlock,
  onChange: (changes: Partial<EmailBlock>) => void,
  onPickFromVault?: () => void,
) {
  switch (block.type) {
    case "heading":
      return (
        <HeadingBlock
          block={block as HeadingBlockT}
          onChange={onChange as (c: Partial<HeadingBlockT>) => void}
        />
      );
    case "paragraph":
      return (
        <ParagraphBlock
          block={block as ParagraphBlockT}
          onChange={onChange as (c: Partial<ParagraphBlockT>) => void}
        />
      );
    case "image":
      return (
        <ImageBlock
          block={block as ImageBlockT}
          onChange={onChange as (c: Partial<ImageBlockT>) => void}
          onPickFromVault={onPickFromVault}
        />
      );
    case "button":
      return (
        <ButtonBlock
          block={block as ButtonBlockT}
          onChange={onChange as (c: Partial<ButtonBlockT>) => void}
        />
      );
    case "divider":
      return (
        <DividerBlock
          block={block as DividerBlockT}
          onChange={onChange as (c: Partial<DividerBlockT>) => void}
        />
      );
    case "spacer":
      return (
        <SpacerBlock
          block={block as SpacerBlockT}
          onChange={onChange as (c: Partial<SpacerBlockT>) => void}
        />
      );
    default:
      return null;
  }
}

export function BlockList({ onPickFromVault }: { onPickFromVault?: () => void }) {
  const { t } = useTranslation();
  const store = useCampaignComposerStore();
  const blocks = store.blocks;
  const selectedBlockId = store.selectedBlockId;
  const configOpenBlockId = store.configOpenBlockId;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      store.moveBlock(String(active.id), String(over.id));
    }
  };

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <EmptyState
          title={t("campaign.editor.noContent")}
          subtitle={t("campaign.editor.addBlock")}
        />
        <BlockPalette />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {blocks.map((block, index) => (
            <div key={block.id} className="flex flex-col gap-1">
              <BlockWrapper
                id={block.id}
                selected={selectedBlockId === block.id || configOpenBlockId === block.id}
              >
                {renderBlockBody(
                  block,
                  (changes) => store.updateBlock(block.id, changes),
                  onPickFromVault,
                )}
              </BlockWrapper>
              <BlockPalette afterIndex={index} variant="inline" />
            </div>
          ))}
        </div>
      </SortableContext>
      <div className="mt-2 flex justify-center">
        <BlockPalette />
      </div>
    </DndContext>
  );
}
