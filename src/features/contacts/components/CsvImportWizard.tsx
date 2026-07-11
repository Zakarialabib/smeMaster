import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

const CSV_TEMPLATE = [
  "email,display_name",
  "alice@example.com,Alice Smith",
  "bob@example.net,Bob Jones",
  "carol@example.org,Carol Williams",
].join("\n");
import { Modal } from "@shared/components/ui/Modal";
import { Button } from "@shared/components/ui/Button";
import { Upload, FileText, Check, AlertCircle, Download } from "lucide-react";
import { upsertContact } from "@features/contacts/db/contacts.ts";
import { parseCsvContent, type CsvContact } from "@features/contacts/services/csvParser";

interface CsvImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}


type Step = "select" | "preview" | "importing" | "done";

export function CsvImportWizard({ isOpen, onClose }: CsvImportWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("select");
  const [contacts, setContacts] = useState<CsvContact[]>([]);
  const [importResult, setImportResult] = useState({ imported: 0, failed: 0 });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("select");
    setContacts([]);
    setImportResult({ imported: 0, failed: 0 });
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);


  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsvContent(text);
      setContacts(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleImport = useCallback(async () => {
    setStep("importing");
    let imported = 0;
    let failed = 0;
    for (const contact of contacts) {
      try {
        await upsertContact(contact.email, contact.display_name ?? null);
        imported++;
      } catch {
        failed++;
      }
    }
    setImportResult({ imported, failed });
    setStep("done");
  }, [contacts]);

  return (
    <Modal isOpen={isOpen}
      onClose={handleClose}
      title={t('modals.csvImport.title')}
      size="xl">
      <div className="p-4">
        {step === "select" && (
          <>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragOver
                ? "border-accent bg-accent/5"
                : "border-border-primary hover:border-accent/50"
              }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload size={24} className="mx-auto mb-2 text-text-tertiary" />
            <p className="text-sm text-text-secondary mb-1">
              {t('modals.csvImport.selectFile')}
            </p>
            <p className="text-xs text-text-tertiary">
              {t('modals.csvImport.csvFormat')}
            </p>
          </div>

          {/* Format example */}
          <div className="mt-4 px-3 py-2 rounded-lg bg-bg-secondary/50 border border-border-primary/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[0.625rem] font-semibold text-text-tertiary uppercase tracking-wider">
                Expected format
              </span>
              <button
                type="button"
                onClick={() => {
                  const csv = "email,display_name\nalice@example.com,Alice Smith\nbob@example.net,Bob Jones\ncarol@example.org,Carol Williams";
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "contact-import-template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
              >
                <Download size={12} />
                Download template
              </button>
            </div>
            <pre className="text-[10px] text-text-tertiary leading-relaxed font-mono whitespace-pre">{CSV_TEMPLATE}</pre>
          </div>
          </>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <FileText size={14} />
              <span>
                {t('modals.csvImport.contactsFound', { count: contacts.length })}
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto border border-border-primary rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-bg-tertiary">
                    <th className="text-left px-3 py-1.5 text-text-secondary font-medium">{t('modals.csvImport.email')}</th>
                    <th className="text-left px-3 py-1.5 text-text-secondary font-medium">{t('modals.csvImport.name')}</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.slice(0, 100).map((c, i) => (
                    <tr key={i} className="border-t border-border-primary">
                      <td className="px-3 py-1.5 text-text-primary">{c.email}</td>
                      <td className="px-3 py-1.5 text-text-secondary">{c.display_name || "-"}</td>
                    </tr>
                  ))}
                  {contacts.length > 100 && (
                    <tr className="border-t border-border-primary">
                      <td colSpan={2} className="px-3 py-1.5 text-text-tertiary text-center">
                        {t('modals.csvImport.andMore', { count: contacts.length - 100 })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={handleClose}>
                {t('modals.csvImport.cancel')}
              </Button>
              <Button variant="primary" onClick={handleImport}>
                {t('modals.csvImport.import', { count: contacts.length })}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mb-3" />
            <p className="text-sm text-text-secondary">{t('modals.csvImport.importing')}</p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-success" />
              <span className="text-sm text-text-primary">
                {t('modals.csvImport.importComplete')}
              </span>
            </div>
            <div className="text-xs text-text-secondary space-y-1">
              <p>
                {t('modals.csvImport.successfullyImported', { count: importResult.imported })}
              </p>
              {importResult.failed > 0 && (
                <p className="flex items-center gap-1 text-danger">
                  <AlertCircle size={12} />
                  {t('modals.csvImport.failed', { count: importResult.failed })}
                </p>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={handleClose}>
                {t('modals.csvImport.done')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

