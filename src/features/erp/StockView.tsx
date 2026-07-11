import { useMemo, useState } from 'react';
import {
  Package, AlertTriangle, Layers, Wallet, Pencil, X, Check,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { formatMoney } from '@features/invoicing/utils/format';
import { useCompanyStore, getActiveCompany } from './companyStore';
import { InfoBanner, StatCard, SectionCard, DemoBadge } from './erpShared';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock_qty: number;
  stock_alert: number;
  unit_price: number;
}

const MOCK_PRODUCTS: Product[] = [
  { id: 'p-1', name: 'Artisan Argan Oil 250ml', sku: 'ARG-250', category: 'Cosmetics', stock_qty: 12, stock_alert: 20, unit_price: 120 },
  { id: 'p-2', name: 'Handwoven Berber Rug', sku: 'RUG-001', category: 'Home', stock_qty: 4, stock_alert: 5, unit_price: 2400 },
  { id: 'p-3', name: 'Ceramic Tagine Large', sku: 'TAG-LG', category: 'Kitchen', stock_qty: 38, stock_alert: 10, unit_price: 320 },
  { id: 'p-4', name: 'Mint Tea Glasses (set/6)', sku: 'TEA-06', category: 'Kitchen', stock_qty: 7, stock_alert: 15, unit_price: 90 },
  { id: 'p-5', name: 'Leather Pouffe', sku: 'POF-STD', category: 'Home', stock_qty: 21, stock_alert: 8, unit_price: 540 },
  { id: 'p-6', name: 'Saffron Threads 5g', sku: 'SAF-005', category: 'Food', stock_qty: 3, stock_alert: 6, unit_price: 760 },
  { id: 'p-7', name: 'Lantern Brass Medium', sku: 'LAN-MD', category: 'Home', stock_qty: 54, stock_alert: 12, unit_price: 210 },
  { id: 'p-8', name: 'Zellige Coasters (set/4)', sku: 'ZEL-04', category: 'Home', stock_qty: 16, stock_alert: 10, unit_price: 130 },
];

export default function StockView() {
  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const company = getActiveCompany(companies, activeCompanyId);

  const [adjusting, setAdjusting] = useState<Product | null>(null);

  const { totalSkus, lowStock, inventoryValue } = useMemo(() => {
    let low = 0;
    let value = 0;
    for (const p of MOCK_PRODUCTS) {
      if (p.stock_qty <= p.stock_alert) low += 1;
      value += p.stock_qty * p.unit_price;
    }
    return { totalSkus: MOCK_PRODUCTS.length, lowStock: low, inventoryValue: value };
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-text-primary">Inventory</h2>
          <DemoBadge />
        </div>
        <Button variant="ghost" size="sm" icon={<Pencil size={15} />} onClick={() => setAdjusting(MOCK_PRODUCTS[0] ?? null)}>
          Adjust stock
        </Button>
      </div>

      <InfoBanner>
        Stock updates will sync when the Inventory backend (Iteration 5) ships. These figures are
        sample data for <span className="font-medium text-text-primary">{company.name}</span>.
      </InfoBanner>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total SKUs" value={totalSkus} icon={<Layers size={18} />} tone="accent" hint="active products" />
        <StatCard label="Low stock" value={lowStock} icon={<AlertTriangle size={18} />} tone="danger" hint="below alert level" />
        <StatCard label="Inventory value" value={inventoryValue} icon={<Wallet size={18} />} tone="success" compact hint="at unit cost" />
      </div>

      {/* Desktop table */}
      <SectionCard className="overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-primary">
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-5 py-3 font-semibold">SKU</th>
                <th className="px-5 py-3 font-semibold hidden lg:table-cell">Category</th>
                <th className="px-5 py-3 font-semibold text-right">On hand</th>
                <th className="px-5 py-3 font-semibold text-right">Alert at</th>
                <th className="px-5 py-3 font-semibold text-right">Value</th>
                <th className="px-5 py-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary/60">
              {MOCK_PRODUCTS.map((p) => {
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
                    <td className="px-5 py-3.5 font-mono text-xs text-text-tertiary">{p.sku}</td>
                    <td className="px-5 py-3.5 text-text-secondary hidden lg:table-cell">{p.category}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-text-primary tabular-nums">{p.stock_qty}</td>
                    <td className="px-5 py-3.5 text-right text-text-tertiary tabular-nums">{p.stock_alert}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-text-primary tabular-nums">
                      {formatMoney(p.stock_qty * p.unit_price)}
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
          {MOCK_PRODUCTS.map((p) => {
            const low = p.stock_qty <= p.stock_alert;
            return (
              <div key={p.id} className="px-4 py-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center text-text-secondary shrink-0">
                  <Package size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary truncate">{p.name}</p>
                  <p className="text-[11px] text-text-tertiary font-mono">{p.sku}</p>
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
        <AdjustStockModal product={adjusting} onClose={() => setAdjusting(null)} />
      )}
    </div>
  );
}

function AdjustStockModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [qty, setQty] = useState(product.stock_qty);
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
              <h3 className="font-bold text-text-primary truncate">{product.name}</h3>
              <p className="text-[11px] text-text-tertiary font-mono">{product.sku}</p>
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
          Demo only — adjustments are not persisted. Backend sync arrives in Iteration 5.
        </p>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon={<Check size={15} />} onClick={onClose}>Save (demo)</Button>
        </div>
      </div>
    </div>
  );
}
