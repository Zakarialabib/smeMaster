import { useState, useCallback, useEffect } from "react";
import { Modal } from "@shared/components/ui/Modal";
import { Button } from "@shared/components/ui/Button";
import { useTranslation } from "react-i18next";
import { useFormField } from "@shared/hooks/useFormField";
import { required } from "@shared/utils/validators";
import { useContactStore } from "@features/contacts/stores/contactStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";

interface AddSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddSegmentModal({ isOpen, onClose }: AddSegmentModalProps) {
  const { t } = useTranslation();
  const primaryAccountId = useAccountStore((s) =>
    s.accounts.find((a) => a.isActive)?.id ?? "",
  );
  const createSegment = useContactStore((s) => s.createSegment);

  const nameField = useFormField({ validator: required });
  const queryField = useFormField({ validator: required });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      nameField.reset();
      queryField.reset();
      setCreating(false);
    }
  }, [isOpen]);

  const handleCreate = useCallback(async () => {
    // Touch both fields so validation messages surface.
    nameField.onBlur();
    queryField.onBlur();
    if (!nameField.value.trim() || !queryField.value.trim()) return;

    setCreating(true);
    try {
      await createSegment(primaryAccountId, nameField.value.trim(), queryField.value.trim());
      onClose();
    } catch (err) {
      console.error("Failed to create segment:", err);
    } finally {
      setCreating(false);
    }
  }, [nameField, queryField, primaryAccountId, createSegment, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Segment"
      size="md"
    >
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-primary mb-1.5">
            Segment Name <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={nameField.value}
            onChange={(e) => nameField.onChange(e.target.value)}
            onBlur={nameField.onBlur}
            placeholder="e.g., High Value Clients"
            autoFocus
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent"
          />
          {nameField.error && (
            <p className="text-error text-xs mt-1" role="alert">
              {t(nameField.error)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-text-primary mb-1.5">
            Query <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={queryField.value}
            onChange={(e) => queryField.onChange(e.target.value)}
            onBlur={queryField.onBlur}
            placeholder="e.g., tags:important AND frequency:>5"
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent"
          />
          {queryField.error && (
            <p className="text-error text-xs mt-1" role="alert">
              {t(queryField.error)}
            </p>
          )}
          <p className="text-[0.65rem] text-text-tertiary mt-1">
            Use query syntax like: <code>tags:name</code>, <code>frequency:&gt;N</code>, <code>last_contacted_at:&lt;timestamp</code>
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-primary">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={creating || !nameField.value.trim() || !queryField.value.trim()}
          >
            {creating ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
