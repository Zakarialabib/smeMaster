import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit3, Filter } from "lucide-react";
import { useContactStore } from "@features/contacts/stores/contactStore";
import { deleteContactSegment } from "@features/contacts/db/contactSegments";
import { SegmentQueryEditor } from "./SegmentQueryEditor";

interface SegmentManagerProps {
  accountId: string;
}

export function SegmentManager({ accountId }: SegmentManagerProps) {
  const segments = useContactStore((s) => s.segments);
  const isLoading = useContactStore((s) => s.isLoading);
  const loadSegments = useContactStore((s) => s.loadSegments);

  const [editorState, setEditorState] = useState<{
    mode: "hidden" | "create" | "edit";
    segmentId?: string;
    segmentName?: string;
    segmentQuery?: string;
    segmentDescription?: string;
    segmentColor?: string;
  }>({ mode: "hidden" });

  useEffect(() => {
    loadSegments(accountId);
  }, [accountId, loadSegments]);

  const handleNew = useCallback(() => {
    setEditorState({ mode: "create" });
  }, []);

  const handleEdit = useCallback(
    (id: string, name: string, query: string) => {
      setEditorState({
        mode: "edit",
        segmentId: id,
        segmentName: name,
        segmentQuery: query,
      });
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      const confirmed = window.confirm(
        `Are you sure you want to delete the segment "${name}"?`,
      );
      if (!confirmed) return;
      try {
        await deleteContactSegment(id, accountId);
        await loadSegments(accountId);
      } catch (err) {
        console.error("Failed to delete segment:", err);
      }
    },
    [accountId, loadSegments],
  );

  const handleSaveComplete = useCallback(() => {
    setEditorState({ mode: "hidden" });
  }, []);

  const handleCancel = useCallback(() => {
    setEditorState({ mode: "hidden" });
  }, []);

  // â”€â”€â”€ Loading state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (isLoading && segments.length === 0) {
    return (
      <div className="text-xs text-text-tertiary py-2">
        Loading segments...
      </div>
    );
  }

  // â”€â”€â”€ Editor open (create or edit) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (editorState.mode !== "hidden") {
    const initialSegment =
      editorState.mode === "edit" && editorState.segmentId
        ? {
            id: editorState.segmentId,
            name: editorState.segmentName ?? "",
            query: editorState.segmentQuery ?? "",
            description: editorState.segmentDescription,
            color: editorState.segmentColor,
          }
        : undefined;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            {editorState.mode === "create" ? "New Segment" : "Edit Segment"}
          </h4>
        </div>
        <SegmentQueryEditor
          accountId={accountId}
          initialSegment={initialSegment}
          onSave={handleSaveComplete}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  // â”€â”€â”€ List view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Segments
        </h4>
        <button
          onClick={handleNew}
          className="p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          title="Create segment"
        >
          <Plus size={14} />
        </button>
      </div>

      {segments.length === 0 ? (
        <p className="text-xs text-text-tertiary">No segments yet</p>
      ) : (
        <div className="space-y-1">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-bg-hover group transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Filter size={12} className="text-text-tertiary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-text-primary truncate">
                    {segment.name}
                  </div>
                  <div className="text-[0.625rem] text-text-tertiary truncate flex items-center gap-1">
                    <code className="truncate">{segment.query}</code>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  onClick={() =>
                    handleEdit(segment.id, segment.name, segment.query)
                  }
                  className="p-1 text-text-tertiary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-bg-hover"
                  title="Edit segment"
                >
                  <Edit3 size={11} />
                </button>
                <button
                  onClick={() => handleDelete(segment.id, segment.name)}
                  className="p-1 text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-bg-hover"
                  title="Delete segment"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
