import type { ReactNode } from "react";

interface StatBoxProps {
  label: string;
  value: number | string;
  variant?: "default" | "danger" | "warning" | "muted";
  icon?: ReactNode;
  subtitle?: string;
}

export function StatBox({ label, value, variant, icon, subtitle }: StatBoxProps) {
  const colorClass =
    variant === "danger"
      ? "text-danger"
      : variant === "warning"
        ? "text-warning"
        : variant === "muted"
          ? "text-text-tertiary"
          : "text-text-primary";
  return (
    <div className="bg-bg-secondary rounded-lg p-3 text-center">
      {icon && <div className="text-accent mb-1 flex justify-center">{icon}</div>}
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${colorClass}`}>{value}</p>
      {subtitle && <p className="text-[0.625rem] text-text-tertiary mt-0.5">{subtitle}</p>}
    </div>
  );
}
