import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CSSTransition } from "react-transition-group";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { usePlatform } from "@shared/hooks/usePlatform";
import { CustomMention } from "./MentionExtension";
import { LinkPreviewExtension } from "./LinkPreviewExtension";
import { EditorToolbar } from "./EditorToolbar";
import { AiAssistPanel } from "./AiAssistPanel";
import { AttachmentPicker } from "./AttachmentPicker";
import { ScheduleSendDialog } from "./ScheduleSendDialog";
import { TemplatePicker } from "./TemplatePicker";
import { CompliancePanel } from "./CompliancePanel";
import { PreSendChecklist } from "./PreSendChecklist";
import { ComposerHeader } from "./ComposerHeader";
import { ComposerAddressSection } from "./ComposerAddressSection";
import { ComposerSubjectField } from "./ComposerSubjectField";
import { ComposerFooter } from "./ComposerFooter";
import { ZenMode } from "@shared/components/ui/ZenMode";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useLayoutStore } from "@shared/stores/layoutStore";
import { sendEmail, archiveThread, deleteDraft as deleteDraftAction } from "@features/mail/services/emailActions";
import { buildRawEmail } from "@shared/utils/emailBuilder";
import { upsertContact } from "@features/contacts/db/contacts.ts";
import { insertScheduledEmail } from "@features/mail/db/scheduledEmails";
import { getDefaultSignature } from "@features/mail/db/signatures";
import { getAliasesForAccount, mapDbAlias, type SendAsAlias } from "@features/mail/db/sendAsAliases";
import { resolveFromAddress } from "@shared/utils/resolveFromAddress";
import { startAutoSave, stopAutoSave } from "@features/mail/services/composer/draftAutoSave";
import { getTemplatesForAccount, type DbTemplate } from "@features/mail/db/templates";
import { readFileAsBase64 } from "@shared/utils/fileUtils";
import { interpolateVariables } from "@shared/utils/templateVariables";
import { sanitizeHtml } from "@shared/utils/sanitize";
import { useUndoSend } from "@features/mail/hooks/useUndoSend";
import { getSetting } from "@features/settings";

export function Composer() {
  const { t } = useTranslation();
  // Individual selectors — only re-render when each specific value changes
  const isOpen = useComposerStore((s) => s.isOpen);
  const mode = useComposerStore((s) => s.mode);
  const to = useComposerStore((s) => s.to);
  const cc = useComposerStore((s) => s.cc);
  const bcc = useComposerStore((s) => s.bcc);
  const subject = useComposerStore((s) => s.subject);
  const showCcBcc = useComposerStore((s) => s.showCcBcc);
  const fromEmail = useComposerStore((s) => s.fromEmail);
  const viewMode = useComposerStore((s) => s.viewMode);
  const signatureHtml = useComposerStore((s) => s.signatureHtml);
  const isSaving = useComposerStore((s) => s.isSaving);
  const lastSavedAt = useComposerStore((s) => s.lastSavedAt);
  // Note: bodyHtml intentionally NOT subscribed — TipTap manages its own editor state.
  // Subscribing would cause full re-renders on every keystroke.
  const closeComposer = useComposerStore((s) => s.closeComposer);
  const setTo = useComposerStore((s) => s.setTo);
  const setCc = useComposerStore((s) => s.setCc);
  const setBcc = useComposerStore((s) => s.setBcc);
  const setSubject = useComposerStore((s) => s.setSubject);
  const setShowCcBcc = useComposerStore((s) => s.setShowCcBcc);
  const setFromEmail = useComposerStore((s) => s.setFromEmail);
  const setViewMode = useComposerStore((s) => s.setViewMode);
  const addAttachment = useComposerStore((s) => s.addAttachment);

  const [zenMode, setZenMode] = useState(false);

  const textDirection = useLayoutStore((s) => s.textDirection);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const sendingRef = useRef(false);
  // Snapshot of composer state captured at schedule() time. The actual send
  // work (which fires after the undo-send delay) reads from this ref so the
  // timer's body never closes over stale store values.
  const pendingSendRef = useRef<{
    raw: string;
    threadId: string | null;
    draftId: string | null;
    to: string[];
    cc: string[];
    bcc: string[];
  }>({ raw: "", threadId: null, draftId: null, to: [], cc: [], bcc: [] });
  const [showSchedule, setShowSchedule] = useState(false);
  const [showPreSendChecklist, setShowPreSendChecklist] = useState(false);
  const [preSendData, setPreSendData] = useState<{
    raw: string;
    senderEmail: string;
    isBulk: boolean;
  } | null>(null);
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [aliases, setAliases] = useState<SendAsAlias[]>([]);
  const templateShortcutsRef = useRef<DbTemplate[]>([]);
  const dragCounterRef = useRef(0);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const pasteSizeLimitsRef = useRef({ maxTotal: 24 * 1024 * 1024, maxPerFile: 25 * 1024 * 1024 });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false },
      }),
      Placeholder.configure({
        placeholder: t('composer.writeYourMessage'),
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "right", "center", "justify"],
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CustomMention,
      LinkPreviewExtension,
    ],
    content: useComposerStore.getState().bodyHtml,
    onUpdate: ({ editor: ed }) => {
      useComposerStore.getState().setBodyHtml(ed.getHTML());

      // Check for template shortcut triggers
      const templates = templateShortcutsRef.current;
      if (templates.length === 0) return;

      const text = ed.state.doc.textContent;
      for (const tmpl of templates) {
        if (!tmpl.shortcut) continue;
        if (text.endsWith(tmpl.shortcut)) {
          // Delete the shortcut text and insert template body with variables resolved
          const { from } = ed.state.selection;
          const deleteFrom = from - tmpl.shortcut.length;
          if (deleteFrom >= 0) {
            const state = useComposerStore.getState();
            const account = useAccountStore.getState().accounts.find(
              (a) => a.id === useAccountStore.getState().activeAccountId,
            );
            interpolateVariables(tmpl.body_html, {
              recipientEmail: state.to[0],
              senderEmail: account?.email,
              senderName: account?.displayName ?? undefined,
              subject: state.subject || undefined,
            }).then((resolved) => {
              ed.chain()
                .deleteRange({ from: deleteFrom, to: from })
                .insertContent(resolved)
                .run();
            });
            if (tmpl.subject && !state.subject) {
              setSubject(tmpl.subject);
            }
          }
          break;
        }
      }
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none px-4 py-3 min-h-[200px] focus:outline-none text-text-primary",
      },
      handleDrop: (_view, event) => {
        // Prevent TipTap from handling file drops as inline content.
        // Returning true stops TipTap's Image extension from intercepting the drop,
        // allowing the event to bubble up to the composer's onDrop for attachment handling.
        if (event.dataTransfer?.files?.length) {
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item) continue;
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return true;

            // Check size limits
            const { maxTotal, maxPerFile } = pasteSizeLimitsRef.current;
            if (file.size > maxPerFile) {
              console.warn(`Per-file size limit exceeded for pasted image: ${file.name}`);
              return true;
            }
            const currentTotal = useComposerStore.getState().attachments.reduce((s, a) => s + a.size, 0);
            if (currentTotal + file.size > maxTotal) {
              console.warn("Total attachment size limit exceeded for pasted image");
              return true;
            }

            readFileAsBase64(file).then((content) => {
              addAttachment({
                id: crypto.randomUUID(),
                file,
                filename: file.name || `pasted-image-${Date.now()}.png`,
                mimeType: file.type || "image/png",
                size: file.size,
                content,
              });
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  // Load signature, aliases, and templates in parallel when composer opens
  useEffect(() => {
    if (!isOpen || !activeAccountId) return;
    let cancelled = false;

    // Load attachment size limits in the background
    (async () => {
      try {
        const totalSetting = await getSetting("max_attachment_size_mb");
        if (totalSetting) {
          const mb = parseInt(totalSetting, 10);
          pasteSizeLimitsRef.current.maxTotal = mb * 1024 * 1024;
        }
        const perFileSetting = await getSetting("max_attachment_per_file_mb");
        if (perFileSetting) {
          const mb = parseInt(perFileSetting, 10);
          pasteSizeLimitsRef.current.maxPerFile = mb * 1024 * 1024;
        }
      } catch { /* use defaults */ }
    })();

    Promise.all([
      getDefaultSignature(activeAccountId),
      getAliasesForAccount(activeAccountId),
      getTemplatesForAccount(activeAccountId),
    ]).then(([sig, dbAliases, templates]) => {
      if (cancelled) return;
      const store = useComposerStore.getState();

      // Signature
      if (sig) {
        store.setSignatureHtml(sig.body_html);
        store.setSignatureId(sig.id);
      }

      // Aliases + fromEmail resolution
      const mapped = dbAliases.map(mapDbAlias);
      setAliases(mapped);
      if (!store.fromEmail && mapped.length > 0) {
        if (store.mode === "reply" || store.mode === "replyAll" || store.mode === "forward") {
          const resolved = resolveFromAddress(mapped, store.to.join(", "), store.cc.join(", "));
          if (resolved) store.setFromEmail(resolved.email);
        } else {
          const defaultAlias = mapped.find((a) => a.isDefault) ?? mapped.find((a) => a.isPrimary) ?? mapped[0];
          if (defaultAlias) store.setFromEmail(defaultAlias.email);
        }
      }

      // Templates
      templateShortcutsRef.current = templates.filter((t) => t.shortcut);
    });

    return () => { cancelled = true; };
  }, [isOpen, activeAccountId]);

  // Start/stop draft auto-save
  useEffect(() => {
    if (!isOpen || !activeAccountId) return;
    startAutoSave(activeAccountId);
    return () => { stopAutoSave(); };
  }, [isOpen, activeAccountId]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // Load size limits from settings
    let totalMb = 24;
    let perFileMb = 25;
    try {
      const totalSetting = await getSetting("max_attachment_size_mb");
      if (totalSetting) totalMb = parseInt(totalSetting, 10);
      const perFileSetting = await getSetting("max_attachment_per_file_mb");
      if (perFileSetting) perFileMb = parseInt(perFileSetting, 10);
    } catch {
      // use defaults
    }
    const maxTotal = totalMb * 1024 * 1024;
    const maxPerFile = perFileMb * 1024 * 1024;

    const currentTotal = useComposerStore.getState().attachments.reduce((sum, a) => sum + a.size, 0);

    for (const file of Array.from(files)) {
      if (file.size > maxPerFile) {
        console.warn(`Per-file size limit exceeded (${perFileMb}MB): ${file.name}`);
        continue;
      }
      if (currentTotal + file.size > maxTotal) {
        console.warn(`Total attachment size limit exceeded (${totalMb}MB)`);
        break;
      }
      const content = await readFileAsBase64(file);
      addAttachment({
        id: crypto.randomUUID(),
        file,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        content,
      });
    }
  }, [addAttachment]);

  const getFullHtml = useCallback(() => {
    const editorHtml = editor?.getHTML() ?? "";
    if (!signatureHtml) return editorHtml;
    return `${editorHtml}<div style="margin-top:16px;border-top:1px solid #e5e5e5;padding-top:12px">${sanitizeHtml(signatureHtml)}</div>`;
  }, [editor, signatureHtml]);

  const buildRawAndSender = useCallback(() => {
    const state = useComposerStore.getState();
    const html = getFullHtml();
    const senderEmail = state.fromEmail ?? activeAccount!.email;
    const raw = buildRawEmail({
      from: senderEmail,
      to: state.to,
      cc: state.cc.length > 0 ? state.cc : undefined,
      bcc: state.bcc.length > 0 ? state.bcc : undefined,
      subject: state.subject,
      htmlBody: html,
      inReplyTo: state.inReplyToMessageId ?? undefined,
      threadId: state.threadId ?? undefined,
      attachments: state.attachments.length > 0
        ? state.attachments.map((a) => ({
            filename: a.filename,
            mimeType: a.mimeType,
            content: a.content,
          }))
        : undefined,
    });
    return { raw, senderEmail };
  }, [activeAccount, getFullHtml]);

  // Undo-send timer + visibility lifecycle (delay read from settings, toast
  // managed by the composer store). The onSend callback fires after the
  // delay and reads the pending send snapshot from `pendingSendRef`.
  const undoSend = useUndoSend({
    onSend: async () => {
      if (!activeAccountId) return;
      const pending = pendingSendRef.current;
      try {
        await sendEmail(activeAccountId, pending.raw, pending.threadId ?? undefined);

        // Delete draft if it was saved
        if (pending.draftId) {
          try { await deleteDraftAction(activeAccountId, pending.draftId); } catch { /* ignore */ }
        }

        // Send & archive: remove from inbox if replying to a thread
        if (useLayoutStore.getState().sendAndArchive && pending.threadId) {
          try { await archiveThread(activeAccountId, pending.threadId, []); } catch { /* ignore */ }
        }

        // Update contacts frequency
        for (const addr of [...pending.to, ...pending.cc, ...pending.bcc]) {
          await upsertContact(addr, null);
        }
      } catch (err) {
        console.error("Failed to send email:", err);
      } finally {
        sendingRef.current = false;
      }
    },
  });

  const executeSend = useCallback(async (raw: string) => {
    if (!activeAccountId) return;
    const state = useComposerStore.getState();

    // Snapshot the data the timer's onSend callback needs.
    pendingSendRef.current = {
      raw,
      threadId: state.threadId ?? null,
      draftId: state.draftId ?? null,
      to: state.to,
      cc: state.cc,
      bcc: state.bcc,
    };

    await undoSend.schedule();
    closeComposer();
  }, [activeAccountId, closeComposer, undoSend]);

  const handleSend = useCallback(async () => {
    if (!activeAccountId || !activeAccount || sendingRef.current) return;
    const state = useComposerStore.getState();
    if (state.to.length === 0) return;

    sendingRef.current = true;
    stopAutoSave();

    const { raw, senderEmail } = buildRawAndSender();
    const totalRecipients = state.to.length + state.cc.length + state.bcc.length;
    const isBulk = totalRecipients > 5;

    if (isBulk) {
      // Show pre-send checklist for bulk/campaign emails
      setPreSendData({ raw, senderEmail, isBulk });
      setShowPreSendChecklist(true);
    } else {
      // Direct send for normal emails
      await executeSend(raw);
    }
  }, [activeAccountId, activeAccount, buildRawAndSender, executeSend]);

  const handlePreSendProceed = useCallback(() => {
    setShowPreSendChecklist(false);
    if (preSendData) {
      executeSend(preSendData.raw);
      setPreSendData(null);
    }
  }, [preSendData, executeSend]);

  const handlePreSendClose = useCallback(() => {
    setShowPreSendChecklist(false);
    setPreSendData(null);
    sendingRef.current = false;
  }, []);

  const handleSchedule = useCallback(async (scheduledAt: number) => {
    if (!activeAccountId || !activeAccount) return;
    const state = useComposerStore.getState();
    if (state.to.length === 0) return;

    const html = getFullHtml();

    const attachmentData = state.attachments.length > 0
      ? JSON.stringify(state.attachments.map((a) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          content: a.content,
        })))
      : null;

    await insertScheduledEmail({
      accountId: activeAccountId,
      toAddresses: state.to.join(", "),
      ccAddresses: state.cc.length > 0 ? state.cc.join(", ") : null,
      bccAddresses: state.bcc.length > 0 ? state.bcc.join(", ") : null,
      subject: state.subject,
      bodyHtml: html,
      replyToMessageId: state.inReplyToMessageId,
      threadId: state.threadId,
      scheduledAt,
      signatureId: null,
      attachmentPaths: attachmentData,
    });

    stopAutoSave();
    // Delete the draft if exists
    if (state.draftId) {
      try {
        await deleteDraftAction(activeAccountId, state.draftId);
      } catch { /* ignore */ }
    }

    setShowSchedule(false);
    closeComposer();
  }, [activeAccountId, activeAccount, closeComposer, getFullHtml]);

  const handleDiscard = useCallback(async () => {
    stopAutoSave();
    // Delete the draft if it was saved
    const currentDraftId = useComposerStore.getState().draftId;
    if (currentDraftId && activeAccountId) {
      try {
        await deleteDraftAction(activeAccountId, currentDraftId);
      } catch { /* ignore */ }
    }
    closeComposer();
  }, [activeAccountId, closeComposer]);

  const handlePopOutComposer = useCallback(async () => {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const state = useComposerStore.getState();
      const params = new URLSearchParams();
      params.set("compose", "true");
      params.set("mode", state.mode);
      if (state.to.length > 0) params.set("to", state.to.join(","));
      if (state.cc.length > 0) params.set("cc", state.cc.join(","));
      if (state.bcc.length > 0) params.set("bcc", state.bcc.join(","));
      if (state.subject) params.set("subject", state.subject);
      if (state.threadId) params.set("threadId", state.threadId);
      if (state.inReplyToMessageId) params.set("inReplyToMessageId", state.inReplyToMessageId);
      if (state.draftId) params.set("draftId", state.draftId);
      if (state.fromEmail) params.set("fromEmail", state.fromEmail);
      // Encode body as base64 to safely pass HTML
      const bodyHtml = editor?.getHTML() ?? "";
      if (bodyHtml) params.set("body", btoa(unescape(encodeURIComponent(bodyHtml))));

      const windowLabel = `compose-${Date.now()}`;
      const existing = await WebviewWindow.getByLabel(windowLabel);
      if (existing) {
        await existing.setFocus();
        return;
      }

      new WebviewWindow(windowLabel, {
        url: `index.html?${params.toString()}`,
        title: state.subject || "New Message",
        width: 700,
        height: 650,
        center: true,
      });

      stopAutoSave();
      closeComposer();
    } catch (err) {
      console.error("Failed to pop out composer:", err);
    }
  }, [editor, closeComposer]);

  const { mobile: isMobileDevice } = usePlatform();
  const isFullpage = viewMode === "fullpage" || isMobileDevice;

  // Mobile keyboard handling: track visualViewport for keyboard open/close
  // Only on actual mobile hardware (not narrow desktop windows)
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (!isMobileDevice) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // Keyboard height = window height - visualViewport height
      const kbHeight = Math.max(0, window.innerHeight - vv.height);
      setKeyboardHeight(kbHeight);
    };

    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, [isMobileDevice]);

  const modeLabel =
    mode === "reply"
      ? t("actionBar.reply")
      : mode === "replyAll"
        ? t("actionBar.replyAll")
        : mode === "forward"
          ? t('composer.forward')
          : t('composer.newMessage');

  const savedLabel = isSaving
    ? t('common.saving')
    : lastSavedAt
      ? t('composer.draftSaved')
      : null;

  return (
    <ZenMode isActive={zenMode} onExit={() => setZenMode(false)} title={subject || "New message"} onSend={handleSend}>
    <CSSTransition nodeRef={overlayRef} in={isOpen} timeout={200} classNames="slide-up" unmountOnExit>
    <div ref={overlayRef} className={`fixed inset-0 z-50 flex ${isFullpage ? "items-stretch justify-center p-5" : isMobileDevice ? "items-end justify-center pb-4" : "items-center justify-center p-5"} pointer-events-none composer-container ${isMobileDevice ? "safe-area-bottom" : ""}`} style={isMobileDevice && keyboardHeight > 0 ? { paddingBottom: `${keyboardHeight}px` } : undefined}>
      {/* Backdrop with glass-morphism */}
      <div
        className="absolute inset-0 pointer-events-auto bg-black/30 backdrop-blur-sm"
        onClick={closeComposer}
      />

      {/* Composer window with glass-morphism & design tokens */}
      <div
        dir={textDirection}
        className={`relative bg-bg-primary border rounded-xl border-t-2 border-t-accent shadow-2xl glass-modal pointer-events-auto flex flex-col ${
          isFullpage ? "w-full h-full max-w-5xl" : "w-full max-w-2xl max-h-[85vh]"
        } ${isDragging ? "border-accent border-2" : "border-border-primary"}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.14)",
        }}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-accent/10 rounded-xl border-2 border-dashed border-accent/40 pointer-events-none backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-medium text-accent">{t('composer.dropFilesToAttach')}</span>
              <span className="text-xs text-text-tertiary">Drop files anywhere to attach</span>
            </div>
          </div>
        )}

        {/* Header */}
        <ComposerHeader
          modeLabel={modeLabel}
          isFullpage={isFullpage}
          onToggleView={() => setViewMode(isFullpage ? "modal" : "fullpage")}
          onPopOut={handlePopOutComposer}
          onClose={closeComposer}
          activeAccount={activeAccount}
          onToggleZen={() => setZenMode((p) => !p)}
        />

        {/* Address fields */}
        <ComposerAddressSection
          aliases={aliases}
          fromEmail={fromEmail}
          activeAccount={activeAccount}
          to={to}
          cc={cc}
          bcc={bcc}
          showCcBcc={showCcBcc}
          mode={mode}
          onFromChange={(email) => setFromEmail(email)}
          onToChange={setTo}
          onCcChange={setCc}
          onBccChange={setBcc}
          onToggleCcBcc={() => setShowCcBcc(true)}
        />

        {/* Subject */}
        <ComposerSubjectField subject={subject} onChange={setSubject} />

        {/* Editor toolbar */}
        <EditorToolbar
          editor={editor}
          onToggleAiAssist={() => setShowAiAssist(!showAiAssist)}
          aiAssistOpen={showAiAssist}
          onToggleTemplatePicker={() => setTemplatePickerOpen((prev) => !prev)}
        />

        {/* Desktop: side-by-side editor + AI Assist */}
        <div className={`flex-1 flex min-h-0 ${!isMobileDevice && showAiAssist ? "flex-row" : "flex-col"}`}>
          {/* Main editor area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Template Picker */}
            {templatePickerOpen && (
              <TemplatePicker
                editor={editor}
                isOpen={templatePickerOpen}
                onClose={() => setTemplatePickerOpen(false)}
                onSelect={(t) => {
                  if (!editor) return;
                  editor.chain().focus().setContent(t.body_html).run();
                  useComposerStore.getState().setBodyHtml(editor.getHTML());
                  setTemplatePickerOpen(false);
                }}
              />
            )}

            {/* Editor content */}
            <div className="flex-1 overflow-y-auto">
              <EditorContent editor={editor} />
              {signatureHtml && (
                <div
                  className="px-4 py-2 border-t border-border-secondary text-xs text-text-tertiary"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(signatureHtml) }}
                />
              )}
            </div>

            {activeAccountId && mode !== "reply" && mode !== "replyAll" && (
              <CompliancePanel
                editor={editor}
                accountId={activeAccountId}
                subject={subject}
                bodyHtml={editor?.getHTML() ?? ""}
                recipients={[...to, ...cc, ...bcc]}
              />
            )}
          </div>

          {/* AI Assist Panel — side panel on desktop, below toolbar on mobile */}
          {showAiAssist && (
            <div className={isMobileDevice ? "" : "w-80 shrink-0 border-l border-border-secondary overflow-y-auto"}>
              <AiAssistPanel
                editor={editor}
                isReplyMode={mode === "reply" || mode === "replyAll"}
              />
            </div>
          )}
        </div>

        {/* Attachments */}
        <div className={`border-t border-border-secondary ${isDragging ? "bg-accent/5" : ""}`}>
          <AttachmentPicker isDragging={isDragging} />
        </div>

        {/* Footer */}
        <ComposerFooter
          fromEmail={fromEmail}
          activeAccount={activeAccount}
          savedLabel={savedLabel}
          isSaving={isSaving}
          to={to}
          onDiscard={handleDiscard}
          onSend={handleSend}
          onSchedule={() => setShowSchedule(true)}
        />
      </div>

      {showSchedule && (
        <ScheduleSendDialog
          onSchedule={handleSchedule}
          onClose={() => setShowSchedule(false)}
        />
      )}

      {showPreSendChecklist && preSendData && (
        <PreSendChecklist
          subject={useComposerStore.getState().subject}
          bodyHtml={editor?.getHTML() ?? ""}
          bodyText={editor?.getText() ?? ""}
          recipients={[...useComposerStore.getState().to, ...useComposerStore.getState().cc, ...useComposerStore.getState().bcc]}
          senderEmail={preSendData.senderEmail}
          isBulk={preSendData.isBulk}
          onClose={handlePreSendClose}
          onProceed={handlePreSendProceed}
        />
      )}
    </div>
    </CSSTransition>
    </ZenMode>
  );
}
