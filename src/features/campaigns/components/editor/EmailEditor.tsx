import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Redo2, Undo2 } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { GlassPanel } from "@shared/components/ui";
import { useCampaignComposerStore } from "../../stores/campaignComposerStore";
import { BlockList } from "./BlockList";

interface EmailEditorProps {
  /** Right-hand config panel — passed in by the integrator (built by another agent). */
  configPanel?: ReactNode;
  /** Called when the user picks an image "From Vault" in the ImageBlock. */
  onPickFromVault?: () => void;
}

export function EmailEditor({ configPanel, onPickFromVault }: EmailEditorProps) {
  const { t } = useTranslation();
  const store = useCampaignComposerStore();

  return (
    <div className="flex h-full w-full flex-col gap-3 lg:flex-row">
      {/* Left scrollable column: editor */}
      <GlassPanel
        variant="panel"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl"
      >
        <header className="flex items-center justify-between border-b border-border-primary px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">
            {t("campaign.editor.title")}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              icon={<Undo2 className="h-4 w-4" />}
              aria-label={t("campaign.editor.undo")}
              title={t("campaign.editor.undo")}
              disabled={store.historyIndex <= 0}
              onClick={() => store.undo()}
            />
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              icon={<Redo2 className="h-4 w-4" />}
              aria-label={t("campaign.editor.redo")}
              title={t("campaign.editor.redo")}
              disabled={
                store.historyIndex >= store.history.length - 1
              }
              onClick={() => store.redo()}
            />
          </div>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto p-3"
          onClick={() => store.selectBlock(null)}
        >
          <BlockList onPickFromVault={onPickFromVault} />
        </div>
      </GlassPanel>

      {/* Right column: config panel slot (integrator-provided) */}
      <aside className="w-full shrink-0 lg:w-80">
        {/* CONFIG SLOT — the config panel (built by another agent) mounts here. */}
        <div data-config-slot className="h-full">
          {configPanel ?? (
            <GlassPanel
              variant="panel"
              className="flex h-full min-h-[200px] items-center justify-center rounded-xl p-4 text-center"
            >
              <p className="text-xs text-text-tertiary">
                {t("campaign.editor.configure")}
              </p>
            </GlassPanel>
          )}
        </div>
      </aside>
    </div>
  );
}
