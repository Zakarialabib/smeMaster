import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Search,
  Users,
  Filter,
  Upload,
  GitMerge,
  Plus,
  Tag as TagIcon,
  Eye,
  Trash2,
  History,
  UserPlus,
  X,
} from "lucide-react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useContactStore, type ContactGroup, type ContactSegment } from "@features/contacts/stores/contactStore";
import { getAllContacts, countAllContacts, type DbContact } from "@features/contacts/db/contacts";
import { GroupManager } from "@features/contacts/components/GroupManager";
import { CsvImportWizard } from "@features/contacts/components/CsvImportWizard";
import { ContactMergeDialog } from "@features/contacts/components/ContactMergeDialog";
import { Button } from "@shared/components/ui/Button";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { PageScaffold } from "@shared/components/layout";
import { findMergeCandidates, mergeContacts, type MergeCandidate } from "@features/contacts/services/merge";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { AddTagModal } from "@features/contacts/components/AddTagModal";
import { AddSegmentModal } from "@features/contacts/components/AddSegmentModal";
import { ContactListView } from "@features/contacts/components/ContactListView";
import { ContactGridView } from "@features/contacts/components/ContactGridView";
import { ViewToggle } from "@features/contacts/components/ViewToggle";
import { ContactsToolbar, type BulkAction } from "@features/contacts/components/ContactsToolbar";
import { FilterChipBar, type ActiveFilter } from "@features/contacts/components/FilterChipBar";
import { SegmentPreviewDrawer } from "@features/contacts/components/SegmentPreviewDrawer";
import { GroupMemberModal } from "@features/contacts/components/GroupMemberModal";
import { ImportHistoryTab } from "@features/contacts/components/ImportHistoryTab";
import { CreateContactModal } from "@features/contacts/components/CreateContactModal";
import { SkeletonTable, GlassPanel } from "@shared/components/ui";
import { useViewPrefs } from "@features/contacts/hooks/useViewPrefs";
import {
  exportContactsToCsv,
  exportContactsToVcard,
  exportTasksToCsv,
  exportCalendarToIcs,
} from "@shared/services/dataExport";
import { notify } from "@shared/services/notifications/toastHelper";
import { useBulkSelection } from "@features/contacts/hooks/useBulkSelection";
import { usePlatform } from "@shared/hooks/usePlatform";
import { usePagination } from "@shared/hooks/usePagination";
import { PaginationControls } from "@shared/components/ui/PaginationControls";

type ContactsTab = "contacts" | "tags" | "groups" | "segments" | "imports";

export function ContactsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { screen } = usePlatform();
  const isMobile = screen.isMobile;
  const primaryAccountId = useAccountStore((s) =>
    s.accounts.find((a) => a.isActive)?.id ?? "",
  );

  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ContactsTab>("contacts");
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeCandidates, setMergeCandidates] = useState<MergeCandidate[]>([]);
  const [merging, setMerging] = useState(false);

  // Modal states
  const [selectedContact, setSelectedContact] = useState<DbContact | null>(null);
  const openComposer = useComposerStore((s) => s.openComposer);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [showAddSegmentModal, setShowAddSegmentModal] = useState(false);
  const [showCreateContact, setShowCreateContact] = useState(false);

  // Phase 2 modal states
  const [previewSegment, setPreviewSegment] = useState<ContactSegment | null>(null);
  const [showSegmentPreview, setShowSegmentPreview] = useState(false);
  const [memberGroup, setMemberGroup] = useState<ContactGroup | null>(null);
  const [showGroupMembers, setShowGroupMembers] = useState(false);

  // Drill-down filter state
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null);

  // View preferences (persisted in localStorage)
  const { prefs, setViewMode, setDensity, setSort } = useViewPrefs();

  // Bulk selection
  const selection = useBulkSelection();
  const lastSelectedRef = useRef<string | null>(null);

  const tags = useContactStore((s) => s.tags);
  const groups = useContactStore((s) => s.groups);
  const segments = useContactStore((s) => s.segments);
  const loadTags = useContactStore((s) => s.loadTags);
  const loadSegments = useContactStore((s) => s.loadSegments);
  const deleteTag = useContactStore((s) => s.deleteTag);
  const deleteSegment = useContactStore((s) => s.deleteSegment);

  const {
    items: contacts,
    total: totalContacts,
    currentPage: contactPage,
    totalPages: contactTotalPages,
    loading: contactsLoading,
    goToPage: goToContactPage,
    reset: resetContacts,
    setPageSize: setContactPageSize,
  } = usePagination({
    fetchFn: async ({ limit, offset }) => {
      const [items, total] = await Promise.all([
        getAllContacts(limit, offset),
        countAllContacts(),
      ]);
      return { items, total };
    },
    pageSize: 50,
  });

  // Keep a local loading flag for the contacts list that works with the hook
  // (the local `loading` state is used for the skeleton while contacts load)
  useEffect(() => {
    setLoading(contactsLoading);
  }, [contactsLoading]);

  useEffect(() => {
    if (!primaryAccountId) return;
    if (tab === "tags") loadTags(primaryAccountId);
    if (tab === "segments") loadSegments(primaryAccountId);
  }, [tab, primaryAccountId, loadTags, loadSegments]);

  // Re-filter when active filter changes
  useEffect(() => {
    if (tagFilter || groupFilter || segmentFilter) {
      setTab("contacts");
    }
  }, [tagFilter, groupFilter, segmentFilter]);

  const handleFindDuplicates = useCallback(async () => {
    const candidates = await findMergeCandidates();
    setMergeCandidates(candidates);
    if (candidates.length > 0) setShowMergeDialog(true);
  }, []);

  const handleMerge = useCallback(
    async (keepId: string, mergeId: string) => {
      setMerging(true);
      try {
        await mergeContacts(keepId, mergeId);
        setMergeCandidates((prev) => prev.filter((c) => c.mergeId !== mergeId));
        await resetContacts();
      } catch (err) {
        console.error("Failed to merge contacts:", err);
      } finally {
        setMerging(false);
      }
    },
    [resetContacts],
  );

  const handleContactClick = useCallback(
    (contactId: string) => {
      navigate({ to: "/people/$contactId", params: { contactId } });
    },
    [navigate],
  );

  const handleViewContact = useCallback(
    (contact: DbContact) => {
      navigate({ to: "/people/$contactId", params: { contactId: contact.id } });
    },
    [navigate],
  );

  // Active filter chips
  const activeFilters: ActiveFilter[] = useMemo(() => {
    const list: ActiveFilter[] = [];
    if (tagFilter) {
      const t = tags.find((x) => x.id === tagFilter);
      list.push({
        id: `tag-${tagFilter}`,
        label: t ? `Tag: ${t.name}` : "Tag",
        color: t?.color ?? undefined,
        onRemove: () => setTagFilter(null),
      });
    }
    if (groupFilter) {
      const g = groups.find((x) => x.id === groupFilter);
      list.push({
        id: `group-${groupFilter}`,
        label: g ? `Group: ${g.name}` : "Group",
        onRemove: () => setGroupFilter(null),
      });
    }
    if (segmentFilter) {
      const s = segments.find((x) => x.id === segmentFilter);
      list.push({
        id: `segment-${segmentFilter}`,
        label: s ? `Segment: ${s.name}` : "Segment",
        onRemove: () => setSegmentFilter(null),
      });
    }
    return list;
  }, [tagFilter, groupFilter, segmentFilter, tags, groups, segments]);

  const clearAllFilters = useCallback(() => {
    setTagFilter(null);
    setGroupFilter(null);
    setSegmentFilter(null);
  }, []);

  // Filter contacts (search + tag/group/segment filters; filtering by tag/group/segment
  // is a UI affordance — when a real backend join exists, replace with a query).
  const filteredContacts = useMemo(() => {
    let out = contacts;
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(
        (c) =>
          c.email.toLowerCase().includes(q) ||
          (c.display_name?.toLowerCase().includes(q) ?? false),
      );
    }
    // Tag/group/segment filters are placeholders; the backend filter is
    // wired in Phase 2-B (depends on a `db_filter_contacts` command). Until
    // then, the chip is shown but no narrowing happens client-side.
    return out;
  }, [contacts, search]);

  const orderedContactIds = useMemo(
    () => filteredContacts.map((c) => c.id),
    [filteredContacts],
  );

  const allFilteredSelected =
    orderedContactIds.length > 0 &&
    orderedContactIds.every((id) => selection.selectedIds.has(id));
  const someFilteredSelected =
    orderedContactIds.some((id) => selection.selectedIds.has(id)) &&
    !allFilteredSelected;

  const handleSelectAllToggle = useCallback(() => {
    if (allFilteredSelected) {
      selection.clear();
    } else {
      selection.selectAll(orderedContactIds);
    }
  }, [allFilteredSelected, orderedContactIds, selection]);

  const handleToggleSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      if (shiftKey && lastSelectedRef.current) {
        selection.toggleRange(lastSelectedRef.current, id, orderedContactIds);
      } else {
        selection.toggle(id);
      }
      lastSelectedRef.current = id;
    },
    [orderedContactIds, selection],
  );

  // Action handlers
  const handleCompose = useCallback((c: DbContact) => {
    setSelectedContact(c);
    openComposer({ to: [c.email], subject: "", mode: "new" });
  }, [openComposer]);

  const handleAddTag = useCallback((c: DbContact) => {
    setSelectedContact(c);
    setShowAddTagModal(true);
  }, []);

  const handleAddToGroup = useCallback((c: DbContact) => {
    setSelectedContact(c);
    // Group-add UI lands in Phase 2-B; reuse tag modal as fallback
    setShowAddTagModal(false);
    void c;
  }, []);

  const handleAddToSegment = useCallback((c: DbContact) => {
    setSelectedContact(c);
    setShowAddSegmentModal(true);
  }, []);

  const handleMergeContact = useCallback(
    (c: DbContact) => {
      setSelectedContact(c);
      void c;
      handleFindDuplicates();
    },
    [handleFindDuplicates],
  );

  const handleDeleteContact = useCallback((c: DbContact) => {
    console.warn("Delete requested for", c.id, "(not yet wired)");
  }, []);

  const handleExportVcard = useCallback((c: DbContact) => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${c.display_name ?? c.email}`,
      `EMAIL:${c.email}`,
      "END:VCARD",
    ].join("\n");
    const blob = new Blob([vcard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(c.display_name ?? c.email).replace(/\s+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleBulkAction = useCallback(
    (action: BulkAction) => {
      switch (action) {
        case "tag":
          setSelectedContact(null);
          setShowAddTagModal(true);
          break;
        case "group":
          setSelectedContact(null);
          break;
        case "export": {
          const selected = contacts.filter((c) => selection.selectedIds.has(c.id));
          const header = "email,display_name,frequency,last_contacted_at\n";
          const rows = selected
            .map(
              (c) =>
                `${c.email},${(c.display_name ?? "").replace(/,/g, ";")},${c.frequency},${
                  c.last_contacted_at ?? ""
                }`,
            )
            .join("\n");
          const blob = new Blob([header + rows], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `contacts-${Date.now()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          break;
        }
        case "merge":
          handleFindDuplicates();
          break;
        case "delete":
          console.warn(
            "Bulk delete requested for",
            selection.selectedCount,
            "contacts (not yet wired)",
          );
          break;
        case "clear":
          selection.clear();
          break;
      }
    },
    [contacts, selection, handleFindDuplicates],
  );

  const stats = useMemo(
    () => ({
      total: contacts.length,
      engaged: contacts.filter(
        (c) => c.last_contacted_at && c.last_contacted_at > Date.now() / 1000 - 30 * 86400,
      ).length,
    }),
    [contacts],
  );

  const DESKTOP_TABS: { id: ContactsTab; label: string; icon: typeof Users }[] = [
    { id: "contacts", label: t('contacts.tabs.contacts'), icon: Users },
    { id: "tags", label: t('contacts.tabs.tags'), icon: TagIcon },
    { id: "groups", label: t('contacts.tabs.groups'), icon: Users },
    { id: "segments", label: t('contacts.tabs.segments'), icon: Filter },
    { id: "imports", label: t('contacts.tabs.imports'), icon: History },
  ];

  const MOBILE_TABS: { id: ContactsTab; label: string; icon: typeof Users }[] = [
    { id: "contacts", label: t('contacts.tabs.contacts'), icon: Users },
    { id: "tags", label: t('contacts.tabs.tags'), icon: TagIcon },
  ];

  const tabs = isMobile ? MOBILE_TABS : DESKTOP_TABS;

  return (
    <PageScaffold
      title={<span className="flex items-center gap-2"><Users size={18} className="text-accent" />{t('contacts.title')}</span>}
      count={contacts.length}
      actions={
        <>
          {isMobile && (
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={showSearch ? t('contacts.hideSearch') : t('contacts.showSearch')}
              aria-expanded={showSearch}
            >
              <Search size={20} />
            </button>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus size={14} />}
            onClick={() => setShowCreateContact(true)}
          >
            {t('contacts.newContact')}
          </Button>
        </>
      }
      toolbar={
        isMobile && showSearch ? (
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('contacts.searchPlaceholder')}
              autoFocus
              className="w-full pl-10 pr-10 py-2.5 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-text-primary outline-none focus:border-accent"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary"
                aria-label={t('contacts.clearSearch')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ) : undefined
      }
    >

      {/* Tabs */}
      <div className="flex items-center border-b border-border-primary bg-bg-primary/30 shrink-0 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                tab === t.id
                  ? "text-accent border-accent"
                  : "text-text-tertiary border-transparent hover:text-text-secondary"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Contacts */}
      {tab === "contacts" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile: Compact header with search (if not using expandable) */}
          {isMobile && !showSearch && (
            <div className="px-4 py-2 border-b border-border-primary bg-bg-primary/30 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('contacts.searchPlaceholder')}
                  className="w-full pl-10 pr-10 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-text-primary outline-none focus:border-accent"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Desktop: Stats bar + search + filters + toolbar */}
          {!isMobile && (
            <>
              {/* Stats bar */}
              <div className="flex items-center gap-4 px-5 py-2 border-b border-border-primary bg-bg-primary/20">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-tertiary">{t('contacts.stats.total')}</span>
                  <span className="text-sm font-semibold text-text-primary">{stats.total}</span>
                </div>
                <div className="w-px h-4 bg-border-primary" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-tertiary">{t('contacts.stats.active30')}</span>
                  <span className="text-sm font-semibold text-text-primary">{stats.engaged}</span>
                </div>
                <div className="flex-1" />
                <div className="relative w-64">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('contacts.searchPlaceholder')}
                    className="w-full pl-8 pr-3 py-1.5 bg-bg-tertiary border border-border-primary rounded-lg text-xs text-text-primary outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Active filters */}
              <FilterChipBar filters={activeFilters} onClearAll={clearAllFilters} />

              {/* Toolbar */}
              <ContactsToolbar
                totalCount={filteredContacts.length}
                selectedCount={selection.selectedCount}
                sortField={prefs.sortField}
                sortDirection={prefs.sortDirection}
                onSortChange={setSort}
                onImportClick={() => setShowCsvImport(true)}
                onMergeClick={handleFindDuplicates}
                onBulkAction={handleBulkAction}
                onExportAllCsv={async () => {
                  try {
                    const r = await exportContactsToCsv();
                    if (r) notify("Export complete", `Exported ${r.recordCount} contacts (CSV)`);
                  } catch (e) {
                    notify("Export failed", (e as Error).message);
                  }
                }}
                onExportAllVcard={async () => {
                  try {
                    const r = await exportContactsToVcard();
                    if (r) notify("Export complete", `Exported ${r.recordCount} contacts (vCard)`);
                  } catch (e) {
                    notify("Export failed", (e as Error).message);
                  }
                }}
                onExportAllTasks={async () => {
                  try {
                    const r = await exportTasksToCsv();
                    if (r) notify("Export complete", `Exported ${r.recordCount} tasks (CSV)`);
                  } catch (e) {
                    notify("Export failed", (e as Error).message);
                  }
                }}
                onExportAllCalendar={async () => {
                  try {
                    const r = await exportCalendarToIcs();
                    if (r) notify("Export complete", `Exported ${r.recordCount} calendar events (ICS)`);
                  } catch (e) {
                    notify("Export failed", (e as Error).message);
                  }
                }}
                onSelectAllToggle={handleSelectAllToggle}
                allSelected={allFilteredSelected}
                someSelected={someFilteredSelected}
              >
                <div className="w-px h-4 bg-border-primary" aria-hidden="true" />
                <ViewToggle
                  viewMode={prefs.viewMode}
                  density={prefs.density}
                  onViewModeChange={setViewMode}
                  onDensityChange={setDensity}
                />
              </ContactsToolbar>
            </>
          )}

          {/* Content */}
          <div
            className={`flex-1 overflow-y-auto ${isMobile ? "safe-area-bottom" : ""}`}
            aria-busy={loading && filteredContacts.length === 0}
            aria-live="polite"
            aria-label="Contacts list"
          >
            {loading ? (
              <div className="p-3">
                <SkeletonTable columns={4} rows={8} />
              </div>
            ) : filteredContacts.length === 0 ? (
              <EmptyState
                icon={search ? Search : Users}
                title={search ? "No matching contacts" : "No contacts yet"}
                subtitle={
                  search
                    ? "Try a different search term"
                    : "Contacts appear as you send and receive emails. Or import them now."
                }
                action={
                  search
                    ? undefined
                    : (
                      <div className="flex items-center gap-2 flex-wrap justify-center">
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<UserPlus size={14} />}
                          onClick={() => setShowCreateContact(true)}
                        >
                          New contact
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Upload size={14} />}
                          onClick={() => setShowCsvImport(true)}
                        >
                          Import from CSV
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<GitMerge size={14} />}
                          onClick={handleFindDuplicates}
                          disabled={merging}
                        >
                          Find Duplicates
                        </Button>
                      </div>
                    )
                }
              />
            ) : isMobile || prefs.viewMode === "grid" ? (
              <ContactGridView
                contacts={filteredContacts}
                density={prefs.density}
                selectedIds={selection.selectedIds}
                onToggleSelect={(id) => {
                  lastSelectedRef.current = id;
                  selection.toggle(id);
                }}
                onContactClick={handleContactClick}
                onCompose={handleCompose}
                onViewContact={handleViewContact}
                onAddTag={handleAddTag}
                onAddToGroup={handleAddToGroup}
                onAddToSegment={handleAddToSegment}
                onMerge={handleMergeContact}
                onDelete={handleDeleteContact}
                onExportVcard={handleExportVcard}
              />
            ) : (
              <ContactListView
                contacts={filteredContacts}
                density={prefs.density}
                sortField={prefs.sortField}
                sortDirection={prefs.sortDirection}
                onSortChange={setSort}
                selectedIds={selection.selectedIds}
                onToggleSelect={handleToggleSelect}
                onContactClick={handleContactClick}
                onCompose={handleCompose}
                onViewContact={handleViewContact}
                onAddTag={handleAddTag}
                onAddToGroup={handleAddToGroup}
                onAddToSegment={handleAddToSegment}
                onMerge={handleMergeContact}
                onDelete={handleDeleteContact}
                onExportVcard={handleExportVcard}
              />
            )}
            <PaginationControls
              currentPage={contactPage}
              totalPages={contactTotalPages}
              pageSize={50}
              totalItems={totalContacts}
              onPageChange={goToContactPage}
              onPageSizeChange={setContactPageSize}
            />
          </div>
        </div>
      )}

      {/* Tab: Tags — interactive cards */}
      {tab === "tags" && (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-tertiary">
              Click a tag to filter contacts. Manage tag colors and naming here.
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => {
                setSelectedContact(null);
                setShowAddTagModal(true);
              }}
            >
              New Tag
            </Button>
          </div>
          {tags.length === 0 ? (
            <EmptyState
              icon={TagIcon}
              title="No tags yet"
              subtitle="Create your first tag to start organizing contacts by topic or relationship."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => setShowAddTagModal(true)}
                >
                  Create your first tag
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {tags.map((tag) => (
                <GlassPanel
                  key={tag.id}
                  variant="card"
                  className="p-2.5 flex items-center gap-2 group"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color ?? "var(--color-accent)" }}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setTagFilter(tag.id)}
                      className="block text-xs font-medium text-text-primary truncate hover:text-accent transition-colors text-left w-full"
                    >
                      {tag.name}
                    </button>
                    <p className="text-[0.625rem] text-text-tertiary">
                      {tag.contact_count} {tag.contact_count === 1 ? "contact" : "contacts"}
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setTagFilter(tag.id)}
                      className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover"
                      title="View contacts"
                      aria-label="View contacts with this tag"
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Delete tag "${tag.name}"?`)) {
                          await deleteTag(tag.id, primaryAccountId);
                        }
                      }}
                      className="p-1 rounded text-text-tertiary hover:text-error hover:bg-error/10"
                      title="Delete tag"
                      aria-label="Delete tag"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </GlassPanel>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Groups — cards with member preview */}
      {tab === "groups" && (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-tertiary">
              Click a group to view its members.
            </p>
          </div>
          <GroupManager
            accountId={primaryAccountId}
            onGroupClick={(g) => {
              setMemberGroup(g);
              setShowGroupMembers(true);
            }}
          />
        </div>
      )}

      {/* Tab: Segments — cards with preview */}
      {tab === "segments" && (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-tertiary">
              Dynamic segments evaluate a query against your contacts.
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setShowAddSegmentModal(true)}
            >
              New Segment
            </Button>
          </div>
          {segments.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="No segments yet"
              subtitle="Build dynamic audiences with a query — e.g. active:30d, tag:client, or name:smith."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => setShowAddSegmentModal(true)}
                >
                  Create your first segment
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-border-primary bg-bg-primary/40 hover:border-accent/40 hover:bg-bg-hover transition-colors group"
                >
                  <Filter size={14} className="text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-medium text-text-primary truncate">
                      {seg.name}
                    </h3>
                    <p className="text-[0.625rem] text-text-tertiary truncate">
                      {seg.query}
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewSegment(seg);
                        setShowSegmentPreview(true);
                      }}
                      className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover"
                      title="Preview segment"
                      aria-label="Preview segment"
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Delete segment "${seg.name}"?`)) {
                          await deleteSegment(seg.id, primaryAccountId);
                        }
                      }}
                      className="p-1 rounded text-text-tertiary hover:text-error hover:bg-error/10"
                      title="Delete segment"
                      aria-label="Delete segment"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Imports (Phase 4) */}
      {tab === "imports" && (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-text-tertiary">
              History of CSV imports and their results.
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={<UserPlus size={14} />}
              onClick={() => setShowCsvImport(true)}
            >
              New import
            </Button>
          </div>
          <ImportHistoryTab accountId={primaryAccountId} />
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvImport && (
        <CsvImportWizard
          isOpen={true}
          onClose={() => {
            setShowCsvImport(false);
            resetContacts();
          }}
          accountId={primaryAccountId}
        />
      )}

      {/* Merge Dialog */}
      {showMergeDialog && (
        <ContactMergeDialog
          isOpen={true}
          onClose={() => setShowMergeDialog(false)}
          candidates={mergeCandidates}
          onMerge={handleMerge}
        />
      )}

      {/* Send Email Modal (deprecated in favor of SlideOverComposer; still works) */}

      {/* Add Tag Modal */}
      <AddTagModal
        isOpen={showAddTagModal}
        onClose={() => setShowAddTagModal(false)}
        contactId={selectedContact?.id ?? null}
      />

      {/* Add Segment Modal */}
      <AddSegmentModal
        isOpen={showAddSegmentModal}
        onClose={() => setShowAddSegmentModal(false)}
      />

      {/* Segment Preview Drawer (Phase 2) */}
      <SegmentPreviewDrawer
        isOpen={showSegmentPreview}
        onClose={() => setShowSegmentPreview(false)}
        segment={previewSegment}
      />

      {/* Group Member Modal (Phase 2) */}
      <GroupMemberModal
        isOpen={showGroupMembers}
        onClose={() => setShowGroupMembers(false)}
        group={memberGroup}
      />

      {/* Create Contact Modal */}
      <CreateContactModal
        isOpen={showCreateContact}
        onClose={() => setShowCreateContact(false)}
        onCreated={resetContacts}
      />
    </PageScaffold>
  );
}
