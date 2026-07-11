import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";
import { InputDialog } from "@shared/components/ui/InputDialog";
import { Sparkles, FileText, MessageSquarePlus, Type, Smile, Table, Plus, Minus, Columns3, Rows3, Trash2, ReceiptText } from "lucide-react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { getQuickReplies, incrementQuickReplyUsage, type DbQuickReply } from "@features/mail/db/quickReplies";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { EmojiPicker } from "./EmojiPicker";
import { InvoiceSelectionModal } from "../../../invoicing/components/InvoiceSelectionModal";
import { Invoice } from "../../../invoicing/types";
import { formatMoney, formatDate } from "../../../invoicing/utils/format";

interface EditorToolbarProps {
  editor: Editor | null;
  onToggleAiAssist?: () => void;
  aiAssistOpen?: boolean;
  onToggleTemplatePicker?: () => void;
}

export function EditorToolbar({ editor, onToggleAiAssist, aiAssistOpen, onToggleTemplatePicker }: EditorToolbarProps) {
  const { t } = useTranslation();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState<DbQuickReply[]>([]);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const qrMenuRef = useRef<HTMLDivElement | null>(null);
  const tableMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!quickReplyOpen || !activeAccountId) return;
    getQuickReplies(activeAccountId).then(setQuickReplies).catch(() => {});
  }, [quickReplyOpen, activeAccountId]);

  useEffect(() => {
    if (!quickReplyOpen) return;
    const handler = (e: MouseEvent) => {
      if (qrMenuRef.current && !qrMenuRef.current.contains(e.target as Node)) {
        setQuickReplyOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [quickReplyOpen]);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const handler = (_e: MouseEvent) => {
      setEmojiPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiPickerOpen]);

  useEffect(() => {
    if (!tableMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) {
        setTableMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tableMenuOpen]);

  const handleInsertQuickReply = useCallback(async (qr: DbQuickReply) => {
    if (!editor) return;
    editor.chain().focus().insertContent(qr.body_html).run();
    useComposerStore.getState().setBodyHtml(editor.getHTML());
    setQuickReplyOpen(false);
    await incrementQuickReplyUsage(qr.id).catch(() => {});
  }, [editor]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(emoji).run();
    useComposerStore.getState().setBodyHtml(editor.getHTML());
  }, [editor]);

  const handleInvoiceSelect = ({
    invoice,
    docs,
    clientName,
  }: {
    invoice: Invoice;
    docs: { pdf: string | null; xml: string | null };
    clientName: string;
  }) => {
    if (editor) {
      const issueDate = formatDate(invoice.issue_date, "medium");
      const dueDate = invoice.due_date ? formatDate(invoice.due_date, "medium") : "—";
      const total = formatMoney(invoice.total_amount, { currency: invoice.currency });
      // Escape user-controlled values so they can't break the inserted HTML.
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const docNote = docs.pdf
        ? `PDF and PEPPOL XML generated:<br/>&nbsp;&nbsp;• ${esc(docs.pdf)}<br/>&nbsp;&nbsp;• ${esc(docs.xml ?? "")}`
        : "PDF and PEPPOL XML could not be generated — open the invoice to create them.";
      editor
        .chain()
        .focus()
        .insertContent(`
        <div style="border:1px solid #d7e3f4; border-radius:14px; padding:16px; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; max-width:440px; background:#f7faff;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
            <span style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:8px; background:#0B57D0; color:#fff; font-size:14px;">&#128222;</span>
            <span style="font-size:13px; font-weight:700; color:#0B57D0; letter-spacing:.3px; text-transform:uppercase;">Invoice ${esc(invoice.invoice_number)}</span>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:13px; color:#1f2937;">
            <tr><td style="padding:3px 0; color:#6b7280;">Client</td><td style="padding:3px 0; text-align:right; font-weight:600; color:#111827;">${esc(clientName)}</td></tr>
            <tr><td style="padding:3px 0; color:#6b7280;">Issue date</td><td style="padding:3px 0; text-align:right; color:#111827;">${esc(issueDate)}</td></tr>
            <tr><td style="padding:3px 0; color:#6b7280;">Due date</td><td style="padding:3px 0; text-align:right; color:#111827;">${esc(dueDate)}</td></tr>
            <tr><td style="padding:6px 0 2px; color:#6b7280; border-top:1px solid #e5edf7;">Total</td><td style="padding:6px 0 2px; text-align:right; font-size:16px; font-weight:800; color:#0B57D0; border-top:1px solid #e5edf7;">${esc(total)}</td></tr>
          </table>
          <p style="margin:10px 0 0; font-size:11px; line-height:1.5; color:#6b7280;">${docNote}</p>
          <p style="margin:12px 0 0;"><a href="#/invoicing/edit/${esc(invoice.id)}" style="display:inline-block; background:#0B57D0; color:#fff; text-decoration:none; font-size:12px; font-weight:600; padding:8px 14px; border-radius:8px;">View invoice</a></p>
        </div>
        <p>&nbsp;</p>
      `)
        .run();
      useComposerStore.getState().setBodyHtml(editor.getHTML());
    }
    setInvoiceModalOpen(false);
  };

  if (!editor) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      editor.chain().focus().setImage({ src: dataUrl }).run();
    };
    reader.readAsDataURL(file);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const btn = (
    label: string,
    isActive: boolean,
    onClick: () => void,
    title?: string,
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className={`px-1.5 py-1 text-xs rounded hover:bg-bg-hover transition-colors ${
        isActive ? "bg-bg-hover text-accent font-semibold" : "text-text-secondary"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="composer-toolbar flex items-center gap-0.5 px-3 py-1.5 border-b border-border-secondary bg-bg-secondary flex-wrap">
      {btn("B", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Bold (Ctrl+B)")}
      {btn("I", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Italic (Ctrl+I)")}
      {btn("U", editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "Underline (Ctrl+U)")}
      {btn("S̶", editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "Strikethrough")}

      <div className="w-px h-4 bg-border-primary mx-1" />

      {btn("H1", editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
      {btn("H2", editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      {btn("H3", editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run())}

      <div className="w-px h-4 bg-border-primary mx-1" />

      {btn(t("composer.bulletList"), editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run())}
      {btn(t("composer.orderedList"), editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run())}
      {btn(t("composer.quote"), editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run())}
      {btn(t("composer.code"), editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run())}

      <div className="w-px h-4 bg-border-primary mx-1" />

      {btn(t("composer.rule"), false, () => editor.chain().focus().setHorizontalRule().run())}
      {btn(t("composer.link"), editor.isActive("link"), () => {
        if (editor.isActive("link")) {
          editor.chain().focus().unsetLink().run();
        } else {
          setShowLinkDialog(true);
        }
      })}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      {btn(t("common.image"), false, () => imageInputRef.current?.click(), t("composer.insertImage"))}

      <div className="w-px h-4 bg-border-primary mx-1" />

      <div className="relative">
        <button
          type="button"
          onClick={() => setTableMenuOpen(!tableMenuOpen)}
          title="Table"
          className={`p-1 rounded hover:bg-bg-hover transition-colors ${
            editor.isActive("table") ? "bg-bg-hover text-accent" : "text-text-secondary"
          }`}
        >
          <Table size={14} />
        </button>
        {tableMenuOpen && (
          <div
            ref={tableMenuRef}
            className="absolute left-0 top-full mt-1 w-48 bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-50 py-1"
          >
            {!editor.isActive("table") ? (
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                  setTableMenuOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover text-left transition-colors"
              >
                <Plus size={12} className="shrink-0" />
                Insert Table (3x3)
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().addColumnBefore().run();
                    setTableMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover text-left transition-colors"
                >
                  <Columns3 size={12} className="shrink-0" />
                  Add Column Before
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().addColumnAfter().run();
                    setTableMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover text-left transition-colors"
                >
                  <Columns3 size={12} className="shrink-0" />
                  Add Column After
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().deleteColumn().run();
                    setTableMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover text-left transition-colors"
                >
                  <Minus size={12} className="shrink-0" />
                  Delete Column
                </button>
                <div className="h-px bg-border-primary my-1" />
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().addRowBefore().run();
                    setTableMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover text-left transition-colors"
                >
                  <Rows3 size={12} className="shrink-0" />
                  Add Row Before
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().addRowAfter().run();
                    setTableMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover text-left transition-colors"
                >
                  <Rows3 size={12} className="shrink-0 rotate-180" />
                  Add Row After
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().deleteRow().run();
                    setTableMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover text-left transition-colors"
                >
                  <Minus size={12} className="shrink-0" />
                  Delete Row
                </button>
                <div className="h-px bg-border-primary my-1" />
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().deleteTable().run();
                    setTableMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover text-left transition-colors"
                >
                  <Trash2 size={12} className="shrink-0" />
                  Delete Table
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Emoji */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
          title="Insert Emoji"
          className="p-1 rounded hover:bg-bg-hover transition-colors text-text-secondary"
        >
          <Smile size={14} />
        </button>
        {emojiPickerOpen && (
          <EmojiPicker
            onSelect={handleEmojiSelect}
            onClose={() => setEmojiPickerOpen(false)}
          />
        )}
      </div>

      <div className="flex-1" />

      {onToggleTemplatePicker && (
        <button
          type="button"
          onClick={onToggleTemplatePicker}
          title="Templates (Ctrl+Shift+T)"
          className="px-1.5 py-1 text-xs rounded hover:bg-bg-hover transition-colors flex items-center gap-1 text-text-secondary"
        >
          <FileText size={12} />
          {t("composer.templates")}
        </button>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setQuickReplyOpen(!quickReplyOpen)}
          title="Quick Replies"
          className={`px-1.5 py-1 text-xs rounded hover:bg-bg-hover transition-colors flex items-center gap-1 ${
            quickReplyOpen ? "bg-accent/10 text-accent" : "text-text-secondary"
          }`}
        >
          <MessageSquarePlus size={12} />
          {t("quickReply.title")}
        </button>

        {quickReplyOpen && (
          <div
            ref={qrMenuRef}
            className="absolute right-0 top-full mt-1 w-56 bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto"
          >
            {quickReplies.length === 0 ? (
              <p className="px-3 py-2 text-xs text-text-tertiary">{t("quickReply.noReplies")}</p>
            ) : (
              quickReplies.map((qr) => (
                <button
                  key={qr.id}
                  onClick={() => handleInsertQuickReply(qr)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover text-left transition-colors"
                >
                  <MessageSquarePlus size={12} className="text-accent shrink-0" />
                  <span className="flex-1 truncate">{qr.title}</span>
                  {qr.shortcut && (
                    <kbd className="text-[0.625rem] bg-bg-tertiary px-1 py-0.5 rounded border border-border-primary font-mono text-text-tertiary shrink-0">
                      {qr.shortcut}
                    </kbd>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {onToggleAiAssist && (
        <button
          type="button"
          onClick={onToggleAiAssist}
          title="AI Assist"
          className={`px-1.5 py-1 text-xs rounded hover:bg-bg-hover transition-colors flex items-center gap-1 ${
            aiAssistOpen ? "bg-accent/10 text-accent font-semibold" : "text-text-secondary"
          }`}
        >
          <Sparkles size={12} />
          AI
        </button>
      )}

      <button
        type="button"
        onClick={() => setInvoiceModalOpen(true)}
        title="Insert Invoice"
        className="px-1.5 py-1 text-xs rounded hover:bg-bg-hover transition-colors flex items-center gap-1 text-text-secondary"
      >
        <ReceiptText size={12} />
        Invoice
      </button>

      {invoiceModalOpen && (
        <InvoiceSelectionModal
          onClose={() => setInvoiceModalOpen(false)}
          onSelect={handleInvoiceSelect}
          onQuickCreate={() => {
            setInvoiceModalOpen(false);
            // In a real app we'd navigate to the invoice editor
          }}
        />
      )}

      {btn(t("composer.undo"), false, () => editor.chain().focus().undo().run())}
      {btn(t("composer.redo"), false, () => editor.chain().focus().redo().run())}
      {/* Format preview bar */}
      <FormatPreviewBar editor={editor} />

      <InputDialog
        isOpen={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        onSubmit={(values) => {
          if (values.url) {
            editor.chain().focus().setLink({ href: values.url }).run();
          }
        }}
        title={t("composer.insertLink")}
        fields={[{ key: "url", label: t("campaign.url"), placeholder: "https://..." }]}
        submitLabel={t("common.insert")}
      />
    </div>
  );
}

function FormatPreviewBar({ editor }: { editor: Editor }) {
  const formats: { label: string; active: boolean }[] = [
    { label: "B", active: editor.isActive("bold") },
    { label: "I", active: editor.isActive("italic") },
    { label: "U", active: editor.isActive("underline") },
    { label: "S", active: editor.isActive("strike") },
  ];

  let headingLabel = "";
  if (editor.isActive("heading", { level: 1 })) headingLabel = "H1";
  else if (editor.isActive("heading", { level: 2 })) headingLabel = "H2";
  else if (editor.isActive("heading", { level: 3 })) headingLabel = "H3";

  let listLabel = "";
  if (editor.isActive("bulletList")) listLabel = "UL";
  else if (editor.isActive("orderedList")) listLabel = "OL";

  const anyFormat = formats.some((f) => f.active) || headingLabel || listLabel || editor.isActive("blockquote") || editor.isActive("codeBlock") || editor.isActive("link");

  if (!anyFormat) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-1 border-b border-border-secondary bg-bg-tertiary/30">
      <Type size={10} className="text-text-tertiary" />
      {formats.map((f) => (
        <span
          key={f.label}
          className={`text-[0.625rem] px-1 rounded ${
            f.active ? "text-accent font-semibold bg-accent/10" : "text-text-tertiary"
          }`}
        >
          {f.label}
        </span>
      ))}
      {headingLabel && (
        <span className="text-[0.625rem] text-accent font-semibold bg-accent/10 px-1 rounded">
          {headingLabel}
        </span>
      )}
      {listLabel && (
        <span className="text-[0.625rem] text-accent font-semibold bg-accent/10 px-1 rounded">
          {listLabel}
        </span>
      )}
      {editor.isActive("blockquote") && (
        <span className="text-[0.625rem] text-accent font-semibold bg-accent/10 px-1 rounded">
          Quote
        </span>
      )}
      {editor.isActive("codeBlock") && (
        <span className="text-[0.625rem] text-accent font-semibold bg-accent/10 px-1 rounded">
          Code
        </span>
      )}
      {editor.isActive("link") && (
        <span className="text-[0.625rem] text-accent font-semibold bg-accent/10 px-1 rounded">
          Link
        </span>
      )}
    </div>
  );
}

