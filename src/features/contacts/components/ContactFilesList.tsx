import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownSquare, ChevronRightSquare } from "lucide-react";
import { formatFileSize } from "@shared/utils/fileTypeHelpers";
import type { ContactFile } from "@features/contacts/db/contactFiles";

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ContactFilesListProps {
  files: ContactFile[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_FOLDERS = ["Invoices", "Contracts", "Receipts", "General"];

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Shared vault files list grouped by category folders.
 *
 * Extracted from `ContactSidebar.VaultFilesSection` for reuse in
 * both the mail sidebar and the contacts detail page.
 */
export function ContactFilesList({ files }: ContactFilesListProps) {
  const { t } = useTranslation();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const getCategoryCount = (cat: string): number => {
    const catLower = cat.toLowerCase();
    return files.filter((f) => f.category === catLower || f.category === cat).length;
  };

  const getFilesForCategory = (cat: string) => {
    const catLower = cat.toLowerCase();
    return files.filter((f) => f.category === catLower || f.category === cat);
  };

  if (files.length === 0) {
    return (
      <div className="text-xs text-text-tertiary text-center py-6">
        {t('contact.noVaultFiles')}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {CATEGORY_FOLDERS.map((cat) => {
        const count = getCategoryCount(cat);
        if (count === 0) return null;
        const isExpanded = expandedCategories[cat] ?? false;
        const categoryFiles = getFilesForCategory(cat);
        return (
          <div key={cat}>
            <button
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded hover:bg-bg-hover transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDownSquare size={12} /> : <ChevronRightSquare size={12} />}
                <span className="text-text-primary">{cat}</span>
              </div>
              <span className="text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full text-[0.625rem]">
                {count}
              </span>
            </button>
            {isExpanded && (
              <div className="ml-4 space-y-0.5">
                {categoryFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-bg-hover transition-colors"
                  >
                    <span className="text-text-tertiary truncate flex-1">{file.original_name}</span>
                    {file.size != null && (
                      <span className="text-text-tertiary text-[0.625rem] shrink-0">
                        {formatFileSize(file.size)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
