import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CARD_BASE,
  SPACE_SECTION,
  SETTING_DESCRIPTION,
} from "@shared/styles/ui-tokens";
import { Toggle } from "@shared/components/ui/Toggle";

/* ─── Layout Helpers ─── */

/**
 * SettingGroup — Card-based container for related settings.
 *
 * Design:
 * - Card: bg-bg-secondary, rounded-xl, border border-border-primary, p-5 (or p-6 on spacious)
 * - Title: text-base font-semibold with optional text-xs description
 * - Sparse protection: min-h-[100px] ensures tiny sections don't look empty
 * - Card hover: subtle border/glow on hover
 */
export function SettingGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`${CARD_BASE} min-h-[100px] transition-all duration-200 ${SPACE_SECTION}`}
    >
      <h3 className="text-base font-semibold text-text-primary mb-2 leading-snug">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-text-tertiary mb-4 leading-relaxed">
          {description}
        </p>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/** @deprecated Use SettingGroup instead */
export const Section = SettingGroup;

/**
 * SettingRow — Label + control in a horizontal flex row.
 *
 * Features:
 * - min-h-[44px] for comfortable touch targets
 * - Subtle border-bottom separators
 * - Hover highlight for scanability
 */
export function SettingRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 first:pt-1 gap-4 min-h-[44px] rounded-lg px-3 -mx-3 transition-colors hover:bg-bg-hover/50 border-b border-border-primary/15 last:border-b-0">
      <label className="text-sm font-medium text-text-primary shrink-0">
        {label}
      </label>
      {children}
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 first:pt-0 border-b border-border-primary/10 last:border-b-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary font-mono">{value}</span>
    </div>
  );
}

export function FormField({
  label,
  description,
  children,
  htmlFor,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5 py-2.5 first:pt-0 border-b border-border-primary/10 last:border-b-0">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text-primary">
        {label}
      </label>
      {description && <p className={SETTING_DESCRIPTION}>{description}</p>}
      {children}
    </div>
  );
}

/* ─── Toggle Switch ─── */

/** @deprecated Use `Toggle` from `@shared/components/ui/Toggle` directly. */
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Toggle
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      size="sm"
    />
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 gap-4 min-h-[44px] rounded-lg px-3 -mx-3 transition-colors hover:bg-bg-hover/50 border-b border-border-primary/15 last:border-b-0 cursor-pointer">
      <div className="min-w-0 flex-1 pr-2">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        {description && (
          <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <Toggle checked={checked} onChange={onToggle} size="sm" />
    </div>
  );
}

/* ─── Button Group (segmented control) ─── */

interface ButtonGroupOption<T> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface ButtonGroupProps<T> {
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}

export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
}: ButtonGroupProps<T>) {
  const sizeClasses =
    size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs";
  return (
    <div
      className="inline-flex rounded-lg border border-border-primary overflow-hidden"
      role="radiogroup"
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={`
              ${sizeClasses} font-medium transition-all flex items-center gap-1.5
              ${
                isActive
                  ? "bg-accent text-white shadow-sm"
                  : "bg-transparent text-text-secondary hover:bg-bg-hover active:bg-bg-tertiary"
              }
              focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1
            `}
          >
            {Icon && <Icon size={size === "md" ? 16 : 14} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Choice Cards ─── */

interface ChoiceCardOption<T> {
  value: T;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface ChoiceCardsProps<T> {
  options: ChoiceCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
}: ChoiceCardsProps<T>) {
  return (
    <div className="grid grid-cols-3 gap-3 min-w-[200px]">
      {options.map((opt) => {
        const isActive = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`
              flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all
              ${
                isActive
                  ? "border-accent bg-accent/5 ring-2 ring-accent/20 shadow-sm"
                  : "border-border-primary bg-bg-primary/50 hover:border-accent/40 hover:bg-accent/[0.02] hover:shadow-sm"
              }
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
            `}
          >
            <Icon
              size={24}
              className={`${isActive ? "text-accent" : "text-text-tertiary"}`}
            />
            <span className="text-xs font-semibold text-text-primary">
              {opt.label}
            </span>
            <span className="text-[10px] text-text-tertiary text-center leading-relaxed">
              {opt.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
