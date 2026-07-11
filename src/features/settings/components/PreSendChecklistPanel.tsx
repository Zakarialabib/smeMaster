import { useState } from "react";
import { useTranslation } from "react-i18next";
import { runPreSendChecklist } from "@features/deliverability/services/preSendChecklist";
import type { PreSendCheckResult } from "@features/deliverability/services/preSendChecklist";

export function PreSendChecklistPanel() {
  const { t } = useTranslation();
  const [subject, setSubject] = useState("Q1 Proposal — Action Required");
  const [bodyText, setBodyText] = useState("Hi Team,\n\nPlease find attached the Q1 proposal for your review. I look forward to your feedback.\n\nBest regards");
  const [fromEmail, setFromEmail] = useState("user@example.com");
  const [results, setResults] = useState<PreSendCheckResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    setLoading(true);
    try {
      const res = await runPreSendChecklist({
        subject,
        bodyText,
        bodyHtml: "",
        fromEmail,
        toEmails: [],
      });
      setResults(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-text-tertiary">
          {t("settings.presend.description")}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          className="w-full px-3 py-1.5 bg-bg-secondary border border-border-primary rounded-lg text-sm"
          placeholder={t("settings.presend.subjectPlaceholder")}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <input
          type="email"
          className="w-full px-3 py-1.5 bg-bg-secondary border border-border-primary rounded-lg text-sm"
          placeholder={t("settings.presend.fromPlaceholder")}
          value={fromEmail}
          onChange={(e) => setFromEmail(e.target.value)}
        />
        <textarea
          className="w-full px-3 py-1.5 bg-bg-secondary border border-border-primary rounded-lg text-sm min-h-[100px] resize-y"
          placeholder={t("settings.presend.bodyPlaceholder")}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
        />
        <button
          onClick={handleRun}
          disabled={loading || !subject.trim() || !bodyText.trim()}
          className="px-4 py-1.5 bg-accent text-white rounded-lg text-sm hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? t("common.checking") : t("settings.presend.runChecklist")}
        </button>
      </div>

      {results && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-text-primary">{t("settings.presend.results")}</h4>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${
                  r.status === "pass" ? "border-success bg-success/10"
                  : r.status === "warn" ? "border-warning bg-warning/10"
                  : "border-danger bg-danger/10"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{r.label}</span>
                    <span className="text-[0.625rem] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">
                      {r.category}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${
                    r.status === "pass" ? "text-success"
                    : r.status === "warn" ? "text-warning"
                    : "text-danger"
                  }`}>
                    {r.status === "pass" ? "PASS" : r.status === "warn" ? "WARN" : "FAIL"}
                  </span>
                </div>
                <p className="text-xs text-text-tertiary">{r.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
