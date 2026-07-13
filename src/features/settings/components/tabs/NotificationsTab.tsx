import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { getSetting, setSetting } from "@features/settings/db/settings";
import { Button } from "@shared/components/ui/Button";
import { HelpCard } from "@features/settings/components/HelpCard";
import { SettingGroup, ToggleRow } from "@features/settings/components/SettingsHelpers";
import { SnoozePresetsEditor } from "@features/settings/components/SnoozePresetsEditor";


export default function NotificationsTab() {
  const { t } = useTranslation();
  const accounts = useAccountStore((s) => s.accounts);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [smartNotifications, setSmartNotifications] = useState(true);
  const [notifyCategories, setNotifyCategories] = useState<Set<string>>(() => new Set(["Primary"]));
  const [vipSenders, setVipSenders] = useState<{ email_address: string; display_name: string | null }[]>([]);
  const [newVipEmail, setNewVipEmail] = useState("");

  useEffect(() => {
    async function load() {
      const notif = await getSetting("notifications_enabled");
      setNotificationsEnabled(notif !== "false");
      const smartNotif = await getSetting("smart_notifications");
      setSmartNotifications(smartNotif !== "false");
      const notifCats = await getSetting("notify_categories");
      if (notifCats) {
        setNotifyCategories(new Set(notifCats.split(",").map((s) => s.trim()).filter(Boolean)));
      }
      try {
        const { getAllVipSenders } = await import("@features/settings/db/notificationVips");
        const activeId = accounts.find((a) => a.isActive)?.id;
        if (activeId) {
          const vips = await getAllVipSenders(activeId);
          setVipSenders(vips.map((v) => ({ email_address: v.email_address, display_name: v.display_name })));
        }
      } catch {
        // VIP table may not exist yet
      }
    }
    load();
  }, [accounts]);

  const handleNotificationsToggle = async () => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    await setSetting("notifications_enabled", newVal ? "true" : "false");
  };

  return (
    <>
      <SettingGroup title={t('settings.tabs.notifications')}>
        <ToggleRow
          label={t('settings.enableNotifications')}
          checked={notificationsEnabled}
          onToggle={handleNotificationsToggle}
        />
        <ToggleRow
          label={t('settings.smartNotifications')}
          description={t('settings.smartNotificationsDescription')}
          checked={smartNotifications}
          onToggle={async () => {
            const newVal = !smartNotifications;
            setSmartNotifications(newVal);
            await setSetting("smart_notifications", newVal ? "true" : "false");
          }}
        />
        {/* Education: Notifications */}
        <HelpCard
          items={[
            { type: "why", text: "Notifications keep you informed of important emails without needing to constantly check your inbox." },
            { type: "how", text: "Smart notifications analyze sender priority and email category to reduce noise. VIP senders always trigger alerts." },
            { type: "when", text: "Enable for time-sensitive communications. Use smart mode to filter out marketing and social notifications." },
          ]}
        />
      </SettingGroup>

      {smartNotifications && (
        <>
          <SettingGroup title={t('settings.categoryFilters')}>
            <div>
              <span className="text-sm text-text-secondary">{t('settings.notifyForCategories')}</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {(["Primary", "Updates", "Promotions", "Social", "Newsletters"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={async () => {
                      const next = new Set(notifyCategories);
                      if (next.has(cat)) next.delete(cat);
                      else next.add(cat);
                      setNotifyCategories(next);
                      await setSetting("notify_categories", [...next].join(","));
                    }}
                    className={`px-2.5 py-1 text-xs rounded-full transition-colors border ${
                      notifyCategories.has(cat)
                        ? "bg-accent/15 text-accent border-accent/30"
                        : "bg-bg-tertiary text-text-tertiary border-border-primary hover:text-text-primary"
                    }`}
                  >
                    {t(`categories.${cat.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>
          </SettingGroup>

          <SettingGroup title={t('settings.vipSenders')}>
            <p className="text-xs text-text-tertiary mb-2">
              {t('settings.vipDescription')}
            </p>
            <div className="space-y-1.5">
              {vipSenders.map((vip) => (
                <div key={vip.email_address} className="flex items-center justify-between py-1.5 px-3 bg-bg-secondary rounded-md">
                  <span className="text-xs text-text-primary truncate">
                    {vip.display_name ? `${vip.display_name} (${vip.email_address})` : vip.email_address}
                  </span>
                  <button
                    onClick={async () => {
                      const activeId = accounts.find((a) => a.isActive)?.id;
                      if (!activeId) return;
                      const { removeVipSender } = await import("@features/settings/db/notificationVips");
                      await removeVipSender(activeId, vip.email_address);
                      setVipSenders((prev) => prev.filter((v) => v.email_address !== vip.email_address));
                    }}
                    className="text-xs text-danger hover:text-danger/80 ms-2 shrink-0"
                  >
                    {t('common.remove')}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="email"
                value={newVipEmail}
                onChange={(e) => setNewVipEmail(e.target.value)}
                placeholder={t('settings.emailPlaceholder')}
                className="flex-1 px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded-md text-xs text-text-primary outline-none focus:border-accent"
                onKeyDown={async (e) => {
                  if (e.key !== "Enter" || !newVipEmail.trim()) return;
                  const activeId = accounts.find((a) => a.isActive)?.id;
                  if (!activeId) return;
                  const { addVipSender } = await import("@features/settings/db/notificationVips");
                  await addVipSender(activeId, newVipEmail.trim());
                  setVipSenders((prev) => [...prev, { email_address: newVipEmail.trim().toLowerCase(), display_name: null }]);
                  setNewVipEmail("");
                }}
              />
              <Button
                variant="primary"
                onClick={async () => {
                  if (!newVipEmail.trim()) return;
                  const activeId = accounts.find((a) => a.isActive)?.id;
                  if (!activeId) return;
                  const { addVipSender } = await import("@features/settings/db/notificationVips");
                  await addVipSender(activeId, newVipEmail.trim());
                  setVipSenders((prev) => [...prev, { email_address: newVipEmail.trim().toLowerCase(), display_name: null }]);
                  setNewVipEmail("");
                }}
                disabled={!newVipEmail.trim()}
              >
                {t('common.add')}
              </Button>
            </div>
          </SettingGroup>
        </>
      )}

      {/* -- Snooze Presets (merged from SnoozeTab) ------------------- */}
      <SettingGroup
        title="Snooze Presets"
        description="Configure preset snooze durations for delaying email visibility."
      >
        <HelpCard
          collapsible
          defaultOpen={false}
          items={[
            { type: "why", text: "Snooze lets you temporarily hide emails and bring them back at a more convenient time, reducing inbox overwhelm." },
            { type: "how", text: "Each preset defines a snooze duration (e.g., 1 hour, tomorrow, next week). Apply snooze from the email context menu or swipe action." },
            { type: "when", text: "Use for emails that need attention later but aren't urgent right now — ideal for batch processing and time management." },
          ]}
        />
        <div className="mt-4">
          <SnoozePresetsEditor />
        </div>
      </SettingGroup>
    </>
  );
}

