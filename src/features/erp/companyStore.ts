import { create } from 'zustand';
import { invokeCommand } from '@shared/services/db/invoke/command';
import type { Company as DbCompany } from '@shared/services/db/schema';

// Re-export the full backend Company type for consumers
export type Company = DbCompany;

interface CompanyState {
  activeCompanyId: string;
  companies: Company[];
  isLoading: boolean;
  error: string | null;
  loadCompanies: () => Promise<void>;
  setActiveCompany: (id: string) => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  activeCompanyId: '',
  companies: [],
  isLoading: false,
  error: null,

  loadCompanies: async () => {
    set({ isLoading: true, error: null });
    try {
      const companies = await invokeCommand<Company[]>('db_list_companies', {});
      const activeCompanyId = companies.length > 0 ? companies[0]!.id : '';
      set({ companies, activeCompanyId, isLoading: false });
    } catch (err) {
      console.error('Failed to load companies:', err);
      set({ error: 'Failed to load companies', isLoading: false });
    }
  },

  setActiveCompany: (id) => set({ activeCompanyId: id }),
}));

export function getActiveCompany(companies: Company[], activeCompanyId: string): Company | null {
  return companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? null;
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
