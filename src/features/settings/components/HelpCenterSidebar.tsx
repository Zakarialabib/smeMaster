import { useMemo, useEffect, useState, useCallback } from "react";
import { Search, BookOpen, ExternalLink, EyeOff, Pin, PinOff, HelpCircle, Lightbulb, Clock } from "lucide-react";
import { getContextualHelp } from "@/constants/contextualHelp";
import type { ContextualHelpEntry } from "@/constants/contextualHelp";
import { useContextualHelp } from "@shared/hooks/useContextualHelp";
import { SlidePanel } from "@shared/components/ui/SlidePanel";
import { TAB_HELP_KEYS, EDUCATION_CONTENT } from "./SettingsTabRegistry";
import type { EducationItem } from "./SettingsTabRegistry";
import { cn } from "@shared/utils/cn";

/* ─── Props ─── */

interface HelpCenterSidebarProps {
  /** Current settings tab ID — used to filter relevant help articles */
  currentTab?: string;
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
}

/**
 * Education icon mapping for Why/How/When display.
 */
const eduIcons: Record<string, typeof HelpCircle> = {
  why: HelpCircle,
  how: Lightbulb,
  when: Clock,
};

const eduColors: Record<string, string> = {
  why: "text-warning bg-warning/15",
  how: "text-accent bg-accent/15",
  when: "text-success bg-success/15",
};

const eduLabels: Record<string, string> = {
  why: "Why",
  how: "How",
  when: "When",
};

/**
 * HelpCenterSidebar — Contextual help sidebar for settings.
 *
 * Shows two sections:
 * 1. Quick Education (Why/How/When) — consolidated inline
 * 2. Help Articles — from the contextual help system
 *
 * Features:
 * - Pin/dock to keep sidebar open across tab switches
 * - Contextual filtering based on active tab
 * - Seen/dismissed tracking per article
 * - Link to full Help Center
 */
export function HelpCenterSidebar({ currentTab = "general", isOpen, onClose }: HelpCenterSidebarProps) {
  const { dismissedKeys, unseenKeys, dismissKey, markSeen } = useContextualHelp();
  const [pinned, setPinned] = useState(false);

  // Get education content for this tab
  const educationItems = useMemo<EducationItem[]>(() => {
    return EDUCATION_CONTENT[currentTab] ?? [];
  }, [currentTab]);

  // Get article help entries for this tab
  const helpEntries = useMemo(() => {
    const relevantHelpKeys = TAB_HELP_KEYS[currentTab] ?? [];

    return relevantHelpKeys
      .filter((key) => !dismissedKeys.has(key))
      .map((key) => {
        const entry = getContextualHelp(key);
        return entry ? { key, ...entry } : null;
      })
      .filter(Boolean) as Array<{ key: string } & ContextualHelpEntry>;
  }, [currentTab, dismissedKeys]);

  // Mark currently visible entries as seen whenever the sidebar opens
  useEffect(() => {
    if (isOpen && helpEntries.length > 0) {
      helpEntries.forEach((entry) => markSeen(entry.key));
    }
  }, [isOpen, helpEntries, markSeen]);

  const handleDismiss = useCallback((key: string) => {
    dismissKey(key);
  }, [dismissKey]);

  const hasContent = educationItems.length > 0 || helpEntries.length > 0;

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={pinned ? "Help & Info (pinned)" : "Help & Info"}
      headerIcon={<BookOpen size={16} className="text-accent" />}
      headerChildren={
        <button
          onClick={() => setPinned((prev) => !prev)}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            pinned
              ? "text-accent bg-accent/10"
              : "text-text-tertiary hover:text-text-primary hover:bg-bg-hover",
          )}
          title={pinned ? "Unpin sidebar" : "Pin sidebar (keep open)"}
          aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
        >
          {pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
      }
    >
      {!hasContent ? (
        <div className="text-center py-8">
          <Search size={24} className="mx-auto text-text-tertiary mb-2" />
          <p className="text-xs text-text-tertiary">
            No help available for this section.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Section 1: Quick Education (Why/How/When) ──────────── */}
          {educationItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <Lightbulb size={13} className="text-accent" />
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-[0.05em]">
                  Quick Help
                </h3>
              </div>
              <div className="space-y-3">
                {educationItems.map((item, idx) => {
                  const Icon = eduIcons[item.type] ?? HelpCircle;
                  const colorClass = eduColors[item.type] ?? "text-text-tertiary";
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-accent/5 border border-accent/10"
                    >
                      <div
                        className={cn(
                          "w-[22px] h-[22px] rounded flex items-center justify-center shrink-0 mt-0.5",
                          colorClass,
                        )}
                      >
                        <Icon size={13} />
                      </div>
                      <div className="min-w-0">
                        <span className={cn(
                          "text-[10px] font-semibold uppercase tracking-[0.04em]",
                          item.type === "why" ? "text-warning" : item.type === "how" ? "text-accent" : "text-success",
                        )}>
                          {eduLabels[item.type] ?? item.type}
                        </span>
                        <p className="text-xs text-text-secondary leading-relaxed mt-0.5">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Section 2: Help Articles ──────────────────────────── */}
          {helpEntries.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <BookOpen size={13} className="text-accent" />
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-[0.05em]">
                  Articles
                </h3>
              </div>
              <div className="space-y-4">
                {helpEntries.map((entry) => {
                  const isUnseen = unseenKeys.includes(entry.key);

                  return (
                    <article key={entry.key} className="help-article rounded-lg border border-border-primary/40 p-3">
                      {/* Title with unseen dot indicator */}
                      <div className="flex items-start gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-text-primary leading-snug">
                          {entry.key
                            .split("-")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ")}
                        </h4>
                        {isUnseen && (
                          <span
                            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                            aria-label="New article"
                          />
                        )}
                      </div>

                      <p className="text-xs text-text-secondary leading-relaxed mb-3">
                        {entry.description}
                      </p>

                      {/* Tips */}
                      {entry.tips && entry.tips.length > 0 && (
                        <div className="mb-3">
                          <span className="text-[0.625rem] font-semibold text-accent uppercase tracking-wider">
                            Tips
                          </span>
                          <ul className="mt-1.5 space-y-1">
                            {entry.tips.map((tip, idx) => (
                              <li key={idx} className="flex items-start gap-1.5 text-xs text-text-tertiary">
                                <span className="text-accent mt-0.5 shrink-0">•</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Summary */}
                      {entry.summary && (
                        <p className="text-[0.625rem] text-text-tertiary italic leading-relaxed border-t border-border-primary/20 pt-2">
                          {entry.summary}
                        </p>
                      )}

                      {/* Actions row */}
                      <div className="flex items-center gap-3 mt-2">
                        {entry.learnMoreHref && (
                          <a
                            href={entry.learnMoreHref}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors font-medium"
                            onClick={(e) => {
                              e.preventDefault();
                              const topic = entry.learnMoreHref?.replace("/help/", "") ?? "getting-started";
                              window.dispatchEvent(
                                new CustomEvent("smemaster-navigate-help", { detail: { topic } })
                              );
                            }}
                          >
                            <ExternalLink size={12} />
                            Learn more
                          </a>
                        )}

                        <button
                          onClick={() => handleDismiss(entry.key)}
                          className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors ms-auto"
                          aria-label={`Dismiss ${entry.key}`}
                        >
                          <EyeOff size={12} />
                          Dismiss
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Footer link */}
          <div className="border-t border-border-primary/30 pt-4 mt-2">
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("smemaster-navigate-help", { detail: { topic: "getting-started" } })
                );
              }}
              className="flex items-center gap-2 text-xs text-text-tertiary hover:text-accent transition-colors w-full"
            >
              <BookOpen size={14} />
              Browse full Help Center
            </button>
          </div>
        </div>
      )}
    </SlidePanel>
  );
}
