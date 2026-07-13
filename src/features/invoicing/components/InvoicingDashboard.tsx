import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ReceiptText, Plus, Users, Package, Settings2, Building2, ChevronDown, AlertTriangle, RefreshCw, AlertCircle,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { PageScaffold } from '@shared/components/layout';
import { SkeletonPage } from '@shared/components/ui/Skeleton';
import { useInvoicingStore } from '../stores/invoicingStore';
import { ACTIVE_COMPANY_ID } from '../utils/format';
import { listLowStock } from '@shared/services/db/invoke/invoicing';
import InvoiceList from './InvoiceList';
import ClientList from './clients/ClientList';
import ItemList from './items/ItemList';
import BusinessProfilePanel from './BusinessProfilePanel';
import SettingsDrawer from './SettingsDrawer';

type TabId = 'invoices' | 'clients' | 'items' | 'settings';

export default function InvoicingDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const TABS: { id: TabId; label: string; icon: typeof ReceiptText }[] = [
    { id: 'invoices', label: t('invoicing.tabs.documents'), icon: ReceiptText },
    { id: 'clients', label: t('invoicing.tabs.clients'), icon: Users },
    { id: 'items', label: t('invoicing.tabs.items'), icon: Package },
    { id: 'settings', label: t('invoicing.tabs.settings'), icon: Settings2 },
  ];

  const [tab, setTab] = useState<TabId>('invoices');
  const [loadError, setLoadError] = useState<string | null>(null);

  const company = useInvoicingStore((s) => s.company);
  const listLoading = useInvoicingStore((s) => s.listLoading);
  const fetchInvoices = useInvoicingStore((s) => s.fetchInvoices);
  const fetchClients = useInvoicingStore((s) => s.fetchClients);
  const fetchItems = useInvoicingStore((s) => s.fetchItems);
  const fetchCompany = useInvoicingStore((s) => s.fetchCompany);

  const [lowStockCount, setLowStockCount] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    fetchCompany(ACTIVE_COMPANY_ID).catch((err: unknown) => {
      setLoadError(err instanceof Error ? err.message : 'Failed to load company');
    });
  }, [fetchCompany]);

  useEffect(() => {
    let cancelled = false;
    listLowStock(ACTIVE_COMPANY_ID)
      .then((items) => {
        if (!cancelled) setLowStockCount(items.length);
      })
      .catch(() => {
        /* low-stock indicator is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLoadError(null);
    if (tab === 'invoices') fetchInvoices(ACTIVE_COMPANY_ID).catch((err: unknown) => {
      setLoadError(err instanceof Error ? err.message : 'Failed to load invoices');
    });
    if (tab === 'clients') fetchClients(ACTIVE_COMPANY_ID).catch((err: unknown) => {
      setLoadError(err instanceof Error ? err.message : 'Failed to load clients');
    });
    if (tab === 'items') fetchItems(ACTIVE_COMPANY_ID).catch((err: unknown) => {
      setLoadError(err instanceof Error ? err.message : 'Failed to load items');
    });
  }, [tab, fetchInvoices, fetchClients, fetchItems]);

  const handleRetry = () => {
    setLoadError(null);
    if (tab === 'invoices') fetchInvoices(ACTIVE_COMPANY_ID);
    else if (tab === 'clients') fetchClients(ACTIVE_COMPANY_ID);
    else if (tab === 'items') fetchItems(ACTIVE_COMPANY_ID);
  };

  const isLoading = listLoading && !loadError;


  return (
    <PageScaffold
      title={
        <span className="flex items-center gap-1.5 sm:gap-2">
          <ReceiptText size={16} className="text-accent shrink-0 sm:size-[18]" />
          {t('invoicing.title')}
        </span>
      }
      subtitle={
        <button
          type="button"
          className="group flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          onClick={() => {}}
        >
          <Building2 size={13} />
          <span className="truncate max-w-[180px]">{company?.name ?? t('invoicing.yourCompany')}</span>
          <ChevronDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          {lowStockCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger/10 text-danger shrink-0">
              <AlertTriangle size={11} /> {lowStockCount} {t('invoicing.lowStock')}
            </span>
          )}
        </button>
      }
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={<Settings2 size={16} />}
            onClick={() => {}}
            className="hidden sm:inline-flex"
          />
          <Button
            icon={<Plus size={18} />}
            onClick={() => navigate({ to: '/invoicing/new' })}
          >
            {t('invoicing.newDocument')}
          </Button>
        </>
      }
      toolbar={
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((tabDef) => {
            const Icon = tabDef.icon;
            const active = tab === tabDef.id;
            return (
              <button
                key={tabDef.id}
                type="button"
                onClick={() => setTab(tabDef.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-bg-hover/60 hover:text-text-primary'
                }`}
              >
                <Icon size={16} />
                {tabDef.label}
                {active && (
                  <span className="absolute -bottom-[1px] left-3 right-3 h-0.5 rounded-full bg-accent" />
                )}
              </button>
            );
          })}
        </nav>
      }
      maxWidth="full"
    >
      {/* Tab content */}
      <div className="max-w-7xl mx-auto">
        {isLoading && <SkeletonPage />}

        {!isLoading && loadError && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
            <div className="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center">
              <AlertCircle size={28} />
            </div>
            <p className="text-text-primary font-semibold">{t('invoicing.failedToLoad', { tab: tab })}</p>
            <p className="text-sm text-text-tertiary max-w-md text-center">{loadError}</p>
            <Button icon={<RefreshCw size={16} />} onClick={handleRetry}>
              {t('invoicing.retry')}
            </Button>
          </div>
        )}

        {!isLoading && !loadError && tab === 'invoices' && <InvoiceList />}
        {!isLoading && !loadError && tab === 'clients' && <ClientList />}
        {!isLoading && !loadError && tab === 'items' && <ItemList />}
        {tab === 'settings' && <BusinessProfilePanel />}
      </div>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </PageScaffold>
  );
}