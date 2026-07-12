import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  X, Check, PenLine, UserPlus,
  Paperclip, Building2, ChevronDown, ChevronRight, Info, Activity, FolderOpen,
} from "lucide-react";
import { getContactFilesBySender, type ContactFile } from "@features/contacts/db/contactFiles";
import {
  getContactByEmail, getContactStats, getRecentThreadsWithContact,
  upsertContact, updateContact, updateContactFields,
  getAttachmentsFromContact, getContactsFromSameDomain, getLatestAuthResult,
  getContactEngagementData,
  type ContactStats, type DbContact, type ContactAttachment, type SameDomainContact, type ContactEngagementRow,
} from "../../../features/contacts/db/contacts.ts";
import { isVipSender, addVipSender, removeVipSender } from "@features/settings/db/notificationVips";
import { fetchAndCacheGravatarUrl } from "@features/contacts/services/gravatar";
import { getContactActivity, type ActivityEvent } from "@features/contacts/services/activity";
import { extractContactFromEmail, diffExtracted } from "@features/contacts/services/emailContactExtractor";
import { useThreadStore } from "@features/mail/stores/threadStore";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { getThreadById, getThreadLabelIds } from "@shared/services/db/threads";
import { navigateToThread, navigateToLabel } from "@/router/navigate";
import { formatRelativeDate } from "@shared/utils/date";
import { formatFileSize, getFileIcon } from "@shared/utils/fileTypeHelpers";
import { AuthBadge } from "./AuthBadge";
import { ContactAvatar } from "@features/contacts/components/ContactAvatar";
import { TagCloud } from "@features/contacts/components/TagCloud";
import { ContactQuickActions } from "@features/contacts/components/ContactQuickActions";
import { ContactTimeline } from "@features/contacts/components/ContactTimeline";
import { ContactStatsSummary } from "@features/contacts/components/ContactStatsSummary";
import { ContactFilesList } from "@features/contacts/components/ContactFilesList";
import { EngagementScoreBar } from "@features/contacts/components/EngagementScoreBar";
import { useContactNotes } from "@features/contacts/hooks/useContactNotes";
import { useContactStore } from "@features/contacts/stores/contactStore";

interface ContactSidebarProps {
  email: string;
  name: string | null;
  accountId: string;
  bodyText?: string | null;
  onClose: () => void;
}

export function ContactSidebar({ email, name, accountId, bodyText, onClose }: ContactSidebarProps) {
  const { t } = useTranslation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [recentThreads, setRecentThreads] = useState<{ thread_id: string; subject: string | null; last_message_at: number | null }[]>([]);
  const [contact, setContact] = useState<DbContact | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [attachments, setAttachments] = useState<ContactAttachment[]>([]);
  const [sameDomainContacts, setSameDomainContacts] = useState<SameDomainContact[]>([]);
  const [authResults, setAuthResults] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [extractFeedback, setExtractFeedback] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const [activeTab, setActiveTab] = useState<"info" | "activity" | "files">("info");
  const [vaultFiles, setVaultFiles] = useState<ContactFile[]>([]);
  const [engagement, setEngagement] = useState<ContactEngagementRow | null>(null);

  const loadedRef = useRef<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Notes hook (debounced auto-save) ──────────────────────────────────
  const { notes, handleChange: handleNotesChange, handleBlur: handleNotesBlur } = useContactNotes(
    email,
    contact?.notes ?? "",
  );

  const handleThreadClick = useCallback(async (threadId: string) => {
    const { threads, threadMap, setThreads } = useThreadStore.getState();
    if (threadMap.has(threadId)) {
      navigateToThread(threadId);
      return;
    }
    const dbThread = await getThreadById(accountId, threadId);
    if (!dbThread) return;
    const labelIds = await getThreadLabelIds(accountId, threadId);
    const mapped = {
      id: dbThread.id,
      accountId: dbThread.account_id,
      subject: dbThread.subject,
      snippet: dbThread.snippet,
      lastMessageAt: dbThread.last_message_at ?? 0,
      messageCount: dbThread.message_count,
      isRead: dbThread.is_read === 1,
      isStarred: dbThread.is_starred === 1,
      isPinned: dbThread.is_pinned === 1,
      isMuted: dbThread.is_muted === 1,
      hasAttachments: dbThread.has_attachments === 1,
      labelIds,
      fromName: dbThread.from_name,
      fromAddress: dbThread.from_address,
    };
    setThreads([...threads, mapped]);
    navigateToThread(threadId);
  }, [accountId]);

  useEffect(() => {
    if (!email) return;
    loadedRef.current = email;
    let cancelled = false;

    // Load contact + avatar
    getContactByEmail(email).then((c) => {
      if (cancelled) return;
      setContact(c);
      if (c?.avatar_url) {
        setAvatarUrl(c.avatar_url);
      } else {
        fetchAndCacheGravatarUrl(email).then((url) => {
          if (!cancelled) setAvatarUrl(url);
        });
      }
    });

    // Load stats
    getContactStats(email).then((s) => { if (!cancelled) setStats(s); });

    // Load recent threads
    getRecentThreadsWithContact(email).then((t) => { if (!cancelled) setRecentThreads(t); });

    // Load VIP status
    isVipSender(accountId, email).then((v) => { if (!cancelled) setIsVip(v); });

    // Load attachments from contact
    getAttachmentsFromContact(email).then((a) => { if (!cancelled) setAttachments(a); });

    // Load same-domain contacts
    getContactsFromSameDomain(email).then((c) => { if (!cancelled) setSameDomainContacts(c); });

    // Load auth results
    getLatestAuthResult(email).then((r) => { if (!cancelled) setAuthResults(r); });

    // Load activity timeline
    setActivityLoading(true);
    getContactActivity(accountId, email).then((events) => {
      if (!cancelled) setActivityEvents(events);
      setActivityLoading(false);
    });

    // Load tags for this contact once contact exists
    getContactByEmail(email).then((c) => {
      if (cancelled || !c) return;
      import("@features/contacts/services/tags").then(({ getContactTags }) => {
        getContactTags(c.id).then((tags) => {
          if (!cancelled) setTagIds(tags.map((t) => t.id));
        });
      });
    });

    // Load vault files
    getContactFilesBySender(email).then((files) => { if (!cancelled) setVaultFiles(files); });

    // Load engagement data
    getContactByEmail(email).then((c) => {
      if (cancelled || !c) return;
      getContactEngagementData(c.id).then((e) => {
        if (!cancelled) setEngagement(e);
      });
    });

    return () => { cancelled = true; };
  }, [email, accountId]);

  // -- Event handlers --

  const handleCompose = useCallback(() => {
    useComposerStore.getState().openComposer({ mode: "new", to: [email] });
  }, [email]);

  const handleCopyEmail = useCallback(() => {
    import("@shared/hooks/useClipboard").then(({ copyToClipboard }) => copyToClipboard(email));
    setCopyFeedback(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyFeedback(false), 1500);
  }, [email]);

  const handleToggleVip = useCallback(async () => {
    if (isVip) {
      await removeVipSender(accountId, email);
      setIsVip(false);
    } else {
      await addVipSender(accountId, email, name ?? undefined);
      setIsVip(true);
    }
  }, [accountId, email, name, isVip]);

  const handleAddContact = useCallback(async () => {
    await upsertContact(email, name);
    const c = await getContactByEmail(email);
    setContact(c);
    setAddedFeedback(true);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => setAddedFeedback(false), 1500);
  }, [email, name]);

  // Extract phone / tax id / address / company from the latest email body and
  // apply any fields the contact doesn't already have.
  const handleExtractFromEmail = useCallback(async () => {
    if (!contact || !bodyText) return;
    const extracted = extractContactFromEmail(bodyText, { existingPhone: contact.phone });
    const applied = diffExtracted(extracted, {
      phone: contact.phone,
      tax_id: contact.tax_id,
      address: contact.address,
    });
    const keys = Object.keys(applied);
    if (keys.length === 0) {
      setExtractFeedback(t("contact.extractNone"));
    } else {
      await updateContactFields(contact.id, applied as Record<string, unknown>);
      setExtractFeedback(
        t("contact.extractApplied", { fields: keys.join(", ") }),
      );
      const refreshed = await getContactByEmail(email);
      setContact(refreshed);
    }
    setTimeout(() => setExtractFeedback(null), 2500);
  }, [contact, bodyText, email]);

  const handleStartEditName = useCallback(() => {
    setEditNameValue(contact?.display_name ?? name ?? "");
    setEditingName(true);
  }, [contact, name]);

  const handleSaveEditName = useCallback(async () => {
    if (!contact) return;
    const trimmed = editNameValue.trim();
    await updateContact(contact.id, trimmed || null);
    setContact({ ...contact, display_name: trimmed || null });
    setEditingName(false);
  }, [contact, editNameValue]);

  const handleFilePreview = useCallback((_att: ContactAttachment) => {
    // Navigate to the attachments view where this file can be found
    navigateToLabel("attachments");
  }, []);

  const handleDomainContactClick = useCallback((_contactEmail: string) => {
    // Navigate to the people/contacts page for this person
    navigateToLabel("people");
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    };
  }, []);

  const displayName = contact?.display_name ?? name ?? email.split("@")[0];
  const domain = email.includes("@") ? email.split("@")[1] : null;

  return (
    <div className="w-72 h-full border-l border-border-primary bg-bg-secondary overflow-y-auto shrink-0">
      <div className="p-4">
        {/* Close button */}
        <div className="flex justify-end -mt-1 -mr-1 mb-1">
          <button
            onClick={onClose}
            title={t('contact.closeSidebar')}
            className="p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center text-center mb-4">
          <ContactAvatar
            imageUrl={avatarUrl}
            name={displayName}
            email={email}
            className="mb-2"
          />

          {/* Name + Auth Badge */}
          {editingName ? (
            <div className="flex items-center gap-1 mb-0.5">
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEditName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                autoFocus
                className="w-36 text-sm text-center bg-bg-primary border border-border-primary rounded px-1.5 py-0.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                onClick={handleSaveEditName}
                title="Save name"
                className="p-0.5 text-success hover:text-success/80 transition-colors"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-sm font-medium text-text-primary">
              <button
                type="button"
                onClick={handleCompose}
                title={t('contact.composeTo', { name: displayName })}
                className="inline-flex items-center gap-1 text-sm font-medium text-text-primary hover:text-accent transition-colors cursor-pointer bg-transparent border-none p-0"
              >
                {displayName}
              </button>
              <AuthBadge authResults={authResults} />
            </div>
          )}

          <button
            type="button"
            onClick={handleCopyEmail}
            title={t('contact.copyEmail')}
            className="text-xs text-text-tertiary mt-0.5 hover:text-accent transition-colors cursor-pointer bg-transparent border-none p-0"
          >
            {copyFeedback ? (
              <span className="inline-flex items-center gap-1 text-success">
                <Check size={12} />
                <span>{t("common.copied")}</span>
              </span>
            ) : (
              email
            )}
          </button>
        </div>

        <ContactQuickActions
          actions={["compose", "copy", "vip", "campaign"]}
          onCompose={handleCompose}
          onCopy={handleCopyEmail}
          onToggleVip={handleToggleVip}
          isVip={isVip}
          copyFeedback={copyFeedback}
          onCampaign={() => {
            // Navigate to campaign list (mini CRM integration)
            window.location.href = "/campaigns";
          }}
        />

        {/* Add / Edit Contact */}
        {!contact ? (
          <button
            onClick={handleAddContact}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-md hover:bg-accent/10 transition-colors mb-4"
          >
            {addedFeedback ? (
              <>
                <Check size={12} className="text-success" />
                <span className="text-success">{t('contact.added')}</span>
              </>
            ) : (
              <>
                <UserPlus size={12} />
                <span>{t('contact.addToContacts')}</span>
              </>
            )}
          </button>
        ) : !editingName ? (
          <button
            onClick={handleStartEditName}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors mb-4"
          >
            <PenLine size={11} />
            <span>{t('contact.editName')}</span>
          </button>
        ) : null}

        {/* Extract details from email */}
        {contact && bodyText && (
          <button
            onClick={handleExtractFromEmail}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-md hover:bg-accent/10 transition-colors mb-4"
          >
            <Building2 size={12} />
            <span>{t('contact.extractFromEmail')}</span>
          </button>
        )}
        {extractFeedback && (
          <p className="text-[0.625rem] text-success mb-4 text-center">{extractFeedback}</p>
        )}

        {/* Tab Bar */}
        <div className="flex border-b border-border-primary mb-3">
          {([
            { id: "info" as const, icon: Info, label: t('contact.info') },
            { id: "activity" as const, icon: Activity, label: t('contact.activity') },
            { id: "files" as const, icon: FolderOpen, label: t('contact.files') },
          ]).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-text-tertiary hover:text-text-secondary"
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "files" ? (
          <ContactFilesList files={vaultFiles} />
        ) : activeTab === "activity" ? (
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
              {t('contact.recentActivity')}
            </h4>
            <ContactTimeline events={activityEvents} isLoading={activityLoading} />
          </div>
        ) : (
          <>
            {/* Stats */}
            <ContactStatsSummary stats={stats} />

        {/* Engagement Score */}
        {engagement && (
          <EngagementScoreBar
            score={engagement.engagement_score}
            healthStatus={engagement.health_status}
            lastEngagedAt={engagement.last_engaged_at}
            size="sm"
          />
        )}

        {/* Contact Notes */}
        {contact && (
          <div className="mb-4">
            <button
              onClick={() => setNotesExpanded(!notesExpanded)}
              className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2 hover:text-text-secondary transition-colors"
            >
              {notesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {t('contact.notes')}
            </button>
            {notesExpanded && (
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder={t('contact.addANote')}
                rows={3}
                className="w-full text-xs bg-bg-primary border border-border-primary rounded-md px-2 py-1.5 text-text-secondary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent resize-y"
              />
            )}
          </div>
        )}

        {/* Tags */}
        {contact && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
              {t('contact.tags')}
            </h4>
            <TagCloud
              tagIds={tagIds}
              allTags={useContactStore.getState().tags}
              onAddTag={() => {}}
              onRemoveTag={(tagId) => {
                if (!contact) return;
                import("@features/contacts/services/tags").then(({ untagContact }) => {
                  untagContact(contact.id, tagId);
                  setTagIds((prev) => prev.filter((id) => id !== tagId));
                });
              }}
              editable={true}
            />
          </div>
        )}

        {/* Shared Files */}
        {attachments.length > 0 && (
          <div className="mb-4">
            <h4 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
              <Paperclip size={11} />
              {t('contact.sharedFiles')}
            </h4>
            <div className="space-y-1">
              {attachments.map((att, i) => (
                <button
                  type="button"
                  key={`${att.filename}-${att.date}-${i}`}
                  onClick={() => handleFilePreview(att)}
                  title={t('contact.previewFile', { filename: att.filename })}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-bg-hover transition-colors cursor-pointer text-left"
                >
                  <span className="shrink-0">{getFileIcon(att.mime_type)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-text-secondary truncate">{att.filename}</div>
                    <div className="text-text-tertiary text-[0.625rem]">
                      {att.size != null && formatFileSize(att.size)}
                      {att.size != null && " \u00B7 "}
                      {formatRelativeDate(att.date)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Same-Domain Contacts */}
        {sameDomainContacts.length > 0 && domain && (
          <div className="mb-4">
            <h4 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
              <Building2 size={11} />
              {t('contact.othersAtDomain', { domain })}
            </h4>
            <div className="space-y-1">
              {sameDomainContacts.map((c) => (
                <button
                  type="button"
                  key={c.email}
                  onClick={() => handleDomainContactClick(c.email)}
                  title={t('contact.viewPerson', { name: c.display_name ?? c.email })}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-bg-hover transition-colors cursor-pointer text-left"
                >
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="w-5 h-5 rounded-full shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[0.5rem] font-semibold shrink-0">
                      {(c.display_name?.[0] ?? c.email[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-text-secondary truncate">
                      {c.display_name ?? c.email.split("@")[0]}
                    </div>
                    <div className="text-text-tertiary text-[0.625rem] truncate">{c.email}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent threads */}
        {recentThreads.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
              {t('contact.recentConversations')}
            </h4>
            <div className="space-y-1">
              {recentThreads.map((thread) => (
                <button
                  key={thread.thread_id}
                  onClick={() => handleThreadClick(thread.thread_id)}
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-bg-hover transition-colors group"
                >
                  <div className="text-text-secondary group-hover:text-text-primary truncate">
                    {thread.subject ?? "(No subject)"}
                  </div>
                  {thread.last_message_at && (
                    <div className="text-text-tertiary text-[0.625rem] mt-0.5">
                      {formatRelativeDate(thread.last_message_at)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

          </>
        )}
      </div>
    </div>
  );
}



