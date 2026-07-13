import { useTranslation } from "react-i18next";
import { Palette } from "lucide-react";
import { cn } from "@shared/utils/cn";
import { Field } from "./TypographyConfig";

export interface ColorConfigProps {
  value: string;
  onChange: (v: string) => void;
  /** Which label to use. Defaults to background color. */
  label?: "bgColor" | "textColor";
}

export function ColorConfig({ value, onChange, label = "bgColor" }: ColorConfigProps) {
  const { t } = useTranslation();
  return (
    <Field label={t(`campaign.editor.${label}`)}>
      <div className="flex items-center gap-2">
        <Palette size={16} className="shrink-0 text-text-tertiary" />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 rounded border border-border-primary bg-bg-tertiary"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full rounded border border-border-primary bg-bg-tertiary px-2 py-1 text-sm text-text-primary outline-none focus:border-accent",
          )}
        />
      </div>
    </Field>
  );
}
