import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, LOCALE_NAMES, changeLanguage } from "@/locales";
import type { SupportedLocale } from "@/locales";
import { useLayoutStore } from "@shared/stores/layoutStore";
import { saveLocale } from "@shared/services/i18nService";

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const locale = useLayoutStore((s) => s.locale);
  const setLocale = useLayoutStore((s) => s.setLocale);

  return (
    <div className="flex items-center justify-between py-2.5 first:pt-0 gap-4 min-h-[36px] rounded-lg px-3 -mx-3 transition-colors hover:bg-bg-hover/40">
      <div>
        <span className="text-sm text-text-secondary">{t("settings.language")}</span>
        <p className="text-xs text-text-tertiary mt-0.5">
          {t("settings.languageDescription")}
        </p>
      </div>
      <select
        value={locale}
        onChange={(e) => {
          const val = e.target.value as SupportedLocale;
          changeLanguage(val);
          setLocale(val);
          saveLocale(val);
        }}
        className="w-48 px-3.5 py-2 rounded-lg border border-border-primary bg-bg-secondary text-text-primary text-sm focus:ring-1 focus:ring-accent/30 focus:outline-none transition-colors"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
