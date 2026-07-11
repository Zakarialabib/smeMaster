import { useState } from "react";
import { Modal } from "@shared/components/ui/Modal";
import { Button } from "@shared/components/ui/Button";
import { useContactStore } from "@features/contacts/stores/contactStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";

interface AddSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddSegmentModal({ isOpen, onClose }: AddSegmentModalProps) {
  const primaryAccountId = useAccountStore((s) =>
    s.accounts.find((a) => a.isActive)?.id ?? "",
  );
  const createSegment = useContactStore((s) => s.createSegment);
  
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !query.trim()) return;
    
    setCreating(true);
    try {
      await createSegment(primaryAccountId, name.trim(), query.trim());
      setName("");
      setQuery("");
      onClose();
    } catch (err) {
      console.error("Failed to create segment:", err);
    } finally {
      setCreating(false);
    }
  };

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
            Segment Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., High Value Clients"
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-primary mb-1.5">
            Query
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., tags:important AND frequency:>5"
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent"
          />
          <p className="text-[0.65rem] text-text-tertiary mt-1">
            Use query syntax like: <code>tags:name</code>, <code>frequency:&gt;N</code>, <code>last_contacted_at:&lt;timestamp</code>
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-primary">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={creating || !name.trim() || !query.trim()}
          >
            {creating ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}