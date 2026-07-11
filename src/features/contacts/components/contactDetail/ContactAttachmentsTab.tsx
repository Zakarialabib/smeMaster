import { useState, useEffect } from "react";
import { Paperclip, FileText, Image, File, Archive, AlertCircle, RefreshCw, Clock } from "lucide-react";
import { getAttachmentsFromContact, type ContactAttachment } from "@features/contacts/db/contacts";
import { formatRelativeDate } from "@shared/utils/date";
import { EmptyState } from "@shared/components/ui/EmptyState";

export interface ContactAttachmentsTabProps {
  email: string;
}

// ─── File type icon helper ────────────────────────────────────────────────

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("text/")) return FileText;
  if (mimeType.includes("pdf")) return FileText;
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar") ||
    mimeType.includes("7z")
  ) {
    return Archive;
  }
  return Paperclip;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Loading skeleton ──────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border-primary animate-pulse">
          <div className="w-10 h-10 rounded-lg bg-bg-tertiary shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-bg-tertiary rounded w-3/4" />
            <div className="h-3 bg-bg-tertiary rounded w-1/3" />
            <div className="h-2.5 bg-bg-tertiary rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function ContactAttachmentsTab({ email }: ContactAttachmentsTabProps) {
  const [attachments, setAttachments] = useState<ContactAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getAttachmentsFromContact(email, 20)
      .then((data) => {
        if (!cancelled) setAttachments(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load attachments");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email]);

  // ── Loading ──
  if (loading) return <LoadingSkeleton />;

  // ── Error ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 px-4">
        <AlertCircle size={32} className="text-danger/60" />
        <p className="text-sm font-medium text-text-primary">Failed to load attachments</p>
        <p className="text-xs text-text-tertiary text-center max-w-sm">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            getAttachmentsFromContact(email, 20)
              .then(setAttachments)
              .catch((err) => setError(err instanceof Error ? err.message : "Failed to load attachments"))
              .finally(() => setLoading(false));
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
        >
          <RefreshCw size={13} />
          Retry
        </button>
      </div>
    );
  }

  // ── Empty ──
  if (attachments.length === 0) {
    return (
      <EmptyState
        icon={Paperclip}
        title="No attachments"
        subtitle="Files exchanged with this contact will appear here"
      />
    );
  }

  // ── Grid ──
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
      {attachments.map((att, index) => {
        const Icon = getFileIcon(att.mime_type);
        return (
          <div
            key={`${att.filename}-${index}`}
            className="flex items-start gap-3 p-3 rounded-xl border border-border-primary bg-bg-secondary/50 hover:bg-bg-hover transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Icon size={18} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {att.filename}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {att.size !== null && att.size !== undefined && (
                  <span className="text-[0.6rem] text-text-tertiary">
                    {formatFileSize(att.size)}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[0.6rem] text-text-tertiary">
                  <Clock size={9} />
                  {formatRelativeDate(att.date)}
                </span>
              </div>
              {att.mime_type && (
                <span className="text-[0.55rem] text-text-tertiary mt-0.5 block truncate">
                  {att.mime_type}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
