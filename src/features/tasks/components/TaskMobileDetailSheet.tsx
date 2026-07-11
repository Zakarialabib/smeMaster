/**
 * TaskMobileDetailSheet - Bottom sheet (80vh) for viewing/editing task details on mobile.
 *
 * Sections: Header (title + edit), Meta (priority/due date/tags), Description,
 * Subtasks, Context (contact + email thread), Actions (delete/duplicate).
 *
 * @spec §4.3
 */
import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Tag,
  User,
  MessageSquare,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import type { DbTask, TaskPriority } from "@features/tasks/db/tasks";
import { SlidePanel } from "@shared/components/ui/SlidePanel";

/**
 * Priority labels
 */
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-amber-500",
  low: "text-blue-400",
  none: "text-text-tertiary",
};

const PRIORITY_BG: Record<TaskPriority, string> = {
  urgent: "bg-red-500/10",
  high: "bg-orange-500/10",
  medium: "bg-amber-500/10",
  low: "bg-blue-400/10",
  none: "bg-bg-tertiary",
};

/**
 * Props for TaskMobileDetailSheet component.
 */
export interface TaskMobileDetailSheetProps {
  /** Task ID to display */
  taskId: string;
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Handler for closing the sheet */
  onClose: () => void;
  /** Handler for when task is updated */
  onTaskUpdated: () => void;
  /** Task data (if already loaded) */
  task?: DbTask | null;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: string | null;
  /** Handler for saving task updates */
  onSave?: (id: string, updates: Partial<DbTask>) => Promise<void>;
  /** Handler for deleting a task */
  onDelete?: (id: string) => void;
  /** Handler for duplicating a task */
  onDuplicate?: (id: string) => void;
}

/**
 * TaskMobileDetailSheet - Mobile bottom sheet for task detail.
 *
 * Features:
 * - Bottom-sheet on mobile / right panel on desktop (auto via SlidePanel)
 * - Editable title inline
 * - Meta section: priority, due date, tags
 * - Description section (read-only or editable)
 * - Subtasks section with progress
 * - Context section: linked contact, email thread
 * - Actions: delete, duplicate
 * - Loading and error states
 *
 * @spec §4.3
 */
export function TaskMobileDetailSheet({
  taskId,
  isOpen,
  onClose,
  onTaskUpdated: _onTaskUpdated,
  task: externalTask,
  isLoading = false,
  error = null,
  onSave,
  onDelete,
  onDuplicate,
}: TaskMobileDetailSheetProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["meta", "description"]));
  const [localTitle, setLocalTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Sync local title with external task
  useEffect(() => {
    if (externalTask) {
      setLocalTitle(externalTask.title);
    }
  }, [externalTask]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const handleSaveTitle = useCallback(async () => {
    if (!onSave || !externalTask || localTitle === externalTask.title) {
      setIsEditingTitle(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onSave(taskId, { title: localTitle });
      setIsEditingTitle(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [onSave, externalTask, localTitle, taskId]);

  const handleDelete = useCallback(() => {
    onDelete?.(taskId);
    onClose();
  }, [onDelete, taskId, onClose]);

  const handleDuplicate = useCallback(() => {
    onDuplicate?.(taskId);
  }, [onDuplicate, taskId]);

  // Tags from tags_json
  const tags: string[] = (() => {
    if (!externalTask?.tags_json) return [];
    try {
      return JSON.parse(externalTask.tags_json) as string[];
    } catch {
      return [];
    }
  })();

  const isExpanded = (section: string) => expandedSections.has(section);

  return (
    <SlidePanel isOpen={isOpen} onClose={onClose} title="Task details">
      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="text-accent animate-spin" />
            <span className="text-sm text-text-secondary">Loading task...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <AlertCircle size={24} className="text-danger" />
            <span className="text-sm text-text-secondary">{error}</span>
            <button
              onClick={onClose}
              className="text-xs text-accent hover:underline"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && externalTask && (
        <div className="flex-1 overflow-y-auto pb-4">
          {/* Title row */}
          <div className="flex items-start gap-3 pt-2 pb-3">
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={localTitle}
                    onChange={(e) => setLocalTitle(e.target.value)}
                    className="flex-1 text-lg font-semibold bg-bg-tertiary text-text-primary px-3 py-1.5 rounded-lg border border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") {
                        setLocalTitle(externalTask.title);
                        setIsEditingTitle(false);
                      }
                    }}
                  />
                  <button
                    onClick={handleSaveTitle}
                    disabled={saving}
                    className="p-2 text-accent hover:bg-accent/10 rounded-lg transition-colors disabled:opacity-50"
                    aria-label="Save title"
                  >
                    {saving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2
                    className="text-lg font-semibold text-text-primary truncate flex-1"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    {externalTask.title}
                  </h2>
                  <button
                    onClick={() => {
                      setLocalTitle(externalTask.title);
                      setIsEditingTitle(true);
                    }}
                    className="p-1.5 text-text-tertiary hover:text-accent hover:bg-accent/10 rounded-lg transition-colors shrink-0"
                    aria-label="Edit title"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Close button (in title row) */}
            <button
              onClick={onClose}
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Save error */}
          {saveError && (
            <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-danger/10 border border-danger/20 rounded-lg">
              <AlertCircle size={14} className="text-danger shrink-0" />
              <span className="text-xs text-danger">{saveError}</span>
            </div>
          )}

          {/* Meta section: Priority + Due Date + Tags */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection("meta")}
              className="flex items-center gap-2 w-full text-left"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary flex-1">
                Details
              </span>
              {isExpanded("meta") ? (
                <ChevronUp size={14} className="text-text-tertiary" />
              ) : (
                <ChevronDown size={14} className="text-text-tertiary" />
              )}
            </button>

            {isExpanded("meta") && (
              <div className="flex flex-wrap gap-2 mt-2">
                {/* Priority badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    PRIORITY_COLORS[externalTask.priority as TaskPriority] || "text-text-tertiary"
                  } ${PRIORITY_BG[externalTask.priority as TaskPriority] || "bg-bg-tertiary"}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      externalTask.priority === "urgent"
                        ? "bg-red-500"
                        : externalTask.priority === "high"
                          ? "bg-orange-500"
                          : externalTask.priority === "medium"
                            ? "bg-amber-500"
                            : externalTask.priority === "low"
                              ? "bg-blue-400"
                              : "bg-text-tertiary/30"
                    }`}
                  />
                  {PRIORITY_LABELS[externalTask.priority as TaskPriority] || "None"}
                </span>

                {/* Due date */}
                {externalTask.due_date && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bg-tertiary text-text-secondary">
                    <Calendar size={12} />
                    {new Date(externalTask.due_date * 1000).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}

                {/* Tags */}
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent"
                  >
                    <Tag size={10} />
                    {tag}
                  </span>
                ))}

                {/* Recurrence */}
                {externalTask.recurrence_rule && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-bg-tertiary text-text-tertiary">
                    ↻ Recurring
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Description section */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection("description")}
              className="flex items-center gap-2 w-full text-left"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary flex-1">
                Description
              </span>
              {isExpanded("description") ? (
                <ChevronUp size={14} className="text-text-tertiary" />
              ) : (
                <ChevronDown size={14} className="text-text-tertiary" />
              )}
            </button>

            {isExpanded("description") && (
              <div className="mt-2">
                {externalTask.description ? (
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {externalTask.description}
                  </p>
                ) : (
                  <p className="text-sm text-text-tertiary italic">No description</p>
                )}
              </div>
            )}
          </div>

          {/* Subtasks section */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection("subtasks")}
              className="flex items-center gap-2 w-full text-left"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary flex-1">
                Subtasks
              </span>
              {isExpanded("subtasks") ? (
                <ChevronUp size={14} className="text-text-tertiary" />
              ) : (
                <ChevronDown size={14} className="text-text-tertiary" />
              )}
            </button>

            {isExpanded("subtasks") && (
              <div className="mt-2">
                <p className="text-sm text-text-tertiary italic">
                  Subtask management coming soon
                </p>
              </div>
            )}
          </div>

          {/* Context section */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection("context")}
              className="flex items-center gap-2 w-full text-left"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary flex-1">
                Context
              </span>
              {isExpanded("context") ? (
                <ChevronUp size={14} className="text-text-tertiary" />
              ) : (
                <ChevronDown size={14} className="text-text-tertiary" />
              )}
            </button>

            {isExpanded("context") && (
              <div className="mt-2 space-y-2">
                {/* Linked contact */}
                {externalTask.contact_id && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-secondary border border-border-primary">
                    <User size={14} className="text-accent shrink-0" />
                    <span className="text-sm text-text-secondary flex-1 truncate">
                      Linked to contact
                    </span>
                    <button className="text-xs text-accent hover:underline shrink-0">
                      Open
                    </button>
                  </div>
                )}

                {/* Thread context */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-secondary border border-border-primary">
                  <MessageSquare size={14} className="text-accent shrink-0" />
                  <span className="text-sm text-text-secondary flex-1 truncate">
                    {externalTask.thread_id
                      ? "From email thread"
                      : "No linked thread"}
                  </span>
                  {externalTask.thread_id && (
                    <button className="text-xs text-accent hover:underline shrink-0">
                      Open
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Created date */}
          <div className="mb-4 px-3">
            {externalTask.created_at && (
              <p className="text-[0.6875rem] text-text-tertiary">
                Created: {new Date(externalTask.created_at * 1000).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
            {externalTask.completed_at && (
              <p className="text-[0.6875rem] text-text-tertiary mt-0.5">
                Completed: {new Date(externalTask.completed_at * 1000).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-border-primary">
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger/10 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
            <button
              onClick={handleDuplicate}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
            >
              <Copy size={16} />
              <span>Duplicate</span>
            </button>
          </div>
        </div>
      )}

      {/* Empty state (no task data) */}
      {!isLoading && !error && !externalTask && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-text-tertiary">Task not found</p>
        </div>
      )}
    </SlidePanel>
  );
}

