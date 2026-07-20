import { memo, type ReactNode } from "react";
import { BADGE_BASE, BADGE_ACCENT, BADGE_SUCCESS, BADGE_WARNING, BADGE_DANGER, BADGE_AI } from "@shared/styles/ui-tokens";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "ai";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "",
  success: BADGE_SUCCESS,
  warning: BADGE_WARNING,
  danger: BADGE_DANGER,
  info: BADGE_ACCENT,
  ai: BADGE_AI,
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "text-xs",
};

const Badge = memo(function Badge({
  children,
  variant = "default",
  size = "md",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`${BADGE_BASE} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  );
});
export { Badge };

