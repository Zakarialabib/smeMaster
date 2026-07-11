import { useState, useEffect } from "react";
import { Search, CheckSquare, Square, Users, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getContactCountForGroup } from "@features/contacts/db/contactGroups";
import { evaluateSegmentQuery } from "@features/contacts/services/segments";
import type { AudienceMode } from "@features/campaigns/stores/campaignComposerStore";

interface Contact {
  id: string;
  name: string;
  email: string;
  display_name: string | null;
  company: string | null;
}

interface ContactGroup {
  id: string;
  name: string;
}

interface ContactSegment {
  id: string;
  name: string;
  query: string;
}

interface AudienceStepProps {
  name: string;
  onNameChange: (name: string) => void;
  audienceMode: AudienceMode;
  onAudienceModeChange: (mode: AudienceMode) => void;
  selectedContactIds: string[];
  onToggleContact: (id: string) => void;
  onToggleAll: () => void;
  contactSearch: string;
  onContactSearchChange: (search: string) => void;
  groups: ContactGroup[];
  segments: ContactSegment[];
  selectedGroupId: string;
  onGroupSelect: (id: string) => void;
  selectedSegmentId: string;
  onSegmentSelect: (id: string) => void;
  contactsLoading: boolean;
  allSelected: boolean;
  filteredContacts: Contact[];
  accountId: string;
}

export function AudienceStep({
  name,
  onNameChange,
  audienceMode,
  onAudienceModeChange,
  selectedContactIds,
  onToggleContact,
  onToggleAll,
  contactSearch,
  onContactSearchChange,
  groups,
  segments,
  selectedGroupId,
  onGroupSelect,
  selectedSegmentId,
  onSegmentSelect,
  contactsLoading,
  allSelected,
  filteredContacts,
  accountId,
}: AudienceStepProps) {
  const { t } = useTranslation();
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // Compute recipient count asynchronously when selection changes
  useEffect(() => {
    let cancelled = false;

    async function computeCount() {
      setCountLoading(true);
      try {
        if (audienceMode === "contacts") {
          setRecipientCount(selectedContactIds.length);
        } else if (audienceMode === "group" && selectedGroupId) {
          const count = await getContactCountForGroup(selectedGroupId);
          if (!cancelled) setRecipientCount(count);
        } else if (audienceMode === "segment" && selectedSegmentId) {
          const segment = segments.find((s) => s.id === selectedSegmentId);
          if (segment) {
            const ids = await evaluateSegmentQuery(accountId, segment.query);
            if (!cancelled) setRecipientCount(ids.length);
          }
        } else {
          setRecipientCount(null);
        }
      } catch {
        setRecipientCount(null);
      } finally {
        if (!cancelled) setCountLoading(false);
      }
    }

    if (
      audienceMode === "contacts" ||
      (audienceMode === "group" && selectedGroupId) ||
      (audienceMode === "segment" && selectedSegmentId)
    ) {
      computeCount();
    } else {
      setRecipientCount(null);
    }

    return () => { cancelled = true; };
  }, [audienceMode, selectedContactIds, selectedGroupId, selectedSegmentId, accountId, segments]);

  return (
    <div className="space-y-3">
      <label className="text-sm text-text-primary font-medium">{t('campaign.campaignName')}</label>
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t('campaign.namePlaceholder')}
        className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-1 focus:ring-accent"
        autoFocus
      />

      <label className="text-sm text-text-primary font-medium">{t('campaign.selectAudience')}</label>
      <div className="flex gap-2">
        {(["contacts", "group", "segment"] as AudienceMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onAudienceModeChange(mode)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
              audienceMode === mode
                ? "bg-accent/10 border-accent text-accent"
                : "bg-bg-secondary border-border-primary text-text-secondary hover:border-accent/50"
            }`}
          >
            {mode === "contacts" ? t('campaign.individualContacts') : mode === "group" ? t('campaign.contactGroup') : t('campaign.segment')}
          </button>
        ))}
      </div>

      {/* Recipient count badge */}
      {recipientCount !== null && recipientCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-accent/5 border border-accent/15 rounded-lg px-3 py-1.5">
          <Users size={12} className="text-accent" />
          {countLoading ? (
            <span>{t('common.loading')}</span>
          ) : (
            <span>{t('campaign.nRecipients', { n: recipientCount })}</span>
          )}
        </div>
      )}

      {audienceMode === "contacts" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-lg border border-border-primary">
            <Search size={14} className="text-text-tertiary shrink-0" />
            <input
              type="text"
              value={contactSearch}
              onChange={(e) => onContactSearchChange(e.target.value)}
              placeholder={t('campaign.searchContactsPlaceholder')}
              className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-tertiary"
            />
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-text-tertiary flex items-center gap-1">
              <Users size={12} />
              {t('campaign.nSelected', { n: selectedContactIds.length })}
            </span>
            <button onClick={onToggleAll} className="text-xs text-accent hover:underline flex items-center gap-1">
              {allSelected ? <Square size={12} /> : <CheckSquare size={12} />}
              {allSelected ? t('campaign.deselectAll') : t('email.selectAll')}
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {contactsLoading ? (
              <p className="text-xs text-text-tertiary px-1 py-2">{t('common.loading')}</p>
            ) : filteredContacts.length === 0 ? (
              <p className="text-xs text-text-tertiary px-1 py-2">
                {contactSearch ? t('contact.noMatchingContacts') : t('campaign.noContactsYet')}
              </p>
            ) : (
              filteredContacts.map((c) => {
                const isSelected = selectedContactIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => onToggleContact(c.id)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left text-sm hover:bg-bg-hover transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare size={14} className="text-accent shrink-0" />
                    ) : (
                      <Square size={14} className="text-text-tertiary shrink-0" />
                    )}
                    <span className="text-text-primary truncate">{c.name}</span>
                    <span className="text-text-tertiary text-xs truncate">{c.email}</span>
                    {c.company && (
                      <span className="inline-flex items-center gap-1 text-[0.625rem] text-text-tertiary bg-bg-tertiary/50 px-1.5 py-0.5 rounded shrink-0">
                        <Building2 size={10} className="shrink-0" />
                        {c.company}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {audienceMode === "group" && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {groups.length === 0 ? (
            <p className="text-xs text-text-tertiary px-1 py-2">{t('campaign.noContactGroupsYet')}</p>
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                onClick={() => onGroupSelect(g.id)}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  selectedGroupId === g.id
                    ? "bg-accent/10 border border-accent text-accent"
                    : "bg-bg-secondary border border-border-primary text-text-secondary hover:border-accent/50"
                }`}
              >
                <Users size={14} className="shrink-0" />
                <span className="truncate">{g.name}</span>
              </button>
            ))
          )}
        </div>
      )}

      {audienceMode === "segment" && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {segments.length === 0 ? (
            <p className="text-xs text-text-tertiary px-1 py-2">{t('campaign.noSegmentsYet')}</p>
          ) : (
            segments.map((s) => (
              <button
                key={s.id}
                onClick={() => onSegmentSelect(s.id)}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  selectedSegmentId === s.id
                    ? "bg-accent/10 border border-accent text-accent"
                    : "bg-bg-secondary border border-border-primary text-text-secondary hover:border-accent/50"
                }`}
              >
                <Users size={14} className="shrink-0" />
                <span className="truncate">{s.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
