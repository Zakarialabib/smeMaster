import { useEffect, useMemo, useState } from 'react';
import {
  Package, AlertTriangle, Layers, Wallet, Pencil, X, Check, RefreshCw,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { formatMoney } from '@features/invoicing/utils/format';
import { useCompanyStore, getActiveCompany } from './companyStore';
import { InfoBanner, StatCard, SectionCard, LiveBadge } from './erpShared';
import type { Item } from '@shared/services/db/schema';
import { listItems, listLowStock, updateItem } from '@shared/services/db/invoke/invoicing';
import { notify } from '@shared/services/notifications/toastHelper';

export default function StockView() {
  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const company = getActiveCompany(companies, activeCompanyId);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<Item | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [all, low] = await Promise.all([
        listItems(activeCompanyId),
        listLowStock(activeCompanyId),
      ]);
      // Merge low-stock records (which may carry fresher stock values) by id.
      const lowById = new Map(low.map((l) => [l.id, l]));
      setItems(
        all.map((it) => {
          const fresh = lowById.get(it.id);
          return fresh ?? it;
        }),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId]);

  const { totalSkus, lowStock, inventoryValue } = useMemo(() => {
    let low = 0;
    let value = 0;
    for (const p of items) {
      if (p.stock_qty <= p.stock_alert) low += 1;
      value += p.stock_qty * (p.sell_price || 0);
    }
    return { totalSkus: items.length, lowStock: low, inventoryValue: value };
  }, [items]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-text-primary">Inventory</h2>
          <LiveBadge />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={15} />} onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Pencil size={15} />}
            onClick={() => setAdjusting(items[0] ?? null)}
            disabled={items.length === 0}
          >
            Adjust stock
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-danger/5 border border-danger/20 text-sm text-danger">
          {error}
        </div>
      )}

      {!error && items.length === 0 && !loading && (
        <InfoBanner>
          No products yet for <span className="font-medium text-text-primary">{company?.name ?? "this company"}</span>. Add
          items in <span className="font-medium">Invoicing → Items</span> and they will appear here with
          live stock levels and reorder alerts.
        </InfoBanner>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total SKUs" value={totalSkus} icon={<Layers size={18} />} tone="accent" hint="active products" format="number" />
        <StatCard label="Low stock" value={lowStock} icon={<AlertTriangle size={18} />} tone="danger" hint="below alert level" format="number" />
        <StatCard label="Inventory value" value={inventoryValue} icon={<Wallet size={18} />} tone="success" compact hint="at sell price" />
      </div>

      {/* Desktop table */}
      <SectionCard className="overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-primary">
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-5 py-3 font-semibold">SKU</th>
                <th className="px-5 py-3 font-semibold hidden lg:table-cell">Unit</th>
                <th className="px-5 py-3 font-semibold text-right">On hand</th>
                <th className="px-5 py-3 font-semibold text-right">Alert at</th>
                <th className="px-5 py-3 font-semibold text-right">Value</th>
                <th className="px-5 py-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary/60">
              {items.map((p) => {
                const low = p.stock_qty <= p.stock_alert;
                return (
                  <tr key={p.id} className="hover:bg-bg-hover/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-bg-tertiary flex items-center justify-center text-text-secondary shrink-0">
                          <Package size={16} />
                        </div>
                        <span className="font-medium text-text-primary">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-text-tertiary">{p.sku ?? '—'}</td>
                    <td className="px-5 py-3.5 text-text-secondary hidden lg:table-cell">{p.unit}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-text-primary tabular-nums">{p.stock_qty}</td>
                    <td className="px-5 py-3.5 text-right text-text-tertiary tabular-nums">{p.stock_alert}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-text-primary tabular-nums">
                      {formatMoney(p.stock_qty * (p.sell_price || 0))}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {low ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-danger/10 text-danger">
                          <AlertTriangle size={12} /> Low stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-success/10 text-success">
                          <Check size={12} /> In stock
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border-primary/60">
          {items.map((p) => {
            const low = p.stock_qty <= p.stock_alert;
            return (
              <div key={p.id} className="px-4 py-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center text-text-secondary shrink-0">
                  <Package size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary truncate">{p.name}</p>
                  <p className="text-[11px] text-text-tertiary font-mono">{p.sku ?? '—'}</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {p.stock_qty} on hand · alert at {p.stock_alert}
                  </p>
                </div>
                {low ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-danger/10 text-danger shrink-0">
                    <AlertTriangle size={11} /> Low
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-success/10 text-success shrink-0">
                    <Check size={11} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {adjusting && (
        <AdjustStockModal
          item={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={async () => {
            setAdjusting(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function AdjustStockModal({
  item,
  onClose,
  onSaved,
}: {
  item: Item;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [qty, setQty] = useState(Math.max(0, item.stock_qty));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateItem(item.id, { stockQty: qty });
      await onSaved();
    } catch (e: any) {
      setSaving(false);
      // Surface the error in the modal title area via alert-free inline message.
      notify('Stock', e?.message ?? 'Failed to save stock adjustment');
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-primary rounded-2xl border border-border-primary w-full max-w-sm p-6 backdrop-blur-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center text-text-secondary shrink-0">
              <Package size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-text-primary truncate">{item.name}</h3>
              <p className="text-[11px] text-text-tertiary font-mono">{item.sku ?? '—'}</p>
            </div>
          </div>
          <Button variant="ghost" size="xs" iconOnly icon={<X size={16} />} onClick={onClose} />
        </div>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            New quantity on hand
          </span>
          <input
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(Math.max(0, Number(e.target.value)))}
            className="glass-input rounded-xl px-3.5 py-2.5 text-text-primary w-full mt-1.5 tabular-nums"
          />
        </label>

        <p className="text-xs text-text-tertiary mt-3">
          Saving updates the item in the database. Invoices sent from Invoicing also adjust stock
          automatically.
        </p>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button icon={<Check size={15} />} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
