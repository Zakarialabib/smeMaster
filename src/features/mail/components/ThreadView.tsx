import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageItem } from "./MessageItem";
import { ActionBar } from "./ActionBar";
import { getMessagesForThread, type DbMessage } from "@shared/services/db/messages";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useLayoutStore } from "@shared/stores/layoutStore";
import { useThreadStore, type Thread } from "@features/mail/stores/threadStore";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { useContextMenuStore } from "@features/mail/stores/contextMenuStore";
import { markThreadRead } from "@features/mail/services/emailActions";
import { getSetting } from "@features/settings/db/settings";
import { getAllowlistedSenders } from "@features/deliverability/db/imageAllowlist";
import { VolumeX } from "lucide-react";
import { escapeHtml, sanitizeHtml } from "@shared/utils/sanitize";
import { isNoReplyAddress } from "@shared/utils/noReply";
import { ThreadSummary } from "./ThreadSummary";
import { SmartReplySuggestions } from "./SmartReplySuggestions";
import { InlineReply } from "./InlineReply";
import { ContactSidebar } from "./ContactSidebar";
import { TaskSidebar } from "@features/tasks/components/TaskSidebar";
import { AiTaskExtractDialog } from "@features/tasks/components/AiTaskExtractDialog";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";
import { MessageSkeleton } from "@shared/components/ui/Skeleton";
import { RawMessageModal } from "./RawMessageModal";
import { SwipeToDelete } from "@shared/components/ui/SwipeToDelete";
import { usePlatform } from "@shared/hooks/usePlatform";
import { useTranslation } from "react-i18next";
import { uiBus } from "@shared/services/events/uiBus";

interface ThreadViewProps {
  thread: Thread;
}

async function handlePopOut(thread: Thread) {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const windowLabel = `thread-${thread.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const url = `index.html?thread=${encodeURIComponent(thread.id)}&account=${encodeURIComponent(thread.accountId)}`;

    // Check if window already exists
    const existing = await WebviewWindow.getByLabel(windowLabel);
    if (existing) {
      await existing.setFocus();
      return;
    }

    const win = new WebviewWindow(windowLabel, {
      url,
      title: thread.subject ?? "Thread",
      width: 800,
      height: 700,
      center: true,
      dragDropEnabled: false,
    });

    win.once("tauri://error", (e) => {
      console.error("Failed to create pop-out window:", e);
    });
  } catch (err) {
    console.error("Failed to open pop-out window:", err);
  }
}

export function ThreadView({ thread }: ThreadViewProps) {
  const { t } = useTranslation();
  const { mobile: isMobileDevice } = usePlatform();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const contactSidebarVisible = useLayoutStore((s) => s.contactSidebarVisible);
  const toggleContactSidebar = useLayoutStore((s) => s.toggleContactSidebar);
  const setContactSidebarVisible = useLayoutStore(
    (s) => s.setContactSidebarVisible,
  );
  const taskSidebarVisible = useLayoutStore((s) => s.taskSidebarVisible);
  const [showTaskExtract, setShowTaskExtract] = useState(false);
  const updateThread = useThreadStore((s) => s.updateThread);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const markedReadRef = useRef<string | null>(null);
  // null = not yet loaded; defer iframe rendering until setting is known
  const [blockImages, setBlockImages] = useState<boolean | null>(null);
  const [allowlistedSenders, setAllowlistedSenders] = useState<Set<string>>(new Set());

  const parentRef = useRef<HTMLDivElement>(null);
  const scrollableItems = useMemo(() => {
    const items: Array<{ type: "message"; message: DbMessage; index: number } | { type: "smart-replies" } | { type: "inline-reply" }> = [];
    for (let i = 0; i < messages.length; i++) {
      items.push({ type: "message", message: messages[i]!, index: i });
    }
    if (activeAccountId && messages.length > 0) {
      items.push({ type: "smart-replies" });
    }
    if (activeAccountId) {
      items.push({ type: "inline-reply" });
    }
    return items;
  }, [messages, activeAccountId]);
  const virtualizer = useVirtualizer({
    count: scrollableItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 3,
  });
  const handleSent = useCallback(() => {
    if (!activeAccountId) return;
    getMessagesForThread(activeAccountId, thread.id)
      .then(setMessages)
      .catch(console.error);
  }, [activeAccountId, thread.id]);

  // Preload settings eagerly on mount (parallel with message loading)
  useEffect(() => {
    getSetting("block_remote_images").then((val) => setBlockImages(val !== "false"));
  }, []);

  // Load messages
  useEffect(() => {
    if (!activeAccountId) return;
    setLoading(true);
    getMessagesForThread(activeAccountId, thread.id)
      .then(setMessages)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeAccountId, thread.id]);

  // Check per-sender allowlist (single batch query instead of N queries)
  useEffect(() => {
    if (!activeAccountId || messages.length === 0) return;
    let cancelled = false;

    const senders: string[] = [];
    for (const msg of messages) {
      if (msg.from_address) senders.push(msg.from_address);
    }
    const uniqueSenders = [...new Set(senders)];

    getAllowlistedSenders(activeAccountId, uniqueSenders).then((allowed) => {
      if (!cancelled) setAllowlistedSenders(allowed);
    });

    return () => { cancelled = true; };
  }, [activeAccountId, messages]);

  // Auto-mark unread threads as read when opened (respects mark-as-read setting)
  const markAsReadBehavior = useLayoutStore((s) => s.markAsReadBehavior);
  useEffect(() => {
    if (!activeAccountId || thread.isRead || markedReadRef.current === thread.id) return;
    if (markAsReadBehavior === "manual") return;

    const markRead = () => {
      markedReadRef.current = thread.id;
      markThreadRead(activeAccountId, thread.id, [], true).catch((err) => {
        console.error("Failed to mark thread as read:", err);
      });
    };

    if (markAsReadBehavior === "2s") {
      const timer = setTimeout(markRead, 2000);
      return () => clearTimeout(timer);
    }

    // instant
    markRead();
  }, [activeAccountId, thread.id, thread.isRead, updateThread, markAsReadBehavior]);

  const openComposer = useComposerStore((s) => s.openComposer);
  const openMenu = useContextMenuStore((s) => s.openMenu);
  const defaultReplyMode = useLayoutStore((s) => s.defaultReplyMode);
  const lastMessage = messages[messages.length - 1];

  const handleReply = useCallback(() => {
    if (!lastMessage) return;
    const replyTo = lastMessage.reply_to ?? lastMessage.from_address;
    openComposer({
      mode: "reply",
      to: replyTo ? [replyTo] : [],
      subject: `Re: ${lastMessage.subject ?? ""}`,
      bodyHtml: buildQuote(lastMessage),
      threadId: lastMessage.thread_id,
      inReplyToMessageId: lastMessage.id,
    });
  }, [lastMessage, openComposer]);

  const handleReplyAll = useCallback(() => {
    if (!lastMessage) return;
    const replyTo = lastMessage.reply_to ?? lastMessage.from_address;
    const allRecipients = new Set<string>();
    if (replyTo) allRecipients.add(replyTo);
    if (lastMessage.to_addresses) {
      lastMessage.to_addresses.split(",").forEach((a) => allRecipients.add(a.trim()));
    }
    const ccList: string[] = [];
    if (lastMessage.cc_addresses) {
      lastMessage.cc_addresses.split(",").forEach((a) => ccList.push(a.trim()));
    }
    openComposer({
      mode: "replyAll",
      to: Array.from(allRecipients),
      cc: ccList,
      subject: `Re: ${lastMessage.subject ?? ""}`,
      bodyHtml: buildQuote(lastMessage),
      threadId: lastMessage.thread_id,
      inReplyToMessageId: lastMessage.id,
    });
  }, [lastMessage, openComposer]);

  const handleForward = useCallback(() => {
    if (!lastMessage) return;
    openComposer({
      mode: "forward",
      to: [],
      subject: `Fwd: ${lastMessage.subject ?? ""}`,
      bodyHtml: buildForwardQuote(lastMessage),
      threadId: lastMessage.thread_id,
      inReplyToMessageId: lastMessage.id,
    });
  }, [lastMessage, openComposer]);

  const handlePrint = useCallback(() => {
    if (messages.length === 0) return;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }

    const messagesHtml = messages.map((msg) => {
      const date = new Date(msg.date).toLocaleString();
      const from = msg.from_name
        ? `${escapeHtml(msg.from_name)} &lt;${escapeHtml(msg.from_address ?? "")}&gt;`
        : escapeHtml(msg.from_address ?? "Unknown");
      const to = escapeHtml(msg.to_addresses ?? "");
      const body = msg.body_html ? sanitizeHtml(msg.body_html) : escapeHtml(msg.body_text ?? "");
      return `
        <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e5e5e5">
          <div style="margin-bottom:8px;color:#666;font-size:12px">
            <strong>From:</strong> ${from}<br/>
            <strong>To:</strong> ${to}<br/>
            <strong>Date:</strong> ${date}
          </div>
          <div>${body}</div>
        </div>`;
    }).join("");

    const safeSubject = escapeHtml(thread.subject ?? "");
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>${safeSubject || "Email"}</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:800px;margin:20px auto;color:#333;font-size:14px}
      h1{font-size:18px;margin-bottom:8px}img{max-width:100%}</style></head>
      <body><h1>${safeSubject || "(No subject)"}</h1>${messagesHtml}</body></html>`);
    doc.close();

    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, [messages, thread.subject]);

  // Message-level keyboard navigation (ArrowUp / ArrowDown)
  const [focusedMsgIdx, setFocusedMsgIdx] = useState(-1);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Reset focused index when thread changes
  useEffect(() => {
    setFocusedMsgIdx(-1);
    setContactSidebarVisible(false);
  }, [thread.id]);

  // Scroll focused message into view
  useEffect(() => {
    if (focusedMsgIdx >= 0) {
      const idx = scrollableItems.findIndex(
        (item) => item.type === "message" && item.index === focusedMsgIdx
      );
      if (idx >= 0) {
        virtualizer.scrollToIndex(idx, { align: "auto" });
      }
    }
  }, [focusedMsgIdx, scrollableItems, virtualizer]);

  // Arrow key handler for message navigation (only in full-screen thread view)
  // In split-pane mode, arrows navigate the thread list instead (handled by useKeyboardShortcuts)
  const readingPanePosition = useLayoutStore((s) => s.readingPanePosition);
  useEffect(() => {
    if (readingPanePosition !== "hidden") return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isInputFocused) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedMsgIdx((prev) => {
          const next = prev + 1;
          return next < messages.length ? next : prev;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedMsgIdx((prev) => {
          const next = prev - 1;
          return next >= 0 ? next : prev;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [messages.length, readingPanePosition]);

  const [rawMessageTarget, setRawMessageTarget] = useState<{
    messageId: string;
    accountId?: string;
  } | null>(null);

  // Listen for "View Source" event from context menu
  useEffect(() => {
    const handler = (detail: { messageId: string; accountId?: string }) => {
      setRawMessageTarget(detail);
    };
    uiBus.on("view-raw-message", handler);
    return () => uiBus.off("view-raw-message", handler);
  }, []);

  // Listen for extract-task event from keyboard shortcut
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { threadId: string } | undefined;
      if (detail?.threadId === thread.id) {
        setShowTaskExtract(true);
      }
    };
    window.addEventListener("smemaster-extract-task", handler);
    return () => window.removeEventListener("smemaster-extract-task", handler);
  }, [thread.id]);

  const handleMessageContextMenu = useCallback((e: React.MouseEvent, msg: DbMessage) => {
    e.preventDefault();
    openMenu("message", { x: e.clientX, y: e.clientY }, {
      messageId: msg.id,
      threadId: msg.thread_id,
      accountId: msg.account_id,
      fromAddress: msg.from_address,
      fromName: msg.from_name,
      replyTo: msg.reply_to,
      toAddresses: msg.to_addresses,
      ccAddresses: msg.cc_addresses,
      subject: msg.subject,
      date: msg.date,
      bodyHtml: msg.body_html,
      bodyText: msg.body_text,
    });
  }, [openMenu]);

  const handleExport = useCallback(async () => {
    if (messages.length === 0) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");

      const emlParts = messages.map((msg) => {
        const date = new Date(msg.date).toUTCString();
        const from = msg.from_name
          ? `${msg.from_name} <${msg.from_address}>`
          : (msg.from_address ?? "");
        const lines = [
          `From: ${from}`,
          `To: ${msg.to_addresses ?? ""}`,
          msg.cc_addresses ? `Cc: ${msg.cc_addresses}` : null,
          `Subject: ${msg.subject ?? ""}`,
          `Date: ${date}`,
          `Message-ID: <${msg.id}>`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=UTF-8`,
          ``,
          msg.body_html ?? msg.body_text ?? "",
        ].filter((l): l is string => l !== null);
        return lines.join("\r\n");
      });

      const content = emlParts.join("\r\n\r\n");
      const defaultName = `${(thread.subject ?? "email").replace(/[^a-zA-Z0-9_-]/g, "_")}.eml`;

      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: "Email", extensions: ["eml"] }],
      });
      if (filePath) {
        await writeTextFile(filePath, content);
      }
    } catch (err) {
      console.error("Failed to export thread:", err);
    }
  }, [messages, thread.subject]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <MessageSkeleton />
        <MessageSkeleton />
        <MessageSkeleton />
      </div>
    );
  }

  // Detect no-reply senders ��� disable reply buttons but still allow forward
  const noReply = isNoReplyAddress(lastMessage?.reply_to ?? lastMessage?.from_address);

  // Get the primary sender for the contact sidebar
  const primarySender = lastMessage?.from_address ?? null;
  const primarySenderName = lastMessage?.from_name ?? null;

  return (
    <div className="flex h-full @container relative">
      <div className="flex flex-col flex-1 min-w-0">
        {/* Unified action bar */}
        <ActionBar
          thread={thread}
          messages={messages}
          noReply={noReply}
          defaultReplyMode={defaultReplyMode}
          contactSidebarVisible={contactSidebarVisible}
          taskSidebarVisible={taskSidebarVisible}
          onReply={handleReply}
          onReplyAll={handleReplyAll}
          onForward={handleForward}
          onPrint={handlePrint}
          onExport={handleExport}
          onPopOut={isMobileDevice ? undefined : () => handlePopOut(thread)}
          onToggleContactSidebar={toggleContactSidebar}
          onToggleTaskSidebar={() => useLayoutStore.getState().toggleTaskSidebar()}
          isMobile={isMobileDevice}
        />

        {/* Thread subject */}
        <div className={`border-b border-border-primary ${isMobileDevice ? "px-4 py-2" : "px-6 py-3"}`}>
          <h1 className={`font-semibold text-text-primary flex items-center gap-2 ${isMobileDevice ? "text-base" : "text-lg"}`}>
            {thread.subject ?? t('thread.noSubject')}
            {thread.isMuted && (
              <span className="text-warning shrink-0" title={t('thread.muted')}>
                <VolumeX size={isMobileDevice ? 14 : 16} />
              </span>
            )}
          </h1>
          <div className={`text-text-tertiary mt-1 ${isMobileDevice ? "text-xs" : "text-xs"}`}>
            {t('thread.nMessagesInThread', { n: messages.length })}
          </div>
        </div>

        {/* AI Summary */}
        {activeAccountId && (
          <ThreadSummary
            threadId={thread.id}
            accountId={activeAccountId}
            messages={messages}
          />
        )}

        {/* Messages */}
        <div ref={parentRef} className="flex-1 safe-area-bottom" style={{ overflow: "auto" }}>
          <ErrorBoundary name="MessageList">
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = scrollableItems[virtualItem.index];
                if (!item) return null;
                return (
                  <div
                    key={virtualItem.key}
                    ref={virtualizer.measureElement}
                    data-index={virtualItem.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <MessageListRow
                      style={{}}
                      ariaAttributes={{}}
                      index={virtualItem.index}
                      items={scrollableItems}
                      messages={messages}
                      messageRefs={messageRefs}
                      focusedMsgIdx={focusedMsgIdx}
                      blockImages={blockImages}
                      allowlistedSenders={allowlistedSenders}
                      thread={thread}
                      handleMessageContextMenu={handleMessageContextMenu}
                      activeAccountId={activeAccountId}
                      noReply={noReply}
                      onSent={handleSent}
                      openComposer={openComposer}
                    />
                  </div>
                );
              })}
            </div>
          </ErrorBoundary>
        </div>
      </div>

      {/* Contact sidebar ��� overlay at narrow widths, inline at wide */}
      {contactSidebarVisible && primarySender && activeAccountId && (
        <>
          {/* Backdrop for overlay mode (narrow widths) */}
          <div
            className="absolute inset-0 z-10 bg-black/20 @[640px]:hidden"
            onClick={toggleContactSidebar}
          />
          <div className="absolute right-0 top-0 bottom-0 z-20 shadow-xl @[640px]:relative @[640px]:z-auto @[640px]:shadow-none">
            <ContactSidebar
              email={primarySender}
              name={primarySenderName}
              accountId={activeAccountId}
              bodyText={lastMessage?.body_text ?? null}
              onClose={toggleContactSidebar}
            />
          </div>
        </>
      )}

      {/* Task sidebar */}
      {taskSidebarVisible && activeAccountId && (
        <TaskSidebar accountId={activeAccountId} threadId={thread.id} />
      )}

      {/* Raw message source modal */}
      {rawMessageTarget && (
        <RawMessageModal
          isOpen={true}
          onClose={() => setRawMessageTarget(null)}
          messageId={rawMessageTarget.messageId}
          accountId={rawMessageTarget.accountId ?? activeAccountId ?? ''}
        />
      )}

      {/* AI Task Extraction Dialog */}
      {showTaskExtract && activeAccountId && (
        <AiTaskExtractDialog
          threadId={thread.id}
          accountId={activeAccountId}
          messages={messages}
          onClose={() => setShowTaskExtract(false)}
        />
      )}
    </div>
  );
}

interface MessageListRowExtraProps {
  items: Array<{ type: "message"; message: DbMessage; index: number } | { type: "smart-replies" } | { type: "inline-reply" }>;
  messages: DbMessage[];
  messageRefs: { current: (HTMLDivElement | null)[] };
  focusedMsgIdx: number;
  blockImages: boolean | null;
  allowlistedSenders: Set<string>;
  thread: Thread;
  handleMessageContextMenu: (e: React.MouseEvent, msg: DbMessage) => void;
  activeAccountId: string | null;
  noReply: boolean;
  onSent: () => void;
  openComposer: ReturnType<typeof useComposerStore.getState>["openComposer"];
}

function MessageListRow({
  index,
  style,
  ariaAttributes,
  items,
  messages,
  messageRefs,
  focusedMsgIdx,
  blockImages,
  allowlistedSenders,
  thread,
  handleMessageContextMenu,
  activeAccountId,
  noReply,
  onSent,
  openComposer,
}: {
  ariaAttributes: Record<string, unknown>;
  index: number;
  style: CSSProperties;
} & MessageListRowExtraProps) {
  const item = items[index]!;
  const { mobile: isMobileDevice } = usePlatform();
  
  const handleMessageDelete = useCallback((_messageId: string) => {
    // Stub: Real implementation would call a mutation.
  }, []);

  switch (item.type) {
    case "message": {
      const msg = item.message;
      const messageNode = (
        <MessageItem
          ref={(el) => {
            messageRefs.current[item.index] = el;
          }}
          message={msg}
          isLast={item.index === messages.length - 1}
          focused={item.index === focusedMsgIdx}
          blockImages={blockImages}
          senderAllowlisted={
            msg.from_address
              ? allowlistedSenders.has(msg.from_address)
              : false
          }
          isSpam={thread.labelIds.includes("SPAM")}
          onContextMenu={(e) => handleMessageContextMenu(e, msg)}
        />
      );
      return (
        <div style={style} {...ariaAttributes}>
          {isMobileDevice ? (
            <SwipeToDelete onDelete={() => handleMessageDelete(msg.id)}>
              {messageNode}
            </SwipeToDelete>
          ) : (
            messageNode
          )}
        </div>
      );
    }
    case "smart-replies": {
      return (
        <div style={style} {...ariaAttributes}>
          <SmartReplySuggestions
            threadId={thread.id}
            accountId={activeAccountId!}
            messages={messages}
            noReply={noReply}
            onApplyPolish={(text) => {
              const lastMsg = messages[messages.length - 1];
              if (!lastMsg) return;
              const replyTo = lastMsg.reply_to ?? lastMsg.from_address;
              openComposer({
                mode: "reply",
                to: replyTo ? [replyTo] : [],
                subject: `Re: ${lastMsg.subject ?? ""}`,
                bodyHtml: text,
                threadId: lastMsg.thread_id,
                inReplyToMessageId: lastMsg.id,
              });
            }}
          />
        </div>
      );
    }
    case "inline-reply": {
      return (
        <div style={style} {...ariaAttributes}>
          <InlineReply
            thread={thread}
            messages={messages}
            accountId={activeAccountId!}
            noReply={noReply}
            onSent={onSent}
          />
        </div>
      );
    }
    default:
      return null;
  }
}

function buildQuote(msg: DbMessage): string {
  const date = new Date(msg.date).toLocaleString();
  const from = msg.from_name
    ? `${escapeHtml(msg.from_name)} &lt;${escapeHtml(msg.from_address ?? "")}&gt;`
    : escapeHtml(msg.from_address ?? "Unknown");
  const body = msg.body_html ? sanitizeHtml(msg.body_html) : escapeHtml(msg.body_text ?? "");
  return `<br><br><div style="border-left:2px solid #ccc;padding-left:12px;margin-left:0;color:#666">On ${date}, ${from} wrote:<br>${body}</div>`;
}

function buildForwardQuote(msg: DbMessage): string {
  const date = new Date(msg.date).toLocaleString();
  const body = msg.body_html ? sanitizeHtml(msg.body_html) : escapeHtml(msg.body_text ?? "");
  return `<br><br>---------- Forwarded message ---------<br>From: ${escapeHtml(msg.from_name ?? "")} &lt;${escapeHtml(msg.from_address ?? "")}&gt;<br>Date: ${date}<br>Subject: ${escapeHtml(msg.subject ?? "")}<br>To: ${escapeHtml(msg.to_addresses ?? "")}<br><br>${body}`;
}



