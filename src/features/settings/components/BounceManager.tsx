import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Mail,
  AlertCircle,
  AlertTriangle,
  Shield,
  Trash2,
  Unlock,
  Search,
  X,
  Loader2,
  ChevronDown,
  RotateCcw,
  Clock,
  Ban,
  CheckCircle2,
  BarChart3,
  UserX,
} from "lucide-react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { getBounceReport } from "@features/deliverability/services/bounceService";
import {
  getSuppressionList,
  removeFromSuppression,
} from "@features/deliverability/services/suppressionList";
import type { BounceReport } from "@features/deliverability/services/bounceService";
import type { SuppressionEntry } from "@features/deliverability/services/suppressionList";
import { cn } from "@shared/utils/cn";

// ─── Stat Card ───
const StatCard = ({
  label,
  value,
  icon: Icon,
  tone,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: "neutral" | "danger" | "warning" | "accent";
  sub?: string;
}) => {
  const toneMap = {
    neutral: "bg-bg-tertiary/40 border-border/40 text-text-secondary",
    danger: "bg-danger/5 border-danger/20 text-danger",
    warning: "bg-warning/5 border-warning/20 text-warning",
    accent: "bg-accent/5 border-accent/20 text-accent",
  };
  return (
    <div
      className={cn(
        "flex flex-col p-4 rounded-2xl border transition-all hover:shadow-sm",
        toneMap[tone]
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5 opacity-60" />
        {sub && (
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">
            {sub}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-60 mt-0.5">
        {label}
      </div>
    </div>
  );
};

// ─── Reason Bar ───
const ReasonBar = ({
  reason,
  count,
  max,
}: {
  reason: string;
  count: number;
  max: number;
}) => {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-bg-primary border border-border/50 hover:border-border transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-primary font-medium truncate">{reason}</p>
        <div className="mt-1.5 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-warning rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="text-xs font-bold text-text-secondary font-mono shrink-0">
        {count}
      </span>
    </div>
  );
};

export function BounceManager() {
  const { t } = useTranslation();
  const accounts = useAccountStore((s) => s.accounts);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [report, setReport] = useState<BounceReport | null>(null);
  const [suppressions, setSuppressions] = useState<SuppressionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [releaseConfirmEmail, setReleaseConfirmEmail] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"reasons" | "suppression" | null>("suppression");

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0]!.id);
    }
  }, [accounts, selectedAccountId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        getBounceReport(selectedAccountId),
        getSuppressionList(selectedAccountId),
      ]);
      setReport(r);
      setSuppressions(s);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) return;
    loadData();
  }, [selectedAccountId, loadData]);

  async function handleRelease(email: string) {
    setReleasing(true);
    try {
      await removeFromSuppression(selectedAccountId, email);
      const updated = await getSuppressionList(selectedAccountId);
      setSuppressions(updated);
    } finally {
      setReleasing(false);
      setReleaseConfirmEmail(null);
    }
  }

  const filteredSuppressions = suppressions.filter((s) =>
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const maxReasonCount =
    report && report.topReasons.length > 0
      ? Math.max(...report.topReasons.map((r) => r.count))
      : 0;

  return (
    <div className="space-y-6">
      {/* ── Account Selector ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 block">
            {t("settings.bounce.targetAccount") || "Target Account"}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <select
              className="pl-10 pr-8 py-2 bg-bg-primary border border-border rounded-xl text-sm text-text-primary appearance-none focus:outline-none focus:ring-2 focus:ring-accent/30 min-w-[240px]"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-xl border border-border hover:border-border-secondary transition-all disabled:opacity-50 active:scale-95 shrink-0"
        >
          <RotateCcw size={13} className={cn(loading && "animate-spin")} />
          {loading ? "Loading..." : "Refresh Data"}
        </button>
      </div>

      {/* ── Loading ─── */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 size={18} className="text-accent animate-spin" />
          <span className="text-sm text-text-secondary">{t("common.loading")}</span>
        </div>
      )}

      {/* ── Stats Grid ─── */}
      {!loading && report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label={t("settings.bounce.total") || "Total Bounces"}
            value={report.totalBounces}
            icon={BarChart3}
            tone="accent"
            sub="All time"
          />
          <StatCard
            label={t("settings.bounce.hard") || "Hard Bounces"}
            value={report.hardBounces}
            icon={Ban}
            tone="danger"
            sub="Permanent"
          />
          <StatCard
            label={t("settings.bounce.soft") || "Soft Bounces"}
            value={report.softBounces}
            icon={AlertTriangle}
            tone="warning"
            sub="Temporary"
          />
          <StatCard
            label={t("settings.bounce.policy") || "Policy"}
            value={report.policyBounces}
            icon={Shield}
            tone="neutral"
            sub="Blocked"
          />
        </div>
      )}

      {/* ── Top Reasons (Collapsible) ─── */}
      {!loading && report && (
        <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 overflow-hidden">
          <button
            onClick={() =>
              setExpandedSection((s) => (s === "reasons" ? null : "reasons"))
            }
            className="w-full flex items-center justify-between p-4 hover:bg-bg-tertiary/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-warning/10 text-warning">
                <AlertTriangle size={16} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-text-primary">
                  {t("settings.bounce.topReasons") || "Top Bounce Reasons"}
                </h3>
                <p className="text-[10px] text-text-tertiary">
                  {report.topReasons.length} distinct reasons found
                </p>
              </div>
            </div>
            <ChevronDown
              size={16}
              className={cn(
                "text-text-tertiary transition-transform",
                expandedSection === "reasons" && "rotate-180"
              )}
            />
          </button>

          {expandedSection === "reasons" && (
            <div className="px-4 pb-4 space-y-2">
              {report.topReasons.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                  <div className="p-3 rounded-full bg-bg-primary border border-border/50">
                    <CheckCircle2 className="w-6 h-6 text-success opacity-40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-tertiary">
                      No bounce reasons recorded
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      Great — your deliverability looks clean.
                    </p>
                  </div>
                </div>
              )}
              {report.topReasons.slice(0, 5).map((r, i) => (
                <ReasonBar
                  key={i}
                  reason={r.reason}
                  count={r.count}
                  max={maxReasonCount}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Suppression List ─── */}
      <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 overflow-hidden">
        <button
          onClick={() =>
            setExpandedSection((s) => (s === "suppression" ? null : "suppression"))
          }
          className="w-full flex items-center justify-between p-4 hover:bg-bg-tertiary/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-danger/10 text-danger">
              <UserX size={16} />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-text-primary">
                {t("settings.suppression.title") || "Suppression List"}
              </h3>
              <p className="text-[10px] text-text-tertiary">
                {suppressions.length} {suppressions.length === 1 ? "address" : "addresses"} suppressed
              </p>
            </div>
          </div>
          <ChevronDown
            size={16}
            className={cn(
              "text-text-tertiary transition-transform",
              expandedSection === "suppression" && "rotate-180"
            )}
          />
        </button>

        {expandedSection === "suppression" && (
          <div className="px-4 pb-4 space-y-3">
            {/* Search */}
            {suppressions.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search suppressed emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-9 h-9 w-full bg-bg-primary border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-bg-tertiary text-text-tertiary transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Empty State */}
            {suppressions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                <div className="p-4 rounded-full bg-bg-primary border border-border/50">
                  <CheckCircle2 className="w-8 h-8 text-success opacity-30" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-tertiary">
                    {t("settings.suppression.empty") || "Suppression list is empty"}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1 max-w-[280px]">
                    No addresses are currently suppressed. This is a good sign for your list hygiene.
                  </p>
                </div>
              </div>
            )}

            {/* Search No Results */}
            {filteredSuppressions.length === 0 && suppressions.length > 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-sm text-text-tertiary">No matches found.</p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-xs text-accent hover:underline"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* List */}
            <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {filteredSuppressions.map((s) => {
                const isConfirming = releaseConfirmEmail === s.email;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "group relative flex items-center gap-3 p-3 rounded-xl border transition-all",
                      isConfirming
                        ? "bg-danger/5 border-danger/30"
                        : "bg-bg-primary border-border/50 hover:border-border hover:shadow-sm"
                    )}
                  >
                    <div className="p-2 rounded-lg bg-danger/10 text-danger shrink-0">
                      <Ban size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-text-primary">
                          {s.email}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-bg-tertiary text-[10px] font-bold text-text-tertiary border border-border">
                          {s.reason}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-text-tertiary">
                        <Clock size={10} />
                        <span>Suppressed</span>
                        {/* Placeholder: add date when available */}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                      {!isConfirming ? (
                        <button
                          onClick={() => setReleaseConfirmEmail(s.email)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-accent bg-accent/5 hover:bg-accent/10 rounded-lg border border-accent/20 transition-colors"
                        >
                          <Unlock size={12} />
                          {t("settings.suppression.release") || "Release"}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setReleaseConfirmEmail(null)}
                            className="px-2.5 py-1.5 text-[10px] font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRelease(s.email)}
                            disabled={releasing}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white bg-danger rounded-lg hover:bg-danger/90 transition-colors shadow-sm disabled:opacity-50"
                          >
                            {releasing ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <Trash2 size={10} />
                            )}
                            Confirm
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── List Hygiene Actions (Placeholder) ─── */}
      {!loading && report && (
        <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-bold text-text-primary">List Hygiene</h3>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary border border-border">
              Placeholder
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: "Auto-suppress hard bounces",
                desc: "Permanently block invalid addresses",
                status: "pending",
              },
              {
                label: "Soft bounce retry limit",
                desc: "Suppress after 3 consecutive soft bounces",
                status: "pending",
              },
              {
                label: "Complaint auto-suppress",
                desc: "Block spam complaint addresses immediately",
                status: "pending",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 p-3 rounded-xl bg-bg-primary border border-border/50"
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full mt-1.5 shrink-0",
                    item.status === "active" ? "bg-success" : "bg-warning animate-pulse"
                  )}
                />
                <div>
                  <p className="text-xs font-semibold text-text-primary">{item.label}</p>
                  <p className="text-[10px] text-text-tertiary mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}