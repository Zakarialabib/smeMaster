import { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Trash2, Pencil, ChevronDown, Eye, Edit3, Copy, Check } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { EditorToolbar } from "@features/mail/components/composer/EditorToolbar";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import {
  getTemplatesForAccount,
  insertTemplate,
  updateTemplate,
  deleteTemplate,
  type DbTemplate,
} from "@features/mail/db/templates";
import { TEMPLATE_VARIABLES } from "@shared/utils/templateVariables";

export function TemplateEditor() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [copied, setCopied] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      Image.configure({ inline: true, allowBase64: true }),
      Placeholder.configure({ placeholder: "Write your template..." }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none px-3 py-2 min-h-[80px] focus:outline-none text-text-primary text-xs",
      },
    },
  });

  const loadTemplates = useCallback(async () => {
    if (!activeAccountId) return;
    const tmpls = await getTemplatesForAccount(activeAccountId);
    setTemplates(tmpls);
  }, [activeAccountId]);

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadTemplates is stable, only re-run on activeAccountId change
  }, [activeAccountId]);

  const resetForm = useCallback(() => {
    setName("");
    setSubject("");
    setShortcut("");
    setEditingId(null);
    setShowForm(false);
    setPreviewMode(false);
    setCopied(false);
    editor?.commands.setContent("");
  }, [editor]);

  const handleSave = useCallback(async () => {
    if (!activeAccountId || !editor || !name.trim()) return;

    const bodyHtml = editor.getHTML();

    if (editingId) {
      await updateTemplate(editingId, {
        name: name.trim(),
        subject: subject.trim() || null,
        bodyHtml,
        shortcut: shortcut.trim() || null,
      });
    } else {
      await insertTemplate({
        accountId: activeAccountId,
        name: name.trim(),
        subject: subject.trim() || null,
        bodyHtml,
        shortcut: shortcut.trim() || null,
      });
    }

    resetForm();
    await loadTemplates();
  }, [activeAccountId, editor, name, subject, shortcut, editingId, resetForm, loadTemplates]);

  const handleEdit = useCallback((tmpl: DbTemplate) => {
    setEditingId(tmpl.id);
    setName(tmpl.name);
    setSubject(tmpl.subject ?? "");
    setShortcut(tmpl.shortcut ?? "");
    setShowForm(true);
    setPreviewMode(false);
    setCopied(false);
    editor?.commands.setContent(tmpl.body_html);
  }, [editor]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteTemplate(id);
    if (editingId === id) resetForm();
    await loadTemplates();
  }, [editingId, resetForm, loadTemplates]);

  const handleCopyHtml = useCallback(async () => {
    const html = editor?.getHTML() ?? "";
    const { copyToClipboard } = await import("@shared/hooks/useClipboard");
    await copyToClipboard(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editor]);

  const templateHtml = editor?.getHTML() ?? "";

  return (
    <div className="space-y-3">
      {templates.map((tmpl) => (
        <div
          key={tmpl.id}
          className="flex items-center justify-between py-2 px-3 bg-bg-secondary rounded-md"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-primary flex items-center gap-2">
              {tmpl.name}
              {tmpl.shortcut && (
                <kbd className="text-[0.625rem] bg-bg-tertiary text-text-tertiary px-1.5 py-0.5 rounded">
                  {tmpl.shortcut}
                </kbd>
              )}
            </div>
            {tmpl.subject && (
              <div className="text-xs text-text-tertiary truncate">{tmpl.subject}</div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<Pencil size={13} />}
              onClick={() => handleEdit(tmpl)}
              aria-label="Edit template"
            />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<Trash2 size={13} />}
              onClick={() => handleDelete(tmpl.id)}
              className="hover:text-danger"
              aria-label="Delete template"
            />
          </div>
        </div>
      ))}

      {showForm ? (
        <div className="border border-border-primary rounded-md p-3 space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent"
          />
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent"
          />
          <div className="border border-border-primary rounded overflow-hidden bg-bg-tertiary">
            <div className="flex items-center justify-between">
              {previewMode ? (
                <span className="px-2 py-1 text-xs text-text-secondary">Preview</span>
              ) : (
                <EditorToolbar editor={editor} />
              )}
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={previewMode ? <Edit3 size={14} /> : <Eye size={14} />}
                onClick={() => setPreviewMode(!previewMode)}
                className={previewMode ? "text-accent bg-accent/10" : "text-text-tertiary hover:text-text-primary"}
                title={previewMode ? "Edit template" : "Preview template"}
                aria-label={previewMode ? "Edit template" : "Preview template"}
              />
            </div>
            {previewMode ? (
              <div className="space-y-2 p-2">
                <iframe
                  srcDoc={templateHtml}
                  sandbox="allow-same-origin"
                  className="w-full border-0 rounded bg-bg-primary"
                  style={{ height: 400 }}
                  title="Template preview"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={copied ? <Check size={12} /> : <Copy size={12} />}
                  onClick={handleCopyHtml}
                >
                  {copied ? "Copied!" : `Use "${name || "Untitled"}" template � copy HTML`}
                </Button>
              </div>
            ) : (
              <EditorContent editor={editor} />
            )}
          </div>
          <InsertVariableDropdown
            onInsert={(variable) => {
              editor?.chain().focus().insertContent(variable).run();
            }}
          />
          <input
            type="text"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
            placeholder="Shortcut (optional, e.g. /thanks)"
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              {editingId ? "Update" : "Save"}
            </Button>
            <Button
              variant="secondary"
              onClick={resetForm}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowForm(true)}
        >
          + Add template
        </Button>
      )}
    </div>
  );
}

function InsertVariableDropdown({ onInsert }: { onInsert: (variable: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        icon={<ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />}
        className="text-accent hover:text-accent-hover"
      >
        Insert variable
      </Button>
      {open && (
        <div className="absolute start-0 top-full mt-1 z-10 bg-bg-primary border border-border-primary rounded-md shadow-lg py-1 min-w-[220px]">
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => {
                onInsert(v.key);
                setOpen(false);
              }}
              className="w-full text-start px-3 py-1.5 hover:bg-bg-hover text-xs flex items-center justify-between gap-3"
            >
              <code className="text-accent">{v.key}</code>
              <span className="text-text-tertiary">{v.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

