import { FileText, Download, X, FileCode } from "lucide-react";
import { Button } from "@shared/components/ui/Button";

interface DocumentPreviewProps {
  type: 'pdf' | 'xml';
  path: string;
  onClose: () => void;
}

export function DocumentPreview({ type, path, onClose }: DocumentPreviewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-8">
      <div className="bg-bg-primary rounded-2xl shadow-2xl w-full max-w-4xl h-full flex flex-col overflow-hidden border border-border-primary">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary bg-bg-secondary">
          <div className="flex items-center gap-3">
            {type === 'pdf' ? <FileText className="text-accent" /> : <FileCode className="text-warning" />}
            <div>
              <h3 className="font-bold text-text-primary">Document Preview</h3>
              <p className="text-xs text-text-tertiary truncate max-w-md">{path}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Download size={14} />}>Download</Button>
            <Button variant="ghost" size="sm" icon={<X size={18} />} onClick={onClose} />
          </div>
        </div>

        <div className="flex-1 bg-bg-tertiary flex items-center justify-center overflow-auto p-8">
          {type === 'pdf' ? (
            <div className="bg-white shadow-lg w-full max-w-[210mm] aspect-[1/1.41] flex flex-col items-center justify-center text-slate-400">
               <FileText size={64} className="mb-4 opacity-20" />
               <p className="font-medium text-slate-500 text-lg">Visual PDF Preview</p>
               <p className="text-sm opacity-60">In a live environment, the PDF would render here.</p>
            </div>
          ) : (
            <pre className="bg-bg-secondary p-6 rounded-xl border border-border-primary text-xs font-mono text-text-secondary w-full max-w-3xl overflow-auto max-h-full">
              {`<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>INV-2025-001</cbc:ID>
  <cbc:IssueDate>2025-01-01</cbc:IssueDate>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>My Company</cbc:Name></cac:PartyName>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>My Company SARL</cbc:RegistrationName>
        <cbc:CompanyID schemeID="ICE">001234567890123</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <!-- ... truncated ... -->
</Invoice>`}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
