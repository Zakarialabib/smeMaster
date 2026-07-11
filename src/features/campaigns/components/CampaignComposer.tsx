import { useState, useEffect, useMemo } from "react";
import { Users, FileText, Clock, Eye, ChevronLeft, Send, Save } from "lucide-react";
import { Modal } from "@shared/components/ui/Modal";
import { Button } from "@shared/components/ui/Button";
import { useCampaignComposerStore } from "@features/campaigns/stores/campaignComposerStore";
import { useCampaignStore } from "@features/campaigns/stores/campaignStore";
import { AudienceStep } from "@features/campaigns/components/AudienceStep";
import { TemplateStep } from "@features/campaigns/components/TemplateStep";
import { ScheduleStep } from "@features/campaigns/components/ScheduleStep";
import { ReviewStep } from "@features/campaigns/components/ReviewStep";
import { getCampaignTemplateList } from "@features/campaigns/services/campaignTemplateCatalog";
import type { DbTemplate } from "@features/mail/db/templates";
import { getContactSegments } from "@features/contacts/db/contactSegments";
import { getContactGroups } from "@features/contacts/db/contactGroups";
import { createCampaign as svcCreateCampaign } from "@features/campaigns/services/campaignService";
import { executeSearchQuery } from "@/shared/services/db/db-invoke";
import { useTranslation } from "react-i18next";
import {
  getUserFriendlyErrorMessage,
} from "@features/campaigns/services/errorHandler";
import { notify } from "@shared/services/notifications/toastHelper";

interface CampaignComposerProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  display_name: string | null;
  company: string | null;
}

interface ContactGroup {
  id: string;
  name: string;
}

interface ContactSegment {
  id: string;
  name: string;
  query: string;
}

export function CampaignComposer({ isOpen, onClose, accountId }: CampaignComposerProps) {
  const { t } = useTranslation();

  const store = useCampaignComposerStore();
  const loadCampaigns = useCampaignStore((s) => s.loadCampaigns);

  const [creating, setCreating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [segments, setSegments] = useState<ContactSegment[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactsLoading, setContactsLoading] = useState(true);
  const [templates, setTemplates] = useState<DbTemplate[]>([]);

  // Reset wizard state when opened
  useEffect(() => {
    if (isOpen) {
      store.open();
      setContactSearch("");
    }
  }, [isOpen, store]);

  // Load data when modal opens
  useEffect(() => {
    if (!isOpen || !accountId) return;
    let cancelled = false;
    async function load() {
      try {
        const [contactsRows, groupsRows, segmentsRows, templateList] = await Promise.all([
          executeSearchQuery(
            "SELECT id, name, email, display_name, company FROM contacts WHERE account_id = $1 ORDER BY name ASC",
            [accountId],
          ) as unknown as Promise<Contact[]>,
          getContactGroups(accountId),
          getContactSegments(accountId),
          getCampaignTemplateList(accountId),
        ]);
        if (!cancelled) {
          setContacts(contactsRows);
          setGroups(groupsRows);
          setSegments(segmentsRows);
          setTemplates(templateList);
        }
      } catch (err) {
        console.error("Failed to load audience data:", err);
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isOpen, accountId]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [contacts, contactSearch]);

  const allSelected = filteredContacts.length > 0 && filteredContacts.every((c) => store.selectedContactIds.includes(c.id));

  const selectedGroup = groups.find((g) => g.id === store.selectedGroupId);
  const selectedSegment = segments.find((s) => s.id === store.selectedSegmentId);
  const selectedTemplate = store.templateId ? templates.find((tpl) => tpl.id === store.templateId) : null;

  function canProceed(): boolean {
    if (store.step === "audience") {
      if (store.audienceMode === "contacts") return store.selectedContactIds.length > 0;
      if (store.audienceMode === "group") return store.selectedGroupId !== "";
      if (store.audienceMode === "segment") return store.selectedSegmentId !== "";
      return false;
    }
    if (store.step === "template") return store.templateId !== "";
    if (store.step === "schedule") {
      if (store.scheduleMode === "scheduled") return store.scheduledDate !== "" && store.scheduledTime !== "";
      return true;
    }
    return true;
  }

  function nextStep() {
    if (store.step === "audience") store.setStep("template");
    else if (store.step === "template") store.setStep("schedule");
    else if (store.step === "schedule") store.setStep("review");
  }

  function prevStep() {
    if (store.step === "template") store.setStep("audience");
    else if (store.step === "schedule") store.setStep("template");
    else if (store.step === "review") store.setStep("schedule");
  }

  async function handleCreate() {
    if (!store.name.trim()) return;
    setCreating(true);
    try {
      let recipientContactIds: string[] | undefined;
      let groupId: string | undefined;
      let segmentId: string | undefined;

      if (store.audienceMode === "contacts") recipientContactIds = store.selectedContactIds;
      else if (store.audienceMode === "group") groupId = store.selectedGroupId;
      else if (store.audienceMode === "segment") segmentId = store.selectedSegmentId;

      await svcCreateCampaign({
        companyId: accountId,
        name: store.name.trim(),
        templateId: store.templateId || undefined,
        recipientContactIds,
        groupId,
        segmentId,
        abTestConfig: store.abEnabled && store.variantA.subject && store.variantB.subject
          ? {
              variantA: { subject: store.variantA.subject, body: store.variantA.body },
              variantB: { subject: store.variantB.subject, body: store.variantB.body },
              splitRatio: store.splitRatio / 100,
              testDurationHours: store.testDuration,
            }
          : undefined,
        status: "sent",
      });
      loadCampaigns(accountId);
    } catch (err) {
      const message = getUserFriendlyErrorMessage(err, "create campaign");
      notify("Failed to create campaign", message);
      return;
    } finally {
      setCreating(false);
    }
    onClose();
  }

  async function handleSaveDraft() {
    if (!store.name.trim()) return;
    setSavingDraft(true);
    try {
      let recipientContactIds: string[] | undefined;
      let groupId: string | undefined;
      let segmentId: string | undefined;

      if (store.audienceMode === "contacts") recipientContactIds = store.selectedContactIds;
      else if (store.audienceMode === "group") groupId = store.selectedGroupId;
      else if (store.audienceMode === "segment") segmentId = store.selectedSegmentId;

      await svcCreateCampaign({
        companyId: accountId,
        name: store.name.trim(),
        templateId: store.templateId || undefined,
        recipientContactIds,
        groupId,
        segmentId,
        abTestConfig: store.abEnabled && store.variantA.subject && store.variantB.subject
          ? {
              variantA: { subject: store.variantA.subject, body: store.variantA.body },
              variantB: { subject: store.variantB.subject, body: store.variantB.body },
              splitRatio: store.splitRatio / 100,
              testDurationHours: store.testDuration,
            }
          : undefined,
        status: "draft",
      });
      loadCampaigns(accountId);
    } catch (err) {
      const message = getUserFriendlyErrorMessage(err, "save campaign draft");
      notify("Failed to save draft", message);
      return;
    } finally {
      setSavingDraft(false);
    }
    onClose();
  }

  function getAudienceLabel(): string {
    if (store.audienceMode === "contacts") return t('campaign.nContacts', { n: store.selectedContactIds.length });
    if (store.audienceMode === "group") return t('campaign.groupLabel', { name: selectedGroup?.name ?? store.selectedGroupId });
    return t('campaign.segmentLabel', { name: selectedSegment?.name ?? store.selectedSegmentId });
  }

  function getScheduleLabel(): string {
    if (store.scheduleMode === "immediate") return t('campaign.sendImmediately');
    if (store.scheduleMode === "scheduled") return t('campaign.scheduledLabel', { date: store.scheduledDate, time: store.scheduledTime });
    return t('campaign.recurringLabel', { frequency: store.recurringFrequency });
  }

  const steps: { id: typeof store.step; label: string; icon: typeof Users }[] = [
    { id: "audience", label: t('campaign.audience'), icon: Users },
    { id: "template", label: t('campaign.stepTemplate'), icon: FileText },
    { id: "schedule", label: t("campaign.schedule"), icon: Clock },
    { id: "review", label: t('campaign.stepReview'), icon: Eye },
  ];

  const currentIdx = steps.findIndex((s) => s.id === store.step);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="xl" panelClassName="max-h-[85vh] overflow-hidden flex flex-col p-0 border-t-2 border-t-accent">
      {/* Modal header with step indicator */}
      <div className="px-5 py-3 border-b border-border-primary bg-bg-secondary/50 shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-text-primary">{t('campaign.newCampaign')}</h2>
          <span className="text-[0.625rem] text-text-tertiary">Step {currentIdx + 1} of {steps.length}</span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1 bg-border-primary rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentIdx + 1) / steps.length) * 100}%` }}
          />
        </div>
        {/* Step indicators */}
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 ${
                  s.id === store.step
                    ? "text-text-primary"
                    : i < currentIdx
                      ? "text-accent"
                      : "text-text-tertiary"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-medium transition-all duration-300 ${
                    s.id === store.step
                      ? "bg-accent text-white ring-2 ring-accent/30"
                      : i < currentIdx
                        ? "bg-accent/15 text-accent"
                        : "bg-bg-tertiary text-text-tertiary"
                  }`}
                >
                  <s.icon size={12} />
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${s.id === store.step ? "text-text-primary" : ""}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-px hidden sm:block ${i < currentIdx ? "bg-accent/40" : "bg-border-secondary"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Step 1: Audience Selection */}
        {store.step === "audience" && (
          <AudienceStep
            name={store.name}
            onNameChange={store.setName}
            audienceMode={store.audienceMode}
            onAudienceModeChange={store.setAudienceMode}
            selectedContactIds={store.selectedContactIds}
            onToggleContact={store.toggleContact}
            onToggleAll={() => store.toggleAllContacts(filteredContacts.map((c) => c.id))}
            contactSearch={contactSearch}
            onContactSearchChange={setContactSearch}
            groups={groups}
            segments={segments}
            selectedGroupId={store.selectedGroupId}
            onGroupSelect={store.setSelectedGroupId}
            selectedSegmentId={store.selectedSegmentId}
            onSegmentSelect={store.setSelectedSegmentId}
            contactsLoading={contactsLoading}
            allSelected={allSelected}
            filteredContacts={filteredContacts}
            accountId={accountId}
          />
        )}

        {/* Step 2: Template */}
        {store.step === "template" && (
          <TemplateStep
            templateId={store.templateId}
            onTemplateSelect={store.setTemplateId}
            abEnabled={store.abEnabled}
            onToggleAb={() => store.setAbEnabled(!store.abEnabled)}
            variantA={store.variantA}
            onVariantAChange={store.setVariantA}
            variantB={store.variantB}
            onVariantBChange={store.setVariantB}
            splitRatio={store.splitRatio}
            onSplitRatioChange={store.setSplitRatio}
            testDuration={store.testDuration}
            onTestDurationChange={store.setTestDuration}
            t={t}
          />
        )}

        {/* Step 3: Schedule */}
        {store.step === "schedule" && (
          <ScheduleStep
            scheduleMode={store.scheduleMode}
            onScheduleModeChange={store.setScheduleMode}
            scheduledDate={store.scheduledDate}
            onDateChange={store.setScheduledDate}
            scheduledTime={store.scheduledTime}
            onTimeChange={store.setScheduledTime}
            recurringFrequency={store.recurringFrequency}
            onFrequencyChange={store.setRecurringFrequency}
            trackingEnabled={store.trackingEnabled}
            onToggleTracking={() => store.setTrackingEnabled(!store.trackingEnabled)}
            gdprConsent={store.gdprConsent}
            onGdprChange={store.setGdprConsent}
            t={t}
          />
        )}

        {/* Step 4: Review */}
        {store.step === "review" && (
          <ReviewStep
            name={store.name}
            audienceLabel={getAudienceLabel()}
            selectedTemplate={selectedTemplate}
            scheduleLabel={getScheduleLabel()}
            trackingEnabled={store.trackingEnabled}
            abEnabled={store.abEnabled}
            splitRatio={store.splitRatio}
            testDuration={store.testDuration}
            recipientCount={
              store.audienceMode === "contacts"
                ? store.selectedContactIds.length
                : null
            }
            t={t}
          />
        )}
      </div>

      {/* Navigation footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border-primary bg-bg-secondary/30 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          icon={store.step !== "audience" ? <ChevronLeft size={15} /> : undefined}
          onClick={store.step === "audience" ? onClose : prevStep}
        >
          {store.step === "audience" ? t('common.cancel') : t('common.back')}
        </Button>
        <div className="flex items-center gap-2">
          {store.step === "review" && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Save size={15} />}
                onClick={handleSaveDraft}
                disabled={savingDraft || !store.name.trim()}
                loading={savingDraft}
              >
                {savingDraft ? t('campaign.saving') : t('campaign.saveDraft')}
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<Send size={15} />}
                onClick={handleCreate}
                disabled={creating || !store.name.trim()}
                loading={creating}
              >
                {creating ? t('campaign.creating') : t('campaign.launchCampaign')}
              </Button>
            </>
          )}
          {store.step !== "review" && (
            <Button
              variant="primary"
              size="md"
              onClick={nextStep}
              disabled={!canProceed()}
            >
              {t('common.next')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
