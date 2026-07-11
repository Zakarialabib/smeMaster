import { create } from "zustand";
import { getSetting, setSetting } from "@features/settings/db/settings";

interface SettingsUiState {
  advancedMode: boolean;
  setAdvancedMode: (val: boolean) => void;
  /** Load from DB and initialize */
  init: () => Promise<void>;
}

export const useSettingsUiStore = create<SettingsUiState>((set) => ({
  advancedMode: false,
  setAdvancedMode: (val) => {
    set({ advancedMode: val });
    // Also persist to DB
    setSetting("advanced_settings_mode", val ? "true" : "false");
  },
  init: async () => {
    try {
      const val = await getSetting("advanced_settings_mode");
      set({ advancedMode: val === "true" });
    } catch {
      // DB setting unavailable — stay in simple mode
      set({ advancedMode: false });
    }
  },
}));
