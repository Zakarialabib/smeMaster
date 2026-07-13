import { useTranslation } from "react-i18next";
import { Monitor, Smartphone } from "lucide-react";
import { cn } from "@shared/utils/cn";

export type PreviewWidth = "desktop" | "mobile";

export interface WidthToggleProps {
  value: PreviewWidth;
  onChange: (v: PreviewWidth) => void;
}

export function WidthToggle({ value, onChange }: WidthToggleProps) {
  const { t } = useTranslation();
  const opts: { v: PreviewWidth; icon: React.ReactNode; label: string }[] = [
    { v: "desktop", icon: <Monitor size={16} />, label: t("campaign.editor.desktop") },
    { v: "mobile", icon: <Smartphone size={16} />, label: t("campaign.editor.mobile") },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border-primary bg-bg-tertiary p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          aria-label={o.label}
          onClick={() => onChange(o.v)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === o.v
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default WidthToggle;
