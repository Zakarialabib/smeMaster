import { useTranslation } from "react-i18next";
import { ComplianceProfileManager } from "@features/settings/components/ComplianceProfileManager";
import { HelpCard } from "@features/settings/components/HelpCard";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";

export default function ComplianceTab() {
  const { t } = useTranslation();
  return (
    <SettingGroup title={t('settings.complianceProfiles')}>
      {/* Education: Compliance */}
      <HelpCard
        items={[
          { type: "why", text: "Compliance profiles ensure your emails meet legal requirements like GDPR, CAN-SPAM, and industry-specific disclosure rules." },
          { type: "how", text: "Each profile defines mandatory footer text, unsubscribe links, and disclaimer blocks that are appended to outgoing messages." },
          { type: "when", text: "Required for marketing emails, newsletters, and any commercial communication subject to anti-spam regulations." },
        ]}
      />
      <div className="mt-4">
        <ComplianceProfileManager />
      </div>
    </SettingGroup>
  );
}

