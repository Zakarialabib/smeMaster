import { create } from 'zustand';

export interface Company {
  id: string;
  name: string;
  /** Moroccan ICE (Identifiant Commun de l'Entreprise) — mock value. */
  ice: string;
  /** Current user's role within this company (mock). */
  role: string;
}

export const MOCK_COMPANIES: Company[] = [
  { id: 'demo-company-1', name: 'Atlas Trading SARL', ice: '002315476000032', role: 'Owner' },
  { id: 'demo-company-2', name: 'Sahara Logistics', ice: '001987654000017', role: 'Accountant' },
  { id: 'demo-company-3', name: 'Medina Boutique', ice: '003456789000044', role: 'Admin' },
];

interface CompanyState {
  activeCompanyId: string;
  companies: Company[];
  setActiveCompany: (id: string) => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  activeCompanyId: MOCK_COMPANIES[0]!.id,
  companies: MOCK_COMPANIES,
  setActiveCompany: (id) => set({ activeCompanyId: id }),
}));

export function getActiveCompany(companies: Company[], activeCompanyId: string): Company {
  return companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? MOCK_COMPANIES[0]!;
}

export function companyInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}
