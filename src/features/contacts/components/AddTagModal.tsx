import { useState } from "react";
import { Modal } from "@shared/components/ui/Modal";
import { Button } from "@shared/components/ui/Button";
import { useContactStore } from "@features/contacts/stores/contactStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";

interface AddTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId?: string | null;
}

export function AddTagModal({ isOpen, onClose, contactId: _contactId }: AddTagModalProps) {
  const primaryAccountId = useAccountStore((s) =>
    s.accounts.find((a) => a.isActive)?.id ?? "",
  );
  const createTag = useContactStore((s) => s.createTag);
  
  const [tagName, setTagName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!tagName.trim()) return;
    
    setCreating(true);
    try {
      await createTag(primaryAccountId, tagName.trim(), color);
      setTagName("");
      onClose();
    } catch (err) {
      console.error("Failed to create tag:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Tag"
      size="sm"
    >
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-primary mb-1.5">
            Tag Name
          </label>
          <input
            type="text"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="Enter tag name..."
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-primary mb-1.5">
            Color
          </label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full h-8 border border-border-primary rounded cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-primary">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={creating || !tagName.trim()}
          >
            {creating ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}