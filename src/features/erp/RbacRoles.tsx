import { useState } from 'react';
import { ShieldCheck, Check, X } from 'lucide-react';
import { useCompanyStore, getActiveCompany } from './companyStore';
import { InfoBanner, SectionCard, DemoBadge } from './erpShared';

const ROLES = ['Owner', 'Admin', 'Accountant', 'Sales', 'Viewer'] as const;
type Role = (typeof ROLES)[number];

const PERMISSIONS = [
  'Invoicing',
  'Clients',
  'Inventory',
  'Accounting',
  'Settings',
  'User Mgmt',
] as const;

// Default grant matrix (demo) — Owner has everything, Viewer has read-only basics.
const DEFAULT: Record<Role, boolean[]> = {
  Owner: [true, true, true, true, true, true],
  Admin: [true, true, true, true, true, false],
  Accountant: [true, false, false, true, false, false],
  Sales: [true, true, false, false, false, false],
  Viewer: [true, true, true, false, false, false],
};

export default function RbacRoles() {
  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const company = getActiveCompany(companies, activeCompanyId);

  const [matrix, setMatrix] = useState<Record<Role, boolean[]>>(DEFAULT);

  const toggle = (role: Role, idx: number) => {
    setMatrix((prev) => {
      const next = { ...prev, [role]: [...prev[role]] };
      next[role][idx] = !next[role][idx];
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-text-primary">Roles &amp; Permissions</h2>
        <DemoBadge />
      </div>

      <InfoBanner>
        Role-based access control arrives with the Platform tier. Toggles below are visual-only for{' '}
        <span className="font-medium text-text-primary">{company.name}</span> and are not enforced yet.
      </InfoBanner>

      <SectionCard className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-primary flex items-center gap-2 text-text-secondary text-sm font-medium">
          <ShieldCheck size={16} className="text-accent" /> Access matrix
        </div>

        {/* Desktop grid */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-text-tertiary font-semibold">
                  Permission
                </th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-3 text-center">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-bg-tertiary text-text-secondary">
                      {r}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary/60">
              {PERMISSIONS.map((perm, pi) => (
                <tr key={perm} className="hover:bg-bg-hover/30 transition-colors">
                  <td className="px-5 py-3 text-text-primary font-medium">{perm}</td>
                  {ROLES.map((r) => {
                    const on = matrix[r][pi];
                    return (
                      <td key={r} className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(r, pi)}
                          aria-pressed={on}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                            on
                              ? 'bg-success/10 text-success ring-1 ring-success/30'
                              : 'bg-bg-tertiary text-text-tertiary hover:text-text-secondary'
                          }`}
                          title={`${r} — ${perm}`}
                        >
                          {on ? <Check size={12} /> : <X size={12} />}
                          {on ? 'Allowed' : 'Denied'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: per-role cards */}
        <div className="md:hidden divide-y divide-border-primary/60">
          {ROLES.map((r) => (
            <div key={r} className="px-4 py-3.5">
              <p className="text-sm font-semibold text-text-primary mb-2.5">{r}</p>
              <div className="flex flex-wrap gap-1.5">
                {PERMISSIONS.map((perm, pi) => {
                  const on = matrix[r][pi];
                  return (
                    <button
                      key={perm}
                      type="button"
                      onClick={() => toggle(r, pi)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-all ${
                        on
                          ? 'bg-success/10 text-success ring-1 ring-success/30'
                          : 'bg-bg-tertiary text-text-tertiary'
                      }`}
                    >
                      {on ? <Check size={11} /> : <X size={11} />}
                      {perm}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
