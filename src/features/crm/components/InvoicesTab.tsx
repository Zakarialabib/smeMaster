import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Search, Plus, FileText, ArrowUpRight, Eye, AlertTriangle, CheckCircle2,
  Clock, Wallet,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { useInvoicingStore } from '@/features/invoicing/stores/invoicingStore';
import { ACTIVE_COMPANY_ID, formatMoney, formatDate, daysUntil } from '@/features/invoicing/utils/format';
import { DOCUMENT_TYPE_META } from '@/features/invoicing/utils/status';
import InvoiceStatusPill from '@/features/invoicing/components/InvoiceStatusPill';

export default function InvoicesTab() {
  const navigate = useNavigate();
  const invoices = useInvoicingStore((s) => s.invoices);
  const clients = useInvoicingStore((s) => s.clients);
  const listLoading = useInvoicingStore((s) => s.listLoading);
  const listError = useInvoicingStore((s) => s.listError);
  const fetchInvoices = useInvoicingStore((s) => s.fetchInvoices);
  const fetchClients = useInvoicingStore((s) => s.fetchClients);

  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchInvoices(ACTIVE_COMPANY_ID);
    fetchClients(ACTIVE_COMPANY_ID);
  }, [fetchInvoices, fetchClients]);

  const clientName = (id: string) =>
    clients.find((c) => c.id === id)?.name ?? 'Unassigned client';

  const stats = useMemo(() => {
    const total = invoices.reduce((a, i) => a + i.total_amount, 0);
    const outstanding = invoices
      .filter((i) => i.status === 'sent' || i.status === 'partial')
      .reduce((a, i) => a + i.total_amount, 0);
    const paid = invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total_amount, 0);
    const now = Math.floor(Date.now() / 1000);
    const overdue = invoices
      .filter((i) => i.status === 'sent' && i.due_date && i.due_date < now)
      .reduce((a, i) => a + i.total_amount, 0);
    return { total, outstanding, paid, overdue };
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (i) =>
        i.invoice_number.toLowerCase().includes(q) ||
        clientName(i.client_id).toLowerCase().includes(q),
    );
  }, [invoices, search, clients]);

  const openEditor = (id: string) =>
    navigate({ to: '/invoicing/edit/$invoiceId', params: { invoiceId: id } });

  return (
    <div className="space-y-6 p-4">
      {/* Stat widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Invoiced" value={stats.total} icon={<Wallet className="text-accent" />} tone="accent" />
        <StatCard label="Outstanding" value={stats.outstanding} icon={<Clock className="text-warning" />} tone="warning" />
        <StatCard label="Paid" value={stats.paid} icon={<CheckCircle2 className="text-success" />} tone="success" />
        <StatCard label="Overdue" value={stats.overdue} icon={<AlertTriangle className="text-danger" />} tone="danger" />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by number or client..."
            className="w-full glass-input rounded-xl pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none"
          />
        </div>
        <Button icon={<Plus size={16} />} onClick={() => navigate({ to: '/invoicing/new' })}>
          New Document
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 overflow-hidden backdrop-blur-xl">
        {listError ? (
          <div className="p-10 text-center text-danger text-sm">{listError}</div>
        ) : listLoading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState hasInvoices={invoices.length > 0} onNew={() => navigate({ to: '/invoicing/new' })} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-primary">
                  <th className="px-5 py-3 font-semibold">Document</th>
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Issued</th>
                  <th className="px-5 py-3 font-semibold hidden lg:table-cell">Due</th>
                  <th className="px-5 py-3 font-semibold text-right">Amount</th>
                  <th className="px-5 py-3 font-semibold text-center">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary/60">
                {filtered.map((inv) => {
                  const overdue = inv.status === 'sent' && inv.due_date && daysUntil(inv.due_date)! < 0;
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => openEditor(inv.id)}
                      className="group cursor-pointer hover:bg-bg-hover/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-bg-tertiary flex items-center justify-center text-text-secondary shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-semibold text-text-primary truncate">
                              {inv.invoice_number}
                            </p>
                            <p className="text-[11px] text-text-tertiary">
                              {DOCUMENT_TYPE_META[inv.document_type].label}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary truncate max-w-[180px]">
                        {clientName(inv.client_id)}
                      </td>
                      <td className="px-5 py-3.5 text-text-tertiary hidden md:table-cell">
                        {formatDate(inv.issue_date, 'short')}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        {inv.due_date ? (
                          <span className={overdue ? 'text-danger text-xs font-medium' : 'text-text-tertiary text-xs'}>
                            {formatDate(inv.due_date, 'short')}
                            {overdue && <span className="block text-[10px]">overdue</span>}
                          </span>
                        ) : (
                          <span className="text-text-tertiary text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-text-primary">
                        {formatMoney(inv.total_amount, { currency: inv.currency })}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <InvoiceStatusPill status={inv.status} size="sm" />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {inv.pdf_path && (
                            <IconBtn title="Preview" onClick={(e) => { e.stopPropagation(); openEditor(inv.id); }}>
                              <Eye size={15} />
                            </IconBtn>
                          )}
                          <IconBtn title="Open" onClick={(e) => { e.stopPropagation(); openEditor(inv.id); }}>
                            <ArrowUpRight size={15} />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
        <p className="text-lg sm:text-xl font-bold text-text-primary mt-0.5">{formatMoney(value)}</p>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-text-tertiary hover:text-accent hover:bg-accent/10"
    >
      {children}
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-border-primary/60">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
          <div className="w-9 h-9 rounded-xl bg-bg-tertiary" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 bg-bg-tertiary rounded" />
            <div className="h-2.5 w-20 bg-bg-tertiary rounded" />
          </div>
          <div className="h-3 w-16 bg-bg-tertiary rounded hidden md:block" />
          <div className="h-5 w-14 bg-bg-tertiary rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasInvoices, onNew }: { hasInvoices: boolean; onNew: () => void }) {
  return (
    <div className="p-12 sm:p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center mx-auto mb-4 text-text-tertiary">
        <FileText size={30} />
      </div>
      <h3 className="text-lg font-bold text-text-primary">
        {hasInvoices ? 'No matches' : 'No documents yet'}
      </h3>
      <p className="text-text-secondary text-sm mt-1 max-w-xs mx-auto">
        {hasInvoices
          ? 'Try adjusting your search or filters.'
          : 'Create your first DGI-compliant invoice, delivery bill, or shipping slip.'}
      </p>
      {!hasInvoices && (
        <Button icon={<Plus size={16} />} className="mt-5" onClick={onNew}>
          Create Document
        </Button>
      )}
    </div>
  );
}
