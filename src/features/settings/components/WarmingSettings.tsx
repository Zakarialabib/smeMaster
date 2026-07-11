import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  Loader2,
  Pause,
  RotateCcw,
  Mail,
  TrendingUp,
  ShieldAlert,
  Clock,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Zap,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import {
  getWarmingPlan,
  enableWarming,
  disableWarming,
  getWarmingProgress,
} from "@features/deliverability/services/warmingService";
import type { WarmingPlan, WarmingProgress } from "@features/deliverability/services/warmingService";
import { generateWarmupPreset } from "@shared/services/ai/warmupGenerator";
import type { WarmupPreset } from "@/constants/warmupPresets";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { UpgradeBadge } from "@shared/components/ui/UpgradeBadge";
import { cn } from "@shared/utils/cn";

export function WarmingSettings() {
  const { t } = useTranslation();
  const accounts = useAccountStore((s) => s.accounts);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [plan, setPlan] = useState<WarmingPlan | null>(null);
  const [progress, setProgress] = useState<WarmingProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const isAiLocked = useFeatureFlagStore((s) => s.getFeatureAccess("ai", 0) === "locked");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiWarmups, setAiWarmups] = useState<WarmupPreset[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0]!.id);
    }
  }, [accounts, selectedAccountId]);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const [p, pr] = await Promise.all([
        getWarmingPlan(selectedAccountId),
        getWarmingProgress(selectedAccountId),
      ]);
      setPlan(p);
      setProgress(pr);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) return;
    loadPlan();
  }, [selectedAccountId, loadPlan]);

  async function handleToggle() {
    if (!selectedAccountId) return;
    if (plan?.enabled) {
      await disableWarming(selectedAccountId);
    } else {
      await enableWarming(selectedAccountId);
    }
    await loadPlan();
  }

  async function handleGenerateWarmup() {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await generateWarmupPreset({ style: "follow_up" });
      setAiWarmups((prev) => [result, ...prev]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  const currentPlan = plan;
  const currentProgress = progress;

  return (
    <div className="space-y-6">
      {/* ── Account Selector ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 block">
            {t("settings.warming.targetAccount") || "Target Account"}
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

        {/* AI Generate */}
        <div className="flex items-center gap-2">
          {isAiLocked ? (
            <UpgradeBadge variant="pro-only" size="sm" />
          ) : (
            <button
              onClick={handleGenerateWarmup}
              disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-accent bg-accent/5 hover:bg-accent/10 rounded-xl border border-accent/20 transition-all disabled:opacity-50 active:scale-95"
            >
              {aiLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {aiLoading ? "Generating..." : "AI Generate Warmup"}
            </button>
          )}
        </div>
      </div>

      {aiError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-danger/5 border border-danger/20 text-xs text-danger">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {aiError}
        </div>
      )}

      {/* ── AI Warmups List ─── */}
      {aiWarmups.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              AI-Generated Warmup Content
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
              {aiWarmups.length} saved
            </span>
          </div>
          <div className="grid gap-2">
            {aiWarmups.map((w, idx) => (
              <div
                key={idx}
                className="group p-4 bg-bg-primary border border-border/50 rounded-xl hover:border-accent/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-accent" />
                    <span className="text-sm font-semibold text-text-primary">{w.name}</span>
                    <span className="text-[0.625rem] px-2 py-0.5 bg-accent/10 text-accent rounded-full border border-accent/20 font-bold">
                      AI
                    </span>
                  </div>
                  <button
                    onClick={() => setAiWarmups((prev) => prev.filter((_, i) => i !== idx))}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-danger/10 text-text-tertiary hover:text-danger"
                    title="Remove"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-tertiary mb-2">
                  <span className="font-medium">Subject:</span>
                  <span className="text-text-secondary">{w.subject}</span>
                </div>
                <div
                  className="text-xs text-text-secondary bg-bg-tertiary/50 rounded-lg p-3 border border-border/30 max-h-32 overflow-y-auto custom-scrollbar"
                  dangerouslySetInnerHTML={{ __html: w.bodyHtml }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 size={18} className="text-accent animate-spin" />
          <span className="text-sm text-text-secondary">{t("common.loading")}</span>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* ── Main Control Card ─── */}
          <div
            className={cn(
              "rounded-2xl border p-5 transition-all",
              currentPlan?.enabled
                ? "bg-accent/5 border-accent/20"
                : "bg-bg-tertiary/30 border-border/50"
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2.5 rounded-xl transition-colors",
                    currentPlan?.enabled ? "bg-accent text-white" : "bg-bg-primary text-text-tertiary"
                  )}
                >
                  {currentPlan?.enabled ? <Zap size={18} /> : <Pause size={18} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">
                    {currentPlan?.enabled ? "Warming Active" : "Warming Paused"}
                  </h3>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {currentPlan?.enabled
                      ? `Sending ${currentProgress?.currentVolume || 0} emails/day`
                      : "Enable to start building sender reputation"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {currentPlan?.enabled && (
                  <button
                    onClick={loadPlan}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-primary rounded-lg border border-border hover:border-border-secondary transition-colors"
                    title="Refresh progress"
                  >
                    <RotateCcw size={12} />
                    Refresh
                  </button>
                )}
                <button
                  onClick={handleToggle}
                  className={cn(
                    "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30",
                    currentPlan?.enabled ? "bg-accent" : "bg-bg-tertiary border border-border"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform",
                      currentPlan?.enabled ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* ── Progress & Ramp ─── */}
            {currentPlan?.enabled && currentProgress && (
              <div className="mt-5 pt-5 border-t border-border/30 space-y-5">
                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                      <TrendingUp size={12} />
                      Daily Volume Progress
                    </span>
                    <span className="text-xs font-bold text-accent">
                      {currentProgress.currentVolume} / {currentProgress.targetVolume}
                    </span>
                  </div>
                  <div className="h-2.5 bg-bg-primary rounded-full overflow-hidden border border-border/30">
                    <div
                      className="h-full bg-linear-to-r from-accent to-accent/70 rounded-full transition-all duration-500"
                      style={{ width: `${currentProgress.percentageComplete}%` }}
                    />
                  </div>
                </div>

                {/* Day Badge */}
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} className="text-text-tertiary" />
                  <span className="text-xs text-text-secondary">
                    {t("settings.warming.dayProgress", {
                      day: currentProgress.day,
                      total: currentProgress.totalDays,
                    })}
                  </span>
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-primary border border-border text-text-tertiary">
                    {Math.round(currentProgress.percentageComplete)}% complete
                  </span>
                </div>

                {/* Volume Ramp Chart */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                      <BarChart3 size={12} />
                      Volume Ramp
                    </span>
                    <button
                      onClick={() => setShowSchedule((s) => !s)}
                      className="text-[10px] text-accent hover:underline"
                    >
                      {showSchedule ? "Hide schedule" : "Show schedule"}
                    </button>
                  </div>
                  <div className="flex items-end gap-[3px] h-20 px-1">
                    {Array.from({ length: currentProgress.totalDays }, (_, i) => {
                      const dayPct = Math.min(100, ((i + 1) / currentProgress.totalDays) * 100);
                      const vol = Math.round(
                        currentProgress.startVolume +
                          (currentProgress.targetVolume - currentProgress.startVolume) *
                            (dayPct / 100)
                      );
                      const isCurrent = i + 1 === currentProgress.day;
                      const isPast = i + 1 < currentProgress.day;
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center gap-1 group/bar"
                        >
                          <div
                            className={cn(
                              "w-full rounded-t transition-all duration-300 relative",
                              isCurrent
                                ? "bg-accent shadow-[0_0_8px_rgba(var(--accent),0.3)]"
                                : isPast
                                  ? "bg-accent/40"
                                  : "bg-bg-tertiary hover:bg-border"
                            )}
                            style={{ height: `${(vol / currentProgress.targetVolume) * 100}%` }}
                          />
                          {isCurrent && (
                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1 text-[9px] text-text-tertiary font-mono">
                    <span>Day 1</span>
                    <span>Day {currentProgress.totalDays}</span>
                  </div>
                </div>

                {/* Schedule Table (collapsible) */}
                {showSchedule && (
                  <div className="rounded-xl border border-border/50 bg-bg-primary overflow-hidden">
                    <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-bg-tertiary/30 text-[10px] font-bold uppercase tracking-wider text-text-tertiary border-b border-border/30">
                      <span>Day</span>
                      <span>Volume</span>
                      <span>Status</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {Array.from({ length: currentProgress.totalDays }, (_, i) => {
                        const day = i + 1;
                        const dayPct = Math.min(100, (day / currentProgress.totalDays) * 100);
                        const vol = Math.round(
                          currentProgress.startVolume +
                            (currentProgress.targetVolume - currentProgress.startVolume) *
                              (dayPct / 100)
                        );
                        const isCurrent = day === currentProgress.day;
                        const isPast = day < currentProgress.day;
                        return (
                          <div
                            key={day}
                            className={cn(
                              "grid grid-cols-3 gap-2 px-4 py-2 text-xs border-b border-border/20 last:border-0",
                              isCurrent && "bg-accent/5"
                            )}
                          >
                            <span className={cn("font-mono", isCurrent && "font-bold text-accent")}>
                              {day}
                            </span>
                            <span className="text-text-secondary">{vol} emails</span>
                            <span className="flex items-center gap-1">
                              {isPast ? (
                                <>
                                  <CheckCircle2 size={10} className="text-success" />
                                  <span className="text-success text-[10px]">Done</span>
                                </>
                              ) : isCurrent ? (
                                <>
                                  <Clock size={10} className="text-accent animate-pulse" />
                                  <span className="text-accent text-[10px] font-bold">Active</span>
                                </>
                              ) : (
                                <span className="text-text-tertiary text-[10px]">Pending</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!currentPlan?.enabled && (
              <div className="mt-5 pt-5 border-t border-border/30 flex items-center gap-3 text-xs text-text-tertiary">
                <ShieldAlert size={14} className="text-warning" />
                <span>Warming is disabled. Your sender reputation is not being actively managed.</span>
              </div>
            )}
          </div>

          {/* ── Safety Thresholds (Placeholder) ─── */}
          <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-warning" />
              <h3 className="text-sm font-bold text-text-primary">Safety Guardrails</h3>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary border border-border">
                Placeholder
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  label: "Auto-pause on bounce rate",
                  value: "> 5%",
                  desc: "Stops warming if hard bounces exceed threshold",
                },
                {
                  label: "Spam complaint limit",
                  value: "> 0.1%",
                  desc: "Halts if recipients mark as spam",
                },
                {
                  label: "Daily send window",
                  value: "9:00 – 17:00",
                  desc: "Only send during business hours",
                },
                {
                  label: "Max ramp increment",
                  value: "+20% / day",
                  desc: "Maximum daily volume increase",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 p-3 rounded-xl bg-bg-primary border border-border/50"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-text-primary">{item.label}</p>
                    <p className="text-[10px] text-text-tertiary mt-0.5">{item.desc}</p>
                    <p className="text-[10px] font-mono text-accent mt-1">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Recent Activity (Placeholder) ─── */}
          <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-text-tertiary" />
                <h3 className="text-sm font-bold text-text-primary">Recent Warmup Activity</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary border border-border">
                Placeholder
              </span>
            </div>
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <div className="p-3 rounded-full bg-bg-primary border border-border/50">
                <Mail className="w-6 h-6 text-text-tertiary opacity-30" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">No recent activity</p>
                <p className="text-xs text-text-tertiary mt-1 max-w-[280px]">
                  Once warming is enabled, sent emails, replies, and engagement events will appear here.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}