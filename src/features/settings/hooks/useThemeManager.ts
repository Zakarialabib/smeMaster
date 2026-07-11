import { useEffect } from "react";
import { useConfigStore } from "@/stores/core";
import { getThemeById } from "@/constants/themes";
import { i18n, LOCALE_DIRS } from "@/locales";
import type { SupportedLocale } from "@/locales";

/**
 * Hook: manages all theme-related side effects.
 *
 * Syncs the following to the <html> element:
 * - Dark/light/system theme class
 * - Font scale class
 * - Reduce-motion class
 * - Color theme CSS custom properties
 * - Text direction (LTR/RTL)
 * - i18n language change → locale store sync
 */
export function useThemeManager() {
  const theme = useConfigStore((s) => s.theme);
  const fontScale = useConfigStore((s) => s.fontScale);
  const colorTheme = useConfigStore((s) => s.colorTheme);
  const reduceMotion = useConfigStore((s) => s.reduceMotion);
  const highContrast = useConfigStore((s) => s.highContrast);
  const setLocale = useConfigStore((s) => s.setLocale);

  // Sync theme class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => {
        if (mq.matches) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      };
      apply();
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  // Sync font-scale class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("font-scale-small", "font-scale-default", "font-scale-large", "font-scale-xlarge");
    root.classList.add(`font-scale-${fontScale}`);
  }, [fontScale]);

  // Sync reduce-motion class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  // Sync high-contrast class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("high-contrast", highContrast);
  }, [highContrast]);

  // Apply color theme CSS custom properties to <html>
  useEffect(() => {
    const root = document.documentElement;
    const props = ["--color-accent", "--color-accent-hover", "--color-accent-light", "--color-bg-selected", "--color-sidebar-active"];

    const apply = () => {
      if (colorTheme === "indigo") {
        // Default theme — remove inline overrides, let CSS handle it
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

  // Subscribe to textDirection changes to update <html dir>
  useEffect(() => {
    const unsub = useConfigStore.subscribe((state, prev) => {
      if (state.textDirection !== prev.textDirection) {
        document.documentElement.dir = state.textDirection;
      }
    });
    return () => unsub();
  }, []);

  // Sync i18n language changes back to the Zustand store
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setLocale(lng as SupportedLocale);
      document.documentElement.dir = LOCALE_DIRS[lng as SupportedLocale] ?? "ltr";
    };
    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, [setLocale]);
}
