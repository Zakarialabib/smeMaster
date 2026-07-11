import { create } from 'zustand';
import { getSetting, setSetting } from '@features/settings/db/settings';

export interface DashboardWidgetConfig {
  id: string;
  title: string;
  visible: boolean;
  order: number;
}

interface DashboardState {
  widgets: DashboardWidgetConfig[];
  loaded: boolean;
  loadPreferences: () => Promise<void>;
  savePreferences: () => Promise<void>;
  toggleWidget: (id: string) => Promise<void>;
  reorderWidgets: (from: number, to: number) => Promise<void>;
}

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'emailVolume', title: 'Email Volume', visible: true, order: 0 },
  { id: 'emailHeatmap', title: 'Email Heatmap', visible: true, order: 1 },
  { id: 'contactGrowth', title: 'Contact Growth', visible: true, order: 2 },
  { id: 'contacts', title: 'Contacts Stats', visible: true, order: 3 },
  { id: 'tasks', title: 'Task Summary', visible: true, order: 4 },
  { id: 'campaigns', title: 'Campaigns Overview', visible: true, order: 5 },
  { id: 'automation', title: 'Automation Rules', visible: true, order: 6 },
  { id: 'activity', title: 'Recent Activity', visible: true, order: 7 },
  { id: 'networkGraph', title: 'Entity Network', visible: true, order: 9 },
  { id: 'quick', title: 'Quick Actions', visible: true, order: 8 },
];

export const useDashboardStore = create<DashboardState>((set, get) => ({
  widgets: DEFAULT_WIDGETS,
  loaded: false,

  loadPreferences: async () => {
    try {
      const raw = await getSetting('dashboard_widgets');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.widgets && Array.isArray(parsed.widgets)) {
          set({ widgets: parsed.widgets, loaded: true });
          return;
        }
      }
    } catch {
      // Fall through to defaults
    }
    set({ loaded: true });
  },

  savePreferences: async () => {
    const { widgets } = get();
    await setSetting('dashboard_widgets', JSON.stringify({ widgets }));
  },

  toggleWidget: async (id: string) => {
    set((state) => ({
      widgets: state.widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)),
    }));
    await get().savePreferences();
  },

  reorderWidgets: async (from: number, to: number) => {
    set((state) => {
      const widgets = [...state.widgets];
      const [moved] = widgets.splice(from, 1);
      widgets.splice(to, 0, moved!);
      return { widgets: widgets.map((w, i) => ({ ...w, order: i })) };
    });
    await get().savePreferences();
  },
}));
