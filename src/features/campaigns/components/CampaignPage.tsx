import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useCampaignStore } from "@features/campaigns/stores/campaignStore";
import { CampaignList } from "@features/campaigns/components/CampaignList";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { UpgradeBanner } from "@shared/components/ui/UpgradeBadge";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { GlassPanel, SkeletonTable } from "@shared/components/ui";

export function CampaignPage() {
  const { t } = useTranslation();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const loadCampaigns = useCampaignStore((s) => s.loadCampaigns);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const isLoading = useCampaignStore((s) => s.isLoading);
  const isCampaignsLocked = useFeatureFlagStore((s) => s.getFeatureAccess("campaigns", 0) === "locked");

  useEffect(() => {
    if (activeAccountId) {
      loadCampaigns(activeAccountId);
    }
  }, [activeAccountId, loadCampaigns]);

  if (isCampaignsLocked) {
    return (
      <SettingGroup title={t("campaign.campaigns")}>
        <UpgradeBanner featureName="Campaigns" description="Create and manage bulk email campaigns with mail merge, A/B testing, and detailed analytics. Upgrade to Pro to unlock." />
      </SettingGroup>
    );
  }

  if (!activeAccountId) {
    return (
      <SettingGroup title={t("campaign.campaigns")}>
        <div className="flex flex-col items-center justify-center h-full gap-4 text-sm text-text-tertiary">
          <p>{t("campaign.noCampaigns")}</p>
          <button
            onClick={() => window.location.hash = "#/settings/accounts"}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
          >
            Connect Account
          </button>
        </div>
      </SettingGroup>
    );
  }

  if (isLoading && campaigns.length === 0) {
    return (
      <SettingGroup title={t("campaign.campaigns")}>
        <GlassPanel variant="card" className="p-4">
          <SkeletonTable columns={5} rows={4} />
        </GlassPanel>
      </SettingGroup>
    );
  }

  return (
    <SettingGroup title={t("campaign.campaigns")}>
      <GlassPanel variant="card" className="p-4">
        <CampaignList accountId={activeAccountId} />
      </GlassPanel>
    </SettingGroup>
  );
}
