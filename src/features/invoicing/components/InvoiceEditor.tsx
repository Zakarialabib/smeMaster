import { useState } from "react";
import {
  ArrowLeft, Save, Plus, Trash2,
  ReceiptText, Truck, Printer, Eye
} from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { CreateInvoiceRequest } from "../types";

export default function InvoiceEditor() {
  const [docType, setDocType] = useState<CreateInvoiceRequest['documentType']>('invoice');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${new Date().getFullYear()}-001`);
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: 0, tax_rate: 20 }]);

  const addItem = () => setItems([...items, { description: '', quantity: 1, unit_price: 0, tax_rate: 20 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  const taxTotal = items.reduce((acc, item) => acc + (item.quantity * item.unit_price * (item.tax_rate / 100)), 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-primary">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary bg-bg-secondary sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={18} />} onClick={() => window.history.back()} />
          <h1 className="text-xl font-bold text-text-primary">Create New {docType.replace('_', ' ')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Eye size={16} />}>Preview</Button>
          <Button icon={<Save size={16} />}>Save Document</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-8">
        {/* Document Type Selector */}
        <div className="grid grid-cols-3 gap-4">
          <DocTypeCard
            active={docType === 'invoice'}
            onClick={() => setDocType('invoice')}
            icon={<ReceiptText />}
            title="Invoice"
            desc="Commercial billing document"
          />
          <DocTypeCard
            active={docType === 'delivery_bill'}
            onClick={() => setDocType('delivery_bill')}
            icon={<Truck />}
            title="Delivery Bill"
            desc="Proof of delivery (Bon de Livraison)"
          />
          <DocTypeCard
            active={docType === 'shipping_print'}
            onClick={() => setDocType('shipping_print')}
            icon={<Printer />}
            title="Shipping Print"
            desc="Packaging and shipping slip"
          />
        </div>

        <div className="bg-bg-secondary rounded-2xl border border-border-primary p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-tertiary uppercase">Document Number</label>
              <input
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                className="w-full bg-bg-primary border border-border-primary rounded-lg px-4 py-2 text-text-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-tertiary uppercase">Issue Date</label>
              <input
                type="date"
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full bg-bg-primary border border-border-primary rounded-lg px-4 py-2 text-text-primary"
              />
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between border-b border-border-primary pb-2">
               <h3 className="font-bold text-text-primary">Line Items</h3>
               <Button variant="ghost" size="xs" icon={<Plus size={14} />} onClick={addItem}>Add Item</Button>
             </div>

             <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-text-tertiary text-xs uppercase">
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium w-24 text-center">Qty</th>
                    <th className="pb-2 font-medium w-32 text-right">Price (MAD)</th>
                    <th className="pb-2 font-medium w-24 text-center">Tax %</th>
                    <th className="pb-2 font-medium w-32 text-right">Total</th>
                    <th className="pb-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/50">
                  {items.map((item, idx) => (
                    <tr key={idx} className="group">
                      <td className="py-3 pr-4">
                        <input
                          placeholder="Item description..."
                          value={item.description}
                          onChange={e => updateItem(idx, 'description', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-text-primary"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                          className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1 text-center text-text-primary"
                        />
                      </td>
                      <td className="py-3 px-2 text-right">
                         <input
                          type="number"
                          value={item.unit_price}
                          onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value))}
                          className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1 text-right text-text-primary"
                        />
                      </td>
                      <td className="py-3 px-2">
                         <select
                          value={item.tax_rate}
                          onChange={e => updateItem(idx, 'tax_rate', parseFloat(e.target.value))}
                          className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1 text-center text-text-primary text-xs"
                         >
                            <option value="20">20%</option>
                            <option value="14">14%</option>
                            <option value="10">10%</option>
                            <option value="7">7%</option>
                            <option value="0">0%</option>
                         </select>
                      </td>
                      <td className="py-3 pl-4 text-right font-medium text-text-primary">
                        {(item.quantity * item.unit_price * (1 + item.tax_rate / 100)).toFixed(2)}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={<Trash2 size={14} />}
                          className="text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeItem(idx)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>

          <div className="flex justify-end pt-6 border-t border-border-primary">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-tertiary">Subtotal</span>
                <span className="text-text-primary font-medium">{subtotal.toFixed(2)} MAD</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-tertiary">Tax Total</span>
                <span className="text-text-primary font-medium">{taxTotal.toFixed(2)} MAD</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-border-primary pt-3">
                <span className="text-text-primary">Total</span>
                <span className="text-accent">{(subtotal + taxTotal).toFixed(2)} MAD</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocTypeCard({ active, onClick, icon, title, desc }: { active: boolean, onClick: () => void, icon: React.ReactNode, title: string, desc: string }) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-2xl border transition-all text-left flex items-start gap-4 ${
        active ? 'bg-accent/5 border-accent ring-1 ring-accent' : 'bg-bg-secondary border-border-primary hover:bg-bg-hover/50'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-tertiary'}`}>
        {icon}
      </div>
      <div>
        <h4 className={`font-bold text-sm ${active ? 'text-accent' : 'text-text-primary'}`}>{title}</h4>
        <p className="text-[10px] text-text-tertiary mt-0.5 uppercase tracking-wide font-medium">{desc}</p>
      </div>
    </button>
  );
}
