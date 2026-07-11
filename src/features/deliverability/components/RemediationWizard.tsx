import { useState } from "react";
import { ChevronRight, ChevronDown, AlertTriangle, Copy } from "lucide-react";
import type { RemediationNode } from "@features/deliverability/services/domainHealthService";

interface Props {
  remediation: RemediationNode[];
}

function formatFailureType(failureType: string): string {
  return failureType.replace(/([A-Z])/g, " $1").trim();
}

export function RemediationWizard({ remediation }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (remediation.length === 0) {
    return (
      <div className="rounded-lg border border-border-primary bg-success/10 p-4">
        <div className="flex items-center gap-2 text-success">
          <span className="text-base leading-none">&#10003;</span>
          <span className="text-sm font-medium">No issues found — your deliverability configuration looks good</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
        <AlertTriangle size={14} className="text-warning" />
        Remediation Guide
      </h3>
      <div className="space-y-2">
        {remediation.map((node, index) => {
          const isExpanded = expandedIndex === index;
          return (
            <div
              key={node.failure_type}
              className="rounded-lg border border-border-primary overflow-hidden"
            >
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                className="w-full flex items-center justify-between px-4 py-3 bg-bg-secondary hover:bg-bg-hover transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown size={14} className="shrink-0 text-text-tertiary" /> : <ChevronRight size={14} className="shrink-0 text-text-tertiary" />}
                  <span className="text-sm font-medium text-text-primary">
                    {formatFailureType(node.failure_type)}
                  </span>
                  <span className="text-xs text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded">
                    {node.fix_paths.length} fix{node.fix_paths.length !== 1 ? "es" : ""}
                  </span>
                </div>
                <span className="text-xs text-text-tertiary">{isExpanded ? "Hide" : "Show"}</span>
              </button>

              {isExpanded && (
                <div className="px-4 py-3 space-y-4 border-t border-border-primary">
                  <p className="text-sm text-text-secondary leading-relaxed">{node.explanation.en}</p>

                  {node.impact.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
                        Provider Impact
                      </h4>
                      <div className="space-y-1">
                        {node.impact.map((imp, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                                imp.severity === "Critical" || imp.severity === "critical"
                                  ? "bg-danger"
                                  : imp.severity === "Warning" || imp.severity === "warning"
                                  ? "bg-warning"
                                  : "bg-text-tertiary"
                              }`}
                            />
                            <span className="font-medium text-text-primary">{imp.provider}:</span>
                            <span className="text-text-secondary">{imp.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {node.fix_paths.map((path, pIdx) => (
                    <div key={pIdx}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-accent bg-accent-light px-2 py-0.5 rounded">
                          {path.method}
                        </span>
                        <span className="text-xs text-text-tertiary">~{path.estimated_time}</span>
                      </div>
                      <ol className="space-y-2">
                        {path.instructions.map((step) => (
                          <li key={step.step_number} className="flex gap-3 text-sm">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-bg-tertiary text-text-tertiary flex items-center justify-center text-xs font-medium mt-0.5">
                              {step.step_number}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-text-secondary">{step.action}</p>
                              {step.copy_value && (
                                <div className="mt-1 flex items-center gap-2">
                                  <code className="text-xs bg-bg-tertiary text-text-primary px-2 py-1 rounded font-mono break-all flex-1">
                                    {step.copy_value}
                                  </code>
                                  <button
                                    onClick={() => import("@shared/hooks/useClipboard").then(({ copyToClipboard }) => copyToClipboard(step.copy_value!))}
                                    className="shrink-0 p-1 text-text-tertiary hover:text-text-primary transition-colors"
                                    title="Copy value"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
