import { useTranslation } from "react-i18next";
import { Type, Image as ImageIcon, Link2, MousePointerClick, Minus, StretchVertical } from "lucide-react";
import { useCampaignComposerStore } from "../../../stores/campaignComposerStore";
import type {
  EmailBlock,
  HeadingBlock,
  ParagraphBlock,
  ImageBlock,
  ButtonBlock,
  DividerBlock,
  SpacerBlock,
  CardBlock,
  ColumnsBlock,
  Padding,
} from "../types";
import { TypographyConfig, Field } from "./TypographyConfig";
import { ColorConfig } from "./ColorConfig";
import { AlignmentConfig } from "./AlignmentConfig";
import { LinkConfig } from "./LinkConfig";
import { cn } from "@shared/utils/cn";

const inputCls =
  "w-full rounded border border-border-primary bg-bg-tertiary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent";

function ContentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={cn(inputCls, "resize-y")}
      />
    </Field>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-accent"
        />
        <span className="w-12 text-right text-xs text-text-tertiary">
          {value}
          {suffix}
        </span>
      </div>
    </Field>
  );
}

function PadField({
  value,
  onChange,
}: {
  value: Padding;
  onChange: (p: Padding) => void;
}) {
  const { t } = useTranslation();
  const set = (k: keyof Padding, v: number) => onChange({ ...value, [k]: v });
  return (
    <Field label={t("campaign.editor.padding")}>
      <div className="grid grid-cols-2 gap-2">
        {(["top", "bottom", "left", "right"] as const).map((k) => (
          <label key={k} className="text-xs text-text-tertiary">
            <span className="mb-0.5 block">
              {t("campaign.editor.padding")} · {k.charAt(0).toUpperCase()}
            </span>
            <input
              type="number"
              value={value[k]}
              onChange={(e) => set(k, Number(e.target.value))}
              className={inputCls}
            />
          </label>
        ))}
      </div>
    </Field>
  );
}

function HeadingConfig({ block }: { block: HeadingBlock }) {
  const { t } = useTranslation();
  const update = useCampaignComposerStore((s) => s.updateBlock);
  return (
    <>
      <ContentField
        label={t("campaign.editor.heading")}
        value={block.content}
        onChange={(v) => update(block.id, { content: v })}
      />
      <Field label={t("campaign.editor.heading", "Level")}>
        <div className="flex gap-1">
          {([1, 2, 3] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              aria-pressed={block.level === lvl}
              onClick={() => update(block.id, { level: lvl })}
              className={cn(
                "flex-1 rounded border py-1.5 text-sm transition-colors",
                block.level === lvl
                  ? "border-accent bg-bg-tertiary text-accent"
                  : "border-border-primary text-text-secondary hover:text-text-primary",
              )}
            >
              H{lvl}
            </button>
          ))}
        </div>
      </Field>
      <TypographyConfig
        value={block.typography}
        onChange={(t) => update(block.id, { typography: { ...block.typography, ...t } })}
      />
    </>
  );
}

function ParagraphConfig({ block }: { block: ParagraphBlock }) {
  const { t } = useTranslation();
  const update = useCampaignComposerStore((s) => s.updateBlock);
  return (
    <>
      <ContentField
        label={t("campaign.editor.paragraph")}
        value={block.content}
        onChange={(v) => update(block.id, { content: v })}
      />
      <TypographyConfig
        value={block.typography}
        onChange={(tp) => update(block.id, { typography: { ...block.typography, ...tp } })}
      />
    </>
  );
}

function ImageConfig({ block }: { block: ImageBlock }) {
  const { t } = useTranslation();
  const update = useCampaignComposerStore((s) => s.updateBlock);
  return (
    <>
      <Field label={t("campaign.editor.imageAlt")}>
        <input
          type="text"
          value={block.alt}
          onChange={(e) => update(block.id, { alt: e.target.value })}
          className={inputCls}
        />
      </Field>
      <AlignmentConfig
        value={block.alignment}
        onChange={(v) => update(block.id, { alignment: v })}
      />
      <SliderField
        label={t("campaign.editor.width")}
        value={block.width}
        min={40}
        max={600}
        suffix="px"
        onChange={(v) => update(block.id, { width: v })}
      />
      <SliderField
        label={t("campaign.editor.borderRadius")}
        value={block.borderRadius}
        min={0}
        max={40}
        suffix="px"
        onChange={(v) => update(block.id, { borderRadius: v })}
      />
      <LinkConfig
        value={block.linkUrl}
        onChange={(v) => update(block.id, { linkUrl: v })}
      />
      <PadField
        value={block.padding}
        onChange={(p) => update(block.id, { padding: p })}
      />
      {/* "From Vault" picker has no vault integration yet; kept visible but disabled to communicate intent. */}
      <button
        type="button"
        disabled
        title={t("campaign.editor.fromVaultComingSoon")}
        aria-disabled="true"
        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded border border-dashed border-border-primary py-2 text-xs text-text-tertiary opacity-60"
      >
        <ImageIcon size={14} />
        {t("campaign.editor.fromVault")}
      </button>
    </>
  );
}

function ButtonConfig({ block }: { block: ButtonBlock }) {
  const { t } = useTranslation();
  const update = useCampaignComposerStore((s) => s.updateBlock);
  return (
    <>
      <Field label={t("campaign.editor.button")}>
        <input
          type="text"
          value={block.text}
          onChange={(e) => update(block.id, { text: e.target.value })}
          className={inputCls}
        />
      </Field>
      <LinkConfig
        value={block.url}
        onChange={(v) => update(block.id, { url: v })}
      />
      <ColorConfig
        label="bgColor"
        value={block.backgroundColor}
        onChange={(v) => update(block.id, { backgroundColor: v })}
      />
      <ColorConfig
        label="textColor"
        value={block.textColor}
        onChange={(v) => update(block.id, { textColor: v })}
      />
      <AlignmentConfig
        value={block.alignment}
        onChange={(v) => update(block.id, { alignment: v })}
      />
      <Field label={t("campaign.editor.fullWidth")}>
        <button
          type="button"
          aria-pressed={block.fullWidth}
          onClick={() => update(block.id, { fullWidth: !block.fullWidth })}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded border py-1.5 text-sm transition-colors",
            block.fullWidth
              ? "border-accent bg-bg-tertiary text-accent"
              : "border-border-primary text-text-secondary hover:text-text-primary",
          )}
        >
          <StretchVertical size={14} />
          {t("campaign.editor.fullWidth")}
        </button>
      </Field>
      <SliderField
        label={t("campaign.editor.borderRadius")}
        value={block.borderRadius}
        min={0}
        max={40}
        suffix="px"
        onChange={(v) => update(block.id, { borderRadius: v })}
      />
      <TypographyConfig
        value={block.typography}
        include={["fontSize", "fontWeight", "fontFamily"]}
        onChange={(tp) => update(block.id, { typography: { ...block.typography, ...tp } })}
      />
      <PadField
        value={block.padding}
        onChange={(p) => update(block.id, { padding: p })}
      />
    </>
  );
}

function DividerConfig({ block }: { block: DividerBlock }) {
  const { t } = useTranslation();
  const update = useCampaignComposerStore((s) => s.updateBlock);
  return (
    <>
      <ColorConfig
        label="bgColor"
        value={block.color}
        onChange={(v) => update(block.id, { color: v })}
      />
      <SliderField
        label={t("campaign.editor.thickness")}
        value={block.thickness}
        min={1}
        max={20}
        suffix="px"
        onChange={(v) => update(block.id, { thickness: v })}
      />
      <SliderField
        label={t("campaign.editor.width")}
        value={block.width}
        min={0}
        max={100}
        suffix="%"
        onChange={(v) => update(block.id, { width: v })}
      />
      <PadField
        value={block.padding}
        onChange={(p) => update(block.id, { padding: p })}
      />
    </>
  );
}

function SpacerConfig({ block }: { block: SpacerBlock }) {
  const { t } = useTranslation();
  const update = useCampaignComposerStore((s) => s.updateBlock);
  return (
    <SliderField
      label={t("campaign.editor.height")}
      value={block.height}
      min={4}
      max={200}
      suffix="px"
      onChange={(v) => update(block.id, { height: v })}
    />
  );
}

function BlockIcon({ type }: { type: EmailBlock["type"] }) {
  switch (type) {
    case "heading":
      return <Type size={16} />;
    case "paragraph":
      return <Type size={16} />;
    case "image":
      return <ImageIcon size={16} />;
    case "button":
      return <MousePointerClick size={16} />;
    case "divider":
      return <Minus size={16} />;
    case "spacer":
      return <StretchVertical size={16} />;
    case "card":
      return <MousePointerClick size={16} />;
    case "columns":
      return <Link2 size={16} />;
    default:
      return <Link2 size={16} />;
  }
}

function CardConfig({ block }: { block: CardBlock }) {
  const { t } = useTranslation();
  const update = (c: Partial<CardBlock>) =>
    useCampaignComposerStore.getState().updateBlock(block.id, c);
  return (
    <>
      <ContentField label={t("campaign.editor.cardTitle")} value={block.title} onChange={(title) => update({ title })} />
      <ContentField label={t("campaign.editor.cardBody")} value={block.body} onChange={(body) => update({ body })} />
      <Field label={t("campaign.editor.cardButton")}>
        <input className={inputCls} value={block.buttonText} onChange={(e) => update({ buttonText: e.target.value })} />
      </Field>
      <LinkConfig value={block.buttonUrl} onChange={(buttonUrl) => update({ buttonUrl })} />
      <ColorConfig value={block.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} />
      <AlignmentConfig value={block.alignment} onChange={(alignment) => update({ alignment })} />
      <SliderField label={t("campaign.editor.borderRadius")} value={block.borderRadius} min={0} max={32} suffix="px" onChange={(borderRadius) => update({ borderRadius })} />
      <PadField value={block.padding} onChange={(padding) => update({ padding })} />
    </>
  );
}

function ColumnsConfig({ block }: { block: ColumnsBlock }) {
  const { t } = useTranslation();
  const update = (c: Partial<ColumnsBlock>) =>
    useCampaignComposerStore.getState().updateBlock(block.id, c);
  return (
    <>
      <ColorConfig value={block.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} />
      <SliderField label={t("campaign.editor.borderRadius")} value={block.borderRadius} min={0} max={32} suffix="px" onChange={(borderRadius) => update({ borderRadius })} />
      <SliderField label={t("campaign.editor.gap")} value={block.gap} min={0} max={48} suffix="px" onChange={(gap) => update({ gap })} />
      <PadField value={block.padding} onChange={(padding) => update({ padding })} />
    </>
  );
}

export function BlockConfigPanel() {
  const { t } = useTranslation();
  const configOpenBlockId = useCampaignComposerStore((s) => s.configOpenBlockId);
  const block = useCampaignComposerStore((s) =>
    s.blocks.find((b) => b.id === s.configOpenBlockId),
  );

  if (!configOpenBlockId || !block) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <BlockIcon type="paragraph" />
        <p className="text-sm text-text-tertiary">{t("campaign.editor.configure")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-3">
      <div className="mb-2 flex items-center gap-2 text-text-secondary">
        <BlockIcon type={block.type} />
        <span className="text-sm font-medium capitalize">
          {t(`campaign.editor.${block.type}`)}
        </span>
      </div>
      {block.type === "heading" && <HeadingConfig block={block} />}
      {block.type === "paragraph" && <ParagraphConfig block={block} />}
      {block.type === "image" && <ImageConfig block={block} />}
      {block.type === "button" && <ButtonConfig block={block} />}
      {block.type === "divider" && <DividerConfig block={block} />}
      {block.type === "spacer" && <SpacerConfig block={block} />}
      {block.type === "card" && <CardConfig block={block} />}
      {block.type === "columns" && <ColumnsConfig block={block} />}
    </div>
  );
}

export default BlockConfigPanel;
