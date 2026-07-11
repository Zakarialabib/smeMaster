import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, AlertCircle, File } from "lucide-react";
import { usePlatform } from "@shared/hooks/usePlatform";
import { useSelectedThreadId } from "@shared/hooks/useRouteNavigation";
import { useThreadStore } from "@features/mail/stores/threadStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { PullToRefresh } from "@shared/components/ui/PullToRefresh";
import { getMessagesForThread } from "@shared/services/db/messages";
import { getAttachmentsForMessage, type DbAttachment } from "@shared/services/db/attachments";
import { isImage } from "@shared/utils/fileTypeHelpers";
import { ThreadView } from "./ThreadView";

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toUpperCase() : "FILE";
}

export function ThreadViewMobile() {
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;
  
  const navigate = useNavigate();
  const selectedThreadId = useSelectedThreadId();
  const selectedThread = useThreadStore((s) =>
    selectedThreadId ? s.threadMap.get(selectedThreadId) ?? null : null,
  );
  const isLoadingStore = useThreadStore((s) => s.isLoading);
  const accountId = useAccountStore((s) => s.activeAccountId);

  // ── Attachment state ──────────────────────────────────────────────────────
  const [attachments, setAttachments] = useState<DbAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // ── Swipe-to-go-back ref ──────────────────────────────────────────────────
  const touchStartXRef = useRef(0);

  // ── Load attachments for the thread ────────────────────────────────────────
  useEffect(() => {
    if (!accountId || !selectedThreadId) return;
    let cancelled = false;

    setLoadingAttachments(true);
    setAttachmentError(null);

    getMessagesForThread(accountId, selectedThreadId)
      .then((msgs) => {
        if (cancelled) return [];
        return Promise.all(
          msgs.map((msg) => getAttachmentsForMessage(accountId, msg.id)),
        );
      })
      .then((results) => {
        if (cancelled) return;
        const all = results.flat().filter((a) => !a.is_inline);
        setAttachments(all);
      })
      .catch((err) => {
        if (cancelled) return;
        setAttachmentError("Failed to load attachments");
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoadingAttachments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, selectedThreadId]);

  // ── Pull-to-refresh: reload attachments ───────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (!accountId || !selectedThreadId) return;
    const msgs = await getMessagesForThread(accountId, selectedThreadId);
    const results = await Promise.all(
      msgs.map((msg) => getAttachmentsForMessage(accountId, msg.id)),
    );
    setAttachments(results.flat().filter((a) => !a.is_inline));
  }, [accountId, selectedThreadId]);

  // ── Swipe-to-go-back handlers ─────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]!.clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0]!.clientX - touchStartXRef.current;
      if (touchStartXRef.current < 40 && dx > 80) {
        navigate({ to: ".." });
      }
    },
    [navigate],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isMobileDevice) return null;

  // Loading state — show spinner while thread data loads
  if (isLoadingStore && !selectedThread) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-text-tertiary p-8">
        <Loader2 size={24} className="animate-spin mb-2" />
        <p className="text-sm">Loading thread…</p>
      </div>
    );
  }

  // Error state — show error message with retry button
  if (attachmentError && !selectedThread) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-text-tertiary p-8">
        <AlertCircle size={24} className="mb-2 text-error" />
        <p className="text-sm mb-4">{attachmentError}</p>
        <button
          onClick={() => setAttachmentError(null)}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium active:scale-95 transition-transform"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!selectedThread) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-text-tertiary p-8">
        <p className="text-sm">Select a thread</p>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="safe-area-bottom">
      <div
        className="flex flex-col flex-1 h-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe-back gesture indicator — thin line at left edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 bg-accent/20 pointer-events-none"
          aria-hidden="true"
        />
        {/* Mobile header with back button */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-primary bg-sidebar-bg safe-area-top shadow-sm">
          <button
            onClick={() => navigate({ to: ".." })}
            className="p-2 -ml-2 active:scale-90 transition-transform duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Go back"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium truncate">
              {selectedThread.subject || "No subject"}
            </h2>
          </div>
        </div>

        {/* Attachment thumbnails strip */}
        {loadingAttachments ? (
          <div className="px-4 py-2 border-b border-border-primary">
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-18 h-18 rounded-lg border border-border-primary bg-sidebar-bg animate-pulse shrink-0" />
              ))}
            </div>
          </div>
        ) : attachments.length > 0 ? (
          <div className="px-4 py-2 border-b border-border-primary">
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {attachments.map((att) => (
                <div key={att.id} className="shrink-0 min-w-[72px]">
                  {isImage(att.mime_type) ? (
                    <div className="w-18 h-18 rounded-lg border border-border-primary overflow-hidden bg-sidebar-bg min-h-[44px] min-w-[44px]">
                      {att.local_path ? (
                        <img
                          src={`file://${att.local_path.replace(/\\/g, "/")}`}
                          alt={att.filename ?? "Image attachment"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                          <File size={20} className="text-text-tertiary" />
                          <span className="text-[9px] text-text-tertiary mt-0.5 truncate max-w-[64px] px-1">
                            {att.filename ? getExtension(att.filename) : "IMG"}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-18 h-18 rounded-lg border border-border-primary bg-sidebar-bg flex flex-col items-center justify-center min-h-[44px] min-w-[44px]">
                      <File size={20} className="text-text-tertiary" />
                      <span className="text-[9px] text-text-tertiary mt-0.5 truncate max-w-[64px] px-1">
                        {att.filename ? getExtension(att.filename) : "FILE"}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
 
        {/* Thread content — reuses existing ThreadView */}
        <div className="flex-1 overflow-hidden safe-area-bottom">
          <ThreadView thread={selectedThread} />
        </div>
      </div>
    </PullToRefresh>
  );
}



