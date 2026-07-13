import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Loader2,
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  History,
  ArrowRight,
  Shield,
  KeyRound,
  FileText,
  Sparkles,
} from "lucide-react";
import { checkDomainDns, getDnsHealthScore } from "@features/deliverability/services/dnsChecker";
import type { DnsCheckResult } from "@features/deliverability/services/dnsChecker";
import { cn } from "@shared/utils/cn";

// ─── Record Type Config ───
const RECORD_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string; bg: string; border: string }
> = {
  SPF: {
    icon: Shield,
    label: "Sender Policy Framework",
    color: "text-success",
    bg: "bg-success/5",
    border: "border-success/20",
  },
  DKIM: {
    icon: KeyRound,
    label: "DomainKeys Identified Mail",
    color: "text-accent",
    bg: "bg-accent/5",
    border: "border-accent/20",
  },
  DMARC: {
    icon: FileText,
    label: "DMARC Policy",
    color: "text-warning",
    bg: "bg-warning/5",
    border: "border-warning/20",
  },
};

// ─── Copy Helper ───
const copyToClipboard = async (text: string) => {
  try {
    const { copyToClipboard: clip } = await import("@shared/hooks/useClipboard");
    await clip(text);
    return true;
  } catch {
    return false;
  }
};

// ─── Score Gauge ───
const ScoreGauge = ({ score }: { score: number }) => {
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-danger";
  const bgColor = score >= 80 ? "stroke-success/20" : score >= 50 ? "stroke-warning/20" : "stroke-danger/20";

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" strokeWidth="6" className={bgColor} />
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={cn(color, "transition-all duration-1000")}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-xl font-bold", color)}>{score}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary">/ 100</span>
      </div>
    </div>
  );
};

// ─── Result Card ───
const ResultCard = ({ result }: { result: DnsCheckResult }) => {
  const [copied, setCopied] = useState(false);
  const config = RECORD_CONFIG[result.record] || {
    icon: Globe,
    label: result.record,
    color: "text-text-secondary",
    bg: "bg-bg-tertiary",
    border: "border-border",
  };

  const statusConfig = {
    pass: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10", border: "border-success/20", label: "PASS" },
    fail: { icon: XCircle, color: "text-danger", bg: "bg-danger/10", border: "border-danger/20", label: "FAIL" },
    error: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", label: "ERROR" },
  };
  const status = statusConfig[result.status as keyof typeof statusConfig] || statusConfig.error;

  const handleCopy = async () => {
    const ok = await copyToClipboard(result.value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-2xl border p-4 transition-all hover:shadow-sm",
        config.bg,
        config.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/50 shrink-0">
            <config.icon className={cn("w-5 h-5", config.color)} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-text-primary">{result.record}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                  status.bg,
                  status.border,
                  status.color
                )}
              >
                <status.icon size={10} />
                {status.label}
              </span>
            </div>
            <p className="text-[10px] text-text-tertiary mt-0.5">{config.label}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-black/80 border border-white/5 p-3 relative group/value">
        <button
          onClick={handleCopy}
          className="absolute top-2 end-2 opacity-0 group-hover/value:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-medium text-text-secondary backdrop-blur-sm border border-white/10"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <p className="text-xs text-success font-mono break-all pe-16">{result.value}</p>
      </div>

      {result.detail && (
        <p className="text-xs text-text-tertiary mt-2 leading-relaxed">{result.detail}</p>
      )}
    </div>
  );
};

export function DnsChecker() {
  const { t } = useTranslation();
  const [domain, setDomain] = useState("example.com");
  const [results, setResults] = useState<DnsCheckResult[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedDomain, setCheckedDomain] = useState<string | null>(null);

  async function handleCheck() {
    if (!domain.trim()) return;
    setLoading(true);
    try {
      const res = await checkDomainDns(domain.trim());
      setResults(res);
      setScore(await getDnsHealthScore(res));
      setCheckedDomain(domain.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-text-tertiary">
          {t("settings.dns.description")}
        </p>
      </div>

      {/* ── Input ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Globe className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            className="w-full ps-10 pe-4 py-2.5 bg-bg-primary border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
            placeholder="example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCheck();
            }}
          />
        </div>
        <button
          onClick={handleCheck}
          disabled={loading || !domain.trim()}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95 shrink-0"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
          {loading ? t("common.checking") : t("settings.dns.checkNow")}
        </button>
      </div>

      {/* ── Checked Domain Badge ─── */}
      {checkedDomain && !loading && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
            Checked:
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold border border-accent/20">
            <Globe size={12} />
            {checkedDomain}
          </span>
          <button
            onClick={() => {
              setResults(null);
              setScore(null);
              setCheckedDomain(null);
              setDomain("");
            }}
            className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors ms-2"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Score Card ─── */}
      {score !== null && !loading && (
        <div
          className={cn(
            "rounded-2xl border p-5 transition-all",
            score >= 80
              ? "bg-success/5 border-success/20"
              : score >= 50
                ? "bg-warning/5 border-warning/20"
                : "bg-danger/5 border-danger/20"
          )}
        >
          <div className="flex items-center gap-5">
            <ScoreGauge score={score} />
            <div className="flex-1 min-w-0">
              <h3
                className={cn(
                  "text-sm font-bold",
                  score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-danger"
                )}
              >
                {score >= 80
                  ? "Excellent DNS Health"
                  : score >= 50
                    ? "Needs Improvement"
                    : "Critical DNS Issues"}
              </h3>
              <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
                {score >= 80
                  ? "Your domain is fully authenticated. Expect optimal deliverability and inbox placement."
                  : score >= 50
                    ? "Some records are missing or misconfigured. Review the failed checks below and update your DNS."
                    : "Major authentication gaps detected. Your emails are likely being rejected or sent to spam."}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <div
                  className={cn(
                    "h-1.5 rounded-full flex-1",
                    score >= 80 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-danger"
                  )}
                  style={{ opacity: 0.3 }}
                />
                <span
                  className={cn(
                    "text-[10px] font-bold",
                    score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-danger"
                  )}
                >
                  {score}/100
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Results ─── */}
      {results && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              {t("settings.dns.results") || "DNS Results"}
            </h4>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary border border-border">
              {results.length} records checked
            </span>
          </div>

          <div className="grid gap-3">
            {results.map((r) => (
              <ResultCard key={r.record} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty / Initial State ─── */}
      {!results && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 rounded-2xl border border-dashed border-border bg-bg-tertiary/20">
          <div className="p-4 rounded-full bg-bg-primary border border-border/50">
            <Shield className="w-8 h-8 text-text-tertiary opacity-30" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-tertiary">
              Ready to check your domain
            </p>
            <p className="text-xs text-text-tertiary mt-1 max-w-[280px]">
              Enter a domain above and click "Check DNS" to validate SPF, DKIM, and DMARC configuration.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
            <ArrowRight size={10} />
            <span>Press Enter to run the check</span>
          </div>
        </div>
      )}

      {/* ── Loading Skeleton ─── */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-24 rounded-2xl bg-bg-tertiary/50 border border-border/30" />
          <div className="h-32 rounded-2xl bg-bg-tertiary/50 border border-border/30" />
          <div className="h-32 rounded-2xl bg-bg-tertiary/50 border border-border/30" />
        </div>
      )}

      {/* ── Recent Checks Placeholder ─── */}
      <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-text-tertiary" />
            <h3 className="text-sm font-bold text-text-primary">Recent Checks</h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary border border-border">
            Placeholder
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
          <div className="p-3 rounded-full bg-bg-primary border border-border/50">
            <History className="w-6 h-6 text-text-tertiary opacity-30" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-tertiary">No history yet</p>
            <p className="text-xs text-text-tertiary mt-1 max-w-[260px]">
              Your recent DNS checks will be saved here for quick comparison.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}