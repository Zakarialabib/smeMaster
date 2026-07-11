import { useEffect } from "react";
import { FileText, Plus, ArrowUpRight, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { useInvoicingStore } from "../stores/invoicingStore";
import { format } from "date-fns";

export default function InvoicingDashboard() {
  const { invoices, fetchInvoices, isLoading } = useInvoicingStore();

  useEffect(() => {
    fetchInvoicingData();
  }, []);

  const fetchInvoicingData = async () => {
    await fetchInvoices("demo-company-1");
  };

  const stats = {
    total: invoices.reduce((acc, inv) => acc + inv.total_amount, 0),
    pending: invoices.filter(i => i.status === 'sent').reduce((acc, i) => acc + i.total_amount, 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.total_amount, 0),
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Invoicing</h1>
          <p className="text-text-secondary text-sm">Manage your invoices and PEPPOL compliance</p>
        </div>
        <Button icon={<Plus size={18} />}>Create Invoice</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Invoiced"
          value={stats.total}
          icon={<DollarSign className="text-accent" />}
          currency="MAD"
        />
        <StatCard
          label="Pending Payment"
          value={stats.pending}
          icon={<Clock className="text-warning" />}
          currency="MAD"
        />
        <StatCard
          label="Paid to Date"
          value={stats.paid}
          icon={<CheckCircle2 className="text-success" />}
          currency="MAD"
        />
      </div>

      <div className="bg-bg-secondary rounded-2xl border border-border-primary overflow-hidden">
        <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between bg-bg-primary/50">
          <h2 className="font-semibold text-text-primary flex items-center gap-2">
            <FileText size={18} className="text-text-tertiary" />
            Recent Invoices
          </h2>
          <Button variant="ghost" size="sm" icon={<ArrowUpRight size={14} />}>View All</Button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-text-tertiary">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText size={24} className="text-text-tertiary" />
            </div>
            <p className="text-text-secondary font-medium">No invoices found</p>
            <p className="text-text-tertiary text-sm mt-1">Start by creating your first invoice</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-text-tertiary border-b border-border-primary">
                  <th className="px-6 py-3 font-medium">Invoice #</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-bg-hover/30 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-text-primary">{inv.invoice_number}</td>
                    <td className="px-6 py-4 text-text-secondary">Customer ID: {inv.contact_id || 'N/A'}</td>
                    <td className="px-6 py-4 text-text-tertiary">{format(inv.issue_date * 1000, 'MMM d, yyyy')}</td>
                    <td className="px-6 py-4 text-right font-semibold text-text-primary">
                      {inv.total_amount.toLocaleString(undefined, { style: 'currency', currency: inv.currency })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        inv.status === 'paid' ? 'bg-success/10 text-success' :
                        inv.status === 'sent' ? 'bg-accent/10 text-accent' :
                        'bg-bg-tertiary text-text-tertiary'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, currency }: { label: string, value: number, icon: React.ReactNode, currency: string }) {
  return (
    <div className="bg-bg-primary p-5 rounded-2xl border border-border-primary shadow-sm flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-bg-secondary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-text-tertiary text-xs font-medium uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-text-primary mt-1">
          {value.toLocaleString(undefined, { style: 'currency', currency })}
        </p>
      </div>
    </div>
  );
}
