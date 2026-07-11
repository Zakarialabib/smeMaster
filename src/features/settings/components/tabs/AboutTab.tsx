import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Github, Mail, ExternalLink, Scale, RotateCcw } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { HelpCard } from "@features/settings/components/HelpCard";
import { resetOnboarding } from "@shared/services/settings/settingsService";
import appIcon from "@/assets/icon.png";

export default function AboutTab() {
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    import("@tauri-apps/api/app").then(({ getVersion }) =>
      getVersion().then(setAppVersion),
    );
  }, []);

  const openExternal = async (url: string) => {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  };

  const { t } = useTranslation();
  return (
    <>
      <SettingGroup title={t('settings.appName')}>
        <div className="flex items-center gap-3 mb-2">
          <img src={appIcon} alt="SMEMaster" className="w-12 h-12 rounded-xl" />
          <div>
            <h3 className="text-base font-semibold text-text-primary">SMEMaster</h3>
            <p className="text-sm text-text-tertiary">
              {appVersion ? t('settings.versionLabel', { version: appVersion }) : t('common.loading')}
            </p>
          </div>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          {t('settings.appDescription')}
        </p>
      </SettingGroup>

      <SettingGroup title={t('settings.links')}>
        <div className="space-y-1">
          <button
            onClick={() => openExternal("https://smemaster.app")}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg bg-bg-secondary hover:bg-bg-hover transition-colors text-left"
          >
            <Globe size={16} className="text-text-tertiary shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-sm text-text-primary">{t('settings.website')}</span>
              <p className="text-xs text-text-tertiary">smemaster.app</p>
            </div>
            <ExternalLink size={14} className="text-text-tertiary shrink-0" />
          </button>

          <button
            onClick={() => openExternal("https://github.com/Zakarialabib/smeMaster")}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg bg-bg-secondary hover:bg-bg-hover transition-colors text-left"
          >
            <Github size={16} className="text-text-tertiary shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-sm text-text-primary">{t('settings.githubRepo')}</span>
              <p className="text-xs text-text-tertiary">Zakarialabib/smeMaster</p>
            </div>
            <ExternalLink size={14} className="text-text-tertiary shrink-0" />
          </button>

          <button
            onClick={() => openExternal("mailto:info@smemaster.app")}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg bg-bg-secondary hover:bg-bg-hover transition-colors text-left"
          >
            <Mail size={16} className="text-text-tertiary shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-sm text-text-primary">{t('settings.contact')}</span>
              <p className="text-xs text-text-tertiary">info@smemaster.app</p>
            </div>
            <ExternalLink size={14} className="text-text-tertiary shrink-0" />
          </button>
        </div>
      </SettingGroup>

      <SettingGroup title={t('settings.license')}>
        <div className="px-4 py-3 bg-bg-secondary rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Scale size={15} className="text-text-tertiary" />
            <span className="text-sm font-medium text-text-primary">{t('settings.apacheLicense')}</span>
          </div>
          <p className="text-xs text-secondary leading-relaxed mb-3">
            {t('settings.licenseText')}{" "}
            <button
              onClick={() => openExternal("https://www.apache.org/licenses/LICENSE-2.0")}
              className="text-accent hover:text-accent-hover transition-colors"
            >
              apache.org/licenses/LICENSE-2.0
            </button>
          </p>
          <p className="text-xs text-text-tertiary leading-relaxed">
            {t('settings.copyrightText')}
          </p>
        </div>
      </SettingGroup>

      <SettingGroup title="Reset">
        <div className="px-4 py-3 bg-bg-secondary rounded-lg">
          <p className="text-xs text-text-tertiary mb-3">
            Reset the onboarding wizard to show the introduction screens again on next launch.
          </p>
          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCcw size={14} />}
            onClick={() => resetOnboarding()}
          >
            Reset Onboarding
          </Button>
        </div>
        <HelpCard
          items={[
            { type: "why", text: "The About section gives you version info, license details, and access to project resources — useful for troubleshooting, compliance, and staying updated." },
            { type: "how", text: "Version information is read from the app bundle. License info links to the open-source Apache 2.0 license. Reset onboarding clears the 'seen' flag so the intro screens reappear." },
            { type: "when", text: "Check the About page when reporting bugs (include version), reviewing license terms, or wanting to re-experience the onboarding tutorial." },
          ]}
        />
      </SettingGroup>
    </>
  );
}
