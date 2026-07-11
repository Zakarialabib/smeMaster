/**
 * RecentSettingsStore — Tracks recently visited settings tabs
 *
 * Stores the last N settings tab visits in memory (ephemeral per session).
 * Used by the PremiumSettingsPanel to show quick-access "recently visited" items.
 */
import { create } from "zustand";

export interface RecentSettingsEntry {
  id: string;
  label: string;
  visitedAt: number;
}

const MAX_RECENT = 5;

interface RecentSettingsState {
  recent: RecentSettingsEntry[];
  /** Add or bump a settings tab in the recent list */
  visit: (id: string, label: string) => void;
  /** Clear all recent entries */
  clear: () => void;
}

export const useRecentSettingsStore = create<RecentSettingsState>((set) => ({
  recent: [],

  visit: (id, label) =>
    set((state) => {
      const filtered = state.recent.filter((e) => e.id !== id);
      const entry: RecentSettingsEntry = {
        id,
        label,
        visitedAt: Date.now(),
      };
      return {
        recent: [entry, ...filtered].slice(0, MAX_RECENT),
      };
    }),

  clear: () => set({ recent: [] }),
}));
