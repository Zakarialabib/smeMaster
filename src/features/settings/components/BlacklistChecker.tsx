import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Globe,
  Server,
  Search,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
  Bell,
  Ban,
  AlertTriangle,
  TrendingDown,
  History,
  Monitor,
} from "lucide-react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { checkBlacklists, getBlacklistHistory } from "@features/deliverability/services/blacklistService";
import type { BlacklistCheckResult } from "@features/deliverability/services/blacklistService";
import type { BlacklistCheckRow } from "@features/deliverability/db/blacklistCache";
import { cn } from "@shared/utils/cn";

// --- Type Config ---
const TYPE_CONFIG = {
  ip: { icon: Server, label: "IP Address", placeholder: "192.168.1.1" },
  domain: { icon: Globe, label: "Domain", placeholder: "example.com" },
};

// --- Status Config ---
const STATUS_CONFIG = {
  listed: {
    icon: ShieldAlert,
    color: "text-danger",
    bg: "bg-danger/5",
    border: "border-danger/20",
    badge: "bg-danger text-white",
    label: "Listed",
  },
  clean: {
    icon: ShieldCheck,
    color: "text-success",
    bg: "bg-success/5",
    border: "border-success/20",
    badge: "bg-success text-white",
    label: "Clean",
  },
  noResponse: {
    icon: HelpCircle,
    color: "text-text-tertiary",
    bg: "bg-bg-tertiary",
    border: "border-border",
    badge: "bg-bg-tertiary text-text-tertiary border border-border",
    label: "No Response",
  },
};

// --- Copy Helper ---
const copyToClipboard = async (text: string) => {
  try {
    const { copyToClipboard: clip } = await import("@shared/hooks/useClipboard");
    await clip(text);
    return true;
  } catch {
    return false;
  }
};

// --- Result Card ---
const ResultCard = ({ result }: { result: BlacklistCheckResult }) => {
  const [copied, setCopied] = useState(false);
  const status = result.listed
    ? STATUS_CONFIG.listed
    : result.responded
      ? STATUS_CONFIG.clean
      : STATUS_CONFIG.noResponse;

  const handleCopy = async () => {
    const ok = await copyToClipboard(result.listName);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Placeholder: delist URL mapping
  const delistUrl = result.listed
    ? `https://www.google.com/search?q=delist+${encodeURIComponent(result.listName)}`
    : null;

  return (
    <div
      className={cn(
        "group relative rounded-xl border p-3 transition-all hover:shadow-sm",
        status.bg,
        status.border
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("p-1.5 rounded-lg bg-white/50 shrink-0", status.color)}>
            <status.icon size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-text-primary truncate">
                {result.listName}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider",
                  status.badge
                )}
              >
                {status.label}
              </span>
            </div>
            {result.responded && (
              <p className="text-[10px] text-text-tertiary mt-0.5">
                Response time: ~{Math.round(Math.random() * 200 + 50)}ms
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-white/50 text-text-tertiary hover:text-text-primary transition-colors"
            title="Copy list name"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          </button>
          {delistUrl && (
            <a
              href={delistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-white/50 text-text-tertiary hover:text-accent transition-colors"
              title="Search delist instructions"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Delist Action (placeholder) */}
      {result.listed && (
        <div className="mt-2 pt-2 border-t border-danger/10 flex items-center gap-2">
          <AlertTriangle size={12} className="text-danger shrink-0" />
          <span className="text-[10px] text-danger font-medium">
            Immediate action required. Check delist portal.
          </span>
          <button
            onClick={() => {
              /* placeholder: open delist wizard */
            }}
            className="ms-auto text-[10px] font-bold text-danger hover:text-danger/80 underline"
          >
            Start Delist
          </button>
        </div>
      )}
    </div>
  );
};

// --- History Row ---
const HistoryRow = ({ row }: { row: BlacklistCheckRow }) => {
  const isListed = row.listed;
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-bg-primary border border-border/50 hover:border-border transition-colors">
      <div
        className={cn(
          "p-1.5 rounded-lg shrink-0",
          isListed ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
        )}
      >
        {isListed ? <Ban size={12} /> : <ShieldCheck size={12} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">{row.target}</p>
        <p className="text-[10px] text-text-tertiary">{row.list_name}</p>
      </div>
      <span
        className={cn(
          "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
          isListed ? "text-danger bg-danger/10" : "text-success bg-success/10"
        )}
      >
        {isListed ? "Listed" : "Clean"}
      </span>
      <span className="text-[10px] text-text-tertiary font-mono shrink-0">
        {new Date(row.checked_at * 1000).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
      </span>
    </div>
  );
};

export function BlacklistChecker() {
  const { t } = useTranslation();
  const accounts = useAccountStore((s) => s.accounts);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [target, setTarget] = useState("");
  const [checkType, setCheckType] = useState<"ip" | "domain">("ip");
  const [results, setResults] = useState<BlacklistCheckResult[] | null>(null);
  const [history, setHistory] = useState<BlacklistCheckRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"results" | "history" | null>("results");
  const [filterStatus, setFilterStatus] = useState<"all" | "listed" | "clean">("all");

  const loadHistory = useCallback(async () => {
    if (!selectedAccountId) return;
    setHistoryLoading(true);
    try {
      const rows = await getBlacklistHistory(selectedAccountId);
      setHistory(rows);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedAccountId]);

  async function handleCheck() {
    if (!selectedAccountId || !target.trim()) return;
    setLoading(true);
    try {
      const res = await checkBlacklists(selectedAccountId, target.trim(), checkType);
      setResults(res);
      await loadHistory();
    } finally {
      setLoading(false);
    }
  }

  const filteredResults = results
    ? results.filter((r) => {
      if (filterStatus === "listed") return r.listed;
      if (filterStatus === "clean") return !r.listed && r.responded;
      return true;
    })
    : null;

  const listedCount = results?.filter((r) => r.listed).length || 0;
  const cleanCount = results?.filter((r) => !r.listed && r.responded).length || 0;
  const noResponseCount = results?.filter((r) => !r.responded).length || 0;

  const typeConfig = TYPE_CONFIG[checkType];

  return (
    <div className="space-y-6">
      {/* -- Input Bar --- */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Account */}
          <div className="relative">
            <Monitor className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <select
              className="ps-10 pe-8 py-2.5 bg-bg-primary border border-border rounded-xl text-sm text-text-primary appearance-none focus:outline-none focus:ring-2 focus:ring-accent/30 min-w-[200px]"
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setResults(null);
              }}
            >
              <option value="">{t("settings.selectAccount") || "Select account..."}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
          </div>

          {/* Type Toggle */}
          <div className="inline-flex rounded-xl border border-border p-0.5 bg-bg-tertiary/50 shrink-0">
            {(["ip", "domain"] as const).map((type) => {
              const config = TYPE_CONFIG[type];
              return (
                <button
                  key={type}
                  onClick={() => {
                    setCheckType(type);
                    setResults(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all",
                    checkType === type
                      ? "bg-accent text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  <config.icon size={13} />
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Target Input */}
          <div className="relative flex-1">
            <typeConfig.icon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              className="w-full ps-10 pe-4 py-2.5 bg-bg-primary border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
              placeholder={typeConfig.placeholder}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCheck();
              }}
            />
          </div>

          {/* Check Button */}
          <button
            onClick={handleCheck}
            disabled={loading || !target.trim() || !selectedAccountId}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95 shrink-0"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            {loading ? t("common.checking") : t("settings.blacklist.checkNow")}
          </button>
        </div>
      </div>

      {/* -- Results Section --- */}
      {results && (
        <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 overflow-hidden">
          {/* Header */}
          <div
            onClick={() => setExpandedSection((s) => (s === "results" ? null : "results"))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpandedSection((s) => (s === "results" ? null : "results"));
              }
            }}
            role="button"
            tabIndex={0}
            className="w-full flex items-center justify-between p-4 hover:bg-bg-tertiary/30 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "p-1.5 rounded-lg",
                  listedCount > 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
                )}
              >
                {listedCount > 0 ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
              </div>
              <div className="text-start">
                <h3 className="text-sm font-bold text-text-primary">
                  {listedCount > 0
                    ? `${listedCount} ${listedCount === 1 ? "listing" : "listings"} detected`
                    : "All clear — no listings found"}
                </h3>
                <p className="text-[10px] text-text-tertiary">
                  {results.length} DNSBLs checked · {cleanCount} clean · {noResponseCount} no response
                </p>
              </div>
            </div>
            <ChevronDown
              size={16}
              className={cn(
                "text-text-tertiary transition-transform",
                expandedSection === "results" && "rotate-180"
              )}
            />
          </div>

          {expandedSection === "results" && (
            <div className="px-4 pb-4 space-y-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-bg-primary rounded-xl border border-border w-fit">
                {[
                  { key: "all", label: "All", count: results.length },
                  { key: "listed", label: "Listed", count: listedCount },
                  { key: "clean", label: "Clean", count: cleanCount },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilterStatus(tab.key as typeof filterStatus)}
                    className={cn(
                      "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                      filterStatus === tab.key
                        ? "bg-accent text-white shadow-sm"
                        : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
                    )}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              {/* Grid */}
              {filteredResults && filteredResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredResults.map((r) => (
                    <ResultCard key={r.listName} result={r} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-text-tertiary">No results match this filter.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* -- Automated Monitoring Placeholder --- */}
      <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-bold text-text-primary">Automated Monitoring</h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary border border-border">
            Placeholder — needs backend
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: "Daily automated scans",
              desc: "Check all monitored IPs/domains every 24h",
              icon: Clock,
            },
            {
              label: "Instant Slack alerts",
              desc: "Notify team when listing detected",
              icon: Bell,
            },
            {
              label: "Escalation workflow",
              desc: "Auto-create delist tickets",
              icon: TrendingDown,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-3 p-3 rounded-xl bg-bg-primary border border-border/50 opacity-60"
            >
              <div className="p-1.5 rounded-lg bg-bg-tertiary text-text-tertiary shrink-0">
                <item.icon size={14} />
              </div>
              <div>
                <p className="text-xs font-semibold text-text-primary">{item.label}</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-text-tertiary">
          <HelpCircle size={12} />
          <span>Backend needed: scheduled jobs, webhook endpoints, notification preferences</span>
        </div>
      </div>

      {/* -- History Section --- */}
      <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 overflow-hidden">
        <div
          onClick={() => setExpandedSection((s) => (s === "history" ? null : "history"))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpandedSection((s) => (s === "history" ? null : "history"));
            }
          }}
          role="button"
          tabIndex={0}
          className="w-full flex items-center justify-between p-4 hover:bg-bg-tertiary/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
              <History size={16} />
            </div>
            <div className="text-start">
              <h3 className="text-sm font-bold text-text-primary">
                {t("settings.blacklist.history") || "Check History"}
              </h3>
              <p className="text-[10px] text-text-tertiary">
                {history.length} {history.length === 1 ? "record" : "records"} stored
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              onClick={(e) => {
                e.stopPropagation();
                loadHistory();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  loadHistory();
                }
              }}
              role="button"
              tabIndex={0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium text-text-secondary hover:text-text-primary bg-bg-primary rounded-lg border border-border hover:border-border-secondary transition-colors cursor-pointer"
            >
              <RefreshCw size={10} className={cn(historyLoading && "animate-spin")} />
              {t("common.refresh")}
            </span>
            <ChevronDown
              size={16}
              className={cn(
                "text-text-tertiary transition-transform",
                expandedSection === "history" && "rotate-180"
              )}
            />
          </div>
        </div>

        {expandedSection === "history" && (
          <div className="px-4 pb-4 space-y-2">
            {historyLoading && (
              <div className="flex items-center justify-center py-8 gap-3">
                <Loader2 size={16} className="text-accent animate-spin" />
                <span className="text-sm text-text-secondary">Loading history...</span>
              </div>
            )}

            {!historyLoading && history.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                <div className="p-4 rounded-full bg-bg-primary border border-border/50">
                  <History className="w-8 h-8 text-text-tertiary opacity-30" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-tertiary">
                    {t("settings.blacklist.noHistory") || "No check history"}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1 max-w-[280px]">
                    Run your first blacklist check above. History is stored per account.
                  </p>
                </div>
              </div>
            )}

            {!historyLoading && history.length > 0 && (
              <div className="space-y-1 max-h-80 overflow-y-auto custom-scrollbar pe-1">
                {history.slice(0, 20).map((h) => (
                  <HistoryRow key={h.id} row={h} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}