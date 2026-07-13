import { useEffect, useMemo, useState } from 'react';
import { BookOpen, TrendingUp, TrendingDown, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { formatMoney, formatDate } from '@features/invoicing/utils/format';
import { useCompanyStore, getActiveCompany } from './companyStore';
import { InfoBanner, SectionCard, LiveBadge } from './erpShared';
import type { ErpAccount, JournalEntry } from '@shared/services/db/schema';
import {
  listJournalEntries,
  listChartOfAccounts,
  ensureChartOfAccounts,
} from '@shared/services/db/invoke/invoicing';

export default function JournalView() {
  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const company = getActiveCompany(companies, activeCompanyId);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<ErpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await ensureChartOfAccounts(activeCompanyId);
      const [je, coa] = await Promise.all([
        listJournalEntries(activeCompanyId),
        listChartOfAccounts(activeCompanyId),
      ]);
      setEntries(je);
      setAccounts(coa);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId]);

  const accountMap = useMemo(() => {
    const m: Record<string, ErpAccount> = {};
    for (const a of accounts) m[a.id] = a;
    return m;
  }, [accounts]);

  const accountLabel = (id: string): string => {
    const a = accountMap[id];
    return a ? `${a.code} · ${a.name}` : id.slice(0, 8);
  };

  const totals = useMemo(() => {
    const debit = entries.reduce((a, e) => a + e.debit, 0);
    const credit = entries.reduce((a, e) => a + e.credit, 0);
    return { debit, credit };
  }, [entries]);

  // Monthly debit vs credit bars (last 6 active months from real postings).
  const monthly = useMemo(() => {
    const byMonth = new Map<string, { debit: number; credit: number }>();
    for (const e of entries) {
      const d = new Date(e.entry_date * 1000);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const cur = byMonth.get(key) ?? { debit: 0, credit: 0 };
      cur.debit += e.debit;
      cur.credit += e.credit;
      byMonth.set(key, cur);
    }
    return [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-6)
      .map(([k, v]) => {
        const [y, m] = k.split('-');
        const label = new Date(Number(y), Number(m), 1).toLocaleDateString('en-GB', { month: 'short' });
        return { label, debit: v.debit, credit: v.credit };
      });
  }, [entries]);

  const maxMonthly = monthly.length ? Math.max(...monthly.map((m) => Math.max(m.debit, m.credit))) : 1;
  const recent = useMemo(() => [...entries].sort((a, b) => b.entry_date - a.entry_date), [entries]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-text-primary">General Journal</h2>
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

      {!error && entries.length === 0 && !loading && (
        <InfoBanner>
          No postings yet for <span className="font-medium text-text-primary">{company?.name ?? "this company"}</span>. Send an
          invoice from <span className="font-medium">Invoicing</span> and it is posted here automatically as a
          double-entry journal entry.
        </InfoBanner>
      )}

      {/* Monthly debit vs credit bars */}
      {monthly.length > 0 && (
        <SectionCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-text-primary flex items-center gap-2">
              <ArrowRightLeft size={16} className="text-accent" /> Monthly Debits vs Credits
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-text-tertiary">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-accent" /> Debit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-success" /> Credit
              </span>
            </div>
          </div>

          <div className="flex items-end gap-3 h-44 px-1">
            {monthly.map((m) => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center gap-1 h-36">
                  <div
                    className="group relative w-1/2 max-w-[14px] rounded-t-md bg-accent/80 hover:bg-accent transition-colors"
                    style={{ height: `${maxMonthly ? (m.debit / maxMonthly) * 100 : 0}%` }}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-accent opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                      {formatMoney(m.debit, { currency: 'MAD' })}
                    </span>
                  </div>
                  <div
                    className="group relative w-1/2 max-w-[14px] rounded-t-md bg-success/70 hover:bg-success transition-colors"
                    style={{ height: `${maxMonthly ? (m.credit / maxMonthly) * 100 : 0}%` }}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-success opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                      {formatMoney(m.credit, { currency: 'MAD' })}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-text-tertiary">{m.label}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Totals + entries table */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-primary/70 backdrop-blur-xl border border-border-primary rounded-2xl p-4 flex items-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Total Debits</p>
            <p className="text-lg font-bold text-text-primary tabular-nums">{formatMoney(totals.debit)}</p>
          </div>
        </div>
        <div className="bg-bg-primary/70 backdrop-blur-xl border border-border-primary rounded-2xl p-4 flex items-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
          <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
            <TrendingDown size={18} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Total Credits</p>
            <p className="text-lg font-bold text-text-primary tabular-nums">{formatMoney(totals.credit)}</p>
          </div>
        </div>
      </div>

      <SectionCard className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-primary flex items-center gap-2 text-text-secondary text-sm font-medium">
          <BookOpen size={16} className="text-accent" /> Recent postings
        </div>
        {recent.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-primary">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Account</th>
                  <th className="px-5 py-3 font-semibold">Reference</th>
                  <th className="px-5 py-3 font-semibold text-right">Debit</th>
                  <th className="px-5 py-3 font-semibold text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary/60">
                {recent.map((e) => (
                  <tr key={e.id} className="hover:bg-bg-hover/40 transition-colors">
                    <td className="px-5 py-3 text-text-tertiary whitespace-nowrap">{formatDate(e.entry_date, 'short')}</td>
                    <td className="px-5 py-3 text-text-primary">{accountLabel(e.account_id)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-text-tertiary">{e.reference ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-text-primary">
                      {e.debit > 0 ? formatMoney(e.debit, { currency: e.currency }) : <span className="text-text-tertiary">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-text-secondary">
                      {e.credit > 0 ? formatMoney(e.credit, { currency: e.currency }) : <span className="text-text-tertiary">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !error && (
            <div className="px-5 py-10 text-center text-sm text-text-tertiary">
              No journal entries to display yet.
            </div>
          )
        )}
      </SectionCard>
    </div>
  );
}
