/**
 * RagEmptyState — Empty state for the AI Assistant when no queries have been made.
 *
 * Shows a frost-surface card with a Bot illustration and helpful text.
 *
 * @module
 */

import { Bot, MessageCircle } from "lucide-react";
import { cn } from "@shared/utils/cn";
import { EMPTY_STATE } from "@shared/styles/ui-tokens";

export function RagEmptyState() {
  return (
    <div className={cn(EMPTY_STATE, "py-16")}>
      <div
        className={cn(
          "w-20 h-20 rounded-full",
          "frost-surface",
          "flex items-center justify-center mb-6",
        )}
      >
        <Bot className="w-10 h-10 text-accent" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        AI Knowledge Assistant
      </h3>
      <p className="text-sm text-text-tertiary text-center max-w-md leading-relaxed mb-6">
        Ask anything about your data — search across emails, attachments, and vault
        documents using local semantic search. All processing stays on your device.
      </p>
      <div className="space-y-2 text-sm text-text-tertiary">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-text-quaternary" />
          <span>"Summarize last week's project updates"</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-text-quaternary" />
          <span>"Find the Q3 financial report attachment"</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-text-quaternary" />
          <span>"Show me emails about the client proposal"</span>
        </div>
      </div>
    </div>
  );
}
