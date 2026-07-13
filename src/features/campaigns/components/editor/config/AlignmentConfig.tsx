import { useTranslation } from "react-i18next";
import type { TextAlign } from "../types";
import { AlignButtons } from "./TypographyConfig";

export interface AlignmentConfigProps {
  value: TextAlign;
  onChange: (v: TextAlign) => void;
}

export function AlignmentConfig({ value, onChange }: AlignmentConfigProps) {
  const { t } = useTranslation();
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-text-secondary">
        {t("campaign.editor.align")}
      </label>
      <AlignButtons value={value} onChange={onChange} />
    </div>
  );
}
