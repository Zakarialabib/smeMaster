import { useState } from 'react';
import {
  Calculator, LayoutDashboard, Package, BookOpen, FileBarChart, ShieldCheck,
} from 'lucide-react';
import CompanySwitcher from './CompanySwitcher';
import StockView from './StockView';
import JournalView from './JournalView';
import FinancialReports from './FinancialReports';
import RbacRoles from './RbacRoles';
import { useCompanyStore, getActiveCompany, companyInitials } from './companyStore';
import { InfoBanner, StatCard, SectionCard, DemoBadge } from './erpShared';

type TabId = 'overview' | 'stock' | 'accounting' | 'reports' | 'roles';

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'accounting', label: 'Accounting', icon: BookOpen },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'roles', label: 'Roles', icon: ShieldCheck },
];

export default function ErpPage() {
  const [tab, setTab] = useState<TabId>('overview');

  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const company = getActiveCompany(companies, activeCompanyId);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-bg-primary">
      {/* Frosted header */}
      <header className="sticky top-0 z-20 px-5 sm:px-8 py-4 border-b border-border-primary bg-bg-primary/70 backdrop-blur-[16px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
              <Calculator size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-text-primary leading-tight truncate">ERP Console</h1>
                <DemoBadge label="Demo · backend pending" />
              </div>
              <p className="text-xs text-text-tertiary truncate">
                Inventory · Accounting · Platform — for {company.name}
              </p>
            </div>
          </div>

          <CompanySwitcher />
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
          {tab === 'overview' && <OverviewTab />}
          {tab === 'stock' && <StockView />}
          {tab === 'accounting' && <JournalView />}
          {tab === 'reports' && <FinancialReports />}
          {tab === 'roles' && <RbacRoles />}
        </div>
      </main>
    </div>
  );
}

function OverviewTab() {
  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const company = getActiveCompany(companies, activeCompanyId);

  return (
    <div className="space-y-5">
      <InfoBanner>
        This is a design-first preview of Iteration 5 (Inventory → ERP → Platform). All figures are
        sample data for <span className="font-medium text-text-primary">{company.name}</span>; no
        backend is wired yet.
      </InfoBanner>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Inventory value" value={266_860} icon={<Package size={18} />} tone="accent" compact hint="8 SKUs" />
        <StatCard label="Low stock" value={4} icon={<Package size={18} />} tone="danger" hint="need reorder" />
        <StatCard label="Net profit" value={147_000} icon={<FileBarChart size={18} />} tone="success" hint="this period" />
        <StatCard label="Roles" value={5} icon={<ShieldCheck size={18} />} tone="neutral" hint="5 permissions" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard className="p-5 lg:col-span-2">
          <h3 className="font-bold text-text-primary mb-1">What ships in Iteration 5</h3>
          <p className="text-sm text-text-secondary mb-4">
            The console is ready to be wired to real services. Today these modules are visual shells.
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
            <span className="text-text-tertiary">Your role</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent">{company.role}</span>
          </div>
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
