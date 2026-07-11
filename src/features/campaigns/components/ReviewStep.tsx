import { useState } from "react";
import { Eye, Users, SplitSquareHorizontal, Variable } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { Modal } from "@shared/components/ui/Modal";
import { TEMPLATE_VARIABLES } from "@shared/utils/templateVariables";
import type { Template } from "@shared/services/db/schema";

const MAIL_MERGE_VARIABLES = [
  { key: "{{firstName}}", label: "First Name" },
  { key: "{{lastName}}", label: "Last Name" },
  { key: "{{company}}", label: "Company" },
  { key: "{{email}}", label: "Email" },
  { key: "{{unsubscribeUrl}}", label: "Unsubscribe Link" },
];

interface ReviewStepProps {
  name: string;
  audienceLabel: string;
  selectedTemplate: Template | null | undefined;
  scheduleLabel: string;
  trackingEnabled: boolean;
  abEnabled: boolean;
  splitRatio: number;
  testDuration: number;
  recipientCount: number | null;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function ReviewStep({
  name,
  audienceLabel,
  selectedTemplate,
  scheduleLabel,
  trackingEnabled,
  abEnabled,
  splitRatio,
  testDuration,
  recipientCount,
  t,
}: ReviewStepProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  return (
    <div className="space-y-3">
      <div className="text-sm text-text-primary font-medium">{t('campaign.campaignSummary')}</div>
      <div className="glass-panel rounded-lg p-4 space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-text-tertiary">{t('common.name')}</span>
          <span className="text-text-primary font-medium">{name.trim() || "—"}</span>
        </div>
        <div className="border-t border-border-primary" />
        <div className="flex justify-between items-center">
          <span className="text-text-tertiary">{t('campaign.audience')}</span>
          <span className="text-text-primary">{audienceLabel}</span>
        </div>
        {recipientCount !== null && recipientCount > 0 && (
          <div className="flex justify-between items-center pl-4 text-xs">
            <span className="text-text-tertiary" />
            <span className="text-text-secondary flex items-center gap-1">
              <Users size={12} />
              {t('campaign.nRecipients', { n: recipientCount })}
            </span>
          </div>
        )}
        <div className="border-t border-border-primary" />
        <div className="flex justify-between items-center">
          <span className="text-text-tertiary">{t('campaign.stepTemplate')}</span>
          <span className="text-text-primary">{selectedTemplate?.name ?? t('campaign.noTemplate')}</span>
        </div>
        <div className="border-t border-border-primary" />
        <div className="flex justify-between items-center">
          <span className="text-text-tertiary">{t('campaign.schedule')}</span>
          <span className="text-text-primary">{scheduleLabel}</span>
        </div>
        <div className="border-t border-border-primary" />
        <div className="flex justify-between items-center">
          <span className="text-text-tertiary">{t('campaign.tracking')}</span>
          <span className={`text-sm ${trackingEnabled ? "text-success" : "text-text-tertiary"}`}>
            {trackingEnabled ? t('campaign.enabled') : t('common.disabled')}
          </span>
        </div>
        {abEnabled && (
          <>
            <div className="border-t border-border-primary" />
            <div className="flex justify-between items-center">
              <span className="text-text-tertiary">{t('campaign.abTest')}</span>
              <span className="text-sm text-accent">
                A: {splitRatio}% / B: {100 - splitRatio}% · {testDuration}h
              </span>
            </div>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="secondary"
          size="sm"
          icon={<Eye size={14} />}
          onClick={() => setShowPreview(true)}
        >
          {t('common.preview')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Variable size={14} />}
          onClick={() => setShowVariables(true)}
        >
          {t('campaign.variables')}
        </Button>
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title={t('campaign.campaignPreview')}
        size="xl"
      >
        <div className="p-4 space-y-4">
          {/* Campaign info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-tertiary text-xs">{t('common.name')}</span>
              <p className="text-text-primary font-medium mt-0.5">{name.trim() || "—"}</p>
            </div>
            <div>
              <span className="text-text-tertiary text-xs">{t('campaign.audience')}</span>
              <p className="text-text-primary mt-0.5">{audienceLabel}</p>
            </div>
            <div>
              <span className="text-text-tertiary text-xs">{t('campaign.stepTemplate')}</span>
              <p className="text-text-primary mt-0.5">{selectedTemplate?.name ?? t('campaign.noTemplate')}</p>
            </div>
            <div>
              <span className="text-text-tertiary text-xs">{t('campaign.schedule')}</span>
              <p className="text-text-primary mt-0.5">{scheduleLabel}</p>
            </div>
          </div>

          {recipientCount !== null && recipientCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-accent/5 border border-accent/15 rounded-lg px-3 py-1.5">
              <Users size={12} className="text-accent" />
              {t('campaign.nRecipients', { n: recipientCount })}
            </div>
          )}

          {abEnabled && (
            <div className="flex items-center gap-1.5 text-xs text-accent bg-accent/5 border border-accent/15 rounded-lg px-3 py-1.5">
              <SplitSquareHorizontal size={12} />
              {t('campaign.abTest')}: A {splitRatio}% / B {100 - splitRatio}% · {testDuration}h
            </div>
          )}

          {/* Template preview */}
          {selectedTemplate && (
            <div>
              <label className="text-xs text-text-tertiary mb-1.5 block font-medium">
                {t('campaign.emailPreview')}
              </label>
              <div className="border border-border-primary rounded-lg overflow-hidden">
                <iframe
                  srcDoc={selectedTemplate.body_html.replace(/\{\{content\}\}/g, t('campaign.templatePreviewContent'))}
                  className="w-full min-h-[300px]"
                  sandbox="allow-same-origin"
                  title={t('settings.templatePreview')}
                />
              </div>
            </div>
          )}

          {!selectedTemplate && (
            <div className="text-xs text-text-tertiary text-center py-8">
              {t('campaign.noTemplateSelected')}
            </div>
          )}
        </div>
      </Modal>

      {/* Variables Modal */}
      <Modal
        isOpen={showVariables}
        onClose={() => setShowVariables(false)}
        title={t('campaign.mailMergeVariables')}
        size="md"
      >
        <div className="p-4 space-y-4">
          <p className="text-xs text-text-tertiary leading-relaxed">
            {t('campaign.variablesDescription')}
          </p>

          <div className="space-y-1">
            <span className="text-xs font-medium text-text-primary">{t('campaign.standardVariables')}</span>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <div
                  key={v.key}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-bg-secondary border border-border-primary text-xs"
                >
                  <code className="text-accent font-mono text-[0.625rem]">{v.key}</code>
                  <span className="text-text-tertiary">—</span>
                  <span className="text-text-secondary">{v.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border-primary pt-3">
            <span className="text-xs font-medium text-text-primary">{t('campaign.additionalVariables')}</span>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {MAIL_MERGE_VARIABLES.map((v) => (
                <div
                  key={v.key}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-bg-secondary border border-border-primary text-xs"
                >
                  <code className="text-accent font-mono text-[0.625rem]">{v.key}</code>
                  <span className="text-text-tertiary">—</span>
                  <span className="text-text-secondary">{v.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-accent/5 border border-accent/15 rounded-lg p-3">
            <p className="text-xs text-text-secondary leading-relaxed">
              {t('campaign.variablesResolvedAtSend')}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
