import { useTranslation } from "react-i18next";
import { GitBranch } from "lucide-react";
import { LabelEditor } from "@features/settings/components/LabelEditor";
import { FilterEditor } from "@features/settings/components/FilterEditor";
import { SmartLabelEditor } from "@features/settings/components/SmartLabelEditor";
import { SmartFolderEditor } from "@features/settings/components/SmartFolderEditor";
import { QuickStepEditor } from "@features/settings/components/QuickStepEditor";
import { WorkflowEditor } from "@features/settings/components/WorkflowEditor";
import { HelpCard } from "@features/settings/components/HelpCard";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";

export default function MailRulesTab() {
  const { t } = useTranslation();
  return (
    <>
      <SettingGroup title={t("nav.labels")}>
        <p className="text-xs text-text-tertiary mb-3">
          {t('settings.labelsDescription')}
        </p>
        <LabelEditor />
        <HelpCard
          items={[
            { type: "why", text: "Labels let you organize emails into color-coded categories without moving them from the inbox." },
            { type: "how", text: "Create labels and assign them manually or via filters. Labels appear as colored badges next to messages." },
            { type: "when", text: "Use labels for project tracking, client categorization, or priority flagging." },
          ]}
        />
      </SettingGroup>

      <SettingGroup title={t('settings.filters')}>
        <p className="text-xs text-text-tertiary mb-3">
          {t('settings.filtersDescription')}
        </p>
        <FilterEditor />
        <HelpCard
          items={[
            { type: "why", text: "Filters automatically process incoming mail based on rules you define — label, archive, forward, or delete without manual effort." },
            { type: "how", text: "Set conditions (sender, subject, keywords, attachments) and choose an action. Filters run in order; stop processing further rules if desired." },
            { type: "when", text: "Essential for decluttering your inbox and automating repetitive sorting tasks." },
          ]}
        />
      </SettingGroup>

      <SettingGroup title={t('settings.smartLabels')}>
        <p className="text-xs text-text-tertiary mb-3">
          {t('settings.smartLabelsDescription')}
        </p>
        <HelpCard
          items={[
            { type: "why", text: "Smart labels automatically categorize emails based on rules, reducing manual organization and ensuring consistent tagging." },
            { type: "how", text: "Define conditions (sender, subject, keywords) and actions. Incoming mail is evaluated against rules and labeled automatically." },
            { type: "when", text: "Ideal for auto-tagging invoices, support tickets, newsletter subscriptions, and project-specific communications." },
          ]}
        />
        <SmartLabelEditor />
      </SettingGroup>

      <SettingGroup title={t('settings.smartFolders')}>
        <p className="text-xs text-text-tertiary mb-3">
          {t('settings.smartFoldersDescription')}
        </p>
        <HelpCard
          items={[
            { type: "why", text: "Smart folders are saved searches that auto-collect matching emails without modifying your mailbox structure." },
            { type: "how", text: "Define a search query (e.g., 'has:attachment from:paypal') and the folder populates automatically with matching results." },
            { type: "when", text: "Perfect for creating dynamic views like 'Unread from VIPs,' 'Attachments this week,' or 'Follow-ups needed.'" },
          ]}
        />
        <SmartFolderEditor />
      </SettingGroup>

      <SettingGroup title={t('settings.quickSteps')}>
        <p className="text-xs text-text-tertiary mb-3">
          {t('settings.quickStepsDescription')}
        </p>
        <QuickStepEditor />
        <HelpCard
          items={[
            { type: "why", text: "Quick steps let you perform multi-step actions with a single click — move, label, forward, and reply in sequence." },
            { type: "how", text: "Define a sequence of actions (e.g., move to folder + mark as read + forward to team). Apply with one click from the toolbar." },
            { type: "when", text: "Perfect for common workflows like 'File and Reply,' 'Forward to Manager,' or 'Process and Archive.'" },
          ]}
        />
      </SettingGroup>

      {/* ── Workflows (moved from standalone WorkflowsTab) ── */}
      <SettingGroup
        title="Workflows"
        description="Trigger-based automation sequences — auto-respond, move, notify, and more on matching events."
      >
        <div className="flex items-center gap-2 mb-3 text-xs text-text-tertiary">
          <GitBranch size={14} className="text-accent" />
          <span>Workflows run when triggered by events like new email, scheduled time, or webhook call.</span>
        </div>
        <WorkflowEditor />
        <HelpCard
          items={[
            { type: "why", text: "Workflows automate multi-step email processes — auto-reply, notify Slack, create tasks, or forward based on complex trigger conditions." },
            { type: "how", text: "Each workflow has a trigger (new email, schedule, webhook) and a sequence of actions. Workflows are evaluated independently of filters." },
            { type: "when", text: "Use for automated customer follow-ups, approval routing, ticket creation from emails, and scheduled digest emails." },
            { type: "tip", text: "Combine with labels and filters: let filters organize, then let workflows act on the organized results." },
          ]}
        />
      </SettingGroup>
    </>
  );
}

