import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ReceiptText, Plus, Users, Package, Settings2, Building2, ChevronDown,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { useInvoicingStore } from '../stores/invoicingStore';
import { ACTIVE_COMPANY_ID } from '../utils/format';
import InvoiceList from './InvoiceList';
import ClientList from './clients/ClientList';
import ItemList from './items/ItemList';
import BusinessProfilePanel from './BusinessProfilePanel';
import SettingsDrawer from './SettingsDrawer';

type TabId = 'invoices' | 'clients' | 'items' | 'settings';

const TABS: { id: TabId; label: string; icon: typeof ReceiptText }[] = [
  { id: 'invoices', label: 'Documents', icon: ReceiptText },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'items', label: 'Items', icon: Package },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export default function InvoicingDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('invoices');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const company = useInvoicingStore((s) => s.company);
  const fetchInvoices = useInvoicingStore((s) => s.fetchInvoices);
  const fetchClients = useInvoicingStore((s) => s.fetchClients);
  const fetchItems = useInvoicingStore((s) => s.fetchItems);
  const fetchCompany = useInvoicingStore((s) => s.fetchCompany);

  useEffect(() => {
    fetchCompany(ACTIVE_COMPANY_ID);
  }, [fetchCompany]);

  useEffect(() => {
    if (tab === 'invoices') fetchInvoices(ACTIVE_COMPANY_ID);
    if (tab === 'clients') fetchClients(ACTIVE_COMPANY_ID);
    if (tab === 'items') fetchItems(ACTIVE_COMPANY_ID);
  }, [tab, fetchInvoices, fetchClients, fetchItems]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-bg-primary">
      {/* Frosted header */}
      <header className="sticky top-0 z-20 px-5 sm:px-8 py-4 border-b border-border-primary bg-bg-primary/70 backdrop-blur-[16px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
              <ReceiptText size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-text-primary leading-tight truncate">Invoicing</h1>
              <button
                type="button"
                className="group flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                onClick={() => setSettingsOpen(true)}
              >
                <Building2 size={13} />
                <span className="truncate max-w-[180px]">{company?.name ?? 'Your Company'}</span>
                <ChevronDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Settings2 size={16} />}
              onClick={() => setSettingsOpen(true)}
              className="hidden sm:inline-flex"
            />
            <Button
              icon={<Plus size={18} />}
              onClick={() => navigate({ to: '/invoicing/new' })}
            >
              New Document
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <nav className="mt-4 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-bg-hover/60 hover:text-text-primary'
                }`}
              >
                <Icon size={16} />
                {t.label}
                {active && (
                  <span className="absolute -bottom-[1px] left-3 right-3 h-0.5 rounded-full bg-accent" />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Tab content */}
      <main className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {tab === 'invoices' && <InvoiceList />}
          {tab === 'clients' && <ClientList />}
          {tab === 'items' && <ItemList />}
          {tab === 'settings' && <BusinessProfilePanel />}
        </div>
      </main>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
