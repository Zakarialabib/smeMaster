import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { Toggle } from "@shared/components/ui/Toggle";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BundleSettings() {
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = accounts.find((a) => a.isActive)?.id;
  const [rules, setRules] = useState<Record<string, { bundled: boolean; delivery: boolean; days: number[]; hour: number; minute: number }>>({});

  useEffect(() => {
    if (!activeAccountId) return;
    import("@features/deliverability/db/bundleRules").then(async ({ getBundleRules }) => {
      const dbRules = await getBundleRules(activeAccountId);
      const map: typeof rules = {};
      for (const r of dbRules) {
        let schedule = { days: [6], hour: 9, minute: 0 };
        try {
          if (r.delivery_schedule) schedule = JSON.parse(r.delivery_schedule);
        } catch { /* use defaults */ }
        map[r.category] = {
          bundled: r.is_bundled === 1,
          delivery: r.delivery_enabled === 1,
          days: schedule.days,
          hour: schedule.hour,
          minute: schedule.minute,
        };
      }
      setRules(map);
    });
  }, [activeAccountId]);

  const saveRule = async (category: string, update: Partial<typeof rules[string]>) => {
    if (!activeAccountId) return;
    const current = rules[category] ?? { bundled: false, delivery: false, days: [6], hour: 9, minute: 0 };
    const merged = { ...current, ...update };
    setRules((prev) => ({ ...prev, [category]: merged }));
    const { setBundleRule } = await import("@features/deliverability/db/bundleRules");
    await setBundleRule(
      activeAccountId,
      category,
      merged.bundled,
      merged.delivery,
      merged.delivery ? { days: merged.days, hour: merged.hour, minute: merged.minute } : null,
    );
  };

  const { t } = useTranslation();
  return (
    <SettingGroup title={t("settings.bundleDelivery")}>
      {(["Newsletters", "Promotions", "Social", "Updates"] as const).map((cat) => {
        const rule = rules[cat];
        return (
          <div key={cat} className="py-3 px-4 bg-bg-secondary rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">{t(`categories.${cat.toLowerCase()}`)}</span>
              <div className="flex items-center gap-3">
                <Toggle
                  checked={rule?.bundled ?? false}
                  onChange={() => saveRule(cat, { bundled: !(rule?.bundled ?? false) })}
                  label={t("settings.bundle")}
                  size="sm"
                />
                <Toggle
                  checked={rule?.delivery ?? false}
                  onChange={() => saveRule(cat, { delivery: !(rule?.delivery ?? false) })}
                  label={t("settings.schedule")}
                  size="sm"
                />
              </div>
            </div>
            {rule?.delivery && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-1">
                  {DAY_NAMES.map((name, idx) => (
                    <button
                      key={name}
                      onClick={() => {
                        const days = rule.days.includes(idx)
                          ? rule.days.filter((d) => d !== idx)
                          : [...rule.days, idx].sort();
                        saveRule(cat, { days });
                      }}
                      className={`w-8 h-7 text-[0.625rem] rounded transition-colors ${
                        rule.days.includes(idx)
                          ? "bg-accent text-white"
                          : "bg-bg-tertiary text-text-tertiary border border-border-primary"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary">{t("settings.at")}</span>
                  <input
                    type="time"
                    value={`${String(rule.hour).padStart(2, "0")}:${String(rule.minute).padStart(2, "0")}`}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      saveRule(cat, { hour: h ?? 9, minute: m ?? 0 });
                    }}
                    className="bg-[var(--bg-surface-2)] text-[var(--text-primary)] text-xs px-2 py-1 rounded-[var(--radius-md)] border border-[var(--text-secondary)]/20"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </SettingGroup>
  );
}
