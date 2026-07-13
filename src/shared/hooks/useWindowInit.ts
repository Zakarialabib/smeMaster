import { useEffect, useState } from "react";
import { useThemeStore } from "@/shared/stores/themeStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { getAllAccounts } from "@features/accounts";
import { getSetting } from "@features/settings";
import { initializeClients } from "@features/mail/services/gmail/tokenManager";
import { getThemeById, COLOR_THEMES } from "@/constants/themes";
import type { ColorThemeId } from "@/constants/themes";

export interface WindowInitResult {
  loading: boolean;
  error: string | null;
}

export function useWindowInit(options?: { skipClients?: boolean }): WindowInitResult {
  const { setTheme, setFontScale, setColorTheme } = useThemeStore();
  const { setAccounts } = useAccountStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        // Restore theme
        const savedTheme = await getSetting("theme");
        if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
          setTheme(savedTheme);
        }

        // Restore font scale
        const savedFontScale = await getSetting("font_size");
        if (savedFontScale === "small" || savedFontScale === "default" || savedFontScale === "large" || savedFontScale === "xlarge") {
          setFontScale(savedFontScale);
        }

        // Restore color theme
        const savedColorTheme = await getSetting("color_theme");
        if (savedColorTheme && COLOR_THEMES.some((t) => t.id === savedColorTheme)) {
          setColorTheme(savedColorTheme as ColorThemeId);
        }

        // Load accounts into store
        const dbAccounts = await getAllAccounts();
        const mapped = dbAccounts.map((a) => ({
          id: a.id,
          email: a.email,
          displayName: a.display_name,
          company: null,
          avatarUrl: a.avatar_url,
          isActive: a.is_active === 1,
          provider: a.provider,
        }));
        setAccounts(mapped);

        // Initialize Gmail clients (can be skipped for thread window)
        if (!options?.skipClients) {
          await initializeClients();
        }
      } catch (err) {
        console.error("Failed to initialize window:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Theme-sync effects (identical in ThreadWindow and ComposerWindow) ──────────

  // Sync theme class to <html>
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => {
        if (mq.matches) root.classList.add("dark");
        else root.classList.remove("dark");
      };
      apply();
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  // Sync font-scale class to <html>
  const fontScale = useThemeStore((s) => s.fontScale);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("font-scale-small", "font-scale-default", "font-scale-large", "font-scale-xlarge");
    root.classList.add(`font-scale-${fontScale}`);
  }, [fontScale]);

  // Apply color theme CSS custom properties to <html>
  const colorTheme = useThemeStore((s) => s.colorTheme);
  useEffect(() => {
    const root = document.documentElement;
    const props = ["--color-accent", "--color-accent-hover", "--color-accent-light", "--color-bg-selected", "--color-sidebar-active"];

    const apply = () => {
      if (colorTheme === "indigo") {
        for (const p of props) root.style.removeProperty(p);
        return;
      }
      const themeData = getThemeById(colorTheme);
      const isDark =
        theme === "dark" ||
        (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      const colors = isDark ? themeData.dark : themeData.light;
      root.style.setProperty("--color-accent", colors.accent);
      root.style.setProperty("--color-accent-hover", colors.accentHover);
      root.style.setProperty("--color-accent-light", colors.accentLight);
      root.style.setProperty("--color-bg-selected", colors.bgSelected);
      root.style.setProperty("--color-sidebar-active", colors.sidebarActive);
    };

    apply();

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [colorTheme, theme]);

  // Sync surface layer (flat | glass) to <html> for CSS gating
  const surface = useThemeStore((s) => s.surface);
  useEffect(() => {
    document.documentElement.setAttribute("data-surface", surface);
  }, [surface]);

  // Sync UI density (compact | normal | relaxed) to <html>
  const density = useThemeStore((s) => s.density);
  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  return { loading, error };
}
