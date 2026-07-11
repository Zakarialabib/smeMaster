interface Props {
  size?: number;
  className?: string;
}

export function NoAccountIllustration({ size = 140, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Person silhouette circle */}
      <circle
        cx="65"
        cy="65"
        r="35"
        fill="var(--color-bg-tertiary)"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
      />
      {/* Head */}
      <circle
        cx="65"
        cy="52"
        r="12"
        fill="var(--color-accent)"
        opacity="0.2"
      />
      {/* Body / shoulders */}
      <path
        d="M43 88 C43 74 55 66 65 66 C75 66 87 74 87 88"
        fill="var(--color-accent)"
        opacity="0.15"
      />
      {/* Plus badge */}
      <circle
        cx="95"
        cy="40"
        r="16"
        fill="var(--color-accent)"
        opacity="0.15"
      />
      <circle
        cx="95"
        cy="40"
        r="12"
        fill="var(--color-accent)"
        opacity="0.25"
      />
      {/* Plus sign */}
      <line
        x1="89"
        y1="40"
        x2="101"
        y2="40"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="95"
        y1="34"
        x2="95"
        y2="46"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Sparkles */}
      <circle cx="112" cy="60" r="2" fill="var(--color-accent)" opacity="0.3" />
      <circle cx="108" cy="72" r="1.5" fill="var(--color-accent)" opacity="0.2" />
    </svg>
  );
}
