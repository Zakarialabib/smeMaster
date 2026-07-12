/**
 * RagResultBubble — Chat bubble for a single user query + AI response pair.
 *
 * User bubble: right-aligned, accent-tinted glass surface.
 * AI response: left-aligned, base glass surface.
 * Uses Frosted Glass tokens for consistent design.
 *
 * @module
 */

import { useState } from "react";
import { User, Bot, ChevronDown } from "lucide-react";
import { cn } from "@shared/utils/cn";

// ── Props ───────────────────────────────────────────────────────────

export interface RagBubbleEntry {
  /** Unique entry id */
  id: string;
  /** The user's query */
  query: string;
  /** The retrieved RAG context chunks (shown as collapsible sources) */
  response: string;
  /** Optional LLM-generated natural-language answer (primary content) */
  answer?: string;
  /** Unix ms timestamp */
  timestamp: number;
}

export interface RagResultBubbleProps {
  entry: RagBubbleEntry;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export function RagResultBubble({ entry }: RagResultBubbleProps) {
  const [showSources, setShowSources] = useState(false);
  const primary = entry.answer ?? entry.response;
  const hasSources = !!entry.answer && !!entry.response;

  return (
    <div className="space-y-3 animate-[fadeIn_200ms_ease-out]">
      {/* User query bubble */}
      <div className="flex justify-end">
        <div
          className={cn(
            "max-w-[75%] sm:max-w-[65%]",
            "px-4 py-3",
            "bg-accent/10 dark:bg-accent/15",
            "backdrop-blur-[12px]",
            "border border-accent/20 dark:border-accent/25",
            "rounded-2xl rounded-br-md",
            "transition-all duration-200",
          )}
        >
          <div className="flex items-start gap-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap break-words">
                {entry.query}
              </p>
            </div>
            <User className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          </div>
          <p className="text-[10px] text-text-tertiary text-right mt-1.5">
            {formatTime(entry.timestamp)}
          </p>
        </div>
      </div>

      {/* AI response bubble */}
      <div className="flex justify-start">
        <div
          className={cn(
            "max-w-[85%] sm:max-w-[75%]",
            "px-4 py-3",
            "frost-surface",
            "rounded-2xl rounded-bl-md",
            "transition-all duration-200",
          )}
        >
          <div className="flex items-start gap-2.5">
            <Bot className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap break-words">
                {primary}
              </p>
            </div>
          </div>
          {hasSources && (
            <button
              type="button"
              onClick={() => setShowSources((v) => !v)}
              className="mt-2 flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-secondary"
            >
              <ChevronDown className={cn("w-3 h-3 transition-transform", showSources && "rotate-180")} />
              {showSources ? "Hide sources" : "Show sources"}
            </button>
          )}
          {hasSources && showSources && (
            <div className="mt-2 p-2 rounded-md bg-bg-tertiary/40 border border-border-primary text-[11px] text-text-tertiary whitespace-pre-wrap break-words">
              {entry.response}
            </div>
          )}
          <p className="text-[10px] text-text-tertiary mt-1.5">
            {formatTime(entry.timestamp)} · {entry.answer ? "AI answer" : "Augmented prompt"}
          </p>
        </div>
      </div>
    </div>
  );
}
