import { useEffect, useCallback } from "react";
import {
  RefreshCw,
  Workflow,
  Plus,
  Sparkles,
  LayoutGrid,
  List,
  GitBranch,
} from "lucide-react";
import { usePlatform } from "@shared/hooks/usePlatform";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";
import { Button } from "@shared/components/ui/Button";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { SkeletonPage, GlassPanel } from "@shared/components/ui";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useAutomationStore } from "@features/automation/stores/automationStore";
import { AutomationRuleCard } from "@features/automation/components/AutomationRuleCard";
import { AutomationRuleList } from "@features/automation/components/AutomationRuleList";
import { AutomationRuleEditor } from "@features/automation/components/AutomationRuleEditor";
import { AutomationBuilder } from "@features/automation/components/AutomationBuilder";
import { AiWorkflowGenerateModal } from "@features/settings/components/AiWorkflowGenerateModal";
import { upsertWorkflowRule } from "@features/settings/db/workflowRules";
import { notify } from "@shared/services/notifications/toastHelper";
import type { WorkflowPreset } from "@/constants/workflowPresets";
import type { ViewMode } from "@features/automation/stores/automationStore";

export function AutomationPage() {
  const { mobile: isMobileDevice } = usePlatform();

  const activeAccountId = useAccountStore((s) => s.activeAccountId);

  const rules = useAutomationStore((s) => s.rules);
  const loading = useAutomationStore((s) => s.isLoading);
  const error = useAutomationStore((s) => s.error);
  const showEditor = useAutomationStore((s) => s.showEditor);
  const showBuilder = useAutomationStore((s) => s.showBuilder);
  const viewMode = useAutomationStore((s) => s.viewMode);
  const deleteTargetId = useAutomationStore((s) => s.deleteTargetId);
  const deleting = useAutomationStore((s) => s.deleting);
  const showAiModal = useAutomationStore((s) => s.showAiModal);

  const loadRules = useAutomationStore((s) => s.loadRules);
  const toggleRule = useAutomationStore((s) => s.toggleRule);
  const openEditor = useAutomationStore((s) => s.openEditor);
  const openEditorForEdit = useAutomationStore((s) => s.openEditorForEdit);
  const requestDelete = useAutomationStore((s) => s.requestDelete);
  const cancelDelete = useAutomationStore((s) => s.cancelDelete);
  const confirmDelete = useAutomationStore((s) => s.confirmDelete);
  const openAiModal = useAutomationStore((s) => s.openAiModal);
  const closeAiModal = useAutomationStore((s) => s.closeAiModal);
  const setViewMode = useAutomationStore((s) => s.setViewMode);
  const openBuilder = useAutomationStore((s) => s.openBuilder);

  useEffect(() => {
    if (activeAccountId) {
      loadRules(activeAccountId);
    }
  }, [activeAccountId, loadRules]);

  const handleToggle = useCallback(
    (id: string, isActive: boolean) => {
      toggleRule(id, isActive);
    },
    [toggleRule],
  );

  const handleEdit = useCallback(
    (rule: (typeof rules)[number]) => {
      openEditorForEdit(rule);
    },
    [openEditorForEdit],
  );

  const handleDelete = useCallback(
    (id: string) => {
      requestDelete(id);
    },
    [requestDelete],
  );

  // ── AI Create ───────────────────────────────────────────────────────

  const handleAiCreate = useCallback(
    async (preset: WorkflowPreset) => {
      if (!activeAccountId) return;
      try {
        await upsertWorkflowRule({
          companyId: activeAccountId,
          name: preset.name,
          triggerEvent: preset.trigger_event,
          triggerConditions: preset.trigger_conditions,
          actions: preset.actions,
        });
        closeAiModal();
        await loadRules(activeAccountId);
        notify("Automation", `AI workflow "${preset.name}" created.`);
      } catch (err) {
        console.error("Failed to create AI workflow:", err);
        notify("Automation", "Failed to create workflow rule.");
      }
    },
    [activeAccountId, loadRules, closeAiModal],
  );

  // ── View mode ───────────────────────────────────────────────────────

  const cycleViewMode = useCallback(() => {
    const next: Record<ViewMode, ViewMode> = {
      cards: "list",
      list: "cards",
    };
    setViewMode(next[viewMode]);
  }, [viewMode, setViewMode]);

  // ── Render ──────────────────────────────────────────────────────────

  const titleClass = isMobileDevice ? "text-xl" : "text-2xl";

  // Show builder when active (takes over the entire page area)
  if (showBuilder && activeAccountId) {
    return (
      <div className="flex-1 overflow-hidden">
        <AutomationBuilder
          accountId={activeAccountId}
          onSaveSuccess={() => {}}
        />
      </div>
    );
  }

  if (loading && rules.length === 0) {
    return <SkeletonPage />;
  }

  if (error && rules.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="mb-6 space-y-1">
          <h1 className={`${titleClass} font-semibold text-text-primary`}>
            Automation
          </h1>
          <p className="text-sm text-text-tertiary">
            Manage workflow automation rules
          </p>
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-sm text-danger mb-1">
            Failed to load automation rules
          </p>
          <p className="text-xs text-text-tertiary mb-4 max-w-sm">{error}</p>
          <button
            onClick={() => activeAccountId && loadRules(activeAccountId)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className={`${titleClass} font-semibold text-text-primary`}
          >
            Automation
          </h1>
          <p className="text-sm text-text-tertiary mt-1">
            Manage workflow automation rules
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <button
            type="button"
            onClick={cycleViewMode}
            className="p-1.5 text-text-tertiary hover:text-text-primary bg-bg-secondary hover:bg-bg-hover rounded-lg border border-border-primary transition-colors"
            aria-label={
              viewMode === "cards"
                ? "Switch to list view"
                : "Switch to card view"
            }
            title={
              viewMode === "cards" ? "List view" : "Card view"
            }
          >
            {viewMode === "cards" ? (
              <List size={14} />
            ) : (
              <LayoutGrid size={14} />
            )}
          </button>

          {/* Visual Builder button */}
          <Button
            variant="secondary"
            size="sm"
            icon={<GitBranch size={14} />}
            onClick={openBuilder}
          >
            Visual Builder
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<Sparkles size={14} />}
            onClick={openAiModal}
          >
            Generate with AI
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={openEditor}
          >
            Add Rule
          </Button>
        </div>
      </div>

      {/* Inline Add/Edit Form */}
      {showEditor && activeAccountId && (
        <div className="mb-4">
          <AutomationRuleEditor
            accountId={activeAccountId}
            onSaveSuccess={() => {}}
          />
        </div>
      )}

      {/* Rules list or empty state */}
      {rules.length === 0 && !showEditor ? (
        <div className="space-y-4">
          <EmptyState
            icon={Workflow}
            title="No automation rules yet"
            subtitle="Automation rules watch your mail and run actions automatically — no manual work required."
            action={
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={openEditor}
              >
                Create Rule
              </Button>
            }
          />
          <GlassPanel variant="card" className="p-4 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
              What you can automate
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2"><span className="mt-1 text-accent">•</span> Auto-archive newsletters and receipts</li>
              <li className="flex items-start gap-2"><span className="mt-1 text-accent">•</span> Star or label VIP senders instantly</li>
              <li className="flex items-start gap-2"><span className="mt-1 text-accent">•</span> Auto-reply to common requests</li>
              <li className="flex items-start gap-2"><span className="mt-1 text-accent">•</span> Create tasks from flagged emails</li>
              <li className="flex items-start gap-2"><span className="mt-1 text-accent">•</span> Forward invoices to your accountant</li>
              <li className="flex items-start gap-2"><span className="mt-1 text-accent">•</span> Snooze follow-ups until later</li>
            </ul>
          </GlassPanel>
        </div>
      ) : viewMode === "cards" ? (
        <ErrorBoundary name="AutomationRulesList">
          <GlassPanel variant="card" className="p-4">
            <div className="space-y-2">
              {rules.map((rule) => (
                <AutomationRuleCard
                  key={rule.id}
                  rule={rule}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </GlassPanel>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary name="AutomationRulesList">
          <GlassPanel variant="card" className="p-2">
            <AutomationRuleList
              rules={rules}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCreate={openEditor}
            />
          </GlassPanel>
        </ErrorBoundary>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Rule"
        message="Are you sure you want to delete this automation rule? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      {/* AI Generate Modal */}
      <AiWorkflowGenerateModal
        isOpen={showAiModal}
        onClose={closeAiModal}
        onCreate={handleAiCreate}
      />
    </div>
  );
}
