import { Plus, Trash2, Package, ChevronDown } from 'lucide-react';
import { Item } from '../types';
import { TAX_RATES } from '../utils/status';
import { formatMoney } from '../utils/format';

export interface EditorLineItem {
  id?: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
}

interface Props {
  items: EditorLineItem[];
  onChange: (next: EditorLineItem[]) => void;
  catalog: Item[];
  currency: string;
}

export default function LineItemsEditor({ items, onChange, catalog, currency }: Props) {
  const update = (idx: number, patch: Partial<EditorLineItem>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () =>
    onChange([...items, { description: '', qty: 1, unit: 'pcs', unitPrice: 0, taxRate: 20 }]);

  const addFromCatalog = (it: Item) =>
    onChange([
      ...items,
      {
        description: it.name,
        qty: 1,
        unit: it.unit || 'pcs',
        unitPrice: it.sell_price,
        taxRate: it.tax_rate,
      },
    ]);

  return (
    <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 overflow-hidden backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-primary">
        <h3 className="font-bold text-text-primary flex items-center gap-2">
          <Package size={16} className="text-accent" />
          Line Items
        </h3>
        <div className="flex items-center gap-2">
          {catalog.length > 0 && (
            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-accent transition-colors px-2.5 py-1.5 rounded-lg hover:bg-accent/5"
              >
                <Package size={14} /> From catalog <ChevronDown size={12} />
              </button>
              <div className="absolute right-0 z-30 mt-1 w-64 max-h-72 overflow-auto rounded-xl border border-border-primary bg-bg-elevated backdrop-blur-2xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity p-1.5">
                {catalog.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => addFromCatalog(it)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-bg-hover/60 flex items-center justify-between gap-2"
                  >
                    <span className="text-sm text-text-primary truncate">{it.name}</span>
                    <span className="text-[11px] text-text-tertiary shrink-0">{formatMoney(it.sell_price, { currency })}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:bg-accent/5 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} /> Add line
          </button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-tertiary text-[11px] uppercase tracking-wide">
              <th className="px-5 py-2.5 font-semibold text-left">Description</th>
              <th className="px-3 py-2.5 font-semibold w-20 text-center">Qty</th>
              <th className="px-3 py-2.5 font-semibold w-24 text-left">Unit</th>
              <th className="px-3 py-2.5 font-semibold w-32 text-right">Unit Price</th>
              <th className="px-3 py-2.5 font-semibold w-24 text-center">Tax</th>
              <th className="px-3 py-2.5 font-semibold w-32 text-right">Amount</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-primary/50">
            {items.map((it, idx) => {
              const lineTotal = it.qty * it.unitPrice * (1 + it.taxRate / 100);
              return (
                <tr key={idx} className="group">
                  <td className="px-5 py-2.5">
                    <input
                      value={it.description}
                      onChange={(e) => update(idx, { description: e.target.value })}
                      placeholder="Item or service description..."
                      className="w-full bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary py-1.5"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={0}
                      value={it.qty}
                      onChange={(e) => update(idx, { qty: Math.max(0, Number(e.target.value)) })}
                      className="w-full glass-input rounded-lg px-2 py-1.5 text-center text-text-primary"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      value={it.unit}
                      onChange={(e) => update(idx, { unit: e.target.value })}
                      className="w-full glass-input rounded-lg px-2 py-1.5 text-text-primary text-xs"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.unitPrice}
                      onChange={(e) => update(idx, { unitPrice: Math.max(0, Number(e.target.value)) })}
                      className="w-full glass-input rounded-lg px-2 py-1.5 text-right text-text-primary tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={it.taxRate}
                      onChange={(e) => update(idx, { taxRate: Number(e.target.value) })}
                      className="w-full glass-input rounded-lg px-2 py-1.5 text-center text-text-primary text-xs"
                    >
                      {TAX_RATES.map((r) => (
                        <option key={r} value={r}>{r}%</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-text-primary tabular-nums">
                    {formatMoney(lineTotal, { currency })}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-danger hover:bg-danger/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-text-tertiary text-sm">
                  No line items yet. Click “Add line” to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-border-primary/50">
        {items.map((it, idx) => {
          const lineTotal = it.qty * it.unitPrice * (1 + it.taxRate / 100);
          return (
            <div key={idx} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <input
                  value={it.description}
                  onChange={(e) => update(idx, { description: e.target.value })}
                  placeholder="Description..."
                  className="flex-1 bg-transparent border-none outline-none text-text-primary font-medium placeholder:text-text-tertiary"
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-danger hover:bg-danger/10"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Qty">
                  <input type="number" min={0} value={it.qty} onChange={(e) => update(idx, { qty: Math.max(0, Number(e.target.value)) })} className="glass-input rounded-lg px-2 py-1.5 text-center w-full" />
                </Field>
                <Field label="Price">
                  <input type="number" min={0} step="0.01" value={it.unitPrice} onChange={(e) => update(idx, { unitPrice: Math.max(0, Number(e.target.value)) })} className="glass-input rounded-lg px-2 py-1.5 text-right w-full" />
                </Field>
                <Field label="Tax">
                  <select value={it.taxRate} onChange={(e) => update(idx, { taxRate: Number(e.target.value) })} className="glass-input rounded-lg px-2 py-1.5 w-full text-center">
                    {TAX_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </Field>
              </div>
              <p className="text-right text-sm font-semibold text-text-primary">{formatMoney(lineTotal, { currency })}</p>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="p-6 text-center text-text-tertiary text-sm">No line items yet.</p>
        )}
        <button
          type="button"
          onClick={add}
          className="w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold text-accent hover:bg-accent/5 border-t border-border-primary"
        >
          <Plus size={16} /> Add line
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase text-text-tertiary">{label}</span>
      {children}
    </label>
  );
}
