import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { incrementTemplateUsage, type DbTemplate } from "@features/mail/db/templates";
import { TemplateGallery } from "@features/mail/components/templates/TemplateGallery";
import type { Editor } from "@tiptap/react";

interface TemplatePickerProps {
  editor: Editor | null;
  isOpen?: boolean;
  onClose?: () => void;
  onSelect?: (template: DbTemplate) => void;
}

export function TemplatePicker({ editor, isOpen: controlledOpen, onClose: controlledOnClose, onSelect: controlledOnSelect }: TemplatePickerProps) {
  const { t } = useTranslation();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const { mode, subject, setSubject } = useComposerStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleClose = useCallback(() => {
    if (isControlled) {
      controlledOnClose?.();
    } else {
      setInternalOpen(false);
    }
  }, [isControlled, controlledOnClose]);

  const handleSelect = useCallback(async (tmpl: DbTemplate) => {
    if (controlledOnSelect) {
      controlledOnSelect(tmpl);
      return;
    }

    if (!editor) return;

    if (mode === "new" && !subject && tmpl.subject) {
      setSubject(tmpl.subject);
    }

    editor.commands.insertContent(tmpl.body_html);
    // Sync to store so the textarea reflects the inserted content
    useComposerStore.getState().setBodyHtml(editor.getHTML());

    if (activeAccountId) {
      await incrementTemplateUsage(tmpl.id);
    }

    if (!isControlled) {
      setInternalOpen(false);
    }
  }, [editor, mode, subject, setSubject, activeAccountId, controlledOnSelect, isControlled]);

  return (
    <>
      {!isControlled && (
        <button
          onClick={() => setInternalOpen(true)}
          className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          title={t("composer.insertTemplate") + " (Ctrl+Shift+T)"}
        >
          <FileText size={12} />
          {t("composer.templates")}
        </button>
      )}

      <TemplateGallery
        mode="picker"
        isOpen={isOpen}
        onClose={handleClose}
        onSelect={handleSelect}
      />
    </>
  );
}

