import { useEffect } from "react";
import { useConfigStore } from "@/stores/core";
import { getSetting } from "@features/settings/db/settings";
import { changeLanguage, SUPPORTED_LOCALES } from "@/locales";
import type { SupportedLocale } from "@/locales";

/**
 * Phase 2: Restore the persisted locale setting and apply it to i18n.
 *
 * Reads the "locale" setting from the settings table, calls
 * `changeLanguage()` to apply it, and persists the result to the
 * config store so the rest of the app can read `locale` and
 * `textDirection` synchronously.
 */
export function useI18nLocale(): void {
  useEffect(() => {
    let cancelled = false;

    async function initLocale() {
      try {
        const savedLocale = await getSetting("locale");
        if (cancelled || !savedLocale) return;
        if (SUPPORTED_LOCALES.includes(savedLocale as SupportedLocale)) {
          const locale = savedLocale as SupportedLocale;
          await changeLanguage(locale);
          useConfigStore.getState().setLocale(locale);
        }
      } catch (err) {
        // Outside a Tauri shell there is no settings table to read the
        // persisted locale from — fall back to the i18n default (en).
        if (typeof err === "object" && err !== null && "isTauriUnavailable" in err) {
          return;
        }
        console.warn("[init] Failed to restore locale:", err);
      }
    }

    initLocale();

    return () => {
      cancelled = true;
    };
  }, []);
}