import { useState, useEffect, useCallback } from "react";
import { Save } from "lucide-react";
import type { DbContact } from "@features/contacts/db/contacts";
import { Button } from "@shared/components/ui/Button";
import { Modal } from "@shared/components/ui/Modal";

interface ContactQuickEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: DbContact | null;
  onSave: (updates: { display_name: string | null; email: string; notes: string | null }) => Promise<void>;
}

/**
 * ContactQuickEditModal — quick-edit dialog for name, email, and notes.
 * Replaces scattered edit affordances.
 */
export function ContactQuickEditModal({
  isOpen,
  onClose,
  contact,
  onSave,
}: ContactQuickEditModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && contact) {
      setName(contact.display_name ?? "");
      setEmail(contact.email);
      setNotes(contact.notes ?? "");
      setError(null);
    }
  }, [isOpen, contact]);

  const handleSave = useCallback(async () => {
    if (!contact) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        display_name: name.trim() || null,
        email: email.trim(),
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [contact, name, email, notes, onSave, onClose]);

  if (!isOpen || !contact) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick edit" size="sm">
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Display name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-text-primary outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-text-primary outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Personal notes about this contact…"
            rows={8}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-text-primary outline-none focus:border-accent resize-none"
          />
        </div>

        {error && (
          <p className="text-xs text-error">{error}</p>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border-primary flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <div className="flex-1" />
        <Button
          variant="primary"
          size="sm"
          icon={<Save size={14} />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
