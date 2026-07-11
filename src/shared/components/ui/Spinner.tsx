export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

const sizeMap: Record<SpinnerSize, number> = {
  sm: 14,
  md: 20,
  lg: 28,
};

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  const px = sizeMap[size];

  return (
    <svg
      className={`animate-spin text-current ${className}`}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="placeholders.loading"
      role="status"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        opacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

