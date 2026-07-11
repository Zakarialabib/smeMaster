import { create } from "zustand";

interface FocusModeState {
  /** Whether focus mode is active. */
  focusMode: boolean;
  /** Enter focus mode — hides sidebars and chrome. */
  enterFocusMode: () => void;
  /** Exit focus mode — restores sidebars and chrome. */
  exitFocusMode: () => void;
  /** Toggle focus mode on/off. */
  toggleFocusMode: () => void;
}

export const useFocusModeStore = create<FocusModeState>((set) => ({
  focusMode: false,

  enterFocusMode: () => set({ focusMode: true }),

  exitFocusMode: () => set({ focusMode: false }),

  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
}));
