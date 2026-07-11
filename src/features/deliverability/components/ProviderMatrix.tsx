import type { DomainHealth } from "@features/deliverability/services/domainHealthService";

interface Props {
  health: DomainHealth;
}

interface ProviderRow {
  name: string;
  ready: boolean;
}

function getProviderRows(health: DomainHealth): ProviderRow[] {
  return [
    { name: "Gmail", ready: health.spf_status.valid && health.dkim_status.valid },
    { name: "Outlook", ready: health.spf_status.valid },
    { name: "Yahoo", ready: health.dmarc_status.valid },
  ];
}

export function ProviderMatrix({ health }: Props) {
  const rows = getProviderRows(health);

  return (
    <div className="rounded-lg border border-border-primary overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg-secondary">
            <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Provider
            </th>
            <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {rows.map((row) => (
            <tr key={row.name} className="hover:bg-bg-hover transition-colors">
              <td className="px-4 py-2.5 text-text-primary font-medium">{row.name}</td>
              <td className="px-4 py-2.5">
                {row.ready ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                    <span className="text-success text-base leading-none">&#10003;</span>
                    Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                    <span className="text-warning text-base leading-none">&#9888;</span>
                    Needs Fix
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
