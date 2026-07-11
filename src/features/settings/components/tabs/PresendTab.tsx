import { useTranslation } from "react-i18next";
import { PreSendChecklistPanel } from "@features/settings/components/PreSendChecklistPanel";
import { HelpCard } from "@features/settings/components/HelpCard";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";

export default function PresendTab() {
  const { t } = useTranslation();
  return (
    <SettingGroup title={t('settings.presendChecklist')}>
      <HelpCard
        collapsible
        items={[
          { type: "why", text: "A pre-send checklist catches missing attachments, typos, wrong recipients, and other costly mistakes before emails go out." },
          { type: "how", text: "Each rule checks a specific condition â€” attachment presence, subject line, spell check. All rules must pass before send is allowed." },
          { type: "when", text: "Essential for business-critical emails, client proposals, and any communication where mistakes have reputational or financial impact." },
        ]}
      />
      <div className="mt-4">
        <PreSendChecklistPanel />
      </div>
    </SettingGroup>
  );
}

