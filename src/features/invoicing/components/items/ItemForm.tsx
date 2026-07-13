import { useEffect, useState } from 'react';
import { X, Save, Loader2, Package } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { useInvoicingStore } from '../../stores/invoicingStore';
import { ACTIVE_COMPANY_ID } from '../../utils/format';
import type { Item } from '../../types';
import { notify } from '@shared/services/notifications/toastHelper';
import { getUserFriendlyErrorMessage } from '@shared/services/error/safeDbOperation';

type ItemType = Item['type'];

interface ItemFormState {
  name: string;
  type: ItemType;
  sku: string;
  unit: string;
  buy_price: string;
  sell_price: string;
  stock_qty: string;
  stock_alert: string;
  tax_rate: string;
  barcode: string;
  description: string;
}

const EMPTY: ItemFormState = {
  name: '',
  type: 'product',
  sku: '',
  unit: 'pcs',
  buy_price: '',
  sell_price: '',
  stock_qty: '0',
  stock_alert: '0',
  tax_rate: '20',
  barcode: '',
  description: '',
};

const TYPES: { value: ItemType; label: string }[] = [
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
];

const TAX_RATES = [20, 14, 10, 7, 0];

export default function ItemForm({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item?: Item | null;
}) {
  const createItem = useInvoicingStore((s) => s.createItem);
  const updateItem = useInvoicingStore((s) => s.updateItem);

  const [form, setForm] = useState<ItemFormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        name: item.name ?? '',
        type: item.type,
        sku: item.sku ?? '',
        unit: item.unit ?? 'pcs',
        buy_price: item.buy_price != null ? String(item.buy_price) : '',
        sell_price: item.sell_price != null ? String(item.sell_price) : '',
        stock_qty: item.stock_qty != null ? String(item.stock_qty) : '0',
        stock_alert: item.stock_alert != null ? String(item.stock_alert) : '0',
        tax_rate: item.tax_rate != null ? String(item.tax_rate) : '20',
        barcode: item.barcode ?? '',
        description: item.description ?? '',
      });
    } else {
      setForm(EMPTY);
    }
    setSaving(false);
  }, [open, item]);

  if (!open) return null;

  const set = (k: keyof ItemFormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = form.name.trim().length > 0 && form.sell_price.trim() !== '';

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const base: Parameters<typeof createItem>[0] = {
        companyId: ACTIVE_COMPANY_ID,
        name: form.name.trim(),
        description: form.description.trim() || null,
        type: form.type,
        sku: form.sku.trim() || null,
        categoryId: null,
        unit: form.unit.trim() || 'pcs',
        sellPrice: form.sell_price.trim() === '' ? 0 : Number(form.sell_price),
        taxRate: Number(form.tax_rate),
        barcode: form.barcode.trim() || null,
      };
      const extra: Record<string, number> = {};
      if (form.buy_price.trim() !== '') extra.buyPrice = Number(form.buy_price);
      if (form.stock_qty.trim() !== '') extra.stockQty = Number(form.stock_qty);
      if (form.stock_alert.trim() !== '') extra.stockAlert = Number(form.stock_alert);

      if (item) {
        await updateItem(item.id, { ...base, ...extra });
      } else {
        await createItem({ ...base, ...extra } as Parameters<typeof createItem>[0]);
      }
      notify(item ? 'Product updated' : 'Product created', form.name.trim());
      onClose();
    } catch (err) {
      notify(item ? 'Failed to update product' : 'Failed to create product', getUserFriendlyErrorMessage(err, 'save product'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-primary rounded-2xl border border-border-primary w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 backdrop-blur-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Package size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">
                {item ? 'Edit Item' : 'New Item'}
              </h3>
              <p className="text-xs text-text-tertiary">
                {item ? 'Update the product or service details.' : 'Add a product or service to your catalog.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 mt-6">
          <Field label="Name" required className="sm:col-span-2">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Web Design Package"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
          </Field>

          <Field label="Type">
            <Select value={form.type} onChange={(v) => set('type', v)} options={TYPES} />
          </Field>
          <Field label="Unit">
            <input
              value={form.unit}
              onChange={(e) => set('unit', e.target.value)}
              placeholder="pcs"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
          </Field>

          <Field label="SKU">
            <input
              value={form.sku}
              onChange={(e) => set('sku', e.target.value)}
              placeholder="SKU-001"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary font-mono text-sm placeholder:text-text-tertiary"
            />
          </Field>
          <Field label="Barcode">
            <input
              value={form.barcode}
              onChange={(e) => set('barcode', e.target.value)}
              placeholder="600000000000"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary font-mono text-sm placeholder:text-text-tertiary"
            />
          </Field>

          <Field label="Buy Price (MAD)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.buy_price}
              onChange={(e) => set('buy_price', e.target.value)}
              placeholder="0.00"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
          </Field>
          <Field label="Sell Price (MAD)" required>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.sell_price}
              onChange={(e) => set('sell_price', e.target.value)}
              placeholder="0.00"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
          </Field>

          <Field label="Stock Quantity">
            <input
              type="number"
              min={0}
              value={form.stock_qty}
              onChange={(e) => set('stock_qty', e.target.value)}
              placeholder="0"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
          </Field>
          <Field label="Stock Alert">
            <input
              type="number"
              min={0}
              value={form.stock_alert}
              onChange={(e) => set('stock_alert', e.target.value)}
              placeholder="0"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
          </Field>

          <Field label="Tax Rate (%)">
            <Select
              value={form.tax_rate}
              onChange={(v) => set('tax_rate', v)}
              options={TAX_RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
            />
          </Field>

          <Field label="Description" className="sm:col-span-2">
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Short description of the product or service…"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary resize-none"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            onClick={save}
            disabled={!canSave || saving}
          >
            {item ? 'Save Changes' : 'Create Item'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none glass-input rounded-xl pl-3.5 pr-9 py-2.5 text-text-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-bg-primary text-text-primary">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
