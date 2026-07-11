import { useState, useCallback } from "react";
import { Pencil, Check, X, Mail, Plus, Users, Edit3 } from "lucide-react";
import type { DbContact, ContactStats, ContactEngagementRow } from "@features/contacts/db/contacts";
import { ContactAvatar } from "@features/contacts/components/ContactAvatar";
import { Button } from "@shared/components/ui/Button";
import { formatRelativeDate } from "@shared/utils/date";
import { getHealthStyle } from "@shared/utils/scoreVariant";

export interface ContactHeroCardProps {
  contact: DbContact;
  stats: ContactStats | null;
  engagement: ContactEngagementRow | null;
  tags: Array<{ id: string; name: string; color: string | null }>;
  groups: Array<{ id: string; name: string }>;
  savingNotes?: boolean;
  notesSaveStatus?: "idle" | "saving" | "saved" | "error";
  onSaveName: (name: string | null) => Promise<void>;
  onCompose: () => void;
  onAddTag: () => void;
  onAddGroup: () => void;
  onRemoveTag: (tagId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onEdit?: () => void;
}

export function ContactHeroCard({
  contact,
  stats,
  engagement,
  tags,
  groups,
  notesSaveStatus = "idle",
  onSaveName,
  onCompose,
  onAddTag,
  onAddGroup,
  onRemoveTag,
  onRemoveGroup,
  onEdit,
}: ContactHeroCardProps) {
  const [editingName, setEditingName] = useState(false);
  const [editValue, setEditValue] = useState("");

  const startEdit = useCallback(() => {
    setEditValue(contact.display_name ?? "");
    setEditingName(true);
  }, [contact.display_name]);

  const cancelEdit = useCallback(() => {
    setEditingName(false);
    setEditValue("");
  }, []);

  const saveEdit = useCallback(async () => {
    const trimmed = editValue.trim();
    await onSaveName(trimmed || null);
    setEditingName(false);
    setEditValue("");
  }, [editValue, onSaveName]);

  const healthStatus = engagement?.health_status ?? null;
  const health = getHealthStyle(healthStatus);
  const score = engagement?.engagement_score ?? 0;
  const scorePercent = Math.round(score * 100);

  return (
    <div className="px-5 py-4 border-b border-border-primary bg-bg-primary/40">
      <div className="flex items-start gap-4 flex-wrap">
        {/* Avatar */}
        <ContactAvatar
          name={contact.display_name}
          email={contact.email}
          imageUrl={contact.avatar_url}
          size={64}
          className="shrink-0"
        />

        {/* Name + email + actions */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="text-base font-semibold text-text-primary bg-bg-tertiary border border-accent rounded px-2 py-0.5 outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={saveEdit}
                  className="p-1 rounded text-success hover:bg-success/10"
                  aria-label="Save name"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="p-1 rounded text-text-tertiary hover:bg-bg-hover"
                  aria-label="Cancel edit"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <h1
                  className="text-base font-semibold text-text-primary truncate"
                  title={contact.display_name ?? contact.email}
                >
                  {contact.display_name ?? contact.email}
                </h1>
                <button
                  type="button"
                  onClick={startEdit}
                  className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover shrink-0"
                  title="Edit name"
                  aria-label="Edit name"
                >
                  <Pencil size={12} />
                </button>
              </>
            )}
          </div>

          <p className="text-xs text-text-tertiary truncate" title={contact.email}>
            {contact.email}
          </p>

          {/* Health + Score badges */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {healthStatus && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-medium ${health.bg} ${health.text}`}
              >
                {health.label}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-[0.625rem] text-text-tertiary uppercase tracking-wider">
                Score
              </span>
              <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${health.barColor}`}
                  style={{ width: `${scorePercent}%` }}
                />
              </div>
              <span className="text-[0.625rem] font-medium text-text-primary tabular-nums">
                {scorePercent}%
              </span>
            </div>
            {stats && (
              <>
                <span className="text-[0.625rem] text-text-tertiary">
                  • {stats.emailCount ?? 0} emails
                </span>
                {stats.lastEmail && (
                  <span className="text-[0.625rem] text-text-tertiary">
                    • Last: {formatRelativeDate(stats.lastEmail)}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Tags + Groups */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {tags.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-medium"
                style={{
                  backgroundColor: `${t.color ?? "var(--color-accent)"}20`,
                  color: t.color ?? "var(--color-accent)",
                }}
              >
                {t.name}
                <button
                  type="button"
                  onClick={() => onRemoveTag(t.id)}
                  className="hover:opacity-70"
                  aria-label={`Remove tag ${t.name}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {groups.map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-medium bg-bg-tertiary text-text-secondary"
              >
                <Users size={9} />
                {g.name}
                <button
                  type="button"
                  onClick={() => onRemoveGroup(g.id)}
                  className="hover:opacity-70"
                  aria-label={`Remove group ${g.name}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={onAddTag}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[0.625rem] text-text-tertiary hover:text-accent hover:bg-bg-hover border border-dashed border-border-primary"
            >
              <Plus size={9} />
              Tag
            </button>
            <button
              type="button"
              onClick={onAddGroup}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[0.625rem] text-text-tertiary hover:text-accent hover:bg-bg-hover border border-dashed border-border-primary"
            >
              <Plus size={9} />
              Group
            </button>
          </div>

          {/* Notes save indicator */}
          {notesSaveStatus !== "idle" && (
            <p className="text-[0.625rem] text-text-tertiary mt-1.5">
              {notesSaveStatus === "saving" && "Saving notes…"}
              {notesSaveStatus === "saved" && "✓ Notes saved"}
              {notesSaveStatus === "error" && "Failed to save notes"}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="primary"
            size="sm"
            icon={<Mail size={14} />}
            onClick={onCompose}
          >
            Email
          </Button>
          {onEdit && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Edit3 size={14} />}
              onClick={onEdit}
              title="Quick edit"
              aria-label="Quick edit contact"
            >
              Edit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
