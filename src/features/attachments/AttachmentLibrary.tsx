import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Paperclip, Search, LayoutGrid, List, SlidersHorizontal, X, AlertCircle, RefreshCw, Mail } from "lucide-react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { usePlatform } from "@shared/hooks/usePlatform";
import {
  getAttachmentsForAccount,
  getAttachmentSenders,
  type AttachmentWithContext,
  type AttachmentSender,
} from "@shared/services/db/attachments";
import { getEmailProvider } from "@features/mail/services/email/providerFactory";
import { AttachmentPreview } from "@features/mail/components/AttachmentList";
import { AttachmentGridItem } from "./AttachmentGridItem";
import { AttachmentListItem } from "./AttachmentListItem";
import { PageScaffold } from "@shared/components/layout";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { Button } from "@shared/components/ui/Button";
import { TextField } from "@shared/components/ui/TextField";
import { StyledSelect } from "@shared/components/ui/StyledSelect";
import { isImage, isPdf, isDocument, isSpreadsheet, isArchive } from "@shared/utils/fileTypeHelpers";
import { navigateToLabel } from "@/router/navigate";

type TypeFilter = "all" | "images" | "pdfs" | "documents" | "spreadsheets" | "archives" | "other";
type DateFilter = "all" | "today" | "week" | "month" | "year";
type SizeFilter = "all" | "small" | "medium" | "large";
type ViewMode = "grid" | "list";

const TYPE_OPTIONS: { value: TypeFilter; labelKey: string }[] = [
  { value: "all", labelKey: "allTypes" },
  { value: "images", labelKey: "images" },
  { value: "pdfs", labelKey: "pdfs" },
  { value: "documents", labelKey: "documents" },
  { value: "spreadsheets", labelKey: "spreadsheets" },
  { value: "archives", labelKey: "archives" },
  { value: "other", labelKey: "other" },
];

const DATE_OPTIONS: { value: DateFilter; labelKey: string }[] = [
  { value: "all", labelKey: "anyTime" },
  { value: "today", labelKey: "today" },
  { value: "week", labelKey: "pastWeek" },
  { value: "month", labelKey: "pastMonth" },
  { value: "year", labelKey: "pastYear" },
];

const SIZE_OPTIONS: { value: SizeFilter; labelKey: string }[] = [
  { value: "all", labelKey: "anySize" },
  { value: "small", labelKey: "small" },
  { value: "medium", labelKey: "medium" },
  { value: "large", labelKey: "large" },
];

function matchesType(att: AttachmentWithContext, filter: TypeFilter): boolean {
  switch (filter) {
    case "all": return true;
    case "images": return isImage(att.mime_type);
    case "pdfs": return isPdf(att.mime_type, att.filename);
    case "documents": return isDocument(att.mime_type, att.filename);
    case "spreadsheets": return isSpreadsheet(att.mime_type, att.filename);
    case "archives": return isArchive(att.mime_type);
    case "other":
      return !isImage(att.mime_type) && !isPdf(att.mime_type, att.filename) &&
        !isDocument(att.mime_type, att.filename) && !isSpreadsheet(att.mime_type, att.filename) &&
        !isArchive(att.mime_type);
  }
}

function matchesDate(att: AttachmentWithContext, filter: DateFilter): boolean {
  if (filter === "all" || !att.date) return true;
  const now = Date.now();
  const diff = now - att.date;
  switch (filter) {
    case "today": return diff < 86_400_000;
    case "week": return diff < 7 * 86_400_000;
    case "month": return diff < 30 * 86_400_000;
    case "year": return diff < 365 * 86_400_000;
  }
}

function matchesSize(att: AttachmentWithContext, filter: SizeFilter): boolean {
  if (filter === "all") return true;
  const size = att.size ?? 0;
  switch (filter) {
    case "small": return size < 1_048_576;
    case "medium": return size >= 1_048_576 && size <= 10_485_760;
    case "large": return size > 10_485_760;
  }
}

export function AttachmentLibrary() {
  const { t } = useTranslation();
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;
  const [showFilters, setShowFilters] = useState(false);
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccount = accounts.find((a) => a.isActive);
  const accountId = activeAccount?.id ?? null;

  const [attachments, setAttachments] = useState<AttachmentWithContext[]>([]);
  const [senders, setSenders] = useState<AttachmentSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [senderFilter, setSenderFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentWithContext | null>(null);

  const loadData = useCallback(async (acctId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [atts, snds] = await Promise.all([
        getAttachmentsForAccount(acctId),
        getAttachmentSenders(acctId),
      ]);
      setAttachments(atts);
      setSenders(snds);
    } catch (err) {
      console.error("Failed to load attachments:", err);
      setError(err instanceof Error ? err.message : t("attachments.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Load on account change
  useEffect(() => {
    if (accountId) {
      loadData(accountId);
    } else {
      setAttachments([]);
      setSenders([]);
      setLoading(false);
    }
  }, [accountId, loadData]);

  // Refresh on sync
  useEffect(() => {
    const handler = () => {
      if (accountId) loadData(accountId);
    };
    window.addEventListener("smemaster-sync-done", handler);
    return () => window.removeEventListener("smemaster-sync-done", handler);
  }, [accountId, loadData]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return attachments.filter((att) => {
      if (q) {
        const matchName = att.filename?.toLowerCase().includes(q);
        const matchSubject = att.subject?.toLowerCase().includes(q);
        const matchSender = att.from_name?.toLowerCase().includes(q) || att.from_address?.toLowerCase().includes(q);
        if (!matchName && !matchSubject && !matchSender) return false;
      }
      if (!matchesType(att, typeFilter)) return false;
      if (senderFilter !== "all" && att.from_address !== senderFilter) return false;
      if (!matchesDate(att, dateFilter)) return false;
      if (!matchesSize(att, sizeFilter)) return false;
      return true;
    });
  }, [attachments, searchQuery, typeFilter, senderFilter, dateFilter, sizeFilter]);

  const handleDownload = useCallback(async (att: AttachmentWithContext) => {
    if (!att.gmail_attachment_id || !accountId) return;
    try {
      const filePath = await save({
        defaultPath: att.filename ?? "attachment",
        filters: [{ name: t("attachments.allFiles"), extensions: ["*"] }],
      });
      if (!filePath) return;

      const provider = await getEmailProvider(accountId);
      const response = await provider.fetchAttachment(att.message_id, att.gmail_attachment_id);
      const base64 = response.data.replace(/-/g, "+").replace(/_/g, "/");
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      await writeFile(filePath, bytes);
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, [accountId, t]);

  const handleJumpToEmail = useCallback((att: AttachmentWithContext) => {
    if (att.thread_id) {
      navigateToLabel("all", { threadId: att.thread_id });
    }
  }, []);

  // Track search input ref to avoid autofocus stealing
  const searchRef = useRef<HTMLInputElement>(null);

  // Toolbar: search + filters + view toggle
  const toolbar = (
    <>
      <div className="relative flex-1 min-w-[160px]">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <TextField
          ref={searchRef}
          type="text"
          placeholder={t("attachments.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
          aria-label={t("attachments.search")}
        />
      </div>

      {isMobileDevice ? (
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`p-1.5 rounded-md border ${showFilters ? "bg-accent/10 border-accent text-accent" : "border-border-primary text-text-tertiary"}`}
        >
          {showFilters ? <X size={14} /> : <SlidersHorizontal size={14} />}
        </button>
      ) : (
        <>
          <StyledSelect
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            compact
            size="sm"
            aria-label={t("attachments.filterByType")}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(`attachments.${o.labelKey}`)}</option>
            ))}
          </StyledSelect>

          <StyledSelect
            value={senderFilter}
            onChange={(e) => setSenderFilter(e.target.value)}
            compact
            size="sm"
            aria-label={t("attachments.filterBySender")}
            className="max-w-40"
          >
            <option value="all">{t("attachments.allSenders")}</option>
            {senders.map((s) => (
              <option key={s.from_address} value={s.from_address}>
                {s.from_name || s.from_address} ({s.count})
              </option>
            ))}
          </StyledSelect>

          <StyledSelect
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            compact
            size="sm"
            aria-label={t("attachments.filterByDate")}
          >
            {DATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(`attachments.${o.labelKey}`)}</option>
            ))}
          </StyledSelect>

          <StyledSelect
            value={sizeFilter}
            onChange={(e) => setSizeFilter(e.target.value as SizeFilter)}
            compact
            size="sm"
            aria-label={t("attachments.filterBySize")}
          >
            {SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(`attachments.${o.labelKey}`)}</option>
            ))}
          </StyledSelect>
        </>
      )}

      <div className="flex border border-border-primary rounded-md overflow-hidden shrink-0">
        <button
          onClick={() => setViewMode("grid")}
          className={`p-1.5 ${viewMode === "grid" ? "bg-accent/10 text-accent" : "text-text-tertiary hover:text-text-primary"}`}
          title={t("attachments.gridView")}
          aria-label={t("attachments.gridView")}
        >
          <LayoutGrid size={14} />
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`p-1.5 ${viewMode === "list" ? "bg-accent/10 text-accent" : "text-text-tertiary hover:text-text-primary"}`}
          title={t("attachments.listView")}
          aria-label={t("attachments.listView")}
        >
          <List size={14} />
        </button>
      </div>
    </>
  );

  // Empty state: educational copy + CTA to go to mail
  const emptyState =
    loading || error ? undefined : (
      <EmptyState
        icon={Paperclip}
        title={attachments.length === 0 ? t("attachments.emptyTitle") : t("attachments.noMatchesTitle")}
        subtitle={
          attachments.length === 0
            ? t("attachments.emptySubtitle")
            : t("attachments.noMatchesSubtitle")
        }
        action={
          attachments.length === 0 ? (
            <Button
              variant="primary"
              icon={<Mail size={14} />}
              onClick={() => navigateToLabel("all")}
            >
              {t("attachments.goToMail")}
            </Button>
          ) : undefined
        }
      />
    );

  return (
    <PageScaffold
      title={t("attachments.title")}
      count={filtered.length}
      subtitle={t("attachments.subtitle")}
      toolbar={toolbar}
      isEmpty={!loading && !error && filtered.length === 0}
      emptyState={emptyState}
    >
      {/* Mobile filter panel */}
      {isMobileDevice && showFilters && (
        <div className="flex flex-wrap gap-2 mb-3">
          <StyledSelect
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            compact
            size="sm"
            className="flex-1 min-w-0"
            aria-label={t("attachments.filterByType")}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(`attachments.${o.labelKey}`)}</option>
            ))}
          </StyledSelect>

          <StyledSelect
            value={senderFilter}
            onChange={(e) => setSenderFilter(e.target.value)}
            compact
            size="sm"
            className="flex-1 min-w-0"
            aria-label={t("attachments.filterBySender")}
          >
            <option value="all">{t("attachments.allSenders")}</option>
            {senders.slice(0, 20).map((s) => (
              <option key={s.from_address} value={s.from_address}>
                {s.from_name || s.from_address}
              </option>
            ))}
          </StyledSelect>

          <StyledSelect
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            compact
            size="sm"
            className="flex-1 min-w-0"
            aria-label={t("attachments.filterByDate")}
          >
            {DATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(`attachments.${o.labelKey}`)}</option>
            ))}
          </StyledSelect>

          <StyledSelect
            value={sizeFilter}
            onChange={(e) => setSizeFilter(e.target.value as SizeFilter)}
            compact
            size="sm"
            className="flex-1 min-w-0"
            aria-label={t("attachments.filterBySize")}
          >
            {SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(`attachments.${o.labelKey}`)}</option>
            ))}
          </StyledSelect>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-sm text-text-tertiary">{t("attachments.loading")}</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
          <AlertCircle size={40} className="text-danger-text opacity-60" />
          <p className="text-sm font-medium text-text-primary">{t("attachments.loadErrorTitle")}</p>
          <p className="text-xs text-text-tertiary text-center max-w-sm">{error}</p>
          <button
            onClick={() => accountId && loadData(accountId)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
          >
            <RefreshCw size={13} />
            {t("attachments.retry")}
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {filtered.map((att) => (
            <AttachmentGridItem
              key={att.id}
              attachment={att}
              onPreview={() => setPreviewAttachment(att)}
              onDownload={() => handleDownload(att)}
              onJumpToEmail={() => handleJumpToEmail(att)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          {filtered.map((att) => (
            <AttachmentListItem
              key={att.id}
              attachment={att}
              onPreview={() => setPreviewAttachment(att)}
              onDownload={() => handleDownload(att)}
              onJumpToEmail={() => handleJumpToEmail(att)}
            />
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewAttachment && (
        <AttachmentPreview
          attachment={previewAttachment}
          accountId={accountId!}
          messageId={previewAttachment.message_id}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </PageScaffold>
  );
}
