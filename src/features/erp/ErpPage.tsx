import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageScaffold } from "@shared/components/layout";
import { Calculator, LayoutDashboard, Package, BookOpen, FileBarChart, ShieldCheck, Wallet } from 'lucide-react';
import CompanySwitcher from './CompanySwitcher';
import StockView from './StockView';
import JournalView from './JournalView';
import FinancialReports from './FinancialReports';
import WalletView from './WalletView';
import RbacRoles from './RbacRoles';
import CompanyManagementView from './CompanyManagementView';
import { useCompanyStore, getActiveCompany, companyInitials } from './companyStore';
import { InfoBanner, StatCard, SectionCard, LiveBadge } from './erpShared';
import type { Item } from '@shared/services/db/schema';
import { listItems, listLowStock, getProfitAndLoss, getWallet } from '@shared/services/db/invoke/invoicing';

type TabId = 'overview' | 'stock' | 'accounting' | 'reports' | 'wallet' | 'roles' | 'company';

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'accounting', label: 'Accounting', icon: BookOpen },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'wallet', label: 'Cash', icon: Wallet },
  { id: 'roles', label: 'Roles', icon: ShieldCheck },
  { id: 'company', label: 'Company', icon: Calculator },
];

export default function ErpPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>('overview');

  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const loadCompanies = useCompanyStore((s) => s.loadCompanies);
  const company = getActiveCompany(companies, activeCompanyId);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  return (
    <PageScaffold
      title={
        <span className="flex items-center gap-2">
          <Calculator size={18} className="text-accent shrink-0" />
          {t('erp.title')}
          <LiveBadge />
        </span>
      }
      subtitle={
        <span className="truncate">
          {t('erp.subtitle', { company: company?.name ?? t('erp.yourCompany') })}
        </span>
      }
      toolbar={
        <div className="flex items-center justify-between gap-4 w-full">
          <CompanySwitcher />
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {TABS.map((tDef) => {
              const Icon = tDef.icon;
              const active = tab === tDef.id;
              return (
                <button
                  key={tDef.id}
                  type="button"
                  onClick={() => setTab(tDef.id)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    active
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:bg-bg-hover/60 hover:text-text-primary'
                  }`}
                >
                  <Icon size={16} />
                  {tDef.label}
                  {active && (
                    <span className="absolute -bottom-[1px] left-3 right-3 h-0.5 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      }
    >

      {/* Tab content */}
      <main className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {tab === 'overview' && <OverviewTab />}
          {tab === 'stock' && <StockView />}
          {tab === 'accounting' && <JournalView />}
          {tab === 'reports' && <FinancialReports />}
          {tab === 'wallet' && <WalletView />}
          {tab === 'roles' && <RbacRoles />}
          {tab === 'company' && <CompanyManagementView />}
        </div>
      </main>
    </PageScaffold>
  );
}

function OverviewTab() {
  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const company = getActiveCompany(companies, activeCompanyId);

  const [inventoryValue, setInventoryValue] = useState(0);
  const [totalSkus, setTotalSkus] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [cashOnHand, setCashOnHand] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [items, low, pnl, wallet] = await Promise.all([
          listItems(activeCompanyId),
          listLowStock(activeCompanyId),
          getProfitAndLoss(activeCompanyId),
          getWallet(activeCompanyId),
        ]);
        if (cancelled) return;
        const value = items.reduce((a: number, it: Item) => a + it.stock_qty * (it.sell_price || 0), 0);
        setInventoryValue(value);
        setTotalSkus(items.length);
        setLowStock(low.length);
        setNetProfit(pnl.net);
        setCashOnHand(wallet.balance);
      } catch {
        /* overview is best-effort; leave zeros on error */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId]);

  return (
    <div className="space-y-5">
      <InfoBanner>
        Live figures for <span className="font-medium text-text-primary">{company?.name ?? 'your company'}</span> pulled
        from the Inventory and Accounting backends via <code>invokeCommand</code>. Open the Stock, Accounting, and
        Reports tabs for detail.
      </InfoBanner>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Inventory value" value={inventoryValue} icon={<Package size={18} />} tone="accent" compact hint={loading ? 'loading…' : `${totalSkus} SKUs`} />
        <StatCard label="Low stock" value={lowStock} icon={<Package size={18} />} tone="danger" hint="need reorder" format="number" />
        <StatCard label="Net profit" value={netProfit} icon={<FileBarChart size={18} />} tone="success" compact hint="this period" />
        <StatCard label="Cash on hand" value={cashOnHand} icon={<Wallet size={18} />} tone="neutral" compact hint="via wallet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard className="p-5 lg:col-span-2">
          <h3 className="font-bold text-text-primary mb-1">ERP sub-views</h3>
          <p className="text-sm text-text-secondary mb-4">
            These modules are wired to the real backend via <code>invokeCommand</code> wrappers
            (e.g. <code>listItems</code>, <code>getProfitAndLoss</code>, <code>getWallet</code> from
            <code>@shared/services/db/invoke/invoicing</code>), not mock data.
          </p>
          <ul className="space-y-2.5 text-sm">
            <ModuleRow icon={<Package size={15} />} title="Inventory" desc="Real-time stock levels, reorder alerts, and adjustments." />
            <ModuleRow icon={<BookOpen size={15} />} title="Accounting" desc="Double-entry ledger, chart of accounts, and journal entries." />
            <ModuleRow icon={<FileBarChart size={15} />} title="Financial Reports" desc="Auto-generated P&L and balance sheet from live data." />
            <ModuleRow icon={<ShieldCheck size={15} />} title="RBAC" desc="Role-based access control across the Platform tier." />
          </ul>
        </SectionCard>

        <SectionCard className="p-5">
          <h3 className="font-bold text-text-primary mb-3">Active company</h3>
          {company ? (
            <>
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center text-sm font-bold">
                  {companyInitials(company.name)}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary truncate">{company.name}</p>
                  <p className="text-[11px] text-text-tertiary">ICE {company.ice}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border-primary flex items-center justify-between text-sm">
                <span className="text-text-tertiary">Timezone</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent">{company.timezone}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-tertiary">No company selected</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ModuleRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-8 h-8 rounded-lg bg-bg-tertiary text-text-secondary flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </span>
      <div>
        <p className="font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-tertiary">{desc}</p>
      </div>
    </li>
  );
}
