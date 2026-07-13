import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Undo2, Redo2, Eye, Save, LayoutTemplate, SplitSquareHorizontal, GalleryHorizontal } from "lucide-react";
import { useCampaignComposerStore } from "@features/campaigns/stores/campaignComposerStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { EmailEditor } from "./EmailEditor";
import { BlockConfigPanel } from "./config/BlockConfigPanel";
import { EmailPreview } from "./Preview/EmailPreview";
import { AIPanel } from "./ai/AIPanel";
import { VaultFilePicker } from "./VaultFilePicker";
import { STARTER_TEMPLATES } from "./starterTemplates";
import { getCampaignTemplateList } from "@features/campaigns/services/campaignTemplateCatalog";
import { htmlToBlocks } from "@features/campaigns/services/htmlToBlocks";
import type { EmailBlock } from "./types";
import type { DbTemplate } from "@features/mail/db/templates";

interface CampaignBuilderProps {
  onSaveTemplate?: (name: string) => void;
}

/**
 * Paperling-grade campaign builder: block editor + live preview + AI copilot.
 * Reads/writes the campaignComposerStore. Replaces the legacy template step.
 */
export function CampaignBuilder({ onSaveTemplate }: CampaignBuilderProps) {
  const { t } = useTranslation();
  const store = useCampaignComposerStore();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [showPreview, setShowPreview] = useState(true);
  const [showAi, setShowAi] = useState(false);
  const [showAb, setShowAb] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<DbTemplate[]>([]);

  const handleInsertBody = (text: string) => {
    const paras = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map<EmailBlock>((content) => ({
        id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: "paragraph",
        content,
        typography: { fontSize: 15, fontWeight: 400, color: "#374151", fontFamily: "sans-serif", textAlign: "left", lineHeight: 1.6, padding: { top: 8, bottom: 8, left: 0, right: 0 } },
      }));
    if (paras.length) store.loadBlocks(paras);
  };

  const handlePickImage = (dataUrl: string) => {
    const id = store.selectedBlockId;
    if (id) store.updateBlock(id, { src: dataUrl } as Partial<EmailBlock>);
    setVaultOpen(false);
  };

  const handleSaveAsTemplate = async () => {
    if (!onSaveTemplate) return;
    const name = window.prompt(t("campaign.editor.templateName"))?.trim();
    if (!name) return;
    setSaving(true);
    try {
      onSaveTemplate(name);
      store.clearBlocks();
    } finally {
      setSaving(false);
    }
  };

  // Load saved campaign templates for the "use template" gallery.
  useEffect(() => {
    if (!activeAccountId) return;
    let cancelled = false;
    getCampaignTemplateList(activeAccountId)
      .then((list) => { if (!cancelled) setTemplates(list); })
      .catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, [activeAccountId]);

  const handleUseTemplate = (tmpl: DbTemplate) => {
    if (!tmpl.body_html) return;
    const blocks = htmlToBlocks(tmpl.body_html);
    if (blocks.length) store.loadBlocks(blocks);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border-primary bg-bg-secondary/40 shrink-0">
        <button onClick={store.undo} title={t("campaign.editor.undo")} className="p-1.5 rounded-md text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors">
          <Undo2 size={16} />
        </button>
        <button onClick={store.redo} title={t("campaign.editor.redo")} className="p-1.5 rounded-md text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors">
          <Redo2 size={16} />
        </button>
        <div className="w-px h-5 bg-border-secondary mx-1" />
        <input
          value={store.subject}
          onChange={(e) => store.setSubject(e.target.value)}
          placeholder={t("campaign.editor.subject")}
          className="flex-1 px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
        />
        <div className="w-px h-5 bg-border-secondary mx-1" />
        <button
          onClick={() => setShowPreview((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${showPreview ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-bg-tertiary"}`}
          title={t("campaign.editor.preview")}
        >
          <Eye size={14} /> {t("campaign.editor.preview")}
        </button>
        <button
          onClick={() => setShowAi((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${showAi ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-bg-tertiary"}`}
          title={t("campaign.editor.aiPowered")}
        >
          <Sparkles size={14} /> {t("campaign.editor.aiPowered")}
        </button>
        <button
          onClick={() => setShowAb((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${showAb ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-bg-tertiary"}`}
          title={t("campaign.abTest")}
        >
          <SplitSquareHorizontal size={14} /> {t("campaign.abTest")}
        </button>
        {onSaveTemplate && (
          <button
            onClick={handleSaveAsTemplate}
            disabled={saving}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-text-secondary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
            title={t("campaign.editor.saveAsTemplate")}
          >
            <Save size={14} /> {t("campaign.editor.saveAsTemplate")}
          </button>
        )}
      </div>

      {/* A/B testing panel */}
      {showAb && (
        <div className="border-b border-border-primary bg-bg-secondary/40 px-3 py-2 shrink-0 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-text-primary">{t("campaign.abTesting")}</span>
            <label className="flex items-center gap-1.5 text-text-secondary">
              <input
                type="checkbox"
                checked={store.abEnabled}
                onChange={(e) => store.setAbEnabled(e.target.checked)}
                className="accent-accent"
              />
              {t("campaign.enabled")}
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={store.variantA.subject}
              onChange={(e) => store.setVariantA({ ...store.variantA, subject: e.target.value })}
              placeholder={t("campaign.subjectAPlaceholder")}
              className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-text-primary outline-none focus:border-accent"
            />
            <input
              value={store.variantB.subject}
              onChange={(e) => store.setVariantB({ ...store.variantB, subject: e.target.value })}
              placeholder={t("campaign.subjectBPlaceholder")}
              className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-text-primary outline-none focus:border-accent"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-text-tertiary">{t("campaign.splitRatio")}</span>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={store.splitRatio}
              onChange={(e) => store.setSplitRatio(Number(e.target.value))}
              className="flex-1 accent-accent"
            />
            <span className="w-16 text-right text-text-secondary">{store.splitRatio}% / {100 - store.splitRatio}%</span>
          </div>
        </div>
      )}

      {/* Body: editor | config | preview | ai */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 overflow-y-auto">
          {store.blocks.length === 0 ? (
            <div className="p-6">
              <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
                <LayoutTemplate size={16} className="text-accent" />
                {t("campaign.editor.pickTemplate")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {STARTER_TEMPLATES.map((st) => (
                  <button
                    key={st.key}
                    onClick={() => store.loadBlocks(st.build())}
                    className="text-left p-3 rounded-lg border border-border-primary hover:border-accent/50 hover:bg-accent/5 transition-all"
                  >
                    <div className="text-sm font-medium text-text-primary capitalize">{t(`campaign.editor.${st.label}`)}</div>
                    <div className="text-xs text-text-tertiary mt-1">{st.build().length} blocks</div>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <EmailEditor onPickFromVault={() => setVaultOpen(true)} />
              </div>

              {/* Saved campaign templates */}
              {templates.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
                    <GalleryHorizontal size={16} className="text-accent" />
                    {t("campaign.editor.gallery")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {templates.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => handleUseTemplate(tmpl)}
                        className="text-left p-3 rounded-lg border border-border-primary hover:border-accent/50 hover:bg-accent/5 transition-all"
                      >
                        <div className="text-sm font-medium text-text-primary truncate">{tmpl.name}</div>
                        <div className="text-xs text-text-tertiary mt-1 line-clamp-2">{tmpl.subject || t("campaign.noTemplate")}</div>
                        <div className="text-xs text-accent mt-2">{t("campaign.editor.useTemplate")}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmailEditor configPanel={store.configOpenBlockId ? <BlockConfigPanel /> : undefined} onPickFromVault={() => setVaultOpen(true)} />
          )}
        </div>

        {store.configOpenBlockId && (
          <div className="w-72 shrink-0 border-l border-border-primary bg-bg-secondary/30 overflow-y-auto">
            <BlockConfigPanel />
          </div>
        )}

        {showPreview && (
          <div className="w-80 shrink-0 border-l border-border-primary bg-bg-tertiary/30 overflow-y-auto">
            <EmailPreview />
          </div>
        )}

        {showAi && (
          <div className="w-80 shrink-0 border-l border-border-primary bg-bg-secondary/30 overflow-y-auto">
            <AIPanel
              context={store.subject ? `Campaign subject: ${store.subject}` : undefined}
              onApplySubject={(s) => store.setSubject(s)}
              onInsertBody={handleInsertBody}
              onPickImage={() => setVaultOpen(true)}
            />
          </div>
        )}
      </div>

      <VaultFilePicker isOpen={vaultOpen} onClose={() => setVaultOpen(false)} onPick={handlePickImage} />
    </div>
  );
}
