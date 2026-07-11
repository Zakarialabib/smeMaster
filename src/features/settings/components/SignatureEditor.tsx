import { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Trash2, Pencil, Code } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { TextField } from "@shared/components/ui/TextField";
import { EditorToolbar } from "@features/mail/components/composer/EditorToolbar";
import { notify } from "@shared/services/notifications/toastHelper";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import {
  getSignaturesForAccount,
  insertSignature,
  updateSignature,
  deleteSignature,
  type DbSignature,
} from "@features/mail/db/signatures";

export function SignatureEditor() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [signatures, setSignatures] = useState<DbSignature[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [rawHtml, setRawHtml] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      Image.configure({ inline: true, allowBase64: true }),
      Placeholder.configure({ placeholder: "Write your signature..." }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none px-3 py-2 min-h-[80px] focus:outline-none text-text-primary text-xs",
      },
    },
  });

  const loadSignatures = useCallback(async () => {
    if (!activeAccountId) return;
    const sigs = await getSignaturesForAccount(activeAccountId);
    setSignatures(sigs);
  }, [activeAccountId]);

  useEffect(() => {
    loadSignatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadSignatures is stable, only re-run on activeAccountId change
  }, [activeAccountId]);

  const resetForm = useCallback(() => {
    setName("");
    setIsDefault(false);
    setEditingId(null);
    setShowForm(false);
    setIsHtmlMode(false);
    setRawHtml("");
    editor?.commands.setContent("");
  }, [editor]);

  const toggleHtmlMode = useCallback(() => {
    if (!editor) return;
    if (isHtmlMode) {
      // HTML → WYSIWYG: push rawHtml into editor
      editor.commands.setContent(rawHtml);
    } else {
      // WYSIWYG → HTML: capture editor content
      setRawHtml(editor.getHTML());
    }
    setIsHtmlMode(!isHtmlMode);
  }, [editor, isHtmlMode, rawHtml]);

  const handleSave = useCallback(async () => {
    if (!activeAccountId || !editor || !name.trim()) return;

    const bodyHtml = isHtmlMode ? rawHtml : editor.getHTML();

    if (editingId) {
      await updateSignature(editingId, { name: name.trim(), bodyHtml, isDefault });
    } else {
      await insertSignature({
        accountId: activeAccountId,
        name: name.trim(),
        bodyHtml,
        isDefault,
      });
    }

    resetForm();
    await loadSignatures();
    notify("Signature", editingId ? "Signature updated." : "Signature saved.");
  }, [activeAccountId, editor, name, isDefault, editingId, isHtmlMode, rawHtml, resetForm, loadSignatures]);

  const handleEdit = useCallback((sig: DbSignature) => {
    setEditingId(sig.id);
    setName(sig.name);
    setIsDefault(sig.is_default === 1);
    setShowForm(true);
    editor?.commands.setContent(sig.body_html);
  }, [editor]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSignature(id);
    if (editingId === id) resetForm();
    await loadSignatures();
    notify("Signature", "Signature deleted.");
  }, [editingId, resetForm, loadSignatures]);

  return (
    <div className="space-y-3">
      {signatures.map((sig) => (
        <div
          key={sig.id}
          className="flex items-center justify-between py-2 px-3 bg-bg-secondary rounded-md"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-primary flex items-center gap-2">
              {sig.name}
              {sig.is_default === 1 && (
                <span className="text-[0.625rem] bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                  Default
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<Pencil size={13} />}
              onClick={() => handleEdit(sig)}
              aria-label="Edit signature"
            />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<Trash2 size={13} />}
              onClick={() => handleDelete(sig.id)}
              className="hover:text-danger"
              aria-label="Delete signature"
            />
          </div>
        </div>
      ))}

      {showForm ? (
        <div className="border border-border-primary rounded-md p-3 space-y-2">
          <TextField
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Signature name"
          />
          <div className="border border-border-primary rounded overflow-hidden bg-bg-tertiary flex flex-col">
            <div className="flex items-center justify-between">
              {isHtmlMode ? (
                <span className="px-2 py-1 text-xs text-text-secondary">HTML source</span>
              ) : (
                <EditorToolbar editor={editor} />
              )}
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={<Code size={14} />}
                onClick={toggleHtmlMode}
                className={isHtmlMode ? "text-accent bg-accent/10" : "text-text-tertiary hover:text-text-primary"}
                title={isHtmlMode ? "Switch to visual editor" : "Edit HTML source"}
                aria-label={isHtmlMode ? "Switch to visual editor" : "Edit HTML source"}
              />
            </div>
            <div className="flex flex-col lg:flex-row">
              <div className="w-full lg:w-1/2 border-r border-border-primary">
                {isHtmlMode ? (
                  <textarea
                    value={rawHtml}
                    onChange={(e) => setRawHtml(e.target.value)}
                    className="w-full px-3 py-2 min-h-[80px] bg-bg-tertiary text-text-primary text-xs font-mono focus:outline-none resize-y lg:min-h-[200px]"
                    spellCheck={false}
                  />
                ) : (
                  <EditorContent editor={editor} />
                )}
              </div>
              <div className="w-full lg:w-1/2 bg-bg-primary">
                <iframe
                  srcDoc={isHtmlMode ? rawHtml : editor?.getHTML() ?? ""}
                  sandbox="allow-same-origin"
                  className="w-full border-0"
                  style={{ height: 200 }}
                  title="Signature preview"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded"
              />
              Set as default
            </label>
          </div>
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
          + Add signature
        </Button>
      )}
    </div>
  );
}

