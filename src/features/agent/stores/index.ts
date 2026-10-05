import { create } from 'zustand';
import type { OpsAlert, ProviderHealth, AutomationRule } from '../types/commands';
import { invokeCommand } from '@shared/services/db/invoke/command';

/**
 * Store split for the agent console — one store per domain.
 *
 * Focus: agentic AI for email and social channel automation.
 * Voice/WhatsApp call system is dropped.
 */

// ── Ops ─────────────────────────────────────────────────────────────────────

interface OpsState {
  p1: OpsAlert[];
  p2Grouped: Record<string, OpsAlert[]>;
  p3Count: number;
  callCount: number;
  containedPct: number;
  providerHealth: ProviderHealth[];
  reachable: boolean;
  lastSeenAt: string | null;
  acknowledge: (id: string) => void;
  setSnapshot: (s: Partial<OpsState>) => void;
  setReachable: (v: boolean) => void;
}

const acknowledgeIn = <T extends { id: string; acknowledgedAt: string | null }>(
  list: T[],
  id: string,
  at: string,
): T[] =>
  list.map((a) => (a.id === id ? { ...a, acknowledgedAt: at, acknowledgedBy: 'operator' } : a));

export const useOpsStore = create<OpsState>((set) => ({
  p1: [],
  p2Grouped: {},
  p3Count: 0,
  callCount: 0,
  containedPct: 0,
  providerHealth: [],
  reachable: true,
  lastSeenAt: null,
  acknowledge: (id) =>
    set((s) => {
      const at = new Date().toISOString();
      return {
        p1: acknowledgeIn(s.p1, id, at),
        p2Grouped: Object.fromEntries(
          Object.entries(s.p2Grouped).map(([k, v]) => [k, acknowledgeIn(v, id, at)]),
        ),
      };
    }),
  setSnapshot: (patch) => set(patch),
  setReachable: (reachable) => set({ reachable }),
}));

export const useReachable = () => useOpsStore((s) => s.reachable);

/**
 * Badge count for the console nav. **P1 only.** Everything else waits for the
 * digest; a badge carrying P2 and P3 becomes noise.
 */
export const useUnacknowledgedP1 = (): number =>
  useOpsStore((s) => s.p1.filter((a) => !a.acknowledgedAt).length);

// ── Config ──────────────────────────────────────────────────────────────────

export type ConfigDraft = {
  hours: string;
  tz: string;
  transferTarget: string;
  afterHours: 'take_message' | 'transfer' | 'announce_only';
  tier: 'standard' | 'selfhosted' | 'premium';
  disclosureEnabled: boolean;
};

const CONFIG_DEFAULTS: ConfigDraft = {
  hours: 'Mon–Fri 09:00–18:00',
  tz: 'Europe/Paris',
  transferTarget: '',
  afterHours: 'take_message',
  tier: 'standard',
  disclosureEnabled: true,
};

interface ConfigState extends ConfigDraft {
  dirty: boolean;
  saving: boolean;
  set: <K extends keyof ConfigDraft>(k: K, v: ConfigDraft[K]) => void;
  save: () => Promise<void>;
  discard: () => void;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  ...CONFIG_DEFAULTS,
  dirty: false,
  saving: false,
  set: (k, v) => set({ [k]: v, dirty: true } as Partial<ConfigState>),
  save: async () => {
    set({ saving: true });
    try {
      const { tier } = get();
      await invokeCommand('agent_set_provider_tier', { tier });
      set({ dirty: false });
    } finally {
      set({ saving: false });
    }
  },
  discard: () => set({ ...CONFIG_DEFAULTS, dirty: false, saving: false }),
}));

// ── Automation ──────────────────────────────────────────────────────────────

interface AutomationState {
  rules: AutomationRule[];
  loading: boolean;
  toggle: (id: string) => Promise<void>;
  run: (id: string) => Promise<string>;
  refresh: () => Promise<void>;
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  rules: [],
  loading: false,
  toggle: async (id) => {
    try {
      await invokeCommand('agent_toggle_automation', { ruleId: id });
      await get().refresh();
    } catch (err) {
      console.error('Failed to toggle automation:', err);
    }
  },
  run: async (id) => {
    try {
      return await invokeCommand<string>('agent_run_automation', { ruleId: id });
    } catch (err) {
      console.error('Failed to run automation:', err);
      return 'Failed to run automation';
    }
  },
  refresh: async () => {
    set({ loading: true });
    try {
      const rules = await invokeCommand<AutomationRule[]>('agent_get_automations', {});
      set({ rules });
    } catch (err) {
      console.error('Failed to load automations:', err);
    } finally {
      set({ loading: false });
    }
  },
}));
