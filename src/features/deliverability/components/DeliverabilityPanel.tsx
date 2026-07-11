import { useState, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { notify } from "@shared/services/notifications/toastHelper";
import { useDomainHealthStore } from "@features/deliverability/stores/domainHealthStore";
import { useHealthScore } from "@features/deliverability/hooks/useHealthScore";
import { FailureType } from "@features/deliverability/services/domainHealthService";
import { HealthScoreCard } from "./HealthScoreCard";
import { ProviderMatrix } from "./ProviderMatrix";
import { RemediationWizard } from "./RemediationWizard";

export function DeliverabilityPanel() {
  const [domain, setDomain] = useState("");
  const prevDomain = useRef<string | null>(null);
  const {
    currentDomain,
    remediation,
    getRemediationForDomain,
    setCurrentDomain,
  } = useDomainHealthStore();

  const { data: health, isLoading, error } = useHealthScore(currentDomain);

  async function handleCheck() {
    const d = domain.trim().toLowerCase();
    if (!d) return;
    setCurrentDomain(d);
    notify("Deliverability", `Checking ${d}...`);
  }

  function handleQuickCheck(domainToCheck: string) {
    setDomain(domainToCheck);
    setCurrentDomain(domainToCheck);
  }

  // Derive failures from health data and fetch remediation
  useEffect(() => {
    if (!health || !currentDomain || currentDomain === prevDomain.current)
      return;
    prevDomain.current = currentDomain;
    const failures: FailureType[] = [];
    if (!health.spf_status.present || !health.spf_status.valid) {
      failures.push(FailureType.MissingSpf);
    }
    if (!health.dkim_status.present || !health.dkim_status.valid) {
      failures.push(FailureType.MissingDkim);
    }
    if (!health.dmarc_status.present || !health.dmarc_status.valid) {
      failures.push(FailureType.MissingDmarc);
    }
    if (failures.length > 0) {
      getRemediationForDomain(
        currentDomain,
        failures.map((f) => f.toString()),
      );
    }
  }, [health, currentDomain, getRemediationForDomain]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            className="w-full pl-9 pr-3 py-1.5 bg-bg-secondary border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
            placeholder="Enter domain (e.g. example.com)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCheck();
            }}
          />
        </div>
        <button
          onClick={handleCheck}
          disabled={isLoading || !domain.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Checking...
            </>
          ) : (
            "Check"
          )}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-text-tertiary" />
          <span className="ml-2 text-sm text-text-tertiary">
            Running deliverability diagnostics...
          </span>
        </div>
      )}

      {health && !isLoading && (
        <>
          <HealthScoreCard
            domain={health.domain}
            score={health.score}
            onCheck={handleQuickCheck}
          />

          <ProviderMatrix health={health} />

          {remediation.length > 0 && (
            <RemediationWizard remediation={remediation} />
          )}
        </>
      )}

      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-red-500">
          <p className="text-sm font-medium">
            Error: {error instanceof Error ? error.message : String(error)}
          </p>
          <p className="text-xs mt-1">
            Please try again or check your connection
          </p>
        </div>
      )}

      {!health && !isLoading && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
          <Search size={32} strokeWidth={1} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">
            Enter a domain to check deliverability health
          </p>
          <p className="text-xs mt-1">
            We'll analyze SPF, DKIM, DMARC, and more
          </p>
        </div>
      )}
    </div>
  );
}
