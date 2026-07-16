import { useEffect, useCallback, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  RefreshCw,
  Workflow,
  Plus,
  Sparkles,
  LayoutGrid,
  List,
  GitBranch,
  LayoutTemplate,
} from "lucide-react";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";
import { Button } from "@shared/components/ui/Button";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { SkeletonPage, GlassPanel } from "@shared/components/ui";
import { PageScaffold } from "@shared/components/layout";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { ACTIVE_COMPANY_ID } from "@shared/constants/company";
import { useAutomationStore } from "@features/automation/stores/automationStore";
import { AutomationRuleCard } from "@features/automation/components/AutomationRuleCard";
import { AutomationRuleList } from "@features/automation/components/AutomationRuleList";
import { AutomationRuleEditor } from "@features/automation/components/AutomationRuleEditor";
import { WorkflowTemplatesGallery } from "@features/automation/components/WorkflowTemplatesGallery";
import { upsertWorkflowRule } from "@features/settings/db/workflowRules";

// Heavy, conditionally-rendered UI: the visual flow builder pulls in xyflow
// and the AI modal pulls in settings/constants. Both are only mounted on
// demand, so lazy-load them to keep them out of the initial automation chunk.
const AutomationBuilder = lazy(() =>
  import("@features/automation/components/AutomationBuilder").then((m) => ({
    default: m.AutomationBuilder,
  })),
);

const AiWorkflowGenerateModal = lazy(() =>
  import("@features/settings/components/AiWorkflowGenerateModal").then((m) => ({
    default: m.AiWorkflowGenerateModal,
  })),
);
import { notify } from "@shared/services/notifications/toastHelper";
import type { WorkflowPreset } from "@/constants/workflowPresets";
import type { ViewMode } from "@features/automation/stores/automationStore";

export function AutomationPage() {
  const { t } = useTranslation();

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
  const showTemplates = useAutomationStore((s) => s.showTemplates);
  const openTemplates = useAutomationStore((s) => s.openTemplates);
  const closeTemplates = useAutomationStore((s) => s.closeTemplates);

  useEffect(() => {
    if (activeAccountId) {
      loadRules(ACTIVE_COMPANY_ID);
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

  // ── Templates Gallery ──────────────────────────────────────────────

  const handleCreateFromTemplate = useCallback(
    async (preset: WorkflowPreset) => {
      if (!activeAccountId) return;
      try {
        await upsertWorkflowRule({
          companyId: ACTIVE_COMPANY_ID,
          name: preset.name,
          triggerEvent: preset.trigger_event,
          triggerConditions: preset.trigger_conditions,
          actions: preset.actions,
        });
        closeTemplates();
        await loadRules(ACTIVE_COMPANY_ID);
        notify(t("automation.notifyTitle"), t("automation.notifyCreated", { name: preset.name }));
      } catch (err) {
        console.error("Failed to create workflow from template:", err);
        notify(t("automation.notifyTitle"), t("automation.notifyFailed"));
      }
    },
    [activeAccountId, loadRules, closeTemplates, t],
  );

  // ── AI Create ───────────────────────────────────────────────────────

  const handleAiCreate = useCallback(
    async (preset: WorkflowPreset) => {
      if (!activeAccountId) return;
      try {
        await upsertWorkflowRule({
          companyId: ACTIVE_COMPANY_ID,
          name: preset.name,
          triggerEvent: preset.trigger_event,
          triggerConditions: preset.trigger_conditions,
          actions: preset.actions,
        });
        closeAiModal();
        await loadRules(ACTIVE_COMPANY_ID);
        notify(t("automation.notifyTitle"), t("automation.notifyCreated", { name: preset.name }));
      } catch (err) {
        console.error("Failed to create AI workflow:", err);
        notify(t("automation.notifyTitle"), t("automation.notifyFailed"));
      }
    },
    [activeAccountId, loadRules, closeAiModal, t],
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

  // Show builder when active (takes over the entire page area)
  if (showBuilder && activeAccountId) {
    return (
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<SkeletonPage />}>
          <AutomationBuilder
            accountId={activeAccountId}
            onSaveSuccess={() => {}}
          />
        </Suspense>
      </div>
    );
  }

  if (loading && rules.length === 0) {
    return <SkeletonPage />;
  }

  if (error && rules.length === 0) {
    return (
      <PageScaffold
        title={t("automation.title")}
        subtitle={t("automation.subtitle")}
      >
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-sm text-danger mb-1">
            {t("automation.errorTitle")}
          </p>
          <p className="text-xs text-text-tertiary mb-4 max-w-sm">{error}</p>
          <button
            onClick={() => activeAccountId && loadRules(activeAccountId)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            {t("automation.retry")}
          </button>
        </div>
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title={t("automation.title")}
      subtitle={t("automation.subtitle")}
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon={<GitBranch size={14} />}
            onClick={openBuilder}
          >
            {t("automation.visualBuilder")}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<Sparkles size={14} />}
            onClick={openAiModal}
          >
            {t("automation.generateWithAi")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<LayoutTemplate size={14} />}
            onClick={openTemplates}
          >
            {t("automation.templates")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={openEditor}
          >
            {t("automation.addRule")}
          </Button>
        </>
      }
      toolbar={
        <button
          type="button"
          onClick={cycleViewMode}
          className="p-1.5 text-text-tertiary hover:text-text-primary bg-bg-secondary hover:bg-bg-hover rounded-lg border border-border-primary transition-colors"
          aria-label={
            viewMode === "cards"
              ? t("automation.switchToList")
              : t("automation.switchToCard")
          }
          title={
            viewMode === "cards"
              ? t("automation.viewModeList")
              : t("automation.viewModeCard")
          }
        >
          {viewMode === "cards" ? (
            <List size={14} />
          ) : (
            <LayoutGrid size={14} />
          )}
        </button>
      }
      isEmpty={rules.length === 0 && !showEditor}
      emptyState={
        <div className="space-y-4">
          <EmptyState
            icon={Workflow}
            title={t("automation.emptyTitle")}
            subtitle={t("automation.emptySubtitle")}
            action={
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={openEditor}
              >
                {t("automation.createRule")}
              </Button>
            }
          />
          <GlassPanel variant="card" className="p-4 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
              {t("automation.whatYouCanAutomate")}
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2"><span className="mt-1 text-accent">•</span> {t("automation.examples.archive")}</li>
              <li className="flex items-start gap-2"><span className="mt-1 text-accent">•</span> {t("automation.examples.starVip")}</li>
              <li className="flex items-start gap-2"><span className="mt-1 text-accent">•</span> {t("automation.examples.autoReply")}</li>
              <li className="flex items-start gap-2"><span className="mt-1 text-accent">•</span> {t("automation.examples.createTasks")}</li>
              <li className="flex items-start gap-2"><span className="mt-1 text-accent">•</span> {t("automation.examples.forwardInvoices")}</li>
              <li className="flex items-start gap-2"><span className="mt-1 text-accent">•</span> {t("automation.examples.snoozeFollowups")}</li>
            </ul>
          </GlassPanel>
        </div>
      }
    >
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
      {viewMode === "cards" ? (
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
        title={t("automation.deleteTitle")}
        message={t("automation.deleteMessage")}
        confirmLabel={t("automation.delete")}
        variant="danger"
        loading={deleting}
      />

      {/* AI Generate Modal */}
      <Suspense fallback={null}>
        <AiWorkflowGenerateModal
          isOpen={showAiModal}
          onClose={closeAiModal}
          onCreate={handleAiCreate}
        />
      </Suspense>

      {/* Templates Gallery (inline overlay) */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-y-auto mx-4 bg-bg-primary rounded-2xl border border-border-primary shadow-2xl p-5">
            <WorkflowTemplatesGallery
              onCreate={handleCreateFromTemplate}
              onCancel={closeTemplates}
              creating={false}
            />
          </div>
        </div>
      )}
    </PageScaffold>
  );
}
