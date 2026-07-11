import { Send, Copy, Check, Star, Mail, ListChecks, Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";

export type QuickAction = "compose" | "copy" | "vip" | "email" | "task" | "campaign";

export interface ContactQuickActionsProps {
  /** Which actions to display. Defaults to ["compose", "copy", "vip"] */
  actions?: QuickAction[];
  /** Callbacks for each action */
  onCompose?: () => void;
  onCopy?: () => void;
  onToggleVip?: () => void;
  onEmail?: () => void;
  onTask?: () => void;
  onCampaign?: () => void;
  /** Whether the contact is currently VIP (controls star fill state) */
  isVip?: boolean;
  /** Show copy confirmation feedback */
  copyFeedback?: boolean;
  /** Orientation of the action buttons */
  orientation?: "horizontal" | "vertical";
  /** Size variant */
  size?: "sm" | "md";
}

export function ContactQuickActions({
  actions = ["compose", "copy", "vip"],
  onCompose,
  onCopy,
  onToggleVip,
  onEmail,
  onTask,
  onCampaign,
  isVip = false,
  copyFeedback = false,
  orientation = "horizontal",
  size = "md",
}: ContactQuickActionsProps) {
  const { t } = useTranslation();

  const btnClass =
    orientation === "horizontal"
      ? `flex items-center justify-center ${
          size === "sm" ? "p-1.5 gap-1 text-xs" : "p-2 gap-1.5 text-xs"
        } text-text-secondary hover:text-accent hover:bg-bg-hover rounded-lg transition-colors`
      : "flex items-center w-full gap-2 px-3 py-2 text-xs font-medium text-text-secondary hover:text-accent hover:bg-bg-hover rounded-lg transition-colors";

  const iconSize = size === "sm" ? 14 : 16;

  return (
    <div
      className={`flex ${
        orientation === "horizontal"
          ? "items-center justify-center gap-2"
          : "flex-col gap-1"
      } ${orientation === "horizontal" ? "mb-4" : "mb-3"}`}
    >
      {actions.includes("compose") && onCompose && (
        <button
          onClick={onCompose}
          title={t("contact.sendEmail")}
          className={btnClass}
        >
          <Send size={iconSize} />
          {orientation === "vertical" && <span>Email</span>}
        </button>
      )}

      {actions.includes("copy") && onCopy && (
        <button
          onClick={onCopy}
          title={copyFeedback ? t("common.copied") : t("contact.copyEmail")}
          className={btnClass}
        >
          {copyFeedback ? (
            <Check size={iconSize} className="text-success" />
          ) : (
            <Copy size={iconSize} />
          )}
          {orientation === "vertical" && (
            <span>{copyFeedback ? "Copied!" : "Copy"}</span>
          )}
        </button>
      )}

      {actions.includes("vip") && onToggleVip && (
        <button
          onClick={onToggleVip}
          title={isVip ? t("contact.removeVip") : t("contact.markAsVip")}
          className={`${btnClass} ${isVip ? "text-warning hover:text-warning/80" : ""}`}
        >
          <Star size={iconSize} fill={isVip ? "currentColor" : "none"} />
          {orientation === "vertical" && (
            <span>{isVip ? "Unstar" : "VIP"}</span>
          )}
        </button>
      )}

      {actions.includes("email") && onEmail && (
        <button onClick={onEmail} title="Compose email" className={btnClass}>
          <Mail size={iconSize} />
          {orientation === "vertical" && <span>Email</span>}
        </button>
      )}

      {actions.includes("task") && onTask && (
        <button onClick={onTask} title="Create task" className={btnClass}>
          <ListChecks size={iconSize} />
          {orientation === "vertical" && <span>Task</span>}
        </button>
      )}

      {actions.includes("campaign") && onCampaign && (
        <button onClick={onCampaign} title="Add to campaign" className={btnClass}>
          <Megaphone size={iconSize} />
          {orientation === "vertical" && <span>Campaign</span>}
        </button>
      )}
    </div>
  );
}
