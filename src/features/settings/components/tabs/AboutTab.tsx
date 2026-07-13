import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Globe,
  Github,
  Mail,
  ExternalLink,
  Scale,
  RotateCcw,
  Sparkles,
  Shield,
  Zap,
  Layers,
  Server,
  Lock,
  Smartphone,
  GlobeLock,
  BellRing,
} from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { HelpCard } from "@features/settings/components/HelpCard";
import { resetOnboarding } from "@shared/services/settings/settingsService";
import { cn } from "@shared/utils/cn";
import appIcon from "@/assets/icon.png";

/* ─── Feature highlights ─── */

interface FeatureHighlight {
  icon: typeof Sparkles;
  label: string;
  description: string;
  tone: "accent" | "success" | "warning" | "info" | "neutral";
}

const FEATURES: FeatureHighlight[] = [
  {
    icon: Shield,
    label: "Email Suite",
    description: "Unified inbox, composing, campaigns, and warmup",
    tone: "accent",
  },
  {
    icon: Layers,
    label: "CRM & Contacts",
    description: "Full contact management with pipeline tracking",
    tone: "success",
  },
  {
    icon: Zap,
    label: "Task Automation",
    description: "Rule-based automation, schedule & trigger actions",
    tone: "warning",
  },
  {
    icon: Server,
    label: "Local RAG AI",
    description: "On-device AI for smart compose, search & generation",
    tone: "info",
  },
  {
    icon: Lock,
    label: "PGP Security",
    description: "End-to-end encryption with PGP key management",
    tone: "accent",
  },
  {
    icon: Smartphone,
    label: "Offline-First",
    description: "Full offline support with multi-device CRDT sync",
    tone: "success",
  },
  {
    icon: GlobeLock,
    label: "Morocco DGI",
    description: "DGI-compliant invoicing, POS & ERP module",
    tone: "info",
  },
  {
    icon: BellRing,
    label: "360° Dashboard",
    description: "Unified view of email, tasks, calendar, and CRM",
    tone: "warning",
  },
];

/* ─── Tech stack badge ─── */

function TechBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", color)}>
      {label}
    </span>
  );
}

/* ─── Link Row ─── */

function LinkRow({
  icon: Icon,
  label,
  sublabel,
  href,
}: {
  icon: typeof Globe;
  label: string;
  sublabel: string;
  href: string;
}) {
  const openExternal = async (url: string) => {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  };

  return (
    <button
      onClick={() => openExternal(href)}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-bg-secondary hover:bg-bg-hover hover:border-accent/20 transition-all text-start border border-transparent group"
    >
      <div className="p-2 rounded-lg bg-bg-primary border border-border/50 text-text-tertiary group-hover:text-accent transition-colors">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <p className="text-xs text-text-tertiary">{sublabel}</p>
      </div>
      <ExternalLink size={14} className="text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

/* ─── AboutTab ─── */

export default function AboutTab() {
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    import("@tauri-apps/api/app").then(({ getVersion }) =>
      getVersion().then(setAppVersion),
    );
  }, []);

  const { t } = useTranslation();

  return (
    <div className="space-y-4 md:space-y-6 max-w-3xl">
      {/* ── Hero Section ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 via-accent/5 to-bg-secondary p-6 md:p-8">
        {/* Background decoration */}
        <div className="absolute -top-12 -end-12 w-48 h-48 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -start-8 w-32 h-32 bg-accent/3 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex items-start gap-5">
          <div className="p-3 rounded-2xl bg-white/80 shadow-sm border border-border/50 shrink-0">
            <img src={appIcon} alt="SMEMaster" className="w-16 h-16" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">SMEMaster</h2>
            <p className="text-sm text-text-secondary mt-1 leading-relaxed max-w-lg">
              {t("settings.appDescription")}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[11px] font-bold">
                {appVersion ? `v${appVersion}` : "..."}
              </span>
              <span className="text-[10px] text-text-tertiary">|</span>
              <span className="text-[10px] text-text-tertiary">Apache 2.0 License</span>
            </div>
            {/* Tech stack badges */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              <TechBadge label="Tauri v2" color="bg-accent/10 text-accent border-accent/20" />
              <TechBadge label="React 19" color="bg-sky-500/10 text-sky-400 border-sky-500/20" />
              <TechBadge label="Rust" color="bg-orange-500/10 text-orange-400 border-orange-500/20" />
              <TechBadge label="SQLite" color="bg-blue-500/10 text-blue-400 border-blue-500/20" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Feature Highlights ─────────────────────────────────────── */}
      <SettingGroup
        title="Key Features"
        description="Everything you need to manage your business — offline-first, secure, and open source."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {FEATURES.map((feature) => (
            <div
              key={feature.label}
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border transition-all hover:shadow-sm",
                feature.tone === "accent" && "bg-accent/5 border-accent/20",
                feature.tone === "success" && "bg-success/5 border-success/20",
                feature.tone === "warning" && "bg-warning/5 border-warning/20",
                feature.tone === "info" && "bg-info/5 border-info/20",
                feature.tone === "neutral" && "bg-bg-tertiary/40 border-border/40",
              )}
            >
              <div className="p-2 rounded-lg bg-white/50">
                <feature.icon
                  className={cn(
                    "w-4 h-4",
                    feature.tone === "accent" && "text-accent",
                    feature.tone === "success" && "text-success",
                    feature.tone === "warning" && "text-warning",
                    feature.tone === "info" && "text-info",
                    feature.tone === "neutral" && "text-text-tertiary",
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">{feature.label}</p>
                <p className="text-xs text-text-tertiary mt-0.5">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </SettingGroup>

      {/* ── Links ──────────────────────────────────────────────────── */}
      <SettingGroup title={t("settings.links")}>
        <div className="space-y-1.5">
          <LinkRow
            icon={Globe}
            label={t("settings.website")}
            sublabel="smemaster.app"
            href="https://smemaster.app"
          />
          <LinkRow
            icon={Github}
            label={t("settings.githubRepo")}
            sublabel="Zakarialabib/smeMaster"
            href="https://github.com/Zakarialabib/smeMaster"
          />
          <LinkRow
            icon={Mail}
            label={t("settings.contact")}
            sublabel="info@smemaster.app"
            href="mailto:info@smemaster.app"
          />
        </div>
      </SettingGroup>

      {/* ── License ──────────────────────────────────────────────────── */}
      <SettingGroup title={t("settings.license")}>
        <div className="px-4 py-3 bg-bg-secondary rounded-xl border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Scale size={15} className="text-text-tertiary" />
            <span className="text-sm font-medium text-text-primary">{t("settings.apacheLicense")}</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed mb-3">
            {t("settings.licenseText")}{" "}
            <button
              onClick={async () => {
                const { openUrl } = await import("@tauri-apps/plugin-opener");
                await openUrl("https://www.apache.org/licenses/LICENSE-2.0");
              }}
              className="text-accent hover:text-accent-hover transition-colors"
            >
              apache.org/licenses/LICENSE-2.0
            </button>
          </p>
          <p className="text-xs text-text-tertiary leading-relaxed">
            {t("settings.copyrightText")}
          </p>
        </div>
      </SettingGroup>

      {/* ── Reset ────────────────────────────────────────────────────── */}
      <SettingGroup title="Reset">
        <div className="px-4 py-3 bg-bg-secondary rounded-xl border border-border/50">
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
    </div>
  );
}
