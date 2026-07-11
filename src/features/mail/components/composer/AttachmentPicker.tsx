import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, X } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { useComposerStore, type ComposerAttachment } from "@features/mail/stores/composerStore";
import { readFileAsBase64 } from "@shared/utils/fileUtils";
import { formatFileSize } from "@shared/utils/fileTypeHelpers";
import { getSetting } from "@features/settings";

const DEFAULT_MAX_TOTAL_MB = 24;
const DEFAULT_MAX_PER_FILE_MB = 25;

interface AttachmentPickerProps {
  isDragging?: boolean;
}

export function AttachmentPicker({ isDragging }: AttachmentPickerProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const attachments = useComposerStore((s) => s.attachments);
  const addAttachment = useComposerStore((s) => s.addAttachment);
  const removeAttachment = useComposerStore((s) => s.removeAttachment);

  // Load size limits from settings
  const [maxTotalMb, setMaxTotalMb] = useState(DEFAULT_MAX_TOTAL_MB);
  const [maxPerFileMb, setMaxPerFileMb] = useState(DEFAULT_MAX_PER_FILE_MB);

  useEffect(() => {
    async function loadLimits() {
      try {
        const totalSetting = await getSetting("max_attachment_size_mb");
        if (totalSetting) setMaxTotalMb(parseInt(totalSetting, 10));

        const perFileSetting = await getSetting("max_attachment_per_file_mb");
        if (perFileSetting) setMaxPerFileMb(parseInt(perFileSetting, 10));
      } catch {
        // use defaults
      }
    }
    loadLimits();
  }, []);

  const maxTotal = maxTotalMb * 1024 * 1024;
  const maxPerFile = maxPerFileMb * 1024 * 1024;
  const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      // Per-file size check
      if (file.size > maxPerFile) {
        console.warn(`Per-file size limit exceeded (${maxPerFileMb}MB): ${file.name}`);
        continue;
      }
      // Total size check
      if (totalSize + file.size > maxTotal) {
        console.warn(`Total attachment size limit exceeded (${maxTotalMb}MB)`);
        break;
      }
      const content = await readFileAsBase64(file);
      const attachment: ComposerAttachment = {
        id: crypto.randomUUID(),
        file,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        content,
      };
      addAttachment(attachment);
    }
    // Reset input so re-selecting the same file works
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="px-5 py-1">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
        }}
      />

      <div className={`flex items-center gap-2 flex-wrap rounded-md transition-colors ${isDragging ? "bg-accent/10 border border-dashed border-accent px-2" : ""}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => inputRef.current?.click()}
          title={t("composer.attachFiles") + " (drag & drop files here)"}
        >
          <Paperclip size={14} />
          <span>{t("composer.attach")}</span>
        </Button>

        {attachments.map((att) => (
          <div
            key={att.id}
            className="flex items-center gap-1.5 bg-bg-secondary border border-border-secondary rounded-md px-2 py-1 text-xs"
          >
            <span className="text-text-primary truncate max-w-[150px]">
              {att.filename}
            </span>
            <span className="text-text-tertiary shrink-0">
              {formatFileSize(att.size)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => removeAttachment(att.id)}
              className="text-text-tertiary hover:text-text-primary"
            >
              <X size={12} />
            </Button>
          </div>
        ))}

        {attachments.length > 0 && (
          <span className="text-xs text-text-tertiary">
            {formatFileSize(totalSize)} total
          </span>
        )}

        {isDragging && attachments.length === 0 && (
          <span className="text-xs text-accent font-medium ml-1">
            {t("composer.dropFilesToAttach")}
          </span>
        )}
      </div>
    </div>
  );
}
