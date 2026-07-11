import { create } from "zustand";
import { createAsyncActions, initialAsyncState } from "@shared/stores/createAsyncStore";
import {
  checkDomainHealth,
  getRemediation,
  runSentinelCheck,
} from "@features/deliverability/services/domainHealthService";
import type {
  DomainHealth,
  RemediationNode,
  SentinelAlert,
} from "@features/deliverability/services/domainHealthService";

interface DomainHealthState {
  healthScores: Record<string, DomainHealth>;
  currentDomain: string | null;
  remediation: RemediationNode[];
  alerts: SentinelAlert[];
  isLoading: boolean;
  checkDomain: (domain: string, sendingIp?: string) => Promise<void>;
  getRemediationForDomain: (domain: string, failures: string[]) => Promise<void>;
  runSentinel: (domain: string, previousScore: number) => Promise<void>;
  setCurrentDomain: (domain: string | null) => void;
}

export const useDomainHealthStore = create<DomainHealthState>((set) => {
  const { withLoading } = createAsyncActions(set);

  return {
    healthScores: {},
    currentDomain: null,
    remediation: [],
    alerts: [],
    ...initialAsyncState,

    checkDomain: async (domain, sendingIp) => {
      await withLoading(async () => {
        const health = await checkDomainHealth(domain, sendingIp);
        set((state) => ({
          healthScores: { ...state.healthScores, [domain]: health },
          currentDomain: domain,
        }));
      });
    },

    getRemediationForDomain: async (domain, failures) => {
      const result = await getRemediation(domain, failures as any);
      set({ remediation: result });
    },

    runSentinel: async (domain, previousScore) => {
      const alerts = await runSentinelCheck(domain, previousScore);
      set((state) => ({ alerts: [...state.alerts, ...alerts] }));
    },

    setCurrentDomain: (domain) => set({ currentDomain: domain }),
  };
});
