import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, Bell, Megaphone, DatabaseBackup, ArrowRight, Activity } from "lucide-react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import {
  listComplianceChecks,
  listFollowUpReminders,
  listCampaigns,
  listBackupSchedules,
} from "@shared/services/db/db-invoke";
import { navigateToLabel } from "@/router/navigate";
import { WidgetHeader } from "./WidgetHelpers";

type HealthMetric = {
  key: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  to: string;
  /** When true, a non-zero value is "bad" (red), zero is "good" (green). */
  issueTone?: boolean;
};

function parseViolations(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function BusinessHealthWidget() {
  const { t, i18n } = useTranslation();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);

  const [loading, setLoading] = useState(true);
  const [complianceIssues, setComplianceIssues] = useState(0);
  const [followUps, setFollowUps] = useState(0);
  const [upcomingCampaigns, setUpcomingCampaigns] = useState(0);
  const [nextBackupAt, setNextBackupAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (!activeAccountId) {
      setLoading(false);
      return;
    }
    const companyId = activeAccountId;
    (async () => {
      const [checks, reminders, campaigns, backups] = await Promise.allSettled([
        listComplianceChecks(companyId),
        listFollowUpReminders(companyId),
        listCampaigns(companyId),
        listBackupSchedules(companyId),
      ]);

      if (cancelled) return;

      const issueCount =
        checks.status === "fulfilled"
          ? checks.value.filter((c) => parseViolations(c.violations_json).length > 0).length
          : 0;
      const followUpCount =
        reminders.status === "fulfilled"
          ? reminders.value.filter((r) => r.status !== "done").length
          : 0;
      const campaignCount =
        campaigns.status === "fulfilled"
          ? campaigns.value.filter((c) => c.status === "scheduled").length
          : 0;
      const nextRun =
        backups.status === "fulfilled"
          ? backups.value
              .filter((b) => b.is_enabled === 1 && b.next_run_at)
              .map((b) => b.next_run_at as number)
              .sort((a, b) => a - b)[0] ?? null
          : null;

      setComplianceIssues(issueCount);
      setFollowUps(followUpCount);
      setUpcomingCampaigns(campaignCount);
      setNextBackupAt(nextRun);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAccountId]);

  const rtf = useMemo(
    () => new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" }),
    [i18n.language],
  );

  const nextBackupLabel = useMemo(() => {
    if (!nextBackupAt) return t("businessHealth.notScheduled");
    const diffMs = nextBackupAt - Date.now();
    const abs = Math.abs(diffMs);
    if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), "minute");
    if (abs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), "hour");
    return rtf.format(Math.round(diffMs / 86_400_000), "day");
  }, [nextBackupAt, rtf, t]);

  const metrics: HealthMetric[] = [
    {
      key: "compliance",
      icon: <ShieldAlert size={18} />,
      label: t("dashboard.compliancePending"),
      value: complianceIssues,
      to: "settings",
      issueTone: true,
    },
    {
      key: "followups",
      icon: <Bell size={18} />,
      label: t("dashboard.followUpReminders"),
      value: followUps,
      to: "inbox",
      issueTone: true,
    },
    {
      key: "campaigns",
      icon: <Megaphone size={18} />,
      label: t("dashboard.upcomingCampaigns"),
      value: upcomingCampaigns,
      to: "campaigns",
    },
    {
      key: "backup",
      icon: <DatabaseBackup size={18} />,
      label: t("businessHealth.nextBackup"),
      value: 0,
      to: "settings",
    },
  ];

  return (
    <section aria-label={t("businessHealth.title")}>
      <WidgetHeader icon={<Activity size={16} />} title={t("businessHealth.title")} />
      <div className={`grid grid-cols-2 gap-2 mt-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
        {metrics.map((m) => {
          if (m.key === "backup") {
            return (
              <button
                key={m.key}
                onClick={() => navigateToLabel(m.to)}
                className="flex items-center gap-2.5 p-3 rounded-lg bg-bg-secondary border border-border-primary hover:border-accent/30 transition-colors text-left"
              >
                <span className="text-accent shrink-0">{m.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text-primary truncate">
                    {nextBackupLabel}
                  </span>
                  <span className="block text-xs text-text-tertiary truncate">{m.label}</span>
                </span>
              </button>
            );
          }
          const tone =
            m.issueTone
              ? m.value > 0
                ? "text-danger"
                : "text-success"
              : "text-text-primary";
          return (
            <button
              key={m.key}
              onClick={() => navigateToLabel(m.to)}
              className="flex items-center gap-2.5 p-3 rounded-lg bg-bg-secondary border border-border-primary hover:border-accent/30 transition-colors text-left group"
            >
              <span className="text-accent shrink-0">{m.icon}</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-xl font-bold tabular-nums ${tone}`}>{m.value}</span>
                <span className="block text-xs text-text-tertiary truncate">{m.label}</span>
              </span>
              <ArrowRight
                size={14}
                className="shrink-0 text-text-tertiary group-hover:text-accent transition-colors"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
