import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Reply, ReplyAll, Forward, Send, Maximize2, RotateCcw, X, Loader2, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { useLayoutStore } from "@shared/stores/layoutStore";
import { sendEmail, archiveThread } from "@features/mail/services/emailActions";
import { buildRawEmail } from "@shared/utils/emailBuilder";
import { upsertContact } from "@features/contacts/db/contacts.ts";
import { getDefaultSignature } from "@features/mail/db/signatures";
import { QuickReplyList } from "./QuickReplyList";
import { useAutoDraft } from "@features/mail/hooks/useAutoDraft";
import { useUndoSend } from "@features/mail/hooks/useUndoSend";
import type { DbMessage } from "@shared/services/db/messages";
import type { Thread } from "@features/mail/stores/threadStore";

type ReplyMode = "reply" | "replyAll" | "forward";

interface InlineReplyProps {
  thread: Thread;
  messages: DbMessage[];
  accountId: string;
  noReply?: boolean;
  onSent: () => void;
}

export function InlineReply({ thread, messages, accountId, noReply, onSent }: InlineReplyProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ReplyMode | null>(null);
  const [signatureHtml, setSignatureHtml] = useState("");
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccount = accounts.find((a) => a.id === accountId);
  const openComposer = useComposerStore((s) => s.openComposer);
  const containerRef = useRef<HTMLDivElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastMessage = messages[messages.length - 1];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, link: { openOnClick: false } }),
      Placeholder.configure({
        placeholder: t('composer.writeYourReply'),
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none px-3 py-2 min-h-[80px] max-h-[200px] overflow-y-auto focus:outline-none text-text-primary text-sm",
      },
    },
  });

  // AI auto-draft lifecycle (loading, hasDraft, abort on typing, clear).
  // Replaces the previous inline loadAutoDraft/handleRegenerateDraft
  // state machines + the editor "update" listener.
  const autoDraft = useAutoDraft({
    threadId: thread.id,
    accountId,
    messages,
    editor,
  });

  // Snapshot of the data captured at send time. The undo-send timer's
  // onSend callback reads from this ref so it never closes over stale
  // values from when the user clicked Send.
  const pendingSendRef = useRef<{
    raw: string;
    to: string[];
    cc: string[];
  }>({ raw: "", to: [], cc: [] });

  // Undo-send timer + visibility lifecycle for the inline reply. The
  // onSend callback fires after the delay and does the actual send + post
  // send cleanup (archive, contacts).
  const undoSend = useUndoSend({
    onSend: async () => {
      const pending = pendingSendRef.current;
      try {
        await sendEmail(accountId, pending.raw, thread.id);

        // Send & archive: remove from inbox if enabled
        if (useLayoutStore.getState().sendAndArchive) {
          try { await archiveThread(accountId, thread.id, []); } catch { /* ignore */ }
        }

        // Update contacts frequency
        for (const addr of [...pending.to, ...pending.cc]) {
          await upsertContact(addr, null);
        }
      } catch (err) {
        console.error("Failed to send inline reply:", err);
      }
    },
  });

  const activateMode = useCallback((newMode: ReplyMode) => {
    setMode(newMode);
    // Clear any in-flight AI draft + the editor's auto-draft content.
    // The hook handles aborting any pending generation.
    autoDraft.clear();
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => editor?.commands.focus(), 50);

    // Trigger auto-draft for reply/replyAll (not forward).
    if (newMode === "reply" || newMode === "replyAll") {
      autoDraft.load(newMode);
    }
  }, [editor, autoDraft]);

  // Load default signature
  useEffect(() => {
    getDefaultSignature(accountId).then((sig) => {
      if (sig) setSignatureHtml(sig.body_html);
    });
  }, [accountId]);

  // Listen for inline reply events from keyboard shortcuts
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mode: ReplyMode } | undefined;
      if (detail?.mode) {
        activateMode(detail.mode);
      }
    };
    window.addEventListener("smemaster-inline-reply", handler);
    return () => window.removeEventListener("smemaster-inline-reply", handler);
  }, [activateMode]);

  // Scroll into view when activated
  useEffect(() => {
    if (mode && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [mode]);

  const getRecipients = useCallback((): { to: string[]; cc: string[] } => {
    if (!lastMessage) return { to: [], cc: [] };

    if (mode === "forward") return { to: [], cc: [] };

    const replyTo = lastMessage.reply_to ?? lastMessage.from_address;

    if (mode === "reply") {
      return { to: replyTo ? [replyTo] : [], cc: [] };
    }

    // replyAll
    const allTo = new Set<string>();
    if (replyTo) allTo.add(replyTo);
    if (lastMessage.to_addresses) {
      lastMessage.to_addresses.split(",").forEach((a) => allTo.add(a.trim()));
    }
    // Remove self from recipients
    if (activeAccount?.email) allTo.delete(activeAccount.email);

    const ccList: string[] = [];
    if (lastMessage.cc_addresses) {
      lastMessage.cc_addresses.split(",").forEach((a) => {
        const trimmed = a.trim();
        if (trimmed && trimmed !== activeAccount?.email) ccList.push(trimmed);
      });
    }

    return { to: Array.from(allTo), cc: ccList };
  }, [lastMessage, mode, activeAccount?.email]);

  const getSubject = useCallback((): string => {
    const sub = lastMessage?.subject ?? "";
    if (mode === "forward") return sub.startsWith("Fwd:") ? sub : `Fwd: ${sub}`;
    return sub.startsWith("Re:") ? sub : `Re: ${sub}`;
  }, [lastMessage, mode]);

  const handleSend = useCallback(async () => {
    if (!activeAccount || !editor || undoSend.visible) return;
    const { to, cc } = getRecipients();
    if (to.length === 0 && mode !== "forward") return;

    let html = editor.getHTML();
    if (signatureHtml) {
      html += `<div style="margin-top:16px;border-top:1px solid #e5e5e5;padding-top:12px">${signatureHtml}</div>`;
    }

    const raw = buildRawEmail({
      from: activeAccount.email,
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: getSubject(),
      htmlBody: html,
      inReplyTo: lastMessage?.id,
      threadId: thread.id,
    });

    // Snapshot for the onSend callback.
    pendingSendRef.current = { raw, to, cc };

    const ok = await undoSend.schedule();
    if (!ok) return; // Already a pending undo-send.

    // Reset inline state immediately; the actual send fires after the delay.
    editor.commands.setContent("");
    setMode(null);
    onSent();
  }, [activeAccount, editor, undoSend, getRecipients, getSubject, signatureHtml, lastMessage, thread.id, mode, onSent]);

  const handleExpandToComposer = useCallback(() => {
    if (!editor || !lastMessage) return;
    const { to, cc } = getRecipients();
    const bodyHtml = editor.getHTML();

    openComposer({
      mode: mode === "forward" ? "forward" : mode === "replyAll" ? "replyAll" : "reply",
      to,
      cc,
      subject: getSubject(),
      bodyHtml,
      threadId: thread.id,
      inReplyToMessageId: lastMessage.id,
    });

    // Reset inline state
    editor.commands.setContent("");
    setMode(null);
  }, [editor, lastMessage, getRecipients, getSubject, mode, thread.id, openComposer]);

  const handleRegenerateDraft = useCallback(() => {
    if (!mode || mode === "forward") return;
    autoDraft.regenerate(mode);
  }, [autoDraft, mode]);

  const handleClearDraft = useCallback(() => {
    if (!editor) return;
    autoDraft.clear();
    editor.commands.focus();
  }, [editor, autoDraft]);

  // Cleanup focus timer on unmount.
  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);

  // Handle Ctrl+Enter to send, Escape to close
  useEffect(() => {
    if (!mode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        editor?.commands.setContent("");
        setMode(null);
        autoDraft.clear();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, handleSend, editor, autoDraft]);

  if (!lastMessage) return null;

  // Collapsed state — show reply buttons
  if (!mode) {
    return (
      <div ref={containerRef} className="mx-4 my-3 flex items-center gap-2">
        <button
          onClick={() => activateMode("reply")}
          disabled={noReply}
          title={noReply ? t('email.thisSenderAcceptsNoReplies') : undefined}
          className="flex items-center gap-1.5 px-4 py-2 text-xs text-text-secondary border border-border-primary rounded-lg hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-secondary"
        >
          <Reply size={14} />
          {t("actionBar.reply")}
        </button>
        <button
          onClick={() => activateMode("replyAll")}
          disabled={noReply}
          title={noReply ? t('email.thisSenderAcceptsNoReplies') : undefined}
          className="flex items-center gap-1.5 px-4 py-2 text-xs text-text-secondary border border-border-primary rounded-lg hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-secondary"
        >
          <ReplyAll size={14} />
          {t("actionBar.replyAll")}
        </button>
        <button
          onClick={() => activateMode("forward")}
          className="flex items-center gap-1.5 px-4 py-2 text-xs text-text-secondary border border-border-primary rounded-lg hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <Forward size={14} />
          {t('composer.forward')}
        </button>
      </div>
    );
  }

  // Expanded state — editor visible
  const { to } = getRecipients();
  const modeLabel = mode === "reply" ? t("actionBar.reply") : mode === "replyAll" ? t("actionBar.replyAll") : t('composer.forward');
  const sending = undoSend.visible;

  return (
    <div ref={containerRef} className="mx-4 my-3 border border-border-primary rounded-lg overflow-hidden bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-bg-secondary border-b border-border-secondary">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {(["reply", "replyAll", "forward"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-1 text-[0.6875rem] rounded transition-colors ${
                  mode === m
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {m === "reply" ? t("actionBar.reply") : m === "replyAll" ? t("actionBar.replyAll") : t('composer.forward')}
              </button>
            ))}
          </div>
          {to.length > 0 && (
            <span className="text-[0.6875rem] text-text-tertiary truncate max-w-[200px]">
              {t('composer.to')} {to.join(", ")}
            </span>
          )}
          {activeAccount?.company && (
            <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium bg-accent/5 text-accent px-1.5 py-0.5 rounded border border-accent/10">
              <Building2 size={10} className="shrink-0" />
              {activeAccount.company}
            </span>
          )}
        </div>
        <button
          onClick={() => setMode(null)}
          className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>

      {/* Editor */}
      <div className="relative">
        <EditorContent editor={editor} />
        {autoDraft.loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Loader2 size={14} className="animate-spin" />
              {t('composer.generatingDraft')}
            </div>
          </div>
        )}
      </div>

      {/* Quick Replies */}
      <QuickReplyList
        accountId={accountId}
        onInsert={(bodyHtml) => {
          editor?.chain().focus().insertContent(bodyHtml).run();
        }}
      />

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border-secondary bg-bg-secondary">
        <div className="flex items-center gap-1">
          <button
            onClick={handleExpandToComposer}
            title={t('composer.expandToFullComposer')}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            <Maximize2 size={12} />
            {t('composer.expand')}
          </button>
          {autoDraft.hasDraft && mode !== "forward" && (
            <>
              <button
                onClick={handleRegenerateDraft}
                disabled={autoDraft.loading}
                title={t('composer.regenerateAiDraft')}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-accent transition-colors disabled:opacity-50"
              >
                <RotateCcw size={11} />
                {t('composer.regenerate')}
              </button>
              <button
                onClick={handleClearDraft}
                title={t('composer.clearAiDraft')}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-danger transition-colors"
              >
                <X size={11} />
                {t('common.clear')}
              </button>
            </>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={sending || (to.length === 0 && mode !== "forward")}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={12} />
          {modeLabel}
        </button>
      </div>
    </div>
  );
}
