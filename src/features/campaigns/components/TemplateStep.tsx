import { SplitSquareHorizontal } from "lucide-react";
import { CampaignTemplatePicker } from "@features/campaigns/components/CampaignTemplatePicker";

interface ABVariantContent {
  subject: string;
  body: string;
}

interface TemplateStepProps {
  templateId: string;
  onTemplateSelect: (id: string) => void;
  abEnabled: boolean;
  onToggleAb: () => void;
  variantA: ABVariantContent;
  onVariantAChange: (content: ABVariantContent) => void;
  variantB: ABVariantContent;
  onVariantBChange: (content: ABVariantContent) => void;
  splitRatio: number;
  onSplitRatioChange: (ratio: number) => void;
  testDuration: number;
  onTestDurationChange: (duration: number) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function TemplateStep({
  templateId,
  onTemplateSelect,
  abEnabled,
  onToggleAb,
  variantA,
  onVariantAChange,
  variantB,
  onVariantBChange,
  splitRatio,
  onSplitRatioChange,
  testDuration,
  onTestDurationChange,
  t,
}: TemplateStepProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-text-primary font-medium">{t('campaign.selectTemplate')}</label>
      <CampaignTemplatePicker
        selectedTemplateId={templateId}
        onSelect={(id) => onTemplateSelect(id ?? "")}
      />
      <div className="border-t border-border-primary pt-3 mt-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm text-text-primary font-medium flex items-center gap-1.5">
              <SplitSquareHorizontal size={14} />
              {t('campaign.abTesting')}
            </span>
            <p className="text-xs text-text-tertiary mt-0.5">
              {t('campaign.abTestingDesc')}
            </p>
          </div>
          <button
            onClick={onToggleAb}
            className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ml-4 ${
              abEnabled ? "bg-accent" : "bg-bg-tertiary"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                abEnabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
        {abEnabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-panel rounded-lg p-3 space-y-2">
                <span className="text-xs font-semibold text-accent uppercase tracking-wide">{t('campaign.variantA')}</span>
                <input
                  type="text"
                  value={variantA.subject}
                  onChange={(e) => onVariantAChange({ ...variantA, subject: e.target.value })}
                  placeholder={t('campaign.subjectAPlaceholder')}
                  className="w-full px-2 py-1.5 bg-bg-secondary border border-border-primary rounded text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:ring-1 focus:ring-accent"
                />
                <textarea
                  value={variantA.body}
                  onChange={(e) => onVariantAChange({ ...variantA, body: e.target.value })}
                  placeholder={t('campaign.bodyAPlaceholder')}
                  rows={4}
                  className="w-full px-2 py-1.5 bg-bg-secondary border border-border-primary rounded text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:ring-1 focus:ring-accent resize-none"
                />
              </div>
              <div className="glass-panel rounded-lg p-3 space-y-2">
                <span className="text-xs font-semibold text-warning uppercase tracking-wide">{t('campaign.variantB')}</span>
                <input
                  type="text"
                  value={variantB.subject}
                  onChange={(e) => onVariantBChange({ ...variantB, subject: e.target.value })}
                  placeholder={t('campaign.subjectBPlaceholder')}
                  className="w-full px-2 py-1.5 bg-bg-secondary border border-border-primary rounded text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:ring-1 focus:ring-accent"
                />
                <textarea
                  value={variantB.body}
                  onChange={(e) => onVariantBChange({ ...variantB, body: e.target.value })}
                  placeholder={t('campaign.bodyBPlaceholder')}
                  rows={4}
                  className="w-full px-2 py-1.5 bg-bg-secondary border border-border-primary rounded text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:ring-1 focus:ring-accent resize-none"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-text-tertiary mb-1 block">{t('campaign.splitRatio')}</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary w-6">A: {splitRatio}%</span>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    value={splitRatio}
                    onChange={(e) => onSplitRatioChange(Number(e.target.value))}
                    className="flex-1 accent-accent"
                  />
                  <span className="text-xs text-text-secondary w-6">B: {100 - splitRatio}%</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs text-text-tertiary mb-1 block">{t('campaign.testDuration')}</label>
                <div className="flex gap-1">
                  {[6, 12, 24, 48].map((h) => (
                    <button
                      key={h}
                      onClick={() => onTestDurationChange(h)}
                      className={`flex-1 px-2 py-1 rounded text-xs border transition-colors ${
                        testDuration === h
                          ? "bg-accent/10 border-accent text-accent"
                          : "bg-bg-secondary border-border-primary text-text-secondary hover:border-accent/50"
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
