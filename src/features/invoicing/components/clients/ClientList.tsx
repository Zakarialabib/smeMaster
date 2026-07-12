import { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Users, Trash2, Check, AlertTriangle, Phone, MapPin,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { useInvoicingStore } from '../../stores/invoicingStore';
import { ACTIVE_COMPANY_ID } from '../../utils/format';
import type { Client } from '../../types';
import ClientForm from './ClientForm';

const ROLE_META: Record<Client['contact_type'], { label: string; cls: string }> = {
  client: { label: 'Client', cls: 'bg-accent/10 text-accent' },
  supplier: { label: 'Supplier', cls: 'bg-warning/10 text-warning' },
  other: { label: 'Other', cls: 'bg-text-tertiary/10 text-text-tertiary' },
  contact: { label: 'Contact', cls: 'bg-text-tertiary/10 text-text-tertiary' },
};

export default function ClientList() {
  const clients = useInvoicingStore((s) => s.clients);
  const clientsLoading = useInvoicingStore((s) => s.clientsLoading);
  const fetchClients = useInvoicingStore((s) => s.fetchClients);
  const removeClient = useInvoicingStore((s) => s.removeClient);

  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  useEffect(() => {
    fetchClients(ACTIVE_COMPANY_ID);
  }, [fetchClients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.display_name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q),
    );
  }, [clients, search]);

  const stats = useMemo(() => {
    const customers = clients.filter((c) => c.contact_type === 'client' || c.contact_type === 'other').length;
    const suppliers = clients.filter((c) => c.contact_type === 'supplier').length;
    return { total: clients.length, customers, suppliers };
  }, [clients]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (client: Client) => {
    setEditing(client);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await removeClient(pendingDelete);
    setPendingDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Clients" value={stats.total} icon={<Users className="text-accent" />} tone="accent" />
        <StatCard label="Customers" value={stats.customers} icon={<Check className="text-success" />} tone="success" />
        <StatCard label="Suppliers" value={stats.suppliers} icon={<AlertTriangle className="text-warning" />} tone="warning" />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full glass-input rounded-xl pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none"
          />
        </div>
        <Button icon={<Plus size={16} />} onClick={openNew}>
          New Client
        </Button>
      </div>

      {/* Table (desktop) */}
      <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 overflow-hidden backdrop-blur-xl hidden md:block">
        {clientsLoading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState hasClients={clients.length > 0} onNew={openNew} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-primary">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold hidden lg:table-cell">Tax ID</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary/60">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openEdit(c)}
                    className="group cursor-pointer hover:bg-bg-hover/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-bg-tertiary flex items-center justify-center text-text-secondary shrink-0">
                          <Users size={16} />
                        </div>
                        <span className="font-semibold text-text-primary truncate">{c.display_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary truncate max-w-[220px]">
                      {c.email ?? <span className="text-text-tertiary">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${ROLE_META[c.contact_type].cls}`}>
                        {ROLE_META[c.contact_type].label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-text-tertiary font-mono text-xs hidden lg:table-cell">
                      {c.tax_id ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconBtn
                          title="Delete"
                          danger
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDelete(c.id);
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
        {clientsLoading ? (
          <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 backdrop-blur-xl p-6 text-center text-text-tertiary text-sm">
            Loading clients…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasClients={clients.length > 0} onNew={openNew} />
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => openEdit(c)}
              className="rounded-2xl border border-border-primary bg-bg-secondary/60 backdrop-blur-xl p-4 space-y-3 cursor-pointer hover:bg-bg-hover/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-bg-tertiary flex items-center justify-center text-text-secondary shrink-0">
                    <Users size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary truncate">{c.display_name}</p>
                    <p className="text-xs text-text-tertiary truncate">{c.email ?? 'No email'}</p>
                  </div>
                </div>
                <IconBtn
                  title="Delete"
                  danger
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(c.id);
                  }}
                >
                  <Trash2 size={15} />
                </IconBtn>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${ROLE_META[c.contact_type].cls}`}>
                  {ROLE_META[c.contact_type].label}
                </span>
                {c.tax_id && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary font-mono">
                    <MapPin size={12} /> {c.tax_id}
                  </span>
                )}
                {(c.phone) && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
                    <Phone size={12} /> {c.phone}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ClientForm open={formOpen} onClose={() => setFormOpen(false)} client={editing} />

      {pendingDelete && (
        <ConfirmDelete
          name={clients.find((c) => c.id === pendingDelete)?.display_name ?? ''}
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
            <div className="h-2.5 w-24 bg-bg-tertiary rounded" />
          </div>
          <div className="h-5 w-16 bg-bg-tertiary rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasClients, onNew }: { hasClients: boolean; onNew: () => void }) {
  return (
    <div className="p-12 sm:p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center mx-auto mb-4 text-text-tertiary">
        <Users size={30} />
      </div>
      <h3 className="text-lg font-bold text-text-primary">
        {hasClients ? 'No matches' : 'No clients yet'}
      </h3>
      <p className="text-text-secondary text-sm mt-1 max-w-xs mx-auto">
        {hasClients
          ? 'Try adjusting your search.'
          : 'Add your customers and suppliers to start billing them.'}
      </p>
      {!hasClients && (
        <Button icon={<Plus size={16} />} className="mt-5" onClick={onNew}>
          New Client
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
        <h3 className="text-lg font-bold text-text-primary">Delete {name || 'this client'}?</h3>
        <p className="text-sm text-text-secondary mt-1">
          This permanently removes the client from your directory. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" icon={<Trash2 size={15} />} onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  );
}
