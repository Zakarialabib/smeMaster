import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, CheckCircle } from "lucide-react";
import { QrCode } from "@shared/components/ui/QrCode";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { HelpCard } from "@features/settings/components/HelpCard";
import { Button } from "@shared/components/ui/Button";
import { generateToken } from "@features/settings/services/pairing/pairingService";
import type { PairingToken } from "@features/settings/services/pairing/pairingService";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { UpgradeBanner } from "@shared/components/ui/UpgradeBadge";

export default function PairingSettings() {
  const { t } = useTranslation();
  const featureAccess = useFeatureFlagStore((s) => s.getFeatureAccess("pairing", 0));
  const isLocked = featureAccess === "locked";
  const [token, setToken] = useState<PairingToken | null>(null);
  const [qrData, setQrData] = useState<string>("");
  const [deviceName, setDeviceName] = useState("My Phone");
  const [countdown, setCountdown] = useState(0);
  const [pairedDevices] = useState<string[]>([]);

  const handleGenerate = useCallback(async () => {
    const t = await generateToken(deviceName || "My Phone");
    setToken(t);
    setQrData(JSON.stringify({ v: 1, t: t.token, d: deviceName }));
    setCountdown(300);
  }, [deviceName]);

  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { setToken(null); return 0; } return c - 1; });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  if (isLocked) {
    return (
      <SettingGroup title={t("settings.pairingTitle")}>
        <UpgradeBanner featureName={t("settings.pairingTitle")} />
      </SettingGroup>
    );
  }

  return (
    <SettingGroup title={t("settings.pairingTitle")}>
      <div className="flex flex-col gap-4">
        {/* Device name + generate */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder={t("settings.pairingDevicePlaceholder")}
            className="flex-1 px-3 py-1.5 rounded-md border border-border-primary bg-bg-tertiary text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
          />
          <Button variant="primary" size="sm" onClick={handleGenerate}>
            <RefreshCw size={14} />
            {t("settings.generate")}
          </Button>
        </div>

        {/* QR code */}
        {token && (
          <div className="flex flex-col items-center gap-3 p-5 bg-bg-secondary rounded-xl border border-border-primary">
            <QrCode data={qrData} size={180} />
            <p className="text-xs text-text-secondary">
              {t("settings.scanWithMobile")}
            </p>
            <p className="text-xs text-text-tertiary">
              {t("settings.expiresIn", { seconds: countdown })}
            </p>
          </div>
        )}

        {/* Paired devices list */}
        {pairedDevices.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border-primary/10">
            <h4 className="text-xs font-medium text-text-secondary">{t("settings.pairedDevices")}</h4>
            {pairedDevices.map((name) => (
              <div key={name} className="flex items-center gap-2 text-sm text-text-primary py-1">
                <CheckCircle size={14} className="text-success shrink-0" />
                <span>{name}</span>
              </div>
            ))}
          </div>
        )}

        <HelpCard
          items={[
            { type: "why", text: "Pairing lets you sync your email, calendar, and settings between desktop and mobile devices seamlessly — no manual setup needed on each device." },
            { type: "how", text: "Generate a QR code from this page, then scan it from the SME Master mobile app. The token is valid for 5 minutes and establishes an encrypted peer-to-peer link." },
            { type: "when", text: "Pair when setting up a new device, after reinstalling the app, or when you want to sync settings across devices for the first time." },
            { type: "tip", text: "Keep both devices on the same local network for the fastest pairing experience. The QR code can also be shared via a secure channel if not in the same room." },
          ]}
        />
      </div>
    </SettingGroup>
  );
}
