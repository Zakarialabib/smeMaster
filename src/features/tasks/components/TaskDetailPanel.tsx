/**
 * TaskDetailPanel – slide-out panel (desktop) or modal (mobile) for editing
 * a task's full details including contact linking, workflow config, and reminders.
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Save, Trash2, User, Search, AlertCircle, RefreshCw } from "lucide-react";
import { Modal } from "@shared/components/ui/Modal";
import { usePlatform } from "@shared/hooks/usePlatform";
import { useNavigate } from "@tanstack/react-router";
import {
  getTaskById,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
  type DbTask,
  type TaskPriority,
} from "@features/tasks/db/tasks";
import { getContactById, searchContacts, type DbContact } from "@features/contacts/db/contacts";
import { getLinkedEntities, type EntityPivot } from "@shared/services/db/db-invoke";
import { getTemplatesForAccount, type DbTemplate } from "@features/mail/db/templates";
import { getCampaign } from "@features/campaigns/db/campaigns";
import { INPUT_BASE, BTN_DANGER, BTN_SECONDARY, BTN_PRIMARY, FOCUS_RING } from "@shared/styles/ui-tokens";
import type {
  WorkflowConfig,
  WorkflowTrigger,
  WorkflowActionType,
  WorkflowActionConfig,
  ReminderConfig,
  RemindBeforeUnit,
  ReminderNotificationType,
} from "../services/taskWorkflowEngine";

// ── Props ──

export interface TaskDetailPanelProps {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated: () => void;
  accountId: string | null;
}

// ── Reminder preset options ──

const REMINDER_PRESETS: { label: string; offsetValue: number; offsetUnit: RemindBeforeUnit }[] = [
  { label: "15 minutes before", offsetValue: 15, offsetUnit: "minutes" },
  { label: "1 hour before", offsetValue: 1, offsetUnit: "hours" },
  { label: "3 hours before", offsetValue: 3, offsetUnit: "hours" },
  { label: "1 day before", offsetValue: 1, offsetUnit: "days" },
  { label: "2 days before", offsetValue: 2, offsetUnit: "days" },
  { label: "Custom", offsetValue: 0, offsetUnit: "minutes" },
];

// ── Component ──

export function TaskDetailPanel({ taskId, onClose, onTaskUpdated }: TaskDetailPanelProps) {
  const { t } = useTranslation();
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;
  const navigate = useNavigate();

  // ── Loading states ──
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Task fields ──
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [dueDate, setDueDate] = useState<number | null>(null);

  // ── Contact ──
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string | null>(null);

  // ── Linked Entities ──
  const [linkedEntities, setLinkedEntities] = useState<EntityPivot[]>([]);
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});

  // ── Contact picker modal ──
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState<DbContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  // ── Workflow config ──
  const [workflowTrigger, setWorkflowTrigger] = useState<WorkflowTrigger>("none");
  const [workflowActions, setWorkflowActions] = useState<WorkflowActionConfig[]>([]);

  // ── Reminder config ──
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderPreset, setReminderPreset] = useState(1); // index into REMINDER_PRESETS
  const [reminderCustomValue, setReminderCustomValue] = useState(30);
  const [reminderCustomUnit, setReminderCustomUnit] = useState<RemindBeforeUnit>("minutes");
  const [reminderNotificationType, setReminderNotificationType] = useState<ReminderNotificationType>("os");

  // ── Templates for workflow ──
  const [templates, setTemplates] = useState<DbTemplate[]>([]);

  // ── Original task for diffing ──
  const [originalTask, setOriginalTask] = useState<DbTask | null>(null);

  // ── Load task data ──
  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const task = await getTaskById(taskId!);
        if (!task || cancelled) {
          if (!task) setError("Task not found");
          return;
        }
        setOriginalTask(task);
        setTitle(task.title);
        setDescription(task.description ?? "");
        setPriority(task.priority as TaskPriority);
        setDueDate(task.due_date);
        setContactId(task.contact_id);

        // Load linked contact
        if (task.contact_id) {
          const contact = await getContactById(task.contact_id);
          if (contact && !cancelled) {
            setContactName(contact.display_name ?? contact.email);
          }
        }

        // Load workflow config
        if (task.workflow_config_json) {
          try {
            const wf = JSON.parse(task.workflow_config_json) as WorkflowConfig;
            setWorkflowTrigger(wf.trigger);
            setWorkflowActions(wf.actions);
          } catch {
            // Invalid JSON – keep defaults
          }
        } else {
          setWorkflowTrigger("none");
          setWorkflowActions([]);
        }

        // Load reminder config
        if (task.reminder_config_json) {
          try {
            const rm = JSON.parse(task.reminder_config_json) as ReminderConfig;
            setReminderEnabled(rm.enabled);
            setReminderNotificationType(rm.notificationType);

            // Find matching preset
            const presetIdx = REMINDER_PRESETS.findIndex(
              (p) => p.offsetValue === rm.offsetValue && p.offsetUnit === rm.offsetUnit,
            );
            if (presetIdx >= 0) {
              setReminderPreset(presetIdx);
            } else {
              // Custom values
              setReminderPreset(REMINDER_PRESETS.length - 1); // "Custom"
              setReminderCustomValue(rm.offsetValue);
              setReminderCustomUnit(rm.offsetUnit);
            }
          } catch {
            setReminderEnabled(false);
          }
        } else {
          setReminderEnabled(false);
        }

        // Load linked entities (graph)
        if (taskId) {
          const links = await getLinkedEntities("task", taskId);
          if (!cancelled) setLinkedEntities(links);
        }

        // Load templates for workflow email action
        if (task.company_id) {
          const tmpls = await getTemplatesForAccount(task.company_id);
          if (!cancelled) setTemplates(tmpls);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load task");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [taskId]);

  // ── Resolve entity names for linked entities ──
  useEffect(() => {
    if (linkedEntities.length === 0) {
      setEntityNames({});
      return;
    }

    let cancelled = false;

    async function resolveNames() {
      const names: Record<string, string> = {};

      for (const link of linkedEntities) {
        try {
          let name: string | null = null;

          switch (link.pivot_type) {
            case "contact": {
              const contact = await getContactById(link.pivot_id);
              if (contact) {
                name = contact.display_name ?? contact.email;
              }
              break;
            }
            case "campaign": {
              const campaign = await getCampaign(link.pivot_id);
              if (campaign) {
                name = campaign.name;
              }
              break;
            }
            case "email":
            case "message": {
              name = `Email: ${link.pivot_id}`;
              break;
            }
          }

          if (!cancelled) {
            names[link.id] = name ?? link.pivot_id;
          }
        } catch {
          if (!cancelled) {
            names[link.id] = link.pivot_id;
          }
        }
      }

      if (!cancelled) {
        setEntityNames(names);
      }
    }

    resolveNames();
    return () => { cancelled = true; };
  }, [linkedEntities, getContactById, getCampaign]);

  // ── Contact search ──
  useEffect(() => {
    if (!showContactPicker || !contactSearch.trim()) {
      setContactResults([]);
      return;
    }
    let cancelled = false;
    const delay = setTimeout(async () => {
      setContactsLoading(true);
      try {
        const results = await searchContacts(contactSearch.trim(), 20);
        if (!cancelled) setContactResults(results);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(delay);
    };
  }, [showContactPicker, contactSearch]);

  // ── Select contact ──
  const handleSelectContact = useCallback(async (contact: DbContact) => {
    setContactId(contact.id);
    setContactName(contact.display_name ?? contact.email);
    setShowContactPicker(false);
    setContactSearch("");
  }, []);

  // ── Remove contact link ──
  const handleRemoveContact = useCallback(() => {
    setContactId(null);
    setContactName(null);
  }, []);

  // ── Navigate to contact ──
  const handleNavigateToContact = useCallback(() => {
    if (contactId) {
      navigate({ to: "/people/$contactId", params: { contactId } });
    }
  }, [contactId, navigate]);

  // ── Workflow action management ──
  const addWorkflowAction = useCallback(() => {
    setWorkflowActions((prev) => [...prev, { type: "create_task" }]);
  }, []);

  const updateWorkflowAction = useCallback((index: number, updates: Partial<WorkflowActionConfig>) => {
    setWorkflowActions((prev) => {
      const next = [...prev];
      const existing = next[index]!;
      next[index] = { ...existing, type: existing.type, ...updates };
      return next;
    });
  }, []);

  const removeWorkflowAction = useCallback((index: number) => {
    setWorkflowActions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Build config JSONs ──
  const buildWorkflowConfigJson = useCallback((): string | null => {
    if (workflowTrigger === "none" || workflowActions.length === 0) return null;
    const config: WorkflowConfig = {
      trigger: workflowTrigger,
      actions: workflowActions,
    };
    return JSON.stringify(config);
  }, [workflowTrigger, workflowActions]);

  const buildReminderConfigJson = useCallback((): string | null => {
    if (!reminderEnabled) return null;
    const preset = REMINDER_PRESETS[reminderPreset]!;
    const offsetValue = reminderPreset < REMINDER_PRESETS.length - 1
      ? preset.offsetValue
      : reminderCustomValue;
    const offsetUnit = reminderPreset < REMINDER_PRESETS.length - 1
      ? preset.offsetUnit
      : reminderCustomUnit;
    const config: ReminderConfig = {
      enabled: true,
      offsetValue,
      offsetUnit,
      notificationType: reminderNotificationType,
    };
    return JSON.stringify(config);
  }, [reminderEnabled, reminderPreset, reminderCustomValue, reminderCustomUnit, reminderNotificationType]);

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (!taskId) return;
    setSaving(true);
    setError(null);
    try {
      await dbUpdateTask(taskId, {
        title: title.trim() || "Untitled",
        description: description.trim() || null,
        priority,
        dueDate,
        contactId,
        workflowConfigJson: buildWorkflowConfigJson(),
        reminderConfigJson: buildReminderConfigJson(),
      });
      onTaskUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  }, [taskId, title, description, priority, dueDate, contactId, buildWorkflowConfigJson, buildReminderConfigJson, onTaskUpdated, onClose]);

  // ── Delete ──
  const handleDelete = useCallback(async () => {
    if (!taskId) return;
    setDeleting(true);
    setError(null);
    try {
      await dbDeleteTask(taskId);
      onTaskUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setDeleting(false);
    }
  }, [taskId, onTaskUpdated, onClose]);

  // ── Due date helpers ──
  const dueDateIso = dueDate ? new Date(dueDate * 1000).toISOString().slice(0, 10) : "";

  // ── Render content ──
  const renderContent = () => {
    if (!taskId) return null;

    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-sm text-text-tertiary">{t("Loading...")}</p>
          </div>
        </div>
      );
    }

    if (error && !originalTask) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-4 py-16">
          <AlertCircle size={40} className="text-danger-text opacity-60" />
          <p className="text-sm font-medium text-text-primary">{t("common.failedToLoadTask")}</p>
          <p className="text-xs text-text-tertiary text-center">{error}</p>
          <button
            onClick={() => { setError(null); /* re-trigger via key change */ }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
          >
            <RefreshCw size={13} />
            {t("common.retry")}
          </button>
        </div>
      );
    }

    return (
      <div className={`flex flex-col ${isMobileDevice ? "" : "min-h-[60vh]"} overflow-hidden`}>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto space-y-4 p-4 sm:p-5">
          {/* ── Section: Header (Title, Priority, Due Date) ── */}
          <div className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("common.taskTitle")}
              className={`${INPUT_BASE} text-base font-semibold`}
            />

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-text-tertiary mb-1">{t("common.priority")}</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className={INPUT_BASE}
                >
                  <option value="none">{t("common.none")}</option>
                  <option value="low">{t("common.low")}</option>
                  <option value="medium">{t("common.medium")}</option>
                  <option value="high">{t("common.high")}</option>
                  <option value="urgent">{t("common.urgent")}</option>
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-xs font-medium text-text-tertiary mb-1">{t("common.dueDate")}</label>
                <input
                  type="date"
                  value={dueDateIso}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDueDate(val ? Math.floor(new Date(val).getTime() / 1000) : null);
                  }}
                  className={INPUT_BASE}
                />
              </div>
            </div>
          </div>

          {/* ── Section: Description ── */}
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1">{t("common.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("Add a description...")}
              rows={3}
              className={`${INPUT_BASE} resize-none min-h-[72px]`}
            />
          </div>

          {/* ── Section: Contact Picker ── */}
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1.5">{t("common.linkedContact")}</label>
            {contactId && contactName ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNavigateToContact}
                  className="flex items-center gap-2 flex-1 min-w-0 p-2 rounded-lg border border-border-primary hover:bg-bg-hover transition-colors text-left"
                >
                  <span className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold shrink-0">
                    {(contactName.charAt(0).toUpperCase())}
                  </span>
                  <span className="text-sm text-text-primary truncate">{contactName}</span>
                </button>
                <button
                  onClick={handleRemoveContact}
                  className="p-2 text-text-tertiary hover:text-danger transition-colors"
                  aria-label={t("common.removeContact")}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowContactPicker(true)}
                className={`${BTN_SECONDARY} inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md`}
              >
                <User size={12} />
                {t("common.linkContact")}
              </button>
            )}
          </div>

          {/* ── Section: Graph Connections ── */}
          {linkedEntities.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-tertiary mb-1.5">{t("common.connections")}</label>
              <div className="flex flex-wrap gap-2">
                {linkedEntities.map(link => {
                  const displayType = link.pivot_type === "email" || link.pivot_type === "message" ? "Email" : link.pivot_type;
                  const displayName = entityNames[link.id] ?? link.pivot_id;
                  return (
                    <div key={link.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-bg-secondary border border-border-primary rounded-md text-xs">
                      <span className="font-semibold text-text-secondary capitalize">{displayType}:</span>
                      <span className="text-text-primary max-w-[150px] truncate" title={displayName}>{displayName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Section: Workflow Config ── */}
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1.5">{t("common.workflowTrigger")}</label>
            <select
              value={workflowTrigger}
              onChange={(e) => setWorkflowTrigger(e.target.value as WorkflowTrigger)}
              className={INPUT_BASE}
            >
              <option value="none">{t("common.none")}</option>
              <option value="on_complete">{t("common.onComplete")}</option>
              <option value="on_due">{t("common.onDue")}</option>
              <option value="on_overdue">{t("common.onOverdue")}</option>
            </select>

            {workflowTrigger !== "none" && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-tertiary">{t("common.actions")}</span>
                  <button
                    onClick={addWorkflowAction}
                    className="text-xs text-accent hover:text-accent-hover font-medium"
                  >
                    + {t("common.addAction")}
                  </button>
                </div>

                {workflowActions.length === 0 && (
                  <p className="text-xs text-text-tertiary italic">{t("No actions configured. Add an action to run when this trigger fires.")}</p>
                )}

                {workflowActions.map((action, index) => (
                  <div key={index} className="p-3 rounded-lg border border-border-primary bg-bg-secondary/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-primary">{t("common.action")} {index + 1}</span>
                      <button
                        onClick={() => removeWorkflowAction(index)}
                        className="text-text-tertiary hover:text-danger transition-colors"
                        aria-label={t("common.removeAction")}
                      >
                        <X size={12} />
                      </button>
                    </div>

                    <select
                      value={action.type}
                      onChange={(e) => updateWorkflowAction(index, { type: e.target.value as WorkflowActionType })}
                      className={INPUT_BASE}
                    >
                      <option value="send_email">{t("common.sendEmail")}</option>
                      <option value="create_notification">{t("common.createNotification")}</option>
                      <option value="create_task">{t("common.createTask")}</option>
                    </select>

                    {action.type === "send_email" && (
                      <select
                        value={action.templateId ?? ""}
                        onChange={(e) => updateWorkflowAction(index, { templateId: e.target.value || undefined })}
                        className={INPUT_BASE}
                      >
                        <option value="">{t("Select a template...")}</option>
                        {templates.map((tmpl) => (
                          <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                        ))}
                        {templates.length === 0 && (
                          <option value="" disabled>{t("common.noTemplatesAvailable")}</option>
                        )}
                      </select>
                    )}

                    {action.type === "create_notification" && (
                      <input
                        type="text"
                        value={action.notificationText ?? ""}
                        onChange={(e) => updateWorkflowAction(index, { notificationText: e.target.value })}
                        placeholder={t("Notification text...")}
                        className={INPUT_BASE}
                      />
                    )}

                    {action.type === "create_task" && (
                      <input
                        type="text"
                        value={action.taskTitlePreset ?? ""}
                        onChange={(e) => updateWorkflowAction(index, { taskTitlePreset: e.target.value })}
                        placeholder={t("Task title preset...")}
                        className={INPUT_BASE}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Section: Reminder Config ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-text-tertiary">{t("common.reminder")}</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-text-secondary">{t("common.enable")}</span>
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className={`${FOCUS_RING} rounded border-border-primary`}
                />
              </label>
            </div>

            {reminderEnabled && (
              <div className="space-y-3 mt-2">
                <div>
                  <label className="block text-xs text-text-tertiary mb-1">{t("common.remindBeforeDue")}</label>
                  <select
                    value={reminderPreset}
                    onChange={(e) => setReminderPreset(Number(e.target.value))}
                    className={INPUT_BASE}
                  >
                    {REMINDER_PRESETS.map((preset, idx) => (
                      <option key={idx} value={idx}>{preset.label}</option>
                    ))}
                  </select>

                  {reminderPreset === REMINDER_PRESETS.length - 1 && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min={1}
                        value={reminderCustomValue}
                        onChange={(e) => setReminderCustomValue(Math.max(1, Number(e.target.value)))}
                        className={`${INPUT_BASE} w-20`}
                      />
                      <select
                        value={reminderCustomUnit}
                        onChange={(e) => setReminderCustomUnit(e.target.value as RemindBeforeUnit)}
                        className={`${INPUT_BASE} flex-1`}
                      >
                        <option value="minutes">{t("common.minutes")}</option>
                        <option value="hours">{t("common.hours")}</option>
                        <option value="days">{t("common.days")}</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-text-tertiary mb-1">{t("common.notificationType")}</label>
                  <select
                    value={reminderNotificationType}
                    onChange={(e) => setReminderNotificationType(e.target.value as ReminderNotificationType)}
                    className={INPUT_BASE}
                  >
                    <option value="os">{t("common.oSNotification")}</option>
                    <option value="email">{t("common.email")}</option>
                    <option value="both">{t("common.both")}</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-md bg-danger/10 border border-danger/20 text-xs text-danger">
            {error}
          </div>
        )}

        {/* ── Footer: Save / Delete ── */}
        <div className="flex items-center gap-3 border-t border-border-primary px-4 py-3 bg-bg-primary shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${BTN_PRIMARY} px-4 py-2 text-xs gap-1.5 flex items-center rounded-md`}
          >
            <Save size={13} />
            {saving ? t("Saving...") : t("common.save")}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`${BTN_DANGER} px-4 py-2 text-xs gap-1.5 flex items-center rounded-md ml-auto`}
          >
            <Trash2 size={13} />
            {deleting ? t("Deleting...") : t("common.delete")}
          </button>
        </div>
      </div>
    );
  };

  // ── Contact picker modal ──
  const renderContactPicker = () => (
    <Modal
      isOpen={showContactPicker}
      onClose={() => { setShowContactPicker(false); setContactSearch(""); }}
      title={t("common.linkContact")}
      size="md"
    >
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder={t("Search contacts...")}
            className={`${INPUT_BASE} pl-8`}
            autoFocus
          />
        </div>

        {contactsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : contactSearch.trim() && contactResults.length === 0 ? (
          <p className="text-xs text-text-tertiary text-center py-8">{t("common.noContactsFound")}</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {contactResults.map((contact) => (
              <button
                key={contact.id}
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
    </Modal>
  );

  // ── Main render ──
  if (!taskId) return null;

  // Desktop: render as a slide-out panel overlay on the right side
  if (!isMobileDevice) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/20 z-40 animate-[fadeIn_150ms_ease-out]"
          onClick={onClose}
        />
        {/* Panel */}
        <div className="fixed top-0 right-0 h-full w-full max-w-lg z-50 bg-bg-primary border-l border-border-primary shadow-2xl flex flex-col animate-[slideInRight_250ms_cubic-bezier(0.16,1,0.3,1)]">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-primary shrink-0">
            <h2 className="text-sm font-semibold text-text-primary">{t("common.taskDetails")}</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
              aria-label={t("common.close")}
            >
              <X size={14} />
            </button>
          </div>
          {renderContent()}
        </div>
        {renderContactPicker()}
      </>
    );
  }

  // Mobile: render as a full-screen modal
  return (
    <>
      <Modal
        isOpen={!!taskId}
        onClose={onClose}
        title={t("common.taskDetails")}
        width="w-[calc(100%-1rem)] sm:w-full sm:max-w-lg"
      >
        {renderContent()}
      </Modal>
      {renderContactPicker()}
    </>
  );
}
