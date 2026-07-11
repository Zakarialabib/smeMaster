/**
 * Enhanced Select component with visual polish for filter bars and dropdowns.
 * Features: smooth interactions, visual feedback, accessibility, dark mode support.
 */
import { forwardRef, useId, useState, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { INPUT_BASE } from "@shared/styles/ui-tokens";
import { cn } from "@shared/utils/cn";

export interface StyledSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** Display label above select */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Placeholder text when no value selected */
  placeholder?: string;
  /** Optional icon before label */
  icon?: React.ReactNode;
  /** Compact size variant for inline filters */
  compact?: boolean;
  /** Optional description text below label */
  description?: string;
  /** Disable the select */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

export const StyledSelect = forwardRef<HTMLSelectElement, StyledSelectProps>(
  function StyledSelect(
    {
      label,
      error,
      placeholder,
      icon,
      compact = false,
      description,
      disabled = false,
      size = "md",
      className = "",
      id: externalId,
      children,
      ...rest
    },
    ref,
  ) {
    const generatedId = useId();
    const id = externalId ?? generatedId;
    const errorId = `${id}-error`;
    const descId = `${id}-description`;
    const [focused, setFocused] = useState(false);

    // Size classes
    const sizeClasses = {
      sm: "px-2 py-1 text-xs min-h-[44px]",
      md: "px-3 py-1.5 text-sm min-h-[44px]",
      lg: "px-4 py-2 text-base h-10",
    };

    // Gap between label and control
    const gapClass = compact ? "gap-1" : "gap-1.5";

    return (
      <div className={cn("flex flex-col", gapClass, compact && "flex-row items-center")}>
        {/* Label with optional icon */}
        {label && (
          <div className="flex items-center gap-1.5">
            {icon}
            <label
              htmlFor={id}
              className={cn(
                "font-medium text-text-primary transition-colors",
                compact ? "text-xs" : "text-sm",
              )}
            >
              {label}
            </label>
          </div>
        )}

        {/* Description text */}
        {description && !compact && (
          <p
            id={descId}
            className="text-xs text-text-tertiary -mt-1"
          >
            {description}
          </p>
        )}

        {/* Select wrapper with focus indicator */}
        <div
          className={cn(
            "relative inline-flex transition-all duration-150",
            compact && "flex-1",
            !compact && "w-full",
          )}
        >
          <select
            ref={ref}
            id={id}
            disabled={disabled}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-invalid={!!error}
            aria-describedby={
              error ? errorId : description ? descId : undefined
            }
            className={cn(
              INPUT_BASE,
              "appearance-none pr-8 glass-select",
              // Size
              sizeClasses[size],
              // Error state
              error && "border-danger focus:ring-danger focus:border-danger bg-danger/5",
              // Focus state
              focused && "ring-2 ring-accent/30",
              // Disabled state
              disabled && "opacity-50 cursor-not-allowed bg-bg-tertiary/50",
              // Hover state
              !disabled && "hover:border-border-secondary transition-colors",
              className,
            )}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {children}
          </select>

          {/* Chevron icon */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronDown
              size={compact ? 14 : 16}
              className={cn(
                "text-text-tertiary transition-transform duration-200",
                focused && "text-accent",
              )}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p
            id={errorId}
            className="text-xs text-danger font-medium mt-1"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

