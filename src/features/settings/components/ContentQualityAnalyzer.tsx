import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Sparkles,
  Type,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  Eye,
  MessageSquare,
  Zap,
  BarChart3,
} from "lucide-react";
import { analyzeContentQuality } from "@features/deliverability/services/contentQuality";
import type { ContentQualityResult } from "@features/deliverability/services/contentQuality";
import { cn } from "@shared/utils/cn";
import { getScoreVariant } from "@shared/utils/scoreVariant";

// ─── Score Gauge ───
const ScoreGauge = ({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) => {
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const v = getScoreVariant(score);
  const color = v.color;
  const bgColor = v.barColor.replace("bg-", "stroke-") + "/20";

  const sizeMap = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  return (
    <div className={cn("relative shrink-0", sizeMap[size])}>
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
        <span className={cn("font-bold", size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-sm", color)}>
          {score}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary">/ 100</span>
      </div>
    </div>
  );
};

// ─── Metric Card ───
const MetricCard = ({
  label,
  value,
  icon: Icon,
  color,
  barWidth,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  barWidth: number;
}) => (
  <div className="flex flex-col p-4 rounded-2xl bg-bg-primary border border-border/50 hover:border-border transition-all">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className={cn("p-1.5 rounded-lg", color.replace("text-", "bg-").replace("500", "100").replace("600", "100"))}>
          <Icon size={14} className={color} />
        </div>
        <span className="text-xs font-semibold text-text-secondary">{label}</span>
      </div>
      <span className={cn("text-lg font-bold", color)}>{value}</span>
    </div>
    <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700", color.replace("text-", "bg-"))}
        style={{ width: `${barWidth}%` }}
      />
    </div>
  </div>
);

// ─── Spam Trigger Detector (client-side placeholder) ───
const SPAM_TRIGGERS = [
  "free", "urgent", "act now", "limited time", "click here",
  "buy now", "order now", "call now", "100% free", "winner",
  "cash bonus", "double your", "earn extra", "extra cash",
  "!!!", "$$$", "credit card", "no obligation", "this is not spam",
];

function detectSpamTriggers(text: string): { word: string; count: number }[] {
  const lower = text.toLowerCase();
  return SPAM_TRIGGERS.map((trigger) => ({
    word: trigger,
    count: lower.split(trigger).length - 1,
  })).filter((t) => t.count > 0);
}

// ─── Tone Analysis Placeholder ───
const TONE_OPTIONS = [
  { label: "Professional", icon: Briefcase, desc: "Formal, business-appropriate" },
  { label: "Friendly", icon: Smile, desc: "Warm, conversational" },
  { label: "Assertive", icon: Zap, desc: "Direct, action-oriented" },
  { label: "Empathetic", icon: Heart, desc: "Understanding, supportive" },
];

function Briefcase(props: any) { return <MessageSquare {...props} />; }
function Smile(props: any) { return <MessageSquare {...props} />; }
function Heart(props: any) { return <MessageSquare {...props} />; }

export function ContentQualityAnalyzer() {
  const { t } = useTranslation();
  const [content, setContent] = useState(
    "Hi John,\n\nI hope this email finds you well. I wanted to follow up on our conversation last week regarding the new project timeline. We need to finalize the milestones by Friday so the team can start execution on Monday.\n\nCould you please review the attached document and let me know if there are any changes you'd like to make?\n\nLooking forward to your feedback.\n\nBest regards,\nSarah"
  );
  const [result, setResult] = useState<ContentQualityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "readability" | "spam" | "tone">("overview");

  async function handleAnalyze() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const res = await analyzeContentQuality(content.trim());
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  const handleCopy = async () => {
    try {
      const { copyToClipboard } = await import("@shared/hooks/useClipboard");
      await copyToClipboard(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const spamTriggers = useMemo(() => detectSpamTriggers(content), [content]);
  const charCount = content.length;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  function scoreColor(score: number): string {
    return getScoreVariant(score).color;
  }

  return (
    <div className="space-y-6">
      {/* ── Editor ─── */}
      <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-bg-tertiary/30">
          <div className="flex items-center gap-2">
            <Type size={14} className="text-text-tertiary" />
            <span className="text-xs font-semibold text-text-secondary">Email Content</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-text-tertiary font-mono">
              {charCount} chars · {wordCount} words
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded-lg border border-border hover:border-border-secondary bg-bg-primary hover:bg-bg-tertiary transition-colors text-text-secondary"
            >
              {copied ? <Check size={10} className="text-success" /> : <Copy size={10} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => setContent("")}
              className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-tertiary hover:text-danger transition-colors"
              title="Clear"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          className="w-full px-4 py-3 bg-bg-primary text-sm text-text-primary placeholder:text-text-tertiary resize-y focus:outline-none min-h-[180px]"
          placeholder={t("settings.contentQuality.placeholder")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30 bg-bg-tertiary/20">
          <div className="flex items-center gap-2">
            {spamTriggers.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] font-bold border border-warning/20">
                <AlertTriangle size={9} />
                {spamTriggers.length} spam trigger{spamTriggers.length > 1 ? "s" : ""}
              </span>
            )}
            {wordCount > 0 && wordCount < 50 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-info/10 text-info text-[10px] font-bold border border-info/20">
                <Lightbulb size={9} />
                Short — consider expanding
              </span>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !content.trim()}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-accent text-white rounded-xl hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {loading ? t("common.analyzing") : t("settings.contentQuality.analyze")}
          </button>
        </div>
      </div>

      {/* ── Results ─── */}
      {result && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Score Header */}
          <div
            className={cn(
              "rounded-2xl border p-5 transition-all",
              result.overallScore >= 80
                ? "bg-success/5 border-success/20"
                : result.overallScore >= 50
                  ? "bg-warning/5 border-warning/20"
                  : "bg-danger/5 border-danger/20"
            )}
          >
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <ScoreGauge score={result.overallScore} size="md" />
              <div className="flex-1 text-center sm:text-left">
                <h3
                  className={cn(
                    "text-lg font-bold",
                    scoreColor(result.overallScore)
                  )}
                >
                  {result.overallScore >= 80
                    ? "Excellent Content"
                    : result.overallScore >= 50
                      ? "Good, But Could Improve"
                      : "Needs Revision"}
                </h3>
                <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
                  {result.overallScore >= 80
                    ? "Your email is well-structured, readable, and likely to engage recipients."
                    : result.overallScore >= 50
                      ? "Some areas need attention. Review the suggestions below to improve engagement."
                      : "Multiple issues detected. Consider rewriting with the suggestions provided."}
                </p>
                <div className="flex items-center gap-3 mt-3 justify-center sm:justify-start">
                  <span className="inline-flex items-center gap-1 text-[10px] text-text-tertiary">
                    <Type size={10} />
                    {result.wordCount} words
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-text-tertiary">
                    <Clock size={10} />
                    ~{Math.ceil(result.readingTimeSeconds / 60)} min read
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-text-tertiary">
                    <Eye size={10} />
                    Grade {result.readability >= 70 ? "6-7" : result.readability >= 50 ? "8-9" : "10+"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-bg-tertiary rounded-xl border border-border w-fit">
            {[
              { key: "overview", label: "Overview", icon: BarChart3 },
              { key: "readability", label: "Readability", icon: Eye },
              { key: "spam", label: "Spam Check", icon: AlertTriangle },
              { key: "tone", label: "Tone", icon: MessageSquare },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                  activeTab === tab.key
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
                )}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Overview */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MetricCard
                label={t("settings.contentQuality.clarity") || "Clarity"}
                value={result.clarity}
                icon={Eye}
                color={scoreColor(result.clarity)}
                barWidth={result.clarity}
              />
              <MetricCard
                label={t("settings.contentQuality.engagement") || "Engagement"}
                value={result.engagement}
                icon={Zap}
                color={scoreColor(result.engagement)}
                barWidth={result.engagement}
              />
              <MetricCard
                label={t("settings.contentQuality.readability") || "Readability"}
                value={result.readability}
                icon={Type}
                color={scoreColor(result.readability)}
                barWidth={result.readability}
              />
            </div>
          )}

          {/* Tab: Readability */}
          {activeTab === "readability" && (
            <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Eye size={14} className="text-accent" />
                  Readability Breakdown
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-bg-primary border border-border/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Flesch Score</span>
                  <p className={cn("text-2xl font-bold mt-1", scoreColor(result.readability))}>
                    {result.readability}
                  </p>
                  <p className="text-[10px] text-text-tertiary mt-1">
                    {result.readability >= 70 ? "Easy to read" : result.readability >= 50 ? "Standard" : "Difficult"}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-bg-primary border border-border/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Sentence Length</span>
                  <p className="text-2xl font-bold text-text-primary mt-1">
                    {Math.round(result.wordCount / Math.max(1, content.split(/[.!?]+/).length))}
                  </p>
                  <p className="text-[10px] text-text-tertiary mt-1">Words per sentence</p>
                </div>
                <div className="p-4 rounded-xl bg-bg-primary border border-border/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Paragraph Count</span>
                  <p className="text-2xl font-bold text-text-primary mt-1">
                    {content.split(/\n\s*\n/).filter(Boolean).length}
                  </p>
                  <p className="text-[10px] text-text-tertiary mt-1">Total paragraphs</p>
                </div>
                <div className="p-4 rounded-xl bg-bg-primary border border-border/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Reading Time</span>
                  <p className="text-2xl font-bold text-text-primary mt-1">
                    {Math.ceil(result.readingTimeSeconds / 60)}m
                  </p>
                  <p className="text-[10px] text-text-tertiary mt-1">At 200 WPM</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Spam Check */}
          {activeTab === "spam" && (
            <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <AlertTriangle size={14} className="text-warning" />
                  Spam Trigger Analysis
                </h4>
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold",
                    spamTriggers.length === 0
                      ? "bg-success/10 text-success border border-success/20"
                      : "bg-warning/10 text-warning border border-warning/20"
                  )}
                >
                  {spamTriggers.length === 0 ? "Clean" : `${spamTriggers.length} found`}
                </span>
              </div>

              {spamTriggers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                  <div className="p-3 rounded-full bg-success/10">
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-success">No spam triggers detected</p>
                    <p className="text-xs text-text-tertiary mt-1">
                      Your content looks safe for inbox delivery.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {spamTriggers.map((trigger, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-bg-primary border border-warning/20"
                    >
                      <div className="flex items-center gap-2">
                        <XCircle size={14} className="text-warning shrink-0" />
                        <span className="text-sm font-medium text-text-primary">"{trigger.word}"</span>
                      </div>
                      <span className="text-xs font-bold text-warning">{trigger.count}x</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Placeholder: Spam Score from Backend */}
              <div className="p-3 rounded-xl bg-bg-primary border border-border/50 opacity-60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-secondary">Backend Spam Score</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary border border-border">
                    Placeholder
                  </span>
                </div>
                <p className="text-[10px] text-text-tertiary">
                  Wire to spamassassin, mail-tester API, or internal heuristics for comprehensive scoring.
                </p>
              </div>
            </div>
          )}

          {/* Tab: Tone */}
          {activeTab === "tone" && (
            <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <MessageSquare size={14} className="text-accent" />
                  Tone Analysis
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary border border-border">
                  Placeholder — needs backend
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TONE_OPTIONS.map((tone) => (
                  <div
                    key={tone.label}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-bg-primary border border-border/50 opacity-50"
                  >
                    <div className="p-2 rounded-lg bg-bg-tertiary">
                      <tone.icon size={18} className="text-text-tertiary" />
                    </div>
                    <span className="text-xs font-semibold text-text-primary">{tone.label}</span>
                    <span className="text-[10px] text-text-tertiary text-center">{tone.desc}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
                <Lightbulb size={12} />
                <span>Backend needed: sentiment analysis API (e.g., OpenAI, AWS Comprehend) or trained classifier</span>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 p-4 space-y-3">
              <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Lightbulb size={14} className="text-accent" />
                {t("settings.contentQuality.suggestions") || "Suggestions"}
              </h4>
              <div className="space-y-2">
                {result.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl bg-bg-primary border border-border/50 hover:border-accent/20 transition-colors"
                  >
                    <div className="p-1 rounded-full bg-accent/10 text-accent shrink-0 mt-0.5">
                      <Sparkles size={10} />
                    </div>
                    <span className="text-xs text-text-secondary leading-relaxed">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── A/B Testing Placeholder ─── */}
      <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-bold text-text-primary">A/B Test Variants</h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary border border-border">
            Placeholder — needs backend
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
          <div className="p-4 rounded-full bg-bg-primary border border-border/50">
            <BarChart3 className="w-8 h-8 text-text-tertiary opacity-30" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-tertiary">No A/B tests yet</p>
            <p className="text-xs text-text-tertiary mt-1 max-w-[280px]">
              Create variant subject lines or body copy and compare open rates, click rates, and reply rates.
            </p>
          </div>
          <button
            onClick={() => {
              /* placeholder: create A/B test */
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-accent bg-accent/5 hover:bg-accent/10 rounded-xl border border-accent/20 transition-all active:scale-95"
          >
            <Zap size={13} />
            Create A/B Test
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-text-tertiary">
          <Lightbulb size={12} />
          <span>Backend needed: variant storage, campaign assignment, engagement tracking, statistical significance calculator</span>
        </div>
      </div>

      {/* ── Template Library Placeholder ─── */}
      <div className="rounded-2xl border border-border/50 bg-bg-tertiary/20 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-bold text-text-primary">Saved Templates</h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary border border-border">
            Placeholder
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
          <div className="p-4 rounded-full bg-bg-primary border border-border/50">
            <BookOpen className="w-8 h-8 text-text-tertiary opacity-30" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-tertiary">No saved templates</p>
            <p className="text-xs text-text-tertiary mt-1 max-w-[280px]">
              Save high-performing emails as templates for quick reuse across campaigns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}