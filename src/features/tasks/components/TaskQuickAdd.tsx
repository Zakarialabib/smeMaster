/**
 * TaskQuickAdd – Inline quick capture bar with a gateway to the full TaskCreateModal.
 *
 * Desktop-first layout: a single-line input for fast entry with an
 * "Add details" button that opens the rich TaskCreateModal.
 *
 * Mobile: compact version that slides in from the top.
 */

import { useState, useCallback, useRef } from "react";
import { Plus, ArrowUpRight } from "lucide-react";
import { BTN_GHOST } from "@shared/styles/ui-tokens";
import { TaskCreateModal } from "./TaskCreateModal";

interface TaskQuickAddProps {
  /** Called when a task is created via quick-add (title only) */
  onQuickAdd: (title: string) => void;
  /** Called when the full modal creates a task */
  onModalCreate: (taskId: string) => void;
  /** Current account ID */
  accountId: string | null;
  /** Placeholder text */
  placeholder?: string;
}

export function TaskQuickAdd({
  onQuickAdd,
  onModalCreate,
  accountId,
  placeholder = "Add a task...",
}: TaskQuickAddProps) {
  const [value, setValue] = useState("");
  const [showModal, setShowModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onQuickAdd(trimmed);
    setValue("");
    inputRef.current?.focus();
  }, [value, onQuickAdd]);

  const handleOpenModal = useCallback(() => {
    // If there's typed text, pre-fill the modal with it
    setShowModal(true);
  }, []);

  const handleModalCreated = useCallback(
    (taskId: string) => {
      setShowModal(false);
      setValue("");
      onModalCreate(taskId);
    },
    [onModalCreate],
  );

  const handleModalClose = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <>
      {/* Quick-add bar */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Plus size={14} className="text-text-tertiary shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
          aria-label="Quick add task title"
        />
        <button
          type="button"
          onClick={handleOpenModal}
          className={`${BTN_GHOST} flex items-center gap-1 px-2 py-1 text-[0.6875rem] rounded-md whitespace-nowrap`}
          aria-label="Open task creation form with full details"
        >
          <ArrowUpRight size={11} />
          Add details
        </button>
      </div>

      {/* Full Task Create Modal */}
      {showModal && (
        <TaskCreateModal
          isOpen={showModal}
          onClose={handleModalClose}
          onCreated={handleModalCreated}
          accountId={accountId}
          prefill={{
            title: value.trim() || undefined,
            source: "manual",
          }}
        />
      )}
    </>
  );
}
