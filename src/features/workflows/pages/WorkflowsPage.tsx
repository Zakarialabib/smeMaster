import { useEffect, useCallback } from "react";
import { RefreshCw, Plus } from "lucide-react";
import { usePlatform } from "@shared/hooks/usePlatform";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";
import { Button } from "@shared/components/ui/Button";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useAutomationStore } from "@features/automation/stores/automationStore";
import { WorkflowList } from "@features/workflows/components/WorkflowList";
import { WorkflowEditor } from "@features/workflows/components/WorkflowEditor";

export function WorkflowsPage() {
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;
  const activeAccountId = useAccountStore((s) => s.activeAccountId);

  const workflows = useAutomationStore((s) => s.rules);
  const loading = useAutomationStore((s) => s.isLoading);
  const error = useAutomationStore((s) => s.error);
  const showEditor = useAutomationStore((s) => s.showEditor);
  const deleteTargetId = useAutomationStore((s) => s.deleteTargetId);
  const deleting = useAutomationStore((s) => s.deleting);

  const loadWorkflows = useAutomationStore((s) => s.loadRules);
  const toggleWorkflow = useAutomationStore((s) => s.toggleRule);
  const openEditor = useAutomationStore((s) => s.openEditor);
  const openEditorForEdit = useAutomationStore((s) => s.openEditorForEdit);
  const requestDelete = useAutomationStore((s) => s.requestDelete);
  const cancelDelete = useAutomationStore((s) => s.cancelDelete);
  const confirmDelete = useAutomationStore((s) => s.confirmDelete);

  useEffect(() => {
    if (activeAccountId) {
      loadWorkflows(activeAccountId);
    }
  }, [activeAccountId, loadWorkflows]);

  const handleToggle = useCallback(
    (id: string, isActive: boolean) => {
      toggleWorkflow(id, isActive);
    },
    [toggleWorkflow],
  );

  const handleEdit = useCallback(
    (workflow: (typeof workflows)[number]) => {
      openEditorForEdit(workflow);
    },
    [openEditorForEdit],
  );

  const handleDelete = useCallback(
    (id: string) => {
      requestDelete(id);
    },
    [requestDelete],
  );

  // ── Render ──────────────────────────────────────────────────────────

  const titleClass = isMobileDevice ? "text-xl" : "text-2xl";

  if (loading && workflows.length === 0) {
    return (
      <div
        className="flex-1 overflow-y-auto p-3 sm:p-6"
        aria-busy="true"
        aria-live="polite"
        aria-label="Workflows list"
      >
        <div className="mb-6 space-y-1">
          <h1 className={`${titleClass} font-semibold text-text-primary`}>
            Workflows
          </h1>
          <p className="text-sm text-text-tertiary">
            Manage multi-step email workflows
          </p>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-14 bg-bg-secondary rounded-lg border border-border-primary animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error && workflows.length === 0) {
    return (
      <div
        className="flex-1 overflow-y-auto p-3 sm:p-6"
        aria-busy="false"
        aria-live="polite"
        aria-label="Workflows list"
      >
        <div className="mb-6 space-y-1">
          <h1 className={`${titleClass} font-semibold text-text-primary`}>
            Workflows
          </h1>
          <p className="text-sm text-text-tertiary">
            Manage multi-step email workflows
          </p>
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-sm text-danger mb-1">
            Failed to load workflows
          </p>
          <p className="text-xs text-text-tertiary mb-4 max-w-sm">{error}</p>
          <button
            onClick={() => activeAccountId && loadWorkflows(activeAccountId)}
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
          <h1 className={`${titleClass} font-semibold text-text-primary`}>
            Workflows
          </h1>
          <p className="text-sm text-text-tertiary mt-1">
            Manage multi-step email workflows
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={openEditor}
        >
          New Workflow
        </Button>
      </div>

      {/* Inline Add/Edit Form */}
      {showEditor && activeAccountId && (
        <div className="mb-4">
          <WorkflowEditor
            accountId={activeAccountId}
            onSaveSuccess={() => {}}
          />
        </div>
      )}

      {/* Workflows list */}
      <div
        aria-busy={loading}
        aria-live="polite"
        aria-label="Workflows list"
      >
        <ErrorBoundary name="WorkflowList">
          <WorkflowList
            workflows={workflows}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={openEditor}
          />
        </ErrorBoundary>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Workflow"
        message="Are you sure you want to delete this workflow? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
