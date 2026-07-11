import { useTranslation } from "react-i18next";
import { Shield, HardDrive, Send, Bell, Archive, ArrowRight, LayoutDashboard } from "lucide-react";
import { navigateToLabel } from "@/router/navigate";
import { usePlatform } from "@shared/hooks/usePlatform";
import { EmptyState } from "@shared/components/ui/EmptyState";

type CardProps = {
  icon: React.ReactNode;
  title: string;
  count?: number;
  onClick: () => void;
  emptyMessage: string;
};

function DashboardCard({ icon, title, count, onClick, emptyMessage }: CardProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 p-4 rounded-xl bg-bg-secondary border border-border-primary hover:border-accent/30 hover:shadow-sm transition-all text-left w-full group"
    >
      <div className="shrink-0 mt-0.5 text-accent">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="text-[0.625rem] bg-accent/15 text-accent px-1.5 rounded-full leading-normal">
              {count}
            </span>
          )}
        </div>
        {count === undefined || count === 0 ? (
          <p className="text-xs text-text-tertiary mt-0.5">{emptyMessage}</p>
        ) : null}
      </div>
      <ArrowRight
        size={14}
        className="shrink-0 text-text-tertiary group-hover:text-accent transition-colors mt-1"
      />
    </button>
  );
}

/** Skeleton placeholder matching the layout of DashboardCard. */
function DashboardCardSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-bg-secondary border border-border-primary animate-pulse">
      <div className="shrink-0 mt-0.5 w-5 h-5 rounded bg-bg-tertiary" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-3.5 bg-bg-tertiary rounded w-28" />
          <div className="h-3.5 w-6 bg-bg-tertiary rounded-full" />
        </div>
        <div className="h-3 bg-bg-tertiary rounded w-40" />
      </div>
      <div className="shrink-0 mt-1 w-3.5 h-3.5 rounded bg-bg-tertiary" />
    </div>
  );
}

type BusinessDashboardProps = {
  loading?: boolean;
};

export function BusinessDashboard({ loading = false }: BusinessDashboardProps) {
  const { t } = useTranslation();
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;

  // TODO: Replace with real data source
  const pendingCompliance = 0;
  const recentVaultFiles = 0;
  const upcomingCampaigns = 0;
  const followUpCount = 0;

  const hasData = [pendingCompliance, recentVaultFiles, upcomingCampaigns, followUpCount].some(
    (c) => c > 0,
  );

  const titleClass = isMobileDevice ? "text-xl" : "text-2xl";

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="mb-6 space-y-1">
          <h1 className={`${titleClass} font-semibold text-text-primary`}>
            {t("dashboard.title")}
          </h1>
          <p className="text-sm text-text-tertiary">{t("dashboard.description")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <DashboardCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="mb-6">
          <h1 className={`${titleClass} font-semibold text-text-primary`}>
            {t("dashboard.title")}
          </h1>
          <p className="text-sm text-text-tertiary mt-1">{t("dashboard.description")}</p>
        </div>
        <EmptyState
          icon={LayoutDashboard}
          title={t("dashboard.emptyTitle")}
          subtitle={t("dashboard.emptySubtitle")}
        />
      </div>
    );
  }

  // ── Data state ───────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="mb-6">
        <h1 className={`${titleClass} font-semibold text-text-primary`}>
          {t("dashboard.title")}
        </h1>
        <p className="text-sm text-text-tertiary mt-1">{t("dashboard.description")}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <DashboardCard
          icon={<Shield size={20} />}
          title={t("dashboard.compliancePending")}
          count={pendingCompliance}
          onClick={() => navigateToLabel("settings")}
          emptyMessage={t("dashboard.noComplianceIssues")}
        />
        <DashboardCard
          icon={<HardDrive size={20} />}
          title={t("dashboard.recentVaultActivity")}
          count={recentVaultFiles}
          onClick={() => navigateToLabel("settings")}
          emptyMessage={t("dashboard.noRecentVaultActivity")}
        />
        <DashboardCard
          icon={<Send size={20} />}
          title={t("dashboard.upcomingCampaigns")}
          count={upcomingCampaigns}
          onClick={() => navigateToLabel("campaigns")}
          emptyMessage={t("dashboard.noUpcomingCampaigns")}
        />
        <DashboardCard
          icon={<Bell size={20} />}
          title={t("dashboard.followUpReminders")}
          count={followUpCount}
          onClick={() => navigateToLabel("inbox")}
          emptyMessage={t("dashboard.noFollowUps")}
        />
        <DashboardCard
          icon={<Archive size={20} />}
          title={t("dashboard.nextBackup")}
          onClick={() => navigateToLabel("settings")}
          emptyMessage={t("dashboard.noBackupScheduled")}
        />
      </div>
    </div>
  );
}
