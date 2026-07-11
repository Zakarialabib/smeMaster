import { useEffect } from "react";
import { ReceiptText, Plus, Check, FileText } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { useInvoicingStore } from "../stores/invoicingStore";
import { Invoice } from "../types";

interface InvoiceSelectionModalProps {
  onSelect: (invoice: Invoice) => void;
  onQuickCreate: () => void;
  onClose: () => void;
}

export function InvoiceSelectionModal({ onSelect, onQuickCreate, onClose }: InvoiceSelectionModalProps) {
  const { invoices, fetchInvoices, isLoading } = useInvoicingStore();
  const unpaidInvoices = invoices.filter((i: Invoice) => i.status !== 'paid');

  useEffect(() => {
    fetchInvoices("demo-company-1");
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-bg-primary rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border-primary flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-border-primary bg-bg-secondary flex items-center justify-between">
          <h3 className="font-bold text-text-primary flex items-center gap-2">
            <ReceiptText size={18} className="text-accent" />
            Attach Invoice
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
           <button
             onClick={onQuickCreate}
             className="w-full p-4 rounded-xl border-2 border-dashed border-border-primary hover:border-accent hover:bg-accent/5 transition-all text-left flex items-center gap-4 group"
           >
              <div className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
                <Plus size={20} />
              </div>
              <div>
                <p className="font-bold text-text-primary">Quick Create</p>
                <p className="text-xs text-text-tertiary">Create a new invoice from scratch</p>
              </div>
           </button>

           <div className="pt-4 pb-2">
             <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider px-2">Unpaid Invoices</p>
           </div>

           {isLoading ? (
             <div className="py-8 text-center text-text-tertiary text-sm italic">Loading...</div>
           ) : unpaidInvoices.length === 0 ? (
             <div className="py-8 text-center text-text-tertiary text-sm italic">No unpaid invoices found</div>
           ) : (
             unpaidInvoices.map((inv: Invoice) => (
               <button
                 key={inv.id}
                 onClick={() => onSelect(inv)}
                 className="w-full p-3 rounded-xl border border-border-primary hover:bg-bg-hover transition-colors text-left flex items-center justify-between group"
               >
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-tertiary">
                     <FileText size={16} />
                   </div>
                   <div>
                     <p className="text-sm font-semibold text-text-primary">{inv.invoice_number}</p>
                     <p className="text-[10px] text-text-tertiary">{inv.total_amount.toLocaleString(undefined, { style: 'currency', currency: inv.currency })}</p>
                   </div>
                 </div>
                 <Check size={16} className="text-accent opacity-0 group-hover:opacity-100" />
               </button>
             ))
           )}
        </div>
      </div>
    </div>
  );
}
