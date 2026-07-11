import { useMemo } from "react";
import { Pencil, Check, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { DbContact, ContactEngagementRow } from "@features/contacts/db/contacts";
import { ContactAvatar } from "../ContactAvatar";
import { ContactQuickActions } from "../ContactQuickActions";
import { EngagementScoreBar } from "../EngagementScoreBar";

export interface ContactInfoCardProps {
  contact: DbContact;
  engagement: ContactEngagementRow | null;
  /** Name editing mode */
  editingName: boolean;
  editNameValue: string;
  onEditNameChange: (value: string) => void;
  onStartEditName: () => void;
  onSaveEditName: () => void;
  onCancelEditName: () => void;
}

export function ContactInfoCard({
  contact,
  engagement,
  editingName,
  editNameValue,
  onEditNameChange,
  onStartEditName,
  onSaveEditName,
  onCancelEditName,
}: ContactInfoCardProps) {
  const navigate = useNavigate();

  const displayName = useMemo(
    () => contact.display_name ?? contact.email.split("@")[0] ?? "Unknown",
    [contact],
  );



  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4 sm:p-5">
      {/* Avatar + Name + Email */}
      <div className="flex flex-col items-center text-center mb-4">
        <ContactAvatar
          name={displayName}
          email={contact.email}
          className="mb-3"
        />

        {editingName ? (
          <div className="flex items-center gap-1 mb-1">
            <input
              type="text"
              value={editNameValue}
              onChange={(e) => onEditNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEditName();
                if (e.key === "Escape") onCancelEditName();
              }}
              autoFocus
              className="w-40 text-sm text-center bg-bg-primary border border-border-primary rounded px-1.5 py-0.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={onSaveEditName}
              title="Save name"
              className="p-0.5 text-success hover:text-success/80 transition-colors"
            >
              <Check size={14} />
            </button>
            <button
              onClick={onCancelEditName}
              title="Cancel"
              className="p-0.5 text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-text-primary">{displayName}</h2>
            <button
              onClick={onStartEditName}
              className="p-0.5 text-text-tertiary hover:text-accent transition-colors"
              title="Edit name"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}

        <p className="text-xs text-text-tertiary">{contact.email}</p>
      </div>

      {/* Engagement score bar */}
      <EngagementScoreBar
        score={engagement?.engagement_score ?? 0}
        healthStatus={engagement?.health_status}
        lastEngagedAt={engagement?.last_engaged_at}
      />

      <ContactQuickActions
        actions={["email", "task", "campaign"]}
        onEmail={() => navigate({ to: "/mail/$label", params: { label: "inbox" }, search: { q: contact.email } })}
        onTask={() => navigate({ to: "/tasks" })}
        onCampaign={() => navigate({ to: "/campaigns" })}
        size="sm"
      />
    </div>
  );
}
