import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import { useLayoutStore } from "@shared/stores/layoutStore";
import { ALL_NAV_ITEMS } from "@shared/components/layout/shell/navConfig";
import type { SidebarNavItem } from "@shared/stores/layoutStore";
import { Button } from "@shared/components/ui/Button";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";

export default function SidebarNavEditor() {
  const sidebarNavConfig = useLayoutStore((s) => s.sidebarNavConfig);
  const setSidebarNavConfig = useLayoutStore((s) => s.setSidebarNavConfig);

  const items: SidebarNavItem[] = (() => {
    if (!sidebarNavConfig) return ALL_NAV_ITEMS.map((i) => ({ id: i.id, visible: true }));
    const savedIds = new Set(sidebarNavConfig.map((i) => i.id));
    const missing = ALL_NAV_ITEMS.filter((i) => !savedIds.has(i.id)).map((i) => ({ id: i.id, visible: true }));
    return [...sidebarNavConfig, ...missing];
  })();
  const navLookup = new Map(ALL_NAV_ITEMS.map((n) => [n.id, n]));

  const moveItem = (index: number, direction: -1 | 1) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    setSidebarNavConfig(next);
  };

  const toggleItem = (index: number) => {
    const next = [...items];
    const current = next[index];
    if (!current || current.id === "inbox") return;
    next[index] = { ...current, visible: !current.visible };
    setSidebarNavConfig(next);
  };

  const resetToDefaults = () => {
    setSidebarNavConfig(ALL_NAV_ITEMS.map((i) => ({ id: i.id, visible: true })));
  };

  const isDefault =
    !sidebarNavConfig ||
    (items.length === ALL_NAV_ITEMS.length &&
      items.every((item, i) => item.id === ALL_NAV_ITEMS[i]?.id && item.visible));

  const { t } = useTranslation();
  return (
    <SettingGroup title={t('settings.sidebar')}>
      <div className="space-y-1">
        {items.map((item, index) => {
          const nav = navLookup.get(item.id);
          if (!nav) return null;
          const Icon = nav.icon;
          const isInbox = item.id === "inbox";
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                item.visible ? "text-text-primary" : "text-text-tertiary"
              }`}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                title={t('common.moveUp')}
              >
                <ChevronUp size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                title={t('common.moveDown')}
              >
                <ChevronDown size={14} />
              </Button>
              <Icon size={16} className="shrink-0 ml-1" />
              <span className="flex-1 truncate">{t(nav.label)}</span>
              <button
                onClick={() => toggleItem(index)}
                disabled={isInbox}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                  isInbox
                    ? "bg-accent/40 cursor-not-allowed"
                    : item.visible
                      ? "bg-accent cursor-pointer"
                      : "bg-bg-tertiary cursor-pointer"
                }`}
                title={isInbox ? t('settings.inboxAlwaysVisible') : item.visible ? t('settings.hide') : t('settings.show')}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    item.visible ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
      {!isDefault && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetToDefaults}
          className="mt-2"
        >
          <RotateCcw size={12} />
          {t('settings.resetToDefaults')}
        </Button>
      )}
    </SettingGroup>
  );
}
