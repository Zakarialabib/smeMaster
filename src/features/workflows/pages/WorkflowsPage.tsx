/**
 * @deprecated This feature has been merged into @features/automation.
 * Import from @features/automation instead. Will be removed in a future version.
 */
import { useEffect, useCallback } from "react";
import { RefreshCw, Plus } from "lucide-react";
import { usePlatform } from "@shared/hooks/usePlatform";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";
import { Button } from "@shared/components/ui/Button";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useWorkflowStore } from "@features/workflows/stores/workflowStore";
import { WorkflowList } from "@features/workflows/components/WorkflowList";
import { WorkflowEditor } from "@features/workflows/components/WorkflowEditor";

export function WorkflowsPage() {
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;
  const activeAccountId = useAccountStore((s) => s.activeAccountId);

  const workflows = useWorkflowStore((s) => s.workflows);
  const loading = useWorkflowStore((s) => s.isLoading);
  const error = useWorkflowStore((s) => s.error);
  const showEditor = useWorkflowStore((s) => s.showEditor);
  const deleteTargetId = useWorkflowStore((s) => s.deleteTargetId);
  const deleting = useWorkflowStore((s) => s.deleting);

  const loadWorkflows = useWorkflowStore((s) => s.loadWorkflows);
  const toggleWorkflow = useWorkflowStore((s) => s.toggleWorkflow);
  const openEditor = useWorkflowStore((s) => s.openEditor);
  const openEditorForEdit = useWorkflowStore((s) => s.openEditorForEdit);
  const requestDelete = useWorkflowStore((s) => s.requestDelete);
  const cancelDelete = useWorkflowStore((s) => s.cancelDelete);
  const confirmDelete = useWorkflowStore((s) => s.confirmDelete);

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
