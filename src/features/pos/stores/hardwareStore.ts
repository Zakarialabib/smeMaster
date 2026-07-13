import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tauriStoreStorage } from '@shared/services/storage/tauriStoreStorage';

export type DeviceType = 'printer' | 'scanner' | 'scale' | 'cash_drawer';
export type ConnectionType = 'usb' | 'network' | 'serial' | 'hid' | 'system';

export interface HardwareConfig {
  id: string;
  companyId: string;
  name: string;
  deviceType: DeviceType;
  driverType: string;
  connectionType: ConnectionType;
  connectionParams: Record<string, any>;
  isDefault: boolean;
}

interface HardwareState {
  configs: HardwareConfig[];
  setConfigs: (configs: HardwareConfig[]) => void;
  addConfig: (config: HardwareConfig) => void;
  removeConfig: (id: string) => void;
  updateConfig: (id: string, updates: Partial<HardwareConfig>) => void;
}

export const useHardwareStore = create<HardwareState>()(
  persist(
    (set) => ({
      configs: [],
      setConfigs: (configs) => set({ configs }),
      addConfig: (config) => set((state) => ({ configs: [...state.configs, config] })),
      removeConfig: (id) => set((state) => ({
        configs: state.configs.filter((c) => c.id !== id),
      })),
      updateConfig: (id, updates) => set((state) => ({
        configs: state.configs.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      })),
    }),
    {
      name: 'smemaster-hardware-configs',
      storage: createJSONStorage(() => tauriStoreStorage),
    }
  )
);
