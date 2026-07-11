import { useState } from "react";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { Modal } from "@shared/components/ui/Modal";
import { Button } from "@shared/components/ui/Button";
import { notify } from "@shared/services/notifications/toastHelper";
import { AlertTriangle, Loader2 } from "lucide-react";

interface DataWipeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onWipeComplete?: () => void;
}

const CONFIRM_TEXT = "DELETE";

export function DataWipeDialog({ isOpen, onClose, onWipeComplete }: DataWipeDialogProps) {
  const [typedText, setTypedText] = useState("");
  const [step, setStep] = useState<"confirm" | "wiping" | "done" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState("");

  const isConfirmed = typedText === CONFIRM_TEXT;

  const handleWipe = async () => {
    if (!isConfirmed) return;
    setStep("wiping");
    setErrorMsg("");
    try {
      await invokeCommand("db_wipe_all_data");
      setStep("done");
      notify("Data Wipe", "All data has been permanently deleted. The app will restart.");
      onWipeComplete?.();
    } catch (err) {
      setStep("error");
      setErrorMsg(String(err));
      notify("Data Wipe", `Failed to wipe data: ${err}`);
    }
  };

  const handleClose = () => {
    setTypedText("");
    setStep("confirm");
    setErrorMsg("");
    onClose();
  };

  const handleRestart = () => {
    invokeCommand("reset_app").catch(() => {
      window.location.reload();
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Delete All Data" size="md">
      <div className="p-5 space-y-4">
        {step === "confirm" && (
          <>
            {/* Warning banner */}
            <div className="flex items-start gap-3 p-3 bg-danger/10 border border-danger/20 rounded-lg">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <div className="text-sm text-text-primary">
                <strong className="text-danger">Warning:</strong> This will permanently
                delete all your data including emails, contacts, campaigns, tasks, and
                calendar entries. This action <strong>cannot be undone</strong>.
              </div>
            </div>

            {/* Confirmation input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                Type <code className="px-1.5 py-0.5 bg-bg-tertiary rounded text-accent font-mono text-xs">{CONFIRM_TEXT}</code> to confirm:
              </label>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={`Type "${CONFIRM_TEXT}"`}
                className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-danger/50 font-mono"
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleWipe}
                disabled={!isConfirmed}
              >
                Delete Everything
              </Button>
            </div>
          </>
        )}

        {step === "wiping" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 size={32} className="animate-spin text-danger" />
            <p className="text-sm text-text-secondary">
              Permanently deleting all data...
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm text-text-primary text-center">
              All data has been wiped. The app needs to restart to create a fresh database.
            </p>
            <Button variant="primary" onClick={handleRestart}>
              Restart App
            </Button>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-12 h-12 rounded-full bg-danger/20 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <p className="text-sm text-danger text-center max-w-xs">
              Failed to wipe data: {errorMsg}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleClose}>
                Close
              </Button>
              <Button variant="danger" onClick={handleWipe}>
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
