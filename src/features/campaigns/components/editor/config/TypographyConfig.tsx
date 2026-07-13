import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { cn } from "@shared/utils/cn";
import type {
  TypographyProps,
  Padding,
  FontFamily,
  TextAlign,
} from "../types";

const DEF_PAD: Padding = { top: 0, bottom: 0, left: 0, right: 0 };

export const inputCls =
  "w-full rounded border border-border-primary bg-bg-tertiary px-2 py-1 text-sm text-text-primary outline-none focus:border-accent";

/** Labeled field wrapper used across the config panel. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Reusable left/center/right alignment button group. */
export function AlignButtons({
  value,
  onChange,
}: {
  value: TextAlign;
  onChange: (v: TextAlign) => void;
}) {
  const { t } = useTranslation();
  const opts: { v: TextAlign; icon: ReactNode; label: string }[] = [
    { v: "left", icon: <AlignLeft size={16} />, label: t("campaign.editor.left") },
    {
      v: "center",
      icon: <AlignCenter size={16} />,
      label: t("campaign.editor.center"),
    },
    { v: "right", icon: <AlignRight size={16} />, label: t("campaign.editor.right") },
  ];
  return (
    <div className="flex gap-1">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-label={o.label}
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "flex flex-1 items-center justify-center rounded border py-1.5 transition-colors",
            value === o.v
              ? "border-accent bg-bg-tertiary text-accent"
              : "border-border-primary text-text-secondary hover:text-text-primary",
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

export interface TypographyConfigProps {
  value: Partial<TypographyProps>;
  onChange: (next: Partial<TypographyProps>) => void;
  /** Restrict which controls render. Defaults to all fields. */
  include?: (keyof TypographyProps)[];
}

export function TypographyConfig({
  value,
  onChange,
  include,
}: TypographyConfigProps) {
  const { t } = useTranslation();
  const has = (k: keyof TypographyProps) =>
    include ? include.includes(k) : true;

  const set = <K extends keyof TypographyProps>(
    k: K,
    v: TypographyProps[K],
  ) => onChange({ ...value, [k]: v });

  const setPad = (k: keyof Padding, v: number) =>
    set("padding", { ...(value.padding ?? DEF_PAD), [k]: v });

  const pad = value.padding ?? DEF_PAD;

  return (
    <div>
      {has("fontSize") && (
        <Field label={t("campaign.editor.fontSize")}>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={8}
              max={72}
              value={value.fontSize ?? 16}
              onChange={(e) => set("fontSize", Number(e.target.value))}
              className="flex-1 accent-accent"
            />
            <input
              type="number"
              min={8}
              max={72}
              value={value.fontSize ?? 16}
              onChange={(e) => set("fontSize", Number(e.target.value))}
              className={cn(inputCls, "w-16")}
            />
          </div>
        </Field>
      )}

      {has("fontWeight") && (
        <Field label={t("campaign.editor.fontWeight")}>
          <select
            value={value.fontWeight ?? 400}
            onChange={(e) =>
              set("fontWeight", Number(e.target.value) as TypographyProps["fontWeight"])
            }
            className={inputCls}
          >
            <option value={400}>400</option>
            <option value={500}>500</option>
            <option value={600}>600</option>
            <option value={700}>700</option>
          </select>
        </Field>
      )}

      {has("color") && (
        <Field label={t("campaign.editor.textColor")}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value.color ?? "#000000"}
              onChange={(e) => set("color", e.target.value)}
              className="h-8 w-10 rounded border border-border-primary bg-bg-tertiary"
            />
            <input
              type="text"
              value={value.color ?? "#000000"}
              onChange={(e) => set("color", e.target.value)}
              className={inputCls}
            />
          </div>
        </Field>
      )}

      {has("fontFamily") && (
        <Field label={t("campaign.editor.fontFamily")}>
          <select
            value={value.fontFamily ?? "sans-serif"}
            onChange={(e) => set("fontFamily", e.target.value as FontFamily)}
            className={inputCls}
          >
            <option value="sans-serif">{t("campaign.editor.fontFamilySans")}</option>
            <option value="serif">{t("campaign.editor.fontFamilySerif")}</option>
            <option value="monospace">{t("campaign.editor.fontFamilyMono")}</option>
          </select>
        </Field>
      )}

      {has("textAlign") && (
        <Field label={t("campaign.editor.align")}>
          <AlignButtons
            value={value.textAlign ?? "left"}
            onChange={(v) => set("textAlign", v)}
          />
        </Field>
      )}

      {has("lineHeight") && (
        <Field label={t("campaign.editor.lineHeight", "Line height")}>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={2}
              step={0.1}
              value={value.lineHeight ?? 1.4}
              onChange={(e) => set("lineHeight", Number(e.target.value))}
              className="flex-1 accent-accent"
            />
            <span className="w-10 text-right text-xs text-text-tertiary">
              {value.lineHeight ?? 1.4}
            </span>
          </div>
        </Field>
      )}

      {has("padding") && (
        <Field label={t("campaign.editor.padding")}>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-text-tertiary">
              <span className="mb-0.5 block">{t("campaign.editor.padding")} · T</span>
              <input
                type="number"
                value={pad.top}
                onChange={(e) => setPad("top", Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label className="text-xs text-text-tertiary">
              <span className="mb-0.5 block">{t("campaign.editor.padding")} · B</span>
              <input
                type="number"
                value={pad.bottom}
                onChange={(e) => setPad("bottom", Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label className="text-xs text-text-tertiary">
              <span className="mb-0.5 block">{t("campaign.editor.padding")} · L</span>
              <input
                type="number"
                value={pad.left}
                onChange={(e) => setPad("left", Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label className="text-xs text-text-tertiary">
              <span className="mb-0.5 block">{t("campaign.editor.padding")} · R</span>
              <input
                type="number"
                value={pad.right}
                onChange={(e) => setPad("right", Number(e.target.value))}
                className={inputCls}
              />
            </label>
          </div>
        </Field>
      )}
    </div>
  );
}
