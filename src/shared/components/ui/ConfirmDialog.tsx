import { type ReactNode, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "@shared/components/ui/Button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  loading = false,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => confirmRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm();
    }
  };

  const dialogId = `confirm-dialog-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width="w-96">
      <div className="p-5" onKeyDown={handleKeyDown} role="document">
        <p
          id={dialogId}
          className="text-sm text-text-secondary leading-relaxed mb-6"
        >
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={loading}
            icon={loading ? <Loader2 size={14} className="animate-spin" /> : undefined}
            aria-label={loading ? `${confirmLabel} (loading)` : confirmLabel}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
