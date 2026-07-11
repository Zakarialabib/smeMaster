import { useState, useCallback, useEffect } from "react";
import { Modal } from "@shared/components/ui/Modal";
import { Button } from "@shared/components/ui/Button";
import { UserPlus, X } from "lucide-react";
import { upsertContact } from "@features/contacts/db/contacts";
import { normalizeEmail } from "@shared/utils/emailUtils";
import { notify } from "@shared/services/notifications/toastHelper";

interface CreateContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * CreateContactModal — minimal new-contact form.
 *
 * Persists via `upsertContact` (email + display name). If the contact already
 * exists, `upsertContact` bumps its frequency rather than throwing, so this
 * is safe to use for both "create" and "touch" actions.
 */
export function CreateContactModal({
  isOpen,
  onClose,
  onCreated,
}: CreateContactModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setEmail("");
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleSave = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required");
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const trimmedName = name.trim() || null;
      const normalized = normalizeEmail(trimmedEmail);
      await upsertContact(normalized, trimmedName);
      notify("Contact created", `${normalized} has been added.`);
      onCreated?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create contact";
      setError(msg);
      notify("Failed to create contact", msg);
    } finally {
      setSaving(false);
    }
  }, [name, email, onCreated, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create contact"
      size="sm"
    >
      <div className="p-4 space-y-3">
        {/* Header row (mirrors header style for visual consistency) */}
        <div className="flex items-center justify-between -mt-1 mb-1">
          <div className="flex items-center gap-2 text-text-tertiary">
            <UserPlus size={12} />
            <span className="text-[0.625rem] uppercase tracking-wider">
              New contact
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-2.5">
          <div>
            <label className="block text-[0.625rem] font-medium text-text-tertiary uppercase tracking-wider mb-1">
              Email <span className="text-error">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="alice@example.com"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && email.trim()) handleSave();
              }}
              className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-[0.625rem] font-medium text-text-tertiary uppercase tracking-wider mb-1">
              Display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alice Johnson"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>

          <p className="text-[0.625rem] text-text-tertiary pt-1 border-t border-border-primary/50">
            You can add tags, add to groups, and edit notes after the contact is created.
          </p>
        </div>

        {error && (
          <p className="text-xs text-error" role="alert">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-primary">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus size={14} />}
            onClick={handleSave}
            disabled={saving || !email.trim()}
          >
            {saving ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
