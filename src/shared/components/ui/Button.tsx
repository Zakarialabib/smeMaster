import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Spinner, type SpinnerSize } from "./Spinner";
import { BTN_BASE, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, BTN_GLASS } from "@shared/styles/ui-tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "glass";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
  icon?: ReactNode;
  /** Convenience alias for `icon` when placed on the right side (overrides iconPosition) */
  iconRight?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  iconPosition?: "left" | "right";
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: BTN_PRIMARY,
  secondary: BTN_SECONDARY,
  ghost: BTN_GHOST,
  danger: BTN_DANGER,
  glass: BTN_GLASS,
};

const baseSizes: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-xs gap-1",
  sm: "px-3 py-1.5 text-xs gap-1.5 min-h-[44px]",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2",
};

const iconOnlySizes: Record<ButtonSize, string> = {
  xs: "p-1 min-h-[44px] min-w-[44px]",
  sm: "p-1.5 min-h-[44px] min-w-[44px]",
  md: "p-2",
  lg: "p-3",
};

const spinnerSizes: Record<ButtonSize, SpinnerSize> = {
  xs: "sm",
  sm: "sm",
  md: "md",
  lg: "md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = "secondary",
  size = "sm",
  className = "",
  children,
  icon,
  iconRight,
  iconOnly = false,
  loading = false,
  iconPosition = "left",
  disabled,
  ...rest
}, ref) {
  const sz = iconOnly ? iconOnlySizes[size] : baseSizes[size];
  const isDisabled = disabled || loading;

  // When iconRight is provided, always render it on the right side
  const leftIcon = iconRight ? undefined : icon;
  const rightIcon = iconRight ?? (iconPosition === "right" ? icon : undefined);

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-label={loading ? "Loading..." : rest["aria-label"]}
      className={`${BTN_BASE} ${variantClasses[variant]} ${sz} ${className}`}
      {...rest}
    >
      {loading ? (
        <Spinner size={spinnerSizes[size]} />
      ) : iconOnly && icon && !iconRight ? (
        icon
      ) : (
        <>
          {iconPosition === "left" && leftIcon}
          {children}
          {(iconPosition === "right" || iconRight !== undefined) && rightIcon}
        </>
      )}
    </button>
  );
});

