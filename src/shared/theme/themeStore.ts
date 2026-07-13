/**
 * Unified Theme Store — SMEMaster instance.
 *
 * Persists in two places:
 *   1. localStorage via Zustand `persist` (instant hydration, no FOUC)
 *   2. Backend DB (cross-window sync, survives localStorage wipe)
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { invoke } from "@shared/services/commands";
import type { ColorThemeId } from "@/constants/themes";
import { tauriStoreStorage } from "@shared/services/storage/tauriStoreStorage";
import { useConfigStore } from "@/stores/core";
export type { ColorThemeId } from "@/constants/themes";

export interface ThemePreference {
  mode: ThemeMode;
  colorTheme: ColorThemeId;
  fontScale: FontScale;
  reduceMotion: boolean;
  highContrast: boolean;
  /** Surface style: "flat" (default, calm) or "glass" (Frosted Glass orbs + blur). */
  surface: SurfaceStyle;
}

/** Visual surface style. */
export type SurfaceStyle = "flat" | "glass";

export type ThemeMode = "light" | "dark" | "system";
export type FontScale = "small" | "default" | "large" | "xlarge";

const DEFAULT_MODE: ThemeMode = "system";
const DEFAULT_COLOR: ColorThemeId = "indigo";
const DEFAULT_SCALE: FontScale = "default";
const DEFAULT_SURFACE: SurfaceStyle = "flat";

interface ThemeState {
  mode: ThemeMode;
  colorTheme: ColorThemeId;
  fontScale: FontScale;
  reduceMotion: boolean;
  highContrast: boolean;
  isSynced: boolean;
  /** @deprecated Use `mode` instead */
  theme: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** @deprecated Use `setMode` instead */
  setTheme: (mode: ThemeMode) => void;
  setColorTheme: (id: ColorThemeId) => void;
  setFontScale: (scale: FontScale) => void;
  setReduceMotion: (reduce: boolean) => void;
  setHighContrast: (highContrast: boolean) => void;
  surface: SurfaceStyle;
  setSurface: (surface: SurfaceStyle) => void;
  syncFromBackend: () => Promise<void>;
  persistToBackend: () => Promise<void>;
  /** @internal Syncs current theme state to useConfigStore for ThemeManager */
  _syncConfig: () => void;
}

const sanitize = (
  raw: Partial<ThemePreference> | undefined
): ThemePreference => ({
  mode:
    raw?.mode === "light" ||
    raw?.mode === "dark" ||
    raw?.mode === "system"
      ? raw!.mode
      : DEFAULT_MODE,
  colorTheme:
    (raw?.colorTheme as ColorThemeId) ?? DEFAULT_COLOR,
  fontScale:
    raw?.fontScale === "small" ||
    raw?.fontScale === "large" ||
    raw?.fontScale === "xlarge"
      ? raw!.fontScale
      : DEFAULT_SCALE,
  reduceMotion: typeof raw?.reduceMotion === "boolean" ? raw!.reduceMotion : false,
  highContrast: typeof raw?.highContrast === "boolean" ? raw!.highContrast : false,
  surface: raw?.surface === "glass" || raw?.surface === "flat" ? raw!.surface : DEFAULT_SURFACE,
});

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: DEFAULT_MODE,
      colorTheme: DEFAULT_COLOR,
      fontScale: DEFAULT_SCALE,
      reduceMotion: false,
      highContrast: false,
      surface: DEFAULT_SURFACE,
      isSynced: false,
      theme: DEFAULT_MODE,

      /** Sync this store to useConfigStore so useThemeManager can apply changes. */
      _syncConfig: () => {
        const s = get();
        useConfigStore.getState().setTheme(s.mode as ThemeMode);
        useConfigStore.getState().setColorTheme(s.colorTheme);
        useConfigStore.getState().setFontScale(s.fontScale);
        useConfigStore.getState().setReduceMotion(s.reduceMotion);
        useConfigStore.getState().setHighContrast(s.highContrast);
      },

      setMode: (mode) => {
        set({ mode, theme: mode });
        get()._syncConfig();
        void get().persistToBackend();
      },
      setTheme: (mode) => {
        set({ mode, theme: mode });
        get()._syncConfig();
        void get().persistToBackend();
      },
      setColorTheme: (colorTheme) => {
        set({ colorTheme });
        get()._syncConfig();
        void get().persistToBackend();
      },
      setFontScale: (fontScale) => {
        set({ fontScale });
        get()._syncConfig();
        void get().persistToBackend();
      },
      setReduceMotion: (reduceMotion) => {
        set({ reduceMotion });
        get()._syncConfig();
        void get().persistToBackend();
      },
      setHighContrast: (highContrast) => {
        set({ highContrast });
        get()._syncConfig();
        void get().persistToBackend();
      },

      setSurface: (surface) => {
        set({ surface });
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-surface", surface);
        }
        void get().persistToBackend();
      },

      syncFromBackend: async () => {
        try {
          const raw = (await invoke("db_get_theme_preference")) as unknown as
            | Partial<ThemePreference>
            | undefined;
          if (raw) {
            const incoming = sanitize(raw);
            set({
              mode: incoming.mode as ThemeMode,
              colorTheme: incoming.colorTheme as ColorThemeId,
              fontScale: incoming.fontScale as FontScale,
              reduceMotion: incoming.reduceMotion,
              isSynced: true,
            });
          } else {
            set({ isSynced: true });
            await get().persistToBackend();
          }
        } catch {
          set({ isSynced: true });
        }
      },

      persistToBackend: async () => {
        const { mode, colorTheme, fontScale, reduceMotion, surface } = get();
        try {
          await invoke("db_set_theme_preference", {
            preference: { mode, colorTheme, fontScale, reduceMotion, surface },
          });
        } catch {
          // fire-and-forget
        }
      },
    }),
    {
      name: "smemaster.theme.preference",
      version: 3,
      storage: createJSONStorage(() => tauriStoreStorage),
      partialize: (s) => ({
        mode: s.mode,
        colorTheme: s.colorTheme,
        fontScale: s.fontScale,
        reduceMotion: s.reduceMotion,
        surface: s.surface,
      }),
      merge: (persisted: unknown, current) => {
        const incoming = sanitize(persisted as Partial<ThemePreference>);
        return { ...current, ...incoming, theme: incoming.mode ?? current.mode };
      },
    }
  )
);
