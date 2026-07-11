/**
 * AiTaskExtractDialog - Extract tasks from email messages or review AI suggestions.
 *
 * Supports two usage modes:
 * 1. Thread-based: `threadId` + `messages` + `onClose` — extracts tasks from thread messages
 * 2. Suggestion-based: `suggestions` + `onAccept`/`onReject`/`onEdit` — review AI-suggested tasks
 *
 * @spec §3.9
 */
import { useState, useMemo, useCallback } from "react";
import { Sparkles, X, Edit3, Check, Trash2 } from "lucide-react";
import type { DbMessage } from "@shared/services/db/messages";
import type { TaskPriority } from "@features/tasks/db/tasks";
import { Modal } from "@shared/components/ui/Modal";
import { EmptyState } from "@shared/components/ui/EmptyState";
import type { AiTaskSuggestion } from "@features/tasks/stores/taskStore";

/**
 * Priority labels for display
 */
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

/**
 * Confidence level helper
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return "text-success";
  if (confidence >= 0.7) return "text-warning";
  return "text-text-tertiary";
}

/**
 * Format confidence as percentage
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Extracted task from a single message (legacy mode)
 */
interface ExtractedTask {
  title: string;
  priority: TaskPriority;
  dueDate: number | null;
}

/**
 * Props for AiTaskExtractDialog.
 *
 * Two modes:
 * - Thread mode: pass `threadId`, `accountId`, `messages`
 * - Suggestion mode: pass `suggestions`, `onAccept`, `onReject`, `onEdit`
 */
export interface AiTaskExtractDialogProps {
  /** Thread ID (required for thread mode) */
  threadId?: string;
  /** Account ID for DB operations */
  accountId?: string;
  /** Messages to extract tasks from (thread mode) */
  messages?: DbMessage[];
  /** Close handler */
  onClose: () => void;
  /** Suggestion list (suggestion mode) */
  suggestions?: AiTaskSuggestion[];
  /** Accept all/selected suggestions handler (suggestion mode) */
  onAccept?: (suggestions: AiTaskSuggestion[]) => void;
  /** Reject a single suggestion handler (suggestion mode) */
  onReject?: (suggestionId: string) => void;
  /** Edit a suggestion title handler (suggestion mode) */
  onEdit?: (suggestionId: string, newTitle: string) => void;
}

/**
 * AiTaskExtractDialog - Dialog for extracting tasks from emails or reviewing AI suggestions.
 *
 * @spec §3.9
 */
export function AiTaskExtractDialog({
  threadId,
  accountId: _accountId,
  messages = [],
  onClose,
  suggestions: externalSuggestions,
  onAccept,
  onReject,
  onEdit: onExternalEdit,
}: AiTaskExtractDialogProps) {
  const isSuggestionMode = !!externalSuggestions && externalSuggestions.length > 0;

  // For thread mode: extract tasks from messages
  const extractedTasks = useMemo<ExtractedTask[]>(() => {
    if (!threadId || !messages.length) return [];
    return messages
      .filter((msg) => msg.body_text || msg.body_html)
      .slice(0, 10) // Limit to 10 messages
      .map((msg) => {
        // Simple extraction: use subject as task title
        const title = msg.subject?.trim() ?? "Untitled task";
        return {
          title: title.length > 100 ? `${title.slice(0, 97)}...` : title,
          priority: "medium" as TaskPriority,
          dueDate: null,
        };
      });
  }, [threadId, messages]);

  // For suggestion mode: track local editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [localSuggestions, setLocalSuggestions] = useState<AiTaskSuggestion[]>(() =>
    externalSuggestions ?? [],
  );
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

  // Sync external suggestions
  const displaySuggestions = externalSuggestions ?? localSuggestions;

  const handleEditStart = useCallback(
    (id: string, currentTitle: string) => {
      setEditingId(id);
      setEditText(currentTitle);
    },
    [],
  );

  const handleEditSave = useCallback(
    (id: string) => {
      if (onExternalEdit) {
        onExternalEdit(id, editText);
      } else {
        setLocalSuggestions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, title: editText } : s)),
        );
      }
      setEditingId(null);
      setEditText("");
    },
    [editText, onExternalEdit],
  );

  const handleReject = useCallback(
    (id: string) => {
      if (onReject) {
        onReject(id);
      } else {
        setLocalSuggestions((prev) => prev.filter((s) => s.id !== id));
      }
    },
    [onReject],
  );

  const handleToggleAccept = useCallback((id: string) => {
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleAcceptAll = useCallback(() => {
    const accepted = displaySuggestions.filter((s) => acceptedIds.has(s.id) || !onReject);
    if (onAccept) {
      onAccept(accepted.length > 0 ? accepted : displaySuggestions);
    }
    onClose();
  }, [displaySuggestions, acceptedIds, onAccept, onClose, onReject]);

  const allAccepted = displaySuggestions.every((s) => acceptedIds.has(s.id));
  const someAccepted = displaySuggestions.some((s) => acceptedIds.has(s.id));

  // Thread mode content
  if (!isSuggestionMode && threadId) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Extract Tasks from Email" size="md">
        <div className="p-4 space-y-3">
          <p className="text-xs text-text-secondary">
            Suggested tasks extracted from this email thread:
          </p>

{extractedTasks.length === 0 ? (
             <EmptyState
               icon={Sparkles}
               title="No tasks detected"
               subtitle="Could not find actionable tasks in this thread"
             />
           ) : (
            <div className="space-y-2">
              {extractedTasks.map((task, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border-primary bg-bg-secondary"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary font-medium truncate">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[0.6875rem] text-text-tertiary">
                        Priority: {PRIORITY_LABELS[task.priority] ?? task.priority}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-primary">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary rounded-md hover:bg-bg-hover transition-colors"
            >
              Cancel
            </button>
            {extractedTasks.length > 0 && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
              >
                Add as Tasks
              </button>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  // Suggestion mode content
  return (
    <Modal isOpen={true} onClose={onClose} title="Review AI Task Suggestions" size="lg">
      <div className="p-4 space-y-4">
        <p className="text-xs text-text-secondary">
          AI detected {displaySuggestions.length} task
          {displaySuggestions.length !== 1 ? "s" : ""} in your recent emails. Review and accept
          the ones you want to add.
        </p>

{displaySuggestions.length === 0 ? (
           <EmptyState
             icon={Sparkles}
             title="No suggestions remaining"
             subtitle="All suggestions have been reviewed"
           />
         ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {displaySuggestions.map((suggestion) => {
              const isEditing = editingId === suggestion.id;
              const isAccepted = acceptedIds.has(suggestion.id);

              return (
                <div
                  key={suggestion.id}
                  className={`
                    relative p-4 rounded-lg border transition-all
                    ${
                      isAccepted
                        ? "border-success/40 bg-success/5"
                        : "border-border-primary bg-bg-secondary"
                    }
                  `}
                >
                  {/* Checkbox + Title row */}
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleAccept(suggestion.id)}
                      className={`
                        mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                        ${
                          isAccepted
                            ? "bg-success border-success text-white"
                            : "border-text-tertiary hover:border-accent"
                        }
                      `}
                      aria-label={isAccepted ? "Deselect task" : "Select task"}
                    >
                      {isAccepted && <Check size={12} strokeWidth={3} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="flex-1 text-sm px-2 py-1 rounded border border-accent bg-bg-primary text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditSave(suggestion.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                          <button
                            onClick={() => handleEditSave(suggestion.id)}
                            className="p-1 text-success hover:bg-success/10 rounded"
                            aria-label="Save edit"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-text-tertiary hover:text-text-primary rounded"
                            aria-label="Cancel edit"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <p
                          className={`
                            text-sm font-medium truncate cursor-pointer hover:text-accent transition-colors
                            ${isAccepted ? "text-text-primary" : "text-text-primary"}
                            ${isAccepted ? "" : ""}
                          `}
                          onClick={() => handleEditStart(suggestion.id, suggestion.title)}
                          title="Click to edit"
                        >
                          {suggestion.title}
                        </p>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {suggestion.suggestedPriority && (
                          <span className="text-[0.6875rem] text-text-tertiary">
                            Priority: {PRIORITY_LABELS[suggestion.suggestedPriority]}
                          </span>
                        )}
                        {suggestion.suggestedDueDate && (
                          <span className="text-[0.6875rem] text-text-tertiary">
                            Due: {new Date(suggestion.suggestedDueDate * 1000).toLocaleDateString()}
                          </span>
                        )}
                        <span
                          className={`text-[0.6875rem] font-medium ${getConfidenceColor(suggestion.confidence)}`}
                        >
                          Confidence: {formatConfidence(suggestion.confidence)}
                        </span>
                      </div>

                      {/* Source email info */}
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[0.625rem] text-text-tertiary truncate">
                          From: {suggestion.sourceSender} — "{suggestion.sourceEmailSubject}"
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEditStart(suggestion.id, suggestion.title)}
                        className="p-1.5 text-text-tertiary hover:text-accent hover:bg-accent/10 rounded transition-colors"
                        aria-label="Edit task title"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleReject(suggestion.id)}
                        className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded transition-colors"
                        aria-label="Remove suggestion"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Accept / Reject all actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border-primary">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary rounded-md hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">
              {acceptedIds.size} of {displaySuggestions.length} selected
            </span>
            <button
              onClick={handleAcceptAll}
              disabled={displaySuggestions.length === 0}
              className={`
                px-4 py-2 text-xs font-medium rounded-md transition-colors
                ${
                  displaySuggestions.length === 0
                    ? "text-text-tertiary bg-bg-tertiary cursor-not-allowed"
                    : "text-white bg-accent hover:bg-accent-hover"
                }
              `}
            >
              Accept {allAccepted ? "All" : someAccepted ? "Selected" : "All"} (
              {someAccepted ? acceptedIds.size : displaySuggestions.length})
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

