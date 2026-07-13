import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCampaignComposerStore } from "../../../stores/campaignComposerStore";
import { renderEmailHtml } from "../../../services/emailRenderer";
import { WidthToggle, type PreviewWidth } from "./WidthToggle";
import { GlassPanel } from "@shared/components/ui";
import { cn } from "@shared/utils/cn";

const WIDTHS: Record<PreviewWidth, number> = {
  desktop: 600,
  mobile: 375,
};

export function EmailPreview() {
  const { t } = useTranslation();
  const [width, setWidth] = useState<PreviewWidth>("desktop");
  const blocks = useCampaignComposerStore((s) => s.blocks);

  const html = useMemo(() => renderEmailHtml(blocks), [blocks]);
  const frameWidth = WIDTHS[width];

  if (blocks.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
            {t("campaign.editor.preview")}
          </span>
          <WidthToggle value={width} onChange={setWidth} />
        </div>
        <GlassPanel className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-text-tertiary">{t("campaign.editor.noContent")}</p>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
          {t("campaign.editor.preview")}
        </span>
        <WidthToggle value={width} onChange={setWidth} />
      </div>
      <GlassPanel className="flex flex-1 justify-center overflow-auto p-4">
        <div
          className={cn(
            "h-full overflow-hidden rounded-xl border border-border-primary bg-white shadow-lg transition-[width] duration-300",
          )}
          style={{ width: frameWidth, maxWidth: "100%" }}
        >
          <iframe
            title={t("campaign.editor.preview")}
            srcDoc={html}
            className="h-full w-full border-0 bg-white"
            sandbox=""
          />
        </div>
      </GlassPanel>
    </div>
  );
}

export default EmailPreview;
