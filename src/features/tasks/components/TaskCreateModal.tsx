/**
 * TaskCreateModal – Rich task creation modal.
 *
 * Like Calendar's EventCreateModal, this supports creating tasks from
 * different sources:
 *   - manual   (standalone task)
 *   - from_email  (pre-filled from an email thread)
 *   - from_note   (pre-filled from a contact note)
 *
 * Features:
 *   - Title, description, due date + time, priority
 *   - Contact / company search-and-link
 *   - Tags input
 *   - Email thread link display (when source is "from_email")
 *   - Reminder toggle with presets
 *   - Every operation wrapped in try-catch with user-friendly error surfacing
 *   - Desktop-first layout
 *
 * @see EventCreateModal for the sibling pattern.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  X,
  ListTodo,
  Mail,
  FileText,
  Calendar,
  User,
  Search,
  Tag,
  Bell,
  AlertCircle,
  Clock,
  Loader2,
  Check,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormField } from "@shared/hooks/useFormField";
import { required } from "@shared/utils/validators";
import { Modal } from "@shared/components/ui/Modal";
import { Button } from "@shared/components/ui/Button";
import {
  INPUT_BASE,
  BTN_SECONDARY,
  FOCUS_RING,
  BADGE_BASE,
  BADGE_ACCENT,
} from "@shared/styles/ui-tokens";
import { safeDbOperation } from "../services/errorHandler";
import { notify } from "@shared/services/notifications/toastHelper";
import { insertTask, type TaskPriority } from "@features/tasks/db/tasks";
import { searchContacts, type DbContact } from "@features/contacts/db/contacts";

// ── Types ──

export type TaskSourceType = "manual" | "from_email" | "from_note";

export interface TaskCreatePrefill {
  title?: string;
  description?: string;
  dueDate?: number;
  contactId?: string;
  contactName?: string;
  threadId?: string;
  threadAccountId?: string;
  source?: TaskSourceType;
}

export interface TaskFormData {
  title: string;
  description: string;
  dueDate: number | null;
  priority: TaskPriority;
  contactId: string | null;
  tags: string[];
  threadId: string | null;
  threadAccountId: string | null;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  source: TaskSourceType;
}

export interface TaskCreateModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Called when the user closes the modal */
  onClose: () => void;
  /** Called when a task is successfully created — receives the new task ID */
  onCreated: (taskId: string) => void;
  /** Current account ID */
  accountId: string | null;
  /** Optional prefill data (e.g. from email thread or contact detail) */
  prefill?: TaskCreatePrefill;
}

// ── Constants ──

const SOURCE_TABS: { key: TaskSourceType; labelKey: string; icon: typeof ListTodo }[] = [
  { key: "manual", labelKey: "tasks.sourceManual", icon: ListTodo },
  { key: "from_email", labelKey: "tasks.sourceEmail", icon: Mail },
  { key: "from_note", labelKey: "tasks.sourceNote", icon: FileText },
];

const PRIORITY_OPTIONS: { value: TaskPriority; labelKey: string }[] = [
  { value: "none", labelKey: "tasks.priorityNone" },
  { value: "low", labelKey: "tasks.priorityLow" },
  { value: "medium", labelKey: "tasks.priorityMedium" },
  { value: "high", labelKey: "tasks.priorityHigh" },
  { value: "urgent", labelKey: "tasks.priorityUrgent" },
];

const REMINDER_PRESETS: { label: string; minutes: number }[] = [
  { label: "None", minutes: 0 },
  { label: "15 min before", minutes: 15 },
  { label: "1 hour before", minutes: 60 },
  { label: "3 hours before", minutes: 180 },
  { label: "1 day before", minutes: 1440 },
  { label: "2 days before", minutes: 2880 },
];

// ── Helpers ──

/** Get an ISO date string for "now" rounded to the next hour (for default due date). */
function getDefaultDueDate(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return toLocalISOString(now);
}

function toLocalISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromTimestampToLocalISO(ts: number): string {
  return toLocalISOString(new Date(ts * 1000));
}

// ── Component ──

export function TaskCreateModal({
  isOpen,
  onClose,
  onCreated,
  accountId,
  prefill,
}: TaskCreateModalProps) {
  const { t } = useTranslation();

  // ── Source type ──
  const [sourceType, setSourceType] = useState<TaskSourceType>(
    prefill?.source ?? "manual",
  );

  // ── Form fields ──
  const titleField = useFormField({ validator: required, initialValue: prefill?.title ?? "" });
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [dueDate, setDueDate] = useState(
    prefill?.dueDate ? fromTimestampToLocalISO(prefill.dueDate) : getDefaultDueDate(),
  );
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [tagsInput, setTagsInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // ── Contact picker ──
  const [contactId, setContactId] = useState<string | null>(prefill?.contactId ?? null);
  const [contactName, setContactName] = useState<string | null>(prefill?.contactName ?? null);
  const [showContactSearch, setShowContactSearch] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<DbContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const contactSearchRef = useRef<HTMLInputElement>(null);

  // ── Reminder ──
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderPreset, setReminderPreset] = useState(0); // index

  // ── Submission ──
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Thread info (from prefill) ──
  const threadId = prefill?.threadId ?? null;
  const threadAccountId = prefill?.threadAccountId ?? null;

  // ── Update source type when prefill changes ──
  useEffect(() => {
    if (prefill?.source) {
      setSourceType(prefill.source);
    }
    if (prefill?.title !== undefined) titleField.onChange(prefill.title);
    if (prefill?.description !== undefined) setDescription(prefill.description);
    if (prefill?.dueDate) setDueDate(fromTimestampToLocalISO(prefill.dueDate));
    if (prefill?.contactId) setContactId(prefill.contactId);
    if (prefill?.contactName) setContactName(prefill.contactName);
  }, [prefill]);

  // ── Focus contact search input when opened ──
  useEffect(() => {
    if (showContactSearch) {
      setTimeout(() => contactSearchRef.current?.focus(), 50);
    }
  }, [showContactSearch]);

  // ── Contact search debounce ──
  useEffect(() => {
    if (!showContactSearch || !contactQuery.trim()) {
      setContactResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setContactsLoading(true);
      try {
        const results = await searchContacts(contactQuery.trim(), 20);
        if (!cancelled) setContactResults(results);
      } catch {
        // silently ignore search errors
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showContactSearch, contactQuery]);

  // ── Tag management ──
  const handleAddTag = useCallback(() => {
    const trimmed = tagsInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
      setTagsInput("");
    }
  }, [tagsInput, tags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
      if (e.key === "Backspace" && !tagsInput && tags.length > 0) {
        setTags((prev) => prev.slice(0, -1));
      }
    },
    [handleAddTag, tagsInput, tags],
  );

  // ── Contact selection ──
  const handleSelectContact = useCallback((contact: DbContact) => {
    setContactId(contact.id);
    setContactName(contact.display_name ?? contact.email);
    setShowContactSearch(false);
    setContactQuery("");
  }, []);

  const handleRemoveContact = useCallback(() => {
    setContactId(null);
    setContactName(null);
  }, []);

  // ── Submit ──
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Surface validation on the title field, then bail if empty.
      titleField.onBlur();
      if (!titleField.value.trim()) {
        return;
      }

      if (!accountId) {
        setSubmitError("No active account selected.");
        return;
      }

      setSubmitting(true);
      setSubmitError(null);

      // Parse due date
      let dueTimestamp: number | null = null;
      if (dueDate) {
        try {
          dueTimestamp = Math.floor(new Date(dueDate).getTime() / 1000);
          if (isNaN(dueTimestamp)) dueTimestamp = null;
        } catch {
          dueTimestamp = null;
        }
      }

      // Build reminder config
      const reminderConfigJson =
        reminderEnabled && reminderPreset > 0
          ? JSON.stringify({
              enabled: true,
              offsetValue: REMINDER_PRESETS[reminderPreset]!.minutes,
              offsetUnit: "minutes",
              notificationType: "os",
            })
          : null;

      const result = await safeDbOperation(
        () =>
          insertTask({
            accountId,
            title: titleField.value.trim(),
            description: description.trim() || null,
            priority,
            dueDate: dueTimestamp,
            contactId,
            threadId,
            threadAccountId,
            tagsJson: JSON.stringify(tags),
            reminderConfigJson,
          }),
        { operationLabel: "create task" },
      );

      setSubmitting(false);

      if (result.success) {
        notify(
          "Task created",
          `"${titleField.value.trim()}" has been added.`,
        );
        onCreated(result.data);
        onClose();
      } else {
        setSubmitError(result.error);
      }
    },
    [
      titleField,
      description,
      dueDate,
      priority,
      contactId,
      threadId,
      threadAccountId,
      tags,
      reminderEnabled,
      reminderPreset,
      accountId,
      onCreated,
      onClose,
    ],
  );

  // ── Reset form when modal opens/closes ──
  const handleClose = useCallback(() => {
    setSubmitError(null);
    setSubmitting(false);
    setShowContactSearch(false);
    onClose();
  }, [onClose]);

  // ── Source type tab label ──
  const sourceTabLabel = (key: TaskSourceType): string => {
    switch (key) {
      case "manual": return "Task";
      case "from_email": return "From email";
      case "from_note": return "From note";
    }
  };

  // ── Render ──
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create task" size="md">
      {/* ── Source type selector ── */}
      <div className="px-4 pt-4">
        <div className="flex bg-bg-tertiary rounded-lg p-1 mb-4">
          {SOURCE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = sourceType === tab.key;
            const isDisabled =
              (tab.key === "from_email" && !prefill?.threadId) ||
              (tab.key === "from_note" && !prefill?.title);
            return (
              <button
                key={tab.key}
                type="button"
                disabled={isDisabled}
                onClick={() => setSourceType(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                  isSelected
                    ? "bg-bg-primary text-text-primary shadow-sm"
                    : isDisabled
                      ? "text-text-tertiary/40 cursor-not-allowed"
                      : "text-text-tertiary hover:text-text-secondary"
                }`}
                title={
                  isDisabled && tab.key === "from_email"
                    ? "No email thread linked"
                    : isDisabled && tab.key === "from_note"
                      ? "No note content to convert"
                      : sourceTabLabel(tab.key)
                }
              >
                <Icon size={14} />
                {sourceTabLabel(tab.key)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Source context banner ── */}
      {(sourceType === "from_email" && threadId) && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-md bg-accent/5 border border-accent/15 text-xs text-text-secondary flex items-center gap-2">
          <Mail size={12} className="text-accent shrink-0" />
          <span>Linked to email thread</span>
        </div>
      )}
      {(sourceType === "from_note" && prefill?.title) && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-md bg-amber-500/5 border border-amber-500/15 text-xs text-text-secondary flex items-center gap-2">
          <FileText size={12} className="text-amber-500 shrink-0" />
          <span>Converted from note</span>
        </div>
      )}

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3">
        {/* Title */}
        <div>
          <label className="text-xs text-text-secondary block mb-1">
            Title <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={titleField.value}
            onChange={(e) => titleField.onChange(e.target.value)}
            onBlur={titleField.onBlur}
            placeholder="What needs to be done?"
            className={INPUT_BASE}
            autoFocus
            aria-required="true"
          />
          {titleField.error && (
            <p className="text-xs text-danger mt-1" role="alert">
              {t(titleField.error)}
            </p>
          )}
        </div>

        {/* Due date + Priority row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-secondary block mb-1">
              <Calendar size={11} className="inline mr-1" />
              Due date
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={INPUT_BASE}
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">
              <AlertCircle size={11} className="inline mr-1" />
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className={INPUT_BASE}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.labelKey.replace("tasks.priority", "")}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-text-secondary block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, context, or notes..."
            rows={3}
            className={`${INPUT_BASE} resize-none min-h-[64px]`}
          />
        </div>

        {/* Contact picker */}
        <div>
          <label className="text-xs text-text-secondary block mb-1">
            <User size={11} className="inline mr-1" />
            Linked contact / company
          </label>
          {contactId && contactName ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0 p-2 rounded-lg border border-border-primary bg-bg-tertiary/50">
                <span className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[0.625rem] font-semibold shrink-0">
                  {contactName.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm text-text-primary truncate">{contactName}</span>
              </div>
              <button
                type="button"
                onClick={handleRemoveContact}
                className="p-1.5 text-text-tertiary hover:text-danger transition-colors rounded-md hover:bg-bg-hover"
                aria-label="Remove contact"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowContactSearch(true)}
              className={`${BTN_SECONDARY} inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md`}
            >
              <Search size={12} />
              Link contact
            </button>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs text-text-secondary block mb-1">
            <Tag size={11} className="inline mr-1" />
            Tags
          </label>
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className={`${BADGE_BASE} ${BADGE_ACCENT} gap-1`}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-danger transition-colors"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Add a tag and press Enter"
              className={`${INPUT_BASE} flex-1`}
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!tagsInput.trim()}
              className={`${BTN_SECONDARY} px-2.5 py-1.5 text-xs rounded-md disabled:opacity-40`}
            >
              Add
            </button>
          </div>
        </div>

        {/* Reminder */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-text-secondary">
              <Bell size={11} className="inline mr-1" />
              Reminder
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <span className="text-xs text-text-tertiary">Enable</span>
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className={`${FOCUS_RING} rounded border-border-primary`}
              />
            </label>
          </div>
          {reminderEnabled && (
            <div className="flex items-center gap-2">
              <Clock size={11} className="text-text-tertiary shrink-0" />
              <select
                value={reminderPreset}
                onChange={(e) => setReminderPreset(Number(e.target.value))}
                className={`${INPUT_BASE} flex-1`}
              >
                {REMINDER_PRESETS.map((preset, idx) => (
                  <option key={idx} value={idx}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Error display */}
        {submitError && (
          <div
            className="px-3 py-2 rounded-md bg-danger/10 border border-danger/20 text-xs text-danger flex items-start gap-2"
            role="alert"
          >
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border-primary">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!titleField.value.trim() || submitting || !accountId}
          >
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" />
                Creating...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Check size={13} />
                Create task
              </span>
            )}
          </Button>
        </div>
      </form>

      {/* ── Contact search overlay ── */}
      {showContactSearch && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => { setShowContactSearch(false); setContactQuery(""); }}
          />
          <div className="relative w-full max-w-sm mx-4 bg-bg-primary border border-border-primary rounded-xl shadow-2xl overflow-hidden animate-[fadeIn_150ms_ease-out]">
            <div className="p-3 border-b border-border-primary">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  ref={contactSearchRef}
                  type="text"
                  value={contactQuery}
                  onChange={(e) => setContactQuery(e.target.value)}
                  placeholder="Search contacts..."
                  className={`${INPUT_BASE} pl-8`}
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="text-text-tertiary animate-spin" />
                </div>
              ) : contactQuery.trim() && contactResults.length === 0 ? (
                <p className="text-xs text-text-tertiary text-center py-8">No contacts found</p>
              ) : (
                <div className="space-y-0.5">
                  {contactResults.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => handleSelectContact(contact)}
                      className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-bg-hover transition-colors text-left"
                    >
                      <span className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-semibold shrink-0">
                        {(contact.display_name ?? contact.email).charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary truncate">
                          {contact.display_name ?? contact.email}
                        </p>
                        {contact.display_name && (
                          <p className="text-xs text-text-tertiary truncate">{contact.email}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
