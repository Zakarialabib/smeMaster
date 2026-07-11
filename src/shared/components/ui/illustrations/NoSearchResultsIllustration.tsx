interface Props {
  size?: number;
  className?: string;
}

export function NoSearchResultsIllustration({ size = 140, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Empty area / document lines */}
      <rect
        x="30"
        y="50"
        width="60"
        height="60"
        rx="6"
        fill="var(--color-bg-tertiary)"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
      />
      <rect x="40" y="65" width="40" height="3" rx="1.5" fill="var(--color-border-primary)" opacity="0.5" />
      <rect x="40" y="74" width="30" height="3" rx="1.5" fill="var(--color-border-primary)" opacity="0.35" />
      <rect x="40" y="83" width="35" height="3" rx="1.5" fill="var(--color-border-primary)" opacity="0.25" />
      <rect x="40" y="92" width="20" height="3" rx="1.5" fill="var(--color-border-primary)" opacity="0.15" />
      {/* Magnifying glass (tilted) */}
      <g transform="translate(80, 30) rotate(15)">
        {/* Glass circle */}
        <circle
          cx="18"
          cy="18"
          r="18"
          fill="var(--color-accent)"
          opacity="0.1"
        />
        <circle
          cx="18"
          cy="18"
          r="16"
          stroke="var(--color-accent)"
          strokeWidth="3"
          fill="none"
          opacity="0.6"
        />
        {/* Handle */}
        <line
          x1="30"
          y1="30"
          x2="42"
          y2="42"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.5"
        />
        {/* Question mark inside */}
        <text
          x="18"
          y="23"
          textAnchor="middle"
          fontSize="16"
          fontWeight="600"
          fill="var(--color-accent)"
          opacity="0.5"
        >
          ?
        </text>
      </g>
    </svg>
  );
}
