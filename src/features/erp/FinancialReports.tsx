import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Layers, Wallet, Landmark, BookOpen, RefreshCw } from 'lucide-react';
import { formatMoney } from '@features/invoicing/utils/format';
import { useCompanyStore, getActiveCompany } from './companyStore';
import { InfoBanner, SectionCard, LiveBadge } from './erpShared';
import type { ErpAccount, PnlResult } from '@shared/services/db/schema';
import { getProfitAndLoss, listChartOfAccounts } from '@shared/services/db/invoke/invoicing';

const ACCOUNT_TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
};

export default function FinancialReports() {
  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const company = getActiveCompany(companies, activeCompanyId);

  const [pnl, setPnl] = useState<PnlResult | null>(null);
  const [accounts, setAccounts] = useState<ErpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, coa] = await Promise.all([
        getProfitAndLoss(activeCompanyId),
        listChartOfAccounts(activeCompanyId),
      ]);
      setPnl(p);
      setAccounts(coa);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId]);

  const revenue = pnl?.revenue ?? 0;
  const expenses = pnl?.expenses ?? 0;
  const net = pnl?.net ?? 0;

  // Breakdown bar: Expenses + Net Profit = Revenue
  const breakdown = useMemo(() => {
    const denom = revenue > 0 ? revenue : 1;
    return [
      { label: 'Expenses', value: expenses, color: 'bg-warning/70', pct: (expenses / denom) * 100 },
      { label: 'Net Profit', value: net, color: 'bg-success/80', pct: (net / denom) * 100 },
    ];
  }, [revenue, expenses, net]);

  const grouped = useMemo(() => {
    const g: Record<string, ErpAccount[]> = {};
    for (const a of accounts) (g[a.account_type] ??= []).push(a);
    return g;
  }, [accounts]);

  const hasData = revenue !== 0 || expenses !== 0 || accounts.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-text-primary">Financial Reports</h2>
          <LiveBadge />
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-text-secondary hover:bg-bg-hover/60 hover:text-text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-danger/5 border border-danger/20 text-sm text-danger">
          {error}
        </div>
      )}

      {!error && !hasData && !loading && (
        <InfoBanner>
          No financial data yet for <span className="font-medium text-text-primary">{company.name}</span>.
          Send invoices from <span className="font-medium">Invoicing</span> to populate the ledger, then the
          P&amp;L and chart of accounts update automatically.
        </InfoBanner>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Profit & Loss */}
        <SectionCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <TrendingUp size={18} />
            </div>
            <div>
              <h3 className="font-bold text-text-primary">Profit &amp; Loss</h3>
              <p className="text-[11px] text-text-tertiary">From live journal entries</p>
            </div>
          </div>

          <PnlRow icon={<Wallet size={15} />} label="Revenue" value={revenue} tone="text-text-primary" />
          <PnlRow icon={<Layers size={15} />} label="Operating Expenses" value={-expenses} tone="text-warning" />
          <div className="my-2 border-t border-border-primary" />
          <PnlRow icon={<TrendingUp size={15} />} label="Net Profit" value={net} tone="text-success" bold large />

          {/* Breakdown bar */}
          <div className="mt-4">
            <div className="flex h-3.5 rounded-full overflow-hidden bg-bg-tertiary">
              {breakdown.map((s) => (
                <div
                  key={s.label}
                  className={`${s.color} transition-all`}
                  style={{ width: `${s.pct}%` }}
                  title={`${s.label}: ${formatMoney(s.value)}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
              {breakdown.map((s) => (
                <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
                  <span className={`w-2.5 h-2.5 rounded-sm ${s.color}`} /> {s.label}
                </span>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Chart of Accounts */}
        <SectionCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="font-bold text-text-primary">Chart of Accounts</h3>
              <p className="text-[11px] text-text-tertiary">{accounts.length} accounts</p>
            </div>
          </div>

          {accounts.length === 0 ? (
            <p className="text-sm text-text-tertiary py-6 text-center">
              Chart of accounts not seeded yet.
            </p>
          ) : (
            <div className="space-y-4">
              {ACCOUNT_TYPE_ORDER.filter((t) => grouped[t]?.length).map((type) => (
                <div key={type}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
                    {ACCOUNT_TYPE_LABEL[type]}
                  </p>
                  <div className="space-y-1">
                    {grouped[type]!.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-bg-hover/40 transition-colors"
                      >
                        <span className="flex items-center gap-2 text-sm text-text-secondary min-w-0">
                          <span className="font-mono text-[11px] text-text-tertiary shrink-0">{a.code}</span>
                          <span className="truncate">{a.name}</span>
                        </span>
                        <span className="text-[10px] font-semibold uppercase text-text-tertiary shrink-0 ml-2">
                          {a.normal_balance}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-border-primary flex items-center gap-2 text-[11px] text-text-tertiary">
            <Landmark size={13} /> Balances derive from posted journal entries.
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function PnlRow({
  icon,
  label,
  value,
  tone,
  bold,
  large,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`flex items-center gap-2 ${bold ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
        <span className="text-text-tertiary">{icon}</span>
        {label}
      </span>
      <span className={`tabular-nums ${tone} ${bold ? (large ? 'text-lg font-bold' : 'font-bold') : ''}`}>
        {formatMoney(value)}
      </span>
    </div>
  );
}
