import { useTranslation } from "react-i18next";
import { Link2 } from "lucide-react";
import { cn } from "@shared/utils/cn";
import { Field } from "./TypographyConfig";

export interface LinkConfigProps {
  value: string;
  onChange: (v: string) => void;
  /** Optional placeholder, e.g. for image vs button links. */
  placeholder?: string;
}

export function LinkConfig({ value, onChange, placeholder }: LinkConfigProps) {
  const { t } = useTranslation();
  return (
    <Field label={t("campaign.editor.linkUrl")}>
      <div className="flex items-center gap-2">
        <Link2 size={16} className="shrink-0 text-text-tertiary" />
        <input
          type="text"
          inputMode="url"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full rounded border border-border-primary bg-bg-tertiary px-2 py-1 text-sm text-text-primary outline-none focus:border-accent",
          )}
        />
      </div>
    </Field>
  );
}
