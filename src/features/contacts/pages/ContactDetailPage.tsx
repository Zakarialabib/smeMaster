import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  User,
  Mail,
  Paperclip,
  StickyNote,
  Activity,
  FolderOpen,
  Megaphone,
  AlertCircle,
} from "lucide-react";

import { useAccountStore } from "@features/accounts/stores/accountStore";
import { usePlatform } from "@shared/hooks/usePlatform";
import {
  getContactById,
  getContactStats,
  getContactEngagementData,
  updateContact,
  type DbContact,
  type ContactStats,
  type ContactEngagementRow,
} from "@features/contacts/db/contacts";
import { getContactFilesBySender, type ContactFile } from "@features/contacts/db/contactFiles";
import { getCampaignsForContact } from "@features/campaigns/db/campaignRecipients";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { invokeCommand } from "@shared/services/db/invoke/command";

import { ContactFilesList } from "@features/contacts/components/ContactFilesList";
import { ContactCampaignHistory } from "@features/contacts/components/ContactCampaignHistory";
import type { CampaignHistoryEntry } from "@features/contacts/components/ContactCampaignHistory";
import { useContactNotes } from "@features/contacts/hooks/useContactNotes";
import { ContactHeroCard } from "@features/contacts/components/ContactHeroCard";
import { ContactQuickEditModal } from "@features/contacts/components/ContactQuickEditModal";
import { SlideOverComposer } from "@features/contacts/components/SlideOverComposer";
import {
  ContactInfoCard,
  ContactInfoTab,
  ContactEmailsTab,
  ContactAttachmentsTab,
  ContactNotesTab,
  ContactActivityTab,
  type ContactTag,
  type ContactGroupInfo,
  type DetailTab,
  type TabDefinition,
} from "@features/contacts/components/contactDetail";

// ─── Tab configuration ─────────────────────────────────────────────────────

const TABS: TabDefinition[] = [
  { id: "info", label: "Info", icon: User },
  { id: "emails", label: "Emails", icon: Mail },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "activity", label: "Activity", icon: Activity },
];

const VALID_TABS: DetailTab[] = TABS.map((t) => t.id);

function readTabFromUrl(): DetailTab {
  if (typeof window === "undefined") return "info";
  const params = new URLSearchParams(window.location.search);
  const t = params.get("tab") as DetailTab | null;
  if (t && VALID_TABS.includes(t)) return t;
  return "info";
}

// ─── Main component ────────────────────────────────────────────────────────

export function ContactDetailPage() {
  const { contactId } = useParams({ strict: false }) as { contactId: string };
  const navigate = useNavigate();
  const { screen } = usePlatform();
  const isMobile = screen.isMobile;
  const primaryAccountId = useAccountStore((s) =>
    s.accounts.find((a) => a.isActive)?.id ?? "",
  );

  // ── Active tab (URL-persisted) ──
  const [activeTab, setActiveTab] = useState<DetailTab>(() => readTabFromUrl());

  // ── Contact state ──
  const [contact, setContact] = useState<DbContact | null>(null);
  const [contactLoading, setContactLoading] = useState(true);
  const [contactError, setContactError] = useState<string | null>(null);

  // ── Engagement & stats ──
  const [engagement, setEngagement] = useState<ContactEngagementRow | null>(null);
  const [stats, setStats] = useState<ContactStats | null>(null);

  // ── Tags & Groups ──
  const [contactTags, setContactTags] = useState<ContactTag[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroupInfo[]>([]);

  // ── Files state ──
  const [vaultFiles, setVaultFiles] = useState<ContactFile[]>([]);

  // ── Campaign history state ──
  const [campaignHistory, setCampaignHistory] = useState<CampaignHistoryEntry[]>([]);
  const [campaignHistoryLoading, setCampaignHistoryLoading] = useState(false);

  // ── Notes hook (debounced auto-save) ──
  const {
    notes,
    handleChange: handleNotesChange,
    handleBlur: handleNotesBlur,
    isDirty: notesDirty,
  } = useContactNotes(contact?.email ?? "", contact?.notes ?? "");
  const [notesSaveStatus, setNotesSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // ── Quick edit modal ──
  const [showQuickEdit, setShowQuickEdit] = useState(false);

  // ── Slide-over composer ──
  const [showComposer, setShowComposer] = useState(false);

  // ── URL tab sync ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") !== activeTab) {
      url.searchParams.set("tab", activeTab);
      window.history.replaceState({}, "", url.toString());
    }
  }, [activeTab]);

  // ── Load contact ──
  useEffect(() => {
    if (!contactId) return;
    let cancelled = false;

    const load = async () => {
      setContactLoading(true);
      setContactError(null);
      try {
        const c = await getContactById(contactId);
        if (cancelled) return;
        setContact(c);
      } catch (err) {
        if (cancelled) return;
        setContactError(err instanceof Error ? err.message : "Failed to load contact");
      } finally {
        if (!cancelled) setContactLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [contactId]);

  // ── Load engagement, stats, tags, groups when contact available ──
  useEffect(() => {
    if (!contact) return;
    let cancelled = false;

    getContactEngagementData(contact.id).then((e) => {
      if (!cancelled) setEngagement(e);
    });

    getContactStats(contact.email).then((s) => {
      if (!cancelled) setStats(s);
    });

    invokeCommand<ContactTag[]>("db_contact_tags", { contactId: contact.id }).then((tags) => {
      if (!cancelled) setContactTags(tags);
    });

    invokeCommand<ContactGroupInfo[]>("db_contact_groups", { contactId: contact.id }).then((groups) => {
      if (!cancelled) setContactGroups(groups);
    });

    getContactFilesBySender(contact.email).then((files) => {
      if (!cancelled) setVaultFiles(files);
    });

    setCampaignHistoryLoading(true);
    getCampaignsForContact(contact.id).then((campaigns) => {
      if (!cancelled) {
        setCampaignHistory(campaigns as CampaignHistoryEntry[]);
        setCampaignHistoryLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [contact]);

  // ── Notes save status indicator ──
  useEffect(() => {
    if (!contact) return;
    if (notesDirty) {
      setNotesSaveStatus("saving");
      const t = setTimeout(() => setNotesSaveStatus("saved"), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [notes, notesDirty, contact]);

  // ── Handlers ──
  const handleSaveName = useCallback(
    async (name: string | null) => {
      if (!contact) return;
      await updateContact(contact.id, name);
      setContact({ ...contact, display_name: name });
    },
    [contact],
  );

  const handleRemoveTag = useCallback(
    async (tagId: string) => {
      if (!contact) return;
      try {
        await invokeCommand("db_remove_contact_tag", { contactId: contact.id, tagId });
        setContactTags((prev) => prev.filter((t) => t.id !== tagId));
      } catch (err) {
        console.error("Failed to remove tag:", err);
      }
    },
    [contact],
  );

  const handleRemoveGroup = useCallback(
    async (groupId: string) => {
      if (!contact) return;
      try {
        await invokeCommand("db_remove_contact_from_group", {
          groupId,
          contactId: contact.id,
        });
        setContactGroups((prev) => prev.filter((g) => g.id !== groupId));
      } catch (err) {
        console.error("Failed to remove group:", err);
      }
    },
    [contact],
  );

  const handleQuickEditSave = useCallback(
    async (updates: { display_name: string | null; email: string; notes: string | null }) => {
      if (!contact) return;
      if (updates.display_name !== contact.display_name) {
        await updateContact(contact.id, updates.display_name);
        setContact({ ...contact, display_name: updates.display_name });
      }
      if (updates.notes !== contact.notes) {
        // Notes use the same hook pipeline; just persist directly here
        await invokeCommand("db_update_contact", {
          id: contact.id,
          updates: { set: { notes: updates.notes, updated_at: Math.floor(Date.now() / 1000) } },
        });
        setContact({ ...contact, notes: updates.notes });
      }
    },
    [contact],
  );

  // ── Derived values ──
  const displayName = useMemo(
    () => contact?.display_name ?? contact?.email.split("@")[0] ?? "Unknown",
    [contact],
  );

  // ── Tab content router ──
  const renderTabContent = () => {
    if (contactLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-sm text-text-tertiary">Loading contact...</p>
          </div>
        </div>
      );
    }

    if (contactError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
          <AlertCircle size={48} className="text-danger/60" />
          <p className="text-sm font-medium text-text-primary">Failed to load contact</p>
          <p className="text-xs text-text-tertiary text-center max-w-sm">{contactError}</p>
          <button
            onClick={() => navigate({ to: "/people" })}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
          >
            <ArrowLeft size={13} />
            Back to contacts
          </button>
        </div>
      );
    }

    if (!contact) {
      return (
        <EmptyState
          icon={User}
          title="Contact not found"
          subtitle="This contact may have been deleted"
        />
      );
    }

    switch (activeTab) {
      case "info":
        return (
          <div className="flex flex-col gap-5 p-5">
            {/* Sidebar: legacy ContactInfoCard (kept for parity) */}
            <div className="w-full">
              <ContactInfoCard
                contact={contact}
                engagement={engagement}
                editingName={false}
                editNameValue=""
                onEditNameChange={() => {}}
                onStartEditName={() => {}}
                onSaveEditName={() => {}}
                onCancelEditName={() => {}}
              />
            </div>
            <div className="flex-1 min-w-0">
              <ContactInfoTab
                contact={contact}
                engagement={engagement}
                stats={stats}
                contactTags={contactTags}
                contactGroups={contactGroups}
              />
            </div>
          </div>
        );

      case "emails":
        return <ContactEmailsTab email={contact.email} />;

      case "attachments":
        return <ContactAttachmentsTab email={contact.email} />;

      case "notes":
        return (
          <ContactNotesTab
            notes={notes}
            notesDirty={notesDirty}
            onNotesChange={handleNotesChange}
            onNotesBlur={handleNotesBlur}
          />
        );

      case "files":
        return (
          <div className="p-5">
            <ContactFilesList files={vaultFiles} />
          </div>
        );

      case "campaigns":
        return (
          <ContactCampaignHistory
            campaigns={campaignHistory}
            isLoading={campaignHistoryLoading}
          />
        );

      case "activity":
        return (
          <ContactActivityTab email={contact.email} accountId={primaryAccountId} />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg-primary/50">
      {/* Header with back button + breadcrumb */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b border-border-primary shrink-0 bg-bg-primary/60 backdrop-blur-sm ${isMobile ? "safe-area-top" : ""}`}>
        <button
          onClick={() => navigate({ to: "/people" })}
          className={`p-1 -ml-1 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors ${isMobile ? "min-h-[44px] min-w-[44px] flex items-center justify-center" : ""}`}
          aria-label="Back to contacts"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary min-w-0">
          <span>Contacts</span>
          <span>/</span>
          <span className="text-text-primary truncate font-medium">
            {contactLoading ? "Loading..." : displayName}
          </span>
        </div>
      </div>

      {/* Hero card (when contact loaded) */}
      {contact && !contactLoading && (
        <ContactHeroCard
          contact={contact}
          stats={stats}
          engagement={engagement}
          tags={contactTags}
          groups={contactGroups}
          notesSaveStatus={notesSaveStatus}
          onSaveName={handleSaveName}
          onCompose={() => setShowComposer(true)}
          onAddTag={() => {
            // Phase 4: open tag picker modal
            void 0;
          }}
          onAddGroup={() => {
            // Phase 4: open group picker modal
            void 0;
          }}
          onRemoveTag={handleRemoveTag}
          onRemoveGroup={handleRemoveGroup}
          onEdit={() => setShowQuickEdit(true)}
        />
      )}

      {/* Tab bar */}
      <div className="flex items-center border-b border-border-primary bg-bg-primary/30 shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${isMobile ? "min-h-[44px]" : ""} ${
                isActive
                  ? "text-accent border-accent"
                  : "text-text-tertiary border-transparent hover:text-text-secondary"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className={`flex-1 overflow-y-auto ${isMobile ? "safe-area-bottom" : ""}`}>{renderTabContent()}</div>

      {/* Modals */}
      <ContactQuickEditModal
        isOpen={showQuickEdit}
        onClose={() => setShowQuickEdit(false)}
        contact={contact}
        onSave={handleQuickEditSave}
      />

      <SlideOverComposer
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
        contact={contact}
        accountId={primaryAccountId}
      />
    </div>
  );
}
