import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from '@tanstack/react-router';
import { ReceiptText, Plus, Building2, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';
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

export type InvoicingTabId = 'documents' | 'clients' | 'items' | 'business';

const TAB_IDS: InvoicingTabId[] = ['documents', 'clients', 'items', 'business'];

function tabFromSearch(searchStr: string): InvoicingTabId {
  const tab = new URLSearchParams(searchStr).get('tab');
  return (TAB_IDS as string[]).includes(tab ?? '') ? (tab as InvoicingTabId) : 'documents';
}

export default function InvoicingDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // URL-synced tab (`/invoicing?tab=clients`) — navigation lives in the
  // sidebar (like mail/CRM), so refresh and deep links agree with it.
  // No in-page tab strip.
  const tab = tabFromSearch(location.searchStr);
  const [loadError, setLoadError] = useState<string | null>(null);

  const company = useInvoicingStore((s) => s.company);
  const listLoading = useInvoicingStore((s) => s.listLoading);
  const fetchInvoices = useInvoicingStore((s) => s.fetchInvoices);
  const fetchClients = useInvoicingStore((s) => s.fetchClients);
  const fetchItems = useInvoicingStore((s) => s.fetchItems);
  const fetchCompany = useInvoicingStore((s) => s.fetchCompany);

  const [lowStockCount, setLowStockCount] = useState(0);

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
    if (tab === 'documents')
      fetchInvoices(ACTIVE_COMPANY_ID).catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load invoices');
      });
    if (tab === 'clients')
      fetchClients(ACTIVE_COMPANY_ID).catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load clients');
      });
    if (tab === 'items')
      fetchItems(ACTIVE_COMPANY_ID).catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load items');
      });
  }, [tab, fetchInvoices, fetchClients, fetchItems]);

  const handleRetry = () => {
    setLoadError(null);
    if (tab === 'documents') fetchInvoices(ACTIVE_COMPANY_ID);
    else if (tab === 'clients') fetchClients(ACTIVE_COMPANY_ID);
    else if (tab === 'items') fetchItems(ACTIVE_COMPANY_ID);
  };

  const goBusiness = () => {
    navigate({ to: '/invoicing', search: (prev) => ({ ...prev, tab: 'business' }) });
  };

  const isLoading = listLoading && !loadError;

  // Child routes (/invoicing/new, /invoicing/edit/$invoiceId) render the
  // InvoiceEditor in place of the dashboard content.
  if (location.pathname !== '/invoicing') {
    return <Outlet />;
  }

  return (
    <PageScaffold
      title={
        <span className="flex items-center gap-1.5 sm:gap-2">
          <ReceiptText size={16} className="text-accent shrink-0 sm:size-[18]" />
          {t('common.invoicing')}
        </span>
      }
      subtitle={
        <button
          type="button"
          className="group flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          onClick={goBusiness}
          title={t('invoicing.tabs.business')}
        >
          <Building2 size={13} />
          <span className="truncate max-w-[180px]">
            {company?.name ?? t('invoicing.yourCompany')}
          </span>
          {lowStockCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger/10 text-danger shrink-0">
              <AlertTriangle size={11} /> {lowStockCount} {t('invoicing.lowStock')}
            </span>
          )}
        </button>
      }
      actions={
        <Button icon={<Plus size={18} />} onClick={() => navigate({ to: '/invoicing/new' })}>
          {t('invoicing.newDocument')}
        </Button>
      }
      maxWidth="full"
    >
      {/* Tab content — switched by the sidebar */}
      <div className="max-w-7xl mx-auto">
        {isLoading && <SkeletonPage />}

        {!isLoading && loadError && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
            <div className="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center">
              <AlertCircle size={28} />
            </div>
            <p className="text-text-primary font-semibold">
              {t('invoicing.failedToLoad', { tab: tab })}
            </p>
            <p className="text-sm text-text-tertiary max-w-md text-center">{loadError}</p>
            <Button icon={<RefreshCw size={16} />} onClick={handleRetry}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {!isLoading && !loadError && tab === 'documents' && <InvoiceList />}
        {!isLoading && !loadError && tab === 'clients' && <ClientList />}
        {!isLoading && !loadError && tab === 'items' && <ItemList />}
        {tab === 'business' && <BusinessProfilePanel />}
      </div>
    </PageScaffold>
  );
}
