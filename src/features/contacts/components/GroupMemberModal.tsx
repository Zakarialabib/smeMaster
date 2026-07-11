import { useEffect, useState, useCallback } from "react";
import { Users, Trash2, Loader2 } from "lucide-react";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { ContactAvatar } from "@features/contacts/components/ContactAvatar";
import { Button } from "@shared/components/ui/Button";
import { Modal } from "@shared/components/ui/Modal";
import { MODAL_HEADER } from "@shared/styles/ui-tokens";
import type { ContactGroup } from "@features/contacts/stores/contactStore";

interface GroupMember {
  contact_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface GroupMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ContactGroup | null;
  onMemberRemoved?: (group: ContactGroup, contactId: string) => void;
}

/**
 * GroupMemberModal — shows all members of a group with remove action.
 * Non-blocking: does not delete the group itself, only contact-group links.
 */
export function GroupMemberModal({
  isOpen,
  onClose,
  group,
  onMemberRemoved,
}: GroupMemberModalProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    try {
      const list = await invokeCommand<GroupMember[]>("db_group_members", {
        groupId: group.id,
      });
      setMembers(list);
    } catch (err) {
      console.error("Failed to load group members:", err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    if (isOpen && group) load();
  }, [isOpen, group, load]);

  const handleRemove = useCallback(
    async (contactId: string) => {
      if (!group) return;
      setRemovingId(contactId);
      try {
        await invokeCommand("db_remove_contact_from_group", {
          groupId: group.id,
          contactId,
        });
        setMembers((prev) => prev.filter((m) => m.contact_id !== contactId));
        onMemberRemoved?.(group, contactId);
      } catch (err) {
        console.error("Failed to remove member:", err);
      } finally {
        setRemovingId(null);
      }
    },
    [group, onMemberRemoved],
  );

  if (!isOpen || !group) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={group.name}
      size="md"
      renderHeader={
        <div className={`${MODAL_HEADER} flex items-center gap-2`}>
          <Users size={16} className="text-accent shrink-0" />
          <div className="min-w-0 flex-1">
            <h3
              id="modal-title"
              className="text-sm font-semibold text-text-primary truncate"
            >
              {group.name}
            </h3>
            {group.description && (
              <p className="text-[0.625rem] text-text-tertiary truncate">
                {group.description}
              </p>
            )}
          </div>
        </div>
      }
    >
      {/* Stats */}
      <div className="px-4 py-2 border-b border-border-primary bg-bg-primary/40 flex items-center gap-2">
        <span className="text-[0.625rem] text-text-tertiary">
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 animate-pulse"
              >
                <div className="w-8 h-8 rounded-full bg-bg-tertiary" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-bg-tertiary rounded w-32" />
                  <div className="h-2.5 bg-bg-tertiary rounded w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8">
            <Users
              size={32}
              className="text-text-tertiary/30 mx-auto mb-2"
            />
            <p className="text-xs text-text-tertiary">No members yet</p>
            <p className="text-[0.625rem] text-text-tertiary mt-1">
              Add contacts to this group from the Contacts tab.
            </p>
          </div>
        ) : (
          <ul className="space-y-1" role="list">
            {members.map((m) => (
              <li
                key={m.contact_id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-bg-hover group"
              >
                <ContactAvatar
                  name={m.display_name}
                  email={m.email}
                  imageUrl={m.avatar_url}
                  size={28}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {m.display_name ?? m.email}
                  </p>
                  <p className="text-[0.625rem] text-text-tertiary truncate">
                    {m.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(m.contact_id)}
                  disabled={removingId === m.contact_id}
                  className="p-1.5 rounded text-text-tertiary hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 disabled:opacity-50 transition-opacity"
                  title="Remove from group"
                  aria-label={`Remove ${m.display_name ?? m.email}`}
                >
                  {removingId === m.contact_id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border-primary flex justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
