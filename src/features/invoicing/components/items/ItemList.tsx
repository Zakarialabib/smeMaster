import { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Package, Boxes, Trash2, AlertTriangle, Layers,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { useInvoicingStore } from '../../stores/invoicingStore';
import { ACTIVE_COMPANY_ID, formatMoney } from '../../utils/format';
import type { Item } from '../../types';
import ItemForm from './ItemForm';

const TYPE_META: Record<Item['type'], { label: string; cls: string }> = {
  product: { label: 'Product', cls: 'bg-accent/10 text-accent' },
  service: { label: 'Service', cls: 'bg-success/10 text-success' },
};

export default function ItemList() {
  const items = useInvoicingStore((s) => s.items);
  const itemsLoading = useInvoicingStore((s) => s.itemsLoading);
  const fetchItems = useInvoicingStore((s) => s.fetchItems);
  const removeItem = useInvoicingStore((s) => s.removeItem);

  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  useEffect(() => {
    fetchItems(ACTIVE_COMPANY_ID);
  }, [fetchItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        (it.sku ?? '').toLowerCase().includes(q),
    );
  }, [items, search]);

  const stats = useMemo(() => {
    const products = items.filter((it) => it.type === 'product').length;
    const services = items.filter((it) => it.type === 'service').length;
    const lowStock = items.filter((it) => it.stock_qty <= it.stock_alert).length;
    return { total: items.length, products, services, lowStock };
  }, [items]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (item: Item) => {
    setEditing(item);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await removeItem(pendingDelete);
    setPendingDelete(null);
  };

  const isLow = (it: Item) => it.stock_qty <= it.stock_alert;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Items" value={stats.total} icon={<Layers className="text-accent" />} tone="accent" />
        <StatCard label="Products" value={stats.products} icon={<Package className="text-accent" />} tone="accent" />
        <StatCard label="Services" value={stats.services} icon={<Boxes className="text-success" />} tone="success" />
        <StatCard label="Low Stock" value={stats.lowStock} icon={<AlertTriangle className="text-warning" />} tone="warning" />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full glass-input rounded-xl pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none"
          />
        </div>
        <Button icon={<Plus size={16} />} onClick={openNew}>
          New Item
        </Button>
      </div>

      {/* Table (desktop) */}
      <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 overflow-hidden backdrop-blur-xl hidden md:block">
        {itemsLoading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState hasItems={items.length > 0} onNew={openNew} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-primary">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold hidden lg:table-cell">SKU</th>
                  <th className="px-5 py-3 font-semibold text-right">Unit Price</th>
                  <th className="px-5 py-3 font-semibold text-center">Stock</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary/60">
                {filtered.map((it) => (
                  <tr
                    key={it.id}
                    onClick={() => openEdit(it)}
                    className="group cursor-pointer hover:bg-bg-hover/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-bg-tertiary flex items-center justify-center text-text-secondary shrink-0">
                          <Package size={16} />
                        </div>
                        <span className="font-semibold text-text-primary truncate">{it.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${TYPE_META[it.type].cls}`}>
                        {TYPE_META[it.type].label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-text-tertiary font-mono text-xs hidden lg:table-cell">
                      {it.sku ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-text-primary">
                      {formatMoney(it.sell_price)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {isLow(it) ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-danger/10 text-danger">
                          <AlertTriangle size={12} /> {it.stock_qty}
                        </span>
                      ) : (
                        <span className="text-text-secondary text-sm">{it.stock_qty}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconBtn
                          title="Delete"
                          danger
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDelete(it.id);
                          }}
                        >
                          <Trash2 size={15} />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden space-y-3">
        {itemsLoading ? (
          <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 backdrop-blur-xl p-6 text-center text-text-tertiary text-sm">
            Loading items…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasItems={items.length > 0} onNew={openNew} />
        ) : (
          filtered.map((it) => (
            <div
              key={it.id}
              onClick={() => openEdit(it)}
              className="rounded-2xl border border-border-primary bg-bg-secondary/60 backdrop-blur-xl p-4 space-y-3 cursor-pointer hover:bg-bg-hover/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-bg-tertiary flex items-center justify-center text-text-secondary shrink-0">
                    <Package size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary truncate">{it.name}</p>
                    <p className="text-xs text-text-tertiary truncate">{it.sku ?? 'No SKU'}</p>
                  </div>
                </div>
                <IconBtn
                  title="Delete"
                  danger
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(it.id);
                  }}
                >
                  <Trash2 size={15} />
                </IconBtn>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${TYPE_META[it.type].cls}`}>
                  {TYPE_META[it.type].label}
                </span>
                <span className="text-text-secondary text-sm font-semibold">
                  {formatMoney(it.sell_price)}
                </span>
                {isLow(it) ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-danger/10 text-danger">
                    <AlertTriangle size={12} /> Low: {it.stock_qty}
                  </span>
                ) : (
                  <span className="text-[11px] text-text-tertiary">Stock: {it.stock_qty}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ItemForm open={formOpen} onClose={() => setFormOpen(false)} item={editing} />

      {pendingDelete && (
        <ConfirmDelete
          name={items.find((it) => it.id === pendingDelete)?.name ?? ''}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  const tones: Record<string, string> = {
    accent: 'bg-accent/10 text-accent',
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
    danger: 'bg-danger/10 text-danger',
  };
  return (
    <div className="bg-bg-primary/70 backdrop-blur-xl border border-border-primary rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-text-tertiary text-[11px] font-semibold uppercase tracking-wider truncate">{label}</p>
        <p className="text-lg sm:text-xl font-bold text-text-primary mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; title: string; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors active:scale-[0.97] ${
        danger ? 'text-text-tertiary hover:text-danger hover:bg-danger/10' : 'text-text-tertiary hover:text-accent hover:bg-accent/10'
      }`}
    >
      {children}
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-border-primary/60">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
          <div className="w-9 h-9 rounded-xl bg-bg-tertiary" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 bg-bg-tertiary rounded" />
            <div className="h-2.5 w-20 bg-bg-tertiary rounded" />
          </div>
          <div className="h-5 w-14 bg-bg-tertiary rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasItems, onNew }: { hasItems: boolean; onNew: () => void }) {
  return (
    <div className="p-12 sm:p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center mx-auto mb-4 text-text-tertiary">
        <Package size={30} />
      </div>
      <h3 className="text-lg font-bold text-text-primary">
        {hasItems ? 'No matches' : 'No items yet'}
      </h3>
      <p className="text-text-secondary text-sm mt-1 max-w-xs mx-auto">
        {hasItems
          ? 'Try adjusting your search.'
          : 'Add the products and services you sell to speed up invoicing.'}
      </p>
      {!hasItems && (
        <Button icon={<Plus size={16} />} className="mt-5" onClick={onNew}>
          New Item
        </Button>
      )}
    </div>
  );
}

function ConfirmDelete({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="bg-bg-primary rounded-2xl border border-border-primary w-full max-w-sm p-6 backdrop-blur-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-11 h-11 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4">
          <Trash2 size={20} />
        </div>
        <h3 className="text-lg font-bold text-text-primary">Delete {name || 'this item'}?</h3>
        <p className="text-sm text-text-secondary mt-1">
          This permanently removes the item from your catalog. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" icon={<Trash2 size={15} />} onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  );
}
